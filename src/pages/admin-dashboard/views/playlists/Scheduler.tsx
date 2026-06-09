import { useState } from 'react';
import { Plus, Calendar, Clock, AlertTriangle, ChevronDown, Repeat } from 'lucide-react';

const schedules = [
  { id: '1', playlist: 'Summer Campaign', startDate: '2026-06-01', endDate: '2026-06-30', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], timeFrom: '09:00', timeTo: '21:00', priority: 'high', status: 'active' },
  { id: '2', playlist: 'Brand Showcase', startDate: '2026-05-28', endDate: '2026-12-31', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], timeFrom: '08:00', timeTo: '22:00', priority: 'normal', status: 'active' },
  { id: '3', playlist: 'Menu Loop', startDate: '2026-05-01', endDate: '2026-07-31', days: ['Sat', 'Sun'], timeFrom: '11:00', timeTo: '20:00', priority: 'low', status: 'paused' },
];

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Scheduler() {
  const [showNew, setShowNew] = useState(false);
  const [newSched, setNewSched] = useState({
    playlist: '', startDate: '', endDate: '', days: [] as string[], timeFrom: '', timeTo: '', priority: 'normal', override: false,
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Scheduler</h1>
          <p className="text-sm text-gray-500 mt-0.5">Control when and where content plays</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> New Schedule
        </button>
      </div>

      {/* New Schedule Form */}
      {showNew && (
        <div className="bg-white rounded-xl border border-blue-100 p-6 ring-2 ring-blue-50">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">New Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Playlist</label>
              <select value={newSched.playlist} onChange={e => setNewSched(p => ({ ...p, playlist: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                <option value="">Select playlist</option>
                <option>Summer Campaign</option>
                <option>Brand Showcase</option>
                <option>Menu Loop</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Start Date</label>
              <input type="date" value={newSched.startDate} onChange={e => setNewSched(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">End Date</label>
              <input type="date" value={newSched.endDate} onChange={e => setNewSched(p => ({ ...p, endDate: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Priority</label>
              <select value={newSched.priority} onChange={e => setNewSched(p => ({ ...p, priority: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="emergency">Emergency Override</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Time From</label>
              <input type="time" value={newSched.timeFrom} onChange={e => setNewSched(p => ({ ...p, timeFrom: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Time To</label>
              <input type="time" value={newSched.timeTo} onChange={e => setNewSched(p => ({ ...p, timeTo: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-2">Days of Week</label>
              <div className="flex gap-2">
                {days.map(day => (
                  <button key={day} onClick={() => setNewSched(p => ({ ...p, days: p.days.includes(day) ? p.days.filter(d => d !== day) : [...p.days, day] }))}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      newSched.days.includes(day) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}>{day}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Schedule</button>
          </div>
        </div>
      )}

      {/* Existing Schedules */}
      <div className="space-y-3">
        {schedules.map(s => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${s.status === 'active' ? 'bg-emerald-500' : 'bg-yellow-400'}`} />
                <h3 className="text-sm font-semibold text-gray-900">{s.playlist}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  s.priority === 'high' ? 'bg-red-50 text-red-700' :
                  s.priority === 'normal' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>{s.priority}</span>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Edit</button>
                <button className="px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">Delete</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><Calendar size={12} />{s.startDate} — {s.endDate}</div>
              <div className="flex items-center gap-1.5"><Clock size={12} />{s.timeFrom} — {s.timeTo}</div>
              <div className="flex items-center gap-1.5"><Repeat size={12} />{s.days.join(', ')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
