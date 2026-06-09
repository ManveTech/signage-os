import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './views/Dashboard';
import AllScreens from './views/screens/AllScreens';
import MyScreens from './views/screens/MyScreens';
import AddScreen from './views/screens/AddScreen';
import AssignScreens from './views/screens/AssignScreens';
import ManageScreens from './views/screens/ManageScreens';
import ScreenGroups from './views/screens/ScreenGroups';
import HealthLogs from './views/screens/HealthLogs';
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
import LicenseBillingView from './views/LicenseBillingView';

import { licensingStore, License } from '../../lib/licensingStore';
import { X, CheckCircle, Key } from 'lucide-react';

function renderView(view: string, navigate: (v: string) => void, userEmail: string) {
  switch (view) {
    case 'dashboard': return <Dashboard userEmail={userEmail} />;
    case 'my-screens-list': return <MyScreens onNavigate={navigate} userEmail={userEmail} />;
    case 'screens-all': return <AllScreens onNavigate={navigate} />;
    case 'screens-add': return <AddScreen userEmail={userEmail} onNavigate={navigate} />;
    case 'screens-assign': return <AssignScreens />;
    case 'screens-manage': return <ManageScreens />;
    case 'screens-groups': return <ScreenGroups userEmail={userEmail} />;
    case 'screens-health': return <HealthLogs />;
    case 'media-library': return <MediaLibrary onNavigate={navigate} userEmail={userEmail} />;
    case 'media-upload': return <UploadMedia />;
    case 'media-layout': return <LayoutStudio />;
    case 'playlists-all': return <AllPlaylists onNavigate={navigate} userEmail={userEmail} />;
    case 'playlists-create': return <CreatePlaylist userEmail={userEmail} />;
    case 'playlists-scheduler': return <Scheduler />;
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
    case 'license-billing': return <LicenseBillingView userEmail={userEmail} />;
    default: return <Dashboard userEmail={userEmail} />;
  }
}

export default function UserDashboard({ onLogout, userEmail = 'priya@demo.com', onSwitchToAdmin }: { onLogout: () => void; userEmail?: string; onSwitchToAdmin?: () => void }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [clientLicense, setClientLicense] = useState<License | null>(null);

  // Razorpay Checkout states inside paywall
  const [isRzpOpen, setIsRzpOpen] = useState(false);
  const [rzpStep, setRzpStep] = useState<'methods' | 'processing' | 'success'>('methods');
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | null>(null);

  // First time login states
  const [isFirstLogin, setIsFirstLogin] = useState(() => localStorage.getItem('signageos_first_time_login') === 'true');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

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
    checkLicense();
  }, [userEmail]);

  // Keep checking license state on view changes
  useEffect(() => {
    const handleStorageChange = () => {
      checkLicense();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [userEmail]);

  // Real Razorpay Payment checkout logic
  const handleInitiateRealPayment = async () => {
    try {
      if (!clientLicense) return;
      setRzpStep('processing');
      setIsRzpOpen(true);

      const token = localStorage.getItem('signageos_token');
      const response = await fetch('http://localhost:5000/api/v1/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ licenseId: clientLicense.id })
      });

      if (!response.ok) {
        throw new Error('Failed to create order on server');
      }

      const orderData = await response.json();

      if ((window as any).Razorpay) {
        const options = {
          key: orderData.razorpayKeyId || 'rzp_live_demo83920194',
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'SignageOS Technologies',
          description: `License Reactivation for ${clientLicense.name}`,
          order_id: orderData.orderId,
          handler: async function (response: any) {
            setRzpStep('processing');
            try {
              const verifyRes = await fetch('http://localhost:5000/api/v1/payments/verify', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpaySignature: response.razorpay_signature,
                  licenseId: clientLicense.id
                })
              });

              if (verifyRes.ok) {
                setRzpStep('success');
                const durationDays = clientLicense.tenure === 'monthly' ? 30 : 365;
                const today = new Date();
                today.setDate(today.getDate() + durationDays);
                const newExpiry = today.toISOString().split('T')[0];

                licensingStore.updateLicense(clientLicense.id, {
                  status: 'active',
                  expiryDate: newExpiry
                });

                setTimeout(() => {
                  setIsRzpOpen(false);
                  setIsPaywallOpen(false);
                  checkLicense();
                }, 1500);
              } else {
                const err = await verifyRes.json().catch(() => ({}));
                alert(`Payment verification failed: ${err.message || 'Signature mismatch'}`);
                setRzpStep('methods');
                setIsRzpOpen(false);
              }
            } catch (err) {
              console.error(err);
              alert('Network error verifying payment.');
              setRzpStep('methods');
              setIsRzpOpen(false);
            }
          },
          prefill: {
            email: userEmail
          },
          theme: {
            color: '#2563EB'
          },
          modal: {
            ondismiss: function() {
              setIsRzpOpen(false);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Fallback to simulated UI
        setRzpStep('methods');
      }
    } catch (error: any) {
      console.error('Error initiating payment:', error);
      alert('Failed to initiate payment. Please try again.');
      setIsRzpOpen(false);
    }
  };

  // Connected simulated pay success
  const handlePaySuccess = async () => {
    if (!clientLicense) return;
    setRzpStep('processing');

    const token = localStorage.getItem('signageos_token');
    const razorpayPaymentId = 'pay_' + Math.random().toString(36).substring(2, 11);
    const razorpayOrderId = 'order_' + Math.random().toString(36).substring(2, 11);

    try {
      const verifyRes = await fetch('http://localhost:5000/api/v1/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          razorpayPaymentId,
          razorpayOrderId,
          razorpaySignature: 'simulated_sig',
          licenseId: clientLicense.id
        })
      });

      if (verifyRes.ok) {
        setRzpStep('success');
        
        const durationDays = clientLicense.tenure === 'monthly' ? 30 : 365;
        const today = new Date();
        today.setDate(today.getDate() + durationDays);
        const newExpiry = today.toISOString().split('T')[0];

        licensingStore.updateLicense(clientLicense.id, {
          status: 'active',
          expiryDate: newExpiry
        });

        // Trigger local invoices sync (simulate locally for frontend store fallback too)
        const invoices = licensingStore.getInvoices();
        const unpaidInv = invoices.find(i => i.licenseId === clientLicense.id && i.status === 'unpaid');
        const amountWithGst = Math.round(clientLicense.price * 1.18);
        if (unpaidInv) {
          const updatedInvoices = invoices.map(i => 
            i.id === unpaidInv.id ? { ...i, status: 'paid' as const } : i
          );
          licensingStore.saveInvoices(updatedInvoices);
        } else {
          licensingStore.addInvoice({
            id: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            licenseId: clientLicense.id,
            licenseName: clientLicense.name,
            clientName: userEmail.split('@')[0],
            clientEmail: userEmail,
            amount: amountWithGst,
            dueDate: newExpiry,
            status: 'paid',
            issuedDate: new Date().toISOString().split('T')[0]
          });
        }

        setTimeout(() => {
          setIsRzpOpen(false);
          setIsPaywallOpen(false);
          checkLicense();
        }, 1500);
      } else {
        alert('Simulated payment verification failed on server.');
        setRzpStep('methods');
      }
    } catch (err) {
      console.error(err);
      setRzpStep('methods');
    }
  };

  const handleReactivateClick = () => {
    if ((window as any).Razorpay) {
      handleInitiateRealPayment();
    } else {
      setIsRzpOpen(true);
      setRzpStep('methods');
    }
  };

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

      const res = await fetch(`http://localhost:5000/api/v1/users/${userId}`, {
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

  if (isPaywallOpen && clientLicense) {
    return (
      <div className="flex h-screen w-full bg-slate-950 text-white items-center justify-center p-6 text-left relative overflow-hidden select-none">
        {/* Decorator background */}
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          <svg className="absolute inset-0 w-full h-full" width="100%" height="100%">
            <pattern id="paywall-grid-pattern" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#paywall-grid-pattern)" />
          </svg>
        </div>

        <div className="relative w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 p-8 space-y-6 z-10 animate-scaleIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold font-mono">SO</div>
              <span className="font-extrabold text-sm text-slate-100 tracking-tight">SignageOS</span>
            </div>
            <button 
              onClick={onLogout}
              className="text-xs uppercase font-extrabold text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Sign Out
            </button>
          </div>

          <div className="space-y-2 text-center py-4">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-500">
              <Key size={20} />
            </div>
            <h2 className="text-lg font-black text-slate-100 uppercase tracking-tight">Access Suspended</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Your license profile <span className="font-mono text-slate-200 font-bold">{clientLicense.id}</span> is currently unpaid or expired.
            </p>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-450">Plan Name</span>
              <span className="font-bold text-slate-200">{clientLicense.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-455">Billing tenure</span>
              <span className="font-bold text-slate-200 capitalize">{clientLicense.tenure}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-455">Cycle Price</span>
              <span className="font-bold text-slate-200">₹{clientLicense.price.toLocaleString()}</span>
            </div>
            <hr className="border-slate-800" />
            <div className="flex justify-between items-baseline">
              <span className="text-slate-455">Total Due (with 18% GST)</span>
              <span className="text-lg font-black text-blue-400">₹{(clientLicense.price * 1.18).toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={handleReactivateClick}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/10 cursor-pointer text-center"
          >
            Pay & Reactivate
          </button>
        </div>

        {/* Razorpay simulated modal popup inside paywall */}
        {isRzpOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="w-full max-w-sm bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800 animate-scaleIn">
              <div className="bg-[#111827] px-4 py-3.5 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-[10px] font-black italic text-white">R</div>
                  <div>
                    <p className="text-[10px] font-black tracking-wider uppercase text-slate-300">Razorpay Checkout</p>
                    <p className="text-[8px] text-slate-400">SignageOS Technologies Ltd.</p>
                  </div>
                </div>
                <button onClick={() => setIsRzpOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={14} /></button>
              </div>

              {rzpStep === 'methods' && (
                <div className="p-5 space-y-4 text-left">
                  <div className="text-center py-2 bg-slate-800/40 rounded-xl border border-slate-800">
                    <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Total Payable Amount</p>
                    <p className="text-2xl font-black mt-0.5 text-blue-400">₹{(clientLicense.price * 1.18).toLocaleString()}</p>
                    <p className="text-[8px] text-slate-400 font-medium">Includes 18% GST (₹{(clientLicense.price * 0.18).toLocaleString()})</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] text-slate-450 uppercase tracking-widest font-black block">Select Payment Method</p>
                    <button 
                      onClick={() => setSelectedMethod('upi')}
                      className={`w-full p-3 rounded-xl border text-left transition-colors flex items-center justify-between cursor-pointer ${
                        selectedMethod === 'upi' ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-100">UPI — Paytm / Google Pay</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Pay instantly via QR code or phone number</p>
                      </div>
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-400 flex items-center justify-center">
                        {selectedMethod === 'upi' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                      </span>
                    </button>
                    <button 
                      onClick={() => setSelectedMethod('card')}
                      className={`w-full p-3 rounded-xl border text-left transition-colors flex items-center justify-between cursor-pointer ${
                        selectedMethod === 'card' ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-100">Credit / Debit Card</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Visa, Mastercard, RuPay, Maestro</p>
                      </div>
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-400 flex items-center justify-center">
                        {selectedMethod === 'card' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                      </span>
                    </button>
                  </div>

                  <button 
                    disabled={!selectedMethod}
                    onClick={handlePaySuccess}
                    className={`w-full py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedMethod 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20' 
                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    Pay Securely via Razorpay
                  </button>
                </div>
              )}

              {rzpStep === 'processing' && (
                <div className="p-8 text-center space-y-4">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-bold text-slate-100">Processing Payment...</p>
                </div>
              )}

              {rzpStep === 'success' && (
                <div className="p-8 text-center space-y-4">
                  <CheckCircle size={32} className="text-emerald-400 mx-auto animate-pulse" />
                  <p className="text-sm font-bold text-slate-100 font-mono">Payment Succeeded!</p>
                </div>
              )}

              <div className="bg-[#111827] py-2 border-t border-slate-800 text-center text-[8px] text-slate-500 font-mono">
                SECURE 256-BIT SSL ENCRYPTION
              </div>
            </div>
          </div>
        )}
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
