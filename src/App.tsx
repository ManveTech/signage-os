import React, { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import AdminLogin from './components/AdminLogin';
const DisplayClient = lazy(() => import('./pages/display/DisplayClient'));
import { ToastContainer } from './components/Toast';
import BootScreen from './components/BootScreen';

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
        <Route path="/display" element={<Suspense fallback={null}><DisplayClient /></Suspense>} />
        <Route path="/admin/*" element={<AdminLogin initialView="dashboard" />} />
        <Route path="/*" element={<AdminLogin initialView="dashboard" />} />
      </Routes>
      <ToastContainer />
    </div>
  );
}
