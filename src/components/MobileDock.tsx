import React, { useEffect, useState } from 'react';
import DefaultAvatar from './DefaultAvatar';
import { motion, useReducedMotion } from 'framer-motion';
import {
  LayoutDashboard, MonitorPlay, Tv, Key, Menu, LogOut, Film, Users, Building2, BarChart3,
  Settings as SettingsIcon, ScanLine, Plus, FileText, Plug, HelpCircle, Layers, Monitor,
  CalendarDays, Video, ChevronRight, ListVideo, Receipt,
} from 'lucide-react';
import { licensingStore } from '../lib/licensingStore';
import { supportStore } from '../lib/supportStore';
import { licenseState } from './licenses/licenseStatus';

type TabId = 'dashboard' | 'screens' | 'playlists' | 'licenses' | 'more';
type Item = { id: string; label: string; icon: React.ElementType; badge?: number };
type Section = { title?: string; items: Item[] };

interface MobileDockProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  role?: 'admin' | 'user';
}

/**
 * Phone bottom navigation. Screens / Playlists / More open one bottom sheet
 * listing every destination for that area. The admin used to go through a
 * "Mine or Clients?" step first, so every page there took three taps.
 */
export default function MobileDock({ activeView, onNavigate, onLogout, role = 'admin' }: MobileDockProps) {
  const reduce = useReducedMotion();
  const admin = role === 'admin';
  const [sheet, setSheet] = useState<TabId | null>(null);
  const [badges, setBadges] = useState({ licenses: 0, more: 0 });

  const email = localStorage.getItem('signageos_user_email') || '';
  const profile = admin
    ? { name: localStorage.getItem('signageos_admin_name') || 'Administrator', avatar: localStorage.getItem('signageos_admin_avatar') || '' }
    : { name: localStorage.getItem(`signageos_user_name_${email}`) || email.split('@')[0], avatar: localStorage.getItem(`signageos_user_avatar_${email}`) || '' };

  // Small counts on the tabs for things that need attention — cleared once
  // you open that section, and shown again only for something new (they
  // used to stay on screen permanently, even right after checking).
  useEffect(() => {
    try {
      const licenses = licensingStore.getLicenses();
      const tickets = supportStore.getTickets();
      const lastAt = (t: any) => (t.messages || []).slice(-1)[0]?.at || t.lastUpdated || t.createdDate || '';

      // Each item's key includes its state, so a licence going from
      // "expiring" to "expired" (or a new reply) counts as new again.
      const licenseKeys = (admin
        ? licenses.filter(l => l.assignedUserEmail && ['expired', 'expiring', 'pending'].includes(licenseState(l).key))
        : licenses.filter(l => (l.assignedUserEmail || '').toLowerCase() === email.toLowerCase()).filter(l => {
            const st = licenseState(l);
            return st.key === 'expired' || st.key === 'pending' || (st.days !== null && st.days <= 14);
          })
      ).map(l => `${l.id}:${licenseState(l).key}`);

      const ticketKeys = (admin
        ? tickets.filter(t => (t.status === 'open' || t.status === 'in_progress') && ((t.messages || []).slice(-1)[0]?.from ?? 'client') === 'client')
        : tickets.filter(t => (t.clientEmail || '').toLowerCase() === email.toLowerCase()
            && (t.status === 'open' || t.status === 'in_progress')
            && (t.messages || []).slice(-1)[0]?.from === 'support')
      ).map(t => `${t.id}:${lastAt(t)}`);

      const storeKey = (kind: string) => `signageos_badge_seen_${role}_${email}_${kind}`;
      const readSeen = (kind: string): string[] => {
        try { return JSON.parse(localStorage.getItem(storeKey(kind)) || '[]'); } catch { return []; }
      };
      const onLicensing = admin ? activeView.startsWith('licenses-') : activeView === 'license-billing';
      const onHelpdesk = admin ? activeView.startsWith('support') : activeView === 'support' || activeView === 'support-tickets';
      if (onLicensing) localStorage.setItem(storeKey('licenses'), JSON.stringify(licenseKeys));
      if (onHelpdesk) localStorage.setItem(storeKey('tickets'), JSON.stringify(ticketKeys));

      const seenLic = new Set(readSeen('licenses'));
      const seenTickets = new Set(readSeen('tickets'));
      setBadges({
        licenses: licenseKeys.filter(k => !seenLic.has(k)).length,
        more: ticketKeys.filter(k => !seenTickets.has(k)).length,
      });
    } catch { /* badges are a nicety */ }
  }, [activeView, admin, email, role]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setSheet(null); }, [activeView]);

  const sections: Record<'screens' | 'playlists' | 'more', Section[]> = admin
    ? {
        screens: [
          { title: 'My screens', items: [
            { id: 'my-screens-list', label: 'Screens', icon: MonitorPlay },
            { id: 'screens-groups-my', label: 'Groups', icon: Layers },
            { id: 'screens-logs', label: 'Logs', icon: FileText },
            { id: 'screens-add-my', label: 'Add screen', icon: Plus },
          ] },
          { title: 'Client screens', items: [
            { id: 'screens-all', label: 'All screens', icon: Monitor },
            { id: 'screens-groups-all', label: 'Groups', icon: Layers },
            { id: 'screens-logs-all', label: 'Logs', icon: FileText },
            { id: 'screens-add-client', label: 'Add screen', icon: Plus },
          ] },
        ],
        playlists: [
          { title: 'My channel', items: [
            { id: 'my-playlists', label: 'Playlists', icon: ListVideo },
            { id: 'my-create-playlist', label: 'New playlist', icon: Plus },
            { id: 'my-media', label: 'Media', icon: Film },
            { id: 'playlists-scheduler', label: 'Scheduler', icon: CalendarDays },
          ] },
          { title: 'Client assets', items: [
            { id: 'client-playlists', label: 'Playlists', icon: ListVideo },
            { id: 'client-media', label: 'Media', icon: Film },
          ] },
        ],
        more: [
          { items: [
            { id: 'users', label: 'Clients', icon: Users },
            { id: 'organizations', label: 'Organizations', icon: Building2 },
            { id: 'reports-overview', label: 'Reports', icon: BarChart3 },
            { id: 'support-issues', label: 'Helpdesk', icon: HelpCircle, badge: badges.more },
            { id: 'video-conferencing', label: 'Video calls', icon: Video },
            { id: 'integrations', label: 'Integrations', icon: Plug },
            { id: 'settings-general', label: 'Settings', icon: SettingsIcon },
            { id: 'licenses-code', label: 'License code', icon: ScanLine },
          ] },
        ],
      }
    : {
        screens: [
          { items: [
            { id: 'my-screens-list', label: 'My screens', icon: MonitorPlay },
            { id: 'screens-groups', label: 'Groups', icon: Layers },
            { id: 'screens-logs', label: 'Logs', icon: FileText },
            { id: 'screens-add', label: 'Add screen', icon: Plus },
          ] },
        ],
        playlists: [
          { items: [
            { id: 'playlists-all', label: 'Playlists', icon: ListVideo },
            { id: 'playlists-create', label: 'New playlist', icon: Plus },
            { id: 'media-library', label: 'Media', icon: Film },
            { id: 'playlists-scheduler', label: 'Scheduler', icon: CalendarDays },
          ] },
        ],
        // Reports, video calls and settings had no way in on a phone.
        more: [
          { items: [
            { id: 'reports-overview', label: 'Reports', icon: BarChart3 },
            { id: 'support-tickets', label: 'Help & Support', icon: HelpCircle, badge: badges.more },
            { id: 'video-conferencing', label: 'Video calls', icon: Video },
            { id: 'license-billing', label: 'Invoices', icon: Receipt },
            { id: 'settings-general', label: 'Settings', icon: SettingsIcon },
          ] },
        ],
      };

  const tabs: { id: TabId; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'screens', label: 'Screens', icon: MonitorPlay },
    { id: 'playlists', label: admin ? 'Content' : 'Playlists', icon: Tv },
    { id: 'licenses', label: admin ? 'Licenses' : 'Billing', icon: Key, badge: badges.licenses },
    { id: 'more', label: 'More', icon: Menu, badge: badges.more },
  ];

  const inSection = (key: 'screens' | 'playlists' | 'more') => sections[key].some(s => s.items.some(i => i.id === activeView));
  const isActive = (id: TabId) => {
    if (id === 'dashboard') return activeView === 'dashboard';
    if (id === 'licenses') return activeView.startsWith('licenses-') && activeView !== 'licenses-code' || activeView === 'license-billing';
    if (id === 'screens') return inSection('screens') || activeView.startsWith('screens-');
    if (id === 'playlists') return inSection('playlists');
    return inSection('more') || ['profile', 'support', 'support-faq', 'support-docs', 'support-help', 'reports-screens', 'reports-media', 'reports-logs'].includes(activeView);
  };

  const tapTab = (id: TabId) => {
    if (id === 'dashboard') { setSheet(null); onNavigate('dashboard'); return; }
    if (id === 'licenses') { setSheet(null); onNavigate(admin ? 'licenses-management' : 'license-billing'); return; }
    setSheet(s => (s === id ? null : id));
  };

  const go = (view: string) => { setSheet(null); onNavigate(view); };

  const sheetSections = sheet && sheet !== 'dashboard' && sheet !== 'licenses' ? sections[sheet] : null;
  const sheetTitle = sheet === 'screens' ? 'Screens' : sheet === 'playlists' ? (admin ? 'Content' : 'Playlists') : 'More';

  return (
    <>
      {sheetSections && (
        <>
          <div className="fixed inset-0 bg-slate-950/40 z-[190] md:hidden animate-fadeIn" onClick={() => setSheet(null)} aria-hidden="true" />
          <div
            className="fixed left-0 right-0 bottom-0 z-[200] md:hidden bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.18)] animate-sheetUp max-h-[80vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}
            role="dialog"
            aria-label={sheetTitle}
          >
            <div className="sticky top-0 bg-white pt-2.5 pb-2 px-5 z-10">
              <div className="mx-auto w-10 h-1.5 rounded-full bg-slate-200 mb-3" />
              <h2 className="text-base font-semibold text-slate-900">{sheetTitle}</h2>
            </div>

            {sheet === 'more' && (
              <button type="button" onClick={() => go('profile')} className="mx-4 mb-3 w-[calc(100%-2rem)] flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-left active:bg-slate-100">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-11 h-11 rounded-full object-cover" />
                  : <DefaultAvatar className="w-11 h-11" iconSize={24} />}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 truncate">{profile.name}</span>
                  <span className="block text-xs text-slate-500">View profile</span>
                </span>
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            )}

            <div className="px-4 space-y-4">
              {sheetSections.map((section, si) => (
                <div key={section.title || si}>
                  {section.title && <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">{section.title}</p>}
                  <div className={`grid gap-2 ${sheet === 'more' ? 'grid-cols-3' : 'grid-cols-4'}`}>
                    {section.items.map(item => {
                      const Icon = item.icon;
                      const active = activeView === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => go(item.id)}
                          className={`relative flex flex-col items-center justify-center gap-1.5 min-h-[76px] px-1 py-2.5 rounded-2xl transition-colors active:scale-[0.97] ${
                            active ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-700 active:bg-slate-100'
                          }`}
                        >
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 shadow-sm'}`}>
                            <Icon size={18} />
                          </span>
                          <span className="text-[11px] font-medium leading-tight text-center">{item.label}</span>
                          {!!item.badge && (
                            <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center">{item.badge}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {sheet === 'more' && (
              <button
                type="button"
                onClick={() => { setSheet(null); onLogout(); }}
                className="mx-4 mt-4 w-[calc(100%-2rem)] h-11 flex items-center justify-center gap-2 rounded-2xl text-rose-600 text-sm font-medium bg-rose-50 active:bg-rose-100"
              >
                <LogOut size={16} /> Log out
              </button>
            )}
          </div>
        </>
      )}

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-[210] bg-white/95 backdrop-blur border-t border-slate-200/80 flex items-stretch select-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Main"
      >
        {tabs.map(tab => {
          const Icon = tab.icon;
          // While a sheet is open, its tab is the highlighted one.
          const on = sheet ? sheet === tab.id : isActive(tab.id);
          return (
            <motion.button
              key={tab.id}
              type="button"
              data-tour={`dock-${tab.id}`}
              onClick={() => tapTab(tab.id)}
              aria-label={tab.label}
              aria-current={isActive(tab.id) ? 'page' : undefined}
              whileTap={reduce ? undefined : { scale: 0.92 }}
              // No outline after a tap (it stayed as a blue box around the tab);
              // keyboard / D-pad focus still gets a ring.
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 min-h-[60px] outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 ${on ? 'text-blue-700' : 'text-slate-500'}`}
            >
              <span className="relative w-14 h-8 flex items-center justify-center">
                {on && (
                  <motion.span
                    layoutId="mobiledock-pill"
                    className="absolute inset-0 rounded-full bg-blue-100/80"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon size={21} strokeWidth={on ? 2.4 : 2} className="relative" />
                {!!tab.badge && (
                  <span className="absolute -top-0.5 right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </span>
              <span className={`text-[11px] leading-none ${on ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
            </motion.button>
          );
        })}
      </nav>
    </>
  );
}
