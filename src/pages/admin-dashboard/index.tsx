import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config';
import { ADMIN_ROUTES, getAdminViewFromPath } from '../../lib/routes';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './views/Dashboard';
import AllScreens from './views/screens/AllScreens';
import MyScreens from './views/screens/MyScreens';
import AddScreen from './views/screens/AddScreen';
import ScreenGroups from './views/screens/ScreenGroups';
import Logs from './views/screens/Logs';
import MediaLibrary from './views/media/MediaLibrary';
import AllPlaylists from './views/playlists/AllPlaylists';
import CreatePlaylist from './views/playlists/CreatePlaylist';
import Scheduler from './views/playlists/Scheduler';
import Reports from './views/Reports';
import Users from './views/Users';
import Licenses from './views/Licenses';
import Organizations from './views/Organizations';
import LicenseDecoder from './views/LicenseDecoder';
import Settings from './views/Settings';
import Support from './views/Support';
import Profile from './views/Profile';
import ClientMedia from './views/ClientMedia';
import ClientPlaylists from './views/ClientPlaylists';
import VideoConferencing from './views/VideoConferencing';
import Integrations from './views/Integrations';
import MobileDock from '../../components/MobileDock';
import OfflineIndicator from '../../components/OfflineIndicator';
import PullToRefresh from '../../components/PullToRefresh';
import SectionTransition from '../../components/SectionTransition';
import { runTour } from '../../lib/tour/runner';
import { getAdminTourSteps } from '../../lib/tour/adminTour';
import { hasSeenTour, markTourSeen } from '../../lib/tour/state';
import { useMobileDetect } from '../../hooks/useMobileDetect';
import { useCapacitor } from '../../hooks/useCapacitor';
import { syncAllFromDatabase } from '../../lib/syncHelper';
import { Lock, X, CheckCircle } from 'lucide-react';
import { getAuthToken } from '../../lib/authStorage';

function renderView(view: string, navigate: (v: string) => void, adminEmail: string) {
  switch (view) {
    case 'dashboard': return <Dashboard userEmail={adminEmail} onNavigate={navigate} />;
    case 'client-screens': return <AllScreens onNavigate={navigate} userEmail={adminEmail} />;

    // My Channel
    case 'my-media': return <MediaLibrary onNavigate={navigate} userEmail={adminEmail} />;
    case 'my-playlists': return <AllPlaylists onNavigate={navigate} userEmail={adminEmail} />;
    case 'my-create-playlist': return <CreatePlaylist userEmail={adminEmail} onNavigate={navigate} isMyChannel={true} />;

    // Client Oversight
    case 'client-media': return <ClientMedia userEmail={adminEmail} />;
    case 'client-playlists': return <ClientPlaylists onNavigate={navigate} userEmail={adminEmail} />;

    case 'my-screens-list': return <MyScreens onNavigate={navigate} userEmail={adminEmail} />;
    case 'screens-all': return <AllScreens onNavigate={navigate} userEmail={adminEmail} />;
    case 'screens-add': return <AddScreen mode="client" onNavigate={navigate} userEmail={adminEmail} />;
    case 'screens-add-client': return <AddScreen mode="client" onNavigate={navigate} userEmail={adminEmail} />;
    case 'screens-add-my': return <AddScreen mode="my" onNavigate={navigate} userEmail={adminEmail} />;
    // Old "Manage & Troubleshoot" page — All Screens now has every action it had, wired to the real TVs.
    case 'screens-manage': return <AllScreens onNavigate={navigate} userEmail={adminEmail} />;
    case 'screens-groups':
    case 'screens-groups-my': return <ScreenGroups mode="my" onNavigate={navigate} userEmail={adminEmail} />;
    case 'screens-groups-all': return <ScreenGroups mode="all" onNavigate={navigate} userEmail={adminEmail} />;
    case 'screens-logs': return <Logs userEmail={adminEmail} mode="all" onNavigate={navigate} />;
    case 'screens-logs-all': return <Logs userEmail={adminEmail} mode="all" onNavigate={navigate} />;
    case 'media-library': return <MediaLibrary onNavigate={navigate} userEmail={adminEmail} />;
    case 'playlists-all': return <AllPlaylists onNavigate={navigate} userEmail={adminEmail} />;
    case 'playlists-create': return <CreatePlaylist userEmail={adminEmail} onNavigate={navigate} />;
    case 'playlists-scheduler': return <Scheduler userEmail={adminEmail} isAdmin={true} />;
    case 'reports-overview': return <Reports activeTab="Overview" />;
    case 'reports-screens': return <Reports activeTab="Screen Reports" />;
    case 'reports-media': return <Reports activeTab="Media Reports" />;
    case 'reports-logs': return <Reports activeTab="Device Logs" />;
    case 'users': return <Users />;
    case 'licenses-management': return <Licenses activeTab="management" onNavigate={navigate} />;
    case 'licenses-payments': return <Licenses activeTab="payments" onNavigate={navigate} />;
    case 'licenses-expirations': return <Licenses activeTab="expirations" onNavigate={navigate} />;
    case 'licenses-invoices': return <Licenses activeTab="invoices" onNavigate={navigate} />;
    case 'licenses-code': return <LicenseDecoder />;
    case 'organizations': return <Organizations />;
    case 'video-conferencing': return <VideoConferencing />;
    case 'integrations': return <Integrations />;
    case 'settings-general': return <Settings activeTab="General" />;
    // Storage config moved to Integrations (Cloudflare R2) — redirect any old link/bookmark there.
    case 'settings-storage': return <Integrations />;
    case 'settings-player': return <Settings activeTab="Player Settings" />;
    case 'settings-notifications': return <Settings activeTab="Notifications" />;
    case 'support':
    case 'support-issues': return <Support activeTab="issues" onNavigate={navigate} userEmail={adminEmail} />;
    case 'support-faq': return <Support activeTab="faq" onNavigate={navigate} userEmail={adminEmail} />;
    case 'support-docs': return <Support activeTab="docs" onNavigate={navigate} userEmail={adminEmail} />;
    case 'profile': return <Profile />;
    default: return <Dashboard userEmail={adminEmail} onNavigate={navigate} />;
  }
}

export default function AdminDashboard({ onLogout, onSwitchToClient, userEmail = 'admin@demo.com' }: { onLogout: () => void; onSwitchToClient?: () => void; userEmail?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useMobileDetect();
  const { isNative, isAndroid } = useCapacitor();
  const mainRef = useRef<HTMLElement>(null);

  // Active view is derived directly from the URL pathname
  const activeView = getAdminViewFromPath(location.pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return true;
    return localStorage.getItem('signageos_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('signageos_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleNavigate = (targetView: string) => {
    const targetPath = ADMIN_ROUTES[targetView] || `/admin/${targetView}`;
    navigate(targetPath);
    // Auto-close sidebar on mobile after navigation
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  };

  // Pull to refresh handler
  const handleRefresh = async () => {
    try {
      await syncAllFromDatabase({ force: true });
      console.log('Data synced successfully');
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  // Sync data when app resumes (for native apps)
  useEffect(() => {
    if (!isNative) return;

    const handleAppResumed = () => {
      syncAllFromDatabase({ force: true }).catch(console.error);
    };

    window.addEventListener('app-resumed', handleAppResumed);
    return () => window.removeEventListener('app-resumed', handleAppResumed);
  }, [isNative]);

  // First-run orientation tour. Only on the dashboard route (not e.g. deep in
  // Settings after a refresh) and only once per account — replayable anytime
  // from Support's "Take the tour" button. The delay lets the dashboard's own
  // first paint and KPI fetch settle before the tour measures anything.
  useEffect(() => {
    if (activeView !== 'dashboard') return;
    if (hasSeenTour('admin-dashboard', userEmail)) return;
    const timer = setTimeout(() => {
      runTour({
        steps: getAdminTourSteps(),
        navigate,
        onFinish: () => markTourSeen('admin-dashboard', userEmail)
      });
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First time login states
  const [isFirstLogin, setIsFirstLogin] = useState(() => localStorage.getItem('signageos_first_time_login') === 'true');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  const handleFirstLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setPassError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Passwords do not match.');
      return;
    }

    setPassLoading(true);
    setPassError('');

    try {
      const userId = localStorage.getItem('signageos_user_id');
      const token = getAuthToken();

      const res = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          password: newPassword,
          firstTimeLogin: false
        })
      });

      if (res.ok) {
        setPassSuccess(true);
        localStorage.setItem('signageos_first_time_login', 'false');
        setTimeout(() => {
          setIsFirstLogin(false);
        }, 1500);
      } else {
        const errData = await res.json().catch(() => ({}));
        setPassError(errData.error || 'Failed to change password. Try again.');
      }
    } catch (err) {
      console.error(err);
      setPassError('Connection error. Try again.');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden text-left relative">
      {/* Offline Indicator */}
      <OfflineIndicator onRetry={handleRefresh} />

      {/* Sidebar Overlay for Mobile */}
      {!sidebarCollapsed && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/40 z-40 md:hidden animate-fadeIn"
        />
      )}

      <Sidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeView={activeView}
          onNavigate={handleNavigate}
          onLogout={onLogout}
          onToggleSidebar={toggleSidebar}
          onSwitchToClient={onSwitchToClient}
        />

        {/* Pull to Refresh wrapper for mobile */}
        <PullToRefresh onRefresh={handleRefresh} enabled={isMobile}>
          <main ref={mainRef} className="flex-1 overflow-y-auto pb-20 md:pb-4">
            <SectionTransition viewKey={activeView} scrollRoot={mainRef} className="sg-page">
              {renderView(activeView, handleNavigate, userEmail)}
            </SectionTransition>
          </main>
        </PullToRefresh>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <MobileDock activeView={activeView} onNavigate={handleNavigate} onLogout={onLogout} role="admin" />


      {/* First Time Login Password Reset Modal */}
      {isFirstLogin && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
          <div className="relative w-full max-w-md bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800 p-8 space-y-6 animate-scaleIn">
            <div className="text-center space-y-2 py-4">
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto text-blue-500">
                <Lock size={20} />
              </div>
              <h2 className="text-xl font-bold">Set Your New Password</h2>
              <p className="text-xs text-slate-400">
                Welcome to SignageOS! Please create a secure new password for your account to continue.
              </p>
            </div>

            {passError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold text-center animate-shake">
                {passError}
              </div>
            )}

            {passSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold text-center flex items-center justify-center gap-2">
                <CheckCircle size={16} /> Password updated successfully! Redirecting...
              </div>
            ) : (
              <form onSubmit={handleFirstLoginSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-1.5">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full py-3 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full py-3 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passLoading}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {passLoading ? 'Updating Password...' : 'Save & Continue'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
