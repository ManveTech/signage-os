import { useState } from 'react';
import {
  Search, Building2, User, Monitor, Check, X, ChevronDown,
  CheckCircle, AlertCircle, ArrowRight, Wifi, WifiOff, AlertTriangle
} from 'lucide-react';
import { mockScreens, mockUsers, mockOrganizations } from '../../data/mockData';
import type { Screen } from '../../types';

type AssignTarget = 'organization' | 'user';
type Toast = { id: number; message: string; type: 'success' | 'error' };

const statusConfig = {
  online: { icon: <Wifi size={11} />, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  offline: { icon: <WifiOff size={11} />, cls: 'bg-red-50 text-red-700 border-red-100' },
  warning: { icon: <AlertTriangle size={11} />, cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
};

export default function AssignScreens() {
  const [assignTarget, setAssignTarget] = useState<AssignTarget>('organization');
  const [selectedScreens, setSelectedScreens] = useState<Set<string>>(new Set());
  const [selectedTarget, setSelectedTarget] = useState('');
  const [search, setSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [assignments, setAssignments] = useState<{ screenId: string; targetType: AssignTarget; targetId: string; targetName: string }[]>([]);

  const filteredScreens = mockScreens.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.location.toLowerCase().includes(search.toLowerCase())
  );

  const filteredOrgs = mockOrganizations.filter(o =>
    o.name.toLowerCase().includes(targetSearch.toLowerCase())
  );

  const filteredUsers = mockUsers.filter(u =>
    u.name.toLowerCase().includes(targetSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(targetSearch.toLowerCase())
  );

  const addToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };

  const toggleScreen = (id: string) => {
    setSelectedScreens(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedScreens.size === filteredScreens.length) {
      setSelectedScreens(new Set());
    } else {
      setSelectedScreens(new Set(filteredScreens.map(s => s.id)));
    }
  };

  const handleAssign = () => {
    if (selectedScreens.size === 0) { addToast('Select at least one screen', 'error'); return; }
    if (!selectedTarget) { addToast('Select an organization or user to assign to', 'error'); return; }

    const targetName = assignTarget === 'organization'
      ? mockOrganizations.find(o => o.id === selectedTarget)?.name ?? ''
      : mockUsers.find(u => u.id === selectedTarget)?.name ?? '';

    const newAssignments = Array.from(selectedScreens).map(screenId => ({
      screenId, targetType: assignTarget, targetId: selectedTarget, targetName
    }));

    setAssignments(prev => {
      const withoutDupes = prev.filter(a => !selectedScreens.has(a.screenId));
      return [...withoutDupes, ...newAssignments];
    });

    addToast(`${selectedScreens.size} screen${selectedScreens.size > 1 ? 's' : ''} assigned to "${targetName}"`);
    setSelectedScreens(new Set());
    setSelectedTarget('');
  };

  const removeAssignment = (screenId: string) => {
    setAssignments(prev => prev.filter(a => a.screenId !== screenId));
    addToast('Assignment removed');
  };

  const getAssignment = (screenId: string) => assignments.find(a => a.screenId === screenId);

  return (
    <div className="p-6 space-y-5">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
            toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Assign Screens</h1>
        <p className="text-sm text-gray-500 mt-0.5">Assign screens to organizations or users</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Screen Selection */}
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Monitor size={15} className="text-gray-400" /> Select Screens
              </h2>
              <span className="text-xs text-gray-400">{selectedScreens.size} selected</span>
            </div>
            <div className="p-3 border-b border-gray-50">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search screens..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-gray-50"
                />
              </div>
            </div>
            <div className="px-4 py-2 border-b border-gray-50 flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedScreens.size === filteredScreens.length && filteredScreens.length > 0}
                onChange={selectAll}
                className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
              />
              <span className="text-xs text-gray-500">Select all</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {filteredScreens.map(screen => {
                const st = statusConfig[screen.status];
                const assignment = getAssignment(screen.id);
                return (
                  <label
                    key={screen.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                      selectedScreens.has(screen.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedScreens.has(screen.id)}
                      onChange={() => toggleScreen(screen.id)}
                      className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer flex-shrink-0"
                    />
                    <div className="w-10 h-7 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                      <img src={screen.thumbnail} alt={screen.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{screen.name}</p>
                      <p className="text-xs text-gray-400 truncate">{screen.location}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {assignment && (
                        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <Check size={9} /> {assignment.targetName}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.cls}`}>
                        {st.icon}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Target Selection + Action */}
        <div className="lg:col-span-2 space-y-3">
          {/* Assign To toggle */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Assign To</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setAssignTarget('organization'); setSelectedTarget(''); }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    assignTarget === 'organization' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Building2 size={14} /> Organization
                </button>
                <button
                  onClick={() => { setAssignTarget('user'); setSelectedTarget(''); }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    assignTarget === 'user' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <User size={14} /> User
                </button>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  value={targetSearch}
                  onChange={e => setTargetSearch(e.target.value)}
                  placeholder={`Search ${assignTarget === 'organization' ? 'organizations' : 'users'}...`}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-gray-50"
                />
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {assignTarget === 'organization' && filteredOrgs.map(org => (
                  <button
                    key={org.id}
                    onClick={() => setSelectedTarget(org.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      selectedTarget === org.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{org.name}</p>
                      <p className="text-xs text-gray-400">{org.planType} · {org.screensAllowed} screens</p>
                    </div>
                    {selectedTarget === org.id && <Check size={14} className="text-blue-600 flex-shrink-0" />}
                  </button>
                ))}
                {assignTarget === 'user' && filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedTarget(user.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      selectedTarget === user.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-gray-600">{user.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    {selectedTarget === user.id && <Check size={14} className="text-blue-600 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Assign Button */}
          <button
            onClick={handleAssign}
            disabled={selectedScreens.size === 0 || !selectedTarget}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <ArrowRight size={15} />
            Assign {selectedScreens.size > 0 ? `${selectedScreens.size} Screen${selectedScreens.size > 1 ? 's' : ''}` : 'Screens'}
          </button>
        </div>
      </div>

      {/* Current Assignments */}
      {assignments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Current Assignments</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {assignments.map(a => {
              const screen = mockScreens.find(s => s.id === a.screenId);
              if (!screen) return null;
              return (
                <div key={a.screenId} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-7 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                    <img src={screen.thumbnail} alt={screen.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{screen.name}</p>
                    <p className="text-xs text-gray-400 truncate">{screen.location}</p>
                  </div>
                  <ArrowRight size={13} className="text-gray-300 flex-shrink-0" />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {a.targetType === 'organization' ? <Building2 size={12} className="text-blue-500" /> : <User size={12} className="text-gray-500" />}
                    <span className="text-xs font-medium text-gray-700">{a.targetName}</span>
                  </div>
                  <button
                    onClick={() => removeAssignment(a.screenId)}
                    className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
