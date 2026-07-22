import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';
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
    case 'screens-groups': return <ScreenGroups userEmail={userEmail} />;
    case 'screens-logs': return <Logs userEmail={userEmail} mode="my" />;
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
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [clientLicense, setClientLicense] = useState<License | null>(null);

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
        if (isWhiteLabelEnabled) {
          localStorage.setItem('signageos_client_logo', firstTimeLogo);
          localStorage.setItem('signageos_client_name', firstTimeName);
          window.dispatchEvent(new Event('signageos_branding_updated'));

          // Save branding details to the database organization record
          try {
            const orgsData = localStorage.getItem('signageos_organizations');
            const orgs = orgsData ? JSON.parse(orgsData) : [];
            const usersData = localStorage.getItem('signageos_users');
            const users = usersData ? JSON.parse(usersData) : [];
            const currentUser = users.find((u: any) => u.email === userEmail);
            const myOrg = orgs.find((o: any) => o.id === clientLicense?.assignedOrgId || o.name === clientLicense?.assignedOrgName || o.name === currentUser?.company);
            if (myOrg) {
              const updatedOrg = {
                ...myOrg,
                websiteLogo: firstTimeLogo,
                websiteName: firstTimeName
              };
              pushToDatabase('organizations', myOrg.id, updatedOrg, 'PUT').then(oRes => {
                if (oRes.ok && oRes.data) {
                  const updatedOrgs = orgs.map((o: any) => o.id === myOrg.id ? oRes.data : o);
                  localStorage.setItem('signageos_organizations', JSON.stringify(updatedOrgs));
                }
              });
            }
          } catch (orgErr) {
            console.error('Failed to save first-time branding to database:', orgErr);
          }
        }
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

  if (isPaywallOpen && clientLicense) {
    return (
      <div className="flex h-screen w-full bg-slate-100 items-center justify-center p-6 text-left relative overflow-hidden select-none">
        {/* Subtle grid background */}
        <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden z-0">
          <svg className="absolute inset-0 w-full h-full" width="100%" height="100%">
            <pattern id="paywall-grid-pattern" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(15, 23, 42, 0.04)" strokeWidth="1" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#paywall-grid-pattern)" />
          </svg>
        </div>

        <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 z-10 animate-scaleIn">
          {/* Blue gradient header strip */}
          <div className="bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-xs font-black font-mono border border-white/30">SO</div>
              <span className="font-black text-sm text-white tracking-tight">SignageOS Portal</span>
            </div>
            <button
              onClick={onLogout}
              className="text-[11px] uppercase font-black text-white/70 hover:text-white cursor-pointer tracking-wider transition-colors"
            >
              Sign Out
            </button>
          </div>

          <div className="p-8 space-y-6">
            {/* Icon + heading */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">License Expired</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  License <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{clientLicense.id}</span> is unpaid or expired.
                </p>
              </div>
            </div>

            {/* License details table */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100">
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-xs text-slate-500 font-semibold">Plan Name</span>
                  <span className="text-xs font-bold text-slate-800">{clientLicense.name}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-xs text-slate-500 font-semibold">Billing Tenure</span>
                  <span className="text-xs font-bold text-slate-800 capitalize">{clientLicense.tenure}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-xs text-slate-500 font-semibold">Expiry Date</span>
                  <span className="text-xs font-bold text-rose-600">{clientLicense.expiryDate || 'Expired'}</span>
                </div>
              </div>
            </div>

            {/* Admin contact notice — no payment UI for users */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-600 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <div>
                <p className="text-xs font-bold text-blue-900">Contact your administrator</p>
                <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                  Your license has expired or is pending payment. Please reach out to your system administrator to renew or reactivate your subscription.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden text-left relative">
      {!sidebarCollapsed && (
        <div 
          onClick={() => setSidebarCollapsed(true)} 
          className="fixed inset-0 bg-black/40 z-40 md:hidden animate-fadeIn" 
        />
      )}
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(p => !p)}
        onLogout={onLogout}
        userEmail={userEmail}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          activeView={activeView} 
          onNavigate={setActiveView} 
          onLogout={onLogout} 
          userEmail={userEmail} 
          onToggleSidebar={() => setSidebarCollapsed(p => !p)} 
          onSwitchToAdmin={onSwitchToAdmin}
        />
        <main className="flex-1 overflow-y-auto">
          {renderView(activeView, setActiveView, userEmail)}
        </main>
      </div>

      {/* First Time Login Password Reset Modal */}
      {isFirstLogin && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
          <div className={`relative w-full ${isWhiteLabelEnabled ? 'max-w-2xl' : 'max-w-md'} bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 animate-scaleIn`}>
            {/* Blue header strip */}
            <div className="bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 px-8 py-6 text-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl flex items-center justify-center">
                  <Lock size={18} className="text-white" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-200 block">First-Time Setup</span>
                  <h2 className="text-lg font-black text-white uppercase tracking-tight leading-none">
                    {isWhiteLabelEnabled ? 'Security & Brand Customization' : 'Security Update'}
                  </h2>
                </div>
              </div>
              <p className="text-white/75 text-[11px] leading-relaxed">
                Welcome! Please configure your account credentials {isWhiteLabelEnabled ? 'and custom website branding settings' : ''} to get started.
              </p>
            </div>

            <div className="p-8 space-y-6">
              {passError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-600 font-semibold flex items-start gap-2">
                  <X className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold block">Error:</span>
                    {passError}
                  </div>
                </div>
              )}

              {passSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-600 font-semibold flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold block">Success:</span>
                    Account setup completed! Redirecting to your dashboard...
                  </div>
                </div>
              )}

              <form onSubmit={handleFirstLoginSubmit} className="space-y-6">
                <div className={isWhiteLabelEnabled ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-4'}>
                  {/* Left Column: Password Fields */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Security Credentials</p>
                    <div className="group relative">
                      <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1.5">New Password</label>
                      <div className="flex items-center relative rounded-lg bg-slate-50 border border-slate-200 transition-all duration-300 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 overflow-hidden">
                        <div className="w-1.5 self-stretch bg-blue-500" />
                        <div className="pl-3.5 pr-2.5 text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Enter new secure password"
                          className="w-full py-3.5 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-350 focus:outline-none bg-transparent"
                          required
                        />
                      </div>
                    </div>

                    <div className="group relative">
                      <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1.5">Confirm Password</label>
                      <div className="flex items-center relative rounded-lg bg-slate-50 border border-slate-200 transition-all duration-300 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 overflow-hidden">
                        <div className="w-1.5 self-stretch bg-blue-500" />
                        <div className="pl-3.5 pr-2.5 text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Confirm secure password"
                          className="w-full py-3.5 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-350 focus:outline-none bg-transparent"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Custom Branding (White-Label only) */}
                  {isWhiteLabelEnabled && (
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Website Branding</p>
                      
                      <div className="flex items-center gap-4">
                        {firstTimeLogo ? (
                          <div className="relative w-16 h-16 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center group">
                            <img src={firstTimeLogo} alt="Logo preview" className="w-full h-full object-contain" />
                            <button
                              type="button"
                              onClick={() => setFirstTimeLogo('')}
                              className="absolute inset-0 bg-rose-600/90 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold uppercase tracking-wider transition-opacity cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                            <Image size={20} className="text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] font-bold text-gray-900">Website Logo</p>
                          <label className="mt-1.5 inline-block px-2.5 py-1 text-[10px] text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer font-semibold select-none">
                            Upload Logo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleFirstTimeLogoUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="group relative">
                        <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1.5">Website Name</label>
                        <div className="flex items-center relative rounded-lg bg-slate-50 border border-slate-200 transition-all duration-300 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 overflow-hidden">
                          <div className="w-1.5 self-stretch bg-blue-500" />
                          <input
                            type="text"
                            value={firstTimeName}
                            onChange={e => setFirstTimeName(e.target.value)}
                            placeholder="e.g. My Signage Network"
                            className="w-full py-3.5 px-4 text-xs font-semibold text-slate-800 placeholder-slate-350 focus:outline-none bg-transparent"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={passLoading || passSuccess}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 shadow-md shadow-blue-500/20 cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {passLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving and Configuring...
                    </>
                  ) : (
                    'Save Settings & Launch Portal'
                  )}
                </button>
              </form>

              <p className="text-[9px] text-slate-400 text-center">Designed for SignageOS Technologies Ltd. © 2026.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
