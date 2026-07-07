/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Users, CalendarDays, Award, CheckCircle2, Shield, Settings, Info, Sparkles, AlertTriangle, RefreshCcw } from 'lucide-react';
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
  const { activeUser, loading, logout, error: authError } = useUser();

  // Database States
  const [manpowerList, setManpowerList] = useState<Manpower[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);

  // System status
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [geminiConnected, setGeminiConnected] = useState(false);

  // State to track if SQL is copied
  const [isCopied, setIsCopied] = useState(false);

  const dbErrorCombined = dbError || authError;

  const SQL_SEED_SCRIPT = `-- 1. Create app_users table
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL
);

-- 2. Create manpower table
CREATE TABLE IF NOT EXISTS manpower (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('internal', 'external')),
  skp TEXT[] NOT NULL DEFAULT '{}'
);

-- 3. Create units table
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  unit_name TEXT NOT NULL,
  required_skp TEXT NOT NULL
);

-- 4. Create schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  pic_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  unit_ids TEXT[] NOT NULL DEFAULT '{}',
  lead_expert_id TEXT NOT NULL,
  support_ids TEXT[] NOT NULL DEFAULT '{}',
  priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3')),
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Scheduled', 'Completed', 'Cancelled')) DEFAULT 'Scheduled',
  unit_descriptions TEXT[] DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  agenda_type TEXT,
  manual_agenda TEXT,
  is_until_finished BOOLEAN DEFAULT false
);

-- 5. Seed app_users
INSERT INTO app_users (id, username, role) VALUES
  ('u1', 'Zulfan', 'IT Staff'),
  ('u2', 'Angga', 'Leader & Ahli Utama'),
  ('u3', 'Imam', 'Ahli Spesialis'),
  ('u4', 'Fakhziar', 'Ahli Spesialis'),
  ('u5', 'Fauzan', 'Ahli Spesialis'),
  ('u6', 'Ajay', 'Support Staff'),
  ('u7', 'Arya', 'Support Staff')
ON CONFLICT (username) DO UPDATE SET role = EXCLUDED.role;

-- 6. Seed manpower
INSERT INTO manpower (id, name, role, status, skp) VALUES
  ('m1', 'Angga', 'Leader & Ahli Utama', 'internal', ARRAY['PTP', 'PAA', 'Elevator', 'Eskalator']),
  ('m2', 'Imam', 'Ahli Spesialis', 'internal', ARRAY['PUBT', 'Instalasi Listrik']),
  ('m3', 'Fakhziar', 'Ahli Spesialis', 'internal', ARRAY['PUBT']),
  ('m4', 'Fauzan', 'Ahli Spesialis', 'internal', ARRAY['Instalasi Listrik', 'PAA']),
  ('m5', 'Katez', 'Ahli Eksternal', 'external', ARRAY['Angkur TKPK']),
  ('m6', 'Riyan', 'Helper & Teknisi', 'external', ARRAY[]::TEXT[]),
  ('m7', 'Ajay', 'Support Staff', 'internal', ARRAY[]::TEXT[]),
  ('m8', 'Arya', 'Support Staff', 'internal', ARRAY[]::TEXT[])
ON CONFLICT (id) DO NOTHING;

-- 7. Seed units
INSERT INTO units (id, unit_name, required_skp) VALUES
  ('u1', 'Pesawat Tenaga dan Produksi (PTP)', 'PTP'),
  ('u2', 'Pesawat Angkat dan Angkut (PAA)', 'PAA'),
  ('u3', 'Elevator & Eskalator', 'Elevator'),
  ('u4', 'Pesawat Uap dan Bejana Tekan (PUBT)', 'PUBT'),
  ('u5', 'Instalasi Penyalur Petir', 'Instalasi Listrik'),
  ('u6', 'Angkur & TKPK', 'Angkur TKPK'),
  ('u7', 'Instalasi Listrik', 'Instalasi Listrik')
ON CONFLICT (id) DO NOTHING;`;

  const handleCopySql = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(SQL_SEED_SCRIPT);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // App UI state
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summaryTrigger, setSummaryTrigger] = useState(0);

  // Fetch all initial data directly from Supabase
  const loadAllData = async () => {
    setIsRefreshing(true);
    setDbError(null);
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase client is not configured. Please supply valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
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
        throw new Error(`Error fetching manpower from Supabase: ${manpowerRes.error.message || JSON.stringify(manpowerRes.error)}`);
      }
      if (unitsRes.error) {
        throw new Error(`Error fetching units from Supabase: ${unitsRes.error.message || JSON.stringify(unitsRes.error)}`);
      }
      if (schedulesRes.error) {
        throw new Error(`Error fetching schedules from Supabase: ${schedulesRes.error.message || JSON.stringify(schedulesRes.error)}`);
      }

      let manpowerData = manpowerRes.data as Manpower[] || [];
      if (manpowerData.length === 0) {
        console.log('[App] manpower table is empty. Auto-seeding initial manpower...');
        const initialManpower: Manpower[] = [
          { id: 'm1', name: 'Angga', role: 'Leader & Ahli Utama', status: 'internal', skp: ['PTP', 'PAA', 'Elevator', 'Eskalator'] },
          { id: 'm2', name: 'Imam', role: 'Ahli Spesialis', status: 'internal', skp: ['PUBT', 'Instalasi Listrik'] },
          { id: 'm3', name: 'Fakhziar', role: 'Ahli Spesialis', status: 'internal', skp: ['PUBT'] },
          { id: 'm4', name: 'Fauzan', role: 'Ahli Spesialis', status: 'internal', skp: ['Instalasi Listrik', 'PAA'] },
          { id: 'm5', name: 'Katez', role: 'Ahli Eksternal', status: 'external', skp: ['Angkur TKPK'] },
          { id: 'm6', name: 'Riyan', role: 'Helper & Teknisi', status: 'external', skp: [] },
          { id: 'm7', name: 'Ajay', role: 'Support Staff', status: 'internal', skp: [] },
          { id: 'm8', name: 'Arya', role: 'Support Staff', status: 'internal', skp: [] }
        ];
        const { data: seeded, error: err } = await supabase.from('manpower').insert(initialManpower).select();
        if (!err && seeded) {
          manpowerData = seeded as Manpower[];
        } else {
          manpowerData = initialManpower;
        }
      }

      let unitsData = unitsRes.data as Unit[] || [];
      if (unitsData.length === 0) {
        console.log('[App] units table is empty. Auto-seeding initial units...');
        const initialUnits = [
          { id: 'u1', unit_name: 'Pesawat Tenaga dan Produksi (PTP)', required_skp: 'PTP' },
          { id: 'u2', unit_name: 'Pesawat Angkat dan Angkut (PAA)', required_skp: 'PAA' },
          { id: 'u3', unit_name: 'Elevator & Eskalator', required_skp: 'Elevator' },
          { id: 'u4', unit_name: 'Pesawat Uap dan Bejana Tekan (PUBT)', required_skp: 'PUBT' },
          { id: 'u5', unit_name: 'Instalasi Penyalur Petir', required_skp: 'Instalasi Listrik' },
          { id: 'u6', unit_name: 'Angkur & TKPK', required_skp: 'Angkur TKPK' },
          { id: 'u7', unit_name: 'Instalasi Listrik', required_skp: 'Instalasi Listrik' }
        ];
        const { data: seeded, error: err } = await supabase.from('units').insert(initialUnits).select();
        if (!err && seeded) {
          unitsData = seeded as Unit[];
        } else {
          unitsData = initialUnits;
        }
      }

      setManpowerList(manpowerData);
      setUnits(unitsData);
      setSchedules(schedulesRes.data as Schedule[] || []);
    } catch (err: any) {
      const exceptionMsg = err?.message || String(err);
      console.warn('[Supabase Warning] Direct data fetching failed:', exceptionMsg);
      setDbError(exceptionMsg);
      setManpowerList([]);
      setUnits([]);
      setSchedules([]);
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
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase client is not configured. Cannot save schedule.');
      }

      if (editingSchedule && editingSchedule.id) {
        // Edit flow
        const updatedData = {
          ...scheduleData,
          updated_by: activeUser || undefined
        };

        const { error } = await supabase.from('schedules').update(updatedData).eq('id', editingSchedule.id);
        if (error) {
          throw new Error(`Gagal memperbarui jadwal di Supabase: ${error.message}`);
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

        const insertPayload = { ...newData };
        delete (insertPayload as any).id; // Auto-generate primary key on Supabase side

        const { error } = await supabase.from('schedules').insert([insertPayload]);
        if (error) {
          throw new Error(`Gagal menyimpan jadwal baru di Supabase: ${error.message}`);
        }

        await loadAllData();
        setSummaryTrigger(p => p + 1); // trigger AI Summary recalculation
        setIsFormOpen(false);
      }
    } catch (err: any) {
      const exceptionMsg = err?.message || String(err);
      console.error('[Supabase Error] Saving schedule failed:', exceptionMsg);
      setDbError(exceptionMsg);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Delete schedule directly from Supabase
  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus agenda plotting ini?')) return;
    try {
      setIsRefreshing(true);
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase client is not configured. Cannot delete schedule.');
      }

      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) {
        throw new Error(`Gagal menghapus jadwal di Supabase: ${error.message}`);
      }

      await loadAllData();
      setSummaryTrigger(p => p + 1); // trigger AI Summary update
    } catch (err: any) {
      const exceptionMsg = err?.message || String(err);
      console.error('[Supabase Error] Deleting schedule failed:', exceptionMsg);
      setDbError(exceptionMsg);
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

  if (dbErrorCombined) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-4 py-12">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-600" />
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-8 space-y-6 relative overflow-hidden">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 mb-2">
              <AlertTriangle className="h-6 w-6 text-rose-600 animate-bounce" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Koneksi / Inisialisasi Database Gagal</h1>
            <p className="text-xs text-slate-500 font-medium">
              Sistem tidak dapat terhubung, memuat data, atau menemukan tabel di database Supabase Anda.
            </p>
          </div>

          <div className="p-5 bg-rose-50 border border-rose-150 rounded-2xl space-y-2 font-mono text-xs">
            <p className="font-bold text-rose-800">Detail Kesalahan:</p>
            <p className="text-rose-700 leading-relaxed break-all whitespace-pre-wrap">{dbErrorCombined}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Solusi: Jalankan Script SQL di Supabase SQL Editor
              </h2>
              <button
                onClick={handleCopySql}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-all active:scale-95 cursor-pointer"
              >
                {isCopied ? 'Tersalin!' : 'Salin SQL'}
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Silakan salin kode SQL di bawah ini dan jalankan pada menu <strong>SQL Editor</strong> di dashboard Supabase Anda untuk membuat dan mengisi tabel yang diperlukan secara instan:
            </p>
            <div className="relative">
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] leading-relaxed max-h-48 overflow-y-auto whitespace-pre select-all border border-slate-800">
                {SQL_SEED_SCRIPT}
              </pre>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                setDbError(null);
                loadAllData();
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCcw className="h-4 w-4 animate-spin-reverse" />
              Coba Hubungkan Kembali
            </button>
            <button
              onClick={() => {
                setDbError(null);
                logout();
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-3 rounded-xl border border-slate-200 transition-all active:scale-95 cursor-pointer"
            >
              Keluar Sesi
            </button>
          </div>
        </div>
      </div>
    );
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
