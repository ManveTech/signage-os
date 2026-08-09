import React, { useState, useEffect, useRef } from 'react';
import { Phone, Users, Monitor, Settings } from 'lucide-react';
import { WebRTCHandler } from '../../../utils/webrtcHandler';
import { useVideoConferencing } from '../../../hooks/useVideoConferencing';
import { API_BASE } from '../../../config';
import CallOverlay, { ChatMessage } from '../../../components/CallOverlay';

type ConferenceMode = 'one-to-one' | 'group' | 'manual-select';

interface Screen {
  id: string;
  name: string;
  cameraMountEnabled: boolean;
}

export default function VideoConferencing() {
  const { socket, initiateConference: emitInitiateConference, joinConference, onWebRTCSignal, onScreenRejoined, sendChatMessage, onChatMessage } = useVideoConferencing();
  const webrtcRef = useRef<WebRTCHandler | null>(null);

  const [selectedMode, setSelectedMode] = useState<ConferenceMode>('one-to-one');
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(false);
  const [defaultVolume, setDefaultVolume] = useState(50);
  const [muteOnStart, setMuteOnStart] = useState(true);
  const [organizationId, setOrganizationId] = useState<string>('');

  const [inCall, setInCall] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('initiating');
  const [conferenceId, setConferenceId] = useState<string | null>(null);
  const [callTargetIds, setCallTargetIds] = useState<string[]>([]);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(!muteOnStart);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const orgId = localStorage.getItem('signageos_org_id');
    if (orgId) setOrganizationId(orgId);
    fetchScreens();
  }, []);

  useEffect(() => {
    const unsubscribe = onChatMessage((data: any) => {
      setChatMessages(prev => [...prev, { senderName: data.senderName || 'TV', text: data.text, ts: data.ts, self: false }]);
    });
    return unsubscribe;
  }, [onChatMessage]);

  // A TV that got killed (or accidentally closed) and reopened mid-call comes
  // back with a brand new, empty peer connection — it can't hear/see us again
  // until we tear down our side and send it a fresh offer.
  useEffect(() => {
    const unsubscribe = onScreenRejoined(async ({ screenId, conferenceId: rejoinedConferenceId }) => {
      if (!socket || !conferenceId || rejoinedConferenceId !== conferenceId || !callTargetIds.includes(screenId)) return;

      console.log(`[VideoConferencing] Screen ${screenId} rejoined conference, re-sending offer`);
      setConnectionStatus('initiating');

      webrtcRef.current?.close();
      const handler = new WebRTCHandler();
      webrtcRef.current = handler;

      try {
        const stream = await handler.getLocalStream();
        setLocalStream(stream);
        if (!micEnabled) {
          handler.setAudioEnabled(false);
        }
        await handler.addLocalStreamToPeerConnection();
      } catch (err) {
        console.warn('Could not access camera/microphone on rejoin, continuing without local media', err);
      }

      handler.onRemoteStreamReceived((stream) => setRemoteStream(stream));

      handler.onICECandidate((candidate: RTCIceCandidate | null) => {
        if (candidate) {
          socket.emit('webrtc:signal', {
            conferenceId,
            toScreenId: screenId,
            signal: {
              type: 'candidate',
              candidate: candidate.candidate,
              sdpMLineIndex: candidate.sdpMLineIndex,
              sdpMid: candidate.sdpMid
            }
          });
        }
      });

      try {
        const offer = await handler.createOffer();
        socket.emit('webrtc:signal', { conferenceId, toScreenId: screenId, signal: offer });
      } catch (err) {
        console.error(`Error creating rejoin offer for ${screenId}:`, err);
        setConnectionStatus('error');
      }
    });
    return unsubscribe;
  }, [onScreenRejoined, socket, conferenceId, callTargetIds, micEnabled]);

  const authHeaders = () => {
    const token = localStorage.getItem('signageos_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchScreens = async () => {
    try {
      const response = await fetch(`${API_BASE}/screens?cameraMountEnabled=true`, { headers: authHeaders() });
      if (response.ok) {
        const data = await response.json();
        setScreens(Array.isArray(data) ? data : (data.items || []));
      }
    } catch (error) {
      console.error('Error fetching screens:', error);
    }
  };

  const targetName = () => {
    if (callTargetIds.length === 1) {
      return screens.find(s => s.id === callTargetIds[0])?.name || 'TV';
    }
    return `${callTargetIds.length} TVs`;
  };

  const startConference = async () => {
    if (!organizationId || !socket) {
      alert('Organization ID or Socket not found');
      return;
    }

    const targetIds = selectedMode === 'one-to-one' ? selectedScreens.slice(0, 1) : selectedScreens;
    if (targetIds.length === 0 && (selectedMode === 'group' || selectedMode === 'manual-select')) {
      alert('Please select at least one screen');
      return;
    }

    setLoading(true);
    try {
      const adminUserId = localStorage.getItem('signageos_user_id') || '';

      const response = await fetch(`${API_BASE}/video-conference/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          mode: selectedMode,
          targetScreenIds: targetIds,
          adminUserId,
          organizationId,
          defaultVolume,
          muteOnStart
        })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.error}`);
        setLoading(false);
        return;
      }

      const conference = await response.json();
      setConferenceId(conference.conferenceId);
      setCallTargetIds(targetIds);
      setConnectionStatus('initiating');
      setChatMessages([]);
      setMicEnabled(!muteOnStart);
      setCameraEnabled(true);
      setIsScreenSharing(false);
      setInCall(true);

      // Join our own per-conference room so displays have somewhere to send
      // their answer/ICE candidates back to.
      joinConference(conference.conferenceId);

      // Tell the display(s) a call is coming in so they set up their peer connection
      // before we start sending WebRTC offers.
      emitInitiateConference({
        conferenceId: conference.conferenceId,
        adminUserId,
        mode: selectedMode,
        targetScreenIds: targetIds,
        defaultVolume,
        muteOnStart
      } as any);

      if (!webrtcRef.current) {
        webrtcRef.current = new WebRTCHandler();
      }

      try {
        const stream = await webrtcRef.current.getLocalStream();
        setLocalStream(stream);
        if (muteOnStart) {
          webrtcRef.current.setAudioEnabled(false);
        }
        await webrtcRef.current.addLocalStreamToPeerConnection();
      } catch (err) {
        console.warn('Could not access camera/microphone, continuing call without local media', err);
      }

      webrtcRef.current.onRemoteStreamReceived((stream) => {
        setRemoteStream(stream);
      });

      // Single generic listener for whatever comes back from the display(s) in
      // this conference — the server broadcasts answers/ICE candidates to
      // everyone in the conference room except the sender.
      onWebRTCSignal(async (data: any) => {
        try {
          if (data.signal?.type === 'answer') {
            await webrtcRef.current!.handleAnswer(data.signal);
            setConnectionStatus('connected');
          } else if (data.signal?.candidate) {
            await webrtcRef.current!.addICECandidate(data.signal);
          }
        } catch (err) {
          console.error('Error handling signal from display:', err);
        }
      });

      webrtcRef.current.onICECandidate((candidate: RTCIceCandidate | null) => {
        if (candidate) {
          targetIds.forEach(screenId => {
            socket.emit('webrtc:signal', {
              conferenceId: conference.conferenceId,
              toScreenId: screenId,
              signal: {
                type: 'candidate',
                candidate: candidate.candidate,
                sdpMLineIndex: candidate.sdpMLineIndex,
                sdpMid: candidate.sdpMid
              }
            });
          });
        }
      });

      targetIds.forEach(async (screenId) => {
        try {
          const offer = await webrtcRef.current!.createOffer();
          socket.emit('webrtc:signal', {
            conferenceId: conference.conferenceId,
            toScreenId: screenId,
            signal: offer
          });
        } catch (err) {
          console.error(`Error creating offer for ${screenId}:`, err);
          setConnectionStatus('error');
        }
      });

      setSelectedScreens([]);
    } catch (error) {
      console.error('Error starting conference:', error);
      alert('Failed to start conference');
      setInCall(false);
    } finally {
      setLoading(false);
    }
  };

  const endConference = async () => {
    if (!conferenceId) return;
    try {
      await fetch(`${API_BASE}/video-conference/${conferenceId}/end`, {
        method: 'POST',
        headers: authHeaders()
      });
    } catch (error) {
      console.error('Error ending conference:', error);
    } finally {
      if (webrtcRef.current) {
        webrtcRef.current.close();
        webrtcRef.current = null;
      }
      setInCall(false);
      setConnectionStatus('initiating');
      setConferenceId(null);
      setCallTargetIds([]);
      setRemoteStream(null);
      setLocalStream(null);
      setChatMessages([]);
    }
  };

  const handleToggleMic = () => {
    const next = !micEnabled;
    webrtcRef.current?.setAudioEnabled(next);
    setMicEnabled(next);
  };

  const handleToggleCamera = () => {
    const next = !cameraEnabled;
    webrtcRef.current?.setVideoEnabled(next);
    setCameraEnabled(next);
  };

  const handleToggleScreenShare = async () => {
    if (!webrtcRef.current) return;
    try {
      if (isScreenSharing) {
        await webrtcRef.current.stopScreenShare();
        setIsScreenSharing(false);
      } else {
        await webrtcRef.current.startScreenShare(() => setIsScreenSharing(false));
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.warn('Screen share cancelled or failed', err);
    }
  };

  const handleSendChatMessage = (text: string) => {
    if (!conferenceId) return;
    const senderName = localStorage.getItem('signageos_admin_name') || 'Admin';
    sendChatMessage({ conferenceId, targetScreenIds: callTargetIds, senderName, text });
    setChatMessages(prev => [...prev, { senderName: 'You', text, ts: Date.now(), self: true }]);
  };

  const handleScreenSelect = (screenId: string) => {
    if (selectedMode === 'one-to-one') {
      setSelectedScreens([screenId]);
    } else {
      setSelectedScreens(prev =>
        prev.includes(screenId)
          ? prev.filter(id => id !== screenId)
          : [...prev, screenId]
      );
    }
  };

  if (inCall) {
    return (
      <CallOverlay
        targetName={targetName()}
        connectionStatus={connectionStatus}
        remoteStream={remoteStream}
        localStream={localStream}
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        isScreenSharing={isScreenSharing}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onEndCall={endConference}
        chatMessages={chatMessages}
        onSendChatMessage={handleSendChatMessage}
      />
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Conferencing</h1>
          <p className="text-gray-600">Manage live video calls with TVs and handle camera streams</p>
        </div>

        {/* Mode Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Conference Mode</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { mode: 'one-to-one' as ConferenceMode, label: '1-to-1 Call', icon: Phone },
              { mode: 'group' as ConferenceMode, label: 'Group Call', icon: Users },
              { mode: 'manual-select' as ConferenceMode, label: 'Manual Select', icon: Monitor }
            ].map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => {
                  setSelectedMode(mode);
                  setSelectedScreens([]);
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedMode === mode
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <Icon className="w-6 h-6 mx-auto mb-2" />
                <p className="text-sm font-medium">{label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Screen Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedMode === 'one-to-one' ? 'Select a TV' : 'Select TVs'}
          </h2>
          {screens.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">No screens with camera mount enabled</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {screens.map(screen => (
                <label
                  key={screen.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedScreens.includes(screen.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type={selectedMode === 'one-to-one' ? 'radio' : 'checkbox'}
                    name="screens"
                    value={screen.id}
                    checked={selectedScreens.includes(screen.id)}
                    onChange={() => handleScreenSelect(screen.id)}
                    className="mr-3"
                  />
                  <span className="text-sm font-medium text-gray-900">{screen.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings size={18} />
            Conference Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Volume: {defaultVolume}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={defaultVolume}
                onChange={e => setDefaultVolume(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={muteOnStart}
                onChange={e => setMuteOnStart(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">Mute microphone on start</span>
            </label>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={startConference}
          disabled={loading || (selectedMode !== 'one-to-one' && selectedScreens.length === 0)}
          className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
            loading || (selectedMode !== 'one-to-one' && selectedScreens.length === 0)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Phone size={18} />
          {loading ? 'Starting...' : 'Start Conference'}
        </button>
      </div>
    </div>
  );
}
