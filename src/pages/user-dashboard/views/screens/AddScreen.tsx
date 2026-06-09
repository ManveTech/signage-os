import { useState, useEffect } from 'react';
import { ChevronRight, Monitor, MapPin, LinkIcon, Check, RefreshCw, Building2, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { mediaStore } from '../../../../lib/mediaStore';
import { licensingStore } from '../../../../lib/licensingStore';
import { pushToDatabase, syncCollection } from '../../../../lib/syncHelper';

const steps = [
  { id: 1, label: 'Hardware Details', icon: <Monitor size={16} /> },
  { id: 2, label: 'Location', icon: <MapPin size={16} /> },
  { id: 3, label: 'Assignment & Pairing', icon: <LinkIcon size={16} /> },
];

interface AddScreenProps {
  userEmail?: string;
  onNavigate?: (view: string) => void;
}

export default function AddScreen({ userEmail = 'priya@demo.com', onNavigate }: AddScreenProps) {
  const [step, setStep] = useState(1);
  const [pairCode, setPairCode] = useState(() => Math.random().toString(36).substr(2, 6).toUpperCase());
  
  const [groups, setGroups] = useState<any[]>(() => {
    const data = localStorage.getItem('signageos_groups');
    return data ? JSON.parse(data) : [];
  });
  const [userPlaylists, setUserPlaylists] = useState<any[]>(() =>
    mediaStore.getPlaylists().filter((p: any) => p.createdBy === userEmail)
  );

  const [form, setForm] = useState({
    name: '', orientation: 'landscape', size: '', resolution: '1920x1080', os: 'android', timezone: 'Asia/Kolkata',
    country: 'India', state: '', city: '', address: '', zip: '', tags: [] as string[],
    playlist: '', group: '',
  });

  useEffect(() => {
    syncCollection('screen_groups', 'signageos_groups').then(serverGroups => {
      if (serverGroups.length > 0) {
        setGroups(serverGroups);
      }
    });
    syncCollection('licenses', 'signageos_licenses');
    syncCollection('playlists', 'signageos_playlists').then(serverPlaylists => {
      if (serverPlaylists.length > 0) {
        setUserPlaylists(serverPlaylists.filter((p: any) => p.createdBy === userEmail));
      }
    });
  }, [userEmail]);

  const set = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  // Query license details for this specific logged-in user
  const licenses = licensingStore.getLicenses();
  const clientLicense = licenses.find(l => l.assignedUserEmail === userEmail) || null;
  const myOrgId = clientLicense?.assignedOrgId;
  const orgName = clientLicense?.assignedOrgName || 'Phoenix Mall Group';
  const licenseId = clientLicense?.id || 'LIC-001';
  const licenseStatus = clientLicense?.status || 'active';
  const licenseName = clientLicense?.name || 'Pro License';

  const generateNewCode = () => {
    setPairCode(Math.random().toString(36).substr(2, 6).toUpperCase());
  };

  const handleRegisterScreen = () => {
    if (!form.name.trim()) {
      alert('Please enter a screen name.');
      return;
    }
    const newScreenId = 'screen_' + Math.random().toString(36).substr(2, 9);
    
    let playlistName = 'Normal';
    if (form.group) {
      const gp = groups.find(g => g.id === form.group);
      playlistName = gp ? gp.playlist : 'Normal';
    } else if (form.playlist) {
      playlistName = form.playlist;
    }
    
    const licenseType = clientLicense ? (clientLicense.whiteLabel ? 'Pro' : 'Lite') : 'Lite';
    
    const newScreen: any = {
      id: newScreenId,
      name: form.name,
      status: 'online',
      playlist: playlistName,
      location: [form.city, form.state].filter(Boolean).join(', ') || 'Unknown Location',
      licenseType: licenseType,
      lastHeartbeat: 'Just now',
      playerVersion: '3.2.1',
      storageUsed: 15,
      thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=60',
      groupId: form.group || undefined,
      assignedToUserEmail: userEmail,
    };
    
    const currentScreens = mediaStore.getScreens();
    currentScreens.push(newScreen);
    mediaStore.saveScreens(currentScreens);
    
    pushToDatabase('screens', newScreenId, newScreen, 'POST');
 
    alert(`Screen "${form.name}" has been successfully paired and added to your license!`);
    if (onNavigate) {
      onNavigate('my-screens-list');
    } else {
      setStep(1);
      setForm({
        name: '', orientation: 'landscape', size: '', resolution: '1920x1080', os: 'android', timezone: 'Asia/Kolkata',
        country: 'India', state: '', city: '', address: '', zip: '', tags: [],
        playlist: '', group: '',
      });
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Add New Screen</h1>
        <p className="text-sm text-gray-500 mt-0.5">Register a new display device to your signage network</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex items-center gap-3">
              <button
                onClick={() => step > s.id && setStep(s.id)}
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-semibold text-sm transition-all ${
                  step === s.id ? 'border-blue-600 bg-blue-600 text-white' :
                  step > s.id ? 'border-emerald-500 bg-emerald-500 text-white' :
                  'border-gray-200 bg-white text-gray-400'
                }`}
              >
                {step > s.id ? <Check size={16} /> : s.id}
              </button>
              <span className={`text-sm font-medium hidden sm:block ${step === s.id ? 'text-blue-700' : step > s.id ? 'text-emerald-600' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-4 ${step > s.id ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6">
        {step === 1 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Hardware Details</h2>
            <p className="text-sm text-gray-500 mb-5">Enter the physical display specifications</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Screen Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Mall Entrance A" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Orientation</label>
                <select value={form.orientation} onChange={e => set('orientation', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Screen Size</label>
                <select value={form.size} onChange={e => set('size', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                  <option value="">Select size</option>
                  {['32"', '43"', '55"', '65"', '75"', '86"'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Resolution</label>
                <select value={form.resolution} onChange={e => set('resolution', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                  {['1920x1080', '3840x2160', '1280x720'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">OS Type</label>
                <select value={form.os} onChange={e => set('os', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                  <option value="android">Android</option>
                  <option value="windows">Windows</option>
                  <option value="linux">Linux</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Timezone</label>
                <select value={form.timezone} onChange={e => set('timezone', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                  {['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Location Details</h2>
            <p className="text-sm text-gray-500 mb-5">Where is this screen physically installed?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Country</label>
                <input value={form.country} onChange={e => set('country', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">State</label>
                <input value={form.state} onChange={e => set('state', e.target.value)} placeholder="e.g. Karnataka" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">City</label>
                <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Bengaluru" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">ZIP Code</label>
                <input value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="560001" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Full Address</label>
                <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Building, Street, Area" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Location Tags</label>
                <div className="flex flex-wrap gap-2">
                  {['Mall', 'Airport', 'Hotel', 'Cafe', 'Store', 'Hospital', 'Office'].map(tag => (
                    <button key={tag} onClick={() => setForm(p => ({
                      ...p, tags: p.tags.includes(tag) ? p.tags.filter(t => t !== tag) : [...p.tags, tag]
                    }))} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.tags.includes(tag) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}>{tag}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Assignment & Pairing</h2>
            <p className="text-sm text-gray-500 mb-5">Link the screen to your active license and perform pairing</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Organization & License (Read Only) */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                    <Building2 size={12} className="text-gray-400" /> Client Profile
                  </span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 text-slate-500 rounded font-semibold">Auto-Selected</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800">{orgName}</h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{userEmail}</p>
                  </div>
                  {clientLicense ? (
                    <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-3 py-2 rounded-lg">
                      <Key size={12} className="text-blue-500" />
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-slate-900 block font-mono">{licenseId}</span>
                        <span className="text-[9px] text-slate-400 block font-medium capitalize">{licenseName} · {licenseStatus}</span>
                      </div>
                      <CheckCircle size={14} className="text-emerald-500 shrink-0 ml-1" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 px-2.5 py-1.5 rounded-lg text-[10px]">
                      <AlertCircle size={12} /> No active license found.
                    </div>
                  )}
                </div>
              </div>

              {/* Screen Group */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Screen Group</label>
                <select
                  value={form.group}
                  onChange={e => setForm(p => ({ ...p, group: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white"
                >
                  <option value="">None (Ungrouped)</option>
                  {groups
                    .filter(g => !g.orgId || g.orgId === myOrgId)
                    .map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
              </div>

              {/* Playlist */}
              {!form.group ? (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Assign Playlist</label>
                  <select value={form.playlist} onChange={e => set('playlist', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                    <option value="">None (Standby Loop)</option>
                    <option value="Normal">Normal</option>
                    {userPlaylists.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                  </select>
                </div>
              ) : (() => {
                const gp = groups.find(g => g.id === form.group);
                return (
                  <div className="sm:col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                    Playlist is managed by group <strong>{gp?.name}</strong> (Inherited: <strong>{gp?.playlist || 'None'}</strong>).
                  </div>
                );
              })()}
            </div>

            {/* Device Pairing */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Device Pairing</h3>
              <p className="text-xs text-gray-500 mb-4">Enter this code on your display device to complete pairing</p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="bg-white border-2 border-blue-200 rounded-xl px-8 py-4 text-center shrink-0 w-full sm:w-auto">
                  <p className="text-3xl font-bold tracking-widest text-blue-700 font-mono leading-none">{pairCode}</p>
                  <p className="text-xs text-gray-400 mt-1.5 font-semibold tracking-wider uppercase">Valid for 5 minutes</p>
                </div>
                <div className="text-xs text-gray-600 space-y-1.5">
                  <p>1. Open SignageOS Player app on your TV/display</p>
                  <p>2. Tap "Pair Device" or "Enter Code"</p>
                  <p>3. Enter the pairing code shown on the left</p>
                  <p>4. The display will pair and activate automatically</p>
                </div>
              </div>
              <button
                type="button"
                onClick={generateNewCode}
                className="mt-4 flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 hover:underline font-bold uppercase tracking-wider"
              >
                <RefreshCw size={10} /> Generate New Code
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-100">
          <button
            onClick={() => {
              if (step > 1) {
                setStep(s => s - 1);
              } else if (onNavigate) {
                onNavigate('my-screens-list');
              }
            }}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Back
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer">
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleRegisterScreen}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Check size={16} /> Register & Pair Screen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
