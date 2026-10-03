import { useState, useEffect, useRef, useMemo } from 'react';
import { Phone, Search, X, Lock, Video, VideoOff, Check, Volume2, MicOff, ChevronDown, Loader2 } from 'lucide-react';
import { WebRTCHandler, acquireSharedLocalStream } from '../../utils/webrtcHandler';
import { useVideoConferencing } from '../../hooks/useVideoConferencing';
import { API_BASE } from '../../config';
import CallOverlay, { ChatMessage } from '../CallOverlay';
import { getAuthToken } from '../../lib/authStorage';
import { syncCollection, pushToDatabase } from '../../lib/syncHelper';
import { toast } from '../Toast';

type ConferenceMode = 'one-to-one' | 'group' | 'manual-select';

interface CallScreen {
  id: string;
  name: string;
  status?: string;
  location?: string;
  cameraMountEnabled?: boolean;
  groupId?: string | null;
  assignedToUserEmail?: string;
}

interface ScreenGroup {
  id: string;
  name: string;
  color?: string;
  orgId?: string;
}

const isOnline = (s: CallScreen) => s.status === 'online' || s.status === 'active';
const isPaired = (s: CallScreen) => s.status !== 'pairing' && s.status !== 'unlinked';

/**
 * Video calls to TVs with a camera. The setup screen lists TVs that can
 * take a call right now, those that are offline, and those not marked as
 * having a camera (which can be marked here). Picking one TV makes a 1-to-1
 * call; picking several (or a group) calls them all at once.
 *
 * The call itself (WebRTC, rejoin, screen share, chat) is unchanged.
 */
export default function VideoCallsView({ isAdmin = false, enabled = true, organizationId, licenseChecked = true, userEmail }: {
  isAdmin?: boolean;
  enabled?: boolean;
  organizationId: string;
  licenseChecked?: boolean;
  userEmail: string;
}) {
  const { socket, initiateConference: emitInitiateConference, joinConference, onWebRTCSignal, onScreenRejoined, sendChatMessage, onChatMessage } = useVideoConferencing();
  // One WebRTCHandler (one RTCPeerConnection) per target screen — a group call
  // negotiates a separate SDP offer/answer with each screen, so they can't
  // share a single peer connection the way a one-to-one call can.
  const webrtcHandlersRef = useRef<Map<string, WebRTCHandler>>(new Map());
  const screenShareRef = useRef<{ displayStream: MediaStream; screenTrack: MediaStreamTrack } | null>(null);

  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [screens, setScreens] = useState<CallScreen[]>([]);
  const [groups, setGroups] = useState<ScreenGroup[]>([]);
  const [orgs, setOrgs] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_organizations') || '[]'));
  const [loadingScreens, setLoadingScreens] = useState(true);
  const [loading, setLoading] = useState(false);
  const [defaultVolume, setDefaultVolume] = useState(50);
  const [muteOnStart, setMuteOnStart] = useState(true);
  const [screenSearch, setScreenSearch] = useState('');
  const [showNoCamera, setShowNoCamera] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

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

  const authHeaders = () => {
    const token = getAuthToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const loadScreens = async () => {
    const all = await syncCollection('screens', 'signageos_screens', { force: true }) as CallScreen[];
    setScreens(all.filter(isPaired).filter(s => isAdmin || s.assignedToUserEmail === userEmail));
    setLoadingScreens(false);
  };

  useEffect(() => {
    if (!enabled) return;
    loadScreens();
    syncCollection('screen_groups', 'signageos_screen_groups').then(g => setGroups(g as ScreenGroup[]));
    if (isAdmin) syncCollection('organizations', 'signageos_organizations').then(o => { if (o.length) setOrgs(o); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, organizationId, userEmail]);

  // TVs come and go — keep "Ready to call" current while this page is open.
  useEffect(() => {
    if (!enabled || inCall) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') loadScreens(); }, 20000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, inCall, userEmail]);

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

  const ownerName = (email?: string) => {
    if (!isAdmin || !email || email === userEmail) return '';
    return orgs.find((o: any) => o.email === email)?.name || email;
  };

  const targetName = () => {
    if (callTargetIds.length === 1) {
      return screens.find(s => s.id === callTargetIds[0])?.name || 'TV';
    }
    return `${callTargetIds.length} TVs`;
  };

  const startConference = async () => {
    if (!socket) {
      toast.error('Not connected to the server yet — try again in a moment');
      return;
    }
    if (!organizationId) {
      toast.error('Your organization isn\'t fully set up for calls yet. Contact your administrator.');
      return;
    }

    const targetIds = selectedScreens;
    if (targetIds.length === 0) return;
    const selectedMode: ConferenceMode = targetIds.length === 1 ? 'one-to-one' : selectedGroup ? 'group' : 'manual-select';

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
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Couldn\'t start the call');
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
        toast.warning('Camera or microphone not available — the TV won\'t see or hear you');
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
      setSelectedGroup(null);
    } catch (error) {
      console.error('Error starting conference:', error);
      toast.error('Couldn\'t start the call');
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
      localStream?.getTracks().forEach(t => t.stop());
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
    const senderName = isAdmin
      ? (localStorage.getItem('signageos_admin_name') || 'Admin')
      : (localStorage.getItem(`signageos_user_name_${userEmail}`) || userEmail.split('@')[0] || 'Caller');
    sendChatMessage({ conferenceId, targetScreenIds: callTargetIds, senderName, text });
    setChatMessages(prev => [...prev, { senderName: 'You', text, ts: Date.now(), self: true }]);
  };

  // ── Setup screen ──────────────────────────────────────────────────────────
  const q = screenSearch.trim().toLowerCase();
  const matches = (s: CallScreen) => !q || s.name.toLowerCase().includes(q) || (s.location || '').toLowerCase().includes(q) || ownerName(s.assignedToUserEmail).toLowerCase().includes(q);
  const withCamera = screens.filter(s => s.cameraMountEnabled);
  const ready = withCamera.filter(isOnline).filter(matches);
  const offline = withCamera.filter(s => !isOnline(s)).filter(matches);
  const noCamera = screens.filter(s => !s.cameraMountEnabled).filter(matches);

  // Groups are stored inversely — each screen points at its group via
  // groupId — so membership comes from the screen list. Only groups with a
  // TV that can take a call now are offered.
  const callableGroups = useMemo(() => groups
    .filter(g => (organizationId && !isAdmin ? (g.orgId === organizationId || !g.orgId) : true))
    .map(g => ({ ...g, members: withCamera.filter(s => s.groupId === g.id && isOnline(s)).map(s => s.id) }))
    .filter(g => g.members.length > 0),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [groups, screens, organizationId]);

  const toggleScreen = (id: string) => {
    setSelectedGroup(null);
    setSelectedScreens(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const pickGroup = (g: { id: string; members: string[] }) => {
    if (selectedGroup === g.id) { setSelectedGroup(null); setSelectedScreens([]); return; }
    setSelectedGroup(g.id);
    setSelectedScreens(g.members);
  };

  const markHasCamera = async (s: CallScreen) => {
    setMarkingId(s.id);
    const res = await pushToDatabase('screens', s.id, { cameraMountEnabled: true }, 'PUT');
    setMarkingId(null);
    if (!res.ok) { toast.error('Couldn\'t update the screen'); return; }
    setScreens(prev => prev.map(x => (x.id === s.id ? { ...x, cameraMountEnabled: true } : x)));
    toast.success(`"${s.name}" can now take calls`);
  };

  const removeCamera = async (s: CallScreen) => {
    const res = await pushToDatabase('screens', s.id, { cameraMountEnabled: false }, 'PUT');
    if (!res.ok) { toast.error('Couldn\'t update the screen'); return; }
    setScreens(prev => prev.map(x => (x.id === s.id ? { ...x, cameraMountEnabled: false } : x)));
    setSelectedScreens(prev => prev.filter(id => id !== s.id));
  };

  if (!enabled && !licenseChecked) {
    return (
      <div className="p-4 sm:p-6 flex justify-center py-20">
        <Loader2 size={22} className="animate-spin text-slate-300" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-md mx-auto mt-6 bg-white rounded-2xl border border-slate-100 p-8 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Lock size={20} />
          </div>
          <h1 className="text-base font-semibold text-slate-900">Video calls aren't on your plan</h1>
          <p className="text-sm text-slate-500 mt-1">Call your TVs face to face — ask your provider to add video calls to your licence.</p>
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

  const NoCameraButton = ({ s }: { s: CallScreen }) => (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); removeCamera(s); }}
      title="This TV has no camera"
      aria-label={`Mark ${s.name} as having no camera`}
      className="p-1.5 -mr-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 shrink-0"
    >
      <VideoOff size={15} />
    </button>
  );

  const Row = ({ s, disabled, right }: { s: CallScreen; disabled?: boolean; right?: React.ReactNode }) => {
    const selected = selectedScreens.includes(s.id);
    const owner = ownerName(s.assignedToUserEmail);
    return (
      <div className={`flex items-center gap-3 px-4 py-3 ${disabled ? '' : 'cursor-pointer hover:bg-slate-50'} ${selected ? 'bg-blue-50/60' : ''}`}
        onClick={disabled ? undefined : () => toggleScreen(s.id)}
        role={disabled ? undefined : 'checkbox'}
        aria-checked={disabled ? undefined : selected}
      >
        {!disabled && (
          <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${selected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
            {selected && <Check size={13} className="text-white" />}
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className={`block text-sm font-medium truncate ${disabled ? 'text-slate-500' : 'text-slate-900'}`}>{s.name}</span>
          <span className="block text-xs text-slate-500 truncate">
            {[owner, s.location && s.location !== 'Not Specified' ? s.location : ''].filter(Boolean).join(' · ') || (isOnline(s) ? 'Online' : 'Offline')}
          </span>
        </span>
        {right}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-3xl">
      <div>
        <h1 className="display text-2xl sm:text-3xl text-ink-950">Video calls</h1>
        <p className="text-sm text-gray-500 mt-0.5">Call a TV that has a camera — you'll see and hear each other</p>
      </div>

      {screens.length > 6 && (
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={screenSearch}
            onChange={e => setScreenSearch(e.target.value)}
            placeholder="Search TVs"
            className="w-full h-11 pl-10 pr-9 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white"
          />
          {screenSearch && (
            <button type="button" onClick={() => setScreenSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400" aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {callableGroups.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 md:flex-wrap md:overflow-visible">
          {callableGroups.map(g => {
            const active = selectedGroup === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => pickGroup(g)}
                title={g.name}
                className={`shrink-0 max-w-[16rem] flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold ${
                  active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: active ? '#fff' : (g.color || '#94a3b8') }} />
                <span className="truncate">{g.name}</span>
                <span className="shrink-0">· {g.members.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {loadingScreens ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-xs font-semibold text-slate-500">Ready to call · {ready.length}</h2>
              {ready.length > 1 && (
                <button type="button" onClick={() => { setSelectedGroup(null); setSelectedScreens(selectedScreens.length === ready.length ? [] : ready.map(s => s.id)); }} className="text-xs font-medium text-blue-600">
                  {selectedScreens.length === ready.length ? 'Clear' : 'Select all'}
                </button>
              )}
            </div>
            {ready.length > 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {ready.map(s => <Row key={s.id} s={s} right={<>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Online</span>
                  <NoCameraButton s={s} />
                </>} />)}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center">
                <Video size={26} className="mx-auto text-blue-500 mb-2" />
                <p className="text-sm font-semibold text-slate-800">{withCamera.length ? 'No camera TV is online right now' : 'No TV is set up for calls yet'}</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {withCamera.length
                    ? 'Turn the TV on and make sure it\'s connected — it shows here as soon as it\'s back.'
                    : 'Connect a USB camera to the TV, then mark it below as having a camera.'}
                </p>
              </div>
            )}
          </section>

          {offline.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-slate-500 px-1">Offline · {offline.length}</h2>
              <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {offline.map(s => <Row key={s.id} s={s} disabled right={<>
                  <span className="text-[11px] text-slate-400 shrink-0">Can't call while offline</span>
                  <NoCameraButton s={s} />
                </>} />)}
              </div>
            </section>
          )}

          {noCamera.length > 0 && (
            <section className="space-y-2">
              <button type="button" onClick={() => setShowNoCamera(v => !v)} aria-expanded={showNoCamera} className="w-full flex items-center justify-between px-1 text-xs font-semibold text-slate-500">
                <span>No camera · {noCamera.length}</span>
                <ChevronDown size={14} className={`transition-transform ${showNoCamera ? 'rotate-180' : ''}`} />
              </button>
              {showNoCamera && (
                <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {noCamera.map(s => (
                    <Row key={s.id} s={s} disabled right={
                      <button
                        type="button"
                        onClick={() => markHasCamera(s)}
                        disabled={markingId === s.id}
                        className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
                      >
                        {markingId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Video size={13} />} Has a camera
                      </button>
                    } />
                  ))}
                </div>
              )}
            </section>
          )}

        </>
      )}

      {/* Call bar */}
      <div className="sticky bottom-3 z-20">
        <div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-3 space-y-3">
            <div className="flex items-center gap-4 flex-wrap text-xs text-slate-600">
              <label className="flex items-center gap-2 flex-1 min-w-[180px]">
                <Volume2 size={15} className="text-slate-400 shrink-0" />
                <span className="shrink-0">TV volume</span>
                <input type="range" min={0} max={100} value={defaultVolume} onChange={e => setDefaultVolume(Number(e.target.value))} className="flex-1 accent-blue-600" aria-label="TV volume" />
                <span className="w-8 text-right tabular-nums">{defaultVolume}%</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={muteOnStart} onChange={e => setMuteOnStart(e.target.checked)} className="accent-blue-600" />
                <MicOff size={14} className="text-slate-400" /> Start with my mic off
              </label>
            </div>
            <button
              onClick={startConference}
              disabled={loading || selectedScreens.length === 0}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-sm font-semibold flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : selectedScreens.length ? <Phone size={17} /> : <VideoOff size={17} />}
              {loading ? 'Calling…'
                : selectedScreens.length === 0 ? 'Pick a TV to call'
                : selectedScreens.length === 1 ? `Call ${screens.find(s => s.id === selectedScreens[0])?.name || 'TV'}`
                : `Call ${selectedScreens.length} TVs`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
