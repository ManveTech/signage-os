import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '../config';

interface ConferenceEventData {
  conferenceId: string;
  adminUserId?: string;
  screenId?: string;
  toScreenId?: string;
  signal?: any;
  mode?: string;
  defaultVolume?: number;
  muteOnStart?: boolean;
}

export function useVideoConferencing() {
  const socketRef = useRef<Socket | null>(null);
  const [conferenceId, setConferenceId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      autoConnect: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      console.log('[VideoConf] Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason: string) => {
      setIsConnected(false);
      console.log('[VideoConf] Socket disconnected:', reason);
    });

    socket.on('connect_error', (error: Error) => {
      setError(error.message);
      console.error('[VideoConf] Connection error:', error);
    });

    socket.on('error', (error: any) => {
      console.error('[VideoConf] Socket error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  /**
   * Emit conference initiation signal to displays
   */
  const initiateConference = (conferenceData: ConferenceEventData) => {
    if (!socketRef.current) return;
    socketRef.current.emit('video:initiate-conference', conferenceData);
  };

  /**
   * Join a conference (display side)
   */
  const joinConference = (confId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('video:join-conference', { conferenceId: confId });
    setConferenceId(confId);
  };

  /**
   * Send WebRTC signal (SDP offer/answer or ICE candidate)
   */
  const sendWebRTCSignal = (toUserId: string, signal: any) => {
    if (!socketRef.current || !conferenceId) return;
    socketRef.current.emit('webrtc:signal', {
      conferenceId,
      toUserId,
      signal
    });
  };

  /**
   * Send WebRTC signal to specific screen
   */
  const sendWebRTCSignalToScreen = (conferenceId: string, toScreenId: string, signal: any) => {
    if (!socketRef.current) return;
    socketRef.current.emit('webrtc:signal', {
      conferenceId,
      toScreenId,
      signal
    });
  };

  /**
   * Leave conference
   */
  const leaveConference = () => {
    if (!socketRef.current || !conferenceId) return;
    socketRef.current.emit('video:leave-conference', { conferenceId });
    setConferenceId(null);
  };

  /**
   * Listen for conference initiation
   */
  const onConferenceInitiated = (callback: (data: ConferenceEventData) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on('conference:initiated', callback);
    return () => socketRef.current?.off('conference:initiated', callback);
  };

  /**
   * Listen for conference end
   */
  const onConferenceEnded = (callback: (data: ConferenceEventData) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on('conference:ended', callback);
    return () => socketRef.current?.off('conference:ended', callback);
  };

  /**
   * Listen for WebRTC signals
   */
  const onWebRTCSignal = (callback: (data: ConferenceEventData) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on('webrtc:signal', callback);
    return () => socketRef.current?.off('webrtc:signal', callback);
  };

  /**
   * Listen for specific screen WebRTC signals
   */
  const onWebRTCSignalForScreen = (screenId: string, callback: (data: ConferenceEventData) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on(`webrtc:signal-${screenId}`, callback);
    return () => socketRef.current?.off(`webrtc:signal-${screenId}`, callback);
  };

  /**
   * Listen for display status updates
   */
  const onDisplayStatus = (callback: (data: any) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on('display:status', callback);
    return () => socketRef.current?.off('display:status', callback);
  };

  return {
    socket: socketRef.current,
    conferenceId,
    isConnected,
    error,
    initiateConference,
    joinConference,
    sendWebRTCSignal,
    sendWebRTCSignalToScreen,
    leaveConference,
    onConferenceInitiated,
    onConferenceEnded,
    onWebRTCSignal,
    onWebRTCSignalForScreen,
    onDisplayStatus
  };
}
