import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, HardDrive, Cpu } from 'lucide-react';

interface HealthLog {
  id: string;
  screen: string;
  event: string;
  type: string;
  time: string;
  detail: string;
}

const logs: HealthLog[] = [];

const typeConfig: Record<string, { icon: React.ReactNode; cls: string }> = {
  online: { icon: <Wifi size={13} />, cls: 'bg-emerald-100 text-emerald-600' },
  offline: { icon: <WifiOff size={13} />, cls: 'bg-red-100 text-red-600' },
  reboot: { icon: <RefreshCw size={13} />, cls: 'bg-blue-100 text-blue-600' },
  error: { icon: <AlertTriangle size={13} />, cls: 'bg-orange-100 text-orange-600' },
  storage: { icon: <HardDrive size={13} />, cls: 'bg-yellow-100 text-yellow-600' },
  cpu: { icon: <Cpu size={13} />, cls: 'bg-purple-100 text-purple-600' },
};

export default function HealthLogs() {
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = typeFilter === 'all' ? logs : logs.filter(l => l.type === typeFilter);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Health Logs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Device events, errors, and system behavior</p>
      </div>

      {/* Device Health Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg CPU', value: '34%', color: 'text-blue-600', icon: <Cpu size={16} />, bg: 'bg-blue-50' },
          { label: 'Avg Memory', value: '48%', color: 'text-teal-600', icon: <HardDrive size={16} />, bg: 'bg-teal-50' },
          { label: 'Avg Storage', value: '61%', color: 'text-yellow-600', icon: <HardDrive size={16} />, bg: 'bg-yellow-50' },
          { label: 'Errors Today', value: '3', color: 'text-red-600', icon: <AlertTriangle size={16} />, bg: 'bg-red-50' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`w-8 h-8 rounded-lg ${m.bg} ${m.color} flex items-center justify-center mb-2`}>{m.icon}</div>
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2">
          {['all', 'online', 'offline', 'reboot', 'error', 'storage', 'cpu'].map(f => (
            <button key={f} onClick={() => setTypeFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
              typeFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>{f}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Event</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Screen</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Detail</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                    No health logs available
                  </td>
                </tr>
              ) : (
                filtered.map(log => {
                  const tc = typeConfig[log.type] ?? typeConfig.error;
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-md flex items-center justify-center ${tc.cls}`}>{tc.icon}</span>
                          <span className="text-sm text-gray-800">{log.event}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.screen}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{log.detail}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{log.time}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
