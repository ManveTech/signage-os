import React, { useState, useEffect } from 'react';
import { 
  User, Lock, Shield, Key, LogOut, Eye, EyeOff, Copy, RefreshCw, 
  Camera, CheckCircle, CreditCard, Mail, Phone, Image, Globe
} from 'lucide-react';
import { pushToDatabase, syncCollection } from '../../../lib/syncHelper';
import { licensingStore } from '../../../lib/licensingStore';

interface Props {
  userEmail?: string;
}

export default function Profile({ userEmail = 'priya@demo.com' }: Props) {
  const [showPass, setShowPass] = useState(false);

  // Profile details state (persisted locally under userEmail namespaces)
  const [name, setName] = useState(() => {
    const stored = localStorage.getItem(`signageos_user_name_${userEmail}`);
    if (stored) return stored;
    const namePrefix = userEmail.split('@')[0];
    return namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1) + ' User';
  });
  const [email, setEmail] = useState(() => localStorage.getItem(`signageos_user_email_${userEmail}`) || userEmail);
  const [mobile, setMobile] = useState(() => localStorage.getItem(`signageos_user_mobile_${userEmail}`) || '+91 88990 01122');
  const [avatar, setAvatar] = useState(() => localStorage.getItem(`signageos_user_avatar_${userEmail}`) || '');

  // Razorpay credentials state
  const [rzpKeyId, setRzpKeyId] = useState(() => localStorage.getItem(`signageos_user_rzp_key_${userEmail}`) || '');
  const [rzpKeySecret, setRzpKeySecret] = useState(() => localStorage.getItem(`signageos_user_rzp_secret_${userEmail}`) || '');
  const [showRzpKey, setShowRzpKey] = useState(false);
  const [showRzpSecret, setShowRzpSecret] = useState(false);

  // Custom branding states (persisted locally and synced with db)
  const [companyLogo, setCompanyLogo] = useState(() => localStorage.getItem('signageos_client_logo') || '');
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('signageos_client_name') || 'SignageOS');
  
  // Retrieve license configuration (refresh from server on mount)
  const [licenses, setLicenses] = useState(() => licensingStore.getLicenses());
  const lic = licenses.find(l => l.assignedUserEmail === userEmail);
  const isWhiteLabelEnabled = lic ? !!lic.whiteLabel : false;

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    // Reload state if userEmail changes
    const storedName = localStorage.getItem(`signageos_user_name_${userEmail}`);
    if (storedName) {
      setName(storedName);
    } else {
      const namePrefix = userEmail.split('@')[0];
      setName(namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1) + ' User');
    }
    setEmail(localStorage.getItem(`signageos_user_email_${userEmail}`) || userEmail);
    setMobile(localStorage.getItem(`signageos_user_mobile_${userEmail}`) || '+91 88990 01122');
    setAvatar(localStorage.getItem(`signageos_user_avatar_${userEmail}`) || '');
    setRzpKeyId(localStorage.getItem(`signageos_user_rzp_key_${userEmail}`) || '');
    setRzpKeySecret(localStorage.getItem(`signageos_user_rzp_secret_${userEmail}`) || '');

    // Sync database collections
    Promise.all([
      syncCollection('licenses', 'signageos_licenses'),
      syncCollection('organizations', 'signageos_organizations'),
      syncCollection('users', 'signageos_users')
    ]).then(() => {
      const storedLicenses = licensingStore.getLicenses();
      setLicenses(storedLicenses);
      
      const activeLic = storedLicenses.find(l => l.assignedUserEmail === userEmail);
      if (activeLic) {
        const orgsData = localStorage.getItem('signageos_organizations');
        const orgs = orgsData ? JSON.parse(orgsData) : [];
        const usersData = localStorage.getItem('signageos_users');
        const users = usersData ? JSON.parse(usersData) : [];
        const currentUser = users.find((u: any) => u.email === userEmail);
        const myOrg = orgs.find((o: any) => o.id === activeLic.assignedOrgId || o.name === activeLic.assignedOrgName || o.name === currentUser?.company);
        
        if (myOrg) {
          setCompanyLogo(myOrg.websiteLogo || localStorage.getItem('signageos_client_logo') || '');
          setCompanyName(myOrg.websiteName || localStorage.getItem('signageos_client_name') || myOrg.name || 'SignageOS');
        }
      }
    });
  }, [userEmail]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfileDetails = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(`signageos_user_name_${userEmail}`, name);
    localStorage.setItem(`signageos_user_email_${userEmail}`, email);
    localStorage.setItem(`signageos_user_mobile_${userEmail}`, mobile);
    localStorage.setItem(`signageos_user_avatar_${userEmail}`, avatar);

    // Sync profile to server
    const userId = localStorage.getItem('signageos_user_id');
    if (userId) {
      pushToDatabase('users', userId, { name, mobile }, 'PUT');
    }

    // Notify sidebar and headers
    window.dispatchEvent(new Event('signageos_user_profile_updated'));
    showToast('Profile details updated successfully!');
  };

  const handleSaveRazorpayCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(`signageos_user_rzp_key_${userEmail}`, rzpKeyId);
    localStorage.setItem(`signageos_user_rzp_secret_${userEmail}`, rzpKeySecret);

    // Notify sidebar and headers
    window.dispatchEvent(new Event('signageos_user_profile_updated'));
    showToast('Razorpay credentials updated successfully!');
  };

  const handleCompanyLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isWhiteLabelEnabled) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    if (isWhiteLabelEnabled) {
      localStorage.setItem('signageos_client_logo', companyLogo);
      localStorage.setItem('signageos_client_name', companyName);

      // Save to database
      const orgsData = localStorage.getItem('signageos_organizations');
      const orgs = orgsData ? JSON.parse(orgsData) : [];
      const usersData = localStorage.getItem('signageos_users');
      const users = usersData ? JSON.parse(usersData) : [];
      const currentUser = users.find((u: any) => u.email === userEmail);
      const myOrg = orgs.find((o: any) => o.id === lic?.assignedOrgId || o.name === lic?.assignedOrgName || o.name === currentUser?.company);

      if (myOrg) {
        const updatedOrg = {
          ...myOrg,
          websiteLogo: companyLogo,
          websiteName: companyName
        };
        pushToDatabase('organizations', myOrg.id, updatedOrg, 'PUT').then((res) => {
          if (res.ok && res.data) {
            const updatedOrgs = orgs.map((o: any) => o.id === myOrg.id ? res.data : o);
            localStorage.setItem('signageos_organizations', JSON.stringify(updatedOrgs));
          }
        });
      }
    }
    // Dispatch custom event to notify sidebar of change
    window.dispatchEvent(new Event('signageos_branding_updated'));
    showToast('Branding settings saved successfully!');
  };

  const handleCopy = (text: string, type: string) => {
    if (!text) {
      showToast(`${type} is empty!`);
      return;
    }
    navigator.clipboard.writeText(text);
    showToast(`${type} copied to clipboard!`);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 text-left relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 z-50 animate-slideIn">
          <CheckCircle size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your user profile and billing integration credentials</p>
      </div>

      {/* Profile Details Form Card */}
      <form onSubmit={handleSaveProfileDetails} className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-2">
          {/* Avatar upload */}
          <div className="relative group w-20 h-20 shrink-0">
            {avatar ? (
              <img src={avatar} className="w-full h-full rounded-2xl object-cover border border-gray-200" alt="Profile avatar" />
            ) : (
              <div className="w-full h-full rounded-2xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-white text-xl font-bold">
                {name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[9px] rounded-2xl cursor-pointer transition-opacity font-bold uppercase tracking-wider select-none">
              <Camera size={14} className="mb-0.5" />
              Upload
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleAvatarUpload} 
                className="hidden" 
              />
            </label>
          </div>
          
          <div className="text-center sm:text-left flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{name}</h2>
            <p className="text-xs text-gray-400 font-mono font-semibold">{email}</p>
            <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded mt-1 inline-block">
              Client Console User
            </span>
          </div>

          {avatar && (
            <button 
              type="button" 
              onClick={() => setAvatar('')}
              className="px-2.5 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer"
            >
              Remove Picture
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
          <div>
            <label className="block text-gray-600 mb-1.5">Full Name</label>
            <input 
              type="text"
              required
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 font-bold text-gray-800" 
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1.5">Email Address</label>
            <input 
              type="email"
              required
              value={email} 
              disabled
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 font-mono font-bold text-gray-400 bg-gray-50 cursor-not-allowed" 
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1.5">Mobile Phone</label>
            <input 
              type="text"
              required
              value={mobile} 
              onChange={e => setMobile(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 font-bold text-gray-800" 
            />
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-50">
          <button 
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Save Profile Details
          </button>
        </div>
      </form>

      {/* Razorpay Key and Secret Billing configs (Replaces API key) */}
      <form onSubmit={handleSaveRazorpayCredentials} className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
          <CreditCard size={16} className="text-blue-600" />
          <h2 className="text-xs font-black uppercase text-gray-900 tracking-wider">Razorpay Payment Integration</h2>
        </div>
        
        <p className="text-[11px] text-gray-500 font-semibold leading-relaxed">
          Configure your custom Razorpay API credentials to handle direct license billing, automatic renewals, and checkout updates.
        </p>

        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Razorpay Key ID</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Key size={14} className="absolute left-3 top-3 text-gray-400" />
                <input 
                  type={showRzpKey ? 'text' : 'password'}
                  placeholder="e.g. rzp_live_xxxxxxxxxxxxxx"
                  value={rzpKeyId}
                  onChange={e => setRzpKeyId(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-blue-400 font-mono text-gray-700"
                />
                <button 
                  type="button" 
                  onClick={() => setShowRzpKey(!showRzpKey)} 
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showRzpKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button 
                type="button" 
                onClick={() => handleCopy(rzpKeyId, 'Razorpay Key ID')}
                className="px-3.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="Copy Key ID"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Razorpay Key Secret</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Lock size={14} className="absolute left-3 top-3 text-gray-400" />
                <input 
                  type={showRzpSecret ? 'text' : 'password'}
                  placeholder="e.g. sec_live_xxxxxxxxxxxxxx"
                  value={rzpKeySecret}
                  onChange={e => setRzpKeySecret(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-blue-400 font-mono text-gray-700"
                />
                <button 
                  type="button" 
                  onClick={() => setShowRzpSecret(!showRzpSecret)} 
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showRzpSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button 
                type="button" 
                onClick={() => handleCopy(rzpKeySecret, 'Razorpay Key Secret')}
                className="px-3.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="Copy Key Secret"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-50">
          <button 
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Save Credentials
          </button>
        </div>
      </form>

      {/* Website Custom Branding Card */}
      {isWhiteLabelEnabled && (
        <form onSubmit={handleSaveBranding} className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
            <Globe size={16} className="text-blue-600" />
            <h2 className="text-xs font-black uppercase text-gray-900 tracking-wider">Website Custom Branding</h2>
          </div>
          
          <p className="text-[11px] text-gray-500 font-semibold leading-relaxed">
            Customize your website brand name and brand logo. The logo will also be downloaded to your paired signage screens and used on the app splash screen.
          </p>

          <div className="flex items-center gap-5 pt-1">
            {companyLogo ? (
              <div className="relative w-20 h-20 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center group shrink-0">
                <img src={companyLogo} alt="Company Logo" className="w-full h-full object-contain" />
                <button 
                  type="button"
                  onClick={() => setCompanyLogo('')}
                  className="absolute inset-0 bg-rose-600/90 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider transition-opacity cursor-pointer duration-200"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 shrink-0">
                <Image size={24} className="text-gray-400" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-gray-900">Company Logo</p>
              <p className="text-[10px] text-gray-400 mt-0.5">PNG or SVG format (recommended)</p>
              <label className="mt-2 inline-block px-3 py-1.5 text-[10px] text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer font-black uppercase tracking-wider select-none">
                Upload Logo
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleCompanyLogoUpload} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1.5">Company Name / Website Name</label>
            <input 
              type="text"
              required
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-blue-400 font-bold text-gray-800"
            />
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-50">
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Save Branding Settings
            </button>
          </div>
        </form>
      )}

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-xs font-black uppercase text-gray-900 tracking-wider flex items-center gap-2 mb-4"><Lock size={15} className="text-blue-600" /> Change Console Password</h2>
        <div className="space-y-3.5 max-w-sm text-xs font-semibold">
          {['Current Password', 'New Password', 'Confirm New Password'].map(label => (
            <div key={label}>
              <label className="block text-gray-600 mb-1.5">{label}</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} placeholder="••••••••" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 pr-10" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => showToast('Console password successfully modified.')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer text-xs font-bold">Update Password</button>
        </div>
      </div>
    </div>
  );
}
