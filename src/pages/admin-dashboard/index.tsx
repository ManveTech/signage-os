import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';
import Sidebar from './components/Sidebar';
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
import LicenseDecoder from './views/LicenseDecoder';
import Settings from './views/Settings';
import Support from './views/Support';
import Profile from './views/Profile';
import ClientMedia from './views/ClientMedia';
import ClientPlaylists from './views/ClientPlaylists';
import { Lock, X, CheckCircle } from 'lucide-react';

function renderView(view: string, navigate: (v: string) => void) {
  switch (view) {
    case 'dashboard': return <Dashboard />;
    case 'client-screens': return <AllScreens onNavigate={navigate} />;
    
    // My Channel
    case 'my-media': return <MediaLibrary onNavigate={navigate} userEmail="admin@demo.com" />;
    case 'my-playlists': return <AllPlaylists onNavigate={navigate} userEmail="admin@demo.com" />;
    case 'my-create-playlist': return <CreatePlaylist userEmail="admin@demo.com" onNavigate={navigate} isMyChannel={true} />;
    
    // Client Oversight
    case 'client-media': return <ClientMedia />;
    case 'client-playlists': return <ClientPlaylists onNavigate={navigate} />;
    
    case 'my-screens-list': return <MyScreens onNavigate={navigate} userEmail="admin@demo.com" />;
    case 'screens-all': return <AllScreens onNavigate={navigate} />;
    case 'screens-add': return <AddScreen mode="client" onNavigate={navigate} />;
    case 'screens-add-client': return <AddScreen mode="client" onNavigate={navigate} />;
    case 'screens-add-my': return <AddScreen mode="my" onNavigate={navigate} />;
    case 'screens-assign': return <AssignScreens />;
    case 'screens-manage': return <ManageScreens />;
    case 'screens-groups-my': return <ScreenGroups mode="my" />;
    case 'screens-groups-all': return <ScreenGroups mode="all" />;
    case 'screens-logs': return <Logs userEmail="admin@demo.com" mode="my" />;
    case 'screens-logs-all': return <Logs userEmail="admin@demo.com" mode="all" />;
    case 'media-library': return <MediaLibrary onNavigate={navigate} userEmail="admin@demo.com" />;
    case 'media-upload': return <UploadMedia />;
    case 'media-layout': return <LayoutStudio />;
    case 'playlists-all': return <AllPlaylists onNavigate={navigate} userEmail="admin@demo.com" />;
    case 'playlists-create': return <CreatePlaylist userEmail="admin@demo.com" onNavigate={navigate} />;
    case 'playlists-scheduler': return <Scheduler userEmail="admin@demo.com" />;
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
    case 'settings-general': return <Settings activeTab="General" />;
    case 'settings-storage': return <Settings activeTab="Storage" />;
    case 'settings-player': return <Settings activeTab="Player Settings" />;
    case 'settings-notifications': return <Settings activeTab="Notifications" />;
    case 'support':
    case 'support-issues': return <Support activeTab="issues" onNavigate={navigate} />;
    case 'support-faq': return <Support activeTab="faq" onNavigate={navigate} />;
    case 'support-docs': return <Support activeTab="docs" onNavigate={navigate} />;
    case 'profile': return <Profile />;
    default: return <Dashboard />;
  }
}

export default function AdminDashboard({ onLogout, onSwitchToClient }: { onLogout: () => void; onSwitchToClient?: () => void }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          activeView={activeView} 
          onNavigate={setActiveView} 
          onLogout={onLogout} 
          onToggleSidebar={() => setSidebarCollapsed(p => !p)} 
          onSwitchToClient={onSwitchToClient}
        />
        <main className="flex-1 overflow-y-auto">
          {renderView(activeView, setActiveView)}
        </main>
      </div>

      {/* First Time Login Password Reset Modal */}
      {isFirstLogin && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
          <div className="relative w-full max-w-md bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800 p-8 space-y-6 animate-scaleIn">
            <div className="text-center space-y-2 py-4">
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto text-blue-500">
                <Lock size={20} />
              </div>
              <h2 className="text-lg font-black text-slate-100 uppercase tracking-tight">Security Update</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Welcome! As a first-time user, please change your password to secure your account.
              </p>
            </div>

            {passError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-semibold flex items-start gap-2">
                <X className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Password changed successfully! Redirecting...</span>
              </div>
            )}

            <form onSubmit={handleFirstLoginSubmit} className="space-y-4">
              <div className="group relative">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1.5">New Password</label>
                <div className="flex items-center relative rounded-lg bg-slate-950 border border-slate-850 transition-all duration-300 focus-within:border-blue-500 overflow-hidden">
                  <div className="w-1.5 self-stretch bg-blue-500" />
                  <input 
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new secure password"
                    className="w-full py-3 px-4 text-xs font-semibold text-white placeholder-slate-600 focus:outline-none bg-transparent"
                    required
                  />
                </div>
              </div>

              <div className="group relative">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1.5">Confirm Password</label>
                <div className="flex items-center relative rounded-lg bg-slate-950 border border-slate-855 transition-all duration-300 focus-within:border-blue-500 overflow-hidden">
                  <div className="w-1.5 self-stretch bg-blue-500" />
                  <input 
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm secure password"
                    className="w-full py-3 px-4 text-xs font-semibold text-white placeholder-slate-600 focus:outline-none bg-transparent"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={passLoading || passSuccess}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/10 cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passLoading ? 'Updating...' : 'Update Password & Enter'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
