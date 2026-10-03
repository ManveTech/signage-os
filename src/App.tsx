import React, { useState, lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import AdminLogin from './components/AdminLogin';
const DisplayClient = lazy(() => import('./pages/display/DisplayClient'));
import { ToastContainer } from './components/Toast';
import BootScreen from './components/BootScreen';
import { setPendingPairCode } from './lib/pendingPair';
import { getAuthToken } from './lib/authStorage';
import { ADMIN_ROUTES, USER_ROUTES } from './lib/routes';

/**
 * Where a TV's pairing QR lands (`#/pair?code=ABC123`): remember the code,
 * then open Add screen — after sign-in if needed.
 */
function PairLink() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useEffect(() => {
    setPendingPairCode(params.get('code') || '');
    const signedIn = !!getAuthToken() && !!localStorage.getItem('signageos_user_email');
    const isAdmin = localStorage.getItem('signageos_user_role') === 'admin';
    navigate(!signedIn ? '/login' : isAdmin ? ADMIN_ROUTES['screens-add'] : USER_ROUTES['screens-add'], { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// Read synchronously so the very first render already knows whether to show
// the boot screen — waiting on an effect would let one frame of bare content
// flash through before it mounts.
const isNativeApp = Capacitor.isNativePlatform();

// Clear old localStorage demo data once on startup to avoid cached mock records
if (!localStorage.getItem('signageos_cleared_demo_v2')) {
  const keysToClear = [
    'signageos_users',
    'signageos_screens',
    'signageos_groups',
    'signageos_media',
    'signageos_playlists',
    'signageos_licenses',
    'signageos_organizations',
    'signageos_tickets',
    'signageos_faqs',
    'signageos_docs',
    'signageos_payments',
    'signageos_invoices',
    'signageos_leads',
    'signageos_business_details'
  ];
  keysToClear.forEach(key => localStorage.removeItem(key));
  localStorage.setItem('signageos_cleared_demo_v2', 'true');
}

export default function App() {
  const [booting, setBooting] = useState(isNativeApp);

  return (
    <div className="relative w-full min-h-screen bg-slate-950 font-sans text-slate-900 selection:bg-accent selection:text-primary">
      {booting && <BootScreen onDone={() => setBooting(false)} />}
      <Routes>
        <Route path="/login" element={<AdminLogin initialView="login" />} />
        <Route path="/forgot-password" element={<AdminLogin initialView="forgot" />} />
        <Route path="/reset-password" element={<AdminLogin initialView="reset" />} />
        <Route path="/pair" element={<PairLink />} />
        <Route path="/display" element={<Suspense fallback={null}><DisplayClient /></Suspense>} />
        <Route path="/admin/*" element={<AdminLogin initialView="dashboard" />} />
        <Route path="/*" element={<AdminLogin initialView="dashboard" />} />
      </Routes>
      <ToastContainer />
    </div>
  );
}
