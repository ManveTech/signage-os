import React from 'react';
import AdminLogin from './components/AdminLogin';
import { ToastContainer } from './components/Toast';

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
  return (
    <div className="relative w-full min-h-screen bg-slate-950 font-sans text-slate-900 selection:bg-accent selection:text-primary">
      <AdminLogin />
      <ToastContainer />
    </div>
  );
}
