import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { AttendanceType, AttendanceRecord, Manpower, ManpowerAbsence } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Camera,
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  ShieldCheck,
  ExternalLink,
  Calendar,
  RotateCcw,
  Send,
  Navigation,
  Sparkles,
  Info,
  Check,
  ArrowRight,
  ClipboardList
} from 'lucide-react';

interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface AttendanceModuleProps {
  absences?: ManpowerAbsence[];
  manpowerList?: Manpower[];
  onOpenManpowerMgmt?: () => void;
}

export default function AttendanceModule({
  absences = [],
  manpowerList = [],
  onOpenManpowerMgmt
}: AttendanceModuleProps) {
  const { activeUser, activeUserEmail, currentUser } = useUser();

  // Absensi selection: Strictly 'Masuk' or 'Pulang' (Sakit & Cuti are managed in Kelola Manpower)
  const [attendanceType, setAttendanceType] = useState<'Masuk' | 'Pulang'>('Masuk');
  
  // Camera & Image state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // GPS state
  const [coords, setCoords] = useState<Coords | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Live time ticker
  const [now, setNow] = useState(new Date());

  // Submit & History state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // GAS Web App URL from environment or default deployment
  const gasUrl = import.meta.env.VITE_GAS_ATTENDANCE_URL || 'https://script.google.com/macros/s/AKfycbyiadDMZ26IN47tohPSUNnv_Bsj4mzuTJOf9Z8fhWgm8C4EmyLISB1XwHbbW_EqMPwr/exec';

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Office schedule rules:
  // Senin - Jumat: 09:00 - 17:00 WIB
  // Sabtu: 09:00 - 14:00 WIB
  const isSaturday = now.getDay() === 6;
  const targetMasukLabel = '09:00 WIB';
  const targetPulangLabel = isSaturday ? '14:00 WIB' : '17:00 WIB';

  // Helper to format local YYYY-MM-DD
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString(now);

  // Cross-check with Kelola Manpower absences (Sakit, Cuti, Izin)
  const currentManpower = manpowerList.find(
    (m) => m.name.toLowerCase() === (activeUser || '').toLowerCase()
  );

  const todayOfficialLeave = absences.find(
    (a) => a.manpower_id === currentManpower?.id && a.date === todayStr
  );

  // Check attendance records done today by active user
  const userTodayRecords = history.filter((r) => {
    try {
      const recDate = getLocalDateString(new Date(r.timestamp));
      const matchEmail = Boolean(r.employee_email && activeUserEmail && r.employee_email.toLowerCase() === activeUserEmail.toLowerCase());
      const matchName = Boolean(r.employee_name && activeUser && r.employee_name.toLowerCase() === activeUser.toLowerCase());
      return recDate === todayStr && (matchEmail || matchName);
    } catch (e) {
      return false;
    }
  });

  const todayMasuk = userTodayRecords.find((r) => r.type === 'Masuk');
  const todayPulang = userTodayRecords.find((r) => r.type === 'Pulang');

  const formatTimeOnly = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    } catch {
      return '';
    }
  };

  // Helper to check punctuality border color (subtle visual indicator, polite tone)
  const getPunctualityStyle = (type: AttendanceType, timestampStr?: string) => {
    if (!timestampStr) return null;
    try {
      const d = new Date(timestampStr);
      const isSat = d.getDay() === 6;
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const totalMinutes = hours * 60 + minutes;

      if (type === 'Masuk') {
        // Target: <= 09:00 WIB (540 minutes)
        const isGood = totalMinutes <= 9 * 60;
        return {
          isGood,
          border: isGood ? 'border-emerald-500' : 'border-rose-400',
          bg: isGood ? 'bg-emerald-50/50' : 'bg-rose-50/40',
          dot: isGood ? 'bg-emerald-500' : 'bg-rose-500',
          badge: isGood ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200',
          cardBorder: isGood ? 'border-emerald-500/80 shadow-emerald-500/10' : 'border-rose-400/90 shadow-rose-500/10'
        };
      }

      if (type === 'Pulang') {
        // Target: >= 14:00 on Saturday (840 min), >= 17:00 on Mon-Fri (1020 min)
        const targetMin = isSat ? 14 * 60 : 17 * 60;
        const isGood = totalMinutes >= targetMin;
        return {
          isGood,
          border: isGood ? 'border-emerald-500' : 'border-rose-400',
          bg: isGood ? 'bg-emerald-50/50' : 'bg-rose-50/40',
          dot: isGood ? 'bg-emerald-500' : 'bg-rose-500',
          badge: isGood ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200',
          cardBorder: isGood ? 'border-emerald-500/80 shadow-emerald-500/10' : 'border-rose-400/90 shadow-rose-500/10'
        };
      }

      return {
        isGood: true,
        border: 'border-amber-400',
        bg: 'bg-amber-50/50',
        dot: 'bg-amber-500',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        cardBorder: 'border-amber-400'
      };
    } catch {
      return null;
    }
  };

  const masukStyle = getPunctualityStyle('Masuk', todayMasuk?.timestamp);
  const pulangStyle = getPunctualityStyle('Pulang', todayPulang?.timestamp);

  // Auto-switch default attendanceType to 'Pulang' if 'Masuk' is already done today
  useEffect(() => {
    if (todayMasuk && !todayPulang && attendanceType === 'Masuk') {
      setAttendanceType('Pulang');
    }
  }, [todayMasuk, todayPulang, attendanceType]);

  // Check if selected type is already done today
  const isSelectedTypeAlreadyDone = Boolean(
    (attendanceType === 'Masuk' && todayMasuk) ||
    (attendanceType === 'Pulang' && todayPulang)
  );

  const getAlreadyDoneMessage = () => {
    if (attendanceType === 'Masuk' && todayMasuk) {
      return `Anda sudah melakukan Absen Masuk hari ini pada pukul ${formatTimeOnly(todayMasuk.timestamp)}. Absen Masuk hanya bisa dilakukan 1 kali per hari.`;
    }
    if (attendanceType === 'Pulang' && todayPulang) {
      return `Anda sudah melakukan Absen Pulang hari ini pada pukul ${formatTimeOnly(todayPulang.timestamp)}. Absen Pulang hanya bisa dilakukan 1 kali per hari.`;
    }
    return null;
  };

  // Request GPS Location
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation tidak didukung oleh browser Anda.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        });
        setGpsLoading(false);
      },
      (err) => {
        let msg = 'Gagal mendeteksi lokasi GPS.';
        if (err.code === 1) msg = 'Izin lokasi (GPS) ditolak. Harap izinkan akses lokasi di browser untuk absen.';
        else if (err.code === 2) msg = 'Sinyal GPS tidak tersedia atau tidak akurat.';
        else if (err.code === 3) msg = 'Waktu permintaan GPS habis (timeout).';
        setGpsError(msg);
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    );
  }, []);

  // Start front camera stream
  const startCamera = async () => {
    setCameraError(null);
    setCapturedImage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Kamera tidak didukung pada browser atau perangkat ini.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Front camera strictly
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('[Camera Error]', err);
      let msg = 'Tidak dapat mengakses kamera depan.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Izin akses kamera ditolak. Harap berikan izin kamera pada browser Anda.';
      } else if (err.name === 'NotFoundError') {
        msg = 'Kamera depan tidak ditemukan di perangkat ini.';
      }
      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  // Stop camera tracks
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Auto-init GPS and camera when module mounts
  useEffect(() => {
    requestLocation();
    startCamera();

    return () => {
      stopCamera();
    };
  }, [requestLocation]);

  // Capture photo from video and apply anti-cheat watermark
  const capturePhoto = () => {
    if (isSelectedTypeAlreadyDone) {
      setValidationError(getAlreadyDoneMessage());
      return;
    }

    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the camera frame
    ctx.drawImage(video, 0, 0, width, height);

    // Apply anti-cheat watermark bar at the bottom
    const barHeight = Math.max(75, Math.round(height * 0.16));
    const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
    gradient.addColorStop(0, 'rgba(15, 23, 42, 0.85)');
    gradient.addColorStop(1, 'rgba(2, 6, 23, 0.95)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - barHeight, width, barHeight);

    // Green indicator pill
    ctx.fillStyle = '#10B981';
    ctx.fillRect(16, height - barHeight + 14, 4, barHeight - 28);

    // Watermark Text styling
    const currentDate = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const currentTime = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' WIB';

    const empName = currentUser?.full_name || activeUser || 'Karyawan';
    const latStr = coords ? coords.latitude.toFixed(6) : '-';
    const lngStr = coords ? coords.longitude.toFixed(6) : '-';
    const accStr = coords ? `±${coords.accuracy}m` : '';

    // Line 1: User & Type
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${empName} [Absen ${attendanceType}]`, 28, height - barHeight + 24);

    // Line 2: Timestamp & GPS
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '11px monospace';
    ctx.fillText(`📅 ${currentDate} ${currentTime}`, 28, height - barHeight + 42);
    ctx.fillText(`📍 Lat: ${latStr}, Lng: ${lngStr} (${accStr})`, 28, height - barHeight + 58);

    // Branding stamp on right
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('PT AKSARA RIKSA MANDIRI', width - 20, height - barHeight + 26);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '9px monospace';
    ctx.fillText('RiksaSync AI • Verified GPS', width - 20, height - barHeight + 42);
    ctx.textAlign = 'left'; // reset

    // Convert to compressed JPEG data URL (~60-80KB)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);

    // Stop active camera preview to save battery/resources
    stopCamera();
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  // Fetch recent attendance history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('attendance_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(30);

        if (!error && data) {
          setHistory(data as AttendanceRecord[]);
          setHistoryLoading(false);
          return;
        }
      }

      // Fallback to local storage if supabase not available
      const local = localStorage.getItem('local_attendance_logs');
      if (local) {
        setHistory(JSON.parse(local));
      }
    } catch (e) {
      console.warn('[History Error]', e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Submit attendance record
  const handleSubmit = async () => {
    if (isSelectedTypeAlreadyDone) {
      alert(getAlreadyDoneMessage());
      return;
    }
    if (!capturedImage) {
      alert('Silakan ambil foto selfie terlebih dahulu.');
      return;
    }
    if (!coords) {
      alert('Lokasi GPS belum terdeteksi. Pastikan GPS aktif dan izin diberikan.');
      return;
    }

    setSubmitting(true);
    setSubmitSuccess(null);
    setValidationError(null);

    const empName = currentUser?.full_name || activeUser || 'Karyawan';
    const empEmail = activeUserEmail || `${(activeUser || 'user').toLowerCase()}@aksarariksapjk3.com`;
    const recordTimestamp = new Date().toISOString();

    const newRecord: AttendanceRecord = {
      employee_name: empName,
      employee_email: empEmail,
      type: attendanceType,
      timestamp: recordTimestamp,
      latitude: coords.latitude,
      longitude: coords.longitude,
      photo_drive_url: ''
    };

    let driveLink = '';

    // 1. Send to Google Apps Script (Drive + Sheets) if configured
    if (gasUrl) {
      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'submit_attendance',
            employee_name: empName,
            employee_email: empEmail,
            type: attendanceType,
            timestamp: recordTimestamp,
            latitude: coords.latitude,
            longitude: coords.longitude,
            photo_base64: capturedImage
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson && resJson.drive_url) {
            driveLink = resJson.drive_url;
            newRecord.photo_drive_url = driveLink;
          }
        }
      } catch (gasErr) {
        console.warn('[GAS Attendance Submission Warning]', gasErr);
      }
    }

    // 2. Save directly to Supabase attendance_logs for high availability
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('attendance_logs').insert([
          {
            employee_name: empName,
            employee_email: empEmail,
            type: attendanceType,
            timestamp: recordTimestamp,
            latitude: coords.latitude,
            longitude: coords.longitude,
            photo_drive_url: driveLink || null
          }
        ]);
      } catch (sbErr) {
        console.warn('[Supabase Attendance Log Insert Warning]', sbErr);
      }
    }

    // 3. Save to localStorage fallback
    try {
      const existing = JSON.parse(localStorage.getItem('local_attendance_logs') || '[]');
      const updated = [newRecord, ...existing.slice(0, 49)];
      localStorage.setItem('local_attendance_logs', JSON.stringify(updated));
      setHistory(updated);
    } catch (e) {}

    setSubmitting(false);
    setSubmitSuccess(`Presensi ${attendanceType} berhasil dicatat pada ${now.toLocaleTimeString('id-ID')} WIB!`);

    // Reset captured photo and reload history
    setCapturedImage(null);
    loadHistory();
    startCamera();
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-16 md:pb-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Presensi & Kehadiran Lapangan</span>
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight mt-1 flex items-center gap-2">
            <span>Absensi Mandiri</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {currentUser?.division || 'Divisi Ahli/Admin'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kamera depan live selfie + koordinat GPS terverifikasi watermark anti-manipulasi.
          </p>
        </div>

        {/* Realtime clock display */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl self-start md:self-auto">
          <Clock className="h-5 w-5 text-emerald-600 animate-spin-slow shrink-0" />
          <div>
            <div className="text-xs font-mono font-black text-slate-800 leading-none">
              {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5">
              {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Official Leave Notice (Connected with Kelola Manpower) */}
      {todayOfficialLeave && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-start sm:items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-base shrink-0">
              🏖️
            </div>
            <div>
              <p className="text-xs font-black">
                Status Resmi Hari Ini: {todayOfficialLeave.absence_type} ({todayOfficialLeave.date})
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Keterangan: {todayOfficialLeave.reason || 'Tercatat di modul Kelola Manpower'}. Anda tidak diwajibkan melakukan absensi selfie.
              </p>
            </div>
          </div>
          {onOpenManpowerMgmt && (
            <button
              onClick={onOpenManpowerMgmt}
              className="text-xs font-bold text-amber-900 bg-white hover:bg-amber-100/70 px-3.5 py-1.5 rounded-xl border border-amber-300 transition-all shadow-2xs cursor-pointer self-start sm:self-auto shrink-0"
            >
              Lihat di Kelola Manpower
            </button>
          )}
        </div>
      )}

      {/* Office Hours Info Bar (Polite, Professional Tone) */}
      <div className="bg-white border border-slate-200/90 px-4 py-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-slate-600">
            Jam Kantor: <strong className="text-slate-800 font-bold">Senin–Jumat (09:00 – 17:00 WIB)</strong> • <strong className="text-slate-800 font-bold">Sabtu (09:00 – 14:00 WIB)</strong>
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block shadow-xs" />
            <span>Sesuai Jam Operasional</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400 inline-block shadow-xs" />
            <span>Di Luar Jam Operasional</span>
          </span>
        </div>
      </div>

      {/* Success Notification */}
      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between text-emerald-800 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">{submitSuccess}</p>
              <p className="text-[10px] text-emerald-600">Data presensi telah tersimpan di server.</p>
            </div>
          </div>
          <button
            onClick={() => setSubmitSuccess(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1 rounded-lg hover:bg-emerald-100/60 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Validation / Already Done Error Warning */}
      {validationError && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-amber-800 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">Peringatan Presensi</p>
              <p className="text-[11px] text-amber-700 mt-0.5">{validationError}</p>
            </div>
          </div>
          <button
            onClick={() => setValidationError(null)}
            className="text-xs text-amber-700 hover:text-amber-900 font-bold px-2 py-1 rounded-lg hover:bg-amber-100/60 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Grid: Left = Camera & Submit, Right = Status & Riwayat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Camera & Form */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Status Presensi Hari Ini (Daily Status Card with Smart Border Indicators) */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-4 rounded-2xl text-white shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Status Kehadiran Hari Ini ({todayStr})
              </span>
              <span className="text-[10px] text-slate-300 font-semibold">{currentUser?.full_name || activeUser}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Masuk Status Card with Dynamic Punctuality Border */}
              <div className={`p-3 rounded-xl border transition-all ${
                todayMasuk
                  ? `${masukStyle?.cardBorder || 'border-emerald-500'} bg-slate-800/80`
                  : 'bg-slate-800/40 border-slate-700/60'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Absen Masuk (09:00)</span>
                  {todayMasuk ? (
                    <span className={`h-2.5 w-2.5 rounded-full ${masukStyle?.dot || 'bg-emerald-400'}`} />
                  ) : (
                    <span className="text-[10px] text-slate-400">⏳</span>
                  )}
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className={`text-sm font-bold font-mono ${
                    todayMasuk ? (masukStyle?.isGood ? 'text-emerald-300' : 'text-rose-300') : 'text-slate-400 text-xs font-normal'
                  }`}>
                    {todayMasuk ? formatTimeOnly(todayMasuk.timestamp) : 'Belum Absen'}
                  </span>
                  {todayMasuk && (
                    <span className="text-[9px] text-slate-400">Tercatat</span>
                  )}
                </div>
              </div>

              {/* Pulang Status Card with Dynamic Punctuality Border */}
              <div className={`p-3 rounded-xl border transition-all ${
                todayPulang
                  ? `${pulangStyle?.cardBorder || 'border-emerald-500'} bg-slate-800/80`
                  : 'bg-slate-800/40 border-slate-700/60'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Absen Pulang ({targetPulangLabel.split(' ')[0]})</span>
                  {todayPulang ? (
                    <span className={`h-2.5 w-2.5 rounded-full ${pulangStyle?.dot || 'bg-emerald-400'}`} />
                  ) : (
                    <span className="text-[10px] text-slate-400">⏳</span>
                  )}
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className={`text-sm font-bold font-mono ${
                    todayPulang ? (pulangStyle?.isGood ? 'text-emerald-300' : 'text-rose-300') : 'text-slate-400 text-xs font-normal'
                  }`}>
                    {todayPulang ? formatTimeOnly(todayPulang.timestamp) : 'Belum Absen'}
                  </span>
                  {todayPulang && (
                    <span className="text-[9px] text-slate-400">Tercatat</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 1. Selection Buttons: Strictly 2 Buttons (Masuk & Pulang) */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 block">Presensi Harian</label>
                <span className="text-[10px] text-slate-400">Pilih jenis presensi yang akan Anda lakukan</span>
              </div>

              {/* Link to Kelola Manpower for Leaves / Sick */}
              {onOpenManpowerMgmt && (
                <button
                  type="button"
                  onClick={onOpenManpowerMgmt}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 shadow-2xs"
                  title="Ajukan atau cek data Sakit, Cuti, dan Izin di Kelola Manpower"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span>Kelola Izin & Cuti</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Button Absen Masuk */}
              <button
                type="button"
                onClick={() => {
                  setAttendanceType('Masuk');
                  setSubmitSuccess(null);
                  setValidationError(null);
                }}
                className={`py-3.5 px-4 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 cursor-pointer relative ${
                  attendanceType === 'Masuk'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm ring-2 ring-emerald-200'
                    : todayMasuk
                    ? `bg-slate-50 text-slate-500 ${masukStyle ? masukStyle.border : 'border-slate-200'}`
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🟢</span>
                  <span className="text-sm font-bold">Absen Masuk</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">Target: 09:00 WIB</span>
                {todayMasuk && (
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border mt-0.5 flex items-center gap-1 ${
                    masukStyle ? masukStyle.badge : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${masukStyle ? masukStyle.dot : 'bg-slate-400'}`} />
                    <span>✓ Selesai ({formatTimeOnly(todayMasuk.timestamp)})</span>
                  </span>
                )}
              </button>

              {/* Button Absen Pulang */}
              <button
                type="button"
                onClick={() => {
                  setAttendanceType('Pulang');
                  setSubmitSuccess(null);
                  setValidationError(null);
                }}
                className={`py-3.5 px-4 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 cursor-pointer relative ${
                  attendanceType === 'Pulang'
                    ? 'border-sky-500 bg-sky-50 text-sky-800 shadow-sm ring-2 ring-sky-200'
                    : todayPulang
                    ? `bg-slate-50 text-slate-500 ${pulangStyle ? pulangStyle.border : 'border-slate-200'}`
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🔵</span>
                  <span className="text-sm font-bold">Absen Pulang</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">Target: {targetPulangLabel}</span>
                {todayPulang && (
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border mt-0.5 flex items-center gap-1 ${
                    pulangStyle ? pulangStyle.badge : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${pulangStyle ? pulangStyle.dot : 'bg-slate-400'}`} />
                    <span>✓ Selesai ({formatTimeOnly(todayPulang.timestamp)})</span>
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 2. Live Camera / Preview Card */}
          <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {capturedImage ? 'Preview Foto & Watermark' : 'Kamera Depan (Live)'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Anti-Kecurangan Aktif</span>
              </div>
            </div>

            {/* Already Done Warning Banner */}
            {isSelectedTypeAlreadyDone && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <p className="font-medium text-[11px] leading-relaxed">
                  {getAlreadyDoneMessage()}
                </p>
              </div>
            )}

            {/* Camera Error Message */}
            {cameraError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="space-y-1">
                  <p className="font-bold">Akses Kamera Gagal</p>
                  <p className="text-[11px] leading-relaxed">{cameraError}</p>
                  <button
                    onClick={startCamera}
                    className="mt-2 text-xs font-bold text-rose-800 underline hover:no-underline cursor-pointer"
                  >
                    Coba Akses Ulang Kamera
                  </button>
                </div>
              </div>
            )}

            {/* Video or Captured Frame Container */}
            <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-video sm:aspect-4/3 flex items-center justify-center border border-slate-800 shadow-inner">
              {capturedImage ? (
                /* Captured Frame with Baked-in Watermark */
                <img
                  src={capturedImage}
                  alt="Captured Selfie"
                  className="w-full h-full object-cover"
                />
              ) : (
                /* Live Video Stream */
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                  {!isCameraActive && !cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-white space-y-2">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-slate-300">Menghubungkan sensor kamera...</p>
                    </div>
                  )}

                  {/* Live Floating GPS Overlay on Video */}
                  <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-md rounded-xl p-2.5 text-white flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-emerald-400 shrink-0 animate-pulse" />
                      <div className="truncate font-mono">
                        {coords ? (
                          <span>
                            {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)} (±{coords.accuracy}m)
                          </span>
                        ) : (
                          <span className="text-amber-300">Mendeteksi koordinat GPS...</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase shrink-0">Live</span>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons: Capture or Retake + Submit (Thumb-friendly on mobile) */}
            <div className="pt-2">
              {!capturedImage ? (
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!isCameraActive || gpsLoading || isSelectedTypeAlreadyDone}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                >
                  <Camera className="h-5 w-5" />
                  <span>
                    {isSelectedTypeAlreadyDone ? `Sudah Absen ${attendanceType} Hari Ini` : `Ambil Foto Selfie [Absen ${attendanceType}]`}
                  </span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={retakePhoto}
                    disabled={submitting}
                    className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Foto Ulang</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !coords || isSelectedTypeAlreadyDone}
                    className="py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Menyimpan Presensi...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Kirim Absen {attendanceType}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): GPS Status & Riwayat Terkini */}
        <div className="lg:col-span-5 space-y-4">
          {/* GPS Info Card */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-700">Validasi Lokasi (GPS)</span>
              </div>
              <button
                type="button"
                onClick={requestLocation}
                disabled={gpsLoading}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${gpsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh GPS</span>
              </button>
            </div>

            {gpsError ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-bold">GPS Bermasalah</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">{gpsError}</p>
                </div>
              </div>
            ) : coords ? (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Latitude</span>
                    <span className="font-mono font-semibold text-slate-800">{coords.latitude.toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Longitude</span>
                    <span className="font-mono font-semibold text-slate-800">{coords.longitude.toFixed(6)}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Akurasi Perangkat:</span>
                  <span className="font-mono font-bold text-emerald-600">±{coords.accuracy} meter</span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span>Mendeteksi koordinat satelit GPS...</span>
              </div>
            )}

            <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-emerald-800 leading-relaxed">
                Anti-Kecurangan: Foto wajib live selfie kamera depan dengan stempel koordinat dan waktu WIB.
              </p>
            </div>
          </div>

          {/* Riwayat Absensi Terkini with Polite Border Indicators */}
          <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Riwayat Presensi Terbaru</h3>
              </div>
              <button
                type="button"
                onClick={loadHistory}
                disabled={historyLoading}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                title="Refresh Riwayat"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {historyLoading && history.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Memuat log presensi...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-1">
                <p className="text-xs font-semibold">Belum ada riwayat presensi</p>
                <p className="text-[10px]">Absensi Anda hari ini akan tercatat otomatis di sini.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {history.map((rec, idx) => {
                  const dateObj = new Date(rec.timestamp);
                  const isMasuk = rec.type === 'Masuk';
                  const punctuality = getPunctualityStyle(rec.type, rec.timestamp);

                  return (
                    <div
                      key={rec.id || idx}
                      className={`p-3 border-l-4 rounded-xl flex items-center justify-between gap-2 transition-colors text-xs ${
                        punctuality ? `${punctuality.border} ${punctuality.bg}` : 'border-slate-300 bg-slate-50'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isMasuk ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            {rec.type}
                          </span>
                          <span className="font-bold text-slate-800">{rec.employee_name}</span>
                          {punctuality && (
                            <span className={`h-2 w-2 rounded-full ${punctuality.dot}`} title="Indikator Ketepatan Waktu" />
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} • {dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                        </div>
                      </div>

                      {rec.photo_drive_url && rec.photo_drive_url !== '-' ? (
                        <a
                          href={rec.photo_drive_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-bold px-2 py-1 rounded-lg hover:bg-emerald-100/60 transition-colors"
                          title="Lihat foto bukti di Google Drive"
                        >
                          <span>Foto</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {rec.latitude ? `📍 ${rec.latitude.toFixed(2)}` : '✅ Tercatat'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
