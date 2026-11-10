/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText, Plus, Search, Filter, RefreshCw, ChevronRight, ArrowLeft,
  CheckCircle2, Ban, ShieldCheck, Download, AlertCircle, Copy, Check
} from 'lucide-react';
import {
  PnJenis, PnNomor, PnKelompok, PnJenisSummary, formatNomorUrut
} from '../types/penomoran';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import PenomoranFormModal from './PenomoranFormModal';
import PenomoranDetailModal from './PenomoranDetailModal';

const KELOMPOK_TITLES: Record<PnKelompok, { title: string; color: string; badge: string }> = {
  tagihan: { title: '1. Dokumen Tagihan & Komersial', color: 'emerald', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  pemeriksaan: { title: '2. Dokumen Pemeriksaan & Riksa Uji', color: 'indigo', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  umum: { title: '3. Dokumen Umum & Pengajuan', color: 'amber', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  tugas: { title: '4. Surat Tugas Lapangan', color: 'sky', badge: 'bg-sky-50 text-sky-800 border-sky-200' }
};

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function PenomoranModule() {
  const { activeUser, currentUser } = useUser();

  // Role detection
  const isAdmin = useMemo(() => {
    const username = (currentUser?.username || activeUser || '').toLowerCase();
    const division = (currentUser?.division || '').toLowerCase();
    return username === 'zulfan' || username === 'marsya' || division === 'it' || currentUser?.role?.toLowerCase().includes('leader');
  }, [activeUser, currentUser]);

  // Master & Transactional states
  const [allJenis, setAllJenis] = useState<PnJenis[]>([]);
  const [allNomor, setAllNomor] = useState<PnNomor[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active view: null = Beranda, string = jenis_kode
  const [activeJenisKode, setActiveJenisKode] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or '01'..'12'
  const [selectedPembuat, setSelectedPembuat] = useState<string>('all');

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [formJenisTarget, setFormJenisTarget] = useState<PnJenis | null>(null);
  const [formRevisiTarget, setFormRevisiTarget] = useState<PnNomor | null>(null);
  const [detailNomorTarget, setDetailNomorTarget] = useState<PnNomor | null>(null);

  // Google Sheets sync state
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [copiedNoId, setCopiedNoId] = useState<string | null>(null);

  // ─── 1. FETCH DATA DARI SUPABASE ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Koneksi database Supabase belum terkonfigurasi.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Ambil Jenis Dokumen
      const { data: jenisData, error: jenisErr } = await supabase
        .from('pn_jenis')
        .select('*')
        .order('urutan', { ascending: true });

      if (jenisErr) throw jenisErr;
      setAllJenis((jenisData || []) as PnJenis[]);

      // 2. Ambil Nomor Surat yang Diterbitkan Tahun Ini
      const currentYear = new Date().getFullYear();
      const { data: nomorData, error: nomorErr } = await supabase
        .from('pn_nomor')
        .select('*')
        .eq('tahun', currentYear)
        .order('no_urut', { ascending: false });

      if (nomorErr) throw nomorErr;

      // 3. Ambil Nama Pembuat dari app_users / pn_profil
      const { data: usersData } = await supabase
        .from('app_users')
        .select('auth_id, username, full_name');

      const userMap = new Map<string, string>();
      (usersData || []).forEach((u: any) => {
        if (u.auth_id) userMap.set(u.auth_id, u.full_name || u.username);
      });

      // Petakan nama pembuat dan rujukan nomor revisi
      const nomorList = (nomorData || []) as PnNomor[];
      const noUrutMap = new Map(nomorList.map(n => [n.id, n.no_urut]));
      const revisiTargetMap = new Map<string, number>();

      nomorList.forEach(n => {
        if (n.revisi_dari) {
          revisiTargetMap.set(n.revisi_dari, n.no_urut);
        }
      });

      const enrichedNomor = nomorList.map(n => ({
        ...n,
        dibuat_oleh_nama: userMap.get(n.dibuat_oleh) || 'Karyawan',
        revisi_dari_no: n.revisi_dari ? noUrutMap.get(n.revisi_dari) || null : null,
        direvisi_di_no: revisiTargetMap.get(n.id) || null
      }));

      setAllNomor(enrichedNomor);

    } catch (err: any) {
      console.error('[Penomoran Load Error]:', err);
      setErrorMsg(err.message || 'Gagal memuat data penomoran.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── 2. REKAPITULASI BERANDA PER JENIS ────────────────────────────────────────
  const currentMonthStr = useMemo(() => {
    const m = new Date().getMonth() + 1;
    return m < 10 ? `0${m}` : String(m);
  }, []);

  const summaryData = useMemo((): PnJenisSummary[] => {
    return allJenis.map(j => {
      const records = allNomor.filter(n => n.jenis_id === j.id);
      const countTotal = records.length;
      const countBulanIni = records.filter(n => n.tanggal && n.tanggal.split('-')[1] === currentMonthStr).length;

      // Ambil nomor tertinggi yang tercatat
      let maxNo = 0;
      let lastDate: string | null = null;

      if (records.length > 0) {
        maxNo = Math.max(...records.map(n => n.no_urut));
        lastDate = records[0].tanggal; // records sudah terurut no_urut desc
      }

      return {
        jenis: j,
        nomorTerakhir: maxNo,
        nomorBerikutnya: maxNo + 1,
        jumlahTerpakai: countTotal,
        bulanIni: countBulanIni,
        tanggalTerakhir: lastDate
      };
    });
  }, [allJenis, allNomor, currentMonthStr]);

  // Jenis aktif yang sedang dibuka (jika dalam mode detail)
  const activeJenis = useMemo(() => {
    if (!activeJenisKode) return null;
    return allJenis.find(j => j.kode === activeJenisKode) || null;
  }, [activeJenisKode, allJenis]);

  // ─── 3. FILTER NOMOR PADA HALAMAN PER JENIS ───────────────────────────────────
  const filteredNomorList = useMemo(() => {
    if (!activeJenis) return [];

    let list = allNomor.filter(n => n.jenis_id === activeJenis.id);

    // Filter Pencarian
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(n => {
        const noFormatted = formatNomorUrut(n.no_urut, activeJenis.pad_digit).toLowerCase();
        const klien = (n.klien || '').toLowerCase();
        const perihal = (n.perihal || '').toLowerCase();
        const ref = (n.ref || '').toLowerCase();
        const pembuat = (n.dibuat_oleh_nama || '').toLowerCase();
        return noFormatted.includes(q) || klien.includes(q) || perihal.includes(q) || ref.includes(q) || pembuat.includes(q);
      });
    }

    // Filter Bulan
    if (selectedMonth !== 'all') {
      list = list.filter(n => n.tanggal && n.tanggal.split('-')[1] === selectedMonth);
    }

    // Filter Pembuat
    if (selectedPembuat !== 'all') {
      list = list.filter(n => (n.dibuat_oleh_nama || '').toLowerCase() === selectedPembuat.toLowerCase());
    }

    return list;
  }, [activeJenis, allNomor, searchQuery, selectedMonth, selectedPembuat]);

  // Daftar nama pembuat unik untuk dropdown filter
  const uniquePembuatList = useMemo(() => {
    const set = new Set<string>();
    allNomor.forEach(n => {
      if (n.dibuat_oleh_nama) set.add(n.dibuat_oleh_nama);
    });
    return Array.from(set).sort();
  }, [allNomor]);

  // ─── 4. HANDLERS ─────────────────────────────────────────────────────────────
  const handleOpenAmbilNomor = (jenisToUse?: PnJenis) => {
    const target = jenisToUse || activeJenis || allJenis[0];
    setFormJenisTarget(target);
    setFormRevisiTarget(null);
    setShowFormModal(true);
  };

  const handleOpenRevisi = (nomorToRevise: PnNomor) => {
    const targetJenis = allJenis.find(j => j.id === nomorToRevise.jenis_id) || activeJenis;
    if (!targetJenis) return;
    setFormJenisTarget(targetJenis);
    setFormRevisiTarget(nomorToRevise);
    setShowFormModal(true);
  };

  const handleCopyNo = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNoId(id);
    setTimeout(() => setCopiedNoId(null), 2000);
  };

  // Sinkronisasi ulang manual ke Google Sheets (Rebuild All)
  const handleSyncAllSheets = async () => {
    let gasUrl = localStorage.getItem('gas_penomoran_url') || (import.meta.env.VITE_GAS_PENOMORAN_URL as string) || '';
    if (!gasUrl) {
      const inputUrl = window.prompt('Masukkan Web App URL Google Apps Script Anda:\n(Contoh: https://script.google.com/macros/s/.../exec)');
      if (!inputUrl || !inputUrl.trim()) {
        return;
      }
      gasUrl = inputUrl.trim();
      localStorage.setItem('gas_penomoran_url', gasUrl);
    }

    if (!window.confirm('Sinkron ulang semua tab di Google Sheets dari database Supabase sekarang?')) {
      return;
    }

    setSyncingSheets(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/penomoran/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rebuild_all', gas_url: gasUrl })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Gagal menyinkronkan spreadsheet.');
      }

      const result = await res.json();
      setSyncResult(`✅ Berhasil menyinkronkan ${result.count || ''} nomor ke Google Sheets!`);
      setTimeout(() => setSyncResult(null), 5000);
    } catch (e: any) {
      console.error('[Sync Error]:', e);
      setSyncResult(`⚠️ Info: Sinkronisasi Google Sheets: ${e.message}`);
    } finally {
      setSyncingSheets(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">

      {/* HEADER UTAMA MODUL */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xs shrink-0">
              <FileText className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Penomoran Surat & Dokumen Resmi
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isAdmin ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {isAdmin ? '🛡️ Otoritas Admin' : '👤 Staf'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Penerbitan nomor surat otomatis & atomik via database Supabase. Nol nomor duplikat, audit trail lengkap, dan live mirror ke Google Sheets.
              </p>
            </div>
          </div>

          {/* Action Header: Tombol Ambil Nomor & Sinkron Sheets */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => handleOpenAmbilNomor()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Ambil Nomor Baru</span>
            </button>

            {isAdmin && (
              <button
                onClick={handleSyncAllSheets}
                disabled={syncingSheets}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                title="Sinkronkan seluruh data ke Google Sheets"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingSheets ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{syncingSheets ? 'Menyinkronkan...' : 'Sinkron Sheets'}</span>
              </button>
            )}

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-all cursor-pointer"
              title="Muat ulang data dari server"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feedback Sync Notif */}
        {syncResult && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
            {syncResult}
          </div>
        )}
      </div>

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <div>
            <span className="font-bold">Kendala Sistem: </span>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAMPILAN 1: BERANDA PENOMORAN (TABEL RINGKASAN PER KELOMPOK)
          ══════════════════════════════════════════════════════════════════════════ */}
      {!activeJenis ? (
        <div className="space-y-6">

          {(['tagihan', 'pemeriksaan', 'umum', 'tugas'] as PnKelompok[]).map(kelompokKey => {
            const groupConfig = KELOMPOK_TITLES[kelompokKey];
            const groupItems = summaryData.filter(s => s.jenis.kelompok === kelompokKey);

            if (groupItems.length === 0) return null;

            return (
              <div key={kelompokKey} className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                {/* Header Kelompok */}
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800">
                    {groupConfig.title}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {groupItems.length} Jenis Dokumen
                  </span>
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/30">
                        <th className="py-3 px-5">Jenis Dokumen</th>
                        <th className="py-3 px-4 text-center">Nomor Terakhir</th>
                        <th className="py-3 px-4 text-center font-bold text-emerald-700">Nomor Berikutnya</th>
                        <th className="py-3 px-4 text-center">Terpakai</th>
                        <th className="py-3 px-4 text-center">Bulan Ini</th>
                        <th className="py-3 px-5 text-right">Tanggal Terakhir</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {groupItems.map(item => {
                        const formattedLast = item.nomorTerakhir > 0
                          ? formatNomorUrut(item.nomorTerakhir, item.jenis.pad_digit)
                          : '-';
                        const formattedNext = formatNomorUrut(item.nomorBerikutnya, item.jenis.pad_digit);

                        return (
                          <tr
                            key={item.jenis.id}
                            onClick={() => setActiveJenisKode(item.jenis.kode)}
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                          >
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                                  {item.jenis.nama}
                                </span>
                                {item.jenis.pad_digit && (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 font-mono px-1.5 py-0.2 rounded-sm">
                                    {item.jenis.pad_digit} digit
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600">
                              {formattedLast}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-block font-mono font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                {formattedNext}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center text-slate-600 font-semibold">
                              {item.jumlahTerpakai}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {item.bulanIni > 0 ? (
                                <span className="font-bold text-emerald-600">+{item.bulanIni}</span>
                              ) : (
                                <span className="text-slate-300">0</span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-right text-slate-500 font-mono text-[11px]">
                              {item.tanggalTerakhir || '-'}
                            </td>
                            <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleOpenAmbilNomor(item.jenis)}
                                className="px-2.5 py-1 text-[11px] font-bold bg-slate-900 hover:bg-emerald-600 text-white rounded-lg transition-colors cursor-pointer active:scale-95"
                              >
                                Ambil
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List View */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {groupItems.map(item => {
                    const formattedLast = item.nomorTerakhir > 0
                      ? formatNomorUrut(item.nomorTerakhir, item.jenis.pad_digit)
                      : '-';
                    const formattedNext = formatNomorUrut(item.nomorBerikutnya, item.jenis.pad_digit);

                    return (
                      <div
                        key={item.jenis.id}
                        onClick={() => setActiveJenisKode(item.jenis.kode)}
                        className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-extrabold text-slate-900 text-xs">
                            {item.jenis.nama}
                          </h4>
                          <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Berikutnya: {formattedNext}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Terakhir: <strong className="text-slate-700 font-mono">{formattedLast}</strong></span>
                          <span>Bulan ini: <strong className="text-slate-700">{item.bulanIni}</strong></span>
                          <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                            Buka <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        </div>
      ) : (

        /* ══════════════════════════════════════════════════════════════════════════
            TAMPILAN 2: HALAMAN DETAIL PER JENIS DOKUMEN (TAB DEDIKASI)
            ══════════════════════════════════════════════════════════════════════════ */
        <div className="space-y-4 animate-in fade-in">

          {/* Subheader: Tombol Kembali & Info Jenis */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveJenisKode(null);
                    setSearchQuery('');
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
                  title="Kembali ke Beranda Semua Jenis"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      {activeJenis.nama}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                      {activeJenis.kode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Daftar seluruh nomor resmi yang telah diterbitkan untuk {activeJenis.nama}.
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleOpenAmbilNomor(activeJenis)}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>Ambil Nomor {activeJenis.nama}</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center gap-2.5 text-xs">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari berdasarkan No, Klien, Perihal, atau Ref..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Filter Bulan */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 cursor-pointer"
              >
                <option value="all">Semua Bulan</option>
                {BULAN_NAMES.map((name, idx) => {
                  const mStr = idx + 1 < 10 ? `0${idx + 1}` : String(idx + 1);
                  return <option key={mStr} value={mStr}>{name}</option>;
                })}
              </select>

              {/* Filter Pembuat */}
              <select
                value={selectedPembuat}
                onChange={(e) => setSelectedPembuat(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 cursor-pointer"
              >
                <option value="all">Semua Pembuat</option>
                {uniquePembuatList.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TABEL DATA NOMOR PER JENIS */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
            {filteredNomorList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <p className="text-sm font-bold text-slate-600">Tidak ada nomor dokumen ditemukan</p>
                <p className="text-xs">
                  {searchQuery || selectedMonth !== 'all' || selectedPembuat !== 'all'
                    ? 'Coba sesuaikan kata kunci pencarian atau filter Anda.'
                    : `Belum ada nomor yang diterbitkan untuk ${activeJenis.nama} tahun ini.`}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/50">
                        <th className="py-3 px-4 text-center">No</th>
                        <th className="py-3 px-3">Tanggal</th>
                        <th className="py-3 px-3">Dibuat Oleh</th>
                        <th className="py-3 px-3">{activeJenis.label_klien}</th>
                        <th className="py-3 px-4">{activeJenis.label_perihal}</th>
                        <th className="py-3 px-3">{activeJenis.label_ref}</th>
                        <th className="py-3 px-3 text-center">Status / Revisi</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredNomorList.map(n => {
                        const isBatal = n.status === 'batal';
                        const formattedNo = formatNomorUrut(n.no_urut, activeJenis.pad_digit);
                        const isCopied = copiedNoId === n.id;

                        return (
                          <tr
                            key={n.id}
                            className={`hover:bg-slate-50 transition-colors ${
                              isBatal ? 'bg-slate-50/60 text-slate-400' : ''
                            }`}
                          >
                            {/* No */}
                            <td className="py-3 px-4 text-center font-mono font-black text-sm">
                              <span className={isBatal ? 'line-through text-slate-400' : 'text-slate-900'}>
                                {formattedNo}
                              </span>
                            </td>

                            {/* Tanggal */}
                            <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap">
                              {n.tanggal}
                            </td>

                            {/* Dibuat Oleh */}
                            <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                              👤 {n.dibuat_oleh_nama || 'Karyawan'}
                            </td>

                            {/* Klien */}
                            <td className="py-3 px-3 font-medium max-w-[140px] truncate" title={n.klien || ''}>
                              {n.klien || '-'}
                            </td>

                            {/* Perihal */}
                            <td className="py-3 px-4 font-medium max-w-[220px]" title={n.perihal}>
                              <div className={`line-clamp-2 leading-relaxed ${isBatal ? 'line-through' : ''}`}>
                                {n.perihal}
                              </div>
                            </td>

                            {/* Ref */}
                            <td className="py-3 px-3 text-[11px] max-w-[120px] truncate" title={n.ref || ''}>
                              {n.ref || '-'}
                            </td>

                            {/* Status & Revisi Indicator */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {isBatal ? (
                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                  Batal
                                </span>
                              ) : n.direvisi_di_no ? (
                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                  Direvisi di No. {formatNomorUrut(n.direvisi_di_no, activeJenis.pad_digit)}
                                </span>
                              ) : n.revisi_dari_no ? (
                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                                  Rev dari No. {formatNomorUrut(n.revisi_dari_no, activeJenis.pad_digit)}
                                </span>
                              ) : (
                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Aktif
                                </span>
                              )}
                            </td>

                            {/* Aksi */}
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleCopyNo(n.id, formattedNo)}
                                  className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                                  title="Salin Nomor"
                                >
                                  {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>

                                <button
                                  onClick={() => setDetailNomorTarget(n)}
                                  className="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                                >
                                  Detail
                                </button>

                                {!isBatal && (
                                  <button
                                    onClick={() => handleOpenRevisi(n)}
                                    className="px-2 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                                  >
                                    Revisi
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {filteredNomorList.map(n => {
                    const isBatal = n.status === 'batal';
                    const formattedNo = formatNomorUrut(n.no_urut, activeJenis.pad_digit);

                    return (
                      <div
                        key={n.id}
                        onClick={() => setDetailNomorTarget(n)}
                        className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                          isBatal ? 'bg-slate-50/70 text-slate-400' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`font-mono text-base font-black ${isBatal ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            #{formattedNo}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {n.tanggal}
                          </span>
                        </div>

                        <p className={`text-xs font-semibold text-slate-800 leading-snug line-clamp-2 ${isBatal ? 'line-through text-slate-400' : ''}`}>
                          {n.perihal}
                        </p>

                        <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-500">
                          <span>{n.klien || 'Tanpa Klien'}</span>
                          <span>👤 {n.dibuat_oleh_nama}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL-MODAL AKSI
          ══════════════════════════════════════════════════════════════════════════ */}
      {showFormModal && formJenisTarget && (
        <PenomoranFormModal
          jenis={formJenisTarget}
          revisiDariNomor={formRevisiTarget}
          onClose={() => {
            setShowFormModal(false);
            setFormJenisTarget(null);
            setFormRevisiTarget(null);
          }}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {detailNomorTarget && activeJenis && (
        <PenomoranDetailModal
          nomor={detailNomorTarget}
          jenis={activeJenis}
          isAdmin={isAdmin}
          onClose={() => setDetailNomorTarget(null)}
          onCancelSuccess={() => {
            loadData();
          }}
          onRevisiClick={(n) => handleOpenRevisi(n)}
        />
      )}

    </div>
  );
}

