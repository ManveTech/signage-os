import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import AdminDashboard from '../pages/admin-dashboard';
import UserDashboard from '../pages/user-dashboard';
import logoImg from '../assets/BS-main-Logo.png';
import {
  ShieldCheck,
  Mail,
  Lock,
  ChevronRight,
  Check,
  X,
  Users,
  PhoneCall,
  IndianRupee,
  Sliders,
  TrendingUp,
  Layers,
  ArrowLeft,
  ExternalLink,
  UserCheck
} from 'lucide-react';

import { syncAllFromDatabase } from '../lib/syncHelper';

interface Props { }

// Struct for dummy quotation requests to show in admin dashboard
interface LeadQuote {
  id: string;
  clientName: string;
  email: string;
  phone: string;
  company: string;
  product: string;
  quantity: number;
  date: string;
  status: 'Pending' | 'Approved' | 'Declined';
  estimatedValue: string;
}

const initialLeads: LeadQuote[] = [];

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loggedInUser, setLoggedInUser] = useState<{ email: string; role: 'admin' | 'client' } | null>(() => {
    const token = localStorage.getItem('signageos_token');
    const storedEmail = localStorage.getItem('signageos_user_email');
    const storedRole = localStorage.getItem('signageos_user_role');
    if (token && storedEmail && storedRole) {
      return { email: storedEmail, role: storedRole as 'admin' | 'client' };
    }
    return null;
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Tenant branding state
  const [branding, setBranding] = useState<{ logoUrl: string | null; companyName: string; primaryColor: string }>({
    logoUrl: null,
    companyName: 'SignageOS',
    primaryColor: '#0EA5E9'
  });

  useEffect(() => {
    const host = window.location.hostname;
    fetch(`${API_BASE}/public/tenant-branding?host=${host}`)
      .then(res => res.json())
      .then(data => {
        if (data && (data.logoUrl || data.companyName !== 'SignageOS' || data.primaryColor !== '#0EA5E9')) {
          setBranding({
            logoUrl: data.logoUrl,
            companyName: data.companyName,
            primaryColor: data.primaryColor
          });
          if (data.primaryColor) {
            document.documentElement.style.setProperty('--color-primary', data.primaryColor);
          }
        }
      })
      .catch(err => console.error('Failed to load dynamic tenant branding:', err));
  }, []);

  // Recovery views state
  const [view, setView] = useState<'login' | 'forgot' | 'reset'>('login');
  const [resetToken, setResetToken] = useState('');
  const [resetUserId, setResetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Dashboard states
  const [leads, setLeads] = useState<LeadQuote[]>(initialLeads);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved'>('All');

  // Parse query parameters for token & userId on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    const userIdParam = params.get('userId');
    if (tokenParam && userIdParam) {
      setResetToken(tokenParam);
      setResetUserId(userIdParam);
      setView('reset');
      setErrorMessage('');
      setSuccessMessage('');

      // Clear URL params to avoid re-triggering and maintain clean address bar
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, []);

  // Auto-sync database cache to localStorage on load if user is logged in
  useEffect(() => {
    if (loggedInUser) {
      syncAllFromDatabase().catch(err => {
        console.error('Auto sync error on startup:', err);
      });
    }
  }, [loggedInUser]);

  // Handle actual login submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please fill in all security fields.');
      return;
    }

    const lowerEmail = email.toLowerCase().trim();

    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lowerEmail, password })
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            localStorage.setItem('signageos_token', data.token);
            localStorage.setItem('signageos_user_id', data.user.id);
            localStorage.setItem('signageos_user_email', data.user.email);
            localStorage.setItem('signageos_user_role', data.user.role === 'admin' || data.user.role === 'super_admin' ? 'admin' : 'client');
            localStorage.setItem('signageos_first_time_login', data.user.firstTimeLogin ? 'true' : 'false');
          }

          // Sync database cache to localStorage
          try {
            await syncAllFromDatabase();
          } catch (syncErr) {
            console.error('Initial sync error:', syncErr);
          }

          setLoggedInUser({
            email: data.user.email,
            role: data.user.role === 'admin' || data.user.role === 'super_admin' ? 'admin' : 'client'
          });
          setErrorMessage('');
        } else {
          const errData = await res.json().catch(() => ({}));
          setErrorMessage(errData.message || 'Invalid access credentials.');
        }
      })
      .catch((err) => {
        console.error('Server connection error:', err);
        setErrorMessage('Server connection error. Please verify the server is running and accessible.');
      });
  };

  // Handle forgot password submit
  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');

    const lowerEmail = email.toLowerCase().trim();

    fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lowerEmail })
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setSuccessMessage(data.message || 'Password reset link sent to your email.');
          setEmail('');
        } else {
          const errData = await res.json().catch(() => ({}));
          setErrorMessage(errData.message || 'Email address not found.');
        }
      })
      .catch((err) => {
        console.error('Forgot password connection error:', err);
        setErrorMessage('Server connection error. Unable to request password recovery.');
      });
  };

  // Handle reset password submit
  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setErrorMessage('Please enter and confirm your password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');

    fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        userId: resetUserId,
        password: newPassword
      })
    })
      .then(async (res) => {
        if (res.ok) {
          setSuccessMessage('Password has been successfully updated. Redirecting to login view...');
          setNewPassword('');
          setConfirmPassword('');
          setTimeout(() => {
            setView('login');
            setSuccessMessage('');
          }, 2500);
        } else {
          const errData = await res.json().catch(() => ({}));
          setErrorMessage(errData.message || 'Reset expired or invalid.');
        }
      })
      .catch((err) => {
        console.error('Reset password connection error:', err);
        setErrorMessage('Server connection error. Password reset request failed.');
      });
  };

  const handleLogout = () => {
    localStorage.removeItem('signageos_token');
    localStorage.removeItem('signageos_user_id');
    localStorage.removeItem('signageos_user_email');
    localStorage.removeItem('signageos_user_role');
    setLoggedInUser(null);
  };

  // If successfully logged in, render the premium admin dashboard panel
  if (loggedInUser) {
    if (loggedInUser.role === 'admin') {
      return (
        <AdminDashboard
          onLogout={handleLogout}
          onSwitchToClient={() => {
            localStorage.setItem('signageos_user_role', 'client');
            setLoggedInUser({ email: 'priya@demo.com', role: 'client' });
          }}
        />
      );
    } else {
      return (
        <UserDashboard
          onLogout={handleLogout}
          userEmail={loggedInUser.email}
        />
      );
    }
  }

  // Otherwise, render the gorgeous dual-panel Login Page resembling the layout mockup
  return (
    <div className="w-full min-h-screen bg-slate-100 pt-24 pb-16 flex items-center justify-center font-sans px-4 relative select-none" id="admin-login-screen">

      {/* Absolute Decorative Circles & Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden z-0">
        <svg className="absolute inset-0 w-full h-full" width="100%" height="100%">
          <pattern id="login-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(15, 23, 42, 0.03)" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#login-grid)" />
        </svg>
      </div>

      {/* Main Container - Dual Pane Card */}
      <div className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 grid md:grid-cols-12 z-10 animate-scaleIn">

        {/* LEFT PANE: Ambient Bright Tech Blue Panel */}
        <div className="md:col-span-6 bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 p-8 sm:p-12 flex flex-col justify-between text-white relative overflow-hidden text-left min-h-[380px] md:min-h-[500px]">

          {/* Wave Curve Decorative Overlays */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <svg className="absolute -bottom-20 -left-10 w-[140%] h-[140%]" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,50 Q25,80 50,50 T100,50 L100,100 L0,100 Z" fill="rgba(255,255,255,0.15)"></path>
              <path d="M0,60 Q25,90 50,70 T100,80 L100,100 L0,100 Z" fill="rgba(255,255,255,0.1)"></path>
            </svg>
          </div>

          {/* Top Company Title */}
          <div className="relative z-10 flex items-center gap-2" id="login-pane-company">
            <img src={branding.logoUrl || logoImg} className="w-14 h-14 object-contain shrink-0 rounded-lg" alt={`${branding.companyName} Logo`} />
            <div className="flex flex-col text-left">
              <span className="text-sm font-black tracking-tight leading-none text-white">{branding.companyName.toUpperCase()}</span>
              <span className="text-[7.5px] font-black tracking-[0.25em] text-cyan-200 leading-none">SYSTEMS</span>
            </div>
          </div>

          {/* Central Typography Heading */}
          <div className="relative z-10 my-auto" id="login-pane-welcome">
            <span className="text-cyan-100 text-xs font-bold uppercase tracking-wider block mb-2 opacity-90">
              {view === 'login' ? 'Nice to see you again' : view === 'forgot' ? 'Retrieve access' : 'Configure security'}
            </span>
            <h2 className="text-4xl xs:text-5xl font-black text-white leading-none tracking-tight mb-4 uppercase">
              {view === 'login' ? 'WELCOME BACK' : view === 'forgot' ? 'RESET SECURITY' : 'NEW PASSWORD'}
            </h2>
            <div className="w-14 h-1 bg-white rounded-full mb-6" />
            <p className="text-white/80 text-[11px] sm:text-xs leading-relaxed max-w-[280px]">
              {view === 'login'
                ? 'Log into your account.'
                : view === 'forgot'
                  ? 'Submit your email to request recovery link.'
                  : 'Choose a strong password key.'}
            </p>
          </div>

        </div>

        {/* RIGHT PANE: White Minimal Form Panel */}
        <div className="md:col-span-6 p-8 sm:p-12 flex flex-col justify-between text-left bg-white relative">

          <div className="my-auto pt-6" id="login-right-pane-body">

            {/* Header Typography */}
            <div className="mb-8 select-text">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {view === 'login' ? 'Login Account' : view === 'forgot' ? 'Forgot Password' : 'Reset Password'}
              </h1>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                {view === 'login'
                  ? 'Enter your credentials to enter your dashboard.'
                  : view === 'forgot'
                    ? 'Enter your email to receive a password reset link.'
                    : 'Enter and confirm your new password key.'}
              </p>
            </div>

            {/* Simulated Error Alert */}
            {errorMessage && (
              <div className="mb-6 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-600 font-semibold flex items-start gap-2 animate-pulse">
                <X className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold block">Access Denied:</span>
                  {errorMessage}
                </div>
              </div>
            )}

            {/* Success Alert */}
            {successMessage && (
              <div className="mb-6 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-600 font-semibold flex items-start gap-2">
                <Check className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold block">Verification:</span>
                  {successMessage}
                </div>
              </div>
            )}

            {view === 'login' && (
              /* Main Form Fields */
              <form onSubmit={handleLoginSubmit} className="space-y-4">

                {/* Email ID input built with blue bar styling */}
                <div className="group relative">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1.5">
                    Email ID
                  </label>
                  <div className="flex items-center relative rounded-lg bg-slate-50 border border-slate-200 transition-all duration-300 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 overflow-hidden">
                    {/* Glowing left primary vertical blue border block identical to layout design */}
                    <div className="w-1.5 self-stretch bg-blue-500" />

                    <div className="pl-3.5 pr-2.5 text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. admin@demo.com"
                      className="w-full py-3.5 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-350 focus:outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Password ID input built with blue bar styling */}
                <div className="group relative">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1.5">
                    Password
                  </label>
                  <div className="flex items-center relative rounded-lg bg-slate-50 border border-slate-200 transition-all duration-300 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 overflow-hidden">
                    {/* Glowing left primary vertical blue border block */}
                    <div className="w-1.5 self-stretch bg-blue-500" />

                    <div className="pl-3.5 pr-2.5 text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter security key"
                      className="w-full py-3.5 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-350 focus:outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Checkboxes from styling guideline */}
                <div className="flex items-center justify-between pt-1 pb-4 text-[11px] font-semibold text-slate-400">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={keepSignedIn}
                      onChange={() => setKeepSignedIn(!keepSignedIn)}
                      className="accent-blue-500 rounded border-slate-300"
                    />
                    <span>Keep me signed in</span>
                  </label>
                  <span
                    onClick={() => {
                      setView('forgot');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-blue-500 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </span>
                </div>

                {/* Large blue action button styled like SUBSCRBE in design preview */}
                <button
                  type="submit"
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 shadow-md shadow-blue-500/20 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                  id="login-subscribe-btn"
                >
                  Sign In / Verify <ChevronRight className="w-4 h-4" />
                </button>

              </form>
            )}

            {view === 'forgot' && (
              /* Forgot Password Request Form */
              <form onSubmit={handleForgotSubmit} className="space-y-4">

                <div className="group relative">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1.5">
                    Email ID
                  </label>
                  <div className="flex items-center relative rounded-lg bg-slate-50 border border-slate-200 transition-all duration-300 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 overflow-hidden">
                    <div className="w-1.5 self-stretch bg-blue-500" />

                    <div className="pl-3.5 pr-2.5 text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. admin@demo.com"
                      className="w-full py-3.5 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-350 focus:outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 pb-4 text-[11px] font-semibold text-slate-400">
                  <button
                    type="button"
                    onClick={() => {
                      setView('login');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer bg-transparent border-none outline-none font-semibold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 shadow-md shadow-blue-500/20 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  Send Reset Link <ChevronRight className="w-4 h-4" />
                </button>

              </form>
            )}

            {view === 'reset' && (
              /* Reset Password Form */
              <form onSubmit={handleResetSubmit} className="space-y-4">

                {/* New Password input */}
                <div className="group relative">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1.5">
                    New Password
                  </label>
                  <div className="flex items-center relative rounded-lg bg-slate-50 border border-slate-200 transition-all duration-300 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 overflow-hidden">
                    <div className="w-1.5 self-stretch bg-blue-500" />

                    <div className="pl-3.5 pr-2.5 text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full py-3.5 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-350 focus:outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Confirm Password input */}
                <div className="group relative">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1.5">
                    Confirm Password
                  </label>
                  <div className="flex items-center relative rounded-lg bg-slate-50 border border-slate-200 transition-all duration-300 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 overflow-hidden">
                    <div className="w-1.5 self-stretch bg-blue-500" />

                    <div className="pl-3.5 pr-2.5 text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full py-3.5 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-350 focus:outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 pb-4 text-[11px] font-semibold text-slate-400">
                  <button
                    type="button"
                    onClick={() => {
                      setView('login');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer bg-transparent border-none outline-none font-semibold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 shadow-md shadow-blue-500/20 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  Reset Password <ChevronRight className="w-4 h-4" />
                </button>

              </form>
            )}

          </div>

          {/* Copyright notice styled cleanly at bottom margin */}
          <div className="text-[9px] text-slate-350 mt-6 select-text text-center">
            Designed for SignageOS Technologies Ltd. © 2026.
          </div>

        </div>

      </div>

    </div>
  );
}
