import { useState, useEffect } from 'react';
import { Key, Plus, Clock, UserPlus } from 'lucide-react';
import { mockLicenses } from '../data/mockData';
import type { License } from '../types';

const tabs = ['License Pool', 'Assign License', 'History'] as const;
type Tab = typeof tabs[number];

const statusColors: Record<License['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  expired: 'bg-red-50 text-red-700 border-red-100',
  revoked: 'bg-gray-100 text-gray-600 border-gray-200',
};

const typeColors: Record<License['type'], string> = {
  pro: 'bg-blue-600 text-white',
  lite: 'bg-gray-200 text-gray-700',
};

export default function Licenses({ activeTab: initTab = 'License Pool' }: { activeTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initTab);

  useEffect(() => {
    setTab(initTab);
  }, [initTab]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Licenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage software licenses across your network</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Add License
        </button>
      </div>


      {tab === 'License Pool' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['License ID', 'Type', 'Assigned To', 'Expiry', 'Features', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mockLicenses.map(lic => (
                <tr key={lic.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Key size={14} className="text-gray-400" />
                      <span className="text-sm font-mono font-medium text-gray-900">{lic.id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded font-semibold uppercase ${typeColors[lic.type]}`}>{lic.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${lic.assignedTo ? 'text-gray-700' : 'text-gray-400 italic'}`}>{lic.assignedTo || 'Unassigned'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock size={11} />
                      {lic.expiryDate}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {lic.featuresEnabled.slice(0, 2).map(f => (
                        <span key={f} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{f}</span>
                      ))}
                      {lic.featuresEnabled.length > 2 && <span className="text-xs text-gray-400">+{lic.featuresEnabled.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusColors[lic.status]}`}>{lic.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 transition-opacity">
                      <button className="px-2.5 py-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg">Reassign</button>
                      <button className="px-2.5 py-1 text-xs text-red-500 bg-red-50 hover:bg-red-100 rounded-lg">Revoke</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Assign License' && (
        <div className="max-w-lg">
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Assign License</h2>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Select User / Organization</label>
              <select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                <option value="">Select recipient</option>
                <option>Arjun Kapoor</option>
                <option>Priya Sharma — Phoenix Mall</option>
                <option>Barista Coffee Chain</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">License Type</label>
              <div className="grid grid-cols-2 gap-3">
                {(['lite', 'pro'] as const).map(t => (
                  <button key={t} className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 text-left transition-colors">
                    <p className="text-sm font-semibold text-gray-900 capitalize mb-1">{t}</p>
                    <p className="text-xs text-gray-500">{t === 'pro' ? '4K, Analytics, API' : '1080p, Basic'}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Expiry Date</label>
              <input type="date" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Assign to Screen (optional)</label>
              <select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                <option value="">Select screen</option>
                {['Mall Entrance A', 'Airport Gate 4', 'Hotel Lobby HD'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <button className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
              <UserPlus size={15} /> Assign License
            </button>
          </div>
        </div>
      )}

      {tab === 'History' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Action', 'License', 'User', 'Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { action: 'Issued', lic: 'LIC-001', user: 'Arjun Kapoor', date: '2026-01-15', color: 'text-emerald-600' },
                { action: 'Assigned', lic: 'LIC-002', user: 'Priya Sharma', date: '2026-02-20', color: 'text-blue-600' },
                { action: 'Expired', lic: 'LIC-004', user: 'Anjali Patel', date: '2026-04-30', color: 'text-red-600' },
                { action: 'Transferred', lic: 'LIC-003', user: 'Rahul Singh', date: '2026-05-01', color: 'text-yellow-600' },
              ].map((h, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3"><span className={`text-sm font-medium ${h.color}`}>{h.action}</span></td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{h.lic}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{h.user}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{h.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
