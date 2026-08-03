import { useState } from 'react';
import {
  LayoutDashboard, MonitorPlay, Tv, Key, Menu, X, LogOut,
  Film, Users, Building2, BarChart3, Settings as SettingsIcon,
  MessageSquare, User, ScanLine, List,
  type LucideIcon,
} from 'lucide-react';

interface DockItem {
  id: string;
  label: string;
  icon: LucideIcon;
  isMore?: boolean;
}

interface SheetItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const ADMIN_TABS: DockItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'screens-all', label: 'Screens', icon: MonitorPlay },
  { id: 'my-playlists', label: 'Playlists', icon: Tv },
  { id: 'licenses-management', label: 'Licenses', icon: Key },
  { id: 'more', label: 'More', icon: Menu, isMore: true },
];

const ADMIN_MORE: SheetItem[] = [
  { id: 'media-library', label: 'Media', icon: Film },
  { id: 'users', label: 'Clients', icon: Users },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'reports-overview', label: 'Reports', icon: BarChart3 },
  { id: 'licenses-code', label: 'License Decoder', icon: ScanLine },
  { id: 'settings-general', label: 'Settings', icon: SettingsIcon },
  { id: 'support', label: 'Support', icon: MessageSquare },
  { id: 'profile', label: 'Profile', icon: User },
];

const USER_TABS: DockItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'my-screens-list', label: 'Screens', icon: MonitorPlay },
  { id: 'media-library', label: 'Media', icon: Film },
  { id: 'playlists-all', label: 'Playlists', icon: List },
  { id: 'more', label: 'More', icon: Menu, isMore: true },
];

const USER_MORE: SheetItem[] = [
  { id: 'licenses-pool', label: 'Billing', icon: Key },
  { id: 'organizations', label: 'Organization', icon: Building2 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'reports-overview', label: 'Reports', icon: BarChart3 },
  { id: 'settings-general', label: 'Settings', icon: SettingsIcon },
  { id: 'support-tickets', label: 'Support', icon: MessageSquare },
  { id: 'profile', label: 'Profile', icon: User },
];

interface MobileDockProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  role?: 'admin' | 'user';
}

export default function MobileDock({ activeView, onNavigate, onLogout, role = 'admin' }: MobileDockProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const tabs = role === 'admin' ? ADMIN_TABS : USER_TABS;
  const moreItems = role === 'admin' ? ADMIN_MORE : USER_MORE;

  const isItemActive = (id: string) => {
    if (id === 'screens-all' || id === 'my-screens-list') return activeView.includes('screen');
    if (id === 'my-playlists' || id === 'playlists-all') return activeView.includes('playlist');
    if (id === 'media-library') return activeView.includes('media');
    if (id === 'licenses-management' || id === 'licenses-pool') return activeView.includes('license');
    if (id === 'reports-overview') return activeView.includes('report');
    if (id === 'settings-general') return activeView.includes('setting');
    if (id === 'support' || id === 'support-tickets') return activeView.includes('support');
    return activeView === id;
  };

  const moreActive = moreItems.some((item) => isItemActive(item.id));

  const go = (id: string) => {
    onNavigate(id);
    setSheetOpen(false);
  };

  return (
    <>
      {sheetOpen && (
        <div className="fixed inset-0 z-[200] md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fadeIn"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl border-t border-slate-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-slideUp shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">More</h3>
              <button
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item.id)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors cursor-pointer ${
                      active ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-[11px] font-semibold text-center leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setSheetOpen(false); onLogout(); }}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-100 text-rose-600 text-sm font-bold hover:bg-rose-50 cursor-pointer"
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </div>
      )}

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-lg border-t border-slate-200/80 flex items-stretch justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.08)] select-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.isMore ? moreActive || sheetOpen : isItemActive(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => (tab.isMore ? setSheetOpen(true) : go(tab.id))}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors cursor-pointer ${
                active ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <Icon size={21} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-bold tracking-tight leading-none">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
