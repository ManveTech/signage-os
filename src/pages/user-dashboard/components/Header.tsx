import { useState, useEffect } from 'react';
import { 
  Search, ChevronDown, User, LogOut, Home, Settings, Play, Film, HelpCircle, Users, Activity, Menu, ShieldCheck 
} from 'lucide-react';

const breadcrumbMap: Record<string, string[]> = {
  dashboard: ['Dashboard'],
  'screens-all': ['Screens', 'All Screens'],
  'screens-add': ['Screens', 'Add Screen'],
  'screens-groups': ['Screens', 'Screen Groups'],
  'screens-logs': ['Screens', 'Logs'],
  'media-library': ['Media', 'Library'],
  'media-upload': ['Media', 'Upload Media'],
  'media-layout': ['Media', 'Layout Studio'],
  'media-tags': ['Media', 'Tags'],
  'playlists-all': ['Playlists', 'All Playlists'],
  'playlists-create': ['Playlists', 'Create Playlist'],
  'playlists-scheduler': ['Playlists', 'Scheduler'],
  'reports-overview': ['Reports', 'Overview'],
  'reports-screens': ['Reports', 'Screen Reports'],
  'reports-media': ['Reports', 'Media Reports'],
  'reports-logs': ['Reports', 'Device Logs'],
  users: ['Users'],
  'licenses-pool': ['Licenses', 'License Pool'],
  'licenses-assign': ['Licenses', 'Assign License'],
  'licenses-history': ['Licenses', 'History'],
  organizations: ['Organizations'],
  'settings-general': ['Settings', 'General'],
  'settings-storage': ['Settings', 'Storage'],
  'settings-player': ['Settings', 'Player Settings'],
  'settings-notifications': ['Settings', 'Notifications'],
  support: ['Support'],
  profile: ['Profile'],
};

type Props = { 
  activeView: string;
  onNavigate?: (view: string) => void;
  onLogout?: () => void;
  userEmail?: string;
  onToggleSidebar?: () => void;
  onSwitchToAdmin?: () => void;
};

type SearchItem = {
  title: string;
  type: 'Screen' | 'Playlist' | 'Media' | 'Page' | 'User' | 'Support';
  view: string;
};

const searchDatabase: SearchItem[] = [
  // Views
  { title: 'Dashboard Summary', type: 'Page', view: 'dashboard' },
  { title: 'My Screen Players', type: 'Page', view: 'my-screens-list' },
  { title: 'All media uploads library', type: 'Page', view: 'media-library' },
  { title: 'All play lists', type: 'Page', view: 'playlists-all' },
  { title: 'Create new playlist template', type: 'Page', view: 'playlists-create' },
  { title: 'Layout Studio design custom canvas', type: 'Page', view: 'media-layout' },
  { title: 'License & Billing billing history', type: 'Page', view: 'license-billing' },
  { title: 'My Support Tickets log', type: 'Page', view: 'support-tickets' },
  { title: 'Help center documentation', type: 'Page', view: 'support-help' },
  { title: 'User Profile & Credentials', type: 'Page', view: 'profile' },

  // Screens
  { title: 'Cafe Screen 1 (Active)', type: 'Screen', view: 'my-screens-list' },
  { title: 'Store Front C (Offline)', type: 'Screen', view: 'my-screens-list' },
  { title: 'Lobby Display 3 (Standby)', type: 'Screen', view: 'my-screens-list' },

  // Playlists
  { title: 'Food Promo Loop (Active)', type: 'Playlist', view: 'playlists-all' },
  { title: 'Corporate Video Playlist (Pending)', type: 'Playlist', view: 'playlists-all' },
  { title: 'Product Launch Showcase (Idle)', type: 'Playlist', view: 'playlists-all' },

  // Media
  { title: 'menu-flyer.png (Image)', type: 'Media', view: 'media-library' },
  { title: 'welcome-video.mp4 (Video)', type: 'Media', view: 'media-library' },
  { title: 'promo-banner.jpg (Image)', type: 'Media', view: 'media-library' },

  // Support
  { title: 'Raise new support ticket', type: 'Support', view: 'support-tickets' },
  { title: 'Help Center FAQs & Pair Guide', type: 'Support', view: 'support-help' }
];

export default function Header({ activeView, onNavigate, onLogout, userEmail = 'priya@demo.com', onToggleSidebar, onSwitchToAdmin }: Props) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  
  // Dynamic user profile details
  const [profileName, setProfileName] = useState(() => {
    const stored = localStorage.getItem(`signageos_user_name_${userEmail}`);
    if (stored) return stored;
    const namePrefix = userEmail.split('@')[0];
    return namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1) + ' User';
  });
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem(`signageos_user_avatar_${userEmail}`) || '');

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);

  const updateProfileDetails = () => {
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
    updateProfileDetails();
  }, [userEmail]);

  useEffect(() => {
    window.addEventListener('signageos_user_profile_updated', updateProfileDetails);
    return () => window.removeEventListener('signageos_user_profile_updated', updateProfileDetails);
  }, [userEmail]);

  // Handle outside click to close dropdowns
  useEffect(() => {
    const handleClose = () => {
      setShowUserDropdown(false);
    };
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const crumbs = breadcrumbMap[activeView] ?? ['Dashboard'];

  // Handle Centralized search query
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const filtered = searchDatabase.filter(item =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.type.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(filtered);
  };

  const handleSearchResultClick = (view: string) => {
    if (onNavigate) {
      onNavigate(view);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 z-40 relative">
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 hover:bg-slate-50 text-gray-500 rounded-lg md:hidden cursor-pointer mr-1"
        >
          <Menu size={18} />
        </button>
        {crumbs.map((crumb, i) => (
          <span key={crumb} className="flex items-center gap-2">
            {i > 0 && <ChevronDown size={12} className="text-gray-400 rotate-[-90deg]" />}
            <span className={i === crumbs.length - 1 ? 'text-gray-900 font-semibold' : 'text-gray-400'}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {/* Centralized Search Bar */}
        <div className="relative hidden md:block z-50">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Central search (screens, playlists, tickets...)"
            className="pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-400 w-64 focus:bg-white transition-colors"
          />
          {searchResults.length > 0 && (
            <div className="absolute right-0 top-11 w-80 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-y-auto py-2 z-50 animate-fadeIn">
              <div className="px-3.5 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-50 mb-1">
                Search Results ({searchResults.length})
              </div>
              {searchResults.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleSearchResultClick(item.view)}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group border-b border-slate-50 last:border-0 cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 truncate group-hover:text-blue-600">{item.title}</p>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">{item.type} View</p>
                  </div>
                  <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                    {item.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Dropdown replaces Notifications */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-1.5 p-1 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer select-none"
          >
            {profileAvatar ? (
              <img src={profileAvatar} className="w-8 h-8 rounded-full object-cover border border-slate-200" alt="Avatar" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                {profileName.substring(0, 2).toUpperCase()}
              </div>
            )}
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 top-11 w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden text-xs py-1.5 animate-scaleIn">
              <div className="px-3.5 py-2 border-b border-gray-100 bg-slate-50/50">
                <p className="font-bold text-gray-900 truncate">{profileName}</p>
                <p className="text-[9px] text-slate-450 truncate font-semibold mt-0.5">{userEmail}</p>
              </div>

              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  if (onNavigate) onNavigate('dashboard');
                }}
                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer font-bold text-slate-700"
              >
                <Home size={14} className="text-slate-400" />
                Go to Homepage
              </button>

              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  if (onNavigate) onNavigate('profile');
                }}
                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer font-bold text-slate-700"
              >
                <Settings size={14} className="text-slate-400" />
                View Profile
              </button>

              {onSwitchToAdmin && (
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onSwitchToAdmin();
                  }}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-sky-50 text-sky-700 transition-colors flex items-center gap-2 cursor-pointer font-bold"
                >
                  <ShieldCheck size={14} className="text-sky-500" />
                  Switch to Admin View
                </button>
              )}

              <hr className="border-gray-100 my-1" />

              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  if (onLogout) onLogout();
                }}
                className="w-full px-3.5 py-2.5 text-left hover:bg-rose-50 text-rose-600 transition-colors flex items-center gap-2 cursor-pointer font-bold"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
