import React, { useState, useEffect } from 'react';
import logoImg from '../../../assets/BS-main-Logo.png';
import {
  LayoutDashboard, Monitor, Film, List, BarChart2, Users, Key, Building2,
  Settings, HelpCircle, User, ChevronDown, ChevronRight, Search, LogOut,
  Tv, MonitorPlay, Layers, Tag, CalendarDays, FileBarChart, Shield,
  MessageSquare, Plus
} from 'lucide-react';
import { licensingStore } from '../../../lib/licensingStore';

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
      { id: 'screens-groups', label: 'Create Groups' },
      { id: 'screens-health', label: 'Health Logs' },
    ]
  },
  {
    id: 'my-channel', label: 'My Channel', icon: <Tv size={18} />,
    children: [
      { id: 'media-library', label: 'All Media' },
      { id: 'playlists-all', label: 'All Playlists' },
      { id: 'playlists-create', label: 'Create Playlist' },
      { id: 'media-layout', label: 'Layout Studio' },
    ]
  },
  { id: 'license-billing', label: 'License & Billing', icon: <Key size={18} /> },
  {
    id: 'support', label: 'Support', icon: <MessageSquare size={18} />,
    children: [
      { id: 'support-tickets', label: 'My Tickets' },
      { id: 'support-help', label: 'Help Center' }
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
  userEmail?: string;
};

export default function Sidebar({ activeView, onNavigate, collapsed, onToggle, onLogout, userEmail = 'priya@demo.com' }: Props) {
  const [expandedSections] = useState<Set<string>>(new Set(['my-screens', 'my-channel', 'support']));

  // Branding states
  const [logo, setLogo] = useState('');
  const [name, setName] = useState('SignageOS');

  const updateBranding = () => {
    const licenses = licensingStore.getLicenses();
    const lic = licenses.find(l => l.assignedUserEmail === userEmail);
    const isWhiteLabelEnabled = lic ? !!lic.whiteLabel : false;

    if (isWhiteLabelEnabled) {
      setLogo(localStorage.getItem('signageos_client_logo') || '');
      setName(localStorage.getItem('signageos_client_name') || 'SignageOS');
    } else {
      setLogo('');
      setName('SignageOS');
    }
  };

  useEffect(() => {
    updateBranding();
  }, [userEmail]);

  useEffect(() => {
    window.addEventListener('signageos_branding_updated', updateBranding);
    return () => window.removeEventListener('signageos_branding_updated', updateBranding);
  }, [userEmail]);

  // Dynamic user profile states
  const [profileName, setProfileName] = useState(() => {
    const stored = localStorage.getItem(`signageos_user_name_${userEmail}`);
    if (stored) return stored;
    const namePrefix = userEmail.split('@')[0];
    return namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1) + ' User';
  });
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem(`signageos_user_avatar_${userEmail}`) || '');

  const updateProfile = () => {
    const stored = localStorage.getItem(`signageos_user_name_${userEmail}`);
    if (stored) {
      setProfileName(stored);
    } else {
      const namePrefix = userEmail.split('@')[0];
      setProfileName(namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1) + ' User');
    }
    setProfileAvatar(localStorage.getItem(`signageos_user_avatar_${userEmail}`) || '');
  };

  useEffect(() => {
    updateProfile();
  }, [userEmail]);

  useEffect(() => {
    window.addEventListener('signageos_user_profile_updated', updateProfile);
    return () => window.removeEventListener('signageos_user_profile_updated', updateProfile);
  }, [userEmail]);

  const toggleSection = (id: string) => {
    // Keep submenus permanently expanded / uncollapsed
  };

  const isActive = (section: NavSection) => {
    if (activeView === section.id) return true;
    if (section.children?.some(c => activeView === c.id)) return true;
    return false;
  };

  return (
    <aside className={`flex flex-col bg-white border-r border-gray-100 transition-all duration-300 fixed md:relative inset-y-0 left-0 z-50 md:z-auto h-full ${collapsed ? 'w-0 md:w-16 overflow-hidden md:overflow-visible border-r-0 md:border-r' : 'w-60'} min-h-screen shadow-2xl md:shadow-none`}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <img src={logo || logoImg} className="w-10 h-10 object-contain shrink-0 rounded-lg" alt={`${name} Logo`} />
            <span className="font-bold text-gray-900 text-sm truncate max-w-[120px]">{name}</span>
          </div>
        )}
        {collapsed && (
          <img src={logo || logoImg} className="w-9 h-9 object-contain shrink-0 mx-auto rounded-lg" alt={`${name} Logo`} />
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
                ${isActive(section) && !section.children
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              title={collapsed ? section.label : undefined}
            >
              <span className={`flex-shrink-0 ${isActive(section) ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
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
                {section.children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => {
                      if (window.innerWidth < 768) {
                        onToggle();
                      }
                      onNavigate(child.id);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all
                      ${activeView === child.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeView === child.id ? 'bg-blue-600' : 'bg-gray-300'}`} />
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="border-t border-gray-100 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            {profileAvatar ? (
              <img src={profileAvatar} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="Avatar" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-semibold">
                  {profileName.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{profileName}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
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
