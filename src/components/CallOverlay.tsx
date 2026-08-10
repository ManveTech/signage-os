import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Tv, MessageSquare, Send, X } from 'lucide-react';

export interface ChatMessage {
  senderName: string;
  text: string;
  ts: number;
  self: boolean;
}

interface RemoteScreenStream {
  screenId: string;
  name: string;
  stream: MediaStream | null;
}

interface CallOverlayProps {
  targetName: string;
  connectionStatus: string; // 'initiating' | 'connected' | 'error' | ...
  remoteStreams: RemoteScreenStream[];
  localStream: MediaStream | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  isScreenSharing: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
  chatMessages: ChatMessage[];
  onSendChatMessage: (text: string) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function CallOverlay({
  targetName,
  connectionStatus,
  remoteStreams,
  localStream,
  micEnabled,
  cameraEnabled,
  isScreenSharing,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onEndCall,
  chatMessages,
  onSendChatMessage
}: CallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [unread, setUnread] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  useEffect(() => {
    if (chatMessages.length > prevMessageCount.current) {
      if (chatOpen) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setUnread(u => u + (chatMessages.length - prevMessageCount.current));
      }
    }
    prevMessageCount.current = chatMessages.length;
  }, [chatMessages, chatOpen]);

  const handleSend = () => {
    const text = chatInput.trim();
    if (!text) return;
    onSendChatMessage(text);
    setChatInput('');
  };

  const statusLabel = connectionStatus === 'connected' ? formatDuration(elapsed) : 'Connecting…';

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex select-none animate-fadeIn">
    <div className="flex-1 flex flex-col relative min-w-0">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/60 to-transparent absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center gap-2 text-white">
          <Tv size={16} className="text-blue-400" />
          <span className="text-sm font-semibold">{targetName}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10">
          <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          <span className="text-xs font-medium text-white/90">{statusLabel}</span>
        </div>
      </div>

      {/* Main video stage — one full-bleed tile for a single screen, a grid for a group call */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {remoteStreams.length <= 1 ? (
          <RemoteVideoTile
            name={remoteStreams[0]?.name ?? targetName}
            stream={remoteStreams[0]?.stream ?? null}
            fullscreen
            waitingLabel={
              connectionStatus === 'connected'
                ? `Connected — waiting for video from ${remoteStreams[0]?.name ?? targetName}`
                : `Calling ${remoteStreams[0]?.name ?? targetName}…`
            }
          />
        ) : (
          <div
            className="grid gap-2 w-full h-full p-3"
            style={{ gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(remoteStreams.length))}, 1fr)` }}
          >
            {remoteStreams.map(rs => (
              <RemoteVideoTile key={rs.screenId} name={rs.name} stream={rs.stream} />
            ))}
          </div>
        )}

        {/* Local PIP */}
        <div className="absolute bottom-6 right-6 w-40 sm:w-52 aspect-video rounded-xl overflow-hidden border border-white/15 bg-slate-900 shadow-2xl">
          {cameraEnabled && localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover [transform:scaleX(-1)]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500">
              <VideoOff size={20} />
            </div>
          )}
          <span className="absolute bottom-1 left-2 text-[10px] font-semibold text-white/80 bg-black/40 px-1.5 py-0.5 rounded">You</span>
        </div>
      </div>

      {/* Control bar */}
      <div className="flex items-center justify-center gap-4 px-6 py-6 bg-gradient-to-t from-black/70 to-transparent">
        <ControlButton
          active={micEnabled}
          onClick={onToggleMic}
          iconOn={<Mic size={20} />}
          iconOff={<MicOff size={20} />}
          label={micEnabled ? 'Mute' : 'Unmute'}
        />
        <ControlButton
          active={cameraEnabled}
          onClick={onToggleCamera}
          iconOn={<Video size={20} />}
          iconOff={<VideoOff size={20} />}
          label={cameraEnabled ? 'Stop Video' : 'Start Video'}
        />
        <ControlButton
          active={!isScreenSharing}
          onClick={onToggleScreenShare}
          iconOn={<MonitorUp size={20} />}
          iconOff={<MonitorUp size={20} />}
          label={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          activeColorOverride={isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : undefined}
        />
        <button
          onClick={() => { setChatOpen(o => !o); if (!chatOpen) setUnread(0); }}
          className={`relative w-14 h-14 rounded-full text-white flex items-center justify-center transition-all ${chatOpen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white/10 hover:bg-white/20'}`}
          title="Chat"
        >
          <MessageSquare size={20} />
          {unread > 0 && !chatOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        <button
          onClick={onEndCall}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg shadow-red-600/30"
          title="End call"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>

    {chatOpen && (
      <div className="w-80 flex-shrink-0 bg-slate-900 border-l border-white/10 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
          <span className="text-sm font-semibold text-white">In-call chat</span>
          <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {chatMessages.length === 0 ? (
            <p className="text-xs text-slate-500 text-center mt-6">No messages yet</p>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.self ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-slate-500 mb-0.5">{msg.self ? 'You' : msg.senderName}</span>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs ${msg.self ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-100 rounded-bl-sm'}`}>
                  {msg.text}
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="flex items-center gap-2 p-3 border-t border-white/10">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Type a message…"
            className="flex-1 bg-slate-800 text-white text-xs rounded-full px-4 py-2.5 outline-none placeholder-slate-500 border border-transparent focus:border-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!chatInput.trim()}
            className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center flex-shrink-0"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    )}
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  iconOn,
  iconOff,
  label,
  activeColorOverride
}: {
  active: boolean;
  onClick: () => void;
  iconOn: React.ReactNode;
  iconOff: React.ReactNode;
  label: string;
  activeColorOverride?: string;
}) {
  const colorClass = activeColorOverride
    ? activeColorOverride
    : active
      ? 'bg-white/10 hover:bg-white/20'
      : 'bg-red-600 hover:bg-red-700';

  return (
    <button
      onClick={onClick}
      className={`w-14 h-14 rounded-full text-white flex items-center justify-center transition-all ${colorClass}`}
      title={label}
    >
      {active ? iconOn : iconOff}
    </button>
  );
}

function RemoteVideoTile({
  name,
  stream,
  fullscreen,
  waitingLabel
}: {
  name: string;
  stream: MediaStream | null;
  fullscreen?: boolean;
  waitingLabel?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = !!stream && stream.getVideoTracks().some(t => t.enabled);

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${fullscreen ? 'w-full h-full' : 'rounded-lg bg-slate-900 border border-white/10'}`}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full bg-black ${fullscreen ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className={`rounded-full bg-slate-800 flex items-center justify-center ${fullscreen ? 'w-20 h-20' : 'w-10 h-10'}`}>
            <Tv size={fullscreen ? 32 : 18} />
          </div>
          {fullscreen && waitingLabel && <p className="text-sm font-medium">{waitingLabel}</p>}
        </div>
      )}
      {/* Keep the <video> mounted even without a visible video track so audio still plays */}
      {!hasVideo && <video ref={videoRef} autoPlay playsInline className="hidden" />}
      {!fullscreen && (
        <span className="absolute bottom-1.5 left-2 max-w-[80%] truncate text-[10px] font-semibold text-white/90 bg-black/50 px-1.5 py-0.5 rounded">
          {name}
        </span>
      )}
    </div>
  );
}
