import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config';
import { USER_ROUTES, getUserViewFromPath } from '../../lib/routes';
import MobileDock from '../../components/MobileDock';
import OfflineIndicator from '../../components/OfflineIndicator';
import PullToRefresh from '../../components/PullToRefresh';
import { useMobileDetect } from '../../hooks/useMobileDetect';
import { useCapacitor } from '../../hooks/useCapacitor';
import { syncAllFromDatabase } from '../../lib/syncHelper';
import Sidebar from './components/Sidebar';
import { toast } from '../../components/Toast';
import Header from './components/Header';
import Dashboard from './views/Dashboard';
import AllScreens from './views/screens/AllScreens';
import MyScreens from './views/screens/MyScreens';
import AddScreen from './views/screens/AddScreen';
import AssignScreens from './views/screens/AssignScreens';
import ManageScreens from './views/screens/ManageScreens';
import ScreenGroups from './views/screens/ScreenGroups';
import Logs from './views/screens/Logs';
import MediaLibrary from './views/media/MediaLibrary';
import UploadMedia from './views/media/UploadMedia';
import LayoutStudio from './views/media/LayoutStudio';
import AllPlaylists from './views/playlists/AllPlaylists';
import CreatePlaylist from './views/playlists/CreatePlaylist';
import Scheduler from './views/playlists/Scheduler';
import Reports from './views/Reports';
import Users from './views/Users';
import Licenses from './views/Licenses';
import Organizations from './views/Organizations';
import Settings from './views/Settings';
import Support from './views/Support';
import Profile from './views/Profile';
import { licensingStore, License } from '../../lib/licensingStore';
import { syncCollection, pushToDatabase } from '../../lib/syncHelper';
import { X, CheckCircle, Lock, Image } from 'lucide-react';


function renderView(view: string, navigate: (v: string) => void, userEmail: string) {
  switch (view) {
    case 'dashboard': return <Dashboard userEmail={userEmail} />;
    case 'my-screens-list': return <MyScreens onNavigate={navigate} userEmail={userEmail} />;
    case 'screens-all': return <AllScreens onNavigate={navigate} userEmail={userEmail} />;
    case 'screens-add': return <AddScreen userEmail={userEmail} onNavigate={navigate} />;
    case 'screens-assign': return <AssignScreens />;
    case 'screens-manage': return <ManageScreens userEmail={userEmail} />;
    case 'screens-groups': return <ScreenGroups userEmail={userEmail} onNavigate={navigate} />;
    case 'screens-logs': return <Logs userEmail={userEmail} mode="my" onNavigate={navigate} />;
    case 'media-library': return <MediaLibrary onNavigate={navigate} userEmail={userEmail} />;
    case 'media-upload': return <UploadMedia />;
    case 'media-layout': return <LayoutStudio />;
    case 'playlists-all': return <AllPlaylists onNavigate={navigate} userEmail={userEmail} />;
    case 'playlists-create': return <CreatePlaylist userEmail={userEmail} onNavigate={navigate} />;
    case 'playlists-scheduler': return <Scheduler userEmail={userEmail} />;
    case 'reports-overview': return <Reports activeTab="Overview" />;
    case 'reports-screens': return <Reports activeTab="Screen Reports" />;
    case 'reports-media': return <Reports activeTab="Media Reports" />;
    case 'reports-logs': return <Reports activeTab="Device Logs" />;
    case 'users': return <Users />;
    case 'license-billing':
    case 'licenses-pool': return <Licenses activeTab="License Pool" />;
    case 'licenses-assign': return <Licenses activeTab="Assign License" />;
    case 'licenses-history': return <Licenses activeTab="History" />;
    case 'organizations': return <Organizations />;
    case 'settings-general': return <Settings activeTab="General" userEmail={userEmail} />;
    case 'settings-storage': return <Settings activeTab="Storage" userEmail={userEmail} />;
    case 'settings-player': return <Settings activeTab="Player Settings" userEmail={userEmail} />;
    case 'settings-notifications': return <Settings activeTab="Notifications" userEmail={userEmail} />;
    case 'support':
    case 'support-tickets': return <Support activeTab="tickets" userEmail={userEmail} onNavigate={navigate} />;
    case 'support-help': return <Support activeTab="help" userEmail={userEmail} onNavigate={navigate} />;
    case 'profile': return <Profile userEmail={userEmail} />;
    default: return <Dashboard userEmail={userEmail} />;
  }
}

export default function UserDashboard({ onLogout, userEmail = 'priya@demo.com', onSwitchToAdmin }: { onLogout: () => void; userEmail?: string; onSwitchToAdmin?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useMobileDetect();
  const { isNative } = useCapacitor();

  // Active view is derived directly from the URL pathname
  const activeView = getUserViewFromPath(location.pathname);
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

  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [clientLicense, setClientLicense] = useState<License | null>(null);

  const handleNavigate = (targetView: string) => {
    const targetPath = USER_ROUTES[targetView] || `/${targetView}`;
    navigate(targetPath);
    // Auto-close sidebar on mobile after navigation
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  };

  // Pull to refresh handler
  const handleRefresh = async () => {
    try {
      await syncAllFromDatabase();
      checkLicense();
      console.log('Data synced successfully');
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  // Sync data when app resumes (for native apps)
  useEffect(() => {
    if (!isNative) return;

    const handleAppResumed = () => {
      syncAllFromDatabase().then(() => {
        checkLicense();
      }).catch(console.error);
    };

    window.addEventListener('app-resumed', handleAppResumed);
    return () => window.removeEventListener('app-resumed', handleAppResumed);
  }, [isNative]);

  // First time login states
  const [isFirstLogin, setIsFirstLogin] = useState(() => localStorage.getItem('signageos_first_time_login') === 'true');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  // White-label onboarding branding states
  const isWhiteLabelEnabled = clientLicense ? !!clientLicense.whiteLabel : false;
  const [firstTimeLogo, setFirstTimeLogo] = useState(() => localStorage.getItem('signageos_client_logo') || '');
  const [firstTimeName, setFirstTimeName] = useState(() => localStorage.getItem('signageos_client_name') || 'SignageOS');

  const handleFirstTimeLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFirstTimeLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const checkLicense = () => {
    const licenses = licensingStore.getLicenses();
    const lic = licenses.find(l => l.assignedUserEmail === userEmail);
    if (lic) {
      setClientLicense(lic);
      const todayStr = new Date().toISOString().split('T')[0];
      // Due/Expired if status is expired/pending OR expiry date is set and is in the past
      const isExpired = lic.status === 'expired' || lic.status === 'pending_payment' || (lic.expiryDate && lic.expiryDate < todayStr);
      if (isExpired) {
        setIsPaywallOpen(true);
      } else {
        setIsPaywallOpen(false);
      }
    } else {
      setIsPaywallOpen(false); // No license, don't block
    }
  };

  useEffect(() => {
    Promise.all([
      syncCollection('licenses', 'signageos_licenses'),
      syncCollection('organizations', 'signageos_organizations'),
      syncCollection('users', 'signageos_users')
    ]).then(() => {
      checkLicense();

      // Sync branding to localStorage if user has a whitelabel license
      const licenses = licensingStore.getLicenses();
      const lic = licenses.find(l => l.assignedUserEmail === userEmail);
      if (lic && lic.whiteLabel) {
        const orgsData = localStorage.getItem('signageos_organizations');
        const orgs = orgsData ? JSON.parse(orgsData) : [];
        const usersData = localStorage.getItem('signageos_users');
        const users = usersData ? JSON.parse(usersData) : [];
        const currentUser = users.find((u: any) => u.email === userEmail);
        const myOrg = orgs.find((o: any) => o.id === lic.assignedOrgId || o.name === lic.assignedOrgName || o.name === currentUser?.company);
        if (myOrg) {
          if (myOrg.websiteLogo) {
            localStorage.setItem('signageos_client_logo', myOrg.websiteLogo);
          }
          if (myOrg.websiteName) {
            localStorage.setItem('signageos_client_name', myOrg.websiteName);
          }
          window.dispatchEvent(new Event('signageos_branding_updated'));
        }
      }
    });
  }, [userEmail]);

  // Keep checking license state on view changes
  useEffect(() => {
    const handleStorageChange = () => {
      checkLicense();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [userEmail]);

  // First time login submit handler
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
      const token = localStorage.getItem('signageos_token');

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
        userEmail={userEmail}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeView={activeView}
          onNavigate={handleNavigate}
          onLogout={onLogout}
          onToggleSidebar={toggleSidebar}
          onSwitchToAdmin={onSwitchToAdmin}
          userEmail={userEmail}
        />

        {/* Pull to Refresh wrapper for mobile */}
        <PullToRefresh onRefresh={handleRefresh} enabled={isMobile}>
          <main className="flex-1 overflow-y-auto pb-20 md:pb-4">
            {renderView(activeView, handleNavigate, userEmail)}
          </main>
        </PullToRefresh>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <MobileDock activeView={activeView} onNavigate={handleNavigate} onLogout={onLogout} role="user" />

      {/* Expiration Paywall Modal Overlay */}
      {isPaywallOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
          <div className="relative w-full max-w-lg bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800 p-8 space-y-6 animate-scaleIn text-center">
            
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
              <Lock size={28} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">License Expired or Due</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Your organization's license access key has expired or requires renewal. Access to your displays and dashboard is temporarily paused until billing status is updated.
              </p>
            </div>

            {clientLicense && (
              <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Organization Name:</span>
                  <span className="font-semibold text-white">{clientLicense.assignedOrgName || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>License Tier:</span>
                  <span className="font-semibold text-blue-400">{(clientLicense as any).planType || (clientLicense as any).type || 'Standard'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Expiration Date:</span>
                  <span className="font-semibold text-amber-400">{clientLicense.expiryDate || 'Expired'}</span>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setIsPaywallOpen(false);
                  handleNavigate('licenses-pool');
                }}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                Renew License / View Billing
              </button>
              <button
                onClick={onLogout}
                className="py-3.5 px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all border border-slate-700 cursor-pointer"
              >
                Logout
              </button>
            </div>

          </div>
        </div>
      )}

      {/* First Time Login Password Reset & WhiteLabel Onboarding Modal */}
      {isFirstLogin && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
          <div className="relative w-full max-w-md bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800 p-8 space-y-6 animate-scaleIn">
            <div className="text-center space-y-2 py-2">
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto text-blue-500">
                <Lock size={20} />
              </div>
              <h2 className="text-xl font-bold">Welcome to SignageOS</h2>
              <p className="text-xs text-slate-400">
                Please set up your new secure password to activate your account portal.
              </p>
            </div>

            {passError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold text-center animate-shake">
                {passError}
              </div>
            )}

            {passSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold text-center flex items-center justify-center gap-2">
                <CheckCircle size={16} /> Account set up successfully! Redirecting...
              </div>
            ) : (
              <form onSubmit={handleFirstLoginSubmit} className="space-y-4">
                
                {isWhiteLabelEnabled && (
                  <div className="space-y-3 p-4 rounded-2xl bg-slate-850 border border-slate-800">
                    <span className="text-[10px] text-blue-400 uppercase tracking-widest font-black block">
                      White-Label Tenant Customization
                    </span>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-1">
                        Portal Display Name
                      </label>
                      <input
                        type="text"
                        value={firstTimeName}
                        onChange={(e) => {
                          setFirstTimeName(e.target.value);
                          localStorage.setItem('signageos_client_name', e.target.value);
                          window.dispatchEvent(new Event('signageos_branding_updated'));
                        }}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-1">
                        Company Logo
                      </label>
                      <div className="flex items-center gap-3">
                        {firstTimeLogo ? (
                          <img src={firstTimeLogo} className="w-9 h-9 rounded-lg object-contain bg-slate-800 p-1 border border-slate-700" alt="Logo" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                            <Image size={18} />
                          </div>
                        )}
                        <label className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition-colors">
                          Choose Logo File
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              handleFirstTimeLogoUpload(e);
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  localStorage.setItem('signageos_client_logo', reader.result as string);
                                  window.dispatchEvent(new Event('signageos_branding_updated'));
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1.5">
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
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1.5">
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
                  {passLoading ? 'Updating Password...' : 'Save & Enter Portal'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
