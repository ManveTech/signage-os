import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, MonitorPlay, Tv, Key, Menu, X, LogOut,
  Film, Users, Building2, BarChart3, Settings as SettingsIcon,
  User, ScanLine, Plus, Clock, FileText,
  CreditCard, ShieldAlert, ChevronRight, HelpCircle, Layers,
  Monitor, CalendarDays, Upload, Sparkles, ArrowLeft
} from 'lucide-react';

interface SubSectionItem {
  id: string;
  label: string;
  icon: React.ElementType;
  desc?: string;
}

interface SheetItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface PrimaryTab {
  id: 'dashboard' | 'screens' | 'playlists' | 'licenses' | 'more';
  label: string;
  icon: React.ElementType;
  isMore?: boolean;
}

interface MobileDockProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  role?: 'admin' | 'user';
}

const PRIMARY_TABS: PrimaryTab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'screens', label: 'Screens', icon: MonitorPlay },
  { id: 'playlists', label: 'Playlists', icon: Tv },
  { id: 'licenses', label: 'Licenses', icon: Key },
  { id: 'more', label: 'More', icon: Menu, isMore: true },
];

const ADMIN_MORE_ITEMS: SheetItem[] = [
  { id: 'users', label: 'Clients / Users', icon: Users },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'reports-overview', label: 'Reports', icon: BarChart3 },
  { id: 'settings-general', label: 'Settings', icon: SettingsIcon },
  { id: 'support-issues', label: 'Ongoing Issues', icon: ShieldAlert },
  { id: 'support-faq', label: 'FAQ Management', icon: HelpCircle },
  { id: 'support-docs', label: 'Support Docs', icon: FileText },
  { id: 'licenses-code', label: 'License Decoder', icon: ScanLine },
  { id: 'profile', label: 'Profile', icon: User },
];

const USER_MORE_ITEMS: SheetItem[] = [
  { id: 'organizations', label: 'Organization', icon: Building2 },
  { id: 'users', label: 'Team Users', icon: Users },
  { id: 'reports-overview', label: 'Reports', icon: BarChart3 },
  { id: 'settings-general', label: 'Settings', icon: SettingsIcon },
  { id: 'support-tickets', label: 'Ongoing Issues', icon: ShieldAlert },
  { id: 'support-help', label: 'FAQ & Help', icon: HelpCircle },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function MobileDock({ activeView, onNavigate, onLogout, role = 'admin' }: MobileDockProps) {
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [popoverStep, setPopoverStep] = useState<'choose_scope' | 'show_subsections'>('choose_scope');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [screensScope, setScreensScope] = useState<'my' | 'client' | null>(null);
  const [playlistsScope, setPlaylistsScope] = useState<'my' | 'client' | null>(null);

  const moreItems = role === 'admin' ? ADMIN_MORE_ITEMS : USER_MORE_ITEMS;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePopover(null);
        setSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getSubSections = (tabId: string): SubSectionItem[] => {
    if (tabId === 'screens') {
      if (role === 'admin') {
        if (screensScope === 'my') {
          return [
            { id: 'my-screens-list', label: 'My Screens List', icon: MonitorPlay, desc: 'Your registered displays' },
            { id: 'screens-groups-my', label: 'My Groups', icon: Layers, desc: 'Manage your screen groups' },
            { id: 'screens-logs', label: 'My Screen Logs', icon: FileText, desc: 'Your TV heartbeat records' },
            { id: 'screens-add-my', label: 'Add Screen', icon: Plus, desc: 'Pair new personal display' },
          ];
        } else {
          return [
            { id: 'screens-all', label: 'All Client Screens', icon: Monitor, desc: 'Overview of all client TVs' },
            { id: 'screens-groups-all', label: 'Client Groups', icon: Layers, desc: 'Batch control client TV clusters' },
            { id: 'screens-manage', label: 'Manage & Troubleshoot', icon: SettingsIcon, desc: 'Screen health and commands' },
            { id: 'screens-logs-all', label: 'All System Logs', icon: FileText, desc: 'System-wide pairing logs' },
          ];
        }
      }
      return [
        { id: 'my-screens-list', label: 'My Screens', icon: MonitorPlay, desc: 'Your display hardware' },
        { id: 'screens-all', label: 'All Registered Screens', icon: Monitor, desc: 'Network overview' },
        { id: 'screens-add', label: 'Add Screen', icon: Plus, desc: 'Pair screen using 6-digit PIN' },
        { id: 'screens-groups', label: 'Screen Groups', icon: Users, desc: 'Group displays together' },
        { id: 'screens-manage', label: 'Manage Screens', icon: SettingsIcon, desc: 'Remote actions' },
        { id: 'screens-logs', label: 'Activity Logs', icon: FileText, desc: 'Pairing and status history' },
      ];
    }

    if (tabId === 'playlists') {
      if (role === 'admin') {
        if (playlistsScope === 'my') {
          return [
            { id: 'my-playlists', label: 'My Playlists', icon: Tv, desc: 'Your digital signage playlists' },
            { id: 'my-create-playlist', label: 'Create Playlist', icon: Plus, desc: 'Build multi-zone layouts' },
            { id: 'playlists-scheduler', label: 'Schedule Shift', icon: CalendarDays, desc: 'Automatic timed switches' },
            { id: 'media-layout', label: 'Layout Studio', icon: Sparkles, desc: 'Custom canvas designer' },
            { id: 'my-media', label: 'My Media Library', icon: Film, desc: 'Uploaded images and videos' },
          ];
        } else {
          return [
            { id: 'client-playlists', label: 'Client Playlists', icon: Building2, desc: 'Monitor organization playlists' },
            { id: 'client-media', label: 'Client Media Assets', icon: Film, desc: 'All client uploaded media files' },
          ];
        }
      }
      return [
        { id: 'playlists-all', label: 'All Playlists', icon: Tv, desc: 'Playlists catalog' },
        { id: 'playlists-create', label: 'Create Playlist', icon: Plus, desc: 'Design signage schedule' },
        { id: 'playlists-scheduler', label: 'Schedule Shift', icon: CalendarDays, desc: 'Set date & time switches' },
        { id: 'media-library', label: 'Media Library', icon: Film, desc: 'Manage your assets' },
        { id: 'media-upload', label: 'Upload Media', icon: Upload, desc: 'Add images, videos & widgets' },
        { id: 'media-layout', label: 'Layout Studio', icon: Sparkles, desc: 'Multi-zone designer' },
      ];
    }

    if (tabId === 'licenses') {
      if (role === 'admin') {
        return [
          { id: 'licenses-management', label: 'License Pool', icon: Key, desc: 'Active & pool licenses' },
          { id: 'licenses-payments', label: 'Payment History', icon: CreditCard, desc: 'Transactions & billing' },
          { id: 'licenses-expirations', label: 'Upcoming Expirations', icon: Clock, desc: 'Renewal notifications' },
          { id: 'licenses-invoices', label: 'Invoice Management', icon: FileText, desc: 'Generate & download invoices' },
          { id: 'licenses-code', label: 'License Decoder', icon: ScanLine, desc: 'Inspect token credentials' },
        ];
      }
      return [
        { id: 'licenses-pool', label: 'License Pool', icon: Key, desc: 'Active subscriptions' },
        { id: 'licenses-assign', label: 'Assign License', icon: Plus, desc: 'Attach to user account' },
        { id: 'licenses-history', label: 'Billing History', icon: CreditCard, desc: 'Past receipts & invoices' },
      ];
    }

    return [];
  };

  const handleTabClick = (tabId: string) => {
    if (tabId === 'dashboard') {
      setActivePopover(null);
      setSheetOpen(false);
      onNavigate('dashboard');
      return;
    }

    if (tabId === 'more') {
      setActivePopover(null);
      setSheetOpen(prev => !prev);
      return;
    }

    // Screens or Playlists: Trigger 2-step selection flow for admin
    setSheetOpen(false);

    if (activePopover === tabId) {
      // Toggle off if already open
      setActivePopover(null);
    } else {
      setActivePopover(tabId);
      if ((tabId === 'screens' || tabId === 'playlists') && role === 'admin') {
        setPopoverStep('choose_scope');
      } else {
        setPopoverStep('show_subsections');
      }
    }
  };

  const handleScopeSelect = (scope: 'my' | 'client') => {
    if (activePopover === 'screens') {
      setScreensScope(scope);
    } else if (activePopover === 'playlists') {
      setPlaylistsScope(scope);
    }
    setPopoverStep('show_subsections');
  };

  const handleSubItemClick = (viewId: string) => {
    setActivePopover(null);
    setSheetOpen(false);
    onNavigate(viewId);
  };

  const isTabActive = (tabId: string) => {
    if (tabId === 'dashboard') return activeView === 'dashboard';
    if (tabId === 'screens') return activeView.includes('screen');
    if (tabId === 'playlists') return activeView.includes('playlist') || activeView.includes('media');
    if (tabId === 'licenses') return activeView.includes('license');
    if (tabId === 'more') {
      return (
        activeView.includes('user') ||
        activeView.includes('org') ||
        activeView.includes('report') ||
        activeView.includes('setting') ||
        activeView.includes('support') ||
        activeView.includes('profile')
      );
    }
    return false;
  };

  const currentSubSections = activePopover ? getSubSections(activePopover) : [];
  const isMoreActive = moreItems.some(i => activeView === i.id || activeView.includes(i.id));

  return (
    <>
      {/* Dimmed Overlay Backdrop (NO BLUR, z-[190] so nav bar at z-[210] stays unblurred) */}
      {(activePopover || sheetOpen) && (
        <div
          className="fixed inset-0 bg-slate-950/30 z-[190] md:hidden animate-fadeIn"
          onClick={() => {
            setActivePopover(null);
            setSheetOpen(false);
          }}
          aria-hidden="true"
        />
      )}

      {/* Floating Popover Card for Screens, Playlists, Licenses (z-[220]) */}
      {activePopover && (
        <div
          className={`fixed bottom-[74px] z-[220] md:hidden w-[calc(100vw-24px)] max-w-sm bg-white rounded-[26px] border border-slate-200/90 shadow-[0_16px_40px_rgba(0,0,0,0.18)] p-3.5 animate-scaleUp text-left ${
            activePopover === 'screens' ? 'left-3' :
            activePopover === 'playlists' ? 'left-1/2 -translate-x-1/2' :
            activePopover === 'licenses' ? 'right-3' : 'left-3'
          }`}
          style={{ maxHeight: 'calc(80vh - 80px)' }}
        >
          {/* STEP 1: Ask "My Screens" vs "Client Screens" (or "My Channel" vs "Client Assets") */}
          {popoverStep === 'choose_scope' && (activePopover === 'screens' || activePopover === 'playlists') && role === 'admin' ? (
            <div>
              <div className="flex items-center justify-between px-1 pb-2.5 mb-2 border-b border-slate-100">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Select {activePopover === 'screens' ? 'Screens Scope' : 'Playlists Scope'}
                </span>
                <button
                  onClick={() => setActivePopover(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2.5 py-1">
                {activePopover === 'screens' ? (
                  <>
                    <button
                      onClick={() => handleScopeSelect('my')}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 text-blue-900 transition-all cursor-pointer text-left shadow-2xs"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <MonitorPlay size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-blue-950">My Screens</p>
                          <p className="text-[11px] text-blue-600/90 mt-0.5 font-medium">Personal displays, groups & logs</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-blue-500 shrink-0" />
                    </button>

                    <button
                      onClick={() => handleScopeSelect('client')}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-900 transition-all cursor-pointer text-left shadow-2xs"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Monitor size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-950">Client Screens</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Organization TV network & oversight</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 shrink-0" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleScopeSelect('my')}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 text-blue-900 transition-all cursor-pointer text-left shadow-2xs"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Tv size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-blue-950">My Channel</p>
                          <p className="text-[11px] text-blue-600/90 mt-0.5 font-medium">Playlists, studio, scheduler & media</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-blue-500 shrink-0" />
                    </button>

                    <button
                      onClick={() => handleScopeSelect('client')}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-900 transition-all cursor-pointer text-left shadow-2xs"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Building2 size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-950">Client Assets</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Organization playlists & client media</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 shrink-0" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* STEP 2: Show filtered sub-sections */
            <div>
              <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  {(activePopover === 'screens' || activePopover === 'playlists') && role === 'admin' && (
                    <button
                      onClick={() => setPopoverStep('choose_scope')}
                      className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                      title="Back to category selection"
                    >
                      <ArrowLeft size={15} />
                    </button>
                  )}
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    {activePopover === 'screens' ? (screensScope === 'my' ? 'My Screens' : 'Client Screens') :
                     activePopover === 'playlists' ? (playlistsScope === 'my' ? 'My Channel' : 'Client Assets') :
                     `${activePopover} Subsections`}
                  </span>
                </div>

                <button
                  onClick={() => setActivePopover(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[50vh] space-y-1 p-0.5 no-scrollbar">
                {currentSubSections.map(subItem => {
                  const Icon = subItem.icon;
                  const isSelected = activeView === subItem.id;
                  return (
                    <button
                      key={subItem.id}
                      onClick={() => handleSubItemClick(subItem.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-blue-50 border border-blue-200/80 text-blue-700 shadow-xs'
                          : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Icon size={17} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                            {subItem.label}
                          </p>
                          {subItem.desc && (
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {subItem.desc}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={14} className={`shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Classic More Bottom Sheet Modal (z-[220]) */}
      {sheetOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-[220] md:hidden bg-white rounded-t-[28px] border-t border-slate-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-slideUp shadow-[0_-8px_30px_rgba(0,0,0,0.16)] select-none">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-slate-900">More Tools & Management</h3>
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
              const active = activeView === item.id || activeView.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => handleSubItemClick(item.id)}
                  className={`flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl border transition-all cursor-pointer ${
                    active ? 'border-blue-200 bg-blue-50 text-blue-600 shadow-xs font-bold' : 'border-slate-100 text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-[11px] text-center leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => { setSheetOpen(false); onLogout(); }}
            className="mt-3.5 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-rose-100 text-rose-600 text-sm font-bold hover:bg-rose-50 cursor-pointer transition-colors"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar (z-[210] - stays crisp, unblurred, above backdrop overlay) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-[210] bg-white border-t border-slate-200/90 flex items-stretch justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.06)] select-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {PRIMARY_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = tab.isMore ? (isMoreActive || sheetOpen) : isTabActive(tab.id);
          const isPopoverOpen = activePopover === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              aria-label={tab.label}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[58px] transition-all cursor-pointer relative ${
                isActive || isPopoverOpen ? 'text-blue-600 font-bold' : 'text-slate-400 font-medium'
              }`}
            >
              {(isActive || isPopoverOpen) && (
                <span className="absolute top-0 w-8 h-1 bg-blue-600 rounded-b-full transition-all" />
              )}
              
              <div className={`p-1 rounded-xl transition-transform ${isPopoverOpen || (tab.isMore && sheetOpen) ? 'scale-110' : ''}`}>
                <Icon size={21} strokeWidth={isActive || isPopoverOpen ? 2.5 : 2} />
              </div>
              <span className="text-[10px] tracking-tight leading-none">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
