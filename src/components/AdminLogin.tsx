import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from '../config';
// The dashboards are most of the app's code — loaded on demand (and
// prefetched right after first paint, below) so startup only has to parse
// the small login/boot shell, not ~2 MB of JavaScript, before anything shows.
const loadAdminDashboard = () => import('../pages/admin-dashboard');
const loadUserDashboard = () => import('../pages/user-dashboard');
const AdminDashboard = lazy(loadAdminDashboard);
const UserDashboard = lazy(loadUserDashboard);
import logoImg from '../assets/bluestar-logo-on-light.png';
import {
  Mail,
  Lock,
  ArrowRight,
  Check,
  X,
  ArrowLeft,
  Eye,
  EyeOff
} from 'lucide-react';

import { syncAllFromDatabase } from '../lib/syncHelper';
import { storeProfileName } from '../lib/profileName';
import { getAuthToken, setAuthToken, clearAuthToken } from '../lib/authStorage';

interface Props {
  initialView?: 'login' | 'forgot' | 'reset' | 'dashboard';
}

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

export default function AdminLogin({ initialView = 'login' }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loggedInUser, setLoggedInUser] = useState<{ email: string; role: 'admin' | 'client' } | null>(() => {
    const token = getAuthToken();
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
  const [view, setView] = useState<'login' | 'forgot' | 'reset'>(() => 
    initialView === 'forgot' ? 'forgot' : initialView === 'reset' ? 'reset' : 'login'
  );
  const [resetToken, setResetToken] = useState('');
  const [resetUserId, setResetUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  // Shared by password login and Google sign-in — both hit different
  // endpoints but land on the same { token, user } shape and need the same
  // localStorage/session setup afterward.
  const completeLogin = async (data: { token?: string; user: any }) => {
    if (data.token) {
      setAuthToken(data.token, keepSignedIn);
      localStorage.setItem('signageos_user_id', data.user.id);
      localStorage.setItem('signageos_user_email', data.user.email);
      localStorage.setItem('signageos_user_role', data.user.role === 'admin' || data.user.role === 'super_admin' ? 'admin' : 'client');
      localStorage.setItem('signageos_first_time_login', data.user.firstTimeLogin ? 'true' : 'false');
      storeProfileName(data.user.email, data.user.role === 'admin' || data.user.role === 'super_admin', data.user.name);
    }

    try {
      await syncAllFromDatabase({ force: true });
    } catch (syncErr) {
      console.error('Initial sync error:', syncErr);
    }

    setLoggedInUser({
      email: data.user.email,
      role: data.user.role === 'admin' || data.user.role === 'super_admin' ? 'admin' : 'client'
    });
    setErrorMessage('');
  };

  // Handle actual login submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Enter your email and password.');
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
          await completeLogin(data);
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

  // Google Sign-In — only rendered when Admin > Integrations has it enabled.
  const [googleAuth, setGoogleAuth] = useState<{ enabled: boolean; clientId: string }>({ enabled: false, clientId: '' });
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/auth/google/config`)
      .then(res => res.json())
      .then(data => setGoogleAuth({ enabled: !!data.enabled, clientId: data.clientId || '' }))
      .catch(err => console.error('Failed to load Google auth config:', err));
  }, []);

  const handleGoogleCredential = async (response: { credential: string }) => {
    setErrorMessage('');
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (res.ok) {
        await completeLogin(data);
      } else {
        setErrorMessage(data.message || 'Google sign-in failed.');
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      setErrorMessage('Server connection error during Google sign-in.');
    }
  };

  useEffect(() => {
    if (!googleAuth.enabled || !googleAuth.clientId || view !== 'login') return;

    const initializeButton = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleButtonRef.current) return;
      google.accounts.id.initialize({
        client_id: googleAuth.clientId,
        callback: handleGoogleCredential
      });
      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        shape: 'pill',
        text: 'signin_with'
      });
    };

    if ((window as any).google?.accounts?.id) {
      initializeButton();
      return;
    }

    const existingScript = document.getElementById('google-identity-script');
    if (existingScript) {
      existingScript.addEventListener('load', initializeButton);
      return () => existingScript.removeEventListener('load', initializeButton);
    }

    const script = document.createElement('script');
    script.id = 'google-identity-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeButton;
    document.body.appendChild(script);
  }, [googleAuth, view]);

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
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if (data.emailSent) {
            setSuccessMessage(data.message || 'Password reset link sent to your email. Please check your inbox.');
          } else {
            setErrorMessage(data.message || 'SMTP email server is not configured or failed to send email. Please check server SMTP configuration in .env.');
          }
          setEmail('');
        } else {
          setErrorMessage(data.message || 'Email address not found.');
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
    clearAuthToken();
    localStorage.removeItem('signageos_user_id');
    localStorage.removeItem('signageos_user_email');
    localStorage.removeItem('signageos_user_role');
    setLoggedInUser(null);
    navigate('/login');
  };

  // The server ended this session (account deleted, role changed or
  // deactivated) — back to sign-in rather than a dashboard full of errors.
  useEffect(() => {
    const onEnded = () => {
      if (!getAuthToken()) return;
      handleLogout();
      setErrorMessage('Your session has ended. Please sign in again.');
    };
    window.addEventListener('signageos_session_ended', onEnded);
    return () => window.removeEventListener('signageos_session_ended', onEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warm both dashboard chunks in the background once the shell is up, so by
  // the time the boot animation ends (or the user signs in) they're ready.
  useEffect(() => {
    const t = setTimeout(() => {
      loadAdminDashboard().catch(() => {});
      loadUserDashboard().catch(() => {});
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // If successfully logged in, render the premium admin dashboard panel
  if (loggedInUser) {
    if (loggedInUser.role === 'admin') {
      return (
        <Suspense fallback={<DashboardLoading />}>
          <AdminDashboard
            onLogout={handleLogout}
            userEmail={loggedInUser.email}
            onSwitchToClient={() => {
              localStorage.setItem('signageos_user_role', 'client');
              setLoggedInUser({ email: 'priya@demo.com', role: 'client' });
            }}
          />
        </Suspense>
      );
    } else {
      return (
        <Suspense fallback={<DashboardLoading />}>
          <UserDashboard
            onLogout={handleLogout}
            userEmail={loggedInUser.email}
          />
        </Suspense>
      );
    }
  }

  // Field styling shared by every input across all three views — a plain
  // neutral field on the light sign-in panel, brand color reserved for the
  // focus state instead of being smeared across every element.
  const fieldWrapClass = "flex items-center gap-3 rounded-xl bg-ink-950/[0.03] border border-ink-950/10 px-3.5 transition-all duration-200 focus-within:border-brand-500/60 focus-within:bg-brand-50/50 focus-within:shadow-[0_0_0_4px_rgba(74,108,247,0.10)]";
  const fieldInputClass = "w-full bg-transparent py-3 text-sm text-ink-950 placeholder-ink-950/30 focus:outline-none";
  const fieldLabelClass = "text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-950/40 block mb-1.5";

  const submitButtonClass = "group w-full py-3.5 rounded-xl bg-ink-950 text-white text-sm font-semibold shadow-[0_10px_24px_-8px_rgba(11,13,20,0.35)] hover:shadow-[0_14px_32px_-8px_rgba(11,13,20,0.45)] transition-shadow flex items-center justify-center gap-2 cursor-pointer";
  const backLinkClass = "text-ink-950/45 hover:text-ink-950/80 flex items-center gap-1.5 cursor-pointer bg-transparent border-none outline-none font-medium text-xs transition-colors";

  const viewCopy: Record<typeof view, { eyebrow: string; title: string; sub: string }> = {
    login: { eyebrow: 'Welcome back', title: 'Sign in', sub: 'Enter your credentials to reach your dashboard.' },
    forgot: { eyebrow: 'Account recovery', title: 'Reset access', sub: 'We’ll email you a secure link to choose a new password.' },
    reset: { eyebrow: 'Almost there', title: 'New password', sub: 'Choose something strong you haven’t used before.' }
  };

  const featureBullets = [
    'Live playlist sync across every screen',
    'Real-time device health & uptime',
    'Schedule campaigns weeks in advance'
  ];

  // Otherwise, render the login screen — an asymmetric split rather than a
  // centered card: an editorial dark panel that tells you what the product
  // is, and a plain light panel that does the one job of signing you in.
  return (
    <div className="w-full min-h-screen bg-white flex select-none" id="admin-login-screen">

      {/* Left — brand & product story (desktop only) */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative overflow-hidden bg-ink-950 flex-col justify-between p-12 xl:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_10%,rgba(74,108,247,0.18),transparent_60%)]" />
        <div className="absolute -bottom-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-brand-500/[0.16] blur-[130px] animate-floatSlow" />
        <div className="grain-overlay" />

        {/* Keeps the headline block where it was — justify-between still
            expects three slots even with the brand row gone (it's shown on
            the white side now instead). */}
        <span aria-hidden />

        <div className="relative max-w-md">
          <p className="text-brand-400 text-[11px] font-bold uppercase tracking-[0.24em] mb-5">Signage Platform</p>
          <h2 className="font-display text-[2.75rem] xl:text-[3.25rem] leading-[1.05] text-white">
            Every screen,
            <br />
            <span className="italic text-brand-300">under one roof.</span>
          </h2>
          <p className="mt-5 max-w-[22rem] text-sm leading-relaxed text-white/45">
            Push content, monitor uptime, and manage every display from a single
            secure dashboard — whether it's one screen or five hundred.
          </p>

          <div className="mt-8 space-y-3">
            {featureBullets.map((t) => (
              <div key={t} className="flex items-center gap-3 text-[13px] text-white/60">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-white/25 text-[10.5px]">
          {branding.companyName} Technologies Ltd. &copy; 2026
        </p>
      </div>

      {/* Right — sign-in form */}
      <div className="flex-1 relative flex items-center justify-center px-6 py-14 sm:px-10">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(50%_35%_at_85%_0%,rgba(74,108,247,0.05),transparent_60%)]" />

        {/* Desktop-only corner brand mark — the same logo shows inline above
            the form on mobile instead, since there's no separate corner to
            put it in on a narrow screen. */}
        <div className="hidden lg:block absolute top-10 right-10">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} className="w-9 h-9 object-contain shrink-0 rounded-lg" alt={`${branding.companyName} Logo`} />
          ) : (
            <img src={logoImg} className="h-14 w-auto object-contain" alt="BlueStar DigiTech" />
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-[380px]"
        >
          {/* Mobile-only brand row — desktop shows the same logo in the
              corner instead (see above), since this column is centered and
              a corner mark isn't meaningful at that width. */}
          {branding.logoUrl ? (
            <div className="flex lg:hidden items-center gap-2.5 mb-10">
              <img src={branding.logoUrl} className="w-9 h-9 object-contain shrink-0 rounded-lg" alt={`${branding.companyName} Logo`} />
              <div>
                <p className="text-ink-950 font-semibold text-sm tracking-tight leading-none">{branding.companyName}</p>
                <p className="text-ink-950/35 text-[9px] font-bold tracking-[0.22em] uppercase mt-1">Signage Platform</p>
              </div>
            </div>
          ) : (
            <img src={logoImg} className="h-16 w-auto object-contain mb-8 lg:hidden" alt="BlueStar DigiTech" />
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-8">
                <span className="text-brand-500 text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2">
                  {viewCopy[view].eyebrow}
                </span>
                <h1 className="font-display text-[2.5rem] leading-none text-ink-950 tracking-tight">
                  {viewCopy[view].title}
                </h1>
                <p className="text-ink-950/45 text-xs mt-3 leading-relaxed max-w-[300px]">
                  {viewCopy[view].sub}
                </p>
              </div>

              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11.5px] text-rose-700 font-medium flex items-start gap-2"
                >
                  <X className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}

              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11.5px] text-emerald-700 font-medium flex items-start gap-2"
                >
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                  <span>{successMessage}</span>
                </motion.div>
              )}

              {view === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className={fieldLabelClass}>Email</label>
                    <div className={fieldWrapClass}>
                      <Mail className="w-4 h-4 text-ink-950/30 shrink-0" />
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className={fieldInputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={fieldLabelClass}>Password</label>
                    <div className={fieldWrapClass}>
                      <Lock className="w-4 h-4 text-ink-950/30 shrink-0" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className={fieldInputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-ink-950/30 hover:text-ink-950/60 focus:outline-none cursor-pointer flex items-center shrink-0 transition-colors"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-0.5 pb-1 text-xs">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none text-ink-950/55">
                      <span className="relative flex items-center justify-center w-4 h-4 shrink-0 rounded border border-ink-950/25 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-500">
                        <input
                          type="checkbox"
                          checked={keepSignedIn}
                          onChange={() => setKeepSignedIn(!keepSignedIn)}
                          className="peer sr-only"
                        />
                        <Check className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                      </span>
                      Keep me signed in
                    </label>
                    <span
                      onClick={() => {
                        setView('forgot');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="text-brand-600 hover:text-ink-950 cursor-pointer font-medium transition-colors"
                    >
                      Forgot password?
                    </span>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.985 }}
                    type="submit"
                    className={submitButtonClass}
                  >
                    Sign in <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </motion.button>

                  {googleAuth.enabled && (
                    <>
                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex-1 h-px bg-ink-950/10" />
                        <span className="text-[10px] text-ink-950/30 font-semibold uppercase tracking-widest">or</span>
                        <div className="flex-1 h-px bg-ink-950/10" />
                      </div>
                      <div className="flex justify-center [&>div]:rounded-xl [&>div]:overflow-hidden" ref={googleButtonRef} />
                    </>
                  )}
                </form>
              )}

              {view === 'forgot' && (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className={fieldLabelClass}>Email</label>
                    <div className={fieldWrapClass}>
                      <Mail className="w-4 h-4 text-ink-950/30 shrink-0" />
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className={fieldInputClass}
                      />
                    </div>
                  </div>

                  <div className="flex items-center pt-0.5 pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setView('login');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className={backLinkClass}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                    </button>
                  </div>

                  <motion.button whileTap={{ scale: 0.985 }} type="submit" className={submitButtonClass}>
                    Send reset link <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </motion.button>
                </form>
              )}

              {view === 'reset' && (
                <form onSubmit={handleResetSubmit} className="space-y-4">
                  <div>
                    <label className={fieldLabelClass}>New password</label>
                    <div className={fieldWrapClass}>
                      <Lock className="w-4 h-4 text-ink-950/30 shrink-0" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className={fieldInputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="text-ink-950/30 hover:text-ink-950/60 focus:outline-none cursor-pointer flex items-center shrink-0 transition-colors"
                        title={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={fieldLabelClass}>Confirm password</label>
                    <div className={fieldWrapClass}>
                      <Lock className="w-4 h-4 text-ink-950/30 shrink-0" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className={fieldInputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="text-ink-950/30 hover:text-ink-950/60 focus:outline-none cursor-pointer flex items-center shrink-0 transition-colors"
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center pt-0.5 pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setView('login');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className={backLinkClass}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                    </button>
                  </div>

                  <motion.button whileTap={{ scale: 0.985 }} type="submit" className={submitButtonClass}>
                    Reset password <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </motion.button>
                </form>
              )}
            </motion.div>
          </AnimatePresence>

          <p className="lg:hidden text-ink-950/35 text-[10.5px] mt-10">
            {branding.companyName} Technologies Ltd. &copy; 2026
          </p>
        </motion.div>
      </div>
    </div>
  );
}

/** Shown only for the brief moment a dashboard chunk is still arriving. */
function DashboardLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
    </div>
  );
}
