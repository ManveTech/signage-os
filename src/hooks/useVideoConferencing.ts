import { useCallback, useEffect, useRef, useState } from 'react';
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
  const conferenceIdRef = useRef<string | null>(null);
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
      // A reconnect gets a brand new socket.id, so the server-side room
      // membership and caller tracking from the original join are gone —
      // without re-joining, the server would (after its grace period) treat
      // this caller as vanished and stop letting the screen rejoin the call.
      if (conferenceIdRef.current) {
        socket.emit('video:join-conference', { conferenceId: conferenceIdRef.current });
      }
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

  // Every function below is memoized with a stable identity (they only ever
  // close over the socketRef object, never its .current value at creation
  // time) so that consumers' `useEffect(() => { onXyz(cb) }, [onXyz])`
  // register a listener exactly once instead of accumulating a new one on
  // every render — duplicate listeners were causing the same offer/answer/ICE
  // event to be processed multiple times and corrupting the peer connection.

  /**
   * Emit conference initiation signal to displays
   */
  const initiateConference = useCallback((conferenceData: ConferenceEventData) => {
    if (!socketRef.current) return;
    socketRef.current.emit('video:initiate-conference', conferenceData);
  }, []);

  /**
   * Join a conference (display side)
   */
  const joinConference = useCallback((confId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('video:join-conference', { conferenceId: confId });
    conferenceIdRef.current = confId;
    setConferenceId(confId);
  }, []);

  /**
   * Send WebRTC signal (SDP offer/answer or ICE candidate)
   */
  const sendWebRTCSignal = useCallback((toUserId: string, signal: any) => {
    if (!socketRef.current || !conferenceId) return;
    socketRef.current.emit('webrtc:signal', {
      conferenceId,
      toUserId,
      signal
    });
  }, [conferenceId]);

  /**
   * Send WebRTC signal to specific screen
   */
  const sendWebRTCSignalToScreen = useCallback((conferenceId: string, toScreenId: string, signal: any) => {
    if (!socketRef.current) return;
    socketRef.current.emit('webrtc:signal', {
      conferenceId,
      toScreenId,
      signal
    });
  }, []);

  /**
   * Leave conference
   */
  const leaveConference = useCallback(() => {
    if (!socketRef.current || !conferenceId) return;
    socketRef.current.emit('video:leave-conference', { conferenceId });
    conferenceIdRef.current = null;
    setConferenceId(null);
  }, [conferenceId]);

  /**
   * Listen for conference initiation
   */
  const onConferenceInitiated = useCallback((callback: (data: ConferenceEventData) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on('conference:initiated', callback);
    return () => { socketRef.current?.off('conference:initiated', callback); };
  }, []);

  /**
   * Listen for conference end
   */
  const onConferenceEnded = useCallback((callback: (data: ConferenceEventData) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on('conference:ended', callback);
    return () => { socketRef.current?.off('conference:ended', callback); };
  }, []);

  /**
   * Listen for WebRTC signals
   */
  const onWebRTCSignal = useCallback((callback: (data: ConferenceEventData) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on('webrtc:signal', callback);
    return () => { socketRef.current?.off('webrtc:signal', callback); };
  }, []);

  /**
   * Listen for specific screen WebRTC signals
   */
  const onWebRTCSignalForScreen = useCallback((screenId: string, callback: (data: ConferenceEventData) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on(`webrtc:signal-${screenId}`, callback);
    return () => { socketRef.current?.off(`webrtc:signal-${screenId}`, callback); };
  }, []);

  /**
   * Listen for a screen rejoining a conference it dropped out of (app killed
   * and reopened, page reloaded, etc.) — the caller uses this to re-send a
   * fresh SDP offer to that specific screen instead of leaving it stranded.
   */
  const onScreenRejoined = useCallback((callback: (data: { screenId: string; conferenceId: string }) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on('screen:rejoined', callback);
    return () => { socketRef.current?.off('screen:rejoined', callback); };
  }, []);

  /**
   * Listen for display status updates
   */
  const onDisplayStatus = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on('display:status', callback);
    return () => { socketRef.current?.off('display:status', callback); };
  }, []);

  /**
   * Send an in-call chat message
   */
  const sendChatMessage = useCallback((data: { conferenceId: string; targetScreenIds?: string[]; senderName: string; text: string }) => {
    if (!socketRef.current) return;
    socketRef.current.emit('chat:message', { ...data, ts: Date.now() });
  }, []);

  /**
   * Listen for in-call chat messages
   */
  const onChatMessage = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on('chat:message', callback);
    return () => { socketRef.current?.off('chat:message', callback); };
  }, []);

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
    onScreenRejoined,
    onDisplayStatus,
    sendChatMessage,
    onChatMessage
  };
}
