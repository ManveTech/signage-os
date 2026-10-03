import { useState } from 'react';
import { Send } from 'lucide-react';
import type { Ticket, SupportDoc } from '../../lib/supportStore';

export const TICKET_STATUS: Record<Ticket['status'], { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-rose-50 text-rose-700 border-rose-100' },
  in_progress: { label: 'In progress', className: 'bg-blue-50 text-blue-700 border-blue-100' },
  resolved: { label: 'Resolved', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export const PRIORITY: Record<Ticket['priority'], { label: string; dot: string }> = {
  high: { label: 'High', dot: 'bg-rose-500' },
  medium: { label: 'Medium', dot: 'bg-amber-400' },
  low: { label: 'Low', dot: 'bg-slate-300' },
};

/** "3h ago" for ISO dates; passes through legacy free-text values ("Just now"). */
export function timeAgo(value?: string): string {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return value;
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function youtubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.trim().match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2].trim().length === 11 ? match[2].trim() : null;
}

export function StatusPill({ status }: { status: Ticket['status'] }) {
  const s = TICKET_STATUS[status] || TICKET_STATUS.open;
  return <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.className}`}>{s.label}</span>;
}

/**
 * The conversation on a ticket: the original description, then replies.
 * `viewer` decides which side is "you" (right-aligned, blue).
 */
export function TicketThread({ ticket, viewer }: { ticket: Ticket; viewer: 'support' | 'client' }) {
  const entries = [
    { id: 'first', from: 'client' as const, authorName: ticket.clientName, text: ticket.description, at: ticket.createdDate },
    ...(ticket.messages || []),
  ];
  return (
    <div className="space-y-3">
      {entries.map(m => {
        const mine = m.from === viewer;
        return (
          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-slate-100 text-slate-800 rounded-bl-md'}`}>
              <p className={`text-[11px] font-medium mb-0.5 ${mine ? 'text-blue-100' : 'text-slate-500'}`}>
                {m.from === 'support' ? (viewer === 'support' ? 'You' : 'Support') : (viewer === 'client' ? 'You' : m.authorName || 'Client')}
                {m.at ? ` · ${timeAgo(m.at)}` : ''}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-line break-words">{m.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Composer({ onSend, placeholder = 'Write a reply…', disabled }: { onSend: (text: string) => Promise<boolean>; placeholder?: string; disabled?: boolean }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const ok = await onSend(t);
    setSending(false);
    if (ok) setText('');
  };
  return (
    <div className="flex items-end gap-2">
      <textarea
        rows={1}
        value={text}
        disabled={disabled}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
        placeholder={placeholder}
        className="flex-1 min-h-[44px] max-h-32 px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 resize-none disabled:bg-slate-50"
        style={{ fieldSizing: 'content' } as any}
      />
      <button
        type="button"
        onClick={send}
        disabled={!text.trim() || sending || disabled}
        className="w-11 h-11 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center"
        aria-label="Send"
      >
        <Send size={17} />
      </button>
    </div>
  );
}

/** Body of a help guide: text, then its video if it has one. */
export function GuideBody({ doc }: { doc: SupportDoc }) {
  const yt = youtubeId(doc.youtubeUrl || (doc as any).youtube_url);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{doc.content}</p>
      {yt && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${yt}`}
            title={doc.title}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
