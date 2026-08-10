import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Phone, Users, Monitor, Settings, Lock, Search, X } from 'lucide-react';
import { WebRTCHandler, acquireSharedLocalStream } from '../../../utils/webrtcHandler';
import { useVideoConferencing } from '../../../hooks/useVideoConferencing';
import { API_BASE } from '../../../config';
import CallOverlay, { ChatMessage } from '../../../components/CallOverlay';

type ConferenceMode = 'one-to-one' | 'group' | 'manual-select';

interface Screen {
  id: string;
  name: string;
  cameraMountEnabled: boolean;
  groupId?: string | null;
}

interface ScreenGroup {
  id: string;
  name: string;
  color?: string;
  orgId?: string;
}

export default function VideoConferencing({ enabled, organizationId, licenseChecked = true }: { enabled: boolean; organizationId: string; licenseChecked?: boolean }) {
  const { socket, initiateConference: emitInitiateConference, joinConference, onWebRTCSignal, onScreenRejoined, sendChatMessage, onChatMessage } = useVideoConferencing();
  // One WebRTCHandler (one RTCPeerConnection) per target screen — a group call
  // negotiates a separate SDP offer/answer with each screen, so they can't
  // share a single peer connection the way a one-to-one call can.
  const webrtcHandlersRef = useRef<Map<string, WebRTCHandler>>(new Map());
  const screenShareRef = useRef<{ displayStream: MediaStream; screenTrack: MediaStreamTrack } | null>(null);

  const [selectedMode, setSelectedMode] = useState<ConferenceMode>('one-to-one');
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [groups, setGroups] = useState<ScreenGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [defaultVolume, setDefaultVolume] = useState(50);
  const [muteOnStart, setMuteOnStart] = useState(true);
  const [screenSearch, setScreenSearch] = useState('');

  const [inCall, setInCall] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('initiating');
  const [conferenceId, setConferenceId] = useState<string | null>(null);
  const [callTargetIds, setCallTargetIds] = useState<string[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(!muteOnStart);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!enabled) return;
    fetchScreens();
    fetchGroups();
  }, [enabled, organizationId]);

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

      webrtcHandlersRef.current.get(screenId)?.close();
      const handler = new WebRTCHandler();
      webrtcHandlersRef.current.set(screenId, handler);
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(screenId);
        return next;
      });

      try {
        if (localStream) {
          handler.setLocalStream(localStream);
        } else {
          const stream = await acquireSharedLocalStream();
          setLocalStream(stream);
          handler.setLocalStream(stream);
        }
        if (!micEnabled) {
          handler.setAudioEnabled(false);
        }
        await handler.addLocalStreamToPeerConnection();
      } catch (err) {
        console.warn('Could not access camera/microphone on rejoin, continuing without local media', err);
      }

      handler.onRemoteStreamReceived((stream) => {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(screenId, stream);
          return next;
        });
      });

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
  }, [onScreenRejoined, socket, conferenceId, callTargetIds, micEnabled, localStream]);

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

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_BASE}/screen_groups`, { headers: authHeaders() });
      if (response.ok) {
        const data = await response.json();
        setGroups(Array.isArray(data) ? data : (data.items || []));
      }
    } catch (error) {
      console.error('Error fetching screen groups:', error);
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
      alert('Your organization is not fully set up for calling yet. Contact your administrator.');
      return;
    }

    const targetIds = selectedMode === 'one-to-one' ? selectedScreens.slice(0, 1) : selectedScreens;
    if (targetIds.length === 0) {
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
      setConferenceId(conference.conferenceId);
      setCallTargetIds(targetIds);
      setConnectionStatus('initiating');
      setChatMessages([]);
      setMicEnabled(!muteOnStart);
      setCameraEnabled(true);
      setIsScreenSharing(false);
      setInCall(true);
      setRemoteStreams(new Map());

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

      // One camera/mic capture shared across every target screen's peer
      // connection — getUserMedia only ever prompts once per call, regardless
      // of how many screens are being dialed.
      let sharedStream: MediaStream | null = null;
      try {
        sharedStream = await acquireSharedLocalStream();
        setLocalStream(sharedStream);
        if (muteOnStart) {
          sharedStream.getAudioTracks().forEach(t => { t.enabled = false; });
        }
      } catch (err) {
        console.warn('Could not access camera/microphone, continuing call without local media', err);
      }

      webrtcHandlersRef.current.forEach(h => h.close());
      webrtcHandlersRef.current.clear();

      // Generic listener for whatever comes back from the display(s) in this
      // conference — data.screenId identifies which screen's own peer
      // connection an answer/ICE candidate belongs to, so multiple screens in
      // a group call each get routed to their own handler instead of
      // colliding on a single shared one.
      onWebRTCSignal(async (data: any) => {
        const handler = data.screenId ? webrtcHandlersRef.current.get(data.screenId) : undefined;
        if (!handler) return;
        try {
          if (data.signal?.type === 'answer') {
            await handler.handleAnswer(data.signal);
            setConnectionStatus('connected');
          } else if (data.signal?.candidate) {
            await handler.addICECandidate(data.signal);
          }
        } catch (err) {
          console.error(`Error handling signal from display ${data.screenId}:`, err);
        }
      });

      targetIds.forEach(async (screenId) => {
        const handler = new WebRTCHandler();
        webrtcHandlersRef.current.set(screenId, handler);

        if (sharedStream) {
          handler.setLocalStream(sharedStream);
          try {
            await handler.addLocalStreamToPeerConnection();
          } catch (err) {
            console.warn(`Could not attach local media for ${screenId}`, err);
          }
        }

        handler.onRemoteStreamReceived((stream) => {
          setRemoteStreams(prev => {
            const next = new Map(prev);
            next.set(screenId, stream);
            return next;
          });
        });

        handler.onICECandidate((candidate: RTCIceCandidate | null) => {
          if (candidate) {
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
          }
        });

        try {
          const offer = await handler.createOffer();
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
      webrtcHandlersRef.current.forEach(h => h.close());
      webrtcHandlersRef.current.clear();
      screenShareRef.current?.displayStream.getTracks().forEach(t => t.stop());
      screenShareRef.current = null;
      setInCall(false);
      setConnectionStatus('initiating');
      setConferenceId(null);
      setCallTargetIds([]);
      setRemoteStreams(new Map());
      setLocalStream(null);
      setChatMessages([]);
    }
  };

  // Mic/camera are shared MediaStreamTracks attached to every target screen's
  // peer connection — toggling .enabled here affects all of them at once, no
  // need to touch each handler individually.
  const handleToggleMic = () => {
    const next = !micEnabled;
    localStream?.getAudioTracks().forEach(t => { t.enabled = next; });
    setMicEnabled(next);
  };

  const handleToggleCamera = () => {
    const next = !cameraEnabled;
    localStream?.getVideoTracks().forEach(t => { t.enabled = next; });
    setCameraEnabled(next);
  };

  const revertScreenShare = () => {
    screenShareRef.current?.displayStream.getTracks().forEach(t => t.stop());
    screenShareRef.current = null;
    const cameraTrack = localStream?.getVideoTracks()[0];
    if (cameraTrack) {
      webrtcHandlersRef.current.forEach(h => { h.replaceOutgoingVideoTrack(cameraTrack); });
    }
    setIsScreenSharing(false);
  };

  const handleToggleScreenShare = async () => {
    if (webrtcHandlersRef.current.size === 0) return;
    try {
      if (isScreenSharing) {
        revertScreenShare();
      } else {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = displayStream.getVideoTracks()[0];
        screenShareRef.current = { displayStream, screenTrack };
        for (const handler of webrtcHandlersRef.current.values()) {
          await handler.replaceOutgoingVideoTrack(screenTrack);
        }
        screenTrack.onended = () => revertScreenShare();
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.warn('Screen share cancelled or failed', err);
    }
  };

  const handleSendChatMessage = (text: string) => {
    if (!conferenceId) return;
    const email = localStorage.getItem('signageos_user_email') || '';
    const senderName = localStorage.getItem(`signageos_user_name_${email}`) || email.split('@')[0] || 'Caller';
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

  const filteredScreens = useMemo(() => {
    const q = screenSearch.trim().toLowerCase();
    if (!q) return screens;
    return screens.filter(s => s.name.toLowerCase().includes(q));
  }, [screens, screenSearch]);

  const selectAllVisible = () => {
    setSelectedScreens(prev => Array.from(new Set([...prev, ...filteredScreens.map(s => s.id)])));
  };

  // Groups are stored inversely — each screen points at its group via
  // groupId — so membership has to be derived from the loaded screen list
  // rather than read off the group record itself.
  const screensByGroup = useMemo(() => {
    const map = new Map<string, Screen[]>();
    screens.forEach(s => {
      if (!s.groupId) return;
      if (!map.has(s.groupId)) map.set(s.groupId, []);
      map.get(s.groupId)!.push(s);
    });
    return map;
  }, [screens]);

  // Only groups that have at least one call-eligible (camera-mounted) screen
  // are worth showing here — an empty group is just noise in this context.
  const callableGroups = useMemo(() => {
    return groups.filter(g =>
      (organizationId ? (g.orgId === organizationId || !g.orgId) : true) && screensByGroup.has(g.id)
    );
  }, [groups, screensByGroup, organizationId]);

  const toggleGroupSelection = (groupId: string) => {
    const memberIds = (screensByGroup.get(groupId) || []).map(s => s.id);
    const allSelected = memberIds.length > 0 && memberIds.every(id => selectedScreens.includes(id));
    setSelectedScreens(prev =>
      allSelected
        ? prev.filter(id => !memberIds.includes(id))
        : Array.from(new Set([...prev, ...memberIds]))
    );
  };

  if (!enabled && !licenseChecked) {
    return (
      <div className="p-8">
        <div className="max-w-lg mx-auto bg-white rounded-lg border border-gray-200 p-10 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Checking your license...</p>
        </div>
      </div>
    );
  }

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

  if (inCall) {
    const remoteStreamList = callTargetIds.map(id => ({
      screenId: id,
      name: screens.find(s => s.id === id)?.name || 'TV',
      stream: remoteStreams.get(id) || null
    }));
    return (
      <CallOverlay
        targetName={targetName()}
        connectionStatus={connectionStatus}
        remoteStreams={remoteStreamList}
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Conferencing</h1>
          <p className="text-gray-600">Call your TVs directly and manage live camera streams</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Mode + screen selection — the part that needs to scale to many TVs */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Conference Mode</h2>
              <div className="grid grid-cols-3 gap-3">
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
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedMode === mode
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5 mx-auto mb-1.5" />
                    <p className="text-xs font-medium">{label}</p>
                  </button>
                ))}
              </div>
            </div>

            {selectedMode === 'group' && callableGroups.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">My Groups</h2>
                <div className="flex flex-wrap gap-2">
                  {callableGroups.map(group => {
                    const memberIds = (screensByGroup.get(group.id) || []).map(s => s.id);
                    const allSelected = memberIds.length > 0 && memberIds.every(id => selectedScreens.includes(id));
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => toggleGroupSelection(group.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                          allSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color || '#94a3b8' }} />
                        {group.name}
                        <span className="text-xs text-gray-400">({memberIds.length})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">
                  {selectedMode === 'one-to-one' ? 'Select a TV' : 'Select TVs'}
                </h2>
                <span className="text-xs text-gray-500">
                  {selectedScreens.length > 0 ? `${selectedScreens.length} selected` : `${screens.length} available`}
                </span>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search TVs by name..."
                  value={screenSearch}
                  onChange={e => setScreenSearch(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {screenSearch && (
                  <button
                    type="button"
                    onClick={() => setScreenSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {selectedMode !== 'one-to-one' && filteredScreens.length > 0 && (
                <div className="flex items-center gap-4 mb-3 text-xs">
                  <button type="button" onClick={selectAllVisible} className="text-blue-600 font-medium hover:underline">
                    Select all visible ({filteredScreens.length})
                  </button>
                  {selectedScreens.length > 0 && (
                    <button type="button" onClick={() => setSelectedScreens([])} className="text-gray-500 hover:underline">
                      Clear selection
                    </button>
                  )}
                </div>
              )}

              {screens.length === 0 ? (
                <p className="text-gray-500 py-8 text-center text-sm">No screens with camera mount enabled</p>
              ) : filteredScreens.length === 0 ? (
                <p className="text-gray-500 py-8 text-center text-sm">No TVs match "{screenSearch}"</p>
              ) : (
                <div className="max-h-96 overflow-y-auto pr-1 space-y-2">
                  {filteredScreens.map(screen => (
                    <label
                      key={screen.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
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
                        className="shrink-0"
                      />
                      <span className="text-sm font-medium text-gray-900 truncate">{screen.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Settings + start — stays pinned so it's reachable without scrolling past a long TV list */}
          <div className="space-y-6 lg:sticky lg:top-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings size={16} />
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

            <button
              onClick={startConference}
              disabled={loading || selectedScreens.length === 0}
              className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                loading || selectedScreens.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Phone size={18} />
              {loading ? 'Starting...' : 'Start Conference'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
