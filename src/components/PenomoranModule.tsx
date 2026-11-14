/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText, Plus, Search, Filter, RefreshCw, ChevronRight, ArrowLeft,
  CheckCircle2, Ban, ShieldCheck, Download, AlertCircle, Copy, Check,
  FileSpreadsheet, Calendar, Table, Layers, ArrowUpDown, ChevronDown,
  RotateCcw, ExternalLink
} from 'lucide-react';
import {
  PnJenis, PnNomor, PnKelompok, PnJenisSummary, formatNomorUrut
} from '../types/penomoran';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import PenomoranFormModal from './PenomoranFormModal';
import PenomoranDetailModal from './PenomoranDetailModal';
import { syncAllNomorToSheets, getGasPenomoranUrl } from '../lib/penomoranSync';
import {
  exportPenomoranToExcel,
  exportPenomoranToCSV,
  copyPenomoranTableToClipboard
} from '../lib/penomoranExport';

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

  // Role detection: Seluruh akun karyawan internal PT Aksara Riksa Perdana memiliki akses penuh untuk penomoran
  const isAdmin = useMemo(() => {
    return Boolean(activeUser || currentUser);
  }, [activeUser, currentUser]);

  // Main Tab Navigation: 'catalog' = Katalog Jenis Dokumen, 'recap' = Rekapitulasi & Export
  const [mainTab, setMainTab] = useState<'catalog' | 'recap'>('catalog');

  // Master & Transactional states
  const [allJenis, setAllJenis] = useState<PnJenis[]>([]);
  const [allNomor, setAllNomor] = useState<PnNomor[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active view on catalog: null = Beranda, string = jenis_kode
  const [activeJenisKode, setActiveJenisKode] = useState<string | null>(null);

  // Filter states per jenis
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or '01'..'12'
  const [selectedPembuat, setSelectedPembuat] = useState<string>('all');
  const [singleStartDate, setSingleStartDate] = useState<string>('');
  const [singleEndDate, setSingleEndDate] = useState<string>('');

  // ── FILTER REKAPITULASI DENGAN RENTANG TANGGAL ──
  const [recapStartDate, setRecapStartDate] = useState<string>(() => {
    const y = new Date().getFullYear();
    return `${y}-01-01`;
  });
  const [recapEndDate, setRecapEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [recapJenisId, setRecapJenisId] = useState<string>('all');
  const [recapKelompok, setRecapKelompok] = useState<string>('all');
  const [recapStatus, setRecapStatus] = useState<string>('all'); // 'all' | 'aktif' | 'batal'
  const [recapPembuat, setRecapPembuat] = useState<string>('all');
  const [recapSearch, setRecapSearch] = useState<string>('');
  const [recapPage, setRecapPage] = useState<number>(1);
  const rowsPerPage = 50;

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [formJenisTarget, setFormJenisTarget] = useState<PnJenis | null>(null);
  const [formRevisiTarget, setFormRevisiTarget] = useState<PnNomor | null>(null);
  const [detailNomorTarget, setDetailNomorTarget] = useState<PnNomor | null>(null);

  // Google Sheets sync state
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; percent: number; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [copiedNoId, setCopiedNoId] = useState<string | null>(null);
  const [copyTableFeedback, setCopyTableFeedback] = useState(false);

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

    // Filter Rentang Tanggal jika diisi
    if (singleStartDate) {
      list = list.filter(n => !n.tanggal || n.tanggal >= singleStartDate);
    }
    if (singleEndDate) {
      list = list.filter(n => !n.tanggal || n.tanggal <= singleEndDate);
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
  }, [activeJenis, allNomor, searchQuery, singleStartDate, singleEndDate, selectedMonth, selectedPembuat]);

  // ─── 4. FILTER REKAPITULASI DENGAN RENTANG TANGGAL (RECAP TAB) ─────────────────
  const recapFilteredNomor = useMemo(() => {
    let list = [...allNomor];

    // Filter Rentang Tanggal (Start Date & End Date)
    if (recapStartDate) {
      list = list.filter(n => !n.tanggal || n.tanggal >= recapStartDate);
    }
    if (recapEndDate) {
      list = list.filter(n => !n.tanggal || n.tanggal <= recapEndDate);
    }

    // Filter Kelompok
    if (recapKelompok !== 'all') {
      const allowedJenisIds = new Set(allJenis.filter(j => j.kelompok === recapKelompok).map(j => j.id));
      list = list.filter(n => allowedJenisIds.has(n.jenis_id));
    }

    // Filter Jenis Dokumen Spesifik
    if (recapJenisId !== 'all') {
      list = list.filter(n => n.jenis_id === recapJenisId);
    }

    // Filter Status (Aktif / Batal)
    if (recapStatus === 'aktif') {
      list = list.filter(n => n.status !== 'batal');
    } else if (recapStatus === 'batal') {
      list = list.filter(n => n.status === 'batal');
    }

    // Filter Pembuat
    if (recapPembuat !== 'all') {
      list = list.filter(n => (n.dibuat_oleh_nama || '').toLowerCase() === recapPembuat.toLowerCase());
    }

    // Filter Pencarian Teks Bebas
    if (recapSearch.trim()) {
      const q = recapSearch.toLowerCase().trim();
      list = list.filter(n => {
        const j = allJenis.find(item => item.id === n.jenis_id);
        const noFormatted = formatNomorUrut(n.no_urut, j?.pad_digit).toLowerCase();
        const jenisNama = (j?.nama || '').toLowerCase();
        const klien = (n.klien || '').toLowerCase();
        const perihal = (n.perihal || '').toLowerCase();
        const ref = (n.ref || '').toLowerCase();
        const pembuat = (n.dibuat_oleh_nama || '').toLowerCase();
        return (
          noFormatted.includes(q) ||
          jenisNama.includes(q) ||
          klien.includes(q) ||
          perihal.includes(q) ||
          ref.includes(q) ||
          pembuat.includes(q)
        );
      });
    }

    return list;
  }, [allNomor, allJenis, recapStartDate, recapEndDate, recapKelompok, recapJenisId, recapStatus, recapPembuat, recapSearch]);

  // Statistik Cepat Rekapan
  const recapStats = useMemo(() => {
    const total = recapFilteredNomor.length;
    const aktif = recapFilteredNomor.filter(n => n.status !== 'batal').length;
    const batal = recapFilteredNomor.filter(n => n.status === 'batal').length;
    const klienSet = new Set(recapFilteredNomor.map(n => (n.klien || '').trim().toLowerCase()).filter(Boolean));
    return {
      total,
      aktif,
      batal,
      klienCount: klienSet.size
    };
  }, [recapFilteredNomor]);

  // Pagination for Recap
  const totalPages = Math.max(1, Math.ceil(recapFilteredNomor.length / rowsPerPage));
  const paginatedRecapList = useMemo(() => {
    const start = (recapPage - 1) * rowsPerPage;
    return recapFilteredNomor.slice(start, start + rowsPerPage);
  }, [recapFilteredNomor, recapPage, rowsPerPage]);

  // Daftar nama pembuat unik untuk dropdown filter
  const uniquePembuatList = useMemo(() => {
    const set = new Set<string>();
    allNomor.forEach(n => {
      if (n.dibuat_oleh_nama) set.add(n.dibuat_oleh_nama);
    });
    return Array.from(set).sort();
  }, [allNomor]);

  // ─── 5. DATE PRESET HANDLERS ─────────────────────────────────────────────────
  const handleDatePreset = (preset: 'today' | '7days' | 'month' | 'year' | 'all') => {
    const today = new Date().toISOString().split('T')[0];
    const curYear = new Date().getFullYear();
    const curMonth = String(new Date().getMonth() + 1).padStart(2, '0');

    if (preset === 'today') {
      setRecapStartDate(today);
      setRecapEndDate(today);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setRecapStartDate(d.toISOString().split('T')[0]);
      setRecapEndDate(today);
    } else if (preset === 'month') {
      setRecapStartDate(`${curYear}-${curMonth}-01`);
      setRecapEndDate(today);
    } else if (preset === 'year') {
      setRecapStartDate(`${curYear}-01-01`);
      setRecapEndDate(today);
    } else if (preset === 'all') {
      setRecapStartDate('');
      setRecapEndDate('');
    }
    setRecapPage(1);
  };

  const handleResetRecapFilter = () => {
    const curYear = new Date().getFullYear();
    setRecapStartDate(`${curYear}-01-01`);
    setRecapEndDate(new Date().toISOString().split('T')[0]);
    setRecapJenisId('all');
    setRecapKelompok('all');
    setRecapStatus('all');
    setRecapPembuat('all');
    setRecapSearch('');
    setRecapPage(1);
  };

  // ─── 6. EXPORT HANDLERS ──────────────────────────────────────────────────────
  const handleExportRecapExcel = () => {
    const selectedJenis = allJenis.find(j => j.id === recapJenisId);
    exportPenomoranToExcel(recapFilteredNomor, allJenis, {
      startDate: recapStartDate || 'Awal',
      endDate: recapEndDate || 'Akhir',
      jenisName: selectedJenis ? selectedJenis.nama : 'Semua Dokumen',
      status: recapStatus,
      totalData: recapFilteredNomor.length
    });
  };

  const handleExportRecapCSV = () => {
    const selectedJenis = allJenis.find(j => j.id === recapJenisId);
    exportPenomoranToCSV(recapFilteredNomor, allJenis, {
      startDate: recapStartDate || 'Awal',
      endDate: recapEndDate || 'Akhir',
      jenisName: selectedJenis ? selectedJenis.nama : 'Semua Dokumen'
    });
  };

  const handleCopyRecapTable = async () => {
    const success = await copyPenomoranTableToClipboard(recapFilteredNomor, allJenis);
    if (success) {
      setCopyTableFeedback(true);
      setTimeout(() => setCopyTableFeedback(false), 2500);
    }
  };

  const handleExportSingleJenisExcel = () => {
    if (!activeJenis) return;
    exportPenomoranToExcel(filteredNomorList, allJenis, {
      startDate: singleStartDate || (selectedMonth !== 'all' ? `Bulan ${selectedMonth}` : 'Tahun 2026'),
      endDate: singleEndDate || '',
      jenisName: activeJenis.nama,
      totalData: filteredNomorList.length
    });
  };

  // ─── 7. MODAL & SYNC HANDLERS ────────────────────────────────────────────────
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
    let gasUrl = getGasPenomoranUrl();
    if (!gasUrl) {
      const inputUrl = window.prompt('Masukkan Web App URL Google Apps Script Anda:\n(Contoh: https://script.google.com/macros/s/.../exec)');
      if (!inputUrl || !inputUrl.trim()) {
        return;
      }
      gasUrl = inputUrl.trim();
      localStorage.setItem('gas_penomoran_url', gasUrl);
    }

    if (!window.confirm(`Sinkronkan ulang seluruh ${allNomor.length} data nomor dokumen ke Google Sheets sekarang?`)) {
      return;
    }

    setSyncingSheets(true);
    setSyncResult(null);
    setSyncProgress(null);

    try {
      const res = await syncAllNomorToSheets(allNomor, allJenis, (info) => {
        setSyncProgress(info);
      });
      if (res.success) {
        setSyncResult(`✅ ${res.message}`);
      } else {
        setSyncResult(`⚠️ Info Sinkronisasi: ${res.message}`);
      }
      setTimeout(() => setSyncResult(null), 8000);
    } catch (e: any) {
      console.error('[Sync Error]:', e);
      setSyncResult(`⚠️ Info: Sinkronisasi Google Sheets: ${e.message}`);
    } finally {
      setSyncingSheets(false);
      setSyncProgress(null);
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
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {allNomor.length} Nomor Terbit
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Penerbitan nomor surat otomatis & atomik via database Supabase, rekapan data dengan filter rentang tanggal, dan sinkronisasi live mirror ke Google Sheets.
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
                disabled={syncingSheets || loading}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                title="Sinkronkan seluruh data ke Google Sheets"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingSheets ? 'animate-spin text-emerald-600' : ''}`} />
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

        {/* Progress Sinkronisasi Google Sheets */}
        {syncingSheets && syncProgress && (
          <div className="mt-3 p-3.5 bg-indigo-50/90 border border-indigo-200 rounded-2xl text-xs text-indigo-900 font-medium space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                {syncProgress.message}
              </span>
              <span className="font-mono text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md font-bold">{syncProgress.percent}%</span>
            </div>
            <div className="w-full bg-indigo-200/70 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${syncProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Feedback Sync Notif */}
        {syncResult && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between">
            <span>{syncResult}</span>
            <button onClick={() => setSyncResult(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold text-xs">✕</button>
          </div>
        )}

        {/* ── MODULE MAIN TABS: KATALOG DOKUMEN VS REKAP & EXPORT ── */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80">
            <button
              onClick={() => {
                setMainTab('catalog');
                setActiveJenisKode(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mainTab === 'catalog'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <FileText className="h-4 w-4 text-emerald-600" />
              <span>Katalog Jenis Dokumen</span>
            </button>

            <button
              onClick={() => {
                setMainTab('recap');
                setActiveJenisKode(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mainTab === 'recap'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Rekapitulasi & Export Data</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-mono font-black">
                {allNomor.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Mirror Google Sheets Terhubung</span>
          </div>
        </div>
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
          TAMPILAN REKAPITULASI & EXPORT (TAB: 'recap')
          ══════════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'recap' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* PANEL FILTER REKAPAN */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Filter className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Filter Data Rekapan</h3>
                  <p className="text-[11px] text-slate-500">Filter rentang tanggal, jenis dokumen, dan status untuk melihat & mengekspor rekapan.</p>
                </div>
              </div>

              {/* Action Buttons: Export Excel, CSV, Copy */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportRecapExcel}
                  disabled={recapFilteredNomor.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Unduh rekapan terfilter sebagai file Excel .xlsx"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Excel (.xlsx)</span>
                </button>

                <button
                  onClick={handleExportRecapCSV}
                  disabled={recapFilteredNomor.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  title="Unduh format CSV"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>CSV</span>
                </button>

                <button
                  onClick={handleCopyRecapTable}
                  disabled={recapFilteredNomor.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  title="Salin tabel terfilter ke clipboard (bisa langsung paste di Excel)"
                >
                  {copyTableFeedback ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copyTableFeedback ? 'Tersalin!' : 'Salin Tabel'}</span>
                </button>

                <button
                  onClick={handleResetRecapFilter}
                  className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all cursor-pointer"
                  title="Reset Filter ke Default"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Form Kontrol Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              
              {/* Tanggal Mulai */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  📅 Dari Tanggal (Mulai)
                </label>
                <input
                  type="date"
                  value={recapStartDate}
                  onChange={(e) => {
                    setRecapStartDate(e.target.value);
                    setRecapPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Tanggal Selesai */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  📅 Sampai Tanggal (Selesai)
                </label>
                <input
                  type="date"
                  value={recapEndDate}
                  onChange={(e) => {
                    setRecapEndDate(e.target.value);
                    setRecapPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Pilihan Kelompok Dokumen */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  📁 Kelompok Dokumen
                </label>
                <select
                  value={recapKelompok}
                  onChange={(e) => {
                    setRecapKelompok(e.target.value);
                    setRecapJenisId('all');
                    setRecapPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Semua Kelompok</option>
                  <option value="tagihan">1. Tagihan & Komersial</option>
                  <option value="pemeriksaan">2. Pemeriksaan & Riksa Uji</option>
                  <option value="umum">3. Dokumen Umum & Pengajuan</option>
                  <option value="tugas">4. Surat Tugas Lapangan</option>
                </select>
              </div>

              {/* Pilihan Jenis Dokumen Spesifik */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  📜 Jenis Dokumen
                </label>
                <select
                  value={recapJenisId}
                  onChange={(e) => {
                    setRecapJenisId(e.target.value);
                    setRecapPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Semua Jenis Dokumen ({allJenis.length})</option>
                  {allJenis
                    .filter(j => recapKelompok === 'all' || j.kelompok === recapKelompok)
                    .map(j => (
                      <option key={j.id} value={j.id}>
                        {j.nama}
                      </option>
                    ))}
                </select>
              </div>

              {/* Status Dokumen */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  🏷️ Status Dokumen
                </label>
                <select
                  value={recapStatus}
                  onChange={(e) => {
                    setRecapStatus(e.target.value);
                    setRecapPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Semua Status (Aktif & Batal)</option>
                  <option value="aktif">Hanya Dokumen Aktif</option>
                  <option value="batal">Hanya Dokumen Batal</option>
                </select>
              </div>

              {/* Pembuat Dokumen */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  👤 Dibuat Oleh
                </label>
                <select
                  value={recapPembuat}
                  onChange={(e) => {
                    setRecapPembuat(e.target.value);
                    setRecapPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Semua Pembuat</option>
                  {uniquePembuatList.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Pencarian Teks */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  🔍 Pencarian Kata Kunci
                </label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={recapSearch}
                    onChange={(e) => {
                      setRecapSearch(e.target.value);
                      setRecapPage(1);
                    }}
                    placeholder="Cari nomor, perihal pekerjaan, nama klien, atau ref..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

            </div>

            {/* Preset Tombol Cepat Rentang Tanggal */}
            <div className="flex items-center gap-1.5 pt-1 text-[11px] flex-wrap">
              <span className="font-bold text-slate-400 mr-1">Preset Rentang:</span>
              <button
                type="button"
                onClick={() => handleDatePreset('today')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('7days')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('month')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('year')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
              >
                Tahun 2026
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('all')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
              >
                Semua Waktu
              </button>
            </div>
          </div>

          {/* KARTU STATISTIK METRICS REKAPAN */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Dokumen</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-mono">{recapStats.total}</span>
                <span className="text-xs text-slate-400">nomor</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Dokumen Aktif</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-700 font-mono">{recapStats.aktif}</span>
                <span className="text-xs text-emerald-600/70 font-semibold">
                  {recapStats.total > 0 ? `${Math.round((recapStats.aktif / recapStats.total) * 100)}%` : '0%'}
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Dibatalkan</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-600 font-mono">{recapStats.batal}</span>
                <span className="text-xs text-rose-500/70 font-semibold">dokumen</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Klien Unik</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-700 font-mono">{recapStats.klienCount}</span>
                <span className="text-xs text-indigo-500/70">perusahaan</span>
              </div>
            </div>
          </div>

          {/* TABEL DATA REKAPITULASI */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Table className="h-4 w-4 text-emerald-600" />
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-800">
                  Daftar Nomor Dokumen Terfilter ({recapFilteredNomor.length})
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Halaman {recapPage} dari {totalPages}
              </span>
            </div>

            {recapFilteredNomor.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-sm font-bold text-slate-700">Tidak ada nomor dokumen yang cocok</p>
                <p className="text-xs max-w-sm mx-auto">
                  Cobalah melonggarkan filter rentang tanggal, jenis dokumen, atau menghapus kata kunci pencarian.
                </p>
                <button
                  onClick={handleResetRecapFilter}
                  className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  Reset Semua Filter
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/50">
                        <th className="py-3 px-4 text-center">No</th>
                        <th className="py-3 px-3">Jenis Dokumen</th>
                        <th className="py-3 px-3">Tanggal</th>
                        <th className="py-3 px-3">Dibuat Oleh</th>
                        <th className="py-3 px-3">Klien / Lokasi</th>
                        <th className="py-3 px-4">Perihal / Pekerjaan</th>
                        <th className="py-3 px-3">Ref</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {paginatedRecapList.map((n) => {
                        const j = allJenis.find(item => item.id === n.jenis_id);
                        const isBatal = n.status === 'batal';
                        const formattedNo = formatNomorUrut(n.no_urut, j?.pad_digit);
                        const isCopied = copiedNoId === n.id;

                        return (
                          <tr
                            key={n.id}
                            className={`hover:bg-slate-50 transition-colors ${
                              isBatal ? 'bg-slate-50/70 text-slate-400' : ''
                            }`}
                          >
                            {/* No Urut */}
                            <td className="py-3 px-4 text-center font-mono font-black text-sm">
                              <span className={isBatal ? 'line-through text-slate-400' : 'text-slate-900'}>
                                {formattedNo}
                              </span>
                            </td>

                            {/* Jenis Dokumen */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-extrabold text-slate-900 block">
                                {j?.nama || 'Dokumen'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {j?.kode}
                              </span>
                            </td>

                            {/* Tanggal */}
                            <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap text-slate-600">
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
                            <td className="py-3 px-3 text-[11px] max-w-[120px] truncate text-slate-500" title={n.ref || ''}>
                              {n.ref || '-'}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {isBatal ? (
                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                  Batal
                                </span>
                              ) : n.direvisi_di_no ? (
                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                  Direvisi #{formatNomorUrut(n.direvisi_di_no, j?.pad_digit)}
                                </span>
                              ) : n.revisi_dari_no ? (
                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                                  Rev #{formatNomorUrut(n.revisi_dari_no, j?.pad_digit)}
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
                                  onClick={() => {
                                    if (j) {
                                      setActiveJenisKode(j.kode);
                                      setDetailNomorTarget(n);
                                    }
                                  }}
                                  className="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                                >
                                  Detail
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Menampilkan {(recapPage - 1) * rowsPerPage + 1} - {Math.min(recapPage * rowsPerPage, recapFilteredNomor.length)} dari {recapFilteredNomor.length} data
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setRecapPage(p => Math.max(1, p - 1))}
                        disabled={recapPage === 1}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        Sebelumnya
                      </button>
                      <span className="font-mono px-2 font-bold text-slate-800">
                        {recapPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setRecapPage(p => Math.min(totalPages, p + 1))}
                        disabled={recapPage === totalPages}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        Berikutnya
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAMPILAN 1: BERANDA PENOMORAN (KATALOG PER KELOMPOK DOKUMEN)
          ══════════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'catalog' && !activeJenis && (
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
                        className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <h4 className="font-bold text-xs text-slate-800">
                            {item.jenis.nama}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                            <span>Terakhir: #{formattedLast}</span>
                            <span>•</span>
                            <span>Total: {item.jumlahTerpakai}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-mono">Berikutnya:</span>
                            <span className="font-mono font-black text-emerald-600 text-sm">#{formattedNext}</span>
                          </div>
                          <button
                            onClick={() => handleOpenAmbilNomor(item.jenis)}
                            className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Ambil
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAMPILAN 2: DAFTAR NOMOR SPESIFIK JENIS DOKUMEN (MODE DETAIL)
          ══════════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'catalog' && activeJenis && (
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

              {/* Action Buttons: Export Excel & Ambil Nomor */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  onClick={handleExportSingleJenisExcel}
                  disabled={filteredNomorList.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Export seluruh nomor jenis ini ke Excel"
                >
                  <Download className="h-4 w-4 text-emerald-700" />
                  <span>Export Excel ({filteredNomorList.length})</span>
                </button>

                <button
                  onClick={() => handleOpenAmbilNomor(activeJenis)}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span>Ambil Nomor {activeJenis.nama}</span>
                </button>
              </div>
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
