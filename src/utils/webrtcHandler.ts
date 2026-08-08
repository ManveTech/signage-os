/**
 * WebRTC Peer Connection Handler
 * Manages creating, maintaining, and destroying P2P connections
 */

export interface WebRTCConfig {
  iceServers?: Array<{ urls: string | string[] }>;
  videoBitrate?: number;
  audioBitrate?: number;
}

export class WebRTCHandler {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: WebRTCConfig;

  constructor(config: WebRTCConfig = {}) {
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      videoBitrate: 2500, // Kbps
      audioBitrate: 128, // Kbps
      ...config
    };
  }

  /**
   * Initialize peer connection with ICE servers
   */
  async initializePeerConnection(): Promise<RTCPeerConnection> {
    if (this.peerConnection) return this.peerConnection;

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers
    });

    // Log ICE connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.peerConnection?.connectionState);
    };

    // Log ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', this.peerConnection?.iceGatheringState);
    };

    // Log ICE candidate errors
    this.peerConnection.onicecandidateerror = (event: RTCPeerConnectionIceErrorEvent) => {
      console.error('[WebRTC] ICE candidate error:', event.errorCode, event.errorText);
    };

    return this.peerConnection;
  }

  /**
   * Get local media stream (camera & microphone)
   */
  async getLocalStream(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    if (this.localStream) return this.localStream;

    const defaultConstraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: true,
      ...constraints
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(defaultConstraints);
      console.log('[WebRTC] Local stream acquired');
      return this.localStream;
    } catch (error) {
      console.error('[WebRTC] Error getting local stream:', error);
      throw error;
    }
  }

  /**
   * Add local stream tracks to peer connection
   */
  async addLocalStreamToPeerConnection(): Promise<void> {
    if (!this.peerConnection) {
      await this.initializePeerConnection();
    }

    if (!this.localStream) {
      try {
        await this.getLocalStream();
      } catch (error) {
        // No camera/mic available — the call still proceeds, just without
        // this side's local tracks.
        return;
      }
    }

    if (this.localStream && this.peerConnection) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
      console.log('[WebRTC] Local stream added to peer connection');
    }
  }

  /**
   * Handle remote stream from peer
   */
  onRemoteStreamReceived(callback: (stream: MediaStream) => void): void {
    if (!this.peerConnection) return;

    this.peerConnection.ontrack = (event: RTCTrackEvent) => {
      console.log('[WebRTC] Remote track received:', event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        callback(this.remoteStream);
      }
    };
  }

  /**
   * Handle ICE candidates
   */
  onICECandidate(callback: (candidate: RTCIceCandidate | null) => void): void {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate:', event.candidate.candidate);
        callback(event.candidate);
      } else {
        console.log('[WebRTC] ICE candidate gathering complete');
        callback(null);
      }
    };
  }

  /**
   * Create and send SDP offer
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      await this.initializePeerConnection();
    }

    if (!this.localStream) {
      await this.addLocalStreamToPeerConnection();
    }

    try {
      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await this.peerConnection!.setLocalDescription(offer);
      console.log('[WebRTC] Offer created and set as local description');
      return offer;
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming SDP offer and create answer
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      await this.initializePeerConnection();
    }

    try {
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[WebRTC] Remote offer set');

      if (!this.localStream) {
        await this.addLocalStreamToPeerConnection();
      }

      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      console.log('[WebRTC] Answer created and set as local description');
      return answer;
    } catch (error) {
      console.error('[WebRTC] Error handling offer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming SDP answer
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[WebRTC] Remote answer set');
    } catch (error) {
      console.error('[WebRTC] Error handling answer:', error);
      throw error;
    }
  }

  /**
   * Add ICE candidate
   */
  async addICECandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC] ICE candidate added');
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
    }
  }

  /**
   * Adjust video bitrate for adaptive streaming
   */
  async setVideoBitrate(bitrate: number): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const sender = this.peerConnection
        .getSenders()
        .find(s => s.track?.kind === 'video');

      if (sender) {
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        params.encodings[0].maxBitrate = bitrate * 1000; // Convert Kbps to bps
        await sender.setParameters(params);
        console.log(`[WebRTC] Video bitrate set to ${bitrate} Kbps`);
      }
    } catch (error) {
      console.error('[WebRTC] Error setting video bitrate:', error);
    }
  }

  /**
   * Mute/unmute audio
   */
  setAudioEnabled(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
      console.log(`[WebRTC] Audio ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Mute/unmute video
   */
  setVideoEnabled(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
      console.log(`[WebRTC] Video ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get connection statistics
   */
  async getStats(): Promise<RTCStatsReport> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');
    return this.peerConnection.getStats();
  }

  /**
   * Close peer connection and cleanup
   */
  close(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    console.log('[WebRTC] Peer connection closed and cleaned up');
  }

  /**
   * Get current connection state
   */
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  /**
   * Get remote stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
}
