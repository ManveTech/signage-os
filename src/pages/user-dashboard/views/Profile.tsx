import React, { useState, useEffect } from 'react';
import {
  User, Lock, Shield, Key, LogOut, Eye, EyeOff, Copy, RefreshCw,
  Camera, CheckCircle, CreditCard, Mail, Phone, Image, Globe
} from 'lucide-react';
import { pushToDatabase, syncCollection } from '../../../lib/syncHelper';
import { licensingStore } from '../../../lib/licensingStore';
import { API_BASE } from '../../../config';
import { getAuthToken } from '../../../lib/authStorage';

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

  // Change Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Seed name/mobile from the real account record — the localStorage-based
  // guess above (namePrefix + ' User') is only ever right by coincidence.
  useEffect(() => {
    const userId = localStorage.getItem('signageos_user_id');
    const token = getAuthToken();
    if (!userId) return;

    fetch(`${API_BASE}/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Failed to load profile');
      })
      .then(data => {
        if (data.name) {
          setName(data.name);
          localStorage.setItem(`signageos_user_name_${userEmail}`, data.name);
        }
        if (data.mobile) {
          setMobile(data.mobile);
          localStorage.setItem(`signageos_user_mobile_${userEmail}`, data.mobile);
        }
        // avatarUrl (not the raw base64) is the real, server-stored photo —
        // takes over from whatever base64 blob was cached locally before.
        if (data.avatarUrl !== undefined) {
          setAvatar(data.avatarUrl);
          localStorage.setItem(`signageos_user_avatar_${userEmail}`, data.avatarUrl);
        }
      })
      .catch(err => {
        console.warn('Error loading profile from server:', err);
      });
  }, [userEmail]);

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

  // Previously this only ever set local component state from a FileReader
  // data URL — the image never left the browser, so it didn't survive a
  // reload from a different browser/device and no one else could see it.
  // This now actually uploads to the account's real `avatar` file field.
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Avatar must be an image file.');
      return;
    }
    const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_AVATAR_BYTES) {
      showToast('Avatar image is too large (max 2MB).');
      return;
    }

    const userId = localStorage.getItem('signageos_user_id');
    const token = getAuthToken();
    if (!userId) {
      showToast('Not signed in — cannot upload avatar.');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64Data = dataUrl.split(',')[1];

      const res = await fetch(`${API_BASE}/users/${userId}/avatar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ avatarData: base64Data, mimeType: file.type, fileName: file.name })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to upload avatar.');
        return;
      }

      const data = await res.json();
      setAvatar(data.avatarUrl || '');
      localStorage.setItem(`signageos_user_avatar_${userEmail}`, data.avatarUrl || '');
      window.dispatchEvent(new Event('signageos_user_profile_updated'));
      showToast('Avatar updated successfully!');
    } catch (err) {
      console.error('Error uploading avatar:', err);
      showToast('Network error uploading avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    const userId = localStorage.getItem('signageos_user_id');
    const token = getAuthToken();
    if (!userId) return;

    setIsUploadingAvatar(true);
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/avatar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ removeAvatar: true })
      });
      if (!res.ok) {
        showToast('Failed to remove avatar.');
        return;
      }
      setAvatar('');
      localStorage.setItem(`signageos_user_avatar_${userEmail}`, '');
      window.dispatchEvent(new Event('signageos_user_profile_updated'));
      showToast('Avatar removed.');
    } catch (err) {
      console.error('Error removing avatar:', err);
      showToast('Network error removing avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfileDetails = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(`signageos_user_name_${userEmail}`, name);
    localStorage.setItem(`signageos_user_email_${userEmail}`, email);
    localStorage.setItem(`signageos_user_mobile_${userEmail}`, mobile);
    // Avatar isn't part of this form anymore — it uploads immediately via
    // handleAvatarUpload as soon as a file is picked, not deferred to save.

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

  // Previously this button just showed a success toast unconditionally —
  // nothing was validated or saved. This verifies the current password (by
  // re-authenticating with it — there's no separate "verify password"
  // endpoint) before actually saving the new one.
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showToast('Fill in all three password fields.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters.');
      return;
    }
    const userId = localStorage.getItem('signageos_user_id');
    if (!userId || !email) {
      showToast('Not signed in — cannot change password.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const verifyRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: currentPassword })
      });
      if (!verifyRes.ok) {
        showToast('Current password is incorrect.');
        return;
      }

      const result = await pushToDatabase('users', userId, {
        password: newPassword,
        passwordConfirm: newPassword,
        currentPassword
      }, 'PUT');

      if (!result.ok) {
        const rawError = (result as any).error;
        let errMsg = 'Failed to update password — please try again.';
        if (typeof rawError === 'string') {
          try {
            const parsed = JSON.parse(rawError);
            errMsg = parsed.error || parsed.message || errMsg;
          } catch {
            errMsg = rawError || errMsg;
          }
        }
        showToast(errMsg);
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showToast('Console password successfully modified.');
    } catch (err) {
      console.error('Error changing password:', err);
      showToast('Network error changing password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4 sm:space-y-6 text-left relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 z-50 animate-slideIn">
          <CheckCircle size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div>
        <h1 className="display text-2xl sm:text-3xl text-ink-950">Profile</h1>
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
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded mt-1 inline-block">
              Client Console User
            </span>
          </div>

          {avatar && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={isUploadingAvatar}
              className="px-2.5 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer"
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

      {/* Website Custom Branding Card */}
      {isWhiteLabelEnabled && (
        <form onSubmit={handleSaveBranding} className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
            <Globe size={16} className="text-blue-600" />
            <h2 className="text-xs font-bold uppercase text-gray-900 tracking-wider">Website Custom Branding</h2>
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
              <label className="mt-2 inline-block px-3 py-1.5 text-[10px] text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer font-bold uppercase tracking-wider select-none">
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
            <label className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1.5">Company Name / Website Name</label>
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
        <h2 className="text-xs font-bold uppercase text-gray-900 tracking-wider flex items-center gap-2 mb-4"><Lock size={15} className="text-blue-600" /> Change Console Password</h2>
        <div className="space-y-3.5 max-w-sm text-xs font-semibold">
          {[
            { label: 'Current Password', value: currentPassword, setValue: setCurrentPassword },
            { label: 'New Password', value: newPassword, setValue: setNewPassword },
            { label: 'Confirm New Password', value: confirmNewPassword, setValue: setConfirmNewPassword }
          ].map(({ label, value, setValue }) => (
            <div key={label}>
              <label className="block text-gray-600 mb-1.5">{label}</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 pr-10"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={isSavingPassword}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer text-xs font-bold"
          >
            {isSavingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
