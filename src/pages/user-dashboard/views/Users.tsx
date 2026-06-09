import { useState } from 'react';
import { Plus, Search, Shield, Edit, Trash2 } from 'lucide-react';
import { mockUsers } from '../data/mockData';
import type { User as UserType } from '../types';

const roleLabels: Record<UserType['role'], string> = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  content_manager: 'Content Manager',
  viewer: 'Viewer',
};

const roleColors: Record<UserType['role'], string> = {
  super_admin: 'bg-blue-600 text-white',
  org_admin: 'bg-teal-600 text-white',
  content_manager: 'bg-emerald-500 text-white',
  viewer: 'bg-gray-300 text-gray-700',
};

export default function Users() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const filtered = mockUsers.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{mockUsers.length} users in the platform</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'super_admin', 'org_admin', 'content_manager', 'viewer'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)} className={`px-3 py-2 text-xs font-medium rounded-lg border capitalize transition-colors ${
              roleFilter === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}>{r === 'all' ? 'All' : roleLabels[r as UserType['role']]}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['User', 'Role', 'Company', 'Licenses', 'Screens', 'Last Login', '2FA', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">{user.name.split(' ').map(n => n[0]).join('')}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${roleColors[user.role]}`}>
                    <Shield size={10} /> {roleLabels[user.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{user.company}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{user.licenseCount}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{user.screensAssigned}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{user.lastLogin}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${user.twoFAEnabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {user.twoFAEnabled ? '✓ On' : '✗ Off'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                    user.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>{user.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 transition-opacity">
                    <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={13} /></button>
                    <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
