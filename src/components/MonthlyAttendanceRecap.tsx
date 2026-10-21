import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Manpower, ManpowerAbsence, AttendanceRecord, AttendanceType, AppUser } from '../types';
import { INITIAL_APP_USERS } from '../context/UserContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  safeParseDate,
  safeIsoDate,
  safeIsoString,
  safeFormatTime,
  safeFormatDate,
  safeMinutesOfDay,
  safeToFixed
} from '../lib/dateUtils';
import {
  Printer,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  ShieldCheck,
  Edit2,
  Building2,
  X,
  Search,
  Check,
  Briefcase
} from 'lucide-react';

interface MonthlyAttendanceRecapProps {
  manpowerList?: Manpower[];
  absences?: ManpowerAbsence[];
  appUsers?: AppUser[];
  onRefreshAll: () => Promise<void> | void;
  canEditTimestamp: boolean; // Khusus akun Zulfan
  currentUserLabel: string;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function MonthlyAttendanceRecap({
  manpowerList = [],
  absences = [],
  appUsers = [],
  onRefreshAll,
  canEditTimestamp,
  currentUserLabel
}: MonthlyAttendanceRecapProps) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-indexed

  // Attendance logs for the selected month
  const [monthlyLogs, setMonthlyLogs] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal: Tambah Izin/Cuti Cepat (Backlog awal 2026 & masa depan)
  const [showAddAbsenceModal, setShowAddAbsenceModal] = useState(false);
  const [targetManpowerId, setTargetManpowerId] = useState<string>('');
  const [absenceDate, setAbsenceDate] = useState<string>('');
  const [absenceType, setAbsenceType] = useState<'Sakit' | 'Cuti' | 'Izin'>('Sakit');
  const [absenceReason, setAbsenceReason] = useState<string>('');
  const [savingAbsence, setSavingAbsence] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal: Koreksi Waktu Absen (Khusus Zulfan ONLY)
  const [selectedPersonLogs, setSelectedPersonLogs] = useState<{
    personName: string;
    logs: AttendanceRecord[];
  } | null>(null);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Helper: Format YYYY-MM
  const monthCode = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

  // 11 Karyawan Resmi Terdaftar yang Memiliki Akun Login Aplikasi (app_users)
  // Menghilangkan manpower eksternal (seperti Katez / Riyan) agar rekap presensi hanya untuk staf yang wajib absen
  const attendanceEmployees = useMemo(() => {
    const users = appUsers && appUsers.length > 0 ? appUsers : INITIAL_APP_USERS;
    return users.map((u) => {
      const matchMp = (manpowerList || []).find((m) => {
        const mName = (m.name || '').toLowerCase();
        const uName = (u.username || '').toLowerCase();
        const uFullName = (u.full_name || '').toLowerCase();
        return mName === uName || uFullName.includes(mName) || mName.includes(uName);
      });

      return {
        id: matchMp?.id || u.id,
        manpower_id: matchMp?.id || u.id,
        name: u.username,
        full_name: u.full_name || u.username,
        role: u.role || matchMp?.role || 'Staff',
        email: u.email || `${u.username.toLowerCase()}@aksarariksapjk3.com`,
        division: u.division || 'Umum',
        status: 'internal' as const,
        skp: matchMp?.skp || []
      };
    });
  }, [appUsers, manpowerList]);

  // Hitung jumlah hari kerja (Senin - Sabtu) pada bulan yang dipilih
  const workingDaysCount = useMemo(() => {
    let count = 0;
    const d = new Date(selectedYear, selectedMonth, 1);
    while (d.getMonth() === selectedMonth) {
      const day = d.getDay();
      if (day !== 0) count++; // 0 adalah Minggu
      d.setDate(d.getDate() + 1);
    }
    return count || 25;
  }, [selectedYear, selectedMonth]);

  // Load all attendance logs for the target month
  const fetchMonthlyLogs = useCallback(async () => {
    setLoading(true);
    const startD = new Date(selectedYear, selectedMonth, 1);
    const endD = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    const startIso = safeIsoString(startD);
    const endIso = safeIsoString(endD);

    let fetched: AttendanceRecord[] = [];

    try {
      if (isSupabaseConfigured && supabase && startIso && endIso) {
        const { data, error } = await supabase
          .from('attendance_logs')
          .select('*')
          .gte('timestamp', startIso)
          .lte('timestamp', endIso)
          .order('timestamp', { ascending: false });

        if (!error && data) {
          fetched = data as AttendanceRecord[];
        }
      }
    } catch (e) {
      console.warn('[Fetch Monthly Logs Error]', e);
    }

    // Terapkan koreksi waktu Zulfan agar tidak tertimpa data lama Supabase
    try {
      const correctionsRaw = localStorage.getItem('attendance_corrections_map');
      if (correctionsRaw) {
        const corrections: Record<string, { timestamp: string; created_at: string }> = JSON.parse(correctionsRaw);
        fetched = fetched.map((rec) => {
          const key1 = rec.id || '';
          const recDate = safeIsoDate(rec.timestamp);
          const key2 = `${rec.employee_name}_${rec.type}_${recDate}`;
          const match = (key1 && corrections[key1]) || corrections[key2];
          if (match) {
            return { ...rec, timestamp: match.timestamp, created_at: match.created_at || match.timestamp };
          }
          return rec;
        });
      }
    } catch (e) {}

    // Merge with localStorage
    try {
      const local = localStorage.getItem('local_attendance_logs');
      if (local) {
        const parsed: AttendanceRecord[] = JSON.parse(local);
        const filteredLocal = parsed.filter((r) => {
          if (!r || !r.timestamp) return false;
          const rDate = safeParseDate(r.timestamp);
          if (!rDate) return false;
          return rDate.getFullYear() === selectedYear && rDate.getMonth() === selectedMonth;
        });

        // Dedup & update with local copy if edited
        filteredLocal.forEach((loc) => {
          const existsIdx = fetched.findIndex(
            (f) =>
              (loc.id && f.id === loc.id) ||
              (f.employee_name === loc.employee_name && f.type === loc.type && f.timestamp === loc.timestamp)
          );
          if (existsIdx === -1) {
            fetched.push(loc);
          } else {
            fetched[existsIdx] = loc;
          }
        });
      }
    } catch (e) {}

    setMonthlyLogs(fetched);
    setLoading(false);
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchMonthlyLogs();
  }, [fetchMonthlyLogs]);

  // Handle Bulan Sebelumnya / Berikutnya
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  // Kalkulasi agregasi kehadiran per 11 karyawan terdaftar (akun internal)
  const aggregatedData = useMemo(() => {
    return attendanceEmployees.map((emp, index) => {
      const empNameLower = (emp.name || '').toLowerCase();
      const empFullNameLower = (emp.full_name || '').toLowerCase();
      const empEmailLower = (emp.email || '').toLowerCase();

      // Filter presensi bulan ini untuk karyawan ini
      const personLogs = (monthlyLogs || []).filter((l) => {
        if (!l) return false;
        const lName = (l.employee_name || '').toLowerCase();
        const lEmail = (l.employee_email || '').toLowerCase();
        return (
          (empEmailLower && lEmail && lEmail === empEmailLower) ||
          (empNameLower && lName === empNameLower) ||
          (empFullNameLower && lName === empFullNameLower) ||
          (empNameLower && lName.includes(empNameLower)) ||
          (empNameLower && lEmail.includes(empNameLower))
        );
      });

      // Filter absensi (Sakit, Cuti, Izin) dari tabel manpower_absences
      const personAbsences = (absences || []).filter((a) => {
        if (!a || !a.date || typeof a.date !== 'string') return false;
        const isMatchId = a.manpower_id === emp.id || a.manpower_id === emp.manpower_id;
        const isMatchName = a.manpower_name && a.manpower_name.toLowerCase() === empNameLower;
        return (isMatchId || isMatchName) && a.date.startsWith(monthCode);
      });

      // Hitung metrik
      let masukCount = 0;
      let pulangCount = 0;
      let onTimeCount = 0;
      let lateCount = 0;
      let kantorCount = 0;
      let onSiteCount = 0;
      let wfhCount = 0;

      const uniqueDaysMasuk = new Set<string>();

      personLogs.forEach((l) => {
        if (!l || !l.timestamp) return;
        const d = safeParseDate(l.timestamp);
        if (!d) return;
        const dayStr = safeIsoDate(d);
        if (!dayStr) return;

        if (l.type === 'Masuk') {
          masukCount++;
          uniqueDaysMasuk.add(dayStr);

          // Punctuality check (Senin-Jumat <= 09:00 WIB, Sabtu <= 09:00 WIB)
          const totalMin = d.getHours() * 60 + d.getMinutes();
          if (totalMin <= 9 * 60) {
            onTimeCount++;
          } else {
            lateCount++;
          }

          if (l.work_location_type === 'On Site') onSiteCount++;
          else if (l.work_location_type === 'WFH') wfhCount++;
          else kantorCount++;
        } else if (l.type === 'Pulang') {
          pulangCount++;
        }
      });

      const sakitCount = personAbsences.filter((a) => a.absence_type === 'Sakit').length;
      const cutiCount = personAbsences.filter((a) => a.absence_type === 'Cuti').length;
      const izinCount = personAbsences.filter((a) => a.absence_type === 'Izin').length;

      const effectiveHadirDays = uniqueDaysMasuk.size;
      const attendancePct = workingDaysCount > 0 ? (effectiveHadirDays / workingDaysCount) * 100 : 0;

      // Status evaluasi
      let evaluation = 'Hadir Tertib';
      if (sakitCount > 0) evaluation = `Sakit ${sakitCount} Hari`;
      else if (cutiCount > 0) evaluation = `Cuti ${cutiCount} Hari`;
      else if (izinCount > 0) evaluation = `Izin ${izinCount} Hari`;
      else if (lateCount > 2) evaluation = `Terlambat ${lateCount}x`;
      else if (effectiveHadirDays === 0) evaluation = 'Belum Ada Presensi';

      return {
        no: index + 1,
        manpower: emp,
        logs: personLogs,
        absences: personAbsences,
        masukCount,
        pulangCount,
        onTimeCount,
        lateCount,
        sakitCount,
        cutiCount,
        izinCount,
        kantorCount,
        onSiteCount,
        wfhCount,
        effectiveHadirDays,
        attendancePct: Math.min(100, attendancePct),
        evaluation
      };
    });
  }, [attendanceEmployees, monthlyLogs, absences, monthCode, workingDaysCount]);

  // Filter pencarian nama karyawan
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return aggregatedData;
    const term = searchTerm.toLowerCase();
    return aggregatedData.filter(
      (r) =>
        (r?.manpower?.name || '').toLowerCase().includes(term) ||
        (r?.manpower?.full_name || '').toLowerCase().includes(term) ||
        (r?.manpower?.role || '').toLowerCase().includes(term) ||
        (r?.manpower?.division || '').toLowerCase().includes(term)
    );
  }, [aggregatedData, searchTerm]);

  // Total summary ringkasan seluruh tim
  const summaryTotals = useMemo(() => {
    return aggregatedData.reduce(
      (acc, r) => {
        acc.totalMasuk += r.masukCount;
        acc.totalPulang += r.pulangCount;
        acc.totalOnTime += r.onTimeCount;
        acc.totalLate += r.lateCount;
        acc.totalSakit += r.sakitCount;
        acc.totalCuti += r.cutiCount;
        acc.totalIzin += r.izinCount;
        acc.totalHadirDays += r.effectiveHadirDays;
        acc.totalPctSum += r.attendancePct;
        return acc;
      },
      {
        totalMasuk: 0,
        totalPulang: 0,
        totalOnTime: 0,
        totalLate: 0,
        totalSakit: 0,
        totalCuti: 0,
        totalIzin: 0,
        totalHadirDays: 0,
        totalPctSum: 0
      }
    );
  }, [aggregatedData]);

  const avgAttendancePct =
    aggregatedData.length > 0 ? (summaryTotals.totalPctSum / aggregatedData.length).toFixed(1) : '0';

  // ── SAVE QUICK ABSENCE (SAKIT / CUTI / IZIN) ────────────────────────────────
  const handleSaveQuickAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetManpowerId) {
      alert('Pilih karyawan terlebih dahulu.');
      return;
    }
    if (!absenceDate) {
      alert('Pilih tanggal ketidakhadiran.');
      return;
    }

    setSavingAbsence(true);
    const newAbsenceObj = {
      manpower_id: targetManpowerId,
      date: absenceDate,
      absence_type: absenceType,
      reason: absenceReason.trim() || null
    };

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('manpower_absences').insert([newAbsenceObj]);
        if (error) throw error;
      } else {
        throw new Error('Supabase offline');
      }
    } catch (err) {
      // LocalStorage fallback
      const local = localStorage.getItem('local_manpower_absences');
      let list = local ? JSON.parse(local) : [];
      list = list.filter((a: any) => !(a.manpower_id === targetManpowerId && a.date === absenceDate));
      list.push({ id: 'abs_' + Math.random().toString(36).substring(2, 9), ...newAbsenceObj });
      localStorage.setItem('local_manpower_absences', JSON.stringify(list));
    } finally {
      await onRefreshAll();
      setSavingAbsence(false);
      setShowAddAbsenceModal(false);
      setAbsenceReason('');
      setActionSuccess(`Berhasil mencatat ${absenceType} untuk tanggal ${absenceDate}! ✅`);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // ── SAVE EDIT WAKTU PRESENSI (KHUSUS ZULFAN) ────────────────────────────────
  const handleOpenEditRecord = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    const d = safeParseDate(rec.timestamp) || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    setEditDate(`${year}-${month}-${day}`);
    setEditTime(`${hours}:${minutes}:${seconds}`);
  };

  const handleSaveEditTimestamp = async () => {
    if (!editingRecord || !editDate || !editTime) return;
    setSavingEdit(true);

    // Buat ISO string baru (WIB timezone GMT+7)
    const timeWithSec = editTime.includes(':') && editTime.split(':').length === 2 ? `${editTime}:00` : editTime;
    const newDateObj = safeParseDate(`${editDate}T${timeWithSec}+07:00`) || new Date(`${editDate}T${timeWithSec}`);
    const newIsoTimestamp = newDateObj && !isNaN(newDateObj.getTime()) ? newDateObj.toISOString() : new Date().toISOString();

    // 1. UPDATE STATE SECARA LANGSUNG & INSTAN DI LAYAR (0ms delay)
    setMonthlyLogs((prev) =>
      prev.map((r) => {
        const isMatch =
          (editingRecord.id && r.id === editingRecord.id) ||
          (r.employee_name === editingRecord.employee_name &&
            r.type === editingRecord.type &&
            r.timestamp === editingRecord.timestamp);
        return isMatch ? { ...r, timestamp: newIsoTimestamp, created_at: newIsoTimestamp } : r;
      })
    );

    // Update log list di modal detail jika sedang dibuka
    if (selectedPersonLogs) {
      setSelectedPersonLogs((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          logs: prev.logs.map((l) => {
            const isMatch =
              (editingRecord.id && l.id === editingRecord.id) ||
              (l.employee_name === editingRecord.employee_name &&
                l.type === editingRecord.type &&
                l.timestamp === editingRecord.timestamp);
            return isMatch ? { ...l, timestamp: newIsoTimestamp, created_at: newIsoTimestamp } : l;
          })
        };
      });
    }

    // 2. SIMPAN KE LOCALSTORAGE (Map koreksi permanen)
    try {
      const origDate = safeIsoDate(editingRecord.timestamp);
      const correctionsRaw = localStorage.getItem('attendance_corrections_map');
      const corrections = correctionsRaw ? JSON.parse(correctionsRaw) : {};
      if (editingRecord.id) {
        corrections[editingRecord.id] = { timestamp: newIsoTimestamp, created_at: newIsoTimestamp };
      }
      corrections[`${editingRecord.employee_name}_${editingRecord.type}_${origDate}`] = {
        timestamp: newIsoTimestamp,
        created_at: newIsoTimestamp
      };
      localStorage.setItem('attendance_corrections_map', JSON.stringify(corrections));

      const local = localStorage.getItem('local_attendance_logs');
      if (local) {
        const parsed: AttendanceRecord[] = JSON.parse(local);
        const updated = parsed.map((r) => {
          const isMatch =
            (editingRecord.id && r.id === editingRecord.id) ||
            (r.employee_name === editingRecord.employee_name &&
              r.type === editingRecord.type &&
              r.timestamp === editingRecord.timestamp);
          if (isMatch) {
            return { ...r, timestamp: newIsoTimestamp, created_at: newIsoTimestamp };
          }
          return r;
        });
        localStorage.setItem('local_attendance_logs', JSON.stringify(updated));
      }
    } catch (e) {}

    // 3. UPDATE SUPABASE DI LATAR BELAKANG
    try {
      if (isSupabaseConfigured && supabase) {
        if (editingRecord.id) {
          await supabase
            .from('attendance_logs')
            .update({
              timestamp: newIsoTimestamp,
              created_at: newIsoTimestamp
            })
            .eq('id', editingRecord.id);
        }
        await supabase
          .from('attendance_logs')
          .update({
            timestamp: newIsoTimestamp,
            created_at: newIsoTimestamp
          })
          .eq('employee_name', editingRecord.employee_name)
          .eq('type', editingRecord.type)
          .eq('timestamp', editingRecord.timestamp);
      }
    } catch (err) {
      console.warn('[Supabase Update Timestamp Warning]', err);
    }

    setSavingEdit(false);
    setEditingRecord(null);
    setActionSuccess('Waktu presensi berhasil dikoreksi! Status ketepatan waktu langsung terupdate. ✅');
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // ── TRIGGER NATIVE BROWSER PRINT ───────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────────────────
          HEADER CONTROL BAR (NAVIGASI BULAN, CETAK, TAMBAH CUTI)
      ───────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              Laporan & Rekapitulasi Presensi Tim
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-emerald-400">
              Khusus IT & Pengelola Rekap (Zulfan & Marsya)
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight mt-1 flex items-center gap-2">
            <span>Rekapan Kehadiran Bulanan</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {monthLabel}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Data presensi selfie, sakit, cuti, dan izin terintegrasi otomatis. Siap cetak ke format resmi A4.
          </p>
        </div>

        {/* Toolbar Aksi & Pemilih Periode */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Navigasi Bulan */}
          <div className="flex items-center bg-slate-100 border border-slate-200 p-1 rounded-xl">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Bulan Sebelumnya"
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-bold text-slate-800 px-2 py-1 outline-none cursor-pointer"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-bold text-slate-800 px-2 py-1 outline-none cursor-pointer"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleNextMonth}
              title="Bulan Berikutnya"
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Tombol Catat Izin / Cuti */}
          <button
            type="button"
            onClick={() => {
              setTargetManpowerId((attendanceEmployees && attendanceEmployees[0]?.id) || '');
              setAbsenceDate(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`);
              setShowAddAbsenceModal(true);
            }}
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Catat Izin / Cuti</span>
          </button>

          {/* Tombol Cetak / PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 transition-all shadow-xs cursor-pointer border border-slate-700"
          >
            <Printer className="h-4 w-4 text-emerald-400" />
            <span>Cetak Rekapan (A4)</span>
          </button>

          {/* Tombol Refresh */}
          <button
            type="button"
            onClick={() => {
              fetchMonthlyLogs();
              onRefreshAll();
            }}
            title="Muat Ulang Data"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifikasi Sukses Aksi */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs animate-in fade-in print:hidden">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          KOP RESMI PERUSAHAAN (TAMPIL DI LAYAR & SIAP CETAK A4)
      ───────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs print:border-none print:shadow-none print:p-0">
        <div className="text-center pb-4 border-b-2 border-slate-800 mb-5">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
            PT AKSARA RIKSA PERDANA
          </h1>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mt-0.5">
            Jasa Pemeriksaan & Pengujian Keselamatan dan Kesehatan Kerja (PJK3)
          </p>
          <div className="mt-2 inline-block bg-slate-100 print:bg-transparent px-3 py-1 rounded-lg">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase">
              Laporan Rekapitulasi Presensi & Ketidakhadiran Karyawan
            </h3>
          </div>
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 mt-1 font-mono">
            <span>
              Periode: <strong>{monthLabel.toUpperCase()}</strong>
            </span>
            <span>•</span>
            <span>
              Hari Kerja Efektif: <strong>{workingDaysCount} Hari</strong> (Senin–Sabtu)
            </span>
            <span>•</span>
            <span>
              Dicetak: {now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────
            KPI CARDS RINGKASAN TIM
        ───────────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5 print:grid-cols-6 print:gap-1.5 print:mb-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Karyawan</span>
            <span className="text-lg font-black text-slate-800 font-mono mt-0.5 block">
              {attendanceEmployees.length} <span className="text-xs font-normal text-slate-500">Orang</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Total Masuk</span>
            <span className="text-lg font-black text-emerald-800 font-mono mt-0.5 block">
              {summaryTotals.totalMasuk} <span className="text-xs font-normal text-emerald-600">Presensi</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
            <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider block">Tepat Waktu</span>
            <span className="text-lg font-black text-sky-800 font-mono mt-0.5 block">
              {summaryTotals.totalOnTime} <span className="text-xs font-normal text-sky-600">Entri</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Terlambat</span>
            <span className="text-lg font-black text-rose-800 font-mono mt-0.5 block">
              {summaryTotals.totalLate} <span className="text-xs font-normal text-rose-600">Kali</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Sakit / Cuti / Izin</span>
            <span className="text-lg font-black text-amber-800 font-mono mt-0.5 block">
              {summaryTotals.totalSakit + summaryTotals.totalCuti + summaryTotals.totalIzin}{' '}
              <span className="text-xs font-normal text-amber-600">Hari</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Rata-Rata Kehadiran</span>
            <span className="text-lg font-black text-purple-800 font-mono mt-0.5 block">
              {avgAttendancePct}%
            </span>
          </div>
        </div>

        {/* Filter Input di atas tabel (disembunyikan saat print) */}
        <div className="flex items-center justify-between gap-3 mb-3 print:hidden">
          <div className="relative flex-1 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari karyawan / jabatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Menampilkan {filteredRows.length} dari {(manpowerList || []).length} karyawan
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────
            TABEL REKAPITULASI UTAMA (PRINT-READY A4 LANDSCAPE)
        ───────────────────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto rounded-xl border border-slate-300 print:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white print:bg-slate-200 print:text-slate-900 font-bold border-b border-slate-300">
                <th className="py-2.5 px-2 text-center w-10 border-r border-slate-700 print:border-slate-400">NO</th>
                <th className="py-2.5 px-3 min-w-[180px] border-r border-slate-700 print:border-slate-400">
                  NAMA LENGKAP KARYAWAN
                </th>
                <th className="py-2.5 px-3 min-w-[130px] border-r border-slate-700 print:border-slate-400">
                  JABATAN / DIVISI
                </th>
                <th className="py-2.5 px-2 text-center w-16 border-r border-slate-700 print:border-slate-400 bg-emerald-950/40 print:bg-transparent">
                  MASUK
                </th>
                <th className="py-2.5 px-2 text-center w-14 border-r border-slate-700 print:border-slate-400">TEPAT</th>
                <th className="py-2.5 px-2 text-center w-14 border-r border-slate-700 print:border-slate-400 text-rose-300 print:text-rose-700">
                  TELAT
                </th>
                <th className="py-2.5 px-2 text-center w-16 border-r border-slate-700 print:border-slate-400">PULANG</th>
                <th className="py-2.5 px-2 text-center w-14 border-r border-slate-700 print:border-slate-400 bg-amber-950/30 print:bg-transparent">
                  SAKIT
                </th>
                <th className="py-2.5 px-2 text-center w-14 border-r border-slate-700 print:border-slate-400 bg-amber-950/30 print:bg-transparent">
                  CUTI
                </th>
                <th className="py-2.5 px-2 text-center w-14 border-r border-slate-700 print:border-slate-400 bg-amber-950/30 print:bg-transparent">
                  IZIN
                </th>
                <th className="py-2.5 px-2 text-center w-14 border-r border-slate-700 print:border-slate-400">KANTOR</th>
                <th className="py-2.5 px-2 text-center w-14 border-r border-slate-700 print:border-slate-400">SITE</th>
                <th className="py-2.5 px-2 text-center w-14 border-r border-slate-700 print:border-slate-400">WFH</th>
                <th className="py-2.5 px-2 text-center w-16 border-r border-slate-700 print:border-slate-400 font-mono font-black">
                  % HADIR
                </th>
                <th className="py-2.5 px-3 min-w-[120px] border-r border-slate-700 print:border-slate-400">EVALUASI</th>
                <th className="py-2.5 px-2 text-center w-28 print:hidden">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-700 print:divide-slate-400">
              {filteredRows.map((row, idx) => (
                <tr
                  key={row.manpower.id}
                  className={`hover:bg-slate-50 transition-colors ${
                    idx % 2 === 1 ? 'bg-slate-50/60 print:bg-slate-100/50' : 'bg-white'
                  }`}
                >
                  <td className="py-2 px-2 text-center font-mono text-slate-500 border-r border-slate-200 print:border-slate-400">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 font-bold text-slate-800 border-r border-slate-200 print:border-slate-400">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{row.manpower.full_name || row.manpower.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">@{row.manpower.name.toLowerCase()}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-[11px] text-slate-600 border-r border-slate-200 print:border-slate-400">
                    <div className="font-semibold text-slate-700">{row.manpower.role}</div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase font-semibold">
                      {row.manpower.division || 'Internal'}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center font-mono font-bold text-emerald-700 border-r border-slate-200 print:border-slate-400 bg-emerald-50/30 print:bg-transparent">
                    {row.masukCount}
                  </td>
                  <td className="py-2 px-2 text-center font-mono text-slate-600 border-r border-slate-200 print:border-slate-400">
                    {row.onTimeCount}
                  </td>
                  <td
                    className={`py-2 px-2 text-center font-mono font-bold border-r border-slate-200 print:border-slate-400 ${
                      row.lateCount > 0 ? 'text-rose-600 bg-rose-50/30 print:bg-transparent' : 'text-slate-400'
                    }`}
                  >
                    {row.lateCount}
                  </td>
                  <td className="py-2 px-2 text-center font-mono text-slate-600 border-r border-slate-200 print:border-slate-400">
                    {row.pulangCount}
                  </td>
                  <td className="py-2 px-2 text-center font-mono text-amber-700 font-bold border-r border-slate-200 print:border-slate-400 bg-amber-50/20 print:bg-transparent">
                    {row.sakitCount}
                  </td>
                  <td className="py-2 px-2 text-center font-mono text-purple-700 font-bold border-r border-slate-200 print:border-slate-400 bg-purple-50/20 print:bg-transparent">
                    {row.cutiCount}
                  </td>
                  <td className="py-2 px-2 text-center font-mono text-sky-700 font-bold border-r border-slate-200 print:border-slate-400 bg-sky-50/20 print:bg-transparent">
                    {row.izinCount}
                  </td>
                  <td className="py-2 px-2 text-center font-mono text-slate-500 border-r border-slate-200 print:border-slate-400">
                    {row.kantorCount}
                  </td>
                  <td className="py-2 px-2 text-center font-mono text-slate-500 border-r border-slate-200 print:border-slate-400">
                    {row.onSiteCount}
                  </td>
                  <td className="py-2 px-2 text-center font-mono text-slate-500 border-r border-slate-200 print:border-slate-400">
                    {row.wfhCount}
                  </td>
                  <td className="py-2 px-2 text-center font-mono font-black border-r border-slate-200 print:border-slate-400">
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        row.attendancePct >= 80
                          ? 'text-emerald-700 bg-emerald-100/60 print:bg-transparent'
                          : row.attendancePct >= 50
                          ? 'text-amber-700 bg-amber-100/60 print:bg-transparent'
                          : 'text-rose-700 bg-rose-100/60 print:bg-transparent'
                      }`}
                    >
                      {row.attendancePct.toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-2 px-3 text-[11px] font-semibold text-slate-700 border-r border-slate-200 print:border-slate-400">
                    {row.evaluation}
                  </td>
                  <td className="py-2 px-2 text-center print:hidden">
                    <div className="flex items-center justify-center gap-1">
                      {/* Tombol Catat Izin Langsung untuk Karyawan Ini */}
                      <button
                        type="button"
                        onClick={() => {
                          setTargetManpowerId(row.manpower.id);
                          setAbsenceDate(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`);
                          setShowAddAbsenceModal(true);
                        }}
                        title={`Catat Sakit/Cuti/Izin untuk ${row.manpower.name}`}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition-colors cursor-pointer"
                      >
                        + Cuti
                      </button>

                      {/* Tombol Detail & Edit Waktu (Semua bisa lihat log, khusus Zulfan bisa koreksi jam) */}
                      <button
                        type="button"
                        onClick={() => setSelectedPersonLogs({ personName: row.manpower.name, logs: row.logs })}
                        title="Lihat riwayat presensi & edit jam"
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* ─────────────────────────────────────────────────────────────────
                  BARIS TOTAL REKAPITULASI
              ───────────────────────────────────────────────────────────────── */}
              <tr className="bg-slate-100 print:bg-slate-200 font-bold text-slate-900 border-t-2 border-slate-800">
                <td colSpan={3} className="py-2.5 px-3 text-center uppercase tracking-wider border-r border-slate-400">
                  TOTAL KESELURUHAN
                </td>
                <td className="py-2.5 px-2 text-center font-mono font-black text-emerald-800 border-r border-slate-400">
                  {summaryTotals.totalMasuk}
                </td>
                <td className="py-2.5 px-2 text-center font-mono text-slate-800 border-r border-slate-400">
                  {summaryTotals.totalOnTime}
                </td>
                <td className="py-2.5 px-2 text-center font-mono text-rose-700 border-r border-slate-400">
                  {summaryTotals.totalLate}
                </td>
                <td className="py-2.5 px-2 text-center font-mono text-slate-800 border-r border-slate-400">
                  {summaryTotals.totalPulang}
                </td>
                <td className="py-2.5 px-2 text-center font-mono text-amber-800 border-r border-slate-400">
                  {summaryTotals.totalSakit}
                </td>
                <td className="py-2.5 px-2 text-center font-mono text-purple-800 border-r border-slate-400">
                  {summaryTotals.totalCuti}
                </td>
                <td className="py-2.5 px-2 text-center font-mono text-sky-800 border-r border-slate-400">
                  {summaryTotals.totalIzin}
                </td>
                <td colSpan={3} className="py-2.5 px-2 text-center font-mono text-slate-600 border-r border-slate-400">
                  -
                </td>
                <td className="py-2.5 px-2 text-center font-mono font-black text-slate-900 border-r border-slate-400">
                  {avgAttendancePct}%
                </td>
                <td className="py-2.5 px-3 text-center border-r border-slate-400">-</td>
                <td className="print:hidden"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────
            KOTAK TANDA TANGAN RESMI SIAP PRINT
        ───────────────────────────────────────────────────────────────────────── */}
        <div className="mt-8 pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs text-slate-800 print:mt-6 print:pt-4">
          <div>
            <p className="font-semibold text-slate-600 text-[11px]">Dibuat & Dikelola Oleh,</p>
            <p className="font-bold text-slate-800 text-[11px] mt-0.5">IT & HR Operations</p>
            <div className="h-16 flex items-end justify-center">
              {/* Tempat Tanda Tangan */}
            </div>
            <p className="font-black underline text-slate-900 text-xs tracking-tight">
              Zulfan Rafly Baihaqi / Marsya Aulia Rohman
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Divisi IT & Administrasi</p>
          </div>

          <div>
            <p className="font-semibold text-slate-600 text-[11px]">Mengetahui & Menyetujui,</p>
            <p className="font-bold text-slate-800 text-[11px] mt-0.5">Leader & Ahli Utama</p>
            <div className="h-16 flex items-end justify-center">
              {/* Tempat Tanda Tangan */}
            </div>
            <p className="font-black underline text-slate-900 text-xs tracking-tight">
              Rama Regawa Sri Anggayana
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Pimpinan Teknis PJK3</p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          MODAL: CATAT IZIN / CUTI CEPAT (UNTUK BACKLOG AWAL 2026 DLL)
      ───────────────────────────────────────────────────────────────────────── */}
      {showAddAbsenceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-teal-600" />
                <h3 className="text-base font-black text-slate-800">Catat Ketidakhadiran (Sakit / Cuti / Izin)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAbsenceModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickAbsence} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Pilih Karyawan:</label>
                <select
                  value={targetManpowerId}
                  onChange={(e) => setTargetManpowerId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-semibold"
                >
                  {attendanceEmployees.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name || m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Tanggal Absen:</label>
                  <input
                    type="date"
                    value={absenceDate}
                    onChange={(e) => setAbsenceDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Jenis Ketidakhadiran:</label>
                  <select
                    value={absenceType}
                    onChange={(e) => setAbsenceType(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-bold"
                  >
                    <option value="Sakit">🔴 Sakit</option>
                    <option value="Cuti">🔵 Cuti</option>
                    <option value="Izin">🟡 Izin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Alasan / Keterangan (Opsional):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Demam, Cuti Tahunan, Keperluan Keluarga"
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddAbsenceModal(false)}
                  className="text-xs font-semibold px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAbsence}
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {savingAbsence && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{savingAbsence ? 'Menyimpan...' : 'Simpan Catatan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          MODAL: DETAIL LOG & EDIT WAKTU PRESENSI (KHUSUS ZULFAN)
      ───────────────────────────────────────────────────────────────────────── */}
      {selectedPersonLogs && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800">
                  Riwayat Presensi: {selectedPersonLogs.personName}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Periode {monthLabel} • Total {selectedPersonLogs.logs.length} entri tercatat
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPersonLogs(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {selectedPersonLogs.logs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Tidak ada catatan presensi selfie untuk bulan ini.
                </div>
              ) : (
                (selectedPersonLogs.logs || []).map((log, idx) => {
                  const d = safeParseDate(log.timestamp);
                  const isLate = log.type === 'Masuk' && d ? (d.getHours() * 60 + d.getMinutes() > 9 * 60) : false;
                  const dateLabel = safeFormatDate(log.timestamp, { weekday: 'short', day: '2-digit', month: 'short' });
                  const timeLabel = safeFormatTime(log.timestamp);

                  return (
                    <div
                      key={log.id || idx}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                        isLate
                          ? 'bg-rose-50/50 border-rose-200'
                          : 'bg-emerald-50/40 border-emerald-200'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              log.type === 'Masuk'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {log.type}
                          </span>
                          <span className="font-mono text-slate-700 font-bold">
                            {dateLabel}
                          </span>
                          <span className="font-mono text-slate-900 font-black">
                            {timeLabel}
                          </span>
                          {isLate ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                              Telat
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Tepat Waktu
                            </span>
                          )}
                        </div>

                        {(log.building_name || log.location_name) && (
                          <p className="text-[10px] text-slate-500 truncate max-w-[280px]">
                            📍 {log.building_name || log.location_name}
                          </p>
                        )}
                      </div>

                      {/* Tombol Koreksi Jam — HANYA TAMPIL UNTUK ZULFAN */}
                      {canEditTimestamp && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditRecord(log)}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors cursor-pointer shrink-0"
                          title="Koreksi Waktu (Khusus IT Zulfan)"
                        >
                          <Edit2 className="h-3 w-3 text-amber-600" />
                          <span>Koreksi Jam</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPersonLogs(null)}
                className="text-xs font-semibold px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          MODAL EDIT WAKTU PRESENSI (HUMAN ERROR KOREKSI - ZULFAN ONLY)
      ───────────────────────────────────────────────────────────────────────── */}
      {editingRecord && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-black text-slate-800">Koreksi Waktu Presensi</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
              <strong>Khusus Otoritas IT ({currentUserLabel}):</strong> Anda dapat mengoreksi jam presensi karyawan untuk mengatasi kesalahan teknis/human error. Status ketepatan waktu akan langsung dikalkulasi ulang.
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] text-slate-500 block">Karyawan:</span>
                <span className="text-xs font-bold text-slate-800">{editingRecord.employee_name}</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tanggal Presensi:</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Jam Presensi (WIB) — Format HH:mm:ss:
                </label>
                <input
                  type="time"
                  step="1"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full text-xs font-mono font-bold p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 Tips: Masuk sebelum pukul 09:00:00 WIB untuk status Tepat Waktu.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="text-xs font-semibold px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditTimestamp}
                disabled={savingEdit}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {savingEdit && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{savingEdit ? 'Menyimpan...' : 'Simpan Koreksi'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
