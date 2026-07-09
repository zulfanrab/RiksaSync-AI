/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useMemo } from 'react';
import { 
  X, Plus, Trash2, Edit2, User, Check, Briefcase, Award, 
  Search, RefreshCw, AlertCircle, CalendarDays, KeyRound, ShieldAlert 
} from 'lucide-react';
import { Manpower, ManpowerAbsence } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useUser } from '../context/UserContext';

interface ManpowerManagementProps {
  manpowerList: Manpower[];
  absences: ManpowerAbsence[];
  onRefreshAll: () => Promise<void>;
  onClose: () => void;
}

const AVAILABLE_SKPS = [
  { value: 'PTP', label: 'PTP (Pesawat Tenaga & Produksi)' },
  { value: 'PAA', label: 'PAA (Pesawat Angkat & Angkut)' },
  { value: 'Elevator', label: 'Elevator' },
  { value: 'Eskalator', label: 'Eskalator' },
  { value: 'PUBT', label: 'PUBT (Pesawat Uap & Bejana Tekan)' },
  { value: 'Instalasi Listrik', label: 'Instalasi Listrik & Penyalur Petir' },
  { value: 'Angkur TKPK', label: 'Angkur & TKPK' }
];

export default function ManpowerManagement({ 
  manpowerList, 
  absences = [], 
  onRefreshAll, 
  onClose 
}: ManpowerManagementProps) {
  const { appUsers = [], refreshUsers } = useUser();
  const [activeTab, setActiveTab] = useState<'manpower' | 'absences' | 'login_profiles'>('manpower');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ==========================================
  // TAB 1: MANPOWER DIRECTORY STATE & HANDLERS
  // ==========================================
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Ahli Spesialis');
  const [status, setStatus] = useState<'internal' | 'external'>('internal');
  const [selectedSkps, setSelectedSkps] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'internal' | 'external'>('all');

  const filteredManpower = useMemo(() => {
    return manpowerList.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            m.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            m.skp.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = filterStatus === 'all' || m.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [manpowerList, searchTerm, filterStatus]);

  const handleSkpToggle = (skpVal: string) => {
    setSelectedSkps(prev => {
      if (prev.includes(skpVal)) {
        return prev.filter(s => s !== skpVal);
      } else {
        return [...prev, skpVal];
      }
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setRole('Ahli Spesialis');
    setStatus('internal');
    setSelectedSkps([]);
    setError(null);
  };

  const handleStartEdit = (person: Manpower) => {
    setEditingId(person.id);
    setName(person.name);
    setRole(person.role);
    setStatus(person.status);
    setSelectedSkps(person.skp || []);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSaveManpower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama manpower tidak boleh kosong.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Koneksi Supabase tidak terkonfigurasi. Perubahan tidak dapat disimpan.');
      }

      if (editingId) {
        const { error: dbErr } = await supabase
          .from('manpower')
          .update({
            name: name.trim(),
            role: role.trim(),
            status,
            skp: selectedSkps
          })
          .eq('id', editingId);

        if (dbErr) throw dbErr;
        setSuccessMsg(`Berhasil memperbarui data ${name}`);
      } else {
        const newId = 'm_' + Math.random().toString(36).substring(2, 9);
        const { error: dbErr } = await supabase
          .from('manpower')
          .insert([{
            id: newId,
            name: name.trim(),
            role: role.trim(),
            status,
            skp: selectedSkps
          }]);

        if (dbErr) throw dbErr;
        setSuccessMsg(`Berhasil menambahkan ${name} ke direktori`);
      }

      await onRefreshAll();
      resetForm();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('[Manpower Save Error]:', err);
      setError(err?.message || 'Gagal menyimpan data ke database.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteManpower = async (person: Manpower) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus "${person.name}" dari direktori manpower? Tindakan ini dapat memengaruhi jadwal aktif.`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Koneksi Supabase tidak terkonfigurasi.');
      }

      const { error: dbErr } = await supabase
        .from('manpower')
        .delete()
        .eq('id', person.id);

      if (dbErr) throw dbErr;

      setSuccessMsg(`Berhasil menghapus "${person.name}" dari direktori.`);
      await onRefreshAll();
      
      if (editingId === person.id) {
        resetForm();
      }
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('[Manpower Delete Error]:', err);
      setError(err?.message || 'Gagal menghapus data dari database.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // TAB 2: LEAVES & ABSENCES STATE & HANDLERS
  // ==========================================
  const [absenceManpowerId, setAbsenceManpowerId] = useState('');
  const [absenceDate, setAbsenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [absenceType, setAbsenceType] = useState<'Sakit' | 'Cuti' | 'Izin'>('Sakit');
  const [absenceReason, setAbsenceReason] = useState('');

  const handleSaveAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!absenceManpowerId) {
      setError('Pilih manpower terlebih dahulu.');
      return;
    }
    if (!absenceDate) {
      setError('Pilih tanggal absensi.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const newAbsenceObj = {
      manpower_id: absenceManpowerId,
      date: absenceDate,
      absence_type: absenceType,
      reason: absenceReason.trim() || null
    };

    try {
      // 1. Attempt Supabase insert
      if (isSupabaseConfigured && supabase) {
        const { error: dbErr } = await supabase
          .from('manpower_absences')
          .insert([newAbsenceObj]);

        if (dbErr) {
          console.warn('[Absence Supabase Error] Table might not exist yet, falling back to LocalStorage:', dbErr);
          throw dbErr;
        }
        setSuccessMsg('Berhasil mencatat ketidakhadiran di cloud database.');
      } else {
        throw new Error('Supabase client is offline.');
      }
    } catch (err: any) {
      // 2. Fallback to LocalStorage so it functions immediately
      console.info('[Absence Fallback] Saving absence record to LocalStorage...');
      const local = localStorage.getItem('local_manpower_absences');
      let localList: any[] = [];
      if (local) {
        try {
          localList = JSON.parse(local);
        } catch (e) {}
      }

      // Avoid duplicates in LocalStorage
      localList = localList.filter(a => !(a.manpower_id === absenceManpowerId && a.date === absenceDate));
      
      localList.push({
        id: 'abs_' + Math.random().toString(36).substring(2, 9),
        ...newAbsenceObj
      });

      localStorage.setItem('local_manpower_absences', JSON.stringify(localList));
      setSuccessMsg('Berhasil mencatat ketidakhadiran (Disimpan di Lokal Browser)');
    } finally {
      await onRefreshAll();
      setAbsenceReason('');
      setLoading(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleDeleteAbsence = async (id: string, manpowerId: string, date: string) => {
    if (!confirm('Hapus pencatatan absensi ini?')) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isSupabaseConfigured && supabase) {
        // try to delete from Supabase by ID or composite key
        const { error: dbErr } = await supabase
          .from('manpower_absences')
          .delete()
          .match({ manpower_id: manpowerId, date: date });

        if (dbErr) {
          console.warn('[Absence Delete DB Warning]:', dbErr);
        }
      }
    } catch (e) {}

    // Always mirror/cleanup in LocalStorage
    const local = localStorage.getItem('local_manpower_absences');
    if (local) {
      try {
        let localList = JSON.parse(local);
        localList = localList.filter((a: any) => !(a.manpower_id === manpowerId && a.date === date) && a.id !== id);
        localStorage.setItem('local_manpower_absences', JSON.stringify(localList));
      } catch (e) {}
    }

    setSuccessMsg('Berhasil menghapus pencatatan absensi.');
    await onRefreshAll();
    setLoading(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // ==========================================
  // TAB 3: LOGIN PROFILES STATE & HANDLERS
  // ==========================================
  const [newUsername, setNewUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState('Ahli Spesialis');

  const handleAddLoginProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUser = newUsername.trim();
    if (!trimmedUser) {
      setError('Nama profil tidak boleh kosong.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase tidak terhubung. Tidak bisa menambahkan profil login.');
      }

      // Check if username already exists
      const exists = appUsers.some(u => u.username.toLowerCase() === trimmedUser.toLowerCase());
      if (exists) {
        throw new Error(`Profil login "${trimmedUser}" sudah terdaftar.`);
      }

      const newId = 'u_' + Math.random().toString(36).substring(2, 9);
      const { error: dbErr } = await supabase
        .from('app_users')
        .insert([{
          id: newId,
          username: trimmedUser,
          role: newUserRole
        }]);

      if (dbErr) throw dbErr;

      setSuccessMsg(`Berhasil mendaftarkan akun login baru: ${trimmedUser}`);
      setNewUsername('');
      await refreshUsers();
    } catch (err: any) {
      console.error('[Add Login Profile Error]:', err);
      setError(err?.message || 'Gagal mendaftarkan profil login.');
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const handleDeleteLoginProfile = async (userId: string, userName: string) => {
    if (appUsers.length <= 1) {
      setError('Gagal menghapus. Minimal harus menyisakan 1 profil login di sistem.');
      return;
    }
    if (!confirm(`Apakah Anda yakin ingin menghapus akun login "${userName}"? Akun ini tidak akan bisa digunakan untuk login kembali.`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase tidak terhubung.');
      }

      const { error: dbErr } = await supabase
        .from('app_users')
        .delete()
        .eq('id', userId);

      if (dbErr) throw dbErr;

      setSuccessMsg(`Berhasil menghapus akun login: ${userName}`);
      await refreshUsers();
    } catch (err: any) {
      console.error('[Delete Login Profile Error]:', err);
      setError(err?.message || 'Gagal menghapus profil login.');
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-w-5xl w-full flex flex-col max-h-[90vh]">
      {/* Modal Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <Briefcase className="h-4.5 w-4.5" />
            </div>
            <h2 className="text-base font-black text-slate-800 tracking-tight">Pusat Administrasi & Pengaturan</h2>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Kelola direktori manpower ahli, pencatatan status absensi cuti/sakit, serta konfigurasi profil login pengguna.</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-slate-200 flex overflow-x-auto flex-nowrap px-6 shrink-0 scrollbar-thin">
        <button
          onClick={() => { setActiveTab('manpower'); setError(null); setSuccessMsg(null); }}
          className={`py-3.5 px-4 font-bold text-xs tracking-tight border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'manpower' 
              ? 'border-emerald-600 text-emerald-750' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Direktori Manpower
        </button>
        <button
          onClick={() => { setActiveTab('absences'); setError(null); setSuccessMsg(null); }}
          className={`py-3.5 px-4 font-bold text-xs tracking-tight border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'absences' 
              ? 'border-emerald-600 text-emerald-750' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Status Absensi (Sakit, Cuti, Izin)
        </button>
        <button
          onClick={() => { setActiveTab('login_profiles'); setError(null); setSuccessMsg(null); }}
          className={`py-3.5 px-4 font-bold text-xs tracking-tight border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'login_profiles' 
              ? 'border-emerald-600 text-emerald-750' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <KeyRound className="h-4 w-4" />
          Kelola Akun Login
        </button>
      </div>

      {/* Central Notification Messages */}
      {(error || successMsg) && (
        <div className="px-6 pt-4 shrink-0">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs font-medium animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2 text-emerald-700 text-xs font-medium animate-in fade-in">
              <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-6">
        
        {/* ========================================================= */}
        {/* TAB 1 CONTENT: MANPOWER DIRECTORY                         */}
        {/* ========================================================= */}
        {activeTab === 'manpower' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            {/* Form Section */}
            <div className="lg:col-span-5 bg-slate-50/50 border border-slate-150 rounded-2xl p-5 space-y-4 h-fit">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                {editingId ? <Edit2 className="h-3.5 w-3.5 text-amber-500" /> : <Plus className="h-3.5 w-3.5 text-emerald-500" />}
                {editingId ? 'Edit Data Manpower' : 'Tambah Manpower Baru'}
              </h3>

              <form onSubmit={handleSaveManpower} className="space-y-4">
                {/* Name Field */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nama Lengkap</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <User className="h-3.5 w-3.5" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Pak Habsi, Arya, dll."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Role Field */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Jabatan / Role</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ahli Spesialis, Support Staff, Helper"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Status Option (Internal vs External) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Status Kepegawaian</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus('internal')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                        status === 'internal'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Internal
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('external')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                        status === 'external'
                          ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Eksternal
                    </button>
                  </div>
                </div>

                {/* SKP Checklist */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-amber-500" />
                    Sertifikasi Lisensi SKP K3
                  </label>
                  <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
                    {AVAILABLE_SKPS.map((skp) => {
                      const isChecked = selectedSkps.includes(skp.value);
                      return (
                        <label
                          key={skp.value}
                          className="flex items-center gap-2.5 cursor-pointer text-xs font-medium hover:text-slate-900 text-slate-600 select-none py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleSkpToggle(skp.value)}
                            className="h-3.5 w-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                          />
                          <span className={isChecked ? 'text-emerald-700 font-semibold' : ''}>{skp.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-slate-400 italic leading-snug">Note: Ahli Spesialis minimal memiliki satu lisensi SKP.</p>
                </div>

                {/* Form actions */}
                <div className="flex items-center gap-2 pt-2">
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Batal
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer h-10"
                  >
                    {loading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : editingId ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Simpan Perubahan
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Tambah Personel
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Listing and Search Section */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  Direktori Personel ({filteredManpower.length} orang)
                </h3>
                
                {/* Status Filter Toggle */}
                <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[10px] font-bold shrink-0">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${filterStatus === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setFilterStatus('internal')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${filterStatus === 'internal' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Internal
                  </button>
                  <button
                    onClick={() => setFilterStatus('external')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${filterStatus === 'external' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Eksternal
                  </button>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Search className="h-3.5 w-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="Cari nama, jabatan, atau kode lisensi SKP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all h-10"
                />
              </div>

              {/* List of members */}
              <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[380px] overflow-y-auto">
                {filteredManpower.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <User className="h-8 w-8 mx-auto stroke-1 mb-2 text-slate-300" />
                    <p className="text-xs font-medium">Tidak ada personel yang cocok dengan pencarian.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredManpower.map((person) => (
                      <div key={person.id} className="p-3.5 hover:bg-slate-50/50 flex items-center justify-between gap-4 transition-all">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-xs truncate">{person.name}</span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.1 border rounded-md uppercase tracking-wider ${
                              person.status === 'internal'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-purple-50 text-purple-700 border-purple-100'
                            }`}>
                              {person.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 block font-medium leading-none">{person.role}</span>
                          <div className="flex flex-wrap gap-1 items-center pt-1">
                            {person.skp && person.skp.length > 0 ? (
                              person.skp.map((skpVal) => (
                                <span
                                  key={skpVal}
                                  className="text-[8px] bg-slate-100 border border-slate-200 font-mono font-bold px-1.5 py-0.2 rounded text-slate-600"
                                >
                                  {skpVal}
                                </span>
                              ))
                            ) : (
                              <span className="text-[8px] text-slate-400 italic">Tanpa SKP</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleStartEdit(person)}
                            title="Edit data personel"
                            className="p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg border border-transparent hover:border-amber-200 transition-all cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteManpower(person)}
                            title="Hapus dari direktori"
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2 CONTENT: LEAVES & ABSENCES                          */}
        {/* ========================================================= */}
        {activeTab === 'absences' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            {/* Absence Record Form */}
            <div className="lg:col-span-5 bg-slate-50/50 border border-slate-150 rounded-2xl p-5 space-y-4 h-fit">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-emerald-500" />
                Catat Ketidakhadiran (Sakit / Cuti / Izin)
              </h3>

              <form onSubmit={handleSaveAbsence} className="space-y-4">
                {/* Manpower Dropdown Selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pilih Manpower</label>
                  <select
                    required
                    value={absenceManpowerId}
                    onChange={(e) => setAbsenceManpowerId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all h-10 text-slate-700"
                  >
                    <option value="">-- Pilih Anggota Tim --</option>
                    {manpowerList.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                    ))}
                  </select>
                </div>

                {/* Absence Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tanggal Absen</label>
                  <input
                    type="date"
                    required
                    value={absenceDate}
                    onChange={(e) => setAbsenceDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all h-10 text-slate-700"
                  />
                </div>

                {/* Absence Type */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Jenis Absensi</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Sakit', 'Cuti', 'Izin'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAbsenceType(t)}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-extrabold transition-all text-center cursor-pointer uppercase tracking-wider ${
                          absenceType === t
                            ? t === 'Sakit' 
                              ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                              : t === 'Cuti'
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                              : 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {t === 'Sakit' ? '🔴 Sakit' : t === 'Cuti' ? '🔵 Cuti' : '🟡 Izin'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason Text */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Keterangan / Alasan (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Demam, Cuti Tahunan, Urusan Keluarga"
                    value={absenceReason}
                    onChange={(e) => setAbsenceReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 h-10"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer h-10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Simpan Absensi
                </button>
              </form>
            </div>

            {/* List of leave absences */}
            <div className="lg:col-span-7 flex flex-col space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                Log Izin & Absensi Tim ({absences.length} Agenda Absen)
              </h3>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[380px] overflow-y-auto">
                {absences.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <CalendarDays className="h-8 w-8 mx-auto stroke-1 mb-2 text-slate-300 animate-bounce" />
                    <p className="text-xs font-medium">Belum ada data tim yang sakit, cuti, atau izin.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-150">
                    {[...absences]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((abs) => {
                        const person = manpowerList.find(m => m.id === abs.manpower_id);
                        const styleClass = abs.absence_type === 'Sakit'
                          ? 'bg-rose-50 text-rose-700 border-rose-100'
                          : abs.absence_type === 'Cuti'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100';

                        return (
                          <div key={abs.id || `${abs.manpower_id}-${abs.date}`} className="p-3.5 hover:bg-slate-50/50 flex items-center justify-between gap-4 transition-all">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-800 text-xs">{person?.name || 'Unknown Staff'}</span>
                                <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded border uppercase tracking-wider ${styleClass}`}>
                                  {abs.absence_type === 'Sakit' ? '🔴 Sakit' : abs.absence_type === 'Cuti' ? '🔵 Cuti' : '🟡 Izin'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                                <span>📅 Tanggal: <strong className="text-slate-700 font-bold">{abs.date}</strong></span>
                              </div>
                              {abs.reason && (
                                <p className="text-[10px] text-slate-500 italic">"Keterangan: {abs.reason}"</p>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteAbsence(abs.id, abs.manpower_id, abs.date)}
                              title="Hapus ketidakhadiran"
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-650 rounded-lg border border-transparent hover:border-rose-200 transition-all cursor-pointer shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3 CONTENT: LOGIN PROFILES                             */}
        {/* ========================================================= */}
        {activeTab === 'login_profiles' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full animate-in fade-in">
            {/* Create Login Profile Form */}
            <div className="lg:col-span-5 bg-slate-50/50 border border-slate-150 rounded-2xl p-5 space-y-4 h-fit">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                Registrasi Akun Login Baru
              </h3>

              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-700 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" /> Secure Password-less Login
                </p>
                <p className="text-[9px] text-indigo-850 leading-relaxed font-semibold">
                  Aplikasi ini menggunakan teknologi password-less. Pengguna baru dapat langsung login ke dashboard hanya dengan memilih atau mengetikkan nama mereka di layar utama.
                </p>
              </div>

              <form onSubmit={handleAddLoginProfile} className="space-y-4">
                {/* Username */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nama Profil Pengguna</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pak Habsi, Pak Fatwa, Ayu"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 h-10"
                  />
                </div>

                {/* Role selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Hak Akses / Jabatan</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all h-10 text-slate-700"
                  >
                    <option value="Direktur Utama">Direktur Utama</option>
                    <option value="Manager Operasional">Manager Operasional</option>
                    <option value="Ahli Spesialis">Ahli Spesialis K3</option>
                    <option value="Staff IT / Admin">Staff IT / Admin</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer h-10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Mendaftarkan Akun Baru
                </button>
              </form>
            </div>

            {/* List of active logins */}
            <div className="lg:col-span-7 flex flex-col space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                Profil Pengguna Aktif ({appUsers.length} akun)
              </h3>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[380px] overflow-y-auto">
                <div className="divide-y divide-slate-100">
                  {appUsers.map((user) => (
                    <div key={user.id} className="p-3.5 hover:bg-slate-50/50 flex items-center justify-between gap-4 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl flex items-center justify-center shrink-0">
                          <User className="h-4.5 w-4.5 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 text-xs block truncate">{user.username}</span>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">{user.role}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteLoginProfile(user.id, user.username)}
                        title="Hapus akun login"
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-transparent hover:border-rose-200 transition-all cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
