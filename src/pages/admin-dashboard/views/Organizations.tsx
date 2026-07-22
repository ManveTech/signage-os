import React, { useState, useEffect } from 'react';
import { 
  Plus, Building2, Users, Monitor, HardDrive, ChevronRight, 
  X, CheckCircle, Calendar, Shield, AlertTriangle, MoreVertical, Key 
} from 'lucide-react';
import { mockOrganizations } from '../data/mockData';
import { licensingStore } from '../../../lib/licensingStore';
import { mediaStore } from '../../../lib/mediaStore';
import { pushToDatabase, generatePocketBaseId, syncCollection } from '../../../lib/syncHelper';

type OrganizationType = {
  id: string;
  name: string;
  adminName: string;
  email: string;
  planType: string;
  screensAllowed: number;
  storageLimit: number;
  subscriptionStatus: 'active' | 'suspended' | 'expired';
  renewalDate: string;
  customDomain?: string;
};

const statusColors: Record<OrganizationType['subscriptionStatus'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  suspended: 'bg-rose-50 text-rose-700 border-rose-100',
  expired: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function Organizations() {
  // Load persistent organizations
  const [orgs, setOrgs] = useState<OrganizationType[]>(() => {
    const data = localStorage.getItem('signageos_organizations');
    if (data) return JSON.parse(data);
    localStorage.setItem('signageos_organizations', JSON.stringify(mockOrganizations));
    return mockOrganizations;
  });

  const [selectedId, setSelectedId] = useState<string | null>(orgs[0]?.id || null);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const [isAddOrgOpen, setIsAddOrgOpen] = useState(false);

  // Refresh from server on mount
  useEffect(() => {
    syncCollection('organizations', 'signageos_organizations').then(serverOrgs => {
      if (serverOrgs.length > 0) {
        setOrgs(serverOrgs);
        setSelectedId(prev => prev || serverOrgs[0]?.id || null);
      }
    });
  }, []);

  // Form states
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [planType, setPlanType] = useState('Starter');
  const [screensAllowed, setScreensAllowed] = useState(5);
  const [storageLimit, setStorageLimit] = useState(10);
  const [renewalDate, setRenewalDate] = useState('');
  const [customDomainInput, setCustomDomainInput] = useState('');

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts(p => [...p, { id, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !adminName.trim() || !adminEmail.trim()) {
      addToast("Please fill in all required fields.");
      return;
    }

    const newOrgId = generatePocketBaseId();
    const newOrg: OrganizationType = {
      id: newOrgId,
      name: orgName,
      adminName,
      email: adminEmail,
      planType,
      screensAllowed: Number(screensAllowed),
      storageLimit: Number(storageLimit),
      subscriptionStatus: 'active',
      renewalDate: renewalDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      customDomain: customDomainInput.trim()
    };

    const updated = [...orgs, newOrg];
    setOrgs(updated);
    localStorage.setItem('signageos_organizations', JSON.stringify(updated));
    pushToDatabase('organizations', newOrgId, newOrg, 'POST');
    setSelectedId(newOrg.id); // Auto-select the newly created organization

    addToast(`Organization "${orgName}" created successfully!`);
    setIsAddOrgOpen(false);
    // Reset fields
    setOrgName('');
    setAdminName('');
    setAdminEmail('');
    setPlanType('Starter');
    setScreensAllowed(5);
    setStorageLimit(10);
    setRenewalDate('');
    setCustomDomainInput('');
  };

  const handleDeleteOrg = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete organization "${name}"?`)) {
      const updated = orgs.filter(o => o.id !== id);
      setOrgs(updated);
      localStorage.setItem('signageos_organizations', JSON.stringify(updated));
      pushToDatabase('organizations', id, null, 'DELETE');
      addToast(`Organization "${name}" removed.`);
      if (selectedId === id) {
        setSelectedId(updated[0]?.id || null);
      }
    }
  };

  // Fetch licenses and screens to compute metrics
  const licenses = licensingStore.getLicenses();
  const screens = mediaStore.getScreens();

  // Find selected organization
  const selectedOrg = orgs.find(o => o.id === selectedId);

  // Compute metrics for the selected organization
  let associatedLicense = null;
  let activeScreensCount = 0;
  let totalScreensCount = 0;
  let storageUsedGB = 0;
  let storagePercentage = 0;
  let screensPercentage = 0;

  if (selectedOrg) {
    // 1. Find license profile matching the organization name or admin email
    associatedLicense = licenses.find(
      l => 
        l.assignedOrgName?.toLowerCase() === selectedOrg.name.toLowerCase() || 
        l.assignedUserEmail?.toLowerCase() === selectedOrg.email.toLowerCase()
    );

    // 2. Query screens belonging to this organization's admin email
    const orgScreens = screens.filter(s => s.assignedToUserEmail?.toLowerCase() === selectedOrg.email.toLowerCase());
    totalScreensCount = orgScreens.length;
    activeScreensCount = orgScreens.filter(s => s.status === 'online').length;

    // 3. Query actual media storage used
    const storageUsedBytes = mediaStore.getClientStorageUsedBytes(selectedOrg.email);
    storageUsedGB = Number((storageUsedBytes / (1024 * 1024 * 1024)).toFixed(2));

    const currentStorageLimit = associatedLicense ? associatedLicense.storageLimit : selectedOrg.storageLimit;
    const currentScreensLimit = associatedLicense ? associatedLicense.deviceLimit : selectedOrg.screensAllowed;

    storagePercentage = Math.min(100, Math.round((storageUsedGB / currentStorageLimit) * 100));
    screensPercentage = Math.min(100, Math.round((totalScreensCount / currentScreensLimit) * 100));
  }

  return (
    <div className="p-6 space-y-5 text-left">
      {/* Toast Alert */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white bg-slate-900 border border-slate-700 animate-slideIn">
            <CheckCircle size={16} className="text-emerald-400" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Organizations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Multi-tenant client organization directory and quotas</p>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Organization List */}
        <div className="lg:col-span-7 space-y-3">
          {orgs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
              No organizations created. Click "Add Organization" to get started.
            </div>
          ) : (
            orgs.map(org => {
              const isActive = selectedId === org.id;
              return (
                <div 
                  key={org.id} 
                  onClick={() => setSelectedId(org.id)}
                  className={`bg-white rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all flex items-center justify-between gap-4 ${
                    isActive ? 'border-blue-600 ring-4 ring-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Building2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-800 truncate">{org.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{org.adminName} · <span className="font-mono">{org.email}</span></p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border ${statusColors[org.subscriptionStatus]}`}>
                      {org.subscriptionStatus}
                    </span>
                    <ChevronRight size={16} className={`text-slate-400 transition-transform ${isActive ? 'rotate-90 text-blue-600' : ''}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Detailed Organizations Sidebar Panel */}
        <div className="lg:col-span-5">
          {selectedOrg ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              
              {/* Sidebar Header */}
              <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">{selectedOrg.name}</h2>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Admin: {selectedOrg.adminName}</p>
                </div>
              </div>

              {/* Sidebar Body */}
              <div className="p-5 space-y-5 text-xs text-slate-600">
                
                {/* 1. SUBSCRIPTION PROFILE */}
                
                {/* 2. LICENSE METRICS (Active License Details) */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Assigned License profile</h3>
                  {associatedLicense ? (
                    <div className="border border-blue-100 bg-blue-50/30 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Key size={14} className="text-blue-600" />
                          <span className="font-mono font-bold text-slate-900 text-sm">{associatedLicense.id}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                          associatedLicense.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-250' 
                            : 'bg-rose-50 text-rose-700 border-rose-250'
                        }`}>
                          {associatedLicense.status}
                        </span>
                      </div>
                  
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">License Name</p>
                          <p className="font-bold text-slate-800 mt-0.5 truncate">{associatedLicense.name}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Expiry Date</p>
                          <p className="font-mono font-bold text-slate-800 mt-0.5">{associatedLicense.expiryDate}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Billing structure</p>
                          <p className="font-bold text-slate-800 mt-0.5 capitalize">₹{associatedLicense.price.toLocaleString()} / {associatedLicense.tenure}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center text-gray-400 flex flex-col items-center justify-center gap-1">
                      <AlertTriangle size={18} className="text-amber-500" />
                      <p className="font-semibold text-xs text-slate-600">No Associated License Profile</p>
                      <p className="text-[10px] text-slate-400">Onboard client with a license key inside client management to link assets.</p>
                    </div>
                  )}
                </div>

                {/* 3. HARDWARE & SCREENS QUOTAS */}
                <div className="space-y-3.5 pt-1 border-t border-gray-150">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Device & Storage Allocation</h3>
                  
                  {/* Screen Allocation */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1"><Monitor size={13} className="text-slate-400" /> Screens Usage</span>
                      <span>{totalScreensCount} / {associatedLicense ? associatedLicense.deviceLimit : selectedOrg.screensAllowed} Allowed</span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${screensPercentage}%` }} />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mt-0.5">
                      <span>{activeScreensCount} Screen(s) Online/Active</span>
                      <span>{screensPercentage}% Allocated</span>
                    </div>
                  </div>

                  {/* Storage Allocation */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1"><HardDrive size={13} className="text-slate-400" /> Disk Space Quota</span>
                      <span>{storageUsedGB} GB / {associatedLicense ? associatedLicense.storageLimit : selectedOrg.storageLimit} GB</span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${storagePercentage}%` }} />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mt-0.5">
                      <span>Actual Uploaded Asset Size</span>
                      <span>{storagePercentage}% Consumed</span>
                    </div>
                  </div>

                </div>

                {/* White Label Configuration */}
                <div className="space-y-2 pt-3.5 border-t border-gray-150">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">White Label & Custom Domain</h3>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Custom Domain / Hostname</label>
                    <input 
                      type="text" 
                      placeholder="e.g. cms.clientcompany.com"
                      value={selectedOrg.customDomain || ''}
                      onChange={e => {
                        const updatedDomain = e.target.value;
                        const updatedOrgs = orgs.map(o => o.id === selectedOrg.id ? { ...o, customDomain: updatedDomain } : o);
                        setOrgs(updatedOrgs);
                        localStorage.setItem('signageos_organizations', JSON.stringify(updatedOrgs));
                        pushToDatabase('organizations', selectedOrg.id, { customDomain: updatedDomain }, 'PUT');
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 bg-slate-50 text-slate-800 font-semibold"
                    />
                    <span className="text-[9px] text-gray-400 mt-1 block">Point client's custom CNAME to your server to activate branding.</span>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
              <Building2 size={24} className="text-gray-300" />
              <p className="font-semibold text-xs text-slate-600">Select an organization to load detailed sidebar profile.</p>
            </div>
          )}
        </div>

      </div>

      {/* ADD ORGANIZATION MODAL */}
      {isAddOrgOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col text-left">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                <Building2 size={18} className="text-blue-600" /> Add Organization
              </h2>
              <button 
                onClick={() => setIsAddOrgOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Organization / Company Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Barista Coffee Chain"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-blue-500 bg-slate-50 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Admin Full Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Sunita Roy"
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-blue-500 bg-slate-50 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Admin Contact Email *</label>
                <input 
                  type="email" 
                  required
                  placeholder="e.g. sunita@demo.com"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-blue-500 bg-slate-50 font-mono font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Plan Tier</label>
                  <select 
                    value={planType}
                    onChange={e => setPlanType(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-blue-500 bg-white font-semibold text-slate-800"
                  >
                    <option value="Starter">Starter</option>
                    <option value="Business">Business</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Renewal Date</label>
                  <input 
                    type="date"
                    value={renewalDate}
                    onChange={e => setRenewalDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-blue-500 bg-slate-50 font-semibold text-slate-850"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Max Screens Allowed</label>
                  <input 
                    type="number"
                    required
                    value={screensAllowed}
                    onChange={e => setScreensAllowed(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Storage Limit (GB)</label>
                  <input 
                    type="number"
                    required
                    value={storageLimit}
                    onChange={e => setStorageLimit(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Custom Domain (For White-Labeling)</label>
                <input 
                  type="text" 
                  placeholder="e.g. cms.clientcompany.com"
                  value={customDomainInput}
                  onChange={e => setCustomDomainInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-blue-500 bg-slate-50 font-semibold text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button 
                  type="button"
                  onClick={() => setIsAddOrgOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Create Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
