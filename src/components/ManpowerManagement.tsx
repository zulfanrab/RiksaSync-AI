/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Edit2, User, Check, Briefcase, Award, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { Manpower } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ManpowerManagementProps {
  manpowerList: Manpower[];
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

export default function ManpowerManagement({ manpowerList, onRefreshAll, onClose }: ManpowerManagementProps) {
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Ahli Spesialis');
  const [status, setStatus] = useState<'internal' | 'external'>('internal');
  const [selectedSkps, setSelectedSkps] = useState<string[]>([]);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'internal' | 'external'>('all');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter manpower based on search and status filter
  const filteredManpower = useMemo(() => {
    return manpowerList.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            m.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            m.skp.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = filterStatus === 'all' || m.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [manpowerList, searchTerm, filterStatus]);

  // Toggle an SKP license selection
  const handleSkpToggle = (skpVal: string) => {
    setSelectedSkps(prev => {
      if (prev.includes(skpVal)) {
        return prev.filter(s => s !== skpVal);
      } else {
        return [...prev, skpVal];
      }
    });
  };

  // Reset form to default
  const resetForm = () => {
    setEditingId(null);
    setName('');
    setRole('Ahli Spesialis');
    setStatus('internal');
    setSelectedSkps([]);
    setError(null);
  };

  // Set form to edit a specific person
  const handleStartEdit = (person: Manpower) => {
    setEditingId(person.id);
    setName(person.name);
    setRole(person.role);
    setStatus(person.status);
    setSelectedSkps(person.skp || []);
    setError(null);
    setSuccessMsg(null);
  };

  // Handle saving (insert or update)
  const handleSave = async (e: React.FormEvent) => {
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
        // Edit Mode
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
        // Add Mode
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

      // Refresh list in parent component
      await onRefreshAll();
      resetForm();
      
      // Auto clear success message after 3s
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('[Manpower Save Error]:', err);
      setError(err?.message || 'Gagal menyimpan data ke database.');
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting a person
  const handleDelete = async (person: Manpower) => {
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

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-w-5xl w-full flex flex-col max-h-[90vh]">
      {/* Modal Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <Briefcase className="h-4.5 w-4.5" />
            </div>
            <h2 className="text-base font-black text-slate-800 tracking-tight">Kelola Direktori Manpower</h2>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Kelola data personel ahli internal, pihak luar (eksternal), beserta lisensi SKP masing-masing.</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form Section */}
        <div className="lg:col-span-5 bg-slate-50/50 border border-slate-150 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            {editingId ? <Edit2 className="h-3.5 w-3.5 text-amber-500" /> : <Plus className="h-3.5 w-3.5 text-emerald-500" />}
            {editingId ? 'Edit Data Manpower' : 'Tambah Manpower Baru'}
          </h3>

          <form onSubmit={handleSave} className="space-y-4">
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
                  placeholder="Contoh: Zulfan, Fauzan, dll."
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
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 max-h-44 overflow-y-auto">
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
              <p className="text-[9px] text-slate-400 italic leading-snug">Note: Ahli Spesialis minimal memiliki satu lisensi SKP. Support staff dan Helper bisa dibiarkan kosong.</p>
            </div>

            {/* Error and Success Indicators */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-700 text-xs font-medium">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2 text-emerald-700 text-xs font-medium">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Form actions */}
            <div className="flex items-center gap-2 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-2 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
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

        {/* Right Column: Listing and Search Section */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
              Direktori Personel ({filteredManpower.length} orang)
            </h3>
            
            {/* Status Filter Toggle */}
            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[10px] font-bold">
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
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          {/* List of members */}
          <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[420px] overflow-y-auto">
            {filteredManpower.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <User className="h-8 w-8 mx-auto stroke-1 mb-2 text-slate-300" />
                <p className="text-xs font-medium">Tidak ada personel yang cocok dengan pencarian.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredManpower.map((person) => (
                  <div key={person.id} className="p-3.5 hover:bg-slate-50/50 flex items-center justify-between gap-4 transition-all">
                    <div className="space-y-1.5 min-w-0">
                      {/* Name and Tag */}
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

                      {/* Role */}
                      <span className="text-[10px] text-slate-500 block font-medium leading-none">{person.role}</span>

                      {/* SKP list */}
                      <div className="flex flex-wrap gap-1 items-center pt-0.5">
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

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleStartEdit(person)}
                        title="Edit data personel"
                        className="p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg border border-transparent hover:border-amber-200 transition-all cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(person)}
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
    </div>
  );
}
