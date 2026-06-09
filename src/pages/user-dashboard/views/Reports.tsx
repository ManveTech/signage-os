import { useState } from 'react';
import { BarChart2, Monitor, Film, Cpu, Download, TrendingUp, Eye, AlertTriangle } from 'lucide-react';

const tabs = ['Overview', 'Screen Reports', 'Media Reports', 'Device Logs'] as const;
type Tab = typeof tabs[number];

function Bar({ val, max, color }: { val: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(val / max) * 100}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-12 text-right">{val.toLocaleString()}</span>
    </div>
  );
}

export default function Reports({ activeTab: initTab = 'Overview' }: { activeTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initTab);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Analytics and performance data</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${
            tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Playbacks', value: '1.2M', icon: <TrendingUp size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Impressions', value: '4.8M', icon: <Eye size={18} />, color: 'text-teal-600', bg: 'bg-teal-50' },
              { label: 'Network Uptime', value: '98.4%', icon: <Monitor size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Error Rate', value: '0.3%', icon: <AlertTriangle size={18} />, color: 'text-orange-600', bg: 'bg-orange-50' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className={`w-9 h-9 rounded-lg ${kpi.bg} ${kpi.color} flex items-center justify-center mb-3`}>{kpi.icon}</div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Top Media</h2>
              <div className="space-y-3">
                {[
                  { name: 'Summer Sale Campaign', plays: 48200 },
                  { name: 'Brand Logo Loop', plays: 32100 },
                  { name: 'Product Launch Video', plays: 28900 },
                  { name: 'Menu Display Layout', plays: 21400 },
                ].map(m => (
                  <div key={m.name}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{m.name}</span></div>
                    <Bar val={m.plays} max={50000} color="bg-blue-500" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Top Screens</h2>
              <div className="space-y-3">
                {[
                  { name: 'Airport Gate 4', plays: 62000 },
                  { name: 'Mall Entrance A', plays: 44000 },
                  { name: 'Hotel Lobby HD', plays: 38000 },
                  { name: 'Lobby Display B', plays: 29000 },
                ].map(s => (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{s.name}</span></div>
                    <Bar val={s.plays} max={65000} color="bg-teal-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Screen Reports' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Screen', 'Uptime %', 'Play Count', 'Errors', 'Last Active'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { name: 'Mall Entrance A', uptime: 99.2, plays: 44200, errors: 2, last: '2 min ago' },
                { name: 'Airport Gate 4', uptime: 98.8, plays: 62000, errors: 1, last: '1 min ago' },
                { name: 'Hotel Lobby HD', uptime: 99.5, plays: 38000, errors: 0, last: '3 min ago' },
                { name: 'Cafe Screen 1', uptime: 62.1, plays: 12400, errors: 18, last: '2 days ago' },
                { name: 'Store Front C', uptime: 88.4, plays: 19000, errors: 7, last: '30 min ago' },
              ].map(s => (
                <tr key={s.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${s.uptime >= 95 ? 'text-emerald-600' : s.uptime >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>{s.uptime}%</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.plays.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${s.errors === 0 ? 'text-emerald-600' : s.errors > 10 ? 'text-red-600' : 'text-yellow-600'}`}>{s.errors}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Media Reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Media Playback Stats</h2>
            <div className="space-y-4">
              {[
                { name: 'Summer Sale Campaign', plays: 48200, screens: 12 },
                { name: 'Brand Logo Loop', plays: 32100, screens: 7 },
                { name: 'Product Launch Video', plays: 28900, screens: 9 },
              ].map(m => (
                <div key={m.name} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-medium text-gray-800">{m.name}</p>
                    <span className="text-xs text-gray-500">{m.screens} screens</span>
                  </div>
                  <Bar val={m.plays} max={50000} color="bg-blue-500" />
                  <p className="text-xs text-gray-400 mt-1">{m.plays.toLocaleString()} plays</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Peak Playback Hours</h2>
            <div className="space-y-1">
              {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map(h => {
                const val = Math.sin((h - 8) * 0.4) * 40 + 50 + (h === 12 || h === 18 ? 30 : 0);
                return (
                  <div key={h} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-8">{h}:00</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded" style={{ width: `${Math.min(100, val)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'Device Logs' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Screen', 'CPU', 'RAM', 'Storage', 'Network', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { name: 'Mall Entrance A', cpu: 34, ram: 42, storage: 68, network: 'Stable', ok: true },
                { name: 'Airport Gate 4', cpu: 28, ram: 38, storage: 71, network: 'Stable', ok: true },
                { name: 'Cafe Screen 1', cpu: 0, ram: 0, storage: 32, network: 'Offline', ok: false },
                { name: 'Store Front C', cpu: 94, ram: 78, storage: 91, network: 'Unstable', ok: false },
                { name: 'Hotel Lobby HD', cpu: 29, ram: 45, storage: 54, network: 'Stable', ok: true },
              ].map(d => (
                <tr key={d.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${d.cpu > 80 ? 'text-red-600' : 'text-gray-700'}`}>{d.cpu}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${d.ram > 70 ? 'text-yellow-600' : 'text-gray-700'}`}>{d.ram}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${d.storage > 85 ? 'text-red-600' : 'text-gray-700'}`}>{d.storage}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      d.network === 'Stable' ? 'bg-emerald-50 text-emerald-700' :
                      d.network === 'Offline' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                    }`}>{d.network}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`w-2 h-2 rounded-full inline-block ${d.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
