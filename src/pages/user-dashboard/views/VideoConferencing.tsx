import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Users, Monitor, Settings, Lock } from 'lucide-react';
import { WebRTCHandler } from '../../../utils/webrtcHandler';
import { useVideoConferencing } from '../../../hooks/useVideoConferencing';
import { API_BASE } from '../../../config';

type ConferenceMode = 'one-to-one' | 'group' | 'manual-select';

interface Screen {
  id: string;
  name: string;
  cameraMountEnabled: boolean;
}

interface Conference {
  id: string;
  conferenceId: string;
  mode: ConferenceMode;
  status: string;
  startTime: string;
  targetScreenIds: string[];
  defaultVolume: number;
  muteOnStart: boolean;
}

export default function VideoConferencing({ enabled, organizationId }: { enabled: boolean; organizationId: string }) {
  const { socket, initiateConference: emitInitiateConference, joinConference, onWebRTCSignal } = useVideoConferencing();
  const webrtcRef = useRef<WebRTCHandler | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const [selectedMode, setSelectedMode] = useState<ConferenceMode>('one-to-one');
  const [activeConferences, setActiveConferences] = useState<Conference[]>([]);
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(false);
  const [defaultVolume, setDefaultVolume] = useState(50);
  const [muteOnStart, setMuteOnStart] = useState(true);
  const [inCall, setInCall] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!enabled) return;
    fetchScreens();
    if (organizationId) fetchActiveConferences();
  }, [enabled, organizationId]);

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

  const fetchActiveConferences = async () => {
    try {
      const response = await fetch(`${API_BASE}/video-conference/active?organizationId=${organizationId}`, { headers: authHeaders() });
      if (response.ok) {
        const data = await response.json();
        setActiveConferences(data);
      }
    } catch (error) {
      console.error('Error fetching conferences:', error);
    }
  };

  const startConference = async () => {
    if (!organizationId || !socket) {
      alert('Your organization is not fully set up for calling yet. Contact your administrator.');
      return;
    }

    const targetIds = selectedMode === 'one-to-one' ? selectedScreens.slice(0, 1) : selectedScreens;
    if (targetIds.length === 0 && (selectedMode === 'group' || selectedMode === 'manual-select')) {
      alert('Please select at least one screen');
      return;
    }

    setLoading(true);
    try {
      const callerUserId = localStorage.getItem('signageos_user_id') || '';

      const response = await fetch(`${API_BASE}/video-conference/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          mode: selectedMode,
          targetScreenIds: targetIds,
          adminUserId: callerUserId,
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

      // Join our own per-conference room so displays have somewhere to send
      // their answer/ICE candidates back to.
      joinConference(conference.conferenceId);

      // Tell the display(s) a call is coming in so they set up their peer connection
      // before we start sending WebRTC offers.
      emitInitiateConference({
        conferenceId: conference.conferenceId,
        adminUserId: callerUserId,
        mode: selectedMode,
        targetScreenIds: targetIds,
        defaultVolume,
        muteOnStart
      } as any);

      if (!webrtcRef.current) {
        webrtcRef.current = new WebRTCHandler();
      }

      try {
        await webrtcRef.current.getLocalStream();
        if (localVideoRef.current && webrtcRef.current.getLocalStream()) {
          localVideoRef.current.srcObject = webrtcRef.current.getLocalStream();
        }
        await webrtcRef.current.addLocalStreamToPeerConnection();
      } catch (err) {
        console.warn('Could not access camera/microphone, continuing call without local media', err);
      }

      // Single generic listener for whatever comes back from the display(s) in
      // this conference — the server broadcasts answers/ICE candidates to
      // everyone in the conference room except the sender.
      onWebRTCSignal(async (data: any) => {
        try {
          if (data.signal?.type === 'answer') {
            await webrtcRef.current!.handleAnswer(data.signal);
            setConnectionStatus(prev => {
              const next = { ...prev };
              targetIds.forEach(id => { next[id] = 'connected'; });
              return next;
            });
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
          setConnectionStatus(prev => ({ ...prev, [screenId]: 'initiating' }));

          const offer = await webrtcRef.current!.createOffer();

          socket.emit('webrtc:signal', {
            conferenceId: conference.conferenceId,
            toScreenId: screenId,
            signal: offer
          });
        } catch (err) {
          console.error(`Error creating offer for ${screenId}:`, err);
          setConnectionStatus(prev => ({ ...prev, [screenId]: 'error' }));
        }
      });

      setActiveConferences([...activeConferences, conference]);
      setSelectedScreens([]);
      setInCall(true);
    } catch (error) {
      console.error('Error starting conference:', error);
      alert('Failed to start conference');
    } finally {
      setLoading(false);
    }
  };

  const endConference = async (conferenceId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/video-conference/${conferenceId}/end`, {
        method: 'POST',
        headers: authHeaders()
      });

      if (response.ok) {
        if (webrtcRef.current) {
          webrtcRef.current.close();
          webrtcRef.current = null;
        }

        setActiveConferences(activeConferences.filter(c => c.conferenceId !== conferenceId));
        setInCall(false);
        setConnectionStatus({});
      }
    } catch (error) {
      console.error('Error ending conference:', error);
      alert('Failed to end conference');
    } finally {
      setLoading(false);
    }
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

  if (!enabled) {
    return (
      <div className="p-8">
        <div className="max-w-lg mx-auto bg-white rounded-lg border border-gray-200 p-10 text-center space-y-3">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
            <Lock size={20} />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Video Conferencing Not Enabled</h1>
          <p className="text-sm text-gray-500">
            This feature isn't included in your current license. Contact your administrator to enable it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Conference Control Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Conferencing</h1>
            <p className="text-gray-600">Call your TVs directly and manage live camera streams</p>
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

          {/* Local Video Preview (when in call) */}
          {inCall && (
            <div className="bg-black rounded-lg border border-gray-300 p-6 overflow-hidden">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Your Video</h2>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-48 object-cover bg-gray-900 rounded-lg"
              />
            </div>
          )}

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

        {/* Right: Active Conferences */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 h-fit">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Conferences</h2>
          {activeConferences.length === 0 ? (
            <p className="text-gray-500 py-8 text-center text-sm">No active conferences</p>
          ) : (
            <div className="space-y-3">
              {activeConferences.map(conference => (
                <div
                  key={conference.conferenceId}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {conference.mode.replace('-', ' ')} Call
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(conference.startTime).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => endConference(conference.conferenceId)}
                      className="text-red-600 hover:text-red-700 p-1"
                      title="End Conference"
                    >
                      <PhoneOff size={16} />
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {conference.targetScreenIds.length} TV{conference.targetScreenIds.length !== 1 ? 's' : ''}
                  </div>

                  {inCall && (
                    <div className="space-y-1">
                      {conference.targetScreenIds.map(screenId => (
                        <div key={screenId} className="text-xs flex items-center justify-between">
                          <span className="text-gray-600">{screenId}</span>
                          <span className={`px-2 py-0.5 rounded text-white text-[10px] font-medium ${
                            connectionStatus[screenId] === 'connected'
                              ? 'bg-green-500'
                              : connectionStatus[screenId] === 'error'
                              ? 'bg-red-500'
                              : connectionStatus[screenId]
                              ? 'bg-yellow-500'
                              : 'bg-gray-400'
                          }`}>
                            {connectionStatus[screenId] || 'pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
