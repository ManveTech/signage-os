import React, { useState, useEffect } from 'react';
import { 
  Monitor, Wifi, WifiOff, AlertTriangle, Film, List, Key, Clock, 
  Upload, Edit, UserCheck, RefreshCw, HardDrive, Cpu, CreditCard, ShieldAlert 
} from 'lucide-react';
import { licensingStore } from '../../../lib/licensingStore';
import { mediaStore } from '../../../lib/mediaStore';
import { syncCollection } from '../../../lib/syncHelper';

export default function Dashboard({ userEmail = 'priya@demo.com' }: { userEmail?: string }) {
  const [, setRefreshTick] = useState(0);

  // Sync all relevant collections from server on mount
  useEffect(() => {
    Promise.all([
      syncCollection('screens', 'signageos_screens'),
      syncCollection('playlists', 'signageos_playlists'),
      syncCollection('media_items', 'signageos_media'),
      syncCollection('licenses', 'signageos_licenses'),
      syncCollection('invoices', 'signageos_invoices'),
    ]).then(() => setRefreshTick(t => t + 1));
  }, [userEmail]);

  // 1. Fetch live data for this specific user
  const licenses = licensingStore.getLicenses();
  const userLicense = licenses.find(l => l.assignedUserEmail === userEmail);
  
  const allScreens = mediaStore.getScreens();
  const myScreens = allScreens.filter(s => s.assignedToUserEmail === userEmail);
  
  const allPlaylists = mediaStore.getPlaylists();
  const myPlaylists = allPlaylists.filter(p => p.createdBy === userEmail);
  
  const allMedia = mediaStore.getMedia();
  const myMedia = allMedia.filter(m => m.uploadedBy === userEmail);
  
  const allInvoices = licensingStore.getInvoices();
  const myInvoices = allInvoices.filter(i => i.clientEmail === userEmail);
  const unpaidInvoices = myInvoices.filter(i => i.status === 'unpaid');
  
  // Find the earliest unpaid invoice for payment countdown
  const unpaidInvoice = unpaidInvoices.length > 0 
    ? [...unpaidInvoices].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
    : null;

  // 2. Calculations
  const calculateDaysLeft = (dateStr?: string) => {
    if (!dateStr) return 0;
    const diffTime = new Date(dateStr).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const daysUntilExpiry = userLicense ? calculateDaysLeft(userLicense.expiryDate) : 0;
  const daysUntilPayment = unpaidInvoice ? calculateDaysLeft(unpaidInvoice.dueDate) : null;

  const onlineScreens = myScreens.filter(s => s.status === 'online').length;
  const offlineScreens = myScreens.filter(s => s.status === 'offline').length;
  const warningScreens = myScreens.filter(s => s.status === 'warning').length;

  const deviceLimit = userLicense ? userLicense.deviceLimit : 0;
  const slotsRemaining = Math.max(0, deviceLimit - myScreens.length);

  // 3. Dynamic Alerts
  const myAlerts: { type: 'error' | 'warning' | 'info'; title: string; desc: string; time: string }[] = [];
  
  myScreens.forEach(s => {
    if (s.status === 'offline') {
      myAlerts.push({
        type: 'error',
        title: `Screen "${s.name}" is offline`,
        desc: `Location: ${s.location} · Last seen ${s.lastHeartbeat}`,
        time: s.lastHeartbeat
      });
    } else if (s.status === 'warning') {
      myAlerts.push({
        type: 'warning',
        title: `Screen "${s.name}" storage warning`,
        desc: `Location: ${s.location} · Storage space is ${s.storageUsed}% full`,
        time: s.lastHeartbeat
      });
    }
  });

  if (userLicense && daysUntilExpiry < 15) {
    myAlerts.push({
      type: 'warning',
      title: `License expiring soon`,
      desc: `Your profile ${userLicense.id} expires on ${userLicense.expiryDate} (${daysUntilExpiry} days left)`,
      time: '1d'
    });
  }

  if (unpaidInvoice) {
    const isOverdue = daysUntilPayment !== null && daysUntilPayment <= 0;
    myAlerts.push({
      type: isOverdue ? 'error' : 'warning',
      title: isOverdue ? `Payment Overdue` : `Pending Subscription Payment`,
      desc: `Invoice ${unpaidInvoice.id} (₹${unpaidInvoice.amount.toLocaleString()}) is due on ${unpaidInvoice.dueDate} (${isOverdue ? 'Overdue' : `${daysUntilPayment} days left`})`,
      time: 'Just now'
    });
  }

  // 4. Activity Feed (Mocked based on user actions)
  const myActivityFeed = [
    { text: `Welcome back. Managed profile associated with "${userEmail}"`, time: 'Just now', type: 'user' },
    ...(myScreens.length > 0 ? [{ text: `Screen "${myScreens[0].name}" reported normal heartbeat signal`, time: '5 min ago', type: 'screen' }] : []),
    ...(myMedia.length > 0 ? [{ text: `Media asset "${myMedia[0].title}" verified inside player cache`, time: '20 min ago', type: 'media' }] : []),
    ...(myPlaylists.length > 0 ? [{ text: `Active Playlist "${myPlaylists[0].name}" sync broadcast succeeded`, time: '1 hour ago', type: 'playlist' }] : []),
  ];

  const activityIconMap: Record<string, React.ReactNode> = {
    screen: <Monitor size={14} />,
    media: <Upload size={14} />,
    playlist: <Edit size={14} />,
    user: <UserCheck size={14} />,
  };

  const activityColorMap: Record<string, string> = {
    screen: 'bg-blue-50 text-blue-600',
    media: 'bg-emerald-50 text-emerald-600',
    playlist: 'bg-amber-50 text-amber-600',
    user: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="p-6 space-y-6 text-left">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back — manage your screens and licenses at a glance</p>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Screen Slot Allotment Status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Monitor size={20} />
            </div>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {onlineScreens} / {myScreens.length} Online
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-800">
              {myScreens.length} <span className="text-xs text-slate-400 font-semibold">of {deviceLimit} slots</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Screen slots used ({slotsRemaining} slots left)
            </p>
          </div>
        </div>

        {/* License Number Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
              <Key size={20} />
            </div>
            <span className="text-[10px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {userLicense?.status === 'active' ? 'Active Plan' : 'Action Required'}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-black text-slate-800 truncate" title={userLicense?.id}>
              {userLicense?.id || 'NO LICENSE'}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1 truncate" title={userLicense?.name}>
              {userLicense?.name || 'Unassigned License Profile'}
            </p>
          </div>
        </div>

        {/* Expiration / Renewal Countdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Clock size={20} />
            </div>
            {userLicense && (
              <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Exp: {userLicense.expiryDate}
              </span>
            )}
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-800">
              {daysUntilExpiry} <span className="text-xs text-slate-400 font-semibold">days</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Until license renewal / expiration
            </p>
          </div>
        </div>

        {/* Next Payment Dues */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <CreditCard size={20} />
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {unpaidInvoice ? 'Unpaid Invoice' : 'Settled'}
            </span>
          </div>
          <div className="mt-4">
            {unpaidInvoice ? (
              <>
                <h3 className="text-2xl font-black text-slate-800">
                  {daysUntilPayment !== null && daysUntilPayment <= 0 ? (
                    <span className="text-rose-600">Overdue</span>
                  ) : (
                    <span>{daysUntilPayment} days</span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1 truncate">
                  ₹{unpaidInvoice.amount.toLocaleString()} due on {unpaidInvoice.dueDate}
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-black text-slate-850">
                  Fully Settled
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  No pending dues or invoices
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Media and Playlist Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Film size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Media Library items</p>
              <p className="text-[10px] text-slate-400">Total uploaded image/video files</p>
            </div>
          </div>
          <span className="text-lg font-black text-slate-700">{myMedia.length}</span>
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
              <List size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Active Campaign Loops</p>
              <p className="text-[10px] text-slate-400">Total play sequences built</p>
            </div>
          </div>
          <span className="text-lg font-black text-slate-700">{myPlaylists.length}</span>
        </div>
      </div>

      {/* Warnings Alerts Panel and Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Log */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-850">Recent System Activity</h2>
          </div>
          <div className="space-y-3.5">
            {myActivityFeed.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${activityColorMap[item.type]}`}>
                  {activityIconMap[item.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-750 font-medium leading-relaxed">{item.text}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts & Critical Warnings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-850">Alerts & Notifications</h2>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
              myAlerts.length > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-400'
            }`}>
              {myAlerts.length} Active
            </span>
          </div>

          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {myAlerts.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <UserCheck size={28} className="text-emerald-400 mb-1.5" />
                <p className="text-xs font-bold text-slate-700">All systems operational</p>
                <p className="text-[9.5px] text-slate-400 mt-0.5">No warnings or billing action items reported.</p>
              </div>
            ) : (
              myAlerts.map((alert, i) => (
                <div key={i} className={`p-3 rounded-xl border ${
                  alert.type === 'error' ? 'bg-rose-50/50 border-rose-100' : 'bg-amber-50/50 border-amber-100'
                }`}>
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={15} className={`mt-0.5 flex-shrink-0 ${
                      alert.type === 'error' ? 'text-rose-500' : 'text-amber-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800">{alert.title}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-relaxed">{alert.desc}</p>
                    </div>
                    <span className="text-[9px] text-slate-400 font-semibold">{alert.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
