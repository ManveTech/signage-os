import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config';
import { USER_ROUTES, getUserViewFromPath } from '../../lib/routes';
import MobileDock from '../../components/MobileDock';
import SectionTransition from '../../components/SectionTransition';
import { getPendingPairCode } from '../../lib/pendingPair';
import { runTour } from '../../lib/tour/runner';
import { getUserTourSteps } from '../../lib/tour/userTour';
import { hasSeenTour, markTourSeen } from '../../lib/tour/state';
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
import ScreenGroups from './views/screens/ScreenGroups';
import Logs from './views/screens/Logs';
import MediaLibrary from './views/media/MediaLibrary';
import AllPlaylists from './views/playlists/AllPlaylists';
import CreatePlaylist from './views/playlists/CreatePlaylist';
import Scheduler from './views/playlists/Scheduler';
import Reports from './views/Reports';
import Licenses from './views/Licenses';
import VideoConferencing from './views/VideoConferencing';
import Settings from './views/Settings';
import Support from './views/Support';
import Profile from './views/Profile';
import { licensingStore, License } from '../../lib/licensingStore';
import { licenseAccess, bestLicense, formatDate, formatInr, LicenseAccess } from '../../components/licenses/licenseStatus';
import { syncCollection, pushToDatabase } from '../../lib/syncHelper';
import { X, CheckCircle, Lock, Image, AlertTriangle, MonitorPlay, LifeBuoy } from 'lucide-react';
import { getAuthToken } from '../../lib/authStorage';


function renderView(view: string, navigate: (v: string) => void, userEmail: string, videoConferencingEnabled: boolean, organizationId: string, licenseChecked: boolean) {
  switch (view) {
    case 'dashboard': return <Dashboard userEmail={userEmail} onNavigate={navigate} />;
    case 'my-screens-list': return <MyScreens onNavigate={navigate} userEmail={userEmail} />;
    case 'screens-all': return <AllScreens onNavigate={navigate} userEmail={userEmail} />;
    case 'screens-add': return <AddScreen userEmail={userEmail} onNavigate={navigate} />;
    case 'screens-manage': return <MyScreens onNavigate={navigate} userEmail={userEmail} />;
    case 'screens-groups': return <ScreenGroups userEmail={userEmail} onNavigate={navigate} />;
    case 'screens-logs': return <Logs userEmail={userEmail} mode="my" onNavigate={navigate} />;
    case 'media-library': return <MediaLibrary onNavigate={navigate} userEmail={userEmail} />;
    case 'playlists-all': return <AllPlaylists onNavigate={navigate} userEmail={userEmail} />;
    case 'playlists-create': return <CreatePlaylist userEmail={userEmail} onNavigate={navigate} />;
    case 'playlists-scheduler': return <Scheduler userEmail={userEmail} />;
    case 'reports-overview': return <Reports activeTab="Overview" userEmail={userEmail} onNavigate={navigate} />;
    case 'reports-screens': return <Reports activeTab="Screen Reports" userEmail={userEmail} onNavigate={navigate} />;
    case 'reports-media': return <Reports activeTab="Media Reports" userEmail={userEmail} onNavigate={navigate} />;
    case 'reports-logs': return <Reports activeTab="Device Logs" userEmail={userEmail} onNavigate={navigate} />;
    case 'license-billing':
    case 'licenses-pool': return <Licenses activeTab="License Pool" userEmail={userEmail} onNavigate={navigate} />;
    case 'licenses-assign': return <Licenses activeTab="Assign License" userEmail={userEmail} onNavigate={navigate} />;
    case 'licenses-history': return <Licenses activeTab="History" userEmail={userEmail} onNavigate={navigate} />;
    case 'video-conferencing': return <VideoConferencing enabled={videoConferencingEnabled} organizationId={organizationId} licenseChecked={licenseChecked} userEmail={userEmail} />;
    case 'settings-general': return <Settings userEmail={userEmail} />;
    // Storage config is an admin/platform concern, never reachable from this
    // dashboard's own nav — redirect any old link/bookmark to General.
    // Old bookmarks for the removed placeholder tabs.
    case 'settings-storage':
    case 'settings-player':
    case 'settings-notifications': return <Settings userEmail={userEmail} />;
    case 'support':
    case 'support-tickets': return <Support activeTab="tickets" userEmail={userEmail} onNavigate={navigate} />;
    case 'support-help': return <Support activeTab="help" userEmail={userEmail} onNavigate={navigate} />;
    case 'profile': return <Profile userEmail={userEmail} onNavigate={navigate} />;
    default: return <Dashboard userEmail={userEmail} onNavigate={navigate} />;
  }
}

export default function UserDashboard({ onLogout, userEmail = 'priya@demo.com', onSwitchToAdmin }: { onLogout: () => void; userEmail?: string; onSwitchToAdmin?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useMobileDetect();
  const { isNative } = useCapacitor();
  const mainRef = useRef<HTMLElement>(null);

  // Active view is derived directly from the URL pathname
  const activeView = getUserViewFromPath(location.pathname);
  // The sidebar only exists on tablet/desktop (phones use the bottom dock),
  // so this is purely the desktop preference: your saved choice, or
  // collapsed by default on narrower screens.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('signageos_sidebar_collapsed_v2');
    if (saved !== null) return saved === 'true';
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('signageos_sidebar_collapsed_v2', String(next));
      return next;
    });
  };

  const [clientLicense, setClientLicense] = useState<License | null>(() => {
    const licenses = licensingStore.getLicenses();
    return licenses.find(l => l.assignedUserEmail === userEmail) || null;
  });
  const [licenseChecked, setLicenseChecked] = useState(false);

  // Signed in from a TV's pairing QR? Continue straight to Add screen.
  useEffect(() => {
    if (getPendingPairCode() && !activeView.startsWith('screens-add')) handleNavigate('screens-add');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavigate = (targetView: string) => {
    const targetPath = USER_ROUTES[targetView] || `/${targetView}`;
    navigate(targetPath);
  };

  // Pull to refresh handler
  const handleRefresh = async () => {
    try {
      await syncAllFromDatabase({ force: true });
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
      syncAllFromDatabase({ force: true }).then(() => {
        checkLicense();
      }).catch(console.error);
    };

    window.addEventListener('app-resumed', handleAppResumed);
    return () => window.removeEventListener('app-resumed', handleAppResumed);
  }, [isNative]);

  // First-run orientation tour — see the matching effect in
  // admin-dashboard/index.tsx for why this only fires on the dashboard route
  // and only once per account.
  useEffect(() => {
    if (activeView !== 'dashboard') return;
    if (getPendingPairCode()) return; // pairing a TV first — the tour can wait
    if (hasSeenTour('user-dashboard', userEmail)) return;
    const timer = setTimeout(() => {
      runTour({
        steps: getUserTourSteps(),
        navigate,
        onFinish: () => markTourSeen('user-dashboard', userEmail)
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

  // The newest licence decides access (same rule as the server).
  const checkLicense = () => {
    const mine = licensingStore.getLicenses().filter(l => l.assignedUserEmail === userEmail);
    setClientLicense(bestLicense(mine as any[]) as License | null);
    setLicenseChecked(true);
  };

  useEffect(() => {
    Promise.all([
      syncCollection('licenses', 'signageos_licenses'),
      // /users is admin-only — the org is matched by licence below.
      syncCollection('organizations', 'signageos_organizations')
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

  // Re-check the licence when it may have changed: another tab, a payment
  // on the Billing page, or moving between pages.
  useEffect(() => {
    const recheck = () => checkLicense();
    window.addEventListener('storage', recheck);
    window.addEventListener('signageos_license_updated', recheck);
    return () => {
      window.removeEventListener('storage', recheck);
      window.removeEventListener('signageos_license_updated', recheck);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);
  useEffect(() => { checkLicense(); setTeamPaused(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeView]);

  // No licence of their own: a team member whose organisation's plan is
  // paused, or a client with no plan at all — learned from the server's 402.
  const [teamPaused, setTeamPaused] = useState<false | string>(false);
  useEffect(() => {
    const onPaused = (e: Event) => setTeamPaused((e as CustomEvent).detail?.reason || 'expired');
    window.addEventListener('signageos_license_paused', onPaused);
    return () => window.removeEventListener('signageos_license_paused', onPaused);
  }, []);

  const access = clientLicense ? licenseAccess(clientLicense as any) : null;
  // While paused, these stay usable so the client can pay or get help.
  const OPEN_WHEN_PAUSED = ['license-billing', 'support', 'support-tickets', 'support-help', 'profile', 'settings-general'];
  const paused = !!access && access.state === 'blocked' && !OPEN_WHEN_PAUSED.includes(activeView);
  const showTeamPaused = !clientLicense && licenseChecked && teamPaused && !OPEN_WHEN_PAUSED.includes(activeView);

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
          <main ref={mainRef} className="flex-1 overflow-y-auto pb-20 md:pb-4">
            {access && access.state !== 'ok' && activeView !== 'license-billing' && !paused && (
              <LicenseBanner access={access} price={clientLicense?.price || 0} onRenew={() => handleNavigate('license-billing')} />
            )}
            <SectionTransition viewKey={paused ? 'paused' : showTeamPaused ? 'team-paused' : activeView} scrollRoot={mainRef} className="sg-page">
              {paused && access
                ? <PausedScreen access={access} license={clientLicense!} onRenew={() => handleNavigate('license-billing')} onHelp={() => handleNavigate('support-tickets')} />
                : showTeamPaused
                ? <TeamPausedScreen noPlan={teamPaused === 'no_license'} onHelp={() => handleNavigate('support-tickets')} />
                : renderView(activeView, handleNavigate, userEmail, !!clientLicense?.enableVideoConferencing, clientLicense?.assignedOrgId || '', licenseChecked)}
            </SectionTransition>
          </main>
        </PullToRefresh>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <MobileDock activeView={activeView} onNavigate={handleNavigate} onLogout={onLogout} role="user" />

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
                  <div className="space-y-3 p-4 rounded-2xl bg-slate-800 border border-slate-800">
                    <span className="text-[10px] text-blue-400 uppercase tracking-widest font-bold block">
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

/** Shown on every page during the grace period (and before a first payment is due). */
function LicenseBanner({ access, price, onRenew }: { access: LicenseAccess; price: number; onRenew: () => void }) {
  const text = access.state === 'grace'
    ? `Your plan expired. Renew by ${formatDate(access.graceEnds || '')} to keep using the dashboard — ${access.graceDaysLeft === 0 ? 'today is the last day' : `${access.graceDaysLeft} day${access.graceDaysLeft === 1 ? '' : 's'} left`}. Your screens keep playing.`
    : 'Your plan needs payment.';
  return (
    <div className="mx-4 sm:mx-6 mt-4 flex items-start sm:items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle size={17} className="shrink-0 mt-0.5 sm:mt-0 text-amber-600" />
      <p className="flex-1 min-w-0">{text}</p>
      <button onClick={onRenew} className="shrink-0 h-9 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
        Renew{price ? ` · ${formatInr(price)}` : ''}
      </button>
    </div>
  );
}

/** No licence of their own: a team member of a paused organisation, or a client with no plan. */
function TeamPausedScreen({ noPlan, onHelp }: { noPlan: boolean; onHelp: () => void }) {
  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-md mx-auto mt-4 sm:mt-10 bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto"><Lock size={24} /></div>
        <h1 className="text-lg font-semibold text-slate-900 mt-4">{noPlan ? "You don't have an active plan" : "Your organisation's plan is paused"}</h1>
        <p className="text-sm text-slate-500 mt-1.5">{noPlan
          ? "Contact us to get a plan — your dashboard opens as soon as it's set up."
          : "Ask your account owner to renew it — you'll be back in as soon as they do."}</p>
        <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 mt-3">
          <MonitorPlay size={14} /> Your screens keep playing in the meantime.
        </p>
        <button onClick={onHelp} className="mt-6 w-full h-11 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5">
          <LifeBuoy size={15} /> Ask for help
        </button>
      </div>
    </div>
  );
}

/** Replaces every page except Billing, Help and Profile while access is paused. */
function PausedScreen({ access, license, onRenew, onHelp }: { access: LicenseAccess; license: License; onRenew: () => void; onHelp: () => void }) {
  const first = access.reason === 'first_payment';
  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-md mx-auto mt-4 sm:mt-10 bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto"><Lock size={24} /></div>
        <h1 className="text-lg font-semibold text-slate-900 mt-4">{first ? 'Pay your first invoice to get started' : 'Your dashboard is paused'}</h1>
        <p className="text-sm text-slate-500 mt-1.5">
          {first
            ? 'Your licence is ready. It starts the day you pay and runs for a full period from then.'
            : `Your plan expired on ${formatDate(license.expiryDate)} and the ${7}-day grace period has ended. Renew to get back in straight away.`}
        </p>
        <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 mt-3">
          <MonitorPlay size={14} /> Your screens keep playing in the meantime.
        </p>
        <button onClick={onRenew} className="mt-6 w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
          {first ? 'Pay' : 'Renew'} {license.price ? formatInr(license.price) : ''}
        </button>
        <button onClick={onHelp} className="mt-2 w-full h-11 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5">
          <LifeBuoy size={15} /> Ask for help
        </button>
      </div>
    </div>
  );
}
