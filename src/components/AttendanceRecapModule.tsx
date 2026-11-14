/**
 * ============================================================
 * MODULE: Rekapitulasi Presensi & Durasi Bekerja (Single Source of Truth)
 * ============================================================
 * PT AKSARA RIKSA PERDANA (PJK3)
 * Fitur:
 * 1. Roster Dinamis Karyawan: Menggabungkan Master Karyawan, Manpower, dan Log Unik
 * 2. Primary Grouping Key: Email Karyawan (employee_email) anti-bentrok
 * 3. Konversi Zona Waktu WIB (Asia/Jakarta, UTC+7) Akurat
 * 4. Deduplikasi Otomatis: 1 Masuk paling awal & 1 Pulang paling akhir per tanggal WIB
 * 5. Ekspor PDF Resmi 8 Kolom Bersih (Landscape A4) & Kartu Presensi Karyawan (Portrait A4)
 * 6. UI Modern, Lega & Menggunakan Warna Korporat Emerald (#299775) & Slate
 * ============================================================
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useUser } from '../context/UserContext';
import { AttendanceRecord, ManpowerAbsence, Manpower } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  safeParseDate,
  toWibDate,
  getWibTimeParts,
  safeFormatTime,
  formatDurationHours,
  checkLateMinutesWib
} from '../lib/dateUtils';
import {
  ShieldCheck,
  Lock,
  Calendar,
  Users,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Building2,
  X,
  MessageSquare,
  Plus,
  Trash2,
  Timer,
  FileDown,
  ExternalLink,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

// ─── AKSES KETAT REKAP ──────────────────────────────────────────────────────────
export const ALLOWED_ATTENDANCE_ADMINS = ['zulfan', 'marsya'];

export function isAllowedAttendanceAdmin(username: string | null | undefined): boolean {
  if (!username) return false;
  return ALLOWED_ATTENDANCE_ADMINS.includes(username.trim().toLowerCase());
}

// ─── MASTER KARYAWAN RESMI PT AKSARA RIKSA PERDANA ─────────────────────────────
export interface MasterEmployee {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  division: string;
}

export const BASE_MASTER_EMPLOYEES: MasterEmployee[] = [
  { id: 'u1',  username: 'Angga',    fullName: 'Rama Regawa Sri Anggayana',       email: 'angga@aksarariksapjk3.com',    role: 'Leader & Ahli Utama', division: 'Ahli' },
  { id: 'u2',  username: 'Imam',     fullName: 'Lalu Imam Taufik Rahman Hidayat', email: 'imam@aksarariksapjk3.com',     role: 'Ahli Spesialis',      division: 'Ahli' },
  { id: 'u3',  username: 'Fauzan',   fullName: 'Fauzan Akmaluddin',               email: 'fauzan@aksarariksapjk3.com',   role: 'Ahli Spesialis',      division: 'Ahli' },
  { id: 'u4',  username: 'Fakhziar', fullName: 'Fakhziar Wildan Hidayat',         email: 'fakhziar@aksarariksapjk3.com', role: 'Ahli Spesialis',      division: 'Ahli' },
  { id: 'u5',  username: 'Fazar',    fullName: 'Muhammad Fazar Maulana',          email: 'fazar@aksarariksapjk3.com',    role: 'Ahli Spesialis',      division: 'Ahli' },
  { id: 'u6',  username: 'Demas',    fullName: 'Demas Cahyadi Ningrat',           email: 'demas@aksarariksapjk3.com',    role: 'Inspector Assistant', division: 'Ahli' },
  { id: 'u7',  username: 'Arya',     fullName: 'Arya Rizki Pratama',              email: 'arya@aksarariksapjk3.com',     role: 'Support Staff',       division: 'Admin' },
  { id: 'u8',  username: 'Rio',      fullName: 'Rio Andrian',                     email: 'rio@aksarariksapjk3.com',      role: 'Support Staff',       division: 'Admin' },
  { id: 'u9',  username: 'Aulia',    fullName: 'Aulia Zahra Dikrika',             email: 'aulia@aksarariksapjk3.com',    role: 'Support Staff',       division: 'Admin' },
  { id: 'u10', username: 'Disa',     fullName: 'Disa Liestianie Putri',           email: 'disa@aksarariksapjk3.com',     role: 'Support Staff',       division: 'Admin' },
  { id: 'u11', username: 'Marsya',   fullName: 'Marsya Aulia Rohman',             email: 'marsya@aksarariksapjk3.com',   role: 'Support Staff',       division: 'Admin' },
  { id: 'u12', username: 'Reyhan',   fullName: 'Reyhan Afril Julianto',           email: 'reyhan@aksarariksapjk3.com',   role: 'Support Staff',       division: 'Admin' },
  { id: 'u13', username: 'Zulfan',   fullName: 'Zulfan Rafly Baihaqi',            email: 'zulfan@aksarariksapjk3.com',   role: 'IT Staff',            division: 'IT' }
];

export const MASTER_EMPLOYEES = BASE_MASTER_EMPLOYEES;

export interface ManualAttendanceNote {
  id: string;
  employee_email: string;
  employee_name: string;
  date: string; // YYYY-MM-DD
  source: 'WhatsApp' | 'Surat' | 'Telepon' | 'Lisan';
  category: 'Dispensasi Keterlambatan' | 'Izin Dinas / Lapangan' | 'Shift Malam / Lembur' | 'Surat Dokter' | 'Lainnya';
  note: string;
  created_by: string;
  created_at: string;
}

// Helper hitung hari kerja (Senin - Jumat) dalam bulan terpilih
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

interface AttendanceRecapModuleProps {
  absences?: ManpowerAbsence[];
  manpowerList?: Manpower[];
  onClose?: () => void;
}

export interface EmployeeDailyDetail {
  date: string; // YYYY-MM-DD in WIB
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

export interface EmployeeRecap {
  email: string;
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
  const { activeUser, currentUser, activeUserEmail } = useUser();

  // Akses admin rekap (Zulfan, Marsya, atau IT role)
  const hasAccess = useMemo(() => {
    const email = (activeUserEmail || currentUser?.email || '').toLowerCase();
    const uname = (activeUser || currentUser?.username || '').toLowerCase();
    const role = (currentUser?.role || '').toLowerCase();
    return (
      ALLOWED_ATTENDANCE_ADMINS.includes(uname) ||
      email === 'zulfan@aksarariksapjk3.com' ||
      email === 'marsya@aksarariksapjk3.com' ||
      role.includes('it')
    );
  }, [activeUser, currentUser, activeUserEmail]);

  // State: Filter Bulan & Tahun
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [allAbsences, setAllAbsences] = useState<ManpowerAbsence[]>(absences);
  const [manualNotes, setManualNotes] = useState<ManualAttendanceNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Detail Modal Karyawan
  const [selectedEmployeeEmail, setSelectedEmployeeEmail] = useState<string | null>(null);

  // Modal Input Keterangan Manual (WhatsApp / Surat)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteFormEmail, setNoteFormEmail] = useState<string>('angga@aksarariksapjk3.com');
  const [noteFormDate, setNoteFormDate] = useState<string>(() => toWibDate(new Date().toISOString()));
  const [noteFormSource, setNoteFormSource] = useState<'WhatsApp' | 'Surat' | 'Telepon' | 'Lisan'>('WhatsApp');
  const [noteFormCategory, setNoteFormCategory] = useState<ManualAttendanceNote['category']>('Dispensasi Keterlambatan');
  const [noteFormText, setNoteFormText] = useState<string>('');
  const [savingNote, setSavingNote] = useState(false);

  // ── 1. LOAD CATATAN MANUAL ───────────────────────────────────────────────────
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

  // ── 2. LOAD DATA DARI SUPABASE (SINGLE SOURCE OF TRUTH) ──────────────────────
  const loadAllAttendanceData = useCallback(async () => {
    if (!hasAccess) return;
    setLoading(true);

    try {
      let records: AttendanceRecord[] = [];
      let absData: ManpowerAbsence[] = [...absences];

      if (isSupabaseConfigured && supabase) {
        try {
          const [attRes, absRes] = await Promise.all([
            supabase
              .from('attendance_logs')
              .select('*')
              .order('timestamp', { ascending: false })
              .limit(5000),
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
          console.warn('[AttendanceRecap] Supabase fetch warning:', e);
        }
      }

      // Fallback merge dari LocalStorage (jika ada data offline/baru)
      try {
        const localRaw = localStorage.getItem('local_attendance_logs');
        if (localRaw) {
          const localRecords: AttendanceRecord[] = JSON.parse(localRaw);
          const existingKeys = new Set(
            records.map(r => `${(r.employee_email || '').toLowerCase()}_${r.type}_${toWibDate(r.timestamp)}`)
          );
          localRecords.forEach(lr => {
            const key = `${(lr.employee_email || '').toLowerCase()}_${lr.type}_${toWibDate(lr.timestamp)}`;
            if (!existingKeys.has(key)) {
              records.push(lr);
              existingKeys.add(key);
            }
          });
        }
      } catch (e) {}

      setAllRecords(records);
      setAllAbsences(absData);
      loadManualNotes();
    } catch (err) {
      console.error('[AttendanceRecap] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [hasAccess, absences, loadManualNotes]);

  useEffect(() => {
    loadAllAttendanceData();
  }, [loadAllAttendanceData]);

  // ── 3. ROSTER DINAMIS KARYAWAN ───────────────────────────────────────────────
  // Menggabungkan BASE_MASTER_EMPLOYEES + manpowerList + unique email di log absensi
  const dynamicRoster = useMemo<MasterEmployee[]>(() => {
    const map = new Map<string, MasterEmployee>();

    // A. 13 Karyawan Inti PT Aksara Riksa Perdana
    BASE_MASTER_EMPLOYEES.forEach(emp => {
      map.set(emp.email.toLowerCase(), { ...emp });
    });

    // B. Tambahkan dari manpowerList jika ada nama baru
    (manpowerList || []).forEach(mp => {
      const generatedEmail = (mp as any).email || `${mp.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@aksarariksapjk3.com`;
      const emailLower = generatedEmail.toLowerCase();
      if (!map.has(emailLower)) {
        map.set(emailLower, {
          id: mp.id,
          username: mp.name.split(' ')[0],
          fullName: mp.name,
          email: emailLower,
          role: mp.role || 'Tenaga Ahli',
          division: (mp as any).division || (mp.status === 'internal' ? 'Ahli' : 'Eksternal')
        });
      }
    });

    // C. Pindai attendance_logs untuk menangkap karyawan aktif lain pada periode ini
    allRecords.forEach(rec => {
      const email = (rec.employee_email || '').trim().toLowerCase();
      if (email && !map.has(email)) {
        const empName = rec.employee_name || email.split('@')[0];
        const capName = empName.charAt(0).toUpperCase() + empName.slice(1);
        map.set(email, {
          id: 'dyn_' + email,
          username: capName.split(' ')[0],
          fullName: capName,
          email: email,
          role: 'Staff Operasional',
          division: 'Umum'
        });
      }
    });

    return Array.from(map.values());
  }, [manpowerList, allRecords]);

  // ── 4. KALKULASI REKAPITULASI, DEDUPLIKASI HARIAN & TOTAL (SINGLE SOURCE OF TRUTH) ──
  const { recapData, totals, workingDays, monthStr } = useMemo(() => {
    const wd = getWorkingDaysInMonth(selectedYear, selectedMonth);
    const mStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

    // Filter log presensi sesuai bulan yang dipilih (berdasarkan tanggal WIB)
    const monthRecords = allRecords.filter(rec => {
      const dateWib = toWibDate(rec.timestamp);
      return dateWib.startsWith(mStr);
    });

    // Inisialisasi map rekap per email
    const recapMap: Record<string, EmployeeRecap> = {};
    dynamicRoster.forEach(emp => {
      recapMap[emp.email.toLowerCase()] = {
        email: emp.email.toLowerCase(),
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

    // Pengelompokan log harian per karyawan (Key: email -> dateWib -> { masuk: [], pulang: [] })
    const empDailyLogs: Record<string, Record<string, { masuk: AttendanceRecord[]; pulang: AttendanceRecord[] }>> = {};

    monthRecords.forEach(rec => {
      let email = (rec.employee_email || '').trim().toLowerCase();

      // Normalisasi jika email kosong tapi nama cocok dengan master
      if (!email && rec.employee_name) {
        const lowerName = rec.employee_name.toLowerCase();
        const found = dynamicRoster.find(e =>
          e.fullName.toLowerCase() === lowerName ||
          e.username.toLowerCase() === lowerName ||
          lowerName.includes(e.username.toLowerCase())
        );
        if (found) email = found.email.toLowerCase();
      }
      if (!email || !recapMap[email]) return;

      const dateWib = toWibDate(rec.timestamp);
      if (!dateWib) return;

      if (!empDailyLogs[email]) empDailyLogs[email] = {};
      if (!empDailyLogs[email][dateWib]) {
        empDailyLogs[email][dateWib] = { masuk: [], pulang: [] };
      }

      if (rec.type === 'Masuk') {
        empDailyLogs[email][dateWib].masuk.push(rec);
      } else if (rec.type === 'Pulang') {
        empDailyLogs[email][dateWib].pulang.push(rec);
      }
    });

    // ── DEDUPLIKASI OTOMATIS: 1 MASUK AWAL & 1 PULANG AKHIR PER TANGGAL WIB ──
    Object.keys(empDailyLogs).forEach(email => {
      const r = recapMap[email];
      if (!r) return;
      const days = empDailyLogs[email];

      Object.keys(days).sort().forEach(dateWib => {
        const day = days[dateWib];
        // Sort masuk ascending (paling awal di atas)
        day.masuk.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        // Sort pulang descending (paling akhir di atas)
        day.pulang.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const earliestMasuk = day.masuk[0] || null;
        const latestPulang = day.pulang[0] || null;

        if (!r.dailyDetails[dateWib]) {
          r.dailyDetails[dateWib] = {
            date: dateWib,
            durationMs: 0,
            lateMinutes: 0,
            isLate: false,
            notes: []
          };
        }
        const dayDet = r.dailyDetails[dateWib];

        // 1. Catat Masuk Pertama
        if (earliestMasuk) {
          r.masuk++;
          r.uniqueDaysHadir.add(dateWib);
          dayDet.masukTime = earliestMasuk.timestamp;

          const mode = earliestMasuk.work_location_type || 'Kantor';
          dayDet.workLocationType = mode;
          if (mode === 'On Site') r.onSite++;
          else if (mode === 'WFH') r.wfh++;
          else r.kantor++;

          // Hitung keterlambatan (Masuk > 09:00 WIB)
          const lateMin = checkLateMinutesWib(earliestMasuk.timestamp);
          if (lateMin > 0) {
            dayDet.isLate = true;
            dayDet.lateMinutes = lateMin;
            r.lateCount++;
          }
        }

        // 2. Catat Pulang Terakhir
        if (latestPulang) {
          r.pulang++;
          dayDet.pulangTime = latestPulang.timestamp;
          if (!dayDet.workLocationType) {
            dayDet.workLocationType = latestPulang.work_location_type || 'Kantor';
          }
        }

        // 3. Pasangkan Durasi Kerja (Masuk Pertama -> Pulang Terakhir)
        if (earliestMasuk && latestPulang) {
          const mskMs = new Date(earliestMasuk.timestamp).getTime();
          const plgMs = new Date(latestPulang.timestamp).getTime();
          const diffMs = plgMs - mskMs;
          // Durasi valid: lebih dari 0 dan maksimal 24 jam
          if (diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000) {
            dayDet.durationMs = diffMs;
            r.totalWorkingMs += diffMs;
          }
        }
      });
    });

    // ── HUBUNGKAN ABSENCES (SAKIT / CUTI / IZIN) ──
    allAbsences.forEach(abs => {
      const dateWib = toWibDate(abs.date);
      if (!dateWib || !dateWib.startsWith(mStr)) return;

      const mp = (manpowerList || []).find(m => m.id === abs.manpower_id);
      let email = '';
      if (mp) {
        const found = dynamicRoster.find(e =>
          e.fullName.toLowerCase() === mp.name.toLowerCase() ||
          e.username.toLowerCase() === mp.name.toLowerCase()
        );
        if (found) email = found.email.toLowerCase();
      }
      if (!email || !recapMap[email]) return;

      const r = recapMap[email];
      const jenis = abs.absence_type;
      if (jenis === 'Sakit') r.sakit++;
      else if (jenis === 'Cuti') r.cuti++;
      else if (jenis === 'Izin') r.izin++;

      if (!r.dailyDetails[dateWib]) {
        r.dailyDetails[dateWib] = {
          date: dateWib,
          durationMs: 0,
          lateMinutes: 0,
          isLate: false,
          notes: []
        };
      }
      r.dailyDetails[dateWib].absenceType = jenis;
      r.dailyDetails[dateWib].absenceReason = abs.reason;
    });

    // ── HUBUNGKAN CATATAN MANUAL WA / SURAT ──
    manualNotes.forEach(n => {
      const dateWib = toWibDate(n.date);
      if (!dateWib || !dateWib.startsWith(mStr)) return;

      let email = (n.employee_email || '').trim().toLowerCase();
      if (!email && n.employee_name) {
        const found = dynamicRoster.find(e =>
          e.fullName.toLowerCase() === n.employee_name.toLowerCase() ||
          e.username.toLowerCase() === n.employee_name.toLowerCase()
        );
        if (found) email = found.email.toLowerCase();
      }
      if (!email || !recapMap[email]) return;

      const r = recapMap[email];
      r.manualNotesCount++;

      if (!r.dailyDetails[dateWib]) {
        r.dailyDetails[dateWib] = {
          date: dateWib,
          durationMs: 0,
          lateMinutes: 0,
          isLate: false,
          notes: []
        };
      }
      r.dailyDetails[dateWib].notes.push(n);
    });

    // ── FINALISASI REKAP LIST & EVALUASI KEHADIRAN ──
    const recapList: EmployeeRecap[] = dynamicRoster.map(emp => {
      const r = recapMap[emp.email.toLowerCase()];
      const hariHadir = r.uniqueDaysHadir.size;
      const pct = wd > 0 ? Math.min(hariHadir / wd, 1) : 0;
      r.percentHadir = pct;

      // Evaluasi status kehadiran
      if (r.sakit > 0 && r.cuti > 0) r.status = `Sakit ${r.sakit}h + Cuti ${r.cuti}h`;
      else if (r.sakit > 0) r.status = `Sakit (${r.sakit}h)`;
      else if (r.cuti > 0) r.status = `Cuti (${r.cuti}h)`;
      else if (r.izin > 0) r.status = `Izin (${r.izin}h)`;
      else if (r.masuk === 0) r.status = 'Belum Ada Data';
      else if (r.lateCount > 0) r.status = `Terlambat ${r.lateCount}x`;
      else if (pct >= 0.9) r.status = 'Hadir Tertib';
      else r.status = 'Hadir';

      return r;
    });

    // ── TOTAL KESELURUHAN (DIHITUNG DENGAN REDUCE DARI RECAPLIST LANGSUNG) ──
    const computedTotals = {
      masuk: recapList.reduce((acc, e) => acc + e.masuk, 0),
      pulang: recapList.reduce((acc, e) => acc + e.pulang, 0),
      sakit: recapList.reduce((acc, e) => acc + e.sakit, 0),
      cuti: recapList.reduce((acc, e) => acc + e.cuti, 0),
      izin: recapList.reduce((acc, e) => acc + e.izin, 0),
      kantor: recapList.reduce((acc, e) => acc + e.kantor, 0),
      onSite: recapList.reduce((acc, e) => acc + e.onSite, 0),
      wfh: recapList.reduce((acc, e) => acc + e.wfh, 0),
      late: recapList.reduce((acc, e) => acc + e.lateCount, 0),
      totalWorkingDuration: formatDurationHours(recapList.reduce((acc, e) => acc + e.totalWorkingMs, 0)),
      avgPercent: recapList.length > 0 ? recapList.reduce((acc, e) => acc + e.percentHadir, 0) / recapList.length : 0
    };

    return {
      recapData: recapList,
      totals: computedTotals,
      workingDays: wd,
      monthStr: mStr
    };
  }, [allRecords, allAbsences, manualNotes, selectedYear, selectedMonth, dynamicRoster, manpowerList]);

  // Data detail karyawan terpilih
  const selectedEmpData = useMemo(() => {
    if (!selectedEmployeeEmail) return null;
    return recapData.find(e => e.email.toLowerCase() === selectedEmployeeEmail.toLowerCase()) || null;
  }, [selectedEmployeeEmail, recapData]);

  // ── 5. EKSPOR PDF RESMI (8 KOLOM BERSIH & PROPORSIONAL) ──────────────────────
  const handleExportTeamPdf = () => {
    try {
      setExportingPdf(true);
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const periodTitle = `${BULAN_INDO[selectedMonth]} ${selectedYear}`;

      // Kop Surat Resmi PT AKSARA RIKSA PERDANA (Lebar 297mm)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(41, 151, 117); // Corporate Emerald #299775
      doc.text('PT AKSARA RIKSA PERDANA', 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text('PJK3 Bidang Pemeriksaan dan Pengujian Teknik K3', 14, 20);

      // Kanan: Judul Laporan & Periode
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      const titleText = 'REKAPITULASI PRESENSI & JAM KERJA';
      doc.text(titleText, 283 - doc.getTextWidth(titleText), 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const subTitleText = `Periode: ${periodTitle} (${workingDays} Hari Kerja)`;
      doc.text(subTitleText, 283 - doc.getTextWidth(subTitleText), 20);

      // Garis Pembatas Kop
      doc.setDrawColor(41, 151, 117);
      doc.setLineWidth(0.6);
      doc.line(14, 23, 283, 23);

      // Bar Ringkasan Metrik
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(14, 26, 269, 11, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('RINGKASAN TIM:', 18, 33.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Total Personel:', 48, 33.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${recapData.length} Orang`, 68, 33.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Total Kehadiran:', 88, 33.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 151, 117); // emerald
      doc.text(`${totals.masuk} Masuk / ${totals.pulang} Pulang`, 110, 33.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Keterlambatan:', 155, 33.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38); // rose
      doc.text(`${totals.late} Kali`, 178, 33.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Total Durasi Kerja:', 195, 33.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(2, 132, 199); // sky
      doc.text(`${totals.totalWorkingDuration}`, 223, 33.5);

      // ── 8 KOLOM UTAMA BERSIH ──
      const headers = [
        ['NO', 'NAMA KARYAWAN & DIVISI', 'KEHADIRAN\n(MSK / PLG)', 'TERLAMBAT', 'LOKASI\n(KTR / SITE)', 'DURASI KERJA', '% HADIR', 'STATUS / CATATAN']
      ];

      const rows = recapData.map((emp, idx) => {
        const durStr = formatDurationHours(emp.totalWorkingMs);
        const pctStr = emp.percentHadir > 0 ? `${(emp.percentHadir * 100).toFixed(1)}%` : '0%';
        const lateStr = emp.lateCount > 0 ? `${emp.lateCount}x` : '0';
        const cleanName = `${emp.fullName}\n${emp.division} • ${emp.role}`;
        const noteStr = emp.manualNotesCount > 0 ? `${emp.status} (${emp.manualNotesCount} catatan WA/Surat)` : emp.status;

        return [
          String(idx + 1),
          cleanName,
          `${emp.masuk} / ${emp.pulang}`,
          lateStr,
          `${emp.kantor} / ${emp.onSite}`,
          durStr,
          pctStr,
          noteStr
        ];
      });

      const footerRow = [
        '',
        'TOTAL KESELURUHAN',
        `${totals.masuk} / ${totals.pulang}`,
        `${totals.late}x`,
        `${totals.kantor} / ${totals.onSite}`,
        totals.totalWorkingDuration,
        `${(totals.avgPercent * 100).toFixed(1)}%`,
        '-'
      ];

      autoTable(doc, {
        startY: 40,
        head: headers,
        body: rows,
        foot: [footerRow],
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2.2,
          overflow: 'linebreak',
          valign: 'middle',
          font: 'helvetica'
        },
        headStyles: {
          fillColor: [30, 41, 59], // Slate-800
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'center'
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 70, halign: 'left', fontStyle: 'bold' },
          2: { cellWidth: 28, halign: 'center' },
          3: { cellWidth: 24, halign: 'center' },
          4: { cellWidth: 28, halign: 'center' },
          5: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
          6: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
          7: { cellWidth: 52, halign: 'left' }
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

  // ── 6. EKSPOR KARTU DETAIL PRESENSI KARYAWAN (PORTRAIT A4) ───────────────────
  const handleExportIndividualPdf = (emp: EmployeeRecap) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const periodTitle = `${BULAN_INDO[selectedMonth]} ${selectedYear}`;

      // Kop
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(41, 151, 117);
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
      doc.setDrawColor(41, 151, 117);
      doc.setLineWidth(0.5);
      doc.line(14, 23, 196, 23);

      // Profil Karyawan Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 26, 182, 17, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`Nama: ${emp.fullName}`, 18, 32);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Jabatan: ${emp.role}  |  Divisi: ${emp.division}  |  Email: ${emp.email}`, 18, 38);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 151, 117);
      doc.text(`Hadir: ${emp.masuk} hr (${(emp.percentHadir * 100).toFixed(1)}%)`, 130, 32);
      doc.setTextColor(220, 38, 38);
      doc.text(`Telat: ${emp.lateCount}x`, 130, 38);
      doc.setTextColor(2, 132, 199);
      doc.text(`Durasi: ${formatDurationHours(emp.totalWorkingMs)}`, 158, 38);

      // Log Harian
      const sortedDaily = (Object.values(emp.dailyDetails) as EmployeeDailyDetail[])
        .sort((a, b) => a.date.localeCompare(b.date));

      const dailyHeaders = [['No', 'Tanggal (WIB)', 'Jam Masuk', 'Jam Pulang', 'Durasi', 'Ketepatan Waktu / Catatan']];
      const dailyRows = sortedDaily.map((d, i) => {
        const dObj = safeParseDate(d.date);
        const dayLabel = dObj
          ? dObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
          : d.date;

        const msk = d.masukTime ? safeFormatTime(d.masukTime) : '-';
        const plg = d.pulangTime ? safeFormatTime(d.pulangTime) : (d.masukTime ? '(Belum absen)' : '-');
        const dur = d.durationMs > 0 ? formatDurationHours(d.durationMs) : '0j 0m';

        let statusText = d.isLate ? `Terlambat ${d.lateMinutes} mnt` : (d.masukTime ? 'Tepat Waktu' : '-');
        if (d.absenceType) statusText = `${d.absenceType}: ${d.absenceReason || '-'}`;
        if (d.notes && d.notes.length > 0) {
          const notesStr = d.notes.map(n => `[${n.source}] ${n.note}`).join('; ');
          statusText += ` | ${notesStr}`;
        }

        return [String(i + 1), dayLabel, msk, plg, dur, statusText];
      });

      autoTable(doc, {
        startY: 46,
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
          fillColor: [30, 41, 59],
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

          const footerLeft = `Halaman ${data.pageNumber} dari ${totalPages} • PT Aksara Riksa Perdana`;
          doc.text(footerLeft, 14, 285);

          const today = new Date();
          const todayStr = `${today.getDate()} ${BULAN_INDO[today.getMonth()]} ${today.getFullYear()} ${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')} WIB`;
          const footerRight = `Dicetak oleh ${activeUser || 'Admin'} pada: ${todayStr}`;
          doc.text(footerRight, 196 - doc.getTextWidth(footerRight), 285);
        }
      });

      doc.save(`Presensi_${emp.fullName.replace(/\s+/g, '_')}_${periodTitle.replace(/\s+/g, '_')}.pdf`);
    } catch (err: any) {
      alert('Gagal mengekspor kartu presensi: ' + (err?.message || err));
    }
  };

  // ── 7. SIMPAN CATATAN MANUAL ────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!noteFormText.trim()) {
      alert('Harap isi keterangan/alasan konfirmasi.');
      return;
    }

    setSavingNote(true);
    const targetEmp = dynamicRoster.find(e => e.email.toLowerCase() === noteFormEmail.toLowerCase());
    const newNote: ManualAttendanceNote = {
      id: 'note_' + Date.now(),
      employee_email: noteFormEmail,
      employee_name: targetEmp ? targetEmp.fullName : noteFormEmail,
      date: noteFormDate,
      source: noteFormSource,
      category: noteFormCategory,
      note: noteFormText.trim(),
      created_by: activeUser || 'IT Admin',
      created_at: new Date().toISOString()
    };

    try {
      const updatedNotes = [newNote, ...manualNotes.filter(n => n.id !== newNote.id)];
      localStorage.setItem('attendance_manual_notes', JSON.stringify(updatedNotes));
      setManualNotes(updatedNotes);

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

  // Navigasi Bulan Cepat
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

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER: AKSES DITOLAK
  // ═════════════════════════════════════════════════════════════════════════════
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
            Fitur <strong>Rekapitulasi Presensi & Durasi Bekerja</strong> hanya dapat diakses oleh akun yang berwenang (Zulfan & Marsya / IT Admin).
          </p>
          <div className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-400 font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            <span>Restricted: IT & Management Only</span>
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

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER UTAMA: REKAPITULASI PRESENSI TIM (CLEAN, LEGA & CORPORATE EMERALD)
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Action Header */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-emerald-700 shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Rekapitulasi Presensi & Durasi Bekerja
                </h2>
                <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  <span>PT Aksara Riksa Perdana</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Single Source of Truth: Perhitungan jam kerja akurat (WIB), deduplikasi otomatis log ganda, dan sinkronisasi 100% dengan ekspor PDF.
              </p>
            </div>
          </div>

          {/* Action Bar: Filter Bulan/Tahun + Ekspor PDF + Catatan WA + Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Dropdown Bulan & Tahun */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-2xl p-1 text-xs">
              <button
                onClick={goToPrevMonth}
                className="p-1.5 hover:bg-white rounded-xl text-slate-600 transition-all cursor-pointer"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 py-1 px-1.5 focus:outline-none cursor-pointer"
              >
                {BULAN_INDO.map((b, idx) => (
                  <option key={b} value={idx}>{b}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 py-1 px-1.5 focus:outline-none cursor-pointer"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                onClick={goToNextMonth}
                className="p-1.5 hover:bg-white rounded-xl text-slate-600 transition-all cursor-pointer"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Tombol Ekspor PDF Rekapan Tim */}
            <button
              onClick={handleExportTeamPdf}
              disabled={exportingPdf || recapData.length === 0}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-2xl transition-all active:scale-95 cursor-pointer shadow-xs disabled:opacity-50"
              title="Ekspor Seluruh Rekapitulasi Presensi Tim ke Format PDF Resmi"
            >
              <FileDown className={`h-4 w-4 ${exportingPdf ? 'animate-bounce' : ''}`} />
              <span>{exportingPdf ? 'Mengekspor...' : 'Ekspor PDF'}</span>
            </button>

            {/* Tombol Input Keterangan Manual */}
            <button
              onClick={() => {
                setNoteFormEmail(dynamicRoster[0]?.email || 'angga@aksarariksapjk3.com');
                setNoteFormDate(toWibDate(new Date().toISOString()));
                setNoteFormText('');
                setIsNoteModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2.5 rounded-2xl transition-all active:scale-95 cursor-pointer shadow-xs"
              title="Input Keterangan Manual (WhatsApp / Surat)"
            >
              <MessageSquare className="h-3.5 w-3.5 text-slate-600" />
              <span>Input Keterangan</span>
            </button>

            <button
              onClick={loadAllAttendanceData}
              disabled={loading}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 text-slate-600 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-2xl border border-slate-200 text-slate-500 transition-all cursor-pointer"
                title="Tutup Rekapan"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Row (Single Source of Truth) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-emerald-50 p-2 rounded-xl text-emerald-700 border border-emerald-100">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Personel</span>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900">{recapData.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{workingDays} hari kerja ({BULAN_INDO[selectedMonth]} {selectedYear})</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-sky-50 p-2 rounded-xl text-sky-700 border border-sky-100">
              <Timer className="h-4 w-4" />
            </div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Akumulasi Jam Kerja</span>
          </div>
          <p className="text-xl font-black font-mono text-sky-700 truncate">{totals.totalWorkingDuration}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{totals.masuk} masuk / {totals.pulang} pulang</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-rose-50 p-2 rounded-xl text-rose-600 border border-rose-100">
              <Clock className="h-4 w-4" />
            </div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Keterlambatan</span>
          </div>
          <p className="text-2xl font-black font-mono text-rose-600">{totals.late} <span className="text-xs font-normal text-slate-400">kali</span></p>
          <p className="text-[10px] text-slate-400 mt-0.5">Masuk &gt; 09:00 WIB</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-indigo-50 p-2 rounded-xl text-indigo-700 border border-indigo-100">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sebaran Lokasi</span>
          </div>
          <p className="text-lg font-black font-mono text-slate-800">
            {totals.kantor} <span className="text-xs font-normal text-slate-400">Ktr</span> / {totals.onSite} <span className="text-xs font-normal text-slate-400">Site</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Rata-rata kehadiran: {(totals.avgPercent * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Main Table: 8 Clean Columns (Identik dengan Cetak PDF) */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-800">
              Rekapitulasi Presensi Tim: {BULAN_INDO[selectedMonth]} {selectedYear}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            💡 Klik baris karyawan untuk melihat rincian presensi harian atau mencetak kartu presensi individual.
          </span>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 text-emerald-600 animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Memuat dan menghitung rekapitulasi data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-3 py-3 text-center font-bold w-12">NO</th>
                  <th className="px-4 py-3 text-left font-bold min-w-[200px]">NAMA KARYAWAN & DIVISI</th>
                  <th className="px-3 py-3 text-center font-bold min-w-[120px]">KEHADIRAN (MSK / PLG)</th>
                  <th className="px-3 py-3 text-center font-bold w-24 text-rose-300">TERLAMBAT</th>
                  <th className="px-3 py-3 text-center font-bold min-w-[120px]">LOKASI (KTR / SITE)</th>
                  <th className="px-3 py-3 text-center font-bold min-w-[120px] text-sky-300">TOTAL DURASI</th>
                  <th className="px-3 py-3 text-center font-bold w-20">% HADIR</th>
                  <th className="px-4 py-3 text-left font-bold min-w-[160px]">STATUS / CATATAN</th>
                  <th className="px-3 py-3 text-center font-bold w-16">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {recapData.map((emp, idx) => {
                  const pctVal = emp.percentHadir * 100;
                  const pctColor = pctVal >= 90 ? 'text-emerald-700 font-black' :
                                   pctVal >= 70 ? 'text-amber-600 font-bold' :
                                   pctVal > 0  ? 'text-rose-500 font-bold' : 'text-slate-400';
                  const rowBg = idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white';
                  const durationStr = formatDurationHours(emp.totalWorkingMs);

                  return (
                    <tr
                      key={emp.email}
                      onClick={() => setSelectedEmployeeEmail(emp.email)}
                      className={`${rowBg} border-b border-slate-100 hover:bg-emerald-50/40 transition-colors cursor-pointer`}
                    >
                      <td className="px-3 py-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="px-4 py-3 text-left">
                        <p className="font-bold text-slate-900 text-xs">{emp.fullName}</p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {emp.division} • {emp.role}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-bold">
                        <span className="text-emerald-700">{emp.masuk}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-sky-700">{emp.pulang}</span>
                      </td>

                      {/* Indikator Terlambat */}
                      <td className="px-3 py-3 text-center">
                        {emp.lateCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold font-mono text-[10px] border border-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                            <span>{emp.lateCount}x</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono text-[10px] border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            <span>0</span>
                          </span>
                        )}
                      </td>

                      {/* Lokasi Kantor / Site */}
                      <td className="px-3 py-3 text-center font-mono text-slate-700">
                        <span>{emp.kantor}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span>{emp.onSite}</span>
                      </td>

                      {/* Total Durasi Jam Kerja */}
                      <td className="px-3 py-3 text-center font-mono font-bold text-slate-800">
                        {emp.totalWorkingMs > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
                            {durationStr}
                          </span>
                        ) : (
                          <span className="text-slate-300">0j 0m</span>
                        )}
                      </td>

                      {/* % Hadir */}
                      <td className={`px-3 py-3 text-center font-mono ${pctColor}`}>
                        {pctVal > 0 ? `${pctVal.toFixed(1)}%` : '0%'}
                      </td>

                      {/* Status & Catatan */}
                      <td className="px-4 py-3 text-left text-[11px]">
                        <p className="font-semibold text-slate-800">{emp.status}</p>
                        {emp.manualNotesCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 font-medium mt-0.5">
                            <MessageSquare className="h-3 w-3" />
                            <span>{emp.manualNotesCount} catatan WA/Surat</span>
                          </span>
                        )}
                      </td>

                      {/* Aksi Cepat Cetak / Detail */}
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleExportIndividualPdf(emp)}
                          title="Unduh Kartu Presensi Karyawan Ini"
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Footer Total Keseluruhan (Single Source of Truth) */}
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs">
                  <td colSpan={2} className="px-4 py-3 text-center text-slate-800 uppercase tracking-wider">
                    TOTAL KESELURUHAN
                  </td>
                  <td className="px-3 py-3 text-center font-mono font-black text-slate-900">
                    <span className="text-emerald-700">{totals.masuk}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-sky-700">{totals.pulang}</span>
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-rose-600">{totals.late}x</td>
                  <td className="px-3 py-3 text-center font-mono text-slate-800">
                    {totals.kantor} / {totals.onSite}
                  </td>
                  <td className="px-3 py-3 text-center font-mono font-bold text-sky-800">{totals.totalWorkingDuration}</td>
                  <td className="px-3 py-3 text-center font-mono font-black text-emerald-700">
                    {(totals.avgPercent * 100).toFixed(1)}%
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-slate-500 text-[10px]">
                    S: {totals.sakit} | C: {totals.cuti} | I: {totals.izin}
                  </td>
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
                <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-black flex items-center justify-center text-base">
                  {selectedEmpData.fullName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedEmpData.fullName}</h3>
                  <p className="text-xs text-slate-500">
                    {selectedEmpData.division} • {selectedEmpData.role} • {selectedEmpData.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmployeeEmail(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick KPI Karyawan Ini */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-emerald-700 font-bold block">HADIR</span>
                <span className="text-lg font-black font-mono text-emerald-900">{selectedEmpData.masuk} hr</span>
              </div>
              <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-sky-700 font-bold block">DURASI KERJA</span>
                <span className="text-lg font-black font-mono text-sky-900">{formatDurationHours(selectedEmpData.totalWorkingMs)}</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-rose-700 font-bold block">TELAT</span>
                <span className="text-lg font-black font-mono text-rose-900">{selectedEmpData.lateCount}x</span>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-indigo-700 font-bold block">KET. WA/SURAT</span>
                <span className="text-lg font-black font-mono text-indigo-900">{selectedEmpData.manualNotesCount}</span>
              </div>
            </div>

            {/* Log Harian Kehadiran */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Rincian Log Harian ({BULAN_INDO[selectedMonth]} {selectedYear}):
              </h4>

              {Object.keys(selectedEmpData.dailyDetails).length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Tidak ada catatan presensi pada periode bulan ini.
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
                            <div className="flex items-center justify-between text-[11px] text-slate-600 bg-white/90 p-2 rounded-xl border border-slate-100">
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
                                    <span className="font-bold underline uppercase">[{n.source}]</span>: {n.note}
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

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setNoteFormEmail(selectedEmpData.email);
                    setNoteFormDate(toWibDate(new Date().toISOString()));
                    setNoteFormText('');
                    setIsNoteModalOpen(true);
                  }}
                  className="text-xs font-bold px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Keterangan</span>
                </button>

                <button
                  onClick={() => handleExportIndividualPdf(selectedEmpData)}
                  className="text-xs font-bold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer flex items-center gap-1.5"
                  title="Unduh Kartu Detail Presensi Karyawan Ini (PDF)"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span>Unduh Kartu Presensi (PDF)</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedEmployeeEmail(null)}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Tutup
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
                  value={noteFormEmail}
                  onChange={(e) => setNoteFormEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {dynamicRoster.map(e => (
                    <option key={e.email} value={e.email}>
                      {e.fullName} ({e.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tanggal Kejadian (WIB):</label>
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
                <label className="font-bold text-slate-700 block mb-1">Isi Catatan Konfirmasi:</label>
                <textarea
                  rows={3}
                  value={noteFormText}
                  onChange={(e) => setNoteFormText(e.target.value)}
                  placeholder="Contoh: Karyawan mengabari via WhatsApp pukul 08:30 bahwa armada operasional mengalami kendala di jalan tol."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-500">
                🔒 Dicatat oleh: <strong>{activeUser || 'IT Admin'}</strong>. Catatan ini akan otomatis terlampir pada rincian harian karyawan.
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