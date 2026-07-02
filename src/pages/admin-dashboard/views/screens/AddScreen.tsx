import { useState, useEffect } from 'react';
import { API_BASE } from '../../../../config';
import { ChevronRight, Monitor, MapPin, LinkIcon, Check, RefreshCw, Building2, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { mediaStore } from '../../../../lib/mediaStore';
import { licensingStore, License } from '../../../../lib/licensingStore';
import { pushToDatabase, syncCollection } from '../../../../lib/syncHelper';
import { toast } from '../../../../components/Toast';

const steps = [
  { id: 1, label: 'Hardware Details', icon: <Monitor size={16} /> },
  { id: 2, label: 'Location', icon: <MapPin size={16} /> },
  { id: 3, label: 'Assignment', icon: <LinkIcon size={16} /> },
];

export default function AddScreen({ mode = 'client', onNavigate }: { mode?: 'client' | 'my'; onNavigate?: (view: string) => void }) {
  const [step, setStep] = useState(1);
  const [isCreated, setIsCreated] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [isPaired, setIsPaired] = useState(false);
  const [form, setForm] = useState({
    name: '', orientation: 'landscape', size: '', resolution: '1920x1080', os: 'android', timezone: 'Asia/Kolkata',
    country: 'India', state: '', city: '', address: '', zip: '', tags: [] as string[],
    playlist: '', group: '',
    organization: '', license: '',
  });

  const [organizations, setOrganizations] = useState<any[]>(() => {
    const data = localStorage.getItem('signageos_organizations');
    return data ? JSON.parse(data) : [];
  });
  const [licenses, setLicenses] = useState<License[]>(() => licensingStore.getLicenses());
  const [groups, setGroups] = useState<any[]>(() => {
    const data = localStorage.getItem('signageos_groups');
    return data ? JSON.parse(data) : [];
  });
  const [userPlaylists, setUserPlaylists] = useState<any[]>(() => mediaStore.getPlaylists());

  useEffect(() => {
    syncCollection('organizations', 'signageos_organizations').then(serverOrgs => {
      if (serverOrgs.length > 0) setOrganizations(serverOrgs);
    });
    syncCollection('licenses', 'signageos_licenses').then(serverLicenses => {
      if (serverLicenses.length > 0) setLicenses(serverLicenses);
    });
    syncCollection('screen_groups', 'signageos_groups').then(serverGroups => {
      if (serverGroups.length > 0) setGroups(serverGroups);
    });
    syncCollection('playlists', 'signageos_playlists').then(serverPlaylists => {
      if (serverPlaylists.length > 0) setUserPlaylists(serverPlaylists);
    });
  }, []);

  const set = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const selectedOrg = organizations.find(o => o.id === form.organization) ?? null;
  const orgLicense = form.organization ? licenses.find(l => l.assignedOrgId === form.organization) ?? null : null;

  const filteredPlaylists = userPlaylists.filter(p => {
    if (mode === 'my') {
      return p.createdBy === 'admin@demo.com';
    } else {
      const clientEmail = orgLicense?.assignedUserEmail || selectedOrg?.email;
      return !clientEmail || p.createdBy === clientEmail || p.createdBy === 'admin@demo.com';
    }
  });

  const saveScreen = (paired: boolean) => {
    const newScreenId = 'screen_' + Math.random().toString(36).substr(2, 9);
    
    let playlistName = 'Normal';
    if (form.group) {
      const gp = groups.find(g => g.id === form.group);
      playlistName = gp ? gp.playlist : 'Normal';
    } else if (form.playlist) {
      playlistName = form.playlist;
    }
    
    const licenseType = orgLicense ? (orgLicense.whiteLabel ? 'Pro' : 'Lite') : 'Lite';
    const assignedUserEmail = mode === 'my' ? 'admin@demo.com' : (orgLicense?.assignedUserEmail || selectedOrg?.email || 'admin@demo.com');
    
    const newScreen: any = {
      id: newScreenId,
      name: form.name,
      status: paired ? 'online' : 'offline',
      playlist: playlistName,
      location: [form.city, form.state].filter(Boolean).join(', ') || 'Unknown Location',
      licenseType: licenseType,
      lastHeartbeat: paired ? 'Just now' : 'Never',
      playerVersion: '2.4.0',
      storageUsed: 0,
      thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=60',
      groupId: form.group || undefined,
      assignedToUserEmail: assignedUserEmail,
    };
    
    const currentScreens = mediaStore.getScreens();
    currentScreens.push(newScreen);
    mediaStore.saveScreens(currentScreens);
    
    pushToDatabase('screens', newScreenId, newScreen, 'POST');
  };

  const handlePairScreen = async () => {
    if (!enteredCode.trim()) {
      toast.warning('Please enter a pairing code.');
      return;
    }

    let playlistId = '';
    if (form.group) {
      const gp = groups.find(g => g.id === form.group);
      playlistId = gp ? gp.playlistId || '' : '';
    } else if (form.playlist) {
      playlistId = form.playlist;
    }

    const assignedUserEmail = mode === 'my' ? 'admin@demo.com' : (orgLicense?.assignedUserEmail || selectedOrg?.email || 'admin@demo.com');

    try {
      const token = localStorage.getItem('signageos_token');
      const response = await fetch(`${API_BASE}/screens/pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pairingCode: enteredCode.trim().toUpperCase(),
          name: form.name,
          location: [form.city, form.state].filter(Boolean).join(', ') || 'Not Specified',
          groupId: form.group || '',
          playlist: playlistId,
          assignedToUserEmail: assignedUserEmail
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.message || 'Failed to pair device. Please check the code.');
        return;
      }

      await syncCollection('screens', 'signageos_screens');
      setIsPaired(true);
    } catch (err) {
      console.error('Error during screen pairing:', err);
      toast.error('Network error trying to pair screen. Please make sure the backend server is running.');
    }
  };

  if (isCreated) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded-xl border border-gray-100 shadow-sm text-center mt-12">
        {!isPaired ? (
          <div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
              <LinkIcon size={24} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Pair Display Device</h2>
            <p className="text-sm text-gray-500 mb-6">
              Screen <strong>{form.name || 'New Screen'}</strong> created successfully! Please enter the pairing code shown on your display device to complete pairing.
            </p>
            <div className="mb-6">
              <input
                type="text"
                maxLength={7}
                value={enteredCode}
                onChange={e => setEnteredCode(e.target.value.toUpperCase())}
                placeholder="e.g. SO-4920"
                className="w-full max-w-[200px] px-3.5 py-3 border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none rounded-xl text-center text-2xl font-mono font-bold tracking-widest text-slate-800"
              />
            </div>
            <div className="space-y-3">
              <button
                onClick={handlePairScreen}
                disabled={enteredCode.length < 4}
                className={`w-full py-2.5 text-sm font-medium text-white rounded-lg transition-colors ${
                  enteredCode.length < 4 ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Pair Screen
              </button>
              <button
                onClick={() => {
                  saveScreen(false);
                  if (onNavigate) {
                    onNavigate(mode === 'my' ? 'my-screens-list' : 'screens-all');
                  } else {
                    setIsCreated(false);
                    setStep(1);
                    setForm({
                      name: '', orientation: 'landscape', size: '', resolution: '1920x1080', os: 'android', timezone: 'Asia/Kolkata',
                      country: 'India', state: '', city: '', address: '', zip: '', tags: [],
                      playlist: '', group: '',
                      organization: '', license: '',
                    });
                    setEnteredCode('');
                  }
                }}
                className="w-full py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Skip / Pair Later
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <CheckCircle size={24} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Screen Paired Successfully!</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your device is now linked and will start playing content shortly.
            </p>
            <button
              onClick={() => {
                if (onNavigate) {
                  onNavigate(mode === 'my' ? 'my-screens-list' : 'screens-all');
                } else {
                  setIsCreated(false);
                  setIsPaired(false);
                  setStep(1);
                  setForm({
                    name: '', orientation: 'landscape', size: '', resolution: '1920x1080', os: 'android', timezone: 'Asia/Kolkata',
                    country: 'India', state: '', city: '', address: '', zip: '', tags: [],
                    playlist: '', group: '',
                    organization: '', license: '',
                  });
                  setEnteredCode('');
                }
              }}
              className="w-full py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Add New Screen</h1>
        <p className="text-sm text-gray-500 mt-0.5">Register a new display device to your network</p>
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
                <input value={form.state} onChange={e => set('state', e.target.value)} placeholder="e.g. Maharashtra" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">City</label>
                <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Mumbai" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">ZIP Code</label>
                <input value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="400001" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
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
            <h2 className="text-base font-semibold text-gray-900 mb-1">Assignment & Settings</h2>
            <p className="text-sm text-gray-500 mb-5">Configure screen group and content settings</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Organization (Only shown in client mode) */}
              {mode === 'client' && (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                      <Building2 size={12} className="text-gray-400" /> Organization
                    </label>
                    <select
                      value={form.organization}
                      onChange={e => set('organization', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white"
                    >
                      <option value="">Select organization</option>
                      {organizations.map(o => (
                        <option key={o.id} value={o.id}>{o.name} — {o.planType}</option>
                      ))}
                    </select>
                  </div>

                  {/* Auto-populated license card */}
                  {selectedOrg && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                        <Key size={12} className="text-gray-400" /> License
                      </label>
                      {orgLicense ? (
                        <div className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border ${
                          orgLicense.status === 'active' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-mono font-bold text-gray-900">{orgLicense.id}</span>
                              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                orgLicense.whiteLabel ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                              }`}>{orgLicense.whiteLabel ? 'Pro' : 'Lite'}</span>
                              <span className={`text-xs px-2 py-0.5 rounded font-semibold capitalize ${
                                orgLicense.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}>{orgLicense.status}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>Expires {orgLicense.expiryDate}</span>
                              <span className="text-gray-300">·</span>
                              <span>Storage Limit: {orgLicense.storageLimit}GB · Device Limit: {orgLicense.deviceLimit}</span>
                            </div>
                          </div>
                          {orgLicense.status === 'active' ? (
                            <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />
                          ) : (
                            <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-amber-200 bg-amber-50">
                          <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
                          <p className="text-xs text-amber-700 font-medium">No license assigned to this organization yet.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Screen Group */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  Screen Group
                </label>
                <select
                  value={form.group}
                  onChange={e => setForm(p => ({ ...p, group: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white"
                >
                  <option value="">None (Ungrouped)</option>
                  {groups
                    .filter(g => mode === 'my' ? (!g.orgId) : (!!g.orgId && (!form.organization || g.orgId === form.organization)))
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
                    <option value="Normal">Normal</option>
                    {filteredPlaylists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
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
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-100">
          <button
            onClick={() => {
              if (step > 1) {
                setStep(s => s - 1);
              } else if (onNavigate) {
                onNavigate(mode === 'my' ? 'my-screens-list' : 'screens-all');
              }
            }}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Back
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => {
                if (!form.name.trim()) {
                  toast.warning('Please enter a screen name.');
                  return;
                }
                setIsCreated(true);
              }}
              className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Check size={16} /> Create Screen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
