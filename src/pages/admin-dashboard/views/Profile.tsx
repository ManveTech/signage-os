import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../../config';
import { 
  User, Lock, Shield, Key, LogOut, Eye, EyeOff, Copy, RefreshCw, 
  Camera, CheckCircle, CreditCard, Mail, Phone, ShieldAlert
} from 'lucide-react';
import { pushToDatabase } from '../../../lib/syncHelper';

export default function Profile() {
  const [showPass, setShowPass] = useState(false);

  // Profile fields — seeded from localStorage only as a fast-paint placeholder
  // while the real record loads; the useEffect below overwrites all three
  // with the actual signed-in account from the server. Previously these were
  // never fetched at all, so every admin saw whatever was last cached in this
  // browser's localStorage (or the hardcoded 'Super Admin'/'admin@demo.com'
  // defaults on a fresh browser) instead of their real name/email/mobile.
  const [name, setName] = useState(() => localStorage.getItem('signageos_admin_name') || 'Super Admin');
  const [email, setEmail] = useState(() => localStorage.getItem('signageos_admin_email') || 'admin@demo.com');
  const [mobile, setMobile] = useState(() => localStorage.getItem('signageos_admin_mobile') || '+91 99999 99999');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('signageos_admin_avatar') || '');

  // Change Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Razorpay Key & Secret state
  const [rzpKeyId, setRzpKeyId] = useState(() => localStorage.getItem('signageos_admin_rzp_key') || 'rzp_live_demo83920194');
  const [rzpKeySecret, setRzpKeySecret] = useState(() => localStorage.getItem('signageos_admin_rzp_secret') || 'sec_live_92019483984');
  const [showRzpKey, setShowRzpKey] = useState(false);
  const [showRzpSecret, setShowRzpSecret] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load the real signed-in admin's own record on mount — this is the actual
  // fix: without it, the fields above never reflect who's really logged in.
  useEffect(() => {
    const userId = localStorage.getItem('signageos_user_id');
    const token = localStorage.getItem('signageos_token');
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
          localStorage.setItem('signageos_admin_name', data.name);
        }
        if (data.email) {
          setEmail(data.email);
          localStorage.setItem('signageos_admin_email', data.email);
        }
        if (data.mobile) {
          setMobile(data.mobile);
          localStorage.setItem('signageos_admin_mobile', data.mobile);
        }
        // avatarUrl (not the raw base64) is the real, server-stored photo —
        // takes over from whatever base64 blob was cached locally before.
        if (data.avatarUrl !== undefined) {
          setAvatar(data.avatarUrl);
          localStorage.setItem('signageos_admin_avatar', data.avatarUrl);
        }
      })
      .catch(err => {
        console.warn('Error loading admin profile from server:', err);
      });
  }, []);

  // Load Razorpay config on mount
  useEffect(() => {
    const token = localStorage.getItem('signageos_token');
    fetch(`${API_BASE}/payments/config`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => {
      if (res.ok) return res.json();
      throw new Error('Failed to load keys');
    })
    .then(data => {
      if (data.keyId) {
        setRzpKeyId(data.keyId);
        localStorage.setItem('signageos_admin_rzp_key', data.keyId);
      }
      if (data.keySecret) {
        setRzpKeySecret(data.keySecret);
        localStorage.setItem('signageos_admin_rzp_secret', data.keySecret);
      }
    })
    .catch(err => {
      console.warn('Error loading remote Razorpay config:', err);
    });
  }, []);

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
    const token = localStorage.getItem('signageos_token');
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
      localStorage.setItem('signageos_admin_avatar', data.avatarUrl || '');
      window.dispatchEvent(new Event('signageos_admin_profile_updated'));
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
    const token = localStorage.getItem('signageos_token');
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
      localStorage.setItem('signageos_admin_avatar', '');
      window.dispatchEvent(new Event('signageos_admin_profile_updated'));
      showToast('Avatar removed.');
    } catch (err) {
      console.error('Error removing avatar:', err);
      showToast('Network error removing avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault();

    const userId = localStorage.getItem('signageos_user_id');
    if (!userId) {
      showToast('Not signed in — cannot save profile.');
      return;
    }

    // Email isn't included: it's the PocketBase login identifier, and
    // changing it here without re-verification could lock the account out.
    const result = await pushToDatabase('users', userId, { name, mobile }, 'PUT');
    if (!result.ok) {
      showToast('Failed to save profile — please try again.');
      return;
    }

    localStorage.setItem('signageos_admin_name', name);
    localStorage.setItem('signageos_admin_mobile', mobile);
    // Avatar isn't part of this form anymore — it uploads immediately via
    // handleAvatarUpload as soon as a file is picked, not deferred to save.

    // Notify sidebar and headers
    window.dispatchEvent(new Event('signageos_admin_profile_updated'));
    showToast('Profile details updated successfully!');
  };

  const handleSaveRazorpayCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('signageos_admin_rzp_key', rzpKeyId);
    localStorage.setItem('signageos_admin_rzp_secret', rzpKeySecret);

    const token = localStorage.getItem('signageos_token');
    fetch(`${API_BASE}/payments/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        keyId: rzpKeyId,
        keySecret: rzpKeySecret
      })
    })
    .then(async res => {
      if (res.ok) {
        // Notify sidebar and headers
        window.dispatchEvent(new Event('signageos_admin_profile_updated'));
        showToast('Razorpay credentials updated & saved to server .env!');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(`Failed to save to server: ${errData.message || 'Unknown error'}`);
      }
    })
    .catch(err => {
      console.error('Error saving Razorpay credentials:', err);
      showToast('Network error saving credentials to server.');
    });
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${type} copied to clipboard!`);
  };

  // Previously this button just showed a success toast unconditionally —
  // nothing was validated or saved. This actually verifies the current
  // password (by re-authenticating with it, since there's no separate
  // "verify password" endpoint) before saving the new one.
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
      {/* Toast Feed */}
      {toastMessage && (
        <div className="fixed top-20 right-6 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 z-50 animate-slideIn">
          <CheckCircle size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-gray-900">Profile & Credentials</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your super admin account settings and Razorpay API credentials</p>
      </div>

      {/* Profile Details Card Form */}
      <form onSubmit={handleSaveProfileDetails} className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-2">
          {/* Avatar block with base64 file upload uploader */}
          <div className="relative group w-20 h-20 shrink-0">
            {avatar ? (
              <img src={avatar} className="w-full h-full rounded-2xl object-cover border border-gray-200" alt="Admin Profile" />
            ) : (
              <div className="w-full h-full rounded-2xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-white text-xl font-black">
                {name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[9px] rounded-2xl cursor-pointer transition-opacity font-black uppercase tracking-wider select-none">
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
            <h2 className="text-lg font-black text-gray-900 truncate">{name}</h2>
            <p className="text-xs text-gray-400 font-mono font-semibold">{email}</p>
            <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded mt-1 inline-block">
              Super Admin Role
            </span>
          </div>

          {avatar && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={isUploadingAvatar}
              className="px-2.5 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer"
            >
              Remove Logo
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
              readOnly
              disabled
              value={email}
              title="Email is your login identifier and can't be changed here."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none font-mono font-bold text-gray-500 bg-gray-50 cursor-not-allowed"
            />
            <p className="text-[10px] text-gray-400 mt-1">This is your login email and can't be changed from here.</p>
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

      {/* Razorpay API Configuration settings (Replaces API key settings) */}
      <form onSubmit={handleSaveRazorpayCredentials} className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
          <CreditCard size={16} className="text-blue-600" />
          <h2 className="text-xs font-black uppercase text-gray-900 tracking-wider">Razorpay Payment Credentials</h2>
        </div>
        
        <p className="text-[11px] text-gray-500 font-semibold leading-relaxed">
          Razorpay credentials configured here will authorize automatic checkout link generations and webhook event triggers. Ensure live credentials are encrypted.
        </p>

        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Razorpay Key ID</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Key size={14} className="absolute left-3 top-3 text-gray-400" />
                <input 
                  type={showRzpKey ? 'text' : 'password'}
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

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-xs font-black uppercase text-gray-900 tracking-wider flex items-center gap-2 mb-4"><Lock size={15} className="text-blue-600" /> Change Console Password</h2>
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
