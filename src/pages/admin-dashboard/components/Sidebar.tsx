import React, { useState, useEffect } from 'react';
import logoImg from '../../../assets/BS-main-Logo.png';
import {
  LayoutDashboard, Monitor, Film, List, BarChart2, Users, Key, Building2,
  Settings, HelpCircle, User, ChevronDown, ChevronRight, Search, LogOut,
  Tv, MonitorPlay, Layers, Tag, CalendarDays, FileBarChart, Shield,
  MessageSquare
} from 'lucide-react';

type NavSection = {
  id: string;
  label: string;
  icon: React.ReactNode;
  children?: { id: string; label: string }[];
};

const navSections: NavSection[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  {
    id: 'my-screens', label: 'My Screens', icon: <MonitorPlay size={18} />,
    children: [
      { id: 'my-screens-list', label: 'My Screens' },
      { id: 'screens-groups-my', label: 'Create Groups' },
      { id: 'screens-health', label: 'Health Logs' },
    ]
  },
  {
    id: 'screens', label: 'All Screens', icon: <Monitor size={18} />,
    children: [
      { id: 'screens-all', label: 'All Screens' },
      { id: 'screens-groups-all', label: 'Manage Groups' },
    ]
  },
  {
    id: 'my-channel', label: 'My Channel', icon: <Tv size={18} />,
    children: [
      { id: 'my-media', label: 'All Media' },
      { id: 'my-playlists', label: 'All Playlists' },
      { id: 'my-create-playlist', label: 'Create Playlist' },
      { id: 'media-layout', label: 'Layout Studio' },
    ]
  },
  {
    id: 'client-management', label: 'Client Assets', icon: <Building2 size={18} />,
    children: [
      { id: 'client-media', label: 'Client Media' },
      { id: 'client-playlists', label: 'Client Playlists' },
    ]
  },
  { id: 'users', label: 'Users', icon: <Users size={18} /> },
  { id: 'organizations', label: 'Organizations', icon: <Building2 size={18} /> },
  {
    id: 'licenses', label: 'Licensing', icon: <Key size={18} />,
    children: [
      { id: 'licenses-management', label: 'License Management' },
      { id: 'licenses-payments', label: 'Payment History' },
      { id: 'licenses-expirations', label: 'Upcoming Expirations' },
      { id: 'licenses-invoices', label: 'Invoice Management' },
    ]
  },
  {
    id: 'support', label: 'Support', icon: <MessageSquare size={18} />,
    children: [
      { id: 'support-issues', label: 'Ongoing Issues' },
      { id: 'support-faq', label: 'FAQ Management' },
      { id: 'support-docs', label: 'Support Documents' },
    ]
  },
  { id: 'profile', label: 'Profile', icon: <User size={18} /> },
];

type Props = {
  activeView: string;
  onNavigate: (view: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  onLogout?: () => void;
};

export default function Sidebar({ activeView, onNavigate, collapsed, onToggle, onLogout }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['my-screens', 'screens', 'media', 'support']));

  // Admin profile dynamic states
  const [adminName, setAdminName] = useState(() => localStorage.getItem('signageos_admin_name') || 'Super Admin');
  const [adminAvatar, setAdminAvatar] = useState(() => localStorage.getItem('signageos_admin_avatar') || '');

  const updateAdminProfile = () => {
    setAdminName(localStorage.getItem('signageos_admin_name') || 'Super Admin');
    setAdminAvatar(localStorage.getItem('signageos_admin_avatar') || '');
  };

  useEffect(() => {
    updateAdminProfile();
  }, []);

  useEffect(() => {
    window.addEventListener('signageos_admin_profile_updated', updateAdminProfile);
    return () => window.removeEventListener('signageos_admin_profile_updated', updateAdminProfile);
  }, []);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isActive = (id: string) => {
    if (id === 'my-screens') {
      return activeView === 'my-screens' || activeView.startsWith('my-screens-') || activeView === 'screens-add-my' || activeView === 'screens-groups-my';
    }
    if (id === 'screens') {
      return activeView === 'screens' || (activeView.startsWith('screens-') && activeView !== 'screens-add-my' && activeView !== 'screens-groups-my');
    }
    return activeView === id || activeView.startsWith(id + '-');
  };

  return (
    <aside className={`flex flex-col bg-white border-r border-gray-100 transition-all duration-300 fixed md:relative inset-y-0 left-0 z-50 md:z-auto h-full ${collapsed ? 'w-0 md:w-16 overflow-hidden md:overflow-visible border-r-0 md:border-r' : 'w-60'} min-h-screen shadow-2xl md:shadow-none`}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src={logoImg} className="w-10 h-10 object-contain shrink-0" alt="SignageOS Logo" />
            <span className="font-bold text-gray-900 text-sm">SignageOS</span>
          </div>
        )}
        {collapsed && (
          <img src={logoImg} className="w-9 h-9 object-contain shrink-0 mx-auto" alt="SignageOS Logo" />
        )}
        {!collapsed && (
          <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <ChevronRight size={16} className="rotate-180" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navSections.map(section => (
          <div key={section.id}>
            <button
              onClick={() => {
                if (collapsed) {
                  onToggle();
                } else if (window.innerWidth < 768 && !section.children) {
                  onToggle();
                }
                if (section.children) toggleSection(section.id);
                else onNavigate(section.id);
              }}
              className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm transition-all group
                ${isActive(section.id) && !section.children
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              title={collapsed ? section.label : undefined}
            >
              <span className={`flex-shrink-0 ${isActive(section.id) ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                {section.icon}
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{section.label}</span>
                  {section.children && (
                    <span className="text-gray-400">
                      {expandedSections.has(section.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  )}
                </>
              )}
            </button>
            {!collapsed && section.children && expandedSections.has(section.id) && (
              <div className="ml-4 mt-0.5 space-y-0.5">
                {section.children.map(child => {
                  const isChildActive = activeView === child.id || 
                    (child.id === 'my-screens-list' && activeView === 'screens-add-my') ||
                    (child.id === 'screens-all' && (activeView === 'screens-add' || activeView === 'screens-add-client'));
                  return (
                    <button
                      key={child.id}
                      onClick={() => {
                        if (window.innerWidth < 768) {
                          onToggle();
                        }
                        onNavigate(child.id);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all
                        ${isChildActive
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isChildActive ? 'bg-blue-600' : 'bg-gray-300'}`} />
                      {child.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="border-t border-gray-100 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            {adminAvatar ? (
              <img src={adminAvatar} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="Avatar" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-semibold">
                  {adminName.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{adminName}</p>
              <p className="text-xs text-gray-500 truncate">System Administrator</p>
            </div>
            <button 
              onClick={onLogout}
              className="text-gray-400 hover:text-red-500 p-1 transition-colors" 
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button onClick={onToggle} className="w-full flex justify-center p-1 text-gray-400 hover:text-gray-600">
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </aside>
  );
}
