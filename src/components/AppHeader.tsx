import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, ChevronRight, LogOut, User, Repeat, X, Monitor, ListVideo, Film, Users, FileText, CornerDownLeft } from 'lucide-react';
import logoImg from '../assets/bluestar-icon.png';

export type HeaderSearchItem = {
  title: string;
  subtitle?: string;
  type: 'Page' | 'Screen' | 'Playlist' | 'Media' | 'Client';
  view: string;
};

const TYPE_ICON: Record<HeaderSearchItem['type'], typeof Search> = {
  Page: FileText, Screen: Monitor, Playlist: ListVideo, Media: Film, Client: Users,
};
const TYPE_ORDER: HeaderSearchItem['type'][] = ['Page', 'Screen', 'Playlist', 'Media', 'Client'];

/**
 * Top bar shared by the admin and client dashboards.
 * - Phones: brand on the left; search and account on the right. Search opens
 *   full-screen.
 * - Desktop: breadcrumbs, an inline search with grouped results (↑/↓/Enter,
 *   ⌘K / Ctrl+K to focus), and the account menu.
 */
export default function AppHeader({
  crumbs,
  brandName,
  brandLogo,
  profile,
  roleLabel,
  buildSearch,
  onNavigate,
  onLogout,
  switchLabel,
  onSwitch,
}: {
  crumbs: string[];
  brandName: string;
  brandLogo?: string | null;
  profile: { name: string; email: string; avatar?: string };
  roleLabel: string;
  /** Called on each search so results reflect the latest synced data. */
  buildSearch: () => HeaderSearchItem[];
  onNavigate?: (view: string) => void;
  onLogout?: () => void;
  switchLabel?: string;
  onSwitch?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const desktopInput = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const results = q
    ? buildSearch()
        .filter(i => i.title.toLowerCase().includes(q) || (i.subtitle || '').toLowerCase().includes(q))
        .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
        .slice(0, 30)
    : [];

  useEffect(() => { setHighlight(0); }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.innerWidth >= 768) desktopInput.current?.focus();
        else setMobileSearch(true);
      }
      if (e.key === 'Escape') { setMenuOpen(false); setMobileSearch(false); setQuery(''); desktopInput.current?.blur(); }
    };
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown); };
  }, []);

  const go = (view: string) => {
    onNavigate?.(view);
    setQuery('');
    setMobileSearch(false);
    setMenuOpen(false);
    desktopInput.current?.blur();
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % results.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => (h - 1 + results.length) % results.length); }
    if (e.key === 'Enter') { e.preventDefault(); go(results[highlight].view); }
  };

  const initials = (profile.name || profile.email).split(/[\s@]+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('');
  const avatar = (size: string, text: string) => profile.avatar
    ? <img src={profile.avatar} alt="" className={`${size} rounded-full object-cover`} />
    : <span className={`${size} rounded-full bg-gradient-to-br from-blue-600 to-teal-500 text-white ${text} font-semibold flex items-center justify-center`}>{initials || '?'}</span>;

  const resultList = (compact: boolean) => {
    if (!q) return null;
    if (!results.length) return <p className="px-4 py-6 text-sm text-slate-500 text-center">Nothing found for “{query.trim()}”</p>;
    let lastType = '';
    return results.map((item, i) => {
      const Icon = TYPE_ICON[item.type];
      const header = item.type !== lastType ? (lastType = item.type) : null;
      return (
        <div key={`${item.type}-${item.view}-${item.title}-${i}`}>
          {header && <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{header === 'Page' ? 'Pages' : `${header}s`}</p>}
          <button
            type="button"
            onMouseEnter={() => setHighlight(i)}
            onMouseDown={e => e.preventDefault()}
            onClick={() => go(item.view)}
            className={`w-full flex items-center gap-3 px-4 ${compact ? 'py-2' : 'py-3'} text-left ${i === highlight ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
          >
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><Icon size={15} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-slate-900 truncate">{item.title}</span>
              {item.subtitle && <span className="block text-xs text-slate-500 truncate">{item.subtitle}</span>}
            </span>
            {i === highlight && compact && <CornerDownLeft size={13} className="text-slate-400 shrink-0" />}
          </button>
        </div>
      );
    });
  };

  return (
    <header className="h-14 md:h-16 bg-white/95 backdrop-blur border-b border-slate-100 flex items-center justify-between gap-3 px-4 sm:px-6 shrink-0 z-40 relative">
      {/* Phones: brand */}
      <button type="button" onClick={() => onNavigate?.('dashboard')} className="flex items-center gap-2 min-w-0 md:hidden">
        <img src={brandLogo || logoImg} className="w-8 h-8 object-contain shrink-0 rounded-lg" alt="" />
        <span className="font-bold text-slate-900 text-[15px] truncate">{brandName}</span>
      </button>

      {/* Desktop: breadcrumbs */}
      <nav className="hidden md:flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={`${crumb}-${i}`} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight size={14} className="text-slate-300 shrink-0" />}
            <span className={`truncate ${i === crumbs.length - 1 ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>{crumb}</span>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        {/* Desktop search */}
        <div className="relative hidden md:block">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={desktopInput}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={onSearchKey}
            placeholder="Search screens, playlists, pages…"
            className="h-9 w-64 lg:w-80 pl-9 pr-12 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md border border-slate-200 bg-white text-[10px] text-slate-400 font-sans pointer-events-none">⌘K</kbd>
          {focused && q && (
            <div className="absolute right-0 top-11 w-[26rem] bg-white border border-slate-200 rounded-2xl shadow-xl max-h-[70vh] overflow-y-auto pb-2 z-50">
              {resultList(true)}
            </div>
          )}
        </div>

        {/* Phone search */}
        <button type="button" onClick={() => setMobileSearch(true)} className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100" aria-label="Search">
          <Search size={20} />
        </button>

        {/* Account */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-1.5 p-1 rounded-full md:rounded-xl hover:bg-slate-50"
            aria-label="Account"
            aria-expanded={menuOpen}
          >
            {avatar('w-8 h-8', 'text-xs')}
            <span className="hidden lg:block text-sm font-medium text-slate-700 max-w-[140px] truncate">{profile.name}</span>
            <ChevronDown size={14} className={`hidden md:block text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
              <button type="button" onClick={() => go('profile')} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 border-b border-slate-100">
                {avatar('w-10 h-10', 'text-sm')}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 truncate">{profile.name}</span>
                  <span className="block text-xs text-slate-500 truncate">{profile.email}</span>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium">{roleLabel}</span>
                </span>
              </button>
              <div className="py-1.5">
                <button type="button" onClick={() => go('profile')} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                  <User size={16} className="text-slate-400" /> Profile & password
                </button>
                {onSwitch && switchLabel && (
                  <button type="button" onClick={() => { setMenuOpen(false); onSwitch(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <Repeat size={16} className="text-slate-400" /> {switchLabel}
                  </button>
                )}
              </div>
              <div className="border-t border-slate-100 py-1.5">
                <button type="button" onClick={() => { setMenuOpen(false); onLogout?.(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50">
                  <LogOut size={16} /> Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phone: full-screen search. Rendered into <body> — the header's
          backdrop blur would otherwise make it the overlay's containing
          block and squeeze it into the header bar. */}
      {mobileSearch && createPortal(
        <div className="fixed inset-0 z-[400] bg-white flex flex-col md:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center gap-2 px-3 h-14 border-b border-slate-100">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder="Search screens, playlists, pages…"
                className="w-full h-10 pl-10 pr-3 text-[15px] bg-slate-100 rounded-xl outline-none"
                enterKeyHint="search"
              />
            </div>
            <button type="button" onClick={() => { setMobileSearch(false); setQuery(''); }} className="h-10 px-2 text-sm font-medium text-blue-600">Cancel</button>
          </div>
          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {q ? resultList(false) : (
              <div className="px-4 py-6 text-sm text-slate-500">
                <p className="font-medium text-slate-700 mb-1">Find anything</p>
                <p>Screens, playlists, media files, pages{roleLabel === 'Administrator' ? ' and clients' : ''}.</p>
              </div>
            )}
          </div>
          <button type="button" onClick={() => { setMobileSearch(false); setQuery(''); }} className="sr-only">Close<X /></button>
        </div>,
        document.body
      )}
    </header>
  );
}
