/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Users, CalendarDays, Award, CheckCircle2, Shield, Settings, Info, Sparkles, AlertTriangle, RefreshCcw, ClipboardList, Database, Code, Copy, X, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Navbar from './components/Navbar';
import SummaryWidget from './components/SummaryWidget';
import CalendarView from './components/CalendarView';
import ManpowerGrid from './components/ManpowerGrid';
import ScheduleForm from './components/ScheduleForm';
import ManpowerManagement from './components/ManpowerManagement';
import WhatsappDispatcher from './components/WhatsappDispatcher';
import { Manpower, Unit, Schedule, ManpowerAbsence } from './types';
import { useUser } from './context/UserContext';
import LoginScreen from './components/LoginScreen';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import GuideModal from './components/GuideModal';
import NotificationCenter from './components/NotificationCenter';

const INITIAL_MANPOWER: Manpower[] = [
  { id: 'm1', name: 'Angga', role: 'Leader & Ahli Utama', status: 'internal', skp: ['PTP', 'PAA', 'Elevator', 'Eskalator'] },
  { id: 'm2', name: 'Imam', role: 'Ahli Spesialis', status: 'internal', skp: ['PUBT', 'Instalasi Listrik'] },
  { id: 'm3', name: 'Fakhziar', role: 'Ahli Spesialis', status: 'internal', skp: ['PUBT'] },
  { id: 'm4', name: 'Fauzan', role: 'Ahli Spesialis', status: 'internal', skp: ['Instalasi Listrik', 'PAA'] },
  { id: 'm5', name: 'Katez', role: 'Ahli Eksternal', status: 'external', skp: ['Angkur TKPK'] },
  { id: 'm6', name: 'Riyan', role: 'Helper & Teknisi', status: 'external', skp: [] },
  { id: 'm7', name: 'Ajay', status: 'internal', role: 'Support Staff', skp: [] },
  { id: 'm8', name: 'Arya', status: 'internal', role: 'Support Staff', skp: [] },
  { id: 'm9', name: 'Zulfan', status: 'internal', role: 'Support Staff', skp: [] }
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
  const [clients, setClients] = useState<{ id: string; client_name: string; pic_name: string; pic_phone: string }[]>([]);
  const [absences, setAbsences] = useState<ManpowerAbsence[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // System status
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [geminiConnected, setGeminiConnected] = useState(false);

  // State to track if SQL is copied
  const [isCopied, setIsCopied] = useState(false);

  const dbErrorCombined = dbError || authError;

  const SQL_SEED_SCRIPT = `-- 0. Enable UUID extension (Required for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create app_users table
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

-- 2b. Create clients table (UPGRADE 2026)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT UNIQUE NOT NULL,
  pic_name TEXT NOT NULL,
  pic_phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2c. Create manpower_absences table
CREATE TABLE IF NOT EXISTS manpower_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manpower_id TEXT NOT NULL,
  date TEXT NOT NULL,
  absence_type TEXT NOT NULL CHECK (absence_type IN ('Sakit', 'Cuti', 'Izin')),
  reason TEXT,
  UNIQUE(manpower_id, date)
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
  pic_phone TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  unit_ids TEXT[] DEFAULT '{}',
  lead_expert_id TEXT,
  support_ids TEXT[] NOT NULL DEFAULT '{}',
  priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3')),
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Scheduled', 'Completed', 'Cancelled')) DEFAULT 'Scheduled',
  unit_descriptions TEXT[] DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  agenda_type TEXT DEFAULT 'Riksa Uji',
  manual_agenda TEXT,
  is_until_finished BOOLEAN DEFAULT false,
  location TEXT
);

-- 4b. Migration Fallback: Ensure all columns exist on existing schedules table
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS agenda_type TEXT DEFAULT 'Riksa Uji';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS manual_agenda TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS is_until_finished BOOLEAN DEFAULT false;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS unit_descriptions TEXT[] DEFAULT '{}';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS unit_ids TEXT[] DEFAULT '{}';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS lead_expert_id TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS support_ids TEXT[] DEFAULT '{}';

-- 4c. Migration Fallback: Ensure all columns exist on existing manpower table
ALTER TABLE manpower ADD COLUMN IF NOT EXISTS skp TEXT[] NOT NULL DEFAULT '{}';

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
  ('m8', 'Arya', 'Support Staff', 'internal', ARRAY[]::TEXT[]),
  ('m9', 'Zulfan', 'Support Staff', 'internal', ARRAY[]::TEXT[])
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
  const [isManpowerMgmtOpen, setIsManpowerMgmtOpen] = useState(false);
  const [isSqlEditorOpen, setIsSqlEditorOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [customSql, setCustomSql] = useState(SQL_SEED_SCRIPT);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summaryTrigger, setSummaryTrigger] = useState(0);

  useEffect(() => {
    const hasSeen = localStorage.getItem('aksara_welcome_seen');
    if (!hasSeen && activeUser) {
      setShowWelcomeBanner(true);
    }
  }, [activeUser]);

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
      const [manpowerRes, unitsRes, schedulesRes, clientsRes, absencesRes] = await Promise.all([
        supabase.from('manpower').select('*'),
        supabase.from('units').select('*'),
        supabase.from('schedules').select('*'),
        (async () => {
          try {
            return await supabase.from('clients').select('*');
          } catch (e) {
            return { data: [], error: e } as any;
          }
        })(),
        (async () => {
          try {
            return await supabase.from('manpower_absences').select('*');
          } catch (e) {
            return { data: [], error: e } as any;
          }
        })()
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
          { id: 'm8', name: 'Arya', role: 'Support Staff', status: 'internal', skp: [] },
          { id: 'm9', name: 'Zulfan', role: 'Support Staff', status: 'internal', skp: [] }
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

      const clientsData = clientsRes && !clientsRes.error ? (clientsRes.data || []) : [];

      let absencesData = absencesRes && !absencesRes.error ? (absencesRes.data || []) : [];
      if (!absencesRes || absencesRes.error) {
        const local = localStorage.getItem('local_manpower_absences');
        if (local) {
          try {
            absencesData = JSON.parse(local);
          } catch (e) {}
        }
      }

      setManpowerList(manpowerData);
      setUnits(unitsData);
      setSchedules(schedulesRes.data as Schedule[] || []);
      setClients(clientsData);
      setAbsences(absencesData as ManpowerAbsence[]);
    } catch (err: any) {
      const exceptionMsg = err?.message || String(err);
      console.warn('[Supabase Warning] Direct data fetching failed, loading local values:', exceptionMsg);
      setDbError(exceptionMsg);
      // Load local fallbacks so the app remains fully interactive!
      setManpowerList(INITIAL_MANPOWER);
      setUnits(INITIAL_UNITS);
      setSchedules(getLocalSchedules());
      setClients([]);
      const localAbs = localStorage.getItem('local_manpower_absences');
      if (localAbs) {
        try {
          setAbsences(JSON.parse(localAbs));
        } catch (e) {}
      }
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
      setActionError(null);
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase client is not configured. Cannot save schedule.');
      }

      // Check if client is new and automatically insert into the clients table
      if (scheduleData.client_name) {
        const trimmedClient = scheduleData.client_name.trim();
        const clientExists = clients.some(
          c => c.client_name.toLowerCase() === trimmedClient.toLowerCase()
        );
        if (!clientExists && trimmedClient !== '') {
          try {
            await supabase.from('clients').insert([
              {
                client_name: trimmedClient,
                pic_name: scheduleData.pic_name || 'Staff PIC',
                pic_phone: scheduleData.pic_phone || '-'
              }
            ]);
            console.log('Successfully auto-inserted new client to database:', trimmedClient);
          } catch (clientErr) {
            console.warn('Auto insert new client failed (table clients might be missing or trigger error):', clientErr);
          }
        }
      }

      if (editingSchedule && editingSchedule.id && !editingSchedule.id.startsWith('local-')) {
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
        // Add flow (or edit local flow)
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
      console.warn('[Supabase Warning] Direct saving failed, falling back to LocalStorage:', exceptionMsg);
      
      // Local fallback saving
      try {
        const localSchedules = getLocalSchedules();
        if (editingSchedule && editingSchedule.id) {
          const updated = localSchedules.map(s => 
            s.id === editingSchedule.id ? { ...s, ...scheduleData, updated_by: activeUser || undefined } : s
          );
          saveLocalSchedules(updated);
          setSchedules(updated);
        } else {
          const newLocalSchedule: Schedule = {
            ...scheduleData,
            id: 'local-' + Date.now(),
            created_by: activeUser || undefined
          };
          const updated = [newLocalSchedule, ...localSchedules];
          saveLocalSchedules(updated);
          setSchedules(updated);
        }
        setActionError(`Penyimpanan ke Supabase gagal (${exceptionMsg}). Namun jangan khawatir, jadwal Anda TELAH BERHASIL DISIMPAN SECARA LOKAL di browser Anda sehingga data Anda aman! Untuk memperbaiki sinkronisasi Supabase secara permanen, silakan salin dan jalankan script migrasi SQL melalui tombol "Perbaiki Struktur Supabase" di bawah.`);
        setIsFormOpen(false);
        setEditingSchedule(null);
        setSummaryTrigger(p => p + 1);
      } catch (localErr) {
        setActionError(`Gagal menyimpan jadwal: ${exceptionMsg}`);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Delete schedule directly from Supabase
  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus agenda plotting ini?')) return;
    try {
      setIsRefreshing(true);
      setActionError(null);
      
      if (id.startsWith('local-')) {
        throw new Error('Local schedule. Deleting locally.');
      }

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
      console.warn('[Supabase Warning] Direct deletion failed, deleting from LocalStorage:', exceptionMsg);
      try {
        const localSchedules = getLocalSchedules();
        const updated = localSchedules.filter(s => s.id !== id);
        saveLocalSchedules(updated);
        setSchedules(updated);
        setActionError(`Penghapusan dari Supabase gagal (${exceptionMsg}). Namun, jadwal telah berhasil dihapus dari browser lokal Anda.`);
        setSummaryTrigger(p => p + 1);
      } catch (localErr) {
        setActionError(`Gagal menghapus jadwal: ${exceptionMsg}`);
      }
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
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">

        {/* New user welcome and guide recommendation banner */}
        {showWelcomeBanner && (
          <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-md border border-emerald-500/20 relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fadeIn">
            {/* Dynamic Glow */}
            <div className="absolute -top-20 -left-20 w-48 h-48 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />
            
            <div className="space-y-1 relative z-10">
              <div className="flex items-center gap-1.5 bg-emerald-700/40 px-2.5 py-0.5 rounded-full border border-emerald-500/20 w-fit">
                <Sparkles className="h-3 w-3 text-emerald-250 animate-pulse" />
                <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-100">Selamat & Selamat Datang!</span>
              </div>
              <h3 className="text-xs font-black tracking-tight md:text-sm">
                Aplikasi AksaraSync AI Berhasil Terkonfigurasi! 🎉
              </h3>
              <p className="text-[10px] text-emerald-150 leading-relaxed max-w-2xl font-medium">
                Selamat, database Supabase dan integrasi lokal Anda telah terhubung secara real-time. Sebagai pengguna baru, kami sangat menyarankan Anda membaca <strong>Buku Panduan Penggunaan</strong> terlebih dahulu agar dapat memanfaatkan fitur AI Plotter, Absensi, dan WhatsApp Dispatcher secara maksimal!
              </p>
            </div>

            <div className="flex items-center gap-2 relative z-10 w-full sm:w-auto shrink-0">
              <button
                onClick={() => {
                  setIsGuideOpen(true);
                  localStorage.setItem('aksara_welcome_seen', 'true');
                  setShowWelcomeBanner(false);
                }}
                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-emerald-700 font-extrabold text-[10px] px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer border-0 flex items-center justify-center gap-1 shrink-0"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Lihat Panduan</span>
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('aksara_welcome_seen', 'true');
                  setShowWelcomeBanner(false);
                }}
                className="p-2 bg-emerald-700/40 hover:bg-emerald-700/60 rounded-xl text-emerald-100 hover:text-white transition-colors cursor-pointer border-0 flex items-center justify-center shrink-0"
                title="Tutup & Jangan Tampilkan Lagi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Action Error alert banner with SQL solution */}
        {actionError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-5 py-4 rounded-2xl shadow-sm space-y-3 relative overflow-hidden animate-fadeIn">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Masalah Sinkronisasi Database
                  </h3>
                  <p className="text-xs text-amber-750 leading-relaxed mt-1 whitespace-pre-wrap">
                    {actionError}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActionError(null)}
                className="text-amber-500 hover:text-amber-700 font-bold text-xs p-1 rounded-lg hover:bg-amber-100 transition-all cursor-pointer shrink-0"
              >
                Tutup
              </button>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-amber-150">
              <button
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                {isCopied ? 'Tersalin!' : 'Salin SQL Migrasi'}
              </button>
              <span className="text-[10px] text-amber-650 font-medium font-sans">
                Lalu jalankan di dashboard Supabase SQL Editor untuk memperbarui struktur tabel schedules secara instan.
              </span>
            </div>
          </div>
        )}
        
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

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setIsManpowerMgmtOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Users className="h-4 w-4 text-emerald-600 animate-pulse" />
              Kelola Manpower
            </button>

            <button
              onClick={() => {
                setEditingSchedule(null);
                setIsFormOpen(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#B8860B] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4 text-white" />
              Tambah Plotting Baru
            </button>
          </div>
        </div>

        {/* Dashboard Analytics & Summary Bento Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Quick Stats Grid - Left 4 columns */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-4 h-full">
            {/* Stat 1 */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-center gap-2.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-emerald-600">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Inspeksi Aktif</span>
              </div>
              <p className="text-xl font-black font-mono text-slate-800 tracking-tight leading-none mt-1">{stats.activeCount}</p>
            </div>

            {/* Stat 2 */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-center gap-2.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="bg-red-50 border border-red-100 p-2 rounded-lg text-red-600">
                  <Shield className="h-4 w-4" />
                </div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Prioritas P1</span>
              </div>
              <p className="text-xl font-black font-mono text-red-600 tracking-tight leading-none mt-1">{stats.p1Count}</p>
            </div>

            {/* Stat 3 */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-center gap-2.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="bg-amber-50 border border-amber-100 p-2 rounded-lg text-amber-600">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Klien</span>
              </div>
              <p className="text-xl font-black font-mono text-amber-600 tracking-tight leading-none mt-1">{stats.uniqueClients}</p>
            </div>

            {/* Stat 4 */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-center gap-2.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Selesai Riksa</span>
              </div>
              <p className="text-xl font-black font-mono text-emerald-600 tracking-tight leading-none mt-1">{stats.completedCount}</p>
            </div>
          </div>

          {/* RiksaSync AI Assistant Unified Panel - Right 8 columns */}
          <div className="lg:col-span-8">
            <SummaryWidget />
          </div>
        </div>

        {/* Central Calendar & Manpower Row */}
        <div className="space-y-6">
          {/* Main Calendar View with Selected Day Projects */}
          <CalendarView
            schedules={schedules}
            units={units}
            manpowerList={manpowerList}
            absences={absences}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onEditSchedule={handleEditTrigger}
            onDeleteSchedule={handleDeleteSchedule}
            onQuickAddSchedule={handleQuickAddSchedule}
          />

          {/* Manpower & WhatsApp Dispatcher Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <ManpowerGrid
                manpowerList={manpowerList}
                schedules={schedules}
                absences={absences}
                selectedDate={selectedDate}
              />
            </div>
            <div className="lg:col-span-4">
              <WhatsappDispatcher
                schedules={schedules}
                units={units}
                manpowerList={manpowerList}
                absences={absences}
                selectedDate={selectedDate}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Modal Slideover for Creating/Modifying Plotting */}
      <AnimatePresence>
        {isGuideOpen && (
          <GuideModal onClose={() => setIsGuideOpen(false)} />
        )}
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
                clients={clients}
                absences={absences}
                onSave={handleSaveSchedule}
                onCancel={() => {
                  setIsFormOpen(false);
                  setEditingSchedule(null);
                }}
              />
            </motion.div>
          </div>
        )}

        {isManpowerMgmtOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-5xl relative flex justify-center"
            >
              <ManpowerManagement
                manpowerList={manpowerList}
                absences={absences}
                onRefreshAll={loadAllData}
                onClose={() => setIsManpowerMgmtOpen(false)}
              />
            </motion.div>
          </div>
        )}

        {isSqlEditorOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col text-slate-100 overflow-hidden max-h-[92vh] md:max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
                <div className="flex items-center gap-2">
                  <div className="bg-amber-500/15 border border-amber-500/30 p-1.5 rounded-lg text-amber-500">
                    <Database className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm md:text-base tracking-tight uppercase flex items-center gap-2">
                      <span>Supabase SQL Schema & Editor</span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">v2.0</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Konfigurasi struktur tabel database dan seed data</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSqlEditorOpen(false)}
                  className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all cursor-pointer border-0 bg-transparent"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-amber-500 font-bold">
                    <Info className="h-4 w-4" />
                    <span>Petunjuk Penggunaan SQL Editor</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Sistem menggunakan Supabase sebagai database cloud. Jika Anda menambahkan fitur absensi baru (<code className="font-mono bg-slate-950 px-1 py-0.5 rounded text-emerald-400">manpower_absences</code>) atau memperbarui kolom jadwal, Anda perlu memastikan struktur tabel tersebut sudah dibuat di dashboard Supabase Anda.
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 mt-2 text-slate-400 font-medium">
                    <li>Salin script SQL di bawah ini menggunakan tombol <strong className="text-slate-200">Salin Script SQL</strong>.</li>
                    <li>Buka dashboard proyek Anda di <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-0.5 font-bold">Supabase Console ↗</a>.</li>
                    <li>Pilih menu <strong>SQL Editor</strong> di bilah sisi kiri.</li>
                    <li>Klik <strong>New Query</strong>, paste script yang telah disalin, lalu klik tombol <strong className="text-emerald-400">Run</strong>.</li>
                  </ol>
                </div>

                {/* SQL Code Block Editor Panel */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Script SQL Generator (Dapat Diedit/Disalin)</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(customSql);
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                        }
                      }}
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all active:scale-95 cursor-pointer border-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {isCopied ? 'Script Tersalin!' : 'Salin Script SQL'}
                    </button>
                  </div>

                  <div className="relative border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                    {/* Fake Editor Window Rail */}
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-mono font-medium text-slate-400 ml-2">initialize_pjk3_schema.sql</span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">postgres / sql</span>
                    </div>

                    <textarea
                      value={customSql}
                      onChange={(e) => setCustomSql(e.target.value)}
                      spellCheck={false}
                      className="w-full h-80 bg-slate-950 p-4 font-mono text-xs text-emerald-400 focus:outline-none resize-none leading-relaxed overflow-y-auto selection:bg-slate-800 selection:text-white border-0"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 bg-slate-950 border-t border-slate-800 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setCustomSql(SQL_SEED_SCRIPT)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-all cursor-pointer bg-transparent border-0"
                >
                  Reset ke Default
                </button>
                <button
                  type="button"
                  onClick={() => setIsSqlEditorOpen(false)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer border-0"
                >
                  Selesai
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-[10px] text-slate-400 font-medium tracking-wide mt-auto">
        <p>© 2026 AksaraSync AI. Hak Cipta Dilindungi Undang-Undang.</p>
        <p className="mt-1 text-slate-500">Dikembangkan khusus sebagai Solusi Manajemen Sumber Daya PJK3</p>
      </footer>

      {/* Floating Mobile Notification Center */}
      <NotificationCenter isFloating={true} className="md:hidden" />
    </div>
  );
}
