import { useState } from 'react';
import { Plus, Building2, Users, Monitor, HardDrive, ChevronRight, MoreVertical } from 'lucide-react';
import { mockOrganizations } from '../data/mockData';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  suspended: 'bg-red-50 text-red-700 border-red-100',
  expired: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function Organizations() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Organizations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Multi-tenant organization management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {mockOrganizations.map(org => (
          <div key={org.id} className={`bg-white rounded-xl border p-4 sm:p-5 cursor-pointer hover:shadow-md transition-all ${
            selected === org.id ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
          }`} onClick={() => setSelected(selected === org.id ? null : org.id)}>
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                  <Building2 size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{org.name}</h3>
                  <p className="text-xs text-gray-500 truncate">{org.adminName} · {org.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${statusColors[org.subscriptionStatus]}`}>{org.subscriptionStatus}</span>
                <button className="text-gray-400 hover:text-gray-600 p-1" onClick={e => e.stopPropagation()}><MoreVertical size={15} /></button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3 text-center">
                <Monitor size={14} className="mx-auto text-gray-400 mb-1" />
                <p className="text-sm font-bold text-gray-900">{org.screensAllowed}</p>
                <p className="text-[10px] sm:text-xs text-gray-400">Screens</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3 text-center">
                <HardDrive size={14} className="mx-auto text-gray-400 mb-1" />
                <p className="text-sm font-bold text-gray-900">{org.storageLimit}GB</p>
                <p className="text-[10px] sm:text-xs text-gray-400">Storage</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3 text-center">
                <Users size={14} className="mx-auto text-gray-400 mb-1" />
                <p className="text-sm font-bold text-gray-900 truncate">{org.planType}</p>
                <p className="text-[10px] sm:text-xs text-gray-400">Plan</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Renews {org.renewalDate}</span>
              <ChevronRight size={14} className={`transition-transform ${selected === org.id ? 'rotate-90' : ''}`} />
            </div>

            {selected === org.id && (
              <div className="mt-4 pt-4 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Users', icon: <Users size={13} /> },
                    { label: 'Screens', icon: <Monitor size={13} /> },
                    { label: 'Media', icon: <HardDrive size={13} /> },
                    { label: 'Billing', icon: <ChevronRight size={13} /> },
                  ].map(item => (
                    <button key={item.label} className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-gray-700 font-medium transition-colors">
                      {item.icon} {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
