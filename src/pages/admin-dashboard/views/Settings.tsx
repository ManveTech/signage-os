import { useState } from 'react';
import { Image, Palette, Globe, Monitor, Bell, Mail, Phone, Webhook, Construction } from 'lucide-react';

// Storage config lives in Admin > Integrations (Cloudflare R2) now — this tab
// used to duplicate that with its own static, unwired copy (provider/bucket/
// region/CDN fields that saved nothing).
const tabs = ['General', 'Player Settings', 'Notifications'] as const;
type Tab = typeof tabs[number];

export default function Settings({ activeTab: initTab = 'General' }: { activeTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initTab);
  const [accentColor, setAccentColor] = useState('#2563eb');

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your SignageOS platform</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto max-w-full">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
            tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}>{t}</button>
        ))}
      </div>

      <div className="max-w-2xl flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
        <Construction size={16} className="flex-shrink-0 mt-0.5" />
        <p className="text-xs">This page is not wired up yet — nothing below is saved. Building it out is on the roadmap.</p>
      </div>

      {tab === 'General' && (
        <div className="max-w-2xl space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Image size={15} /> Company Branding</h2>
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 cursor-pointer hover:border-blue-400 transition-colors">
                <Image size={24} className="text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Company Logo</p>
                <p className="text-xs text-gray-400 mt-0.5">PNG or SVG, max 2MB</p>
                <button className="mt-2 px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">Upload Logo</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Company Name</label>
                <input defaultValue="SignageOS" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5"><Palette size={12} className="inline mr-1" />Theme Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="w-10 h-9 rounded cursor-pointer border border-gray-200" />
                  <span className="text-sm font-mono text-gray-600">{accentColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5"><Globe size={12} className="inline mr-1" />Default Timezone</label>
                <select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                  {['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York'].map(tz => <option key={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}


      {tab === 'Player Settings' && (
        <div className="max-w-2xl space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Monitor size={15} /> Player Configuration</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Minimum Player Version</label>
                <input defaultValue="3.1.0" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Latest Version</label>
                <input defaultValue="3.2.1" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 font-mono" disabled />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Default Playback Resolution</label>
                <select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                  <option>1920x1080 (Full HD)</option>
                  <option>3840x2160 (4K)</option>
                  <option>1280x720 (HD)</option>
                </select>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Auto-update Player', desc: 'Automatically push player updates when available' },
                { label: 'Force Update on Minimum Version', desc: 'Block playback if player is below minimum version' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.label}</p>
                    <p className="text-xs text-gray-500">{s.desc}</p>
                  </div>
                  <div className="w-10 h-5 rounded-full bg-blue-600 relative flex-shrink-0 cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 translate-x-5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Notifications' && (
        <div className="max-w-2xl space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Bell size={15} /> Notification Settings</h2>
            <div className="space-y-3">
              {[
                { icon: <Mail size={15} />, label: 'Email Alerts', val: true },
                { icon: <Phone size={15} />, label: 'SMS Alerts', val: false },
                { icon: <Webhook size={15} />, label: 'Webhook Notifications', val: true },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">{n.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{n.label}</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative cursor-pointer ${n.val ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${n.val ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5"><Webhook size={12} className="inline mr-1" />Webhook URL</label>
              <input placeholder="https://your-app.com/webhook" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button disabled title="Not wired up yet" className="px-5 py-2.5 bg-gray-300 text-white text-sm font-medium rounded-lg cursor-not-allowed">Save Changes</button>
      </div>
    </div>
  );
}
