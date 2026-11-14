/**
 * ============================================================
 * MODULE: Rekap Absensi Bulanan (Attendance Recap)
 * ============================================================
 * AKSES KETAT: Hanya akun Zulfan & Marsya yang bisa melihat & mengelola.
 * Fitur:
 * 1. Rekapitulasi Presensi (Masuk, Pulang, Sakit, Cuti, Izin, Mode Kerja)
 * 2. Pelacakan Durasi Bekerja (Total Jam & Rata-rata/hari, support Shift Malam)
 * 3. Indikator Keterlambatan (Warna Hijau Tepat Waktu, Merah Terlambat)
 * 4. Input Keterangan Manual (Konfirmasi via WhatsApp / Surat Resmi)
 * ============================================================
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useUser } from '../context/UserContext';
import { AttendanceRecord, ManpowerAbsence, Manpower } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { safeIsoDate, safeFormatTime, safeParseDate } from '../lib/dateUtils';
import {
  ShieldCheck,
  Lock,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Building2,
  MapPin,
  Briefcase,
  X,
  FileText,
  MessageSquare,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Timer,
  AlertCircle,
  FileDown
} from 'lucide-react';

// ─── HARDCODED ACCESS LIST (JANGAN DIUBAH!) ────────────────────────────────────
// Hanya 2 akun ini yang diizinkan melihat & mengelola Rekap Absensi.
export const ALLOWED_ATTENDANCE_ADMINS = ['zulfan', 'marsya'];

export function isAllowedAttendanceAdmin(username: string | null | undefined): boolean {
  if (!username) return false;
  return ALLOWED_ATTENDANCE_ADMINS.includes(username.trim().toLowerCase());
}

// ─── MASTER KARYAWAN RESMI ─────────────────────────────────────────────────────
export const MASTER_EMPLOYEES = [
  { id: 'u1',  username: 'Angga',    fullName: 'Rama Regawa Sri Anggayana',       email: 'angga@aksarariksapjk3.com',    role: 'Leader & Ahli Utama', division: 'Ahli' },
  { id: 'u2',  username: 'Imam',     fullName: 'Lalu Imam Taufik Rahman Hidayat', email: 'imam@aksarariksapjk3.com',     role: 'Ahli Spesialis',      division: 'Ahli' },
  { id: 'u3',  username: 'Fauzan',   fullName: 'Fauzan Akmaluddin',               email: 'fauzan@aksarariksapjk3.com',   role: 'Ahli Spesialis',      division: 'Ahli' },
  { id: 'u4',  username: 'Fakhziar', fullName: 'Fakhziar Wildan Hidayat',         email: 'fakhziar@aksarariksapjk3.com', role: 'Ahli Spesialis',      division: 'Ahli' },
  { id: 'u5',  username: 'Fazar',    fullName: 'Muhammad Fazar Maulana',          email: 'fazar@aksarariksapjk3.com',    role: 'Ahli Spesialis',      division: 'Ahli' },
  { id: 'u6',  username: 'Arya',     fullName: 'Arya Rizki Pratama',              email: 'arya@aksarariksapjk3.com',     role: 'Support Staff',       division: 'Admin' },
  { id: 'u7',  username: 'Rio',      fullName: 'Rio Andrian',                     email: 'rio@aksarariksapjk3.com',      role: 'Support Staff',       division: 'Admin' },
  { id: 'u8',  username: 'Aulia',    fullName: 'Aulia Zahra Dikrika',             email: 'aulia@aksarariksapjk3.com',    role: 'Support Staff',       division: 'Admin' },
  { id: 'u9',  username: 'Disa',     fullName: 'Disa Liestianie Putri',           email: 'disa@aksarariksapjk3.com',     role: 'Support Staff',       division: 'Admin' },
  { id: 'u10', username: 'Marsya',   fullName: 'Marsya Aulia Rohman',             email: 'marsya@aksarariksapjk3.com',   role: 'Support Staff',       division: 'Admin' },
  { id: 'u11', username: 'Zulfan',   fullName: 'Zulfan Rafly Baihaqi',            email: 'zulfan@aksarariksapjk3.com',   role: 'IT Staff',            division: 'IT' }
];

export interface ManualAttendanceNote {
  id: string;
  employee_name: string; // username or full name
  date: string; // YYYY-MM-DD
  source: 'WhatsApp' | 'Surat' | 'Telepon' | 'Lisan';
  category: 'Dispensasi Keterlambatan' | 'Izin Dinas / Lapangan' | 'Shift Malam / Lembur' | 'Surat Dokter' | 'Lainnya';
  note: string;
  created_by: string; // 'Zulfan' | 'Marsya'
  created_at: string; // ISO
}

// Helper hitung hari kerja (Sen-Jum)
function getWorkingDaysInMonth(year: number, month: number): number {
  let count = 0;
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count || 22;
}

const BULAN_INDO = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Helper kalkulasi keterlambatan
export function checkLateMinutes(timestampStr: string): number {
  try {
    const d = safeParseDate(timestampStr);
    if (!d) return 0;
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const targetMinute = 9 * 60; // 09:00 WIB = 540 min
    if (totalMinutes > targetMinute) {
      return totalMinutes - targetMinute;
    }
    return 0;
  } catch {
    return 0;
  }
}

// Helper format durasi jam & menit
export function formatDurationHours(durationMs: number): string {
  if (durationMs <= 0) return '0j 0m';
  const totalMinutes = Math.floor(durationMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}j ${mins}m`;
}

interface AttendanceRecapModuleProps {
  absences?: ManpowerAbsence[];
  manpowerList?: Manpower[];
  onClose?: () => void;
}

interface EmployeeDailyDetail {
  date: string;
  masukTime?: string;
  pulangTime?: string;
  workLocationType?: string;
  durationMs: number;
  lateMinutes: number;
  isLate: boolean;
  notes: ManualAttendanceNote[];
  absenceType?: string;
  absenceReason?: string;
}

interface EmployeeRecap {
  username: string;
  fullName: string;
  role: string;
  division: string;
  masuk: number;
  pulang: number;
  sakit: number;
  cuti: number;
  izin: number;
  kantor: number;
  onSite: number;
  wfh: number;
  lateCount: number;
  totalWorkingMs: number;
  uniqueDaysHadir: Set<string>;
  percentHadir: number;
  status: string;
  dailyDetails: Record<string, EmployeeDailyDetail>;
  manualNotesCount: number;
}

export default function AttendanceRecapModule({
  absences = [],
  manpowerList = [],
  onClose
}: AttendanceRecapModuleProps) {
  const { activeUser, currentUser } = useUser();

  // ─── STRICT ACCESS CONTROL ─────────────────────────────────────────────────────
  const hasAccess = useMemo(() => {
    return isAllowedAttendanceAdmin(activeUser) || isAllowedAttendanceAdmin(currentUser?.username);
  }, [activeUser, currentUser]);

  // State: Bulan & tahun
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [allAbsences, setAllAbsences] = useState<ManpowerAbsence[]>(absences);
  const [manualNotes, setManualNotes] = useState<ManualAttendanceNote[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal / Drawer Detail Karyawan
  const [selectedEmployeeUsername, setSelectedEmployeeUsername] = useState<string | null>(null);

  // Modal Input Keterangan Manual
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteFormEmp, setNoteFormEmp] = useState<string>('Angga');
  const [noteFormDate, setNoteFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [noteFormSource, setNoteFormSource] = useState<'WhatsApp' | 'Surat' | 'Telepon' | 'Lisan'>('WhatsApp');
  const [noteFormCategory, setNoteFormCategory] = useState<ManualAttendanceNote['category']>('Dispensasi Keterlambatan');
  const [noteFormText, setNoteFormText] = useState<string>('');
  const [savingNote, setSavingNote] = useState(false);

  // ─── LOAD MANUAL NOTES ─────────────────────────────────────────────────────────
  const loadManualNotes = useCallback(() => {
    try {
      const stored = localStorage.getItem('attendance_manual_notes');
      if (stored) {
        setManualNotes(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('[Manual Notes Error]', e);
    }
  }, []);

  // ─── LOAD ATTENDANCE RECORDS (SEMUA KARYAWAN) ──────────────────────────────────
  const loadAllAttendanceData = useCallback(async () => {
    if (!hasAccess) return;
    setLoading(true);

    try {
      let records: AttendanceRecord[] = [];
      let absData: ManpowerAbsence[] = [...absences];

      // 1. Supabase
      if (isSupabaseConfigured && supabase) {
        try {
          const [attRes, absRes] = await Promise.all([
            supabase
              .from('attendance_logs')
              .select('*')
              .order('timestamp', { ascending: false })
              .limit(2000),
            supabase
              .from('manpower_absences')
              .select('*')
          ]);

          if (!attRes.error && attRes.data) {
            records = attRes.data as AttendanceRecord[];
          }

          if (!absRes.error && absRes.data) {
            absData = absRes.data as ManpowerAbsence[];
          }
        } catch (e) {
          console.warn('[AttendanceRecap] Supabase fetch error:', e);
        }
      }

      // 1b. Google Apps Script (Google Sheets) Fallback/Sync - Ambil seluruh presensi tim termasuk Marsya
      const gasUrl = localStorage.getItem('gas_attendance_url') || (import.meta.env.VITE_GAS_ATTENDANCE_URL as string) || '';
      if (gasUrl) {
        try {
          const res = await fetch(gasUrl, { method: 'GET' });
          if (res.ok) {
            const resJson = await res.json();
            if (resJson && Array.isArray(resJson.records)) {
              const gasRecords = resJson.records as AttendanceRecord[];
              const existingKeys = new Set(
                records.map(r => `${(r.employee_name || '').toLowerCase()}_${r.type}_${(r as any).date || safeIsoDate(r.timestamp)}`)
              );
              gasRecords.forEach((gr) => {
                const grDate = (gr as any).date || safeIsoDate(gr.timestamp);
                const key = `${(gr.employee_name || '').toLowerCase()}_${gr.type}_${grDate}`;
                if (!existingKeys.has(key)) {
                  records.push(gr);
                  existingKeys.add(key);
                }
              });
            }
          }
        } catch (gasErr) {
          console.warn('[AttendanceRecap] GAS fetch warning:', gasErr);
        }
      }

      // 2. LocalStorage Fallback & Merge
      try {
        const localRaw = localStorage.getItem('local_attendance_logs');
        if (localRaw) {
          const localRecords: AttendanceRecord[] = JSON.parse(localRaw);
          const existingKeys = new Set(
            records.map(r => `${r.employee_name}_${r.type}_${safeIsoDate(r.timestamp)}`)
          );
          const uniqueLocal = localRecords.filter(r => {
            const key = `${r.employee_name}_${r.type}_${safeIsoDate(r.timestamp)}`;
            return !existingKeys.has(key);
          });
          records = [...records, ...uniqueLocal];
        }
      } catch (e) {}

      // 3. Terapkan koreksi waktu Zulfan
      try {
        const correctionsRaw = localStorage.getItem('attendance_corrections_map');
        if (correctionsRaw) {
          const corrections: Record<string, { timestamp: string }> = JSON.parse(correctionsRaw);
          records = records.map((rec) => {
            const recDate = safeIsoDate(rec.timestamp);
            const key = `${rec.employee_name}_${rec.type}_${recDate}`;
            const match = (rec.id && corrections[rec.id]) || corrections[key];
            if (match) {
              return { ...rec, timestamp: match.timestamp };
            }
            return rec;
          });
        }
      } catch (e) {}

      setAllRecords(records);
      setAllAbsences(absData);
      loadManualNotes();
    } catch (err) {
      console.error('[AttendanceRecap] Fatal error:', err);
    } finally {
      setLoading(false);
    }
  }, [hasAccess, absences, loadManualNotes]);

  useEffect(() => {
    loadAllAttendanceData();
  }, [loadAllAttendanceData]);

  // ─── SAVE MANUAL NOTE ──────────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!noteFormText.trim()) {
      alert('Harap isi keterangan/alasan konfirmasi.');
      return;
    }

    setSavingNote(true);
    const newNote: ManualAttendanceNote = {
      id: 'note_' + Date.now(),
      employee_name: noteFormEmp,
      date: noteFormDate,
      source: noteFormSource,
      category: noteFormCategory,
      note: noteFormText.trim(),
      created_by: activeUser || 'Zulfan',
      created_at: new Date().toISOString()
    };

    try {
      const updatedNotes = [newNote, ...manualNotes.filter(n => n.id !== newNote.id)];
      localStorage.setItem('attendance_manual_notes', JSON.stringify(updatedNotes));
      setManualNotes(updatedNotes);

      // Coba sync ke Supabase jika tabel attendance_notes tersedia
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('attendance_notes').insert([
            {
              employee_name: newNote.employee_name,
              date: newNote.date,
              source: newNote.source,
              category: newNote.category,
              note: newNote.note,
              created_by: newNote.created_by
            }
          ]);
        } catch (sbErr) {
          // Table mungkin belum ada di Supabase, no problem karena localStorage sudah aman
        }
      }

      setNoteFormText('');
      setIsNoteModalOpen(false);
    } catch (err: any) {
      alert('Gagal menyimpan keterangan: ' + (err?.message || err));
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (!confirm('Hapus keterangan ini?')) return;
    const updated = manualNotes.filter(n => n.id !== noteId);
    localStorage.setItem('attendance_manual_notes', JSON.stringify(updated));
    setManualNotes(updated);
  };

  // ─── KALKULASI REKAP, DURASI KERJA & KETERLAMBATAN ─────────────────────────────
  const { recapData, totals, workingDays } = useMemo(() => {
    const wd = getWorkingDaysInMonth(selectedYear, selectedMonth);
    const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

    // Inisialisasi map rekap per karyawan
    const recapMap: Record<string, EmployeeRecap> = {};
    MASTER_EMPLOYEES.forEach((emp) => {
      recapMap[emp.username.toLowerCase()] = {
        username: emp.username,
        fullName: emp.fullName,
        role: emp.role,
        division: emp.division,
        masuk: 0,
        pulang: 0,
        sakit: 0,
        cuti: 0,
        izin: 0,
        kantor: 0,
        onSite: 0,
        wfh: 0,
        lateCount: 0,
        totalWorkingMs: 0,
        uniqueDaysHadir: new Set<string>(),
        percentHadir: 0,
        status: 'Belum Ada Data',
        dailyDetails: {},
        manualNotesCount: 0
      };
    });

    // Helper match username dengan sistem prioritas bertingkat (Mencegah salah cocok nama seperti Marsya vs Aulia)
    const findMatchUser = (nameStr?: string, emailStr?: string): string | null => {
      const lower = (nameStr || '').trim().toLowerCase();
      const lowerEmail = (emailStr || '').trim().toLowerCase();
      const emailUser = lowerEmail.includes('@') ? lowerEmail.split('@')[0] : lowerEmail;

      // Tier 1: Pencocokan Akurat via Email / Email Username (Prioritas Tertinggi)
      if (lowerEmail) {
        for (const emp of MASTER_EMPLOYEES) {
          const empUser = emp.username.toLowerCase();
          const empEmail = (emp.email || `${empUser}@aksarariksapjk3.com`).toLowerCase();
          if (lowerEmail === empEmail || emailUser === empUser) {
            return empUser;
          }
        }
      }

      // Tier 2: Pencocokan Akurat Username (Misal "marsya" === "marsya")
      if (lower) {
        for (const emp of MASTER_EMPLOYEES) {
          const empUser = emp.username.toLowerCase();
          if (lower === empUser) {
            return empUser;
          }
        }
      }

      // Tier 3: Pencocokan Akurat Full Name (Misal "marsya aulia rohman" === "marsya aulia rohman")
      if (lower) {
        for (const emp of MASTER_EMPLOYEES) {
          const empFull = emp.fullName.toLowerCase();
          if (lower === empFull) {
            return emp.username.toLowerCase();
          }
        }
      }

      // Tier 4: Pencocokan Kata Pertama / Nama Panggilan di Depan (Misal "Marsya Aulia" -> kata pertama "marsya")
      if (lower) {
        const firstWord = lower.split(/\s+/)[0];
        for (const emp of MASTER_EMPLOYEES) {
          const empUser = emp.username.toLowerCase();
          if (firstWord === empUser) {
            return empUser;
          }
        }
      }

      // Tier 5: Prefix / Substring Nama Lengkap Utuh (Minimal 4 karakter unik)
      if (lower && lower.length >= 4) {
        for (const emp of MASTER_EMPLOYEES) {
          const empFull = emp.fullName.toLowerCase();
          const empUser = emp.username.toLowerCase();
          if (empFull === lower || empFull.startsWith(lower) || lower.startsWith(empFull)) {
            return empUser;
          }
        }
      }

      // Tier 6: Token Fallback (Hanya jika token sama persis dengan username)
      if (lower) {
        const tokens = lower.split(/\s+/);
        for (const emp of MASTER_EMPLOYEES) {
          const empUser = emp.username.toLowerCase();
          if (tokens.includes(empUser)) {
            return empUser;
          }
        }
      }

      return null;
    };

    // Urutkan records dari terlama ke terbaru untuk pairing Masuk & Pulang (termasuk shift malam)
    const sortedRecords = [...allRecords].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return (isNaN(ta) ? 0 : ta) - (isNaN(tb) ? 0 : tb);
    });

    // 1. Proses Records Absensi (Masuk & Pulang)
    // Kelompokkan record per karyawan
    const empRecordsMap: Record<string, AttendanceRecord[]> = {};
    sortedRecords.forEach((rec) => {
      const matched = findMatchUser(rec.employee_name, rec.employee_email);
      if (matched) {
        if (!empRecordsMap[matched]) empRecordsMap[matched] = [];
        empRecordsMap[matched].push(rec);
      }
    });

    // Hitung pairing durasi kerja dan keterlambatan per karyawan
    Object.keys(recapMap).forEach((userKey) => {
      const r = recapMap[userKey];
      const records = empRecordsMap[userKey] || [];

      // Telusuri record dalam bulan yang dipilih
      records.forEach((rec, idx) => {
        const recDate = (rec as any).date || safeIsoDate(rec.timestamp);
        if (!recDate || !recDate.startsWith(monthStr)) return;

        // Normalisasi timestamp jika perlu
        let effTimestamp = rec.timestamp;
        if (!effTimestamp || isNaN(new Date(effTimestamp).getTime())) {
          if ((rec as any).date && (rec as any).time) {
            effTimestamp = `${(rec as any).date}T${(rec as any).time}+07:00`;
          }
        }

        const type = rec.type;
        const mode = rec.work_location_type || 'Kantor';

        if (!r.dailyDetails[recDate]) {
          r.dailyDetails[recDate] = {
            date: recDate,
            durationMs: 0,
            lateMinutes: 0,
            isLate: false,
            notes: []
          };
        }
        const dayDet = r.dailyDetails[recDate];
        dayDet.workLocationType = mode;

        if (type === 'Masuk') {
          r.masuk++;
          r.uniqueDaysHadir.add(recDate);
          dayDet.masukTime = effTimestamp || rec.timestamp;

          if (mode === 'On Site') r.onSite++;
          else if (mode === 'WFH') r.wfh++;
          else r.kantor++;

          // Keterlambatan: Masuk lewat dari 09:00 WIB
          const lateMin = checkLateMinutes(effTimestamp || rec.timestamp);
          if (lateMin > 0) {
            dayDet.isLate = true;
            dayDet.lateMinutes = lateMin;
            r.lateCount++;
          }

          // Cari record 'Pulang' yang berpasangan setelah 'Masuk' ini (bisa hari yang sama atau besok subuh untuk shift malam)
          for (let pIdx = idx + 1; pIdx < records.length; pIdx++) {
            const nextRec = records[pIdx];
            if (nextRec.type === 'Pulang') {
              const masukMs = new Date(rec.timestamp).getTime();
              const pulangMs = new Date(nextRec.timestamp).getTime();
              const diffMs = pulangMs - masukMs;
              // Batas wajar shift: antara 15 menit sampai 24 jam
              if (diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000) {
                dayDet.pulangTime = nextRec.timestamp;
                dayDet.durationMs = diffMs;
                r.totalWorkingMs += diffMs;
                break;
              }
            }
          }
        } else if (type === 'Pulang') {
          r.pulang++;
          if (!dayDet.pulangTime) {
            dayDet.pulangTime = rec.timestamp;
          }
        }
      });
    });

    // 2. Proses Absences (Sakit / Cuti / Izin dari Kelola Manpower)
    allAbsences.forEach((abs) => {
      if (!abs.date || !abs.date.startsWith(monthStr)) return;
      const mp = manpowerList.find(m => m.id === abs.manpower_id);
      if (!mp) return;

      const userKey = findMatchUser(mp.name);
      if (!userKey || !recapMap[userKey]) return;

      const r = recapMap[userKey];
      const jenis = abs.absence_type;
      if (jenis === 'Sakit') r.sakit++;
      else if (jenis === 'Cuti') r.cuti++;
      else if (jenis === 'Izin') r.izin++;

      if (!r.dailyDetails[abs.date]) {
        r.dailyDetails[abs.date] = {
          date: abs.date,
          durationMs: 0,
          lateMinutes: 0,
          isLate: false,
          notes: []
        };
      }
      r.dailyDetails[abs.date].absenceType = jenis;
      r.dailyDetails[abs.date].absenceReason = abs.reason;
    });

    // 3. Tautkan Catatan Manual (WhatsApp / Surat)
    manualNotes.forEach((n) => {
      if (!n.date || !n.date.startsWith(monthStr)) return;
      const userKey = findMatchUser(n.employee_name);
      if (!userKey || !recapMap[userKey]) return;

      const r = recapMap[userKey];
      r.manualNotesCount++;

      if (!r.dailyDetails[n.date]) {
        r.dailyDetails[n.date] = {
          date: n.date,
          durationMs: 0,
          lateMinutes: 0,
          isLate: false,
          notes: []
        };
      }
      r.dailyDetails[n.date].notes.push(n);
    });

    // 4. Hitung persentase kehadiran & total rekapitulasi tim
    let totalMasuk = 0;
    let totalPulang = 0;
    let totalSakit = 0;
    let totalCuti = 0;
    let totalIzin = 0;
    let totalKantor = 0;
    let totalOnSite = 0;
    let totalWfh = 0;
    let totalLate = 0;
    let totalWorkingMsTim = 0;
    let totalPercentSum = 0;

    const recapList: EmployeeRecap[] = MASTER_EMPLOYEES.map((emp) => {
      const r = recapMap[emp.username.toLowerCase()];
      const hariHadir = r.uniqueDaysHadir.size;
      const pct = wd > 0 ? Math.min(hariHadir / wd, 1) : 0;
      r.percentHadir = pct;

      // Status Evaluasi
      if (r.sakit > 0 && r.cuti > 0) r.status = `Sakit ${r.sakit}h + Cuti ${r.cuti}h`;
      else if (r.sakit > 0) r.status = `Izin Sakit (${r.sakit}h)`;
      else if (r.cuti > 0) r.status = `Cuti (${r.cuti}h)`;
      else if (r.izin > 0) r.status = `Izin (${r.izin}h)`;
      else if (r.masuk === 0) r.status = 'Belum Ada Presensi';
      else if (r.lateCount > 0) r.status = `Terlambat ${r.lateCount}x`;
      else if (pct >= 0.9) r.status = '🟢 Hadir Tertib';
      else r.status = 'Hadir';

      totalMasuk += r.masuk;
      totalPulang += r.pulang;
      totalSakit += r.sakit;
      totalCuti += r.cuti;
      totalIzin += r.izin;
      totalKantor += r.kantor;
      totalOnSite += r.onSite;
      totalWfh += r.wfh;
      totalLate += r.lateCount;
      totalWorkingMsTim += r.totalWorkingMs;
      totalPercentSum += pct;

      return r;
    });

    return {
      recapData: recapList,
      totals: {
        masuk: totalMasuk,
        pulang: totalPulang,
        sakit: totalSakit,
        cuti: totalCuti,
        izin: totalIzin,
        kantor: totalKantor,
        onSite: totalOnSite,
        wfh: totalWfh,
        late: totalLate,
        totalWorkingDuration: formatDurationHours(totalWorkingMsTim),
        avgPercent: MASTER_EMPLOYEES.length > 0 ? totalPercentSum / MASTER_EMPLOYEES.length : 0
      },
      workingDays: wd
    };
  }, [allRecords, allAbsences, manualNotes, selectedYear, selectedMonth, manpowerList]);

  // Data detail karyawan terpilih
  const selectedEmpData = useMemo(() => {
    if (!selectedEmployeeUsername) return null;
    return recapData.find(e => e.username.toLowerCase() === selectedEmployeeUsername.toLowerCase()) || null;
  }, [selectedEmployeeUsername, recapData]);

  // Navigasi Bulan
  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const goToCurrentMonth = () => {
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth());
  };

  const [exportingPdf, setExportingPdf] = useState(false);

  // ─── EXPORT REKAP BULANAN TIM KE PDF ─────────────────────────────────────────
  const handleExportTeamPdf = () => {
    try {
      setExportingPdf(true);
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const periodTitle = `${BULAN_INDO[selectedMonth]} ${selectedYear}`;

      // 1. Kop Resmi PT AKSARA RIKSA PERDANA (Landscape Width 297mm)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('PT AKSARA RIKSA PERDANA', 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text('PJK3 Bidang Pemeriksaan dan Pengujian Teknik K3', 14, 20);

      // Sisi Kanan: Judul Dokumen & Periode
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      const titleText = 'REKAPITULASI PRESENSI & JAM KERJA';
      doc.text(titleText, 283 - doc.getTextWidth(titleText), 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const subTitleText = `Periode: ${periodTitle} (${workingDays} Hari Kerja)`;
      doc.text(subTitleText, 283 - doc.getTextWidth(subTitleText), 20);

      // Garis Pembatas Kop
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.4);
      doc.line(14, 24, 283, 24);

      // 2. Bar Ringkasan Metrik
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 28, 269, 11, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('RINGKASAN TIM:', 18, 35.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Total Personel:', 48, 35.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${MASTER_EMPLOYEES.length} Orang`, 68, 35.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Total Kehadiran:', 90, 35.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(`${totals.masuk} Masuk / ${totals.pulang} Pulang`, 112, 35.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Keterlambatan:', 160, 35.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text(`${totals.late} Kali`, 183, 35.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Total Durasi Kerja:', 202, 35.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(2, 132, 199);
      doc.text(`${totals.totalWorkingDuration}`, 230, 35.5);

      // 3. AutoTable Data
      const headers = [
        ['NO', 'NAMA KARYAWAN', 'JABATAN & DIVISI', 'MSK', 'PLG', 'TELAT', 'DURASI KERJA', 'S', 'C', 'I', 'KTR', 'SITE', '% HDR', 'STATUS / CATATAN']
      ];

      const rows = recapData.map((emp, idx) => {
        const pctStr = emp.percentHadir > 0 ? `${(emp.percentHadir * 100).toFixed(1)}%` : '0%';
        const durStr = formatDurationHours(emp.totalWorkingMs);
        const lateStr = emp.lateCount > 0 ? `${emp.lateCount}x` : '0';
        const noteStr = emp.manualNotesCount > 0 ? `${emp.status} (${emp.manualNotesCount} catatan WA/Surat)` : emp.status;

        return [
          String(idx + 1),
          `${emp.fullName}\n(@${emp.username})`,
          `${emp.role}\n[${emp.division}]`,
          String(emp.masuk),
          String(emp.pulang),
          lateStr,
          durStr,
          String(emp.sakit || '-'),
          String(emp.cuti || '-'),
          String(emp.izin || '-'),
          String(emp.kantor || '-'),
          String(emp.onSite || '-'),
          pctStr,
          noteStr
        ];
      });

      const footerRow = [
        '',
        'TOTAL KESELURUHAN',
        '',
        String(totals.masuk),
        String(totals.pulang),
        `${totals.late}x`,
        totals.totalWorkingDuration,
        String(totals.sakit),
        String(totals.cuti),
        String(totals.izin),
        String(totals.kantor),
        String(totals.onSite),
        `${(totals.avgPercent * 100).toFixed(1)}%`,
        '-'
      ];

      autoTable(doc, {
        startY: 42,
        head: headers,
        body: rows,
        foot: [footerRow],
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          overflow: 'linebreak',
          valign: 'middle',
          font: 'helvetica'
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'center'
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 50, halign: 'left', fontStyle: 'bold' },
          2: { cellWidth: 38, halign: 'left' },
          3: { cellWidth: 13, halign: 'center' },
          4: { cellWidth: 13, halign: 'center' },
          5: { cellWidth: 14, halign: 'center' },
          6: { cellWidth: 23, halign: 'center' },
          7: { cellWidth: 10, halign: 'center' },
          8: { cellWidth: 10, halign: 'center' },
          9: { cellWidth: 10, halign: 'center' },
          10: { cellWidth: 12, halign: 'center' },
          11: { cellWidth: 12, halign: 'center' },
          12: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
          13: { cellWidth: 38, halign: 'left' }
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250]
        },
        didDrawPage: (data) => {
          const totalPages = (doc.internal as any).getNumberOfPages?.() || (doc as any).getNumberOfPages?.() || 1;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);

          const footerLeft = `Halaman ${data.pageNumber} dari ${totalPages} • Dokumen Resmi Internal PT Aksara Riksa Perdana`;
          doc.text(footerLeft, 14, 201);

          const today = new Date();
          const todayStr = `${today.getDate()} ${BULAN_INDO[today.getMonth()]} ${today.getFullYear()} ${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')} WIB`;
          const footerRight = `Diekspor oleh ${activeUser || 'Admin'} pada: ${todayStr}`;
          doc.text(footerRight, 283 - doc.getTextWidth(footerRight), 201);
        }
      });

      const safePeriodName = periodTitle.replace(/\s+/g, '_');
      doc.save(`Rekap_Presensi_Tim_${safePeriodName}.pdf`);
    } catch (err: any) {
      alert('Gagal mengekspor PDF: ' + (err?.message || err));
    } finally {
      setExportingPdf(false);
    }
  };

  // ─── EXPORT KARTU DETAIL KARYAWAN KE PDF ───────────────────────────────────────
  const handleExportIndividualPdf = (emp: EmployeeRecap) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const periodTitle = `${BULAN_INDO[selectedMonth]} ${selectedYear}`;

      // Kop Resmi
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text('PT AKSARA RIKSA PERDANA', 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('PJK3 Bidang Pemeriksaan dan Pengujian Teknik K3', 14, 20);

      // Kanan
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      const titleText = 'KARTU PRESENSI KARYAWAN';
      doc.text(titleText, 196 - doc.getTextWidth(titleText), 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const subTitleText = `Periode: ${periodTitle}`;
      doc.text(subTitleText, 196 - doc.getTextWidth(subTitleText), 20);

      // Garis Kop
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(14, 24, 196, 24);

      // Profil Karyawan Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 27, 182, 17, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Nama: ${emp.fullName} (@${emp.username})`, 18, 33);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Jabatan: ${emp.role} | Divisi: ${emp.division}`, 18, 38);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(`Hadir: ${emp.masuk} hr (${(emp.percentHadir * 100).toFixed(1)}%)`, 125, 33);
      doc.setTextColor(220, 38, 38);
      doc.text(`Telat: ${emp.lateCount}x`, 125, 38);
      doc.setTextColor(2, 132, 199);
      doc.text(`Durasi: ${formatDurationHours(emp.totalWorkingMs)}`, 155, 38);

      // Log Harian
      const sortedDaily = (Object.values(emp.dailyDetails) as EmployeeDailyDetail[])
        .sort((a, b) => a.date.localeCompare(b.date));

      const dailyHeaders = [['No', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Durasi', 'Ketepatan Waktu / Catatan']];
      const dailyRows = sortedDaily.map((d, i) => {
        const dObj = safeParseDate(d.date);
        const dayLabel = dObj
          ? dObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
          : d.date;

        const msk = d.masukTime ? safeFormatTime(d.masukTime) : '-';
        const plg = d.pulangTime ? safeFormatTime(d.pulangTime) : (d.masukTime ? '(Belum absen)' : '-');
        const dur = d.durationMs > 0 ? formatDurationHours(d.durationMs) : '-';

        let statusText = d.isLate ? `Terlambat ${d.lateMinutes} mnt` : (d.masukTime ? 'Tepat Waktu' : '-');
        if (d.absenceType) statusText = `${d.absenceType}: ${d.absenceReason || '-'}`;
        if (d.notes && d.notes.length > 0) {
          const notesStr = d.notes.map(n => `[${n.source}] ${n.note}`).join('; ');
          statusText += ` | ${notesStr}`;
        }

        return [String(i + 1), dayLabel, msk, plg, dur, statusText];
      });

      autoTable(doc, {
        startY: 47,
        head: dailyHeaders,
        body: dailyRows,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          valign: 'middle',
          font: 'helvetica'
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 32 },
          2: { cellWidth: 26, halign: 'center' },
          3: { cellWidth: 26, halign: 'center' },
          4: { cellWidth: 22, halign: 'center' },
          5: { cellWidth: 66 }
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250]
        },
        didDrawPage: (data) => {
          const totalPages = (doc.internal as any).getNumberOfPages?.() || (doc as any).getNumberOfPages?.() || 1;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);

          const footerLeft = `Halaman ${data.pageNumber} dari ${totalPages} • Dokumen Resmi Internal PT Aksara Riksa Perdana`;
          doc.text(footerLeft, 14, 285);

          const today = new Date();
          const todayStr = `${today.getDate()} ${BULAN_INDO[today.getMonth()]} ${today.getFullYear()} ${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')} WIB`;
          const footerRight = `Dicetak oleh ${activeUser || 'Admin'} pada: ${todayStr}`;
          doc.text(footerRight, 196 - doc.getTextWidth(footerRight), 285);
        }
      });

      doc.save(`Presensi_${emp.username}_${periodTitle.replace(/\s+/g, '_')}.pdf`);
    } catch (err: any) {
      alert('Gagal mengekspor kartu presensi: ' + (err?.message || err));
    }
  };

  // ═════════════════════════════════════════════════════════════════════════════════
  // RENDER: ACCESS DENIED (Bukan Zulfan / Marsya)
  // ═════════════════════════════════════════════════════════════════════════════════
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-8">
        <div className="bg-white border border-rose-200 rounded-3xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 mx-auto">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight">
            Akses Ditolak
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Fitur <strong>Rekapitulasi Presensi & Durasi Bekerja</strong> hanya dapat diakses oleh akun yang berwenang (Zulfan & Marsya).
          </p>
          <div className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-400 font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            <span>Restricted: Zulfan & Marsya only</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-full mt-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Tutup
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════════
  // RENDER: REKAP ABSENSI UTAMA (Zulfan & Marsya)
  // ═════════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 animate-in fade-in duration-200">

      {/* Top Action Header */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl text-emerald-600 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">
                  Rekapitulasi Presensi & Durasi Bekerja
                </h2>
                <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-widest flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-amber-600" />
                  <span>Zulfan & Marsya Only</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pantau ketepatan waktu (indikator warna), tracking durasi jam kerja teknisi (support shift malam), dan input konfirmasi via WhatsApp/Surat.
              </p>
            </div>
          </div>

          {/* Action Buttons: Ekspor PDF + Keterangan Manual + Navigasi Bulan + Tutup */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportTeamPdf}
              disabled={exportingPdf || recapData.length === 0}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs disabled:opacity-50"
              title="Ekspor Seluruh Rekapitulasi Presensi Tim ke Format PDF Resmi"
            >
              <FileDown className={`h-3.5 w-3.5 ${exportingPdf ? 'animate-bounce' : ''}`} />
              <span>{exportingPdf ? 'Mengekspor...' : 'Ekspor PDF'}</span>
            </button>

            <button
              onClick={() => {
                setNoteFormEmp('Angga');
                setNoteFormDate(new Date().toISOString().split('T')[0]);
                setNoteFormText('');
                setIsNoteModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-2 rounded-xl border border-indigo-200 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Input Keterangan (WA/Surat)</span>
            </button>

            {/* Navigasi Bulan */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5">
              <button
                onClick={goToPrevMonth}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-all cursor-pointer"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                onClick={goToCurrentMonth}
                className="px-2.5 py-1 text-xs font-bold text-slate-800 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                {BULAN_INDO[selectedMonth]} {selectedYear}
              </button>

              <button
                onClick={goToNextMonth}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-all cursor-pointer"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={loadAllAttendanceData}
              disabled={loading}
              className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-600 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-xl border border-slate-200 text-slate-500 transition-all cursor-pointer"
                title="Tutup Rekapan"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600 border border-emerald-100">
              <Users className="h-3.5 w-3.5" />
            </div>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Karyawan</span>
          </div>
          <p className="text-2xl font-black font-mono text-slate-800">{MASTER_EMPLOYEES.length}</p>
          <p className="text-[9px] text-slate-400 mt-0.5">{workingDays} hari kerja (Sen-Jum)</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-sky-50 p-1.5 rounded-lg text-sky-600 border border-sky-100">
              <Timer className="h-3.5 w-3.5" />
            </div>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Durasi Kerja Tim</span>
          </div>
          <p className="text-xl font-black font-mono text-sky-600 truncate">{totals.totalWorkingDuration}</p>
          <p className="text-[9px] text-slate-400 mt-0.5">Total jam kerja terakumulasi</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-rose-50 p-1.5 rounded-lg text-rose-500 border border-rose-100">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Keterlambatan</span>
          </div>
          <p className="text-2xl font-black font-mono text-rose-500">{totals.late} <span className="text-xs font-normal text-slate-400">kali</span></p>
          <p className="text-[9px] text-slate-400 mt-0.5">Masuk &gt; 09:00 WIB</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600 border border-indigo-100">
              <MessageSquare className="h-3.5 w-3.5" />
            </div>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Konfirmasi Manual</span>
          </div>
          <p className="text-2xl font-black font-mono text-indigo-600">{manualNotes.length} <span className="text-xs font-normal text-slate-400">catatan</span></p>
          <p className="text-[9px] text-slate-400 mt-0.5">Via WhatsApp & Surat</p>
        </div>
      </div>

      {/* Main Table: Rekap Kehadiran, Keterlambatan, & Durasi */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-700">
              Rekapitulasi Kehadiran: {BULAN_INDO[selectedMonth]} {selectedYear}
            </span>
          </div>
          <span className="text-[10px] text-slate-500">
            💡 Klik baris karyawan untuk melihat rincian tanggal, durasi jam kerja & keterangan WA/Surat.
          </span>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 text-emerald-500 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Memuat data rekapitulasi presensi...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-3 py-2.5 text-center font-bold w-10">NO</th>
                  <th className="px-3 py-2.5 text-left font-bold min-w-[180px]">NAMA KARYAWAN</th>
                  <th className="px-3 py-2.5 text-left font-bold min-w-[110px]">DIVISI</th>
                  <th className="px-3 py-2.5 text-center font-bold w-16">MASUK</th>
                  <th className="px-3 py-2.5 text-center font-bold w-16">PULANG</th>
                  <th className="px-3 py-2.5 text-center font-bold w-20 text-rose-300">
                    <span className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" /> TELAT
                    </span>
                  </th>
                  <th className="px-3 py-2.5 text-center font-bold w-24 text-sky-300">
                    <span className="flex items-center justify-center gap-1">
                      <Timer className="h-3 w-3" /> DURASI KERJA
                    </span>
                  </th>
                  <th className="px-3 py-2.5 text-center font-bold w-12 text-rose-300">S</th>
                  <th className="px-3 py-2.5 text-center font-bold w-12 text-amber-300">C</th>
                  <th className="px-3 py-2.5 text-center font-bold w-12 text-sky-300">I</th>
                  <th className="px-3 py-2.5 text-center font-bold w-16">KTR</th>
                  <th className="px-3 py-2.5 text-center font-bold w-16">SITE</th>
                  <th className="px-3 py-2.5 text-center font-bold w-16">% HADIR</th>
                  <th className="px-3 py-2.5 text-left font-bold min-w-[140px]">KET / STATUS</th>
                  <th className="px-3 py-2.5 text-center font-bold w-20">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {recapData.map((emp, idx) => {
                  const pctVal = emp.percentHadir * 100;
                  const pctColor = pctVal >= 90 ? 'text-emerald-600' :
                                   pctVal >= 70 ? 'text-amber-600' :
                                   pctVal > 0  ? 'text-rose-500' : 'text-slate-400';
                  const rowBg = idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white';
                  const durationStr = formatDurationHours(emp.totalWorkingMs);

                  return (
                    <tr
                      key={emp.username}
                      onClick={() => setSelectedEmployeeUsername(emp.username)}
                      className={`${rowBg} border-b border-slate-100 hover:bg-emerald-50/40 transition-colors cursor-pointer`}
                    >
                      <td className="px-3 py-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 text-left">
                        <p className="font-bold text-slate-800 text-[11px]">{emp.fullName}</p>
                        <p className="text-[9px] text-slate-400 font-mono">@{emp.username}</p>
                      </td>
                      <td className="px-3 py-2.5 text-left">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          emp.division === 'Ahli' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          emp.division === 'IT'   ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                    'bg-sky-50 text-sky-700 border-sky-200'
                        }`}>
                          {emp.role}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-emerald-600">{emp.masuk}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-sky-600">{emp.pulang}</td>
                      
                      {/* Indikator Telat */}
                      <td className="px-3 py-2.5 text-center">
                        {emp.lateCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold font-mono text-[10px] border border-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                            <span>{emp.lateCount}x</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold font-mono text-[10px] border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>0</span>
                          </span>
                        )}
                      </td>

                      {/* Durasi Jam Kerja (Support Shift Malam) */}
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700">
                        {emp.totalWorkingMs > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
                            {durationStr}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Sakit, Cuti, Izin */}
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-rose-500">{emp.sakit || <span className="text-slate-300">–</span>}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-amber-600">{emp.cuti || <span className="text-slate-300">–</span>}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-sky-500">{emp.izin || <span className="text-slate-300">–</span>}</td>

                      {/* Lokasi Kerja */}
                      <td className="px-3 py-2.5 text-center font-mono text-slate-600">{emp.kantor || <span className="text-slate-300">–</span>}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-600">{emp.onSite || <span className="text-slate-300">–</span>}</td>

                      {/* % Hadir */}
                      <td className={`px-3 py-2.5 text-center font-mono font-black ${pctColor}`}>
                        {pctVal > 0 ? `${pctVal.toFixed(1)}%` : '–'}
                      </td>

                      {/* Status / Evaluasi & Keterangan */}
                      <td className="px-3 py-2.5 text-left text-[10px]">
                        <p className="font-semibold text-slate-700">{emp.status}</p>
                        {emp.manualNotesCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[9px] text-indigo-600 font-medium mt-0.5">
                            <MessageSquare className="h-2.5 w-2.5" />
                            <span>{emp.manualNotesCount} catatan WA/Surat</span>
                          </span>
                        )}
                      </td>

                      {/* Aksi Cepat */}
                      <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setNoteFormEmp(emp.username);
                            setNoteFormDate(new Date().toISOString().split('T')[0]);
                            setNoteFormText('');
                            setIsNoteModalOpen(true);
                          }}
                          title="Tambah Catatan WhatsApp / Surat"
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Footer Total */}
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs">
                  <td colSpan={3} className="px-3 py-2.5 text-center text-slate-700 uppercase tracking-wider">
                    TOTAL KESELURUHAN
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-emerald-700">{totals.masuk}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-sky-700">{totals.pulang}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-rose-600">{totals.late}x</td>
                  <td className="px-3 py-2.5 text-center font-mono text-sky-700">{totals.totalWorkingDuration}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-rose-600">{totals.sakit}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-amber-700">{totals.cuti}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-sky-600">{totals.izin}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-slate-700">{totals.kantor}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-slate-700">{totals.onSite}</td>
                  <td className="px-3 py-2.5 text-center font-mono font-black text-amber-700">
                    {(totals.avgPercent * 100).toFixed(1)}%
                  </td>
                  <td colSpan={2} className="px-3 py-2.5 text-slate-500 text-[10px]">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAL DETAIL LOG HARIAN KARYAWAN ─────────────────────────────────────── */}
      {selectedEmpData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-black flex items-center justify-center text-sm">
                  {selectedEmpData.username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">{selectedEmpData.fullName}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedEmpData.role} • {BULAN_INDO[selectedMonth]} {selectedYear}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmployeeUsername(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick KPI Karyawan ini */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-emerald-600 font-bold block">HADIR</span>
                <span className="text-lg font-black font-mono text-emerald-800">{selectedEmpData.masuk} hr</span>
              </div>
              <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-sky-600 font-bold block">DURASI KERJA</span>
                <span className="text-lg font-black font-mono text-sky-800">{formatDurationHours(selectedEmpData.totalWorkingMs)}</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-rose-600 font-bold block">TELAT</span>
                <span className="text-lg font-black font-mono text-rose-800">{selectedEmpData.lateCount}x</span>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-indigo-600 font-bold block">KET. WA/SURAT</span>
                <span className="text-lg font-black font-mono text-indigo-800">{selectedEmpData.manualNotesCount}</span>
              </div>
            </div>

            {/* List Hari & Jam Absen Karyawan Ini */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Log Harian Kehadiran & Durasi:
              </h4>

              {Object.keys(selectedEmpData.dailyDetails).length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  Tidak ada catatan presensi pada bulan ini.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {(Object.values(selectedEmpData.dailyDetails) as EmployeeDailyDetail[])
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((day) => {
                      const dObj = safeParseDate(day.date);
                      const dayLabel = dObj
                        ? dObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
                        : day.date;

                      return (
                        <div
                          key={day.date}
                          className={`p-3 rounded-2xl border text-xs space-y-1.5 transition-colors ${
                            day.isLate
                              ? 'bg-rose-50/50 border-rose-200'
                              : day.absenceType
                              ? 'bg-amber-50/50 border-amber-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">{dayLabel}</span>
                            <div className="flex items-center gap-1.5">
                              {day.isLate ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-200">
                                  🔴 Terlambat {day.lateMinutes} mnt
                                </span>
                              ) : day.masukTime ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                                  🟢 Tepat Waktu
                                </span>
                              ) : null}

                              {day.absenceType && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200">
                                  {day.absenceType}: {day.absenceReason || '-'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Jam Masuk -> Pulang & Durasi */}
                          {day.masukTime && (
                            <div className="flex items-center justify-between text-[11px] text-slate-600 bg-white/80 p-2 rounded-xl border border-slate-100">
                              <div>
                                <span>Masuk: <strong>{safeFormatTime(day.masukTime)}</strong></span>
                                {day.pulangTime ? (
                                  <span> → Pulang: <strong>{safeFormatTime(day.pulangTime)}</strong></span>
                                ) : (
                                  <span className="text-amber-600 font-semibold"> (Belum absen pulang)</span>
                                )}
                              </div>
                              {day.durationMs > 0 && (
                                <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                                  ⏱️ {formatDurationHours(day.durationMs)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Keterangan Manual WA / Surat */}
                          {day.notes.length > 0 && (
                            <div className="space-y-1 pt-1">
                              {day.notes.map((n) => (
                                <div
                                  key={n.id}
                                  className="p-2 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-start justify-between gap-2 text-[10px] text-indigo-900"
                                >
                                  <div>
                                    <span className="font-bold underline uppercase">{n.source}</span>: {n.note}
                                    <span className="text-indigo-400 block text-[9px] mt-0.5">
                                      Dicatat oleh: {n.created_by}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteNote(n.id)}
                                    className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                                    title="Hapus Keterangan"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setNoteFormEmp(selectedEmpData.username);
                    setNoteFormDate(new Date().toISOString().split('T')[0]);
                    setNoteFormText('');
                    setIsNoteModalOpen(true);
                  }}
                  className="text-xs font-bold px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Keterangan (WA/Surat)</span>
                </button>

                <button
                  onClick={() => handleExportIndividualPdf(selectedEmpData)}
                  className="text-xs font-bold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer flex items-center gap-1.5"
                  title="Unduh Kartu Detail Presensi Karyawan Ini ke Format PDF"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span>Unduh Kartu Presensi (PDF)</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedEmployeeUsername(null)}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL INPUT KETERANGAN MANUAL (WHATSAPP / SURAT) ────────────────────── */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-800">Input Keterangan Manual</h3>
              </div>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Pilih Karyawan:</label>
                <select
                  value={noteFormEmp}
                  onChange={(e) => setNoteFormEmp(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {MASTER_EMPLOYEES.map(e => (
                    <option key={e.username} value={e.username}>
                      {e.fullName} ({e.username}) - {e.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tanggal Kejadian:</label>
                  <input
                    type="date"
                    value={noteFormDate}
                    onChange={(e) => setNoteFormDate(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Media Konfirmasi:</label>
                  <select
                    value={noteFormSource}
                    onChange={(e) => setNoteFormSource(e.target.value as any)}
                    className="w-full p-2 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="WhatsApp">🟢 WhatsApp</option>
                    <option value="Surat">📄 Surat Resmi</option>
                    <option value="Telepon">📞 Telepon Langsung</option>
                    <option value="Lisan">🗣️ Lisan / Di Tempat</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Kategori Keterangan:</label>
                <select
                  value={noteFormCategory}
                  onChange={(e) => setNoteFormCategory(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Dispensasi Keterlambatan">⏰ Dispensasi Keterlambatan (Macet / Kendala Armada)</option>
                  <option value="Izin Dinas / Lapangan">🏭 Izin Langsung ke Lokasi Klien / Dinas Lapangan</option>
                  <option value="Shift Malam / Lembur">🌙 Shift Malam / Pekerjaan Lembur</option>
                  <option value="Surat Dokter">🩺 Sakit (Ada Surat Keterangan Dokter)</option>
                  <option value="Lainnya">📝 Lainnya</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Isi Keterangan / Catatan:</label>
                <textarea
                  rows={3}
                  value={noteFormText}
                  onChange={(e) => setNoteFormText(e.target.value)}
                  placeholder="Contoh: Karyawan mengabari via WhatsApp pukul 08:30 bahwa mobil operasional mogok di tol. Tiba di kantor jam 09:25."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-500">
                🔒 Dicatat oleh: <strong>{activeUser || 'Zulfan'}</strong>. Catatan ini akan tersimpan aman dan terlampir pada log kehadiran karyawan yang bersangkutan.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsNoteModalOpen(false)}
                className="text-xs font-semibold px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={savingNote}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {savingNote && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{savingNote ? 'Menyimpan...' : 'Simpan Keterangan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
