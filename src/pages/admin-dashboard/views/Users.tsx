import { useState, useEffect } from 'react';
import { 
  Plus, Search, Edit, Trash2, X, CheckCircle, Mail, Phone, 
  MapPin, Building, Key, Lock, ArrowRight, ArrowLeft 
} from 'lucide-react';
import { mockUsers, mockOrganizations } from '../data/mockData';
import type { User as UserType } from '../types';
import { licensingStore } from '../../../lib/licensingStore';
import { pushToDatabase, generatePocketBaseId, generateClientPassword, syncCollection } from '../../../lib/syncHelper';

export default function Users() {
  const [search, setSearch] = useState('');
  
  // Persistent users list for clients
  const [users, setUsers] = useState<UserType[]>(() => {
    const data = localStorage.getItem('signageos_users');
    if (data) return JSON.parse(data);
    const initialClients = mockUsers.filter(u => u.role !== 'super_admin');
    localStorage.setItem('signageos_users', JSON.stringify(initialClients));
    return initialClients;
  });

  // Track active licenses for assignments
  const [licenses, setLicenses] = useState(() => licensingStore.getLicenses());
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  // Refresh from server on mount
  useEffect(() => {
    syncCollection('users', 'signageos_users').then(serverUsers => {
      if (serverUsers.length > 0) {
        setUsers(serverUsers.filter((u: any) => u.role !== 'super_admin' && u.role !== 'admin'));
      }
    });
    syncCollection('licenses', 'signageos_licenses').then(() => {
      setLicenses(licensingStore.getLicenses());
    });
    syncCollection('organizations', 'signageos_organizations');
  }, []);

  // Add Client Modal states
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [isOnboarding, setIsOnboarding] = useState(false);

  // Form states
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [orgName, setOrgName] = useState('');
  const [selectedLicenseId, setSelectedLicenseId] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [sendEmail, setSendEmail] = useState(true);

  // Edit Modal states
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editOrg, setEditOrg] = useState('');

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts(p => [...p, { id, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };

  const resetForm = () => {
    setStep(1);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientAddress('');
    setOrgName('');
    setSelectedLicenseId('');
    setGeneratedPassword('');
    setSendEmail(true);
    setIsOnboarding(false);
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim()) {
        addToast("Please fill in Name, Email, and Phone number.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!orgName.trim()) {
        addToast("Please enter an Organization name.");
        return;
      }
      if (!selectedLicenseId) {
        addToast("Assigning a license is mandatory. Please select a license from the pool.");
        return;
      }
      // Auto-generate password upon entering step 3 if empty
      if (!generatedPassword) {
        setGeneratedPassword(generateClientPassword(clientName));
      }
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setStep(p => Math.max(1, p - 1));
  };

  const handleGeneratePassword = () => {
    setGeneratedPassword(generateClientPassword(clientName));
    addToast("New random password generated!");
  };

  const handleOnboardClient = async () => {
    setIsOnboarding(true);
    try {
      const userPayload = {
        name: clientName,
        email: clientEmail,
        mobile: clientPhone,
        address: clientAddress,
        company: orgName,
        licenseId: selectedLicenseId,
        password: generatedPassword,
        sendEmail: sendEmail,
        role: 'org_admin'
      };

      const userResult = await pushToDatabase('users', '', userPayload, 'POST');
      if (!userResult.ok) {
        const errorText = (userResult as any).error;
        let errMsg = 'unknown error';
        if (typeof errorText === 'string') {
          try {
            const parsed = JSON.parse(errorText);
            errMsg = parsed.error || parsed.message || errorText;
          } catch (e) {
            errMsg = errorText;
          }
        }
        addToast(`Failed to onboard client: ${errMsg}`);
        setIsOnboarding(false);
        return;
      }

      // Sync all collections from backend server to update local listings
      const updatedUsers = await syncCollection('users', 'signageos_users');
      await syncCollection('licenses', 'signageos_licenses');
      await syncCollection('organizations', 'signageos_organizations');

      // Update React state
      if (updatedUsers && updatedUsers.length > 0) {
        setUsers(updatedUsers.filter((u: any) => u.role !== 'super_admin' && u.role !== 'admin'));
      }
      setLicenses(licensingStore.getLicenses());

      addToast(`Client onboarded successfully!${sendEmail ? ` Credentials emailed to ${clientEmail}` : ''}`);
      setIsAddClientOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error in onboard flow:', error);
      addToast(`An unexpected error occurred: ${error.message || error}`);
      setIsOnboarding(false);
    }
  };

  const handleDeleteClient = (userId: string, userEmail: string, userName: string) => {
    if (confirm(`Are you sure you want to remove client "${userName}"? This will unassign any active license from their account.`)) {
      // Clear license assignment in licensing store
      const associatedLic = licenses.find(l => l.assignedUserEmail === userEmail);
      if (associatedLic) {
        licensingStore.updateLicense(associatedLic.id, {
          assignedUserEmail: undefined,
          assignedOrgName: undefined,
          assignedOrgId: undefined
        });
        setLicenses(licensingStore.getLicenses());
      }

      const updated = users.filter(u => u.id !== userId);
      setUsers(updated);
      localStorage.setItem('signageos_users', JSON.stringify(updated));
      pushToDatabase('users', userId, null, 'DELETE');
      addToast(`Client "${userName}" has been successfully removed.`);
    }
  };

  const handleOpenEdit = (user: UserType) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditPhone(user.mobile);
    setEditAddress(user.address || '');
    setEditOrg(user.company);
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    if (!editName.trim() || !editPhone.trim() || !editOrg.trim()) {
      addToast("Please fill out all required fields.");
      return;
    }

    // Update user details
    const updated = users.map(u => u.id === editingUser.id ? {
      ...u,
      name: editName,
      mobile: editPhone,
      address: editAddress,
      company: editOrg
    } : u);

    // Sync license assignment org name if client email matches
    const associatedLic = licenses.find(l => l.assignedUserEmail === editingUser.email);
    if (associatedLic) {
      licensingStore.updateLicense(associatedLic.id, {
        assignedOrgName: editOrg
      });
      setLicenses(licensingStore.getLicenses());
    }

    // Sync organization name in signageos_organizations if it matches the editing company name
    const orgsData = localStorage.getItem('signageos_organizations');
    if (orgsData) {
      let orgList = JSON.parse(orgsData);
      orgList = orgList.map((o: any) => {
        if (o.name.toLowerCase() === editingUser.company.toLowerCase()) {
          const updatedOrg = { ...o, name: editOrg };
          pushToDatabase('organizations', o.id, updatedOrg, 'PUT');
          return updatedOrg;
        }
        return o;
      });
      localStorage.setItem('signageos_organizations', JSON.stringify(orgList));
    }

    setUsers(updated);
    localStorage.setItem('signageos_users', JSON.stringify(updated));
    const updatedUser = updated.find(u => u.id === editingUser.id);
    if (updatedUser) {
      pushToDatabase('users', editingUser.id, updatedUser, 'PUT');
    }
    setEditingUser(null);
    addToast("Client details updated successfully.");
  };

  // Filter clients based on search query
  const filteredClients = users.filter(u => {
    const term = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.company.toLowerCase().includes(term)
    );
  });

  // Filter unassigned licenses
  const unassignedLicenses = licenses.filter(l => !l.assignedUserEmail);

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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} clients registered in the system</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsAddClientOpen(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={16} /> Add Client
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Search clients by name, email, or organization..." 
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400" 
        />
      </div>

      {/* Clients Table (Formatted exact to licensing page layout) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5">Client</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Phone Number</th>
                <th className="px-5 py-3.5">Organization</th>
                <th className="px-5 py-3.5">License Details</th>
                <th className="px-5 py-3.5">License Expiry</th>
                <th className="px-5 py-3.5">Screens Assigned</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-slate-600">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-gray-400">
                    No clients found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredClients.map(user => {
                  // Find license for user
                  const userLicense = licenses.find(l => l.assignedUserEmail === user.email);

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center font-bold text-white text-xs flex-shrink-0">
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800">{user.name}</span>
                            {user.address && (
                              <p className="text-[10px] text-gray-400 truncate max-w-[150px] font-medium mt-0.5">{user.address}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-500 font-semibold">{user.email}</td>
                      <td className="px-5 py-4 font-semibold text-slate-600">{user.mobile}</td>
                      <td className="px-5 py-4 font-bold text-slate-800">{user.company}</td>
                      <td className="px-5 py-4">
                        {userLicense ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900">
                              {userLicense.id}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-semibold capitalize">
                              {userLicense.tenure}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-600">
                        {userLicense ? userLicense.expiryDate : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-[10.5px] text-slate-600 font-semibold space-y-0.5">
                          <p>Screens: <span className="text-slate-900 font-bold">{user.screensAssigned} Max</span></p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button 
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Client"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteClient(user.id, user.email, user.name)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove Client"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD CLIENT WIZARD MODAL */}
      {isAddClientOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Add New Client</h2>
                <p className="text-xs text-gray-500 mt-0.5">Onboard a client organization and assign license profiles</p>
              </div>
              <button 
                onClick={() => setIsAddClientOpen(false)}
                className="text-gray-400 hover:text-gray-650 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stepper Wizard Progress */}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center justify-between text-xs font-semibold text-gray-500">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>1</span>
                <span className={step >= 1 ? 'text-blue-600' : ''}>Client Details</span>
              </div>
              <div className="w-10 h-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>2</span>
                <span className={step >= 2 ? 'text-blue-600' : ''}>Org & License</span>
              </div>
              <div className="w-10 h-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>3</span>
                <span className={step === 3 ? 'text-blue-600' : ''}>Summary</span>
              </div>
            </div>

            {/* Wizard Body content */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              
              {/* STEP 1: CLIENT DETAILS */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Client Full Name *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Priyan Sharma"
                      value={clientName} 
                      onChange={e => setClientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address *</label>
                    <input 
                      type="email" 
                      placeholder="e.g. priya@demo.com"
                      value={clientEmail} 
                      onChange={e => setClientEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50 font-mono font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone Number *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. +91 99999 99999"
                      value={clientPhone} 
                      onChange={e => setClientPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Billing / Office Address</label>
                    <textarea 
                      placeholder="Enter physical address..."
                      rows={3}
                      value={clientAddress} 
                      onChange={e => setClientAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50 resize-none font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: ORGANIZATION & LICENSE */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Organization / Company Name *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Phoenix Mall Group"
                      value={orgName} 
                      onChange={e => setOrgName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50 font-semibold"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Assign Licensing Profile *</label>
                    {unassignedLicenses.length === 0 ? (
                      <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-medium">
                        No unassigned licenses found in the pool. Assigning a license is mandatory. Please go to the "Licensing" section to create an active license first before onboarding this client.
                      </div>
                    ) : (
                      <select 
                        required
                        value={selectedLicenseId} 
                        onChange={e => setSelectedLicenseId(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-white font-semibold"
                      >
                        <option value="">Select a license...</option>
                        {unassignedLicenses.map(lic => (
                          <option key={lic.id} value={lic.id}>
                            {lic.id} - {lic.name} ({lic.deviceLimit} Screens, {lic.tenure})
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">Assigning a license is mandatory. Only unassigned licenses are listed. Each license can only be allocated to a single client.</p>
                  </div>
                </div>
              )}

              {/* STEP 3: SUMMARY & CREDENTIALS */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Summary card */}
                  <div className="border border-gray-150 rounded-xl p-4 bg-slate-50/50 space-y-2 text-xs">
                    <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-1.5 mb-2 uppercase text-[10px] tracking-wider">Client Onboarding Summary</h3>
                    <div className="grid grid-cols-3 gap-y-1.5 text-gray-600">
                      <span className="font-medium text-gray-400">Name:</span>
                      <span className="col-span-2 text-gray-900 font-semibold">{clientName}</span>
                      
                      <span className="font-medium text-gray-400">Email:</span>
                      <span className="col-span-2 text-gray-900 font-mono font-semibold">{clientEmail}</span>
                      
                      <span className="font-medium text-gray-400">Phone:</span>
                      <span className="col-span-2 text-gray-900 font-semibold">{clientPhone}</span>
                      
                      <span className="font-medium text-gray-400">Organization:</span>
                      <span className="col-span-2 text-gray-900 font-semibold">{orgName}</span>
                      
                      <span className="font-medium text-gray-400">Address:</span>
                      <span className="col-span-2 text-gray-800 font-semibold">{clientAddress || '—'}</span>

                      <span className="font-medium text-gray-400">License:</span>
                      <span className="col-span-2 text-blue-700 font-bold">
                        {selectedLicenseId ? `${selectedLicenseId} (${licenses.find(l => l.id === selectedLicenseId)?.name})` : 'No License Assigned'}
                      </span>
                    </div>
                  </div>

                  {/* Password Generation */}
                  <div className="border border-gray-150 rounded-xl p-4 space-y-3 bg-white">
                    <h3 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                      <Lock size={14} className="text-blue-600" /> Account Security Credentials
                    </h3>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Lock size={14} className="absolute left-3 top-3 text-gray-400" />
                        <input 
                          type="text" 
                          readOnly 
                          value={generatedPassword}
                          placeholder="Generate simple login password..."
                          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-slate-50 font-semibold font-mono text-slate-800 outline-none"
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={handleGeneratePassword}
                        className="px-4 py-2.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                      >
                        Generate Password
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium">Generated password formula: [first-name][4-digits] (e.g. john1829)</p>
                  </div>

                  {/* Mailing checkbox */}
                  <div className="flex items-start gap-2.5 p-1">
                    <input 
                      type="checkbox" 
                      id="sendEmailBox"
                      checked={sendEmail} 
                      onChange={e => setSendEmail(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="sendEmailBox" className="text-xs text-gray-600 font-medium cursor-pointer">
                      <strong>Email credentials to client automatically</strong>
                      <span className="block text-[10px] text-gray-400 mt-0.5 font-medium">Sends welcome instructions, login details, and assigned license parameters immediately.</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <div>
                {step > 1 && (
                  <button 
                    onClick={handlePrevStep}
                    className="flex items-center gap-1 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={15} /> Back
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsAddClientOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-gray-650 hover:bg-gray-150 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                
                {step < 3 ? (
                  <button 
                    onClick={handleNextStep}
                    disabled={step === 2 && unassignedLicenses.length === 0}
                    className="flex items-center gap-1 px-4.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Next <ArrowRight size={15} />
                  </button>
                ) : (
                  <button 
                    onClick={handleOnboardClient}
                    disabled={!generatedPassword || isOnboarding}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isOnboarding ? 'Onboarding...' : 'Confirm & Onboard'}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* EDIT CLIENT DETAILS MODAL */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden text-left">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Edit Client Details</h2>
                <p className="text-xs text-gray-500 mt-0.5">Modify profile information for <strong>{editingUser.name}</strong></p>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-650 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Client Full Name *</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone Number *</label>
                <input 
                  type="text" 
                  value={editPhone} 
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Organization / Company Name *</label>
                <input 
                  type="text" 
                  value={editOrg} 
                  onChange={e => setEditOrg(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Address</label>
                <textarea 
                  rows={2}
                  value={editAddress} 
                  onChange={e => setEditAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50 resize-none font-semibold"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button 
                onClick={() => setEditingUser(null)}
                className="px-4 py-2.5 text-sm font-semibold text-gray-650 hover:bg-gray-150 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
