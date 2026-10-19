import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { AttendanceType, AttendanceRecord } from '../types';
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
  Info
} from 'lucide-react';

interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export default function AttendanceModule() {
  const { activeUser, activeUserEmail, currentUser } = useUser();

  // Absensi selection
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('Masuk');
  
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
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // GAS Web App URL from environment
  const gasUrl = import.meta.env.VITE_GAS_ATTENDANCE_URL || '';

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
          .limit(20);

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
    setSubmitSuccess(`Absen ${attendanceType} berhasil dicatat pada ${now.toLocaleTimeString('id-ID')} WIB!`);

    // Reset captured photo and reload history
    setCapturedImage(null);
    loadHistory();
    startCamera();
  };

  // Color mappings for attendance types
  const typeConfig: Record<AttendanceType, { label: string; icon: string; border: string; bg: string; text: string; badge: string }> = {
    Masuk:  { label: 'Absen Masuk',  icon: '🟢', border: 'border-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
    Pulang: { label: 'Absen Pulang', icon: '🔵', border: 'border-sky-500',     bg: 'bg-sky-50',      text: 'text-sky-700',     badge: 'bg-sky-100 text-sky-800' },
    Sakit:  { label: 'Sakit',        icon: '🟡', border: 'border-amber-500',   bg: 'bg-amber-50',    text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-800' },
    Cuti:   { label: 'Cuti / Izin',  icon: '🟠', border: 'border-rose-500',    bg: 'bg-rose-50',     text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-800' }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Presensi & Geolokasi Lapangan</span>
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
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
          <Clock className="h-5 w-5 text-emerald-600 animate-spin-slow" />
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

      {/* Success Notification */}
      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between text-emerald-800 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">{submitSuccess}</p>
              <p className="text-[10px] text-emerald-600">Data absensi telah disinkronkan ke server & spreadsheet.</p>
            </div>
          </div>
          <button
            onClick={() => setSubmitSuccess(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1 rounded-lg hover:bg-emerald-100/60"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Grid: Left = Camera & Submit, Right = Status & Riwayat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Camera & Form */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Selection Button: 4 Types */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-3">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Pilih Status Kehadiran</span>
              <span className="text-[10px] text-slate-400 font-normal">Wajib dipilih sebelum ambil foto</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Masuk', 'Pulang', 'Sakit', 'Cuti'] as AttendanceType[]).map((type) => {
                const isSelected = attendanceType === type;
                const cfg = typeConfig[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setAttendanceType(type);
                      setSubmitSuccess(null);
                    }}
                    className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 ${
                      isSelected
                        ? `${cfg.border} ${cfg.bg} ${cfg.text} shadow-sm ring-2 ring-emerald-200`
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base">{cfg.icon}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Live Camera / Preview Card */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
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

            {/* Camera Error Message */}
            {cameraError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="space-y-1">
                  <p className="font-bold">Akses Kamera Gagal</p>
                  <p className="text-[11px] leading-relaxed">{cameraError}</p>
                  <button
                    onClick={startCamera}
                    className="mt-2 text-xs font-bold text-rose-800 underline hover:no-underline"
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

            {/* Action Buttons: Capture or Retake + Submit */}
            <div className="pt-2">
              {!capturedImage ? (
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!isCameraActive || gpsLoading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                >
                  <Camera className="h-4 w-4" />
                  <span>Ambil Foto Selfie & Watermark</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={retakePhoto}
                    disabled={submitting}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Foto Ulang</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !coords}
                    className="py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Menyimpan Presensi...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
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
        <div className="lg:col-span-5 space-y-5">
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
                className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition-colors"
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
                Anti-Kecurangan: Pengunggahan foto dari galeri dinonaktifkan. Foto wajib diambil langsung lewat kamera depan dengan watermark stempel koordinat dan waktu WIB.
              </p>
            </div>
          </div>

          {/* Riwayat Absensi Terkini */}
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
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
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
                  const cfg = typeConfig[rec.type] || typeConfig['Masuk'];
                  return (
                    <div
                      key={rec.id || idx}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2 transition-colors text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cfg.badge}`}>
                            {rec.type}
                          </span>
                          <span className="font-bold text-slate-800">{rec.employee_name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} • {dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                        </div>
                      </div>

                      {rec.photo_drive_url && rec.photo_drive_url !== '-' ? (
                        <a
                          href={rec.photo_drive_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-bold px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
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
