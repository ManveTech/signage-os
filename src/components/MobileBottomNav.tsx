import React from 'react';
import { LayoutDashboard, MonitorPlay, Tv, Key, User, Film, List, MessageSquare } from 'lucide-react';

interface MobileBottomNavProps {
  activeView: string;
  onNavigate: (view: string) => void;
  role?: 'admin' | 'user';
}

export default function MobileBottomNav({ activeView, onNavigate, role = 'admin' }: MobileBottomNavProps) {
  const adminItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'screens-all', label: 'Screens', icon: MonitorPlay },
    { id: 'my-playlists', label: 'Playlists', icon: Tv },
    { id: 'licenses-management', label: 'Licenses', icon: Key },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const userItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'my-screens', label: 'Screens', icon: MonitorPlay },
    { id: 'media-library', label: 'Media', icon: Film },
    { id: 'playlists', label: 'Playlists', icon: List },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const navItems = role === 'admin' ? adminItems : userItems;

  const isItemActive = (id: string) => {
    if (id === 'screens-all') return activeView.includes('screens');
    if (id === 'my-screens') return activeView.includes('screens');
    if (id === 'my-playlists' || id === 'playlists') return activeView.includes('playlist');
    if (id === 'media-library') return activeView.includes('media');
    if (id === 'licenses-management') return activeView.includes('license');
    return activeView === id;
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-lg border-t border-slate-200/80 flex justify-around items-center shadow-[0_-4px_16px_rgba(0,0,0,0.08)] select-none"
      style={{
        paddingTop: '0.5rem',
        paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(item.id);

        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-2 px-2 rounded-xl transition-all duration-200 active:scale-95 ${
              active
                ? 'text-blue-600'
                : 'text-slate-500 active:text-slate-700'
            }`}
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <div className={`relative p-1.5 rounded-xl transition-all duration-200 ${
              active ? 'bg-blue-50 scale-105' : 'bg-transparent'
            }`}>
              <Icon className={`w-5 h-5 transition-colors ${active ? 'text-blue-600' : 'text-slate-400'}`} strokeWidth={active ? 2.5 : 2} />
              {active && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600" />
              )}
            </div>
            <span className={`text-[10px] mt-0.5 leading-none transition-all ${
              active ? 'font-bold text-blue-600' : 'font-medium text-slate-500'
            }`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
