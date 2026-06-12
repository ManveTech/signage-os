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
import { X, CheckCircle, Key, Lock } from 'lucide-react';

function renderView(view: string, navigate: (v: string) => void, userEmail: string) {
  switch (view) {
    case 'dashboard': return <Dashboard userEmail={userEmail} />;
    case 'my-screens-list': return <MyScreens onNavigate={navigate} userEmail={userEmail} />;
    case 'screens-all': return <AllScreens onNavigate={navigate} userEmail={userEmail} />;
    case 'screens-add': return <AddScreen userEmail={userEmail} onNavigate={navigate} />;
    case 'screens-assign': return <AssignScreens />;
    case 'screens-manage': return <ManageScreens userEmail={userEmail} />;
    case 'screens-groups': return <ScreenGroups userEmail={userEmail} />;
    case 'screens-health': return <HealthLogs />;
    case 'media-library': return <MediaLibrary onNavigate={navigate} userEmail={userEmail} />;
    case 'media-upload': return <UploadMedia />;
    case 'media-layout': return <LayoutStudio />;
    case 'playlists-all': return <AllPlaylists onNavigate={navigate} userEmail={userEmail} />;
    case 'playlists-create': return <CreatePlaylist userEmail={userEmail} onNavigate={navigate} />;
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
  const [paymentLoading, setPaymentLoading] = useState(false);

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
      setPaymentLoading(true);

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
            setPaymentLoading(true);
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
                const durationDays = clientLicense.tenure === 'monthly' ? 30 : 365;
                const today = new Date();
                today.setDate(today.getDate() + durationDays);
                const newExpiry = today.toISOString().split('T')[0];

                licensingStore.updateLicense(clientLicense.id, {
                  status: 'active',
                  expiryDate: newExpiry
                });

                setIsPaywallOpen(false);
                checkLicense();
              } else {
                const err = await verifyRes.json().catch(() => ({}));
                alert(`Payment verification failed: ${err.message || 'Signature mismatch'}`);
              }
            } catch (err) {
              console.error(err);
              alert('Network error verifying payment.');
            } finally {
              setPaymentLoading(false);
            }
          },
          prefill: {
            email: userEmail
          },
          theme: {
            color: '#0EA5E9'
          },
          modal: {
            ondismiss: function() {
              setPaymentLoading(false);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        setPaymentLoading(false);
        rzp.open();
      } else {
        // Fallback to simulated UI
        setPaymentLoading(false);
        setIsRzpOpen(true);
        setRzpStep('methods');
      }
    } catch (error: any) {
      console.error('Error initiating payment:', error);
      alert('Failed to initiate payment. Please try again.');
      setPaymentLoading(false);
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
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-rose-500">
                <Key size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Access Suspended</h2>
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
                  <span className="text-xs text-slate-500 font-semibold">Cycle Price</span>
                  <span className="text-xs font-bold text-slate-800">₹{clientLicense.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3 bg-blue-50/60">
                  <span className="text-xs text-blue-700 font-black uppercase tracking-wider">Total Due (Testing Mode)</span>
                  <span className="text-lg font-black text-blue-600">₹1</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleReactivateClick}
              disabled={paymentLoading}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 shadow-md shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {paymentLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Initiating Checkout...
                </>
              ) : (
                'Pay & Reactivate License'
              )}
            </button>
          </div>
        </div>

        {/* Razorpay simulated modal popup */}
        {isRzpOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 animate-scaleIn">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-[11px] font-black italic text-white">R</div>
                  <div>
                    <p className="text-[10px] font-black tracking-wider uppercase text-white">Razorpay Checkout</p>
                    <p className="text-[8.5px] text-white/70 font-medium">SignageOS Technologies Ltd.</p>
                  </div>
                </div>
                <button onClick={() => setIsRzpOpen(false)} className="text-white/70 hover:text-white cursor-pointer transition-colors">
                  <X size={16} />
                </button>
              </div>

              {rzpStep === 'methods' && (
                <div className="p-5 space-y-4 text-left">
                  {/* Amount display */}
                  <div className="text-center py-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Total Payable Amount</p>
                    <p className="text-3xl font-black mt-1 text-blue-600">₹1</p>
                    <p className="text-[8.5px] text-slate-400 font-semibold mt-0.5">Testing Mode — GST Included</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Select Payment Method</p>

                    <button
                      onClick={() => setSelectedMethod('upi')}
                      className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        selectedMethod === 'upi'
                          ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-800">UPI — Paytm / Google Pay</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Pay instantly via QR code or phone number</p>
                      </div>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selectedMethod === 'upi' ? 'border-blue-500' : 'border-slate-300'
                      }`}>
                        {selectedMethod === 'upi' && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                      </span>
                    </button>

                    <button
                      onClick={() => setSelectedMethod('card')}
                      className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        selectedMethod === 'card'
                          ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-800">Credit / Debit Card</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Visa, Mastercard, RuPay, Maestro</p>
                      </div>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selectedMethod === 'card' ? 'border-blue-500' : 'border-slate-300'
                      }`}>
                        {selectedMethod === 'card' && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                      </span>
                    </button>
                  </div>

                  <button
                    disabled={!selectedMethod}
                    onClick={handlePaySuccess}
                    className={`w-full py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      selectedMethod
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    }`}
                  >
                    Pay Securely via Razorpay
                  </button>
                </div>
              )}

              {rzpStep === 'processing' && (
                <div className="p-10 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-bold text-slate-800">Processing Payment...</p>
                  <p className="text-xs text-slate-400">Please do not close this window.</p>
                </div>
              )}

              {rzpStep === 'success' && (
                <div className="p-10 text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={28} className="text-emerald-500" />
                  </div>
                  <p className="text-base font-black text-slate-800">Payment Successful!</p>
                  <p className="text-xs text-slate-500">Your license has been reactivated.</p>
                </div>
              )}

              <div className="bg-slate-50 border-t border-slate-100 py-2.5 text-center text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                🔒 Secured by 256-bit SSL Encryption
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
          <div className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 animate-scaleIn">
            {/* Blue header strip */}
            <div className="bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 px-8 py-6 text-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl flex items-center justify-center">
                  <Lock size={18} className="text-white" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-200 block">First-Time Setup</span>
                  <h2 className="text-lg font-black text-white uppercase tracking-tight leading-none">Security Update</h2>
                </div>
              </div>
              <p className="text-white/75 text-[11px] leading-relaxed">
                Welcome! Please set a new password to secure your account before continuing.
              </p>
            </div>

            <div className="p-8 space-y-5">
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
                    Password changed! Redirecting to your dashboard...
                  </div>
                </div>
              )}

              <form onSubmit={handleFirstLoginSubmit} className="space-y-4">
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

                <button
                  type="submit"
                  disabled={passLoading || passSuccess}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 shadow-md shadow-blue-500/20 cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {passLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Password & Enter'
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
