import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { AttendanceType, WorkLocationType, AttendanceRecord, Manpower, ManpowerAbsence } from '../types';
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
  ClipboardList,
  Building2,
  Lock,
  Users,
  User,
  Edit3,
  Cloud,
  Settings,
  X
} from 'lucide-react';

interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface GeoLocationInfo {
  buildingName: string;
  road: string;
  area: string;
  city: string;
  fullAddress: string;
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

  // Mode Lokasi Penugasan: 'Kantor' | 'On Site' | 'WFH'
  const [workLocationType, setWorkLocationType] = useState<WorkLocationType>('Kantor');
  
  // Camera & Image state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // GPS & Location state
  const [coords, setCoords] = useState<Coords | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locationInfo, setLocationInfo] = useState<GeoLocationInfo | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [customLocationName, setCustomLocationName] = useState<string>('Kantor Pusat PT Aksara Riksa Perdana');

  // Live time ticker
  const [now, setNow] = useState(new Date());

  // Privacy & Manager permission check:
  // Karyawan biasa HANYA bisa melihat absensi miliknya sendiri (Strict Privacy).
  // Leader / IT / Admin dapat memantau tim jika diperlukan.
  const isPrivilegedManager = Boolean(
    currentUser?.role?.toLowerCase().includes('leader') ||
    currentUser?.role?.toLowerCase().includes('it') ||
    currentUser?.division?.toLowerCase() === 'it' ||
    currentUser?.role?.toLowerCase().includes('superadmin') ||
    activeUser?.toLowerCase() === 'zulfan' ||
    activeUser?.toLowerCase() === 'angga'
  );
  const [historyFilter, setHistoryFilter] = useState<'mine' | 'team'>('mine');

  // Submit & History state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Google Apps Script Web App URL (bisa dibaca dari localStorage atau .env)
  const [gasUrl, setGasUrl] = useState<string>(() => {
    return localStorage.getItem('gas_attendance_url') || import.meta.env.VITE_GAS_ATTENDANCE_URL || '';
  });
  const [showGasModal, setShowGasModal] = useState<boolean>(false);
  const [inputGasUrl, setInputGasUrl] = useState<string>(() => {
    return localStorage.getItem('gas_attendance_url') || import.meta.env.VITE_GAS_ATTENDANCE_URL || '';
  });
  const [testingGas, setTestingGas] = useState<boolean>(false);
  const [gasTestResult, setGasTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestGas = async () => {
    if (!inputGasUrl.trim()) {
      setGasTestResult({ success: false, message: 'Harap masukkan URL Web App Google Apps Script terlebih dahulu.' });
      return;
    }
    setTestingGas(true);
    setGasTestResult(null);
    try {
      const res = await fetch(inputGasUrl.trim(), { method: 'GET' });
      const text = await res.text();
      if (text.includes('Halaman Tidak Ditemukan') || text.includes('not found') || !res.ok) {
        setGasTestResult({
          success: false,
          message: 'Google merespons 404 (Halaman Tidak Ditemukan). Pastikan Web App sudah di-Deploy dengan benar (New Deployment) dan opsi akses diatur ke "Anyone".'
        });
      } else {
        setGasTestResult({
          success: true,
          message: 'Koneksi berhasil! Google Apps Script merespons dengan baik dan siap menerima foto presensi.'
        });
      }
    } catch (err: any) {
      setGasTestResult({
        success: false,
        message: `Koneksi gagal: ${err?.message || err}. Pastikan Anda memilih "Who has access: Anyone" saat Deploy di Google Apps Script.`
      });
    } finally {
      setTestingGas(false);
    }
  };

  const handleSaveGasUrl = () => {
    const trimmed = inputGasUrl.trim();
    localStorage.setItem('gas_attendance_url', trimmed);
    setGasUrl(trimmed);
    setShowGasModal(false);
  };

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

  // Reverse Geocode: Deteksi nama gedung, jalan, dan wilayah administratif secara akurat
  const fetchReverseGeocode = useCallback(async (lat: number, lng: number) => {
    setLocationLoading(true);
    try {
      // 1. Nominatim OpenStreetMap (zoom 18) untuk deteksi nama gedung / POI / nomor jalan
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};

        const bldg =
          addr.building ||
          addr.office ||
          addr.amenity ||
          addr.commercial ||
          addr.industrial ||
          addr.shop ||
          addr.leisure ||
          addr.tourism ||
          (data.name && data.name !== addr.road ? data.name : '');

        const road = addr.road || addr.pedestrian || addr.street || '';
        const area = addr.suburb || addr.village || addr.neighbourhood || '';
        const district = addr.city_district || addr.subdistrict || '';
        const city = addr.city || addr.town || addr.municipality || addr.county || '';

        const cleanRoad = road ? (road.toLowerCase().startsWith('jl') ? road : `Jl. ${road}`) : '';
        const areaSummary = [area, district, city].filter(Boolean).join(', ');

        let fullReadable = '';
        if (bldg && cleanRoad) {
          fullReadable = `${bldg}, ${cleanRoad}, ${city || area}`;
        } else if (cleanRoad) {
          fullReadable = `${cleanRoad}, ${areaSummary}`;
        } else {
          fullReadable = areaSummary || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }

        const info: GeoLocationInfo = {
          buildingName: bldg || '',
          road: cleanRoad,
          area: [area, district].filter(Boolean).join(', '),
          city: city || 'Indonesia',
          fullAddress: fullReadable
        };

        setLocationInfo(info);
        setCustomLocationName(bldg ? `${bldg} (${cleanRoad || city})` : fullReadable);
        setLocationLoading(false);
        return;
      }
    } catch (err) {
      console.warn('[Nominatim Reverse Geocode Warning]', err);
    }

    // 2. Fallback ke BigDataCloud Reverse Geocode Client API
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`
      );
      if (res.ok) {
        const data = await res.json();
        const locality = data.locality || '';
        const city = data.city || '';
        const sub = data.principalSubdivision || '';
        const full = [locality, city, sub].filter(Boolean).join(', ');

        const info: GeoLocationInfo = {
          buildingName: '',
          road: '',
          area: locality,
          city: city || sub,
          fullAddress: full || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        };

        setLocationInfo(info);
        setCustomLocationName(full || 'Lokasi Terverifikasi');
        setLocationLoading(false);
        return;
      }
    } catch (err) {
      console.warn('[BigDataCloud Fallback Warning]', err);
    }

    setLocationLoading(false);
  }, []);

  // Request GPS Location dengan Presisi Tinggi
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation tidak didukung oleh browser Anda.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        };
        setCoords(newCoords);
        setGpsLoading(false);
        // Langsung cari nama gedung & alamat
        fetchReverseGeocode(pos.coords.latitude, pos.coords.longitude);
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
        maximumAge: 0 // Pastikan GPS realtime terkini, bukan cache
      }
    );
  }, [fetchReverseGeocode]);

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

  // Capture photo from video and apply anti-cheat watermark with Building Name
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

    // Apply anti-cheat watermark bar at the bottom with sufficient height for Building Name
    const barHeight = Math.max(92, Math.round(height * 0.19));
    const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
    gradient.addColorStop(0, 'rgba(15, 23, 42, 0.90)');
    gradient.addColorStop(1, 'rgba(2, 6, 23, 0.98)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - barHeight, width, barHeight);

    // Accent line on top of banner
    ctx.fillStyle = attendanceType === 'Masuk' ? '#10B981' : '#0EA5E9';
    ctx.fillRect(0, height - barHeight, width, 3);

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

    const displayLocation = (customLocationName || locationInfo?.buildingName || locationInfo?.fullAddress || 'Lokasi Terverifikasi').trim();
    const truncatedLocation = displayLocation.length > 42 ? displayLocation.substring(0, 39) + '...' : displayLocation;

    // Line 1: User & Type
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${empName} [Absen ${attendanceType}]`, 28, height - barHeight + 22);

    // Line 2: Timestamp WIB
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '10px monospace';
    ctx.fillText(`📅 ${currentDate} • ${currentTime}`, 28, height - barHeight + 39);

    // Line 3: Building / Location name with workLocationType tag (Prominent yellow)
    ctx.fillStyle = '#FDE047';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`🏢 [${workLocationType}] ${truncatedLocation}`, 28, height - barHeight + 56);

    // Line 4: GPS Coordinates & Accuracy
    ctx.fillStyle = '#94A3B8';
    ctx.font = '9px monospace';
    ctx.fillText(`📍 Lat: ${latStr}, Lng: ${lngStr} (${accStr})`, 28, height - barHeight + 73);

    // Branding stamp on right
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('PT AKSARA RIKSA PERDANA', width - 20, height - barHeight + 24);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '8px monospace';
    ctx.fillText('RiksaSync AI • Verified GPS', width - 20, height - barHeight + 40);
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

  // Fetch attendance history with Strict Privacy
  // Karyawan biasa HANYA bisa melihat riwayat presensi miliknya sendiri.
  // Privileged Manager dapat melihat milik sendiri atau seluruh tim.
  const loadHistory = useCallback(async (forcedFilter?: 'mine' | 'team') => {
    setHistoryLoading(true);
    const activeFilter = forcedFilter || historyFilter;
    const activeEmail = activeUserEmail || `${(activeUser || '').toLowerCase()}@aksarariksapjk3.com`;
    const activeName = activeUser || '';

    try {
      if (isSupabaseConfigured && supabase) {
        let query = supabase
          .from('attendance_logs')
          .select('*')
          .order('timestamp', { ascending: false });

        // Privacy filter: Jika staf biasa ATAU mode 'mine', batasi query ke email/nama aktif saja
        if (!isPrivilegedManager || activeFilter === 'mine') {
          if (activeEmail && activeName) {
            query = query.or(`employee_email.ilike.${activeEmail},employee_name.ilike.${activeName}`);
          } else if (activeEmail) {
            query = query.ilike('employee_email', activeEmail);
          } else if (activeName) {
            query = query.ilike('employee_name', activeName);
          }
        }

        const { data, error } = await query.limit(50);

        if (!error && data) {
          setHistory(data as AttendanceRecord[]);
          setHistoryLoading(false);
          return;
        }
      }

      // Fallback to local storage if supabase not available
      const local = localStorage.getItem('local_attendance_logs');
      if (local) {
        const parsed: AttendanceRecord[] = JSON.parse(local);
        if (!isPrivilegedManager || activeFilter === 'mine') {
          const filtered = parsed.filter((r) => {
            const matchEmail = Boolean(r.employee_email && activeEmail && r.employee_email.toLowerCase() === activeEmail.toLowerCase());
            const matchName = Boolean(r.employee_name && activeName && r.employee_name.toLowerCase() === activeName.toLowerCase());
            return matchEmail || matchName;
          });
          setHistory(filtered);
        } else {
          setHistory(parsed);
        }
      }
    } catch (e) {
      console.warn('[History Error]', e);
    } finally {
      setHistoryLoading(false);
    }
  }, [activeUser, activeUserEmail, isPrivilegedManager, historyFilter]);

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
    const locationToSend = (customLocationName || locationInfo?.fullAddress || '').trim();

    const newRecord: AttendanceRecord = {
      employee_name: empName,
      employee_email: empEmail,
      type: attendanceType,
      work_location_type: workLocationType,
      building_name: locationToSend || undefined,
      location_name: locationToSend || undefined,
      address: locationInfo?.fullAddress || undefined,
      timestamp: recordTimestamp,
      latitude: coords.latitude,
      longitude: coords.longitude,
      photo_drive_url: ''
    };

    let driveLink = '';
    let gasErrorOccurred = false;

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
            work_location_type: workLocationType,
            building_name: locationToSend || '-',
            location_name: locationToSend || '-',
            address: locationInfo?.fullAddress || '-',
            timestamp: recordTimestamp,
            latitude: coords.latitude,
            longitude: coords.longitude,
            photo_base64: capturedImage
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson && resJson.drive_url && resJson.drive_url !== '-') {
            driveLink = resJson.drive_url;
            newRecord.photo_drive_url = driveLink;
          } else {
            gasErrorOccurred = true;
          }
        } else {
          gasErrorOccurred = true;
        }
      } catch (gasErr) {
        console.warn('[GAS Attendance Submission Warning]', gasErr);
        gasErrorOccurred = true;
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
            work_location_type: workLocationType,
            building_name: locationToSend || null,
            location_name: locationToSend || null,
            address: locationInfo?.fullAddress || null,
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
    if (driveLink) {
      setSubmitSuccess(`Presensi ${attendanceType} berhasil dicatat! Foto selfie tersimpan otomatis. ✅`);
    } else {
      setSubmitSuccess(`Presensi ${attendanceType} berhasil dicatat pada ${now.toLocaleTimeString('id-ID')} WIB! ✅`);
    }

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
            Kamera depan live selfie + stempel resmi koordinat GPS & waktu terverifikasi.
          </p>
        </div>

        {/* Realtime clock display + Admin-only sync dot */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* Titik sinkronisasi — hanya terlihat oleh IT/Manager, tanpa label */}
          {isPrivilegedManager && (
            <button
              type="button"
              onClick={() => {
                setInputGasUrl(gasUrl);
                setGasTestResult(null);
                setShowGasModal(true);
              }}
              title={gasUrl ? 'Sinkronisasi aktif' : 'Konfigurasi sinkronisasi'}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className={`block h-2 w-2 rounded-full ${
                gasUrl ? 'bg-emerald-500' : 'bg-amber-400'
              }`} />
            </button>
          )}

          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
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

            {/* 3-Way Mode Penugasan: Kantor | On Site | WFH */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Lokasi Penugasan Hari Ini:</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  {workLocationType === 'Kantor' && 'Kantor Pusat ARM'}
                  {workLocationType === 'On Site' && 'Site Klien / Lapangan'}
                  {workLocationType === 'WFH' && 'Remote / WFH'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWorkLocationType('Kantor');
                    setCustomLocationName('Kantor Pusat PT Aksara Riksa Perdana');
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    workLocationType === 'Kantor'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Kantor</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWorkLocationType('On Site');
                    setCustomLocationName(locationInfo?.buildingName || locationInfo?.road || 'Site Proyek Klien');
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    workLocationType === 'On Site'
                      ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-xs ring-2 ring-amber-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Navigation className="h-3.5 w-3.5 text-amber-600" />
                  <span>On Site</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWorkLocationType('WFH');
                    setCustomLocationName('Kediaman Pribadi (WFH)');
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    workLocationType === 'WFH'
                      ? 'border-sky-500 bg-sky-50 text-sky-800 shadow-xs ring-2 ring-sky-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs">🏠</span>
                  <span>WFH</span>
                </button>
              </div>
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
                <span>Verifikasi Presensi Sah</span>
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

        {/* Right Column (5 cols): GPS Status & Riwayat Presensi dengan Privasi */}
        <div className="lg:col-span-5 space-y-4">
          {/* GPS & Building Info Card */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-700">Validasi Lokasi (GPS Presisi)</span>
              </div>
              <button
                type="button"
                onClick={requestLocation}
                disabled={gpsLoading || locationLoading}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${gpsLoading || locationLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Lokasi</span>
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
              <div className="space-y-2.5">
                {/* Detected Building / Address Box */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-emerald-600" />
                      <span>Gedung / Tempat Terverifikasi</span>
                    </span>
                    {locationLoading && (
                      <span className="text-[10px] text-emerald-600 font-medium animate-pulse flex items-center gap-1">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                        <span>Mendeteksi...</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-800 leading-snug">
                    {locationInfo?.buildingName ? (
                      <span className="text-emerald-900 font-black">{locationInfo.buildingName}</span>
                    ) : locationInfo?.road ? (
                      <span>{locationInfo.road}</span>
                    ) : (
                      <span className="text-slate-600">Mendeteksi titik gedung...</span>
                    )}
                  </p>
                  {locationInfo?.fullAddress && (
                    <p className="text-[11px] text-slate-600 leading-relaxed font-mono">
                      📍 {locationInfo.fullAddress}
                    </p>
                  )}
                </div>

                {/* Editable / Confirmable Location Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 flex items-center justify-between">
                    <span>Nama Gedung / Lokasi Absensi:</span>
                    <span className="text-[9px] text-slate-400 font-normal">Dicetak pada watermark foto</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customLocationName}
                      onChange={(e) => setCustomLocationName(e.target.value)}
                      placeholder="cth: Kantor Pusat / Pabrik PT ABC / Site Proyek"
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                    />
                  </div>
                  {/* Quick Preset Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setWorkLocationType('Kantor');
                        setCustomLocationName('Kantor Pusat PT Aksara Riksa Perdana');
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-medium cursor-pointer transition-colors ${
                        workLocationType === 'Kantor' ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      🏢 Kantor Pusat
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWorkLocationType('On Site');
                        setCustomLocationName(locationInfo?.buildingName || locationInfo?.road || 'Site Proyek Klien');
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-medium cursor-pointer transition-colors ${
                        workLocationType === 'On Site' ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      🏭 Site Klien
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWorkLocationType('WFH');
                        setCustomLocationName('Kediaman Pribadi (WFH)');
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-medium cursor-pointer transition-colors ${
                        workLocationType === 'WFH' ? 'bg-sky-100 text-sky-800 font-bold border border-sky-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      🏠 WFH
                    </button>
                  </div>
                </div>

                {/* Lat Lng & Accuracy */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Latitude</span>
                    <span className="font-mono font-semibold text-slate-800 text-[11px]">{coords.latitude.toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Longitude</span>
                    <span className="font-mono font-semibold text-slate-800 text-[11px]">{coords.longitude.toFixed(6)}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-medium">Akurasi Satelit GPS:</span>
                    <span className="font-mono font-bold text-emerald-600">±{coords.accuracy} meter</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span>Mendeteksi koordinat satelit GPS & nama gedung...</span>
              </div>
            )}

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Standar Presensi: Foto live selfie otomatis menyematkan nama gedung, koordinat GPS, dan jam WIB resmi ke Google Drive.
              </p>
            </div>
          </div>

          {/* Riwayat Absensi Terkini - PRIVASI KETAT */}
          <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  {historyFilter === 'mine' ? 'Riwayat Presensi Saya' : 'Pantauan Seluruh Tim'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Switcher Tab HANYA jika Admin / Leader / IT */}
                {isPrivilegedManager && (
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryFilter('mine');
                        loadHistory('mine');
                      }}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                        historyFilter === 'mine' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <User className="h-3 w-3" />
                      <span>Saya</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryFilter('team');
                        loadHistory('team');
                      }}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                        historyFilter === 'team' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Users className="h-3 w-3" />
                      <span>Tim (Leader)</span>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => loadHistory()}
                  disabled={historyLoading}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                  title="Refresh Riwayat"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Privacy notice badge */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/80">
              <Lock className="h-3 w-3 text-emerald-600 shrink-0" />
              <span>Privasi Terjaga: Karyawan hanya dapat melihat data & foto presensi miliknya sendiri.</span>
            </div>

            {historyLoading && history.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Memuat log presensi...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-1">
                <p className="text-xs font-semibold">Belum ada riwayat presensi</p>
                <p className="text-[10px]">Presensi Anda hari ini akan tercatat otomatis di sini.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
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
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isMasuk ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            {rec.type}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            rec.work_location_type === 'On Site'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : rec.work_location_type === 'WFH'
                              ? 'bg-sky-50 text-sky-800 border-sky-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}>
                            {rec.work_location_type === 'On Site' ? '🏭 On Site' : rec.work_location_type === 'WFH' ? '🏠 WFH' : '🏢 Kantor'}
                          </span>
                          <span className="font-bold text-slate-800 truncate">
                            {historyFilter === 'team' ? rec.employee_name : 'Presensi Saya'}
                          </span>
                          {punctuality && (
                            <span className={`h-2 w-2 rounded-full shrink-0 ${punctuality.dot}`} title="Indikator Ketepatan Waktu" />
                          )}
                        </div>

                        {/* Location / Building name */}
                        {(rec.building_name || rec.location_name) && (
                          <div
                            className="text-[10px] text-slate-600 font-medium flex items-center gap-1 truncate max-w-[240px]"
                            title={rec.address || rec.building_name || rec.location_name}
                          >
                            <Building2 className="h-3 w-3 text-emerald-600 shrink-0" />
                            <span className="truncate">{rec.building_name || rec.location_name}</span>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 font-mono">
                          {dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} • {dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                        </div>
                      </div>

                      {rec.photo_drive_url && rec.photo_drive_url !== '-' ? (
                        <a
                          href={rec.photo_drive_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shrink-0"
                          title="Lihat foto bukti di Google Drive"
                        >
                          <span>Foto</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
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
      {/* Modal Pengaturan Google Apps Script & Drive */}
      {showGasModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-800">Integrasi Google Drive & Sheets</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGasModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <span>📋 Panduan Setup (Hanya Sekali):</span>
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1">
                <li>Buka Google Sheets di Google Drive Anda (misal: "Data Absensi Aksara Riksa").</li>
                <li>Klik menu <strong>Extensions (Ekstensi) &gt; Apps Script</strong>.</li>
                <li>Hapus seluruh isi Code.gs, lalu paste seluruh isi file <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-emerald-700 font-mono">google-apps-script/absensi.gs</code>.</li>
                <li>Klik tombol biru <strong>Deploy &gt; New deployment</strong>:
                  <ul className="list-disc list-inside pl-4 mt-1 space-y-0.5 text-[11px] text-slate-500">
                    <li>Select type: <strong>Web app</strong></li>
                    <li>Execute as: <strong>Me (Akun Google Anda)</strong></li>
                    <li>Who has access: <strong>Anyone (Siapa saja)</strong></li>
                  </ul>
                </li>
                <li>Klik <strong>Deploy</strong>, izinkan akses Google jika diminta.</li>
                <li>Salin <strong>Web app URL</strong> (format: <code className="font-mono text-[10px] text-slate-700">.../macros/s/.../exec</code>) dan tempelkan di bawah ini.</li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Web App URL Google Apps Script:</span>
                {gasUrl && (
                  <span className="text-[10px] text-emerald-600 font-semibold">Tersimpan di browser</span>
                )}
              </label>
              <input
                type="url"
                value={inputGasUrl}
                onChange={(e) => setInputGasUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-400">
                URL ini akan langsung dipakai untuk menyimpan foto selfie ke folder Google Drive dan mencatat baris absensi ke Google Sheets.
              </p>
            </div>

            {/* Test result message */}
            {gasTestResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  gasTestResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {gasTestResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <span className="leading-relaxed">{gasTestResult.message}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleTestGas}
                disabled={testingGas || !inputGasUrl.trim()}
                className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {testingGas && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{testingGas ? 'Mengetes...' : 'Test Koneksi URL'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGasModal(false)}
                  className="text-xs font-semibold px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleSaveGasUrl}
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs"
                >
                  Simpan URL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
