/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Users, CalendarDays, Award, CheckCircle2, Shield, Settings, Info, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Navbar from './components/Navbar';
import SummaryWidget from './components/SummaryWidget';
import CalendarView from './components/CalendarView';
import ManpowerGrid from './components/ManpowerGrid';
import ScheduleForm from './components/ScheduleForm';
import { Manpower, Unit, Schedule } from './types';
import { useUser } from './context/UserContext';
import LoginScreen from './components/LoginScreen';
import { supabase, isSupabaseConfigured } from './lib/supabase';

const INITIAL_MANPOWER: Manpower[] = [
  { id: 'm1', name: 'Angga', role: 'Leader & Ahli Utama', status: 'internal', skp: ['PTP', 'PAA', 'Elevator', 'Eskalator'] },
  { id: 'm2', name: 'Imam', role: 'Ahli Spesialis', status: 'internal', skp: ['PUBT', 'Instalasi Listrik'] },
  { id: 'm3', name: 'Fakhziar', role: 'Ahli Spesialis', status: 'internal', skp: ['PUBT'] },
  { id: 'm4', name: 'Fauzan', role: 'Ahli Spesialis', status: 'internal', skp: ['Instalasi Listrik', 'PAA'] },
  { id: 'm5', name: 'Katez', role: 'Ahli Eksternal', status: 'external', skp: ['Angkur TKPK'] },
  { id: 'm6', name: 'Riyan', role: 'Helper & Teknisi', status: 'external', skp: [] },
  { id: 'm7', name: 'Ajay', role: 'Support Staff', status: 'internal', skp: [] },
  { id: 'm8', name: 'Arya', role: 'Support Staff', status: 'internal', skp: [] }
];

const INITIAL_UNITS: Unit[] = [
  { id: 'u1', unit_name: 'Pesawat Tenaga dan Produksi (PTP)', required_skp: 'PTP' },
  { id: 'u2', unit_name: 'Pesawat Angkat dan Angkut (PAA)', required_skp: 'PAA' },
  { id: 'u3', unit_name: 'Elevator & Eskalator', required_skp: 'Elevator' },
  { id: 'u4', unit_name: 'Pesawat Uap dan Bejana Tekan (PUBT)', required_skp: 'PUBT' },
  { id: 'u5', unit_name: 'Instalasi Penyalur Petir', required_skp: 'Instalasi Listrik' },
  { id: 'u6', unit_name: 'Angkur & TKPK', required_skp: 'Angkur TKPK' },
  { id: 'u7', unit_name: 'Instalasi Listrik', required_skp: 'Instalasi Listrik' }
];

const INITIAL_SCHEDULES: Schedule[] = [
  {
    id: 's1',
    client_name: 'PT Maju Jaya Sentosa',
    pic_name: 'Bpk. Budi',
    start_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    unit_ids: ['u1', 'u2'],
    lead_expert_id: 'm1',
    support_ids: ['m7', 'm8'],
    priority: 'P2',
    status: 'Scheduled'
  },
  {
    id: 's2',
    client_name: 'Rumah Sakit Sehat Sejahtera',
    pic_name: 'Ibu Linda',
    start_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    unit_ids: ['u4'],
    lead_expert_id: 'm2',
    support_ids: ['m6'],
    priority: 'P1',
    status: 'Scheduled'
  },
  {
    id: 's3',
    client_name: 'Apartemen Green View',
    pic_name: 'Bpk. Rahmat',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    unit_ids: ['u3'],
    lead_expert_id: 'm1',
    support_ids: ['m6', 'm7'],
    priority: 'P3',
    status: 'Scheduled'
  }
];

const getLocalSchedules = (): Schedule[] => {
  if (typeof window === 'undefined') return INITIAL_SCHEDULES;
  const stored = localStorage.getItem('local_schedules');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return INITIAL_SCHEDULES;
    }
  }
  localStorage.setItem('local_schedules', JSON.stringify(INITIAL_SCHEDULES));
  return INITIAL_SCHEDULES;
};

const saveLocalSchedules = (list: Schedule[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('local_schedules', JSON.stringify(list));
  }
};

export default function App() {
  const { activeUser, loading } = useUser();

  // Database States
  const [manpowerList, setManpowerList] = useState<Manpower[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  // System status
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [geminiConnected, setGeminiConnected] = useState(false);

  // App UI state
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summaryTrigger, setSummaryTrigger] = useState(0);

  // Fetch all initial data directly from Supabase
  const loadAllData = async () => {
    setIsRefreshing(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        console.warn('[Data Warn] Supabase is not configured. Falling back to Local Storage / Local datasets.');
        setSupabaseConnected(false);
        setGeminiConnected(true); // AI feature fallback

        setManpowerList(INITIAL_MANPOWER);
        setUnits(INITIAL_UNITS);
        setSchedules(getLocalSchedules());
        return;
      }

      setSupabaseConnected(true);
      setGeminiConnected(true);

      // Call Supabase queries in parallel for ultra fast load times
      const [manpowerRes, unitsRes, schedulesRes] = await Promise.all([
        supabase.from('manpower').select('*'),
        supabase.from('units').select('*'),
        supabase.from('schedules').select('*')
      ]);

      if (manpowerRes.error) {
        console.warn('[Supabase Warning] Manpower query returned error, using local fallback:', manpowerRes.error.message || manpowerRes.error);
        setManpowerList(INITIAL_MANPOWER);
      } else {
        setManpowerList(manpowerRes.data && manpowerRes.data.length > 0 ? (manpowerRes.data as Manpower[]) : INITIAL_MANPOWER);
      }

      if (unitsRes.error) {
        console.warn('[Supabase Warning] Units query returned error, using local fallback:', unitsRes.error.message || unitsRes.error);
        setUnits(INITIAL_UNITS);
      } else {
        setUnits(unitsRes.data && unitsRes.data.length > 0 ? (unitsRes.data as Unit[]) : INITIAL_UNITS);
      }

      if (schedulesRes.error) {
        console.warn('[Supabase Warning] Schedules query returned error, using local fallback:', schedulesRes.error.message || schedulesRes.error);
        setSchedules(getLocalSchedules());
      } else {
        setSchedules(schedulesRes.data ? (schedulesRes.data as Schedule[]) : []);
      }
    } catch (err: any) {
      console.warn('[Supabase Warning] Exception caught in loadAllData, falling back to local datasets:', err?.message || err);
      // Failover safely
      setManpowerList(INITIAL_MANPOWER);
      setUnits(INITIAL_UNITS);
      setSchedules(getLocalSchedules());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handle saving a schedule directly on Supabase
  const handleSaveSchedule = async (scheduleData: Omit<Schedule, 'id'> & { id?: string }) => {
    try {
      setIsRefreshing(true);
      if (editingSchedule && editingSchedule.id) {
        // Edit flow
        const updatedData = {
          ...scheduleData,
          updated_by: activeUser || undefined
        };

        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.from('schedules').update(updatedData).eq('id', editingSchedule.id);
          if (error) {
            console.error('Error updating schedule on Supabase:', error);
            alert(`Gagal memperbarui jadwal di Supabase: ${error.message}`);
          }
        } else {
          console.log('[App Debug] Supabase offline/unconfigured, updating locally.');
          const current = getLocalSchedules();
          const idx = current.findIndex(s => s.id === editingSchedule.id);
          if (idx !== -1) {
            current[idx] = { ...current[idx], ...updatedData };
            saveLocalSchedules(current);
          }
        }

        await loadAllData();
        setSummaryTrigger(p => p + 1); // trigger AI Summary recalculation
        setIsFormOpen(false);
        setEditingSchedule(null);
      } else {
        // Add flow
        const newData = {
          ...scheduleData,
          created_by: activeUser || undefined
        };

        if (isSupabaseConfigured && supabase) {
          const insertPayload = { ...newData };
          delete (insertPayload as any).id; // Auto-generate primary key on Supabase side

          const { error } = await supabase.from('schedules').insert([insertPayload]);
          if (error) {
            console.error('Error inserting schedule on Supabase:', error);
            alert(`Gagal menyimpan jadwal baru di Supabase: ${error.message}`);
          }
        } else {
          console.log('[App Debug] Supabase offline/unconfigured, inserting locally.');
          const current = getLocalSchedules();
          const newLocalItem = {
            ...newData,
            id: `s_local_${Date.now()}`
          };
          current.push(newLocalItem);
          saveLocalSchedules(current);
        }

        await loadAllData();
        setSummaryTrigger(p => p + 1); // trigger AI Summary recalculation
        setIsFormOpen(false);
      }
    } catch (err) {
      console.error('Error saving schedule:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Delete schedule directly from Supabase
  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus agenda plotting ini?')) return;
    try {
      setIsRefreshing(true);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('schedules').delete().eq('id', id);
        if (error) {
          console.error('Error deleting schedule on Supabase:', error);
          alert(`Gagal menghapus jadwal di Supabase: ${error.message}`);
        }
      } else {
        console.log('[App Debug] Supabase offline/unconfigured, deleting locally.');
        const current = getLocalSchedules();
        const filtered = current.filter(s => s.id !== id);
        saveLocalSchedules(filtered);
      }

      await loadAllData();
      setSummaryTrigger(p => p + 1); // trigger AI Summary update
    } catch (err) {
      console.error('Error deleting schedule:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEditTrigger = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setIsFormOpen(true);
  };

  const handleQuickAddSchedule = (dateStr: string) => {
    setEditingSchedule({
      id: '', // Blank ID denotes custom quick template
      client_name: '',
      pic_name: '',
      start_date: dateStr,
      end_date: dateStr,
      unit_ids: [],
      lead_expert_id: '',
      support_ids: [],
      priority: 'P2',
      status: 'Scheduled'
    });
    setIsFormOpen(true);
  };

  // Calculated widgets statistics - Moved here before early returns to comply with Rules of Hooks
  const stats = React.useMemo(() => {
    const active = schedules.filter(s => s.status === 'Scheduled');
    const p1Count = active.filter(s => s.priority === 'P1').length;
    const completed = schedules.filter(s => s.status === 'Completed').length;
    
    // Unique clients
    const uniqueClients = new Set(schedules.map(s => s.client_name)).size;

    return {
      activeCount: active.length,
      p1Count,
      completedCount: completed,
      uniqueClients
    };
  }, [schedules]);

  // Check login and display loading/login screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400 font-medium font-mono mt-3 animate-pulse">Menghubungkan sesi...</p>
      </div>
    );
  }

  if (!activeUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB] text-slate-800 flex flex-col font-sans">
      <Navbar
        supabaseConnected={supabaseConnected}
        geminiConnected={geminiConnected}
        onRefreshAll={loadAllData}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] text-emerald-600 uppercase font-bold tracking-widest">Ruang Kerja Penjadwalan</p>
            </div>
            <h2 className="text-xl font-bold font-sans tracking-tight text-slate-800 mt-1">
              Selamat Datang kembali, <span className="text-emerald-600">{activeUser}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Kelola penugasan ahli (SKP), support staff, dan hindari bentrok jadwal operasional perusahaan riksa uji Anda secara instan.
            </p>
          </div>

          <button
            onClick={() => {
              setEditingSchedule(null);
              setIsFormOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#B8860B] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Plus className="h-4 w-4 text-white" />
            Tambah Plotting Baru
          </button>
        </div>

        {/* Dashboard Analytics & Summary Bento Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Quick Stats Grid - Left 5 columns */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            {/* Stat 1 */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-emerald-600">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Inspeksi Aktif</span>
                <p className="text-lg font-black font-mono text-slate-850 mt-0.5">{stats.activeCount}</p>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="bg-red-50 border border-red-100 p-2 rounded-lg text-red-600">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Prioritas P1</span>
                <p className="text-lg font-black font-mono text-red-600 mt-0.5">{stats.p1Count}</p>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="bg-amber-50 border border-amber-100 p-2 rounded-lg text-amber-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Klien Terdaftar</span>
                <p className="text-lg font-black font-mono text-amber-600 mt-0.5">{stats.uniqueClients}</p>
              </div>
            </div>

            {/* Stat 4 */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Selesai Riksa</span>
                <p className="text-lg font-black font-mono text-emerald-600 mt-0.5">{stats.completedCount}</p>
              </div>
            </div>
          </div>

          {/* AI summary widget - Right 7 columns */}
          <div className="lg:col-span-7">
            <SummaryWidget refreshTrigger={summaryTrigger} />
          </div>
        </div>

        {/* Central Calendar & Manpower Row */}
        <div className="space-y-6">
          {/* Main Calendar View with Selected Day Projects */}
          <CalendarView
            schedules={schedules}
            units={units}
            manpowerList={manpowerList}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onEditSchedule={handleEditTrigger}
            onDeleteSchedule={handleDeleteSchedule}
            onQuickAddSchedule={handleQuickAddSchedule}
          />

          {/* Manpower Directory Directory status card */}
          <ManpowerGrid
            manpowerList={manpowerList}
            schedules={schedules}
            selectedDate={selectedDate}
          />
        </div>
      </main>

      {/* Modal Slideover for Creating/Modifying Plotting */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl relative"
            >
              <ScheduleForm
                initialSchedule={editingSchedule}
                manpowerList={manpowerList}
                units={units}
                schedules={schedules}
                onSave={handleSaveSchedule}
                onCancel={() => {
                  setIsFormOpen(false);
                  setEditingSchedule(null);
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-[10px] text-slate-400 font-medium tracking-wide mt-auto">
        <p>© 2026 RiksaSync AI. Hak Cipta Dilindungi Undang-Undang.</p>
        <p className="mt-1 text-slate-500">Dikembangkan khusus sebagai Solusi Manajemen Sumber Daya PJK3</p>
      </footer>
    </div>
  );
}
