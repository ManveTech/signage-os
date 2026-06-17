import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Clock, AlertTriangle, Monitor, Play, Trash, Check, X, CheckCircle } from 'lucide-react';
import { mediaStore, Playlist, Screen } from '../../../../lib/mediaStore';
import { pushToDatabase, syncCollection } from '../../../../lib/syncHelper';

type Toast = { id: number; message: string; type: 'success' | 'info' | 'error' };

interface Props {
  userEmail?: string;
}

export default function Scheduler({ userEmail = 'admin@demo.com' }: Props) {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [selectedScreenId, setSelectedScreenId] = useState('');
  const [selectedPlaylistName, setSelectedPlaylistName] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const isAdmin = userEmail === 'admin@demo.com';

  useEffect(() => {
    loadData();
  }, [userEmail]);

  const loadData = () => {
    // Sync screens from database
    syncCollection('screens', 'signageos_screens').then(serverScreens => {
      const allScreens = serverScreens.length > 0 ? serverScreens : mediaStore.getScreens();
      if (isAdmin) {
        // Admin sees all screens
        setScreens(allScreens);
      } else {
        // Users see only their assigned screens
        setScreens(allScreens.filter((s: Screen) => s.assignedToUserEmail === userEmail));
      }
    });

    // Sync playlists
    syncCollection('playlists', 'signageos_playlists').then(serverPlaylists => {
      const allPlaylists = serverPlaylists.length > 0 ? serverPlaylists : mediaStore.getPlaylists();
      if (isAdmin) {
        setPlaylists(allPlaylists);
      } else {
        setPlaylists(allPlaylists.filter((p: Playlist) => p.createdBy === userEmail));
      }
    });
  };

  const addToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScreenId) {
      addToast('Please select a target screen', 'error');
      return;
    }
    if (!selectedPlaylistName) {
      addToast('Please select a playlist to schedule', 'error');
      return;
    }
    if (!scheduleDate) {
      addToast('Please pick a start date', 'error');
      return;
    }
    if (!scheduleTime) {
      addToast('Please pick a start time', 'error');
      return;
    }

    const screen = screens.find(s => s.id === selectedScreenId);
    if (!screen) return;

    const updatedScreen = {
      ...screen,
      schedulePlaylist: selectedPlaylistName,
      scheduleDate,
      scheduleTime
    };

    pushToDatabase('screens', screen.id, updatedScreen, 'PUT').then(res => {
      if (res.ok) {
        addToast(`Successfully scheduled playlist for "${screen.name}"`, 'success');
        // Update local state
        const allScreens = mediaStore.getScreens();
        const updatedAll = allScreens.map(s => s.id === screen.id ? updatedScreen : s);
        mediaStore.saveScreens(updatedAll);
        setScreens(isAdmin ? updatedAll : updatedAll.filter(s => s.assignedToUserEmail === userEmail));
        
        // Clear form
        setShowNew(false);
        setSelectedScreenId('');
        setSelectedPlaylistName('');
        setScheduleDate('');
        setScheduleTime('');
      } else {
        addToast('Failed to save schedule', 'error');
      }
    });
  };

  const handleCancelSchedule = (screen: Screen) => {
    const updatedScreen = {
      ...screen,
      schedulePlaylist: '',
      scheduleDate: '',
      scheduleTime: ''
    };

    pushToDatabase('screens', screen.id, updatedScreen, 'PUT').then(res => {
      if (res.ok) {
        addToast(`Cleared schedule for "${screen.name}"`, 'success');
        // Update local state
        const allScreens = mediaStore.getScreens();
        const updatedAll = allScreens.map(s => s.id === screen.id ? updatedScreen : s);
        mediaStore.saveScreens(updatedAll);
        setScreens(isAdmin ? updatedAll : updatedAll.filter(s => s.assignedToUserEmail === userEmail));
      } else {
        addToast('Failed to clear schedule', 'error');
      }
    });
  };

  // Filter screens that have active schedules
  const scheduledScreens = screens.filter(s => s.schedulePlaylist && s.schedulePlaylist !== '');

  return (
    <div className="p-6 space-y-5">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in ${
            toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`}>
            <CheckCircle size={15} />
            {toast.message}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950">Scheduler</h1>
          <p className="text-sm text-gray-500 mt-0.5">Control when and where your playlists run on screens</p>
        </div>
        {!showNew && (
          <button 
            onClick={() => setShowNew(true)} 
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer shadow-sm"
          >
            <Plus size={15} /> New Schedule
          </button>
        )}
      </div>

      {/* New Schedule Form */}
      {showNew && (
        <form onSubmit={handleSaveSchedule} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 animate-fade-in">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-gray-900">Create Screen Shift Schedule</h2>
            <button type="button" onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-650"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold">
            <div>
              <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">Target TV Screen</label>
              <select 
                value={selectedScreenId} 
                onChange={e => setSelectedScreenId(e.target.value)} 
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white cursor-pointer text-slate-750"
              >
                <option value="">-- Choose Screen --</option>
                {screens.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.location})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">Playlist to Run</label>
              <select 
                value={selectedPlaylistName} 
                onChange={e => setSelectedPlaylistName(e.target.value)} 
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white cursor-pointer text-slate-750"
              >
                <option value="">-- Choose Playlist --</option>
                {playlists.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">Start Date</label>
              <input 
                type="date" 
                value={scheduleDate} 
                onChange={e => setScheduleDate(e.target.value)} 
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-slate-750 font-semibold" 
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">Start Time</label>
              <input 
                type="time" 
                value={scheduleTime} 
                onChange={e => setScheduleTime(e.target.value)} 
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-slate-750 font-semibold" 
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button 
              type="button" 
              onClick={() => setShowNew(false)} 
              className="px-4 py-2 text-xs font-bold text-gray-600 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 cursor-pointer shadow-sm"
            >
              Save Schedule
            </button>
          </div>
        </form>
      )}

      {/* Existing Schedules */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase text-slate-455 tracking-widest">Active Schedule Shifts ({scheduledScreens.length})</h2>
        {scheduledScreens.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-slate-150 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:border-slate-300 transition-all duration-300">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Monitor size={20} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-extrabold text-slate-800">{s.name}</h3>
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">{s.location}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-455 font-bold">
                  <div className="flex items-center gap-1.5">
                    <Play size={12} className="text-emerald-500 shrink-0" />
                    <span>Runs Playlist: <strong className="text-slate-700">{s.schedulePlaylist}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-blue-500 shrink-0" />
                    <span>Starts: <strong className="text-slate-700">{s.scheduleDate}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-blue-500 shrink-0" />
                    <span>At: <strong className="text-slate-700">{s.scheduleTime}</strong></span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0 sm:ml-auto">
              <button 
                onClick={() => {
                  setSelectedScreenId(s.id);
                  setSelectedPlaylistName(s.schedulePlaylist || '');
                  setScheduleDate(s.scheduleDate || '');
                  setScheduleTime(s.scheduleTime || '');
                  setShowNew(true);
                }} 
                className="px-3.5 py-2 text-xs font-bold text-slate-655 bg-slate-100 hover:bg-slate-205 rounded-xl transition-all cursor-pointer"
              >
                Edit
              </button>
              <button 
                onClick={() => handleCancelSchedule(s)} 
                className="px-3.5 py-2 text-xs font-bold text-red-655 bg-red-50 hover:bg-red-105 rounded-xl transition-all cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {scheduledScreens.length === 0 && (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-150">
            <Calendar size={36} className="mx-auto text-slate-200 mb-3" />
            <p className="text-sm font-bold text-gray-500">No scheduled playlist switches</p>
            <p className="text-xs text-gray-400 mt-1">Use the "New Schedule" button to schedule a playlist swap on any screen</p>
          </div>
        )}
      </div>
    </div>
  );
}
