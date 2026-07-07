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

  // Fetch all initial data
  const loadAllData = async () => {
    setIsRefreshing(true);
    try {
      // Parallel fetches for speed!
      const [resStatus, resManpower, resUnits, resSchedules] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/manpower'),
        fetch('/api/units'),
        fetch('/api/schedules')
      ]);

      if (resStatus.ok) {
        const statusData = await resStatus.json();
        setSupabaseConnected(statusData.supabase);
        setGeminiConnected(statusData.gemini);
      }

      if (resManpower.ok) {
        setManpowerList(await resManpower.json());
      }

      if (resUnits.ok) {
        setUnits(await resUnits.json());
      }

      if (resSchedules.ok) {
        setSchedules(await resSchedules.json());
      }
    } catch (err) {
      console.error('Error loading operational data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handle saving a schedule (creates or updates)
  const handleSaveSchedule = async (scheduleData: Omit<Schedule, 'id'> & { id?: string }) => {
    try {
      setIsRefreshing(true);
      if (editingSchedule && editingSchedule.id) {
        // Edit flow - automatically append activeUser to updated_by
        const updatedData = {
          ...scheduleData,
          updated_by: activeUser || undefined
        };

        const properRes = await fetch(`/api/schedules/${editingSchedule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        });

        if (properRes.ok) {
          await loadAllData();
          setSummaryTrigger(p => p + 1); // trigger AI Summary recalculation
          setIsFormOpen(false);
          setEditingSchedule(null);
        } else {
          alert('Gagal memperbarui jadwal.');
        }
      } else {
        // Add flow - automatically append activeUser to created_by
        const newData = {
          ...scheduleData,
          created_by: activeUser || undefined
        };

        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newData)
        });

        if (res.ok) {
          await loadAllData();
          setSummaryTrigger(p => p + 1); // trigger AI Summary recalculation
          setIsFormOpen(false);
        } else {
          alert('Gagal menyimpan jadwal baru.');
        }
      }
    } catch (err) {
      console.error('Error saving schedule:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Delete schedule
  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus agenda plotting ini?')) return;
    try {
      setIsRefreshing(true);
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        await loadAllData();
        setSummaryTrigger(p => p + 1); // trigger AI Summary update
      } else {
        alert('Gagal menghapus jadwal.');
      }
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
