import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Phone, PhoneOff, Volume2, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { WebRTCHandler } from '../../utils/webrtcHandler';
import { useVideoConferencing } from '../../hooks/useVideoConferencing';

/**
 * Display Client Component
 * Professional displays connect to this page via browser
 * Shows normal signage by default, switches to video call when admin initiates conference
 * Receives video calls, displays video stream, handles P2P WebRTC
 */

interface ConferenceState {
  conferenceId: string;
  adminUserId: string;
  mode: string;
  defaultVolume: number;
  muteOnStart: boolean;
}

export default function DisplayClient() {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const { socket, onConferenceInitiated, onWebRTCSignal, onConferenceEnded } = useVideoConferencing();
  const [searchParams] = useSearchParams();
  const screenId = searchParams.get('screenId') || '';

  const [isInCall, setIsInCall] = useState(false);
  const [conferenceState, setConferenceState] = useState<ConferenceState | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [volume, setVolume] = useState(50);
  const [connectionStatus, setConnectionStatus] = useState('waiting');
  const [error, setError] = useState<string | null>(null);

  const webrtcRef = useRef<WebRTCHandler | null>(null);

  // Initialize WebRTC handler
  useEffect(() => {
    if (!webrtcRef.current) {
      webrtcRef.current = new WebRTCHandler();
    }
  }, []);

  // Join this screen's room so the server can route calls to it
  useEffect(() => {
    if (!socket || !screenId) return;
    socket.emit('register-display', screenId);
  }, [socket, screenId]);

  // Listen for incoming conference calls
  useEffect(() => {
    if (!socket) return;

    onConferenceInitiated((data: any) => {
      console.log('[DisplayClient] Conference initiated:', data);
      setConferenceState(data);
      setError(null);
      acceptConference(data);
    });

    return () => {
      // Cleanup listeners
    };
  }, [socket, onConferenceInitiated]);

  // Listen for conference end
  useEffect(() => {
    if (!socket) return;

    onConferenceEnded((data: any) => {
      console.log('[DisplayClient] Conference ended:', data);
      endCall();
    });

    return () => {
      // Cleanup listeners
    };
  }, [socket, onConferenceEnded]);

  // Listen for WebRTC signals from admin
  useEffect(() => {
    if (!socket || !webrtcRef.current) return;

    onWebRTCSignal(async (data: any) => {
      console.log('[DisplayClient] WebRTC signal received:', data.signal.type);

      try {
        if (data.signal.type === 'offer') {
          // Handle SDP offer from admin
          const answer = await webrtcRef.current!.handleOffer(data.signal);
          socket.emit('webrtc:signal', {
            conferenceId: data.conferenceId,
            signal: answer
          });
          setConnectionStatus('answering');
        } else if (data.signal.type === 'answer') {
          // Handle SDP answer from admin
          await webrtcRef.current!.handleAnswer(data.signal);
          setConnectionStatus('connecting');
        } else if (data.signal.candidate) {
          // Handle ICE candidate
          await webrtcRef.current!.addICECandidate(data.signal);
        }
      } catch (err) {
        console.error('[DisplayClient] Error handling signal:', err);
        setError('Signal handling error');
      }
    });
  }, [socket, onWebRTCSignal]);

  /**
   * Accept incoming conference call
   */
  const acceptConference = async (conference: ConferenceState) => {
    if (!webrtcRef.current || !socket) return;

    try {
      setIsInCall(true);
      setConnectionStatus('initializing');

      // Initialize peer connection
      await webrtcRef.current.initializePeerConnection();

      // Get local media stream and attach it — a missing camera/mic shouldn't
      // block the call, it just means this display sends no video/audio back.
      try {
        await webrtcRef.current.getLocalStream();
        await webrtcRef.current.addLocalStreamToPeerConnection();
      } catch (mediaErr) {
        console.warn('[DisplayClient] Could not access camera/microphone, continuing without local media', mediaErr);
      }

      // Handle remote stream
      webrtcRef.current.onRemoteStreamReceived((stream: MediaStream) => {
        console.log('[DisplayClient] Remote stream received');
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
        setConnectionStatus('connected');
      });

      // Handle ICE candidates
      webrtcRef.current.onICECandidate((candidate: RTCIceCandidate | null) => {
        if (candidate) {
          socket.emit('webrtc:signal', {
            conferenceId: conference.conferenceId,
            signal: {
              type: 'candidate',
              candidate: candidate.candidate,
              sdpMLineIndex: candidate.sdpMLineIndex,
              sdpMid: candidate.sdpMid
            }
          });
        }
      });

      // Apply conference settings
      if (conference.muteOnStart) {
        webrtcRef.current.setAudioEnabled(false);
        setAudioEnabled(false);
      }

      if (conference.defaultVolume >= 0 && conference.defaultVolume <= 100) {
        setVolume(conference.defaultVolume);
      }

      // Peer connection is now ready to receive the caller's SDP offer via
      // the webrtc:signal listener above, which will create and send our answer.
      setConnectionStatus('waiting-for-admin');
    } catch (err) {
      console.error('[DisplayClient] Error accepting conference:', err);
      setError((err as Error).message);
      rejectConference();
    }
  };

  /**
   * Reject conference call
   */
  const rejectConference = () => {
    if (webrtcRef.current) {
      webrtcRef.current.close();
    }
    setIsInCall(false);
    setConferenceState(null);
    setConnectionStatus('waiting');
  };

  /**
   * End conference call
   */
  const endCall = () => {
    if (socket && conferenceState) {
      socket.emit('video:leave-conference', {
        conferenceId: conferenceState.conferenceId
      });
    }
    if (webrtcRef.current) {
      webrtcRef.current.close();
    }
    setIsInCall(false);
    setConferenceState(null);
    setConnectionStatus('waiting');
    setError(null);
  };

  /**
   * Toggle audio
   */
  const toggleAudio = () => {
    const newState = !audioEnabled;
    if (webrtcRef.current) {
      webrtcRef.current.setAudioEnabled(newState);
    }
    setAudioEnabled(newState);
  };

  /**
   * Toggle video
   */
  const toggleVideo = () => {
    const newState = !videoEnabled;
    if (webrtcRef.current) {
      webrtcRef.current.setVideoEnabled(newState);
    }
    setVideoEnabled(newState);
  };

  /**
   * Handle volume change
   */
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = newVolume / 100;
    }
  };

  return (
    <div className="w-full h-screen bg-black flex flex-col">
      {/* Main Display Area - Shows Signage or Video */}
      <div className="flex-1 flex items-center justify-center bg-gray-900 relative overflow-hidden">
        {isInCall ? (
          <>
            {/* VIDEO MODE: Remote video from admin */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{ background: '#000' }}
            />

            {/* Status Overlay */}
            <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
              <p className="font-semibold capitalize">
                {connectionStatus === 'connected' ? '🟢 Connected' : `${connectionStatus}...`}
              </p>
              {conferenceState && (
                <p className="text-xs text-gray-300 mt-1">Mode: {conferenceState.mode.replace('-', ' ')}</p>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="absolute top-4 right-4 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
          </>
        ) : (
          <>
            {/* SIGNAGE MODE: Normal display content */}
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
              <div className="text-center space-y-6">
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold text-white">SignageOS Display</h1>
                  <p className="text-gray-300">Ready to serve content</p>
                </div>

                {/* Placeholder for signage content */}
                <div className="w-96 h-64 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg border-2 border-gray-600 flex items-center justify-center">
                  <div className="text-center">
                    <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400">Signage Content Area</p>
                    <p className="text-xs text-gray-500 mt-2">Your playlists & media display here</p>
                  </div>
                </div>

                {/* Display ID and status */}
                <div className="pt-4 border-t border-gray-700">
                  <p className="text-sm text-gray-400">
                    Display ID: <span className="font-mono text-gray-300">{screenId || 'Not set — append ?screenId=...'}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Status: {screenId ? '🟢 Online • Waiting for conference call' : '⚠️ No screen ID — this display will not receive calls'}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Control Bar */}
      {isInCall && (
        <div className="bg-gray-900 border-t border-gray-700 px-6 py-4 flex items-center justify-between">
          {/* Left: Audio/Video Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-full transition-all ${
                audioEnabled
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title={audioEnabled ? 'Mute audio' : 'Unmute audio'}
            >
              {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full transition-all ${
                videoEnabled
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title={videoEnabled ? 'Disable video' : 'Enable video'}
            >
              {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
          </div>

          {/* Center: Volume Control */}
          <div className="flex items-center gap-3 flex-1 max-w-xs mx-auto">
            <Volume2 size={18} className="text-gray-400" />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={e => handleVolumeChange(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-gray-400 text-sm w-8 text-right">{volume}%</span>
          </div>

          {/* Right: End Call Button */}
          <button
            onClick={endCall}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all"
            title="End call"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      )}

      {/* Status Bar - Different when in call vs signage mode */}
      {!isInCall && (
        <div className="bg-gray-900 border-t border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-sm text-gray-400">
                <span className="text-gray-300">Signage Display</span> • Ready
              </p>
            </div>
            <div className="text-right text-xs text-gray-500">
              Last update: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
