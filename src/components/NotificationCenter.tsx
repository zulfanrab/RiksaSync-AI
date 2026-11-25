import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, BellRing, Inbox, Download, Smartphone, RefreshCw, Send } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { sendPushNotification, formatScheduleNotification } from '../lib/pushNotifier';
import { AnimatePresence, motion } from 'motion/react';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority?: 'P1' | 'P2' | 'P3';
}

interface NotificationCenterProps {
  isFloating?: boolean;
  className?: string;
}

// Play the custom audio file placed in the public directory
const playNotificationSound = () => {
  try {
    const audio = new Audio('/custom-notification.mp3');
    audio.play().catch(e => console.warn('Notification audio play blocked or file not found:', e));
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
};

// PWA install prompt event type
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function NotificationCenter({ isFloating = false, className = '' }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // PWA Install states
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Detect iOS
  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
  }, []);

  // Detect if already running in standalone (installed) mode
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsAppInstalled(true);
      localStorage.setItem('aksara_pwa_installed', 'true');
    } else {
      const alreadyInstalled = localStorage.getItem('aksara_pwa_installed') === 'true';
      setIsAppInstalled(alreadyInstalled);
    }
  }, []);

  // Capture beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Listen for successful install
  useEffect(() => {
    const handler = () => {
      setIsAppInstalled(true);
      setInstallPrompt(null);
      localStorage.setItem('aksara_pwa_installed', 'true');
    };
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  // Load read status from localStorage (only read flags, not full notifications)
  const getReadIds = (): Set<string> => {
    try {
      const saved = localStorage.getItem('aksara_read_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  };

  const saveReadIds = (ids: Set<string>) => {
    try {
      localStorage.setItem('aksara_read_ids', JSON.stringify([...ids]));
    } catch {}
  };

  // Handle install button click
  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSTip(prev => !prev);
      return;
    }
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsAppInstalled(true);
      setInstallPrompt(null);
      localStorage.setItem('aksara_pwa_installed', 'true');
    }
  };

  // Whether to show the install notification card
  const showInstallCard = !isAppInstalled && (installPrompt !== null || isIOS);

  // --- Web Push Subscription Logic ---
  const [isTestingPush, setIsTestingPush] = useState(false);

  const subscribeToWebPush = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return { success: false, error: 'Browser atau mode webview ini tidak mendukung Web Push.' };
      }
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('[Push] VITE_VAPID_PUBLIC_KEY not set. Web Push not available.');
        return { success: false, error: 'VITE_VAPID_PUBLIC_KEY belum terbaca di aplikasi.' };
      }

      const registration = await navigator.serviceWorker.ready;

      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
      };

      // Unsubscribe any stale previous subscription to ensure matching with new VAPID keys
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        try {
          await existingSub.unsubscribe();
          console.log('[Push] Cleared old subscription to ensure fresh VAPID key sync.');
        } catch (e) {}
      }

      // Fresh subscription with the current VAPID key
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Register subscription on backend
      const res = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[Push] /api/push-subscribe error:', resData);
        return { success: false, error: resData.error || `HTTP ${res.status}` };
      }

      console.log('[Push] Successfully registered subscription on server:', resData);
      return { success: true };
    } catch (err: any) {
      console.warn('[Push] Web Push subscription failed:', err);
      return { success: false, error: err?.message || String(err) };
    }
  };

  const handleReSubscribe = async () => {
    try {
      if (!('Notification' in window)) {
        alert('Browser Anda tidak mendukung Web Push Notification.');
        return;
      }
      
      let p: NotificationPermission = 'default';
      try {
        p = await new Promise<NotificationPermission>((resolve) => {
          const res = Notification.requestPermission((status) => {
            if (status) resolve(status);
          });
          if (res && typeof (res as any).then === 'function') {
            (res as Promise<NotificationPermission>).then(resolve).catch(() => resolve('denied'));
          }
        });
      } catch {
        p = Notification.permission;
      }
      setPermission(p);
      if (p === 'granted') {
        const subRes = await subscribeToWebPush();
        if (subRes.success) {
          alert('✅ HP Anda berhasil didaftarkan ke server! Sekarang banner notifikasi akan meluncur ke HP ini.');
        } else {
          alert(`⚠️ Izin diberikan, tapi gagal mendaftarkan ke server: ${subRes.error}`);
        }
      } else {
        alert('Gagal mengaktifkan notifikasi: Izin belum diberikan di browser Anda.');
      }
    } catch (e) {
      console.error('[Push] Force sync failed:', e);
      alert('Gagal menyinkronkan notifikasi.');
    }
  };

  const handleSendTestPush = async () => {
    setIsTestingPush(true);
    try {
      // 1. Pastikan token HP ini terdaftar ke server
      const subResult = await subscribeToWebPush();
      if (!subResult.success) {
        console.warn('[Push Test Subscribe Warn]:', subResult.error);
      }

      // 2. Minta server menembakkan Web Push ke seluruh HP terdaftar
      const result = await sendPushNotification({
        type: 'TEST',
        title: '🔔 AksaraSync AI (Tes Banner)',
        body: 'Tes Berhasil! Notifikasi banner HP Anda berfungsi normal dan aktif. 🎉'
      });

      playNotificationSound();

      if (result && result.success) {
        if (result.sent === 0) {
          alert('⚠️ Server memproses, tapi JUMLAH HP TERDAFTAR ADALAH 0 (sent: 0)!\n\nArtinya token HP belum tersimpan di database. Silakan jalankan script SQL GRANT di Supabase SQL Editor.');
        } else {
          alert(`✅ BERHASIL! Notifikasi banner dikirim server ke ${result.sent} perangkat HP! Cek layar HP Anda sekarang.`);
        }
      } else {
        alert('❌ Gagal mengirim dari server: ' + (result?.error || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('[Push Test Error]', err);
      alert('Gagal memicu tes notifikasi: ' + (err?.message || 'Error'));
    } finally {
      setIsTestingPush(false);
    }
  };

  // Request browser notification permission + auto-subscribe
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      setPermission(Notification.permission);
      if (Notification.permission === 'granted') {
        subscribeToWebPush();
      }
      // Note: Di iOS / iPadOS (Safari & PWA Standalone), memanggil Notification.requestPermission()
      // tanpa interaksi langsung dari user (gesture click) akan ditolak / throw error oleh WebKit.
      // Oleh karena itu, permintaan izin hanya dilakukan saat user menekan tombol aktifkan notifikasi.
    } catch (e) {
      console.warn('[Notification] Check permission warning:', e);
    }
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Supabase real-time subscription & Fetch missed notifications
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // PRIMARY data source: load from Supabase DB on every app open
    const loadNotificationsFromDB = async () => {
      try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // last 7 days

        const { data, error } = await supabase
          .from('notifications_log')
          .select('*')
          .gt('created_at', since)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error || !data) return;

        const readIds = getReadIds();

        // Don't re-show notifications user already dismissed via clearAll
        let dismissedIds: Set<string>;
        try {
          const dismissed = localStorage.getItem('aksara_dismissed_ids');
          dismissedIds = dismissed ? new Set(JSON.parse(dismissed)) : new Set();
        } catch { dismissedIds = new Set(); }

        const dbNotifications = data
          .filter(dbNotif => !dismissedIds.has(`db_${dbNotif.id}`))
          .filter(dbNotif => {
            // Absensi bersifat privasi karyawan: kecualikan dari notifikasi tim
            const t = (dbNotif.title || '').toLowerCase();
            const m = (dbNotif.message || '').toLowerCase();
            if (t.includes('absensi') || t.includes('presensi') || t.includes('cuti/sakit') || m.includes('presensi') || m.includes('absen')) {
              return false;
            }
            return true;
          })
          .map(dbNotif => ({
            id: `db_${dbNotif.id}`,
            title: dbNotif.title,
            message: dbNotif.message,
            timestamp: dbNotif.created_at,
            read: readIds.has(`db_${dbNotif.id}`),
            priority: dbNotif.priority as 'P1' | 'P2' | 'P3'
          }));

        // Merge DB notifications with any in-app realtime notifications already in state
        setNotifications(prev => {
          const realtimeOnly = prev.filter(n => !n.id.startsWith('db_')); // keep realtime notifs
          const merged = [...dbNotifications, ...realtimeOnly];
          merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          return merged.slice(0, 50);
        });

      } catch (err) {
        console.warn('Failed to load notifications from DB:', err);
      }
    };

    loadNotificationsFromDB();

    const channelId = `riksasync_notif_${isFloating ? 'floating' : 'navbar'}_${Math.random().toString(36).substring(2, 11)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        (payload: any) => {
          const eventType = payload.eventType;
          const schedule = payload.new;

          if (!schedule || !schedule.id) return;

          const notifMeta = formatScheduleNotification(
            schedule,
            eventType === 'UPDATE' ? 'UPDATE' : 'INSERT'
          );

          const notif: AppNotification = {
            id: `notif_${Date.now()}_${schedule.id}`,
            title: notifMeta.title,
            message: notifMeta.body,
            timestamp: new Date().toISOString(),
            read: false,
            priority: notifMeta.priority,
          };

          setNotifications(prev => [notif, ...prev]);

          // Play custom sound
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length + (showInstallCard ? 1 : 0);

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveReadIds(new Set(updated.map(n => n.id)));
      return updated;
    });
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveReadIds(new Set(updated.filter(n => n.read).map(n => n.id)));
      return updated;
    });
  };
  
  const clearAll = () => {
    if (confirm('Hapus seluruh riwayat notifikasi?')) {
      // Mark all as read in localStorage (we can't delete from DB from client)
      const readIds = getReadIds();
      notifications.forEach(n => readIds.add(n.id));
      saveReadIds(readIds);
      // Store dismissed IDs so they don't re-appear from DB
      try { localStorage.setItem('aksara_dismissed_ids', JSON.stringify([...readIds])); } catch {}
      setNotifications([]);
    }
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={isFloating ? `fixed bottom-6 right-6 z-40 ${className}` : `relative ${className}`} 
      ref={popoverRef}
    >
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={isFloating
          ? "p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer active:scale-95 transition-all border-0 focus:outline-none"
          : "relative p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        }
        title="Pusat Notifikasi Real-time"
      >
        {unreadCount > 0 ? (
          <>
            <BellRing className={isFloating ? "h-6 w-6 text-white animate-pulse" : "h-5 w-5 text-emerald-600 animate-pulse"} />
            <span className={isFloating
              ? "absolute top-0 right-0 h-5 w-5 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
              : "absolute top-0 right-0 h-4 w-4 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white shadow-sm"
            }>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </>
        ) : (
          <Bell className={isFloating ? "h-6 w-6 text-white" : "h-5 w-5"} />
        )}
      </button>

      {/* Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={isFloating 
              ? { opacity: 0, y: 20, scale: 0.95 }
              : { opacity: 0, y: -10, scale: 0.95 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={isFloating 
              ? { opacity: 0, y: 20, scale: 0.95 }
              : { opacity: 0, y: -10, scale: 0.95 }
            }
            transition={{ duration: 0.15 }}
            className={isFloating
              ? "fixed bottom-22 right-4 left-4 max-w-md md:absolute md:bottom-auto md:top-full md:right-0 md:left-auto md:w-80 bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col z-50 text-left"
              : "fixed inset-x-3 top-14 max-w-sm ml-auto sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-3 sm:w-80 bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col z-50 origin-top-right text-left"
            }
          >
            {/* Header */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-800">Pusat Notifikasi</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleReSubscribe}
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer border-0 bg-transparent"
                  title="Sinkronisasi Ulang Push Notifikasi"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer border-0 bg-transparent"
                    title="Tandai Semua Telah Dibaca"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer border-0 bg-transparent"
                  title="Bersihkan Semua"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Banner HP Status / Test Action Bar */}
            {permission === 'granted' ? (
              <div className="bg-emerald-50/80 px-3.5 py-2.5 border-b border-emerald-100 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-extrabold text-emerald-800">Banner HP Aktif ✅</span>
                </div>
                <button
                  onClick={handleSendTestPush}
                  disabled={isTestingPush}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                  title="Kirim notifikasi tes untuk memastikan banner dan suara muncul di HP Anda"
                >
                  {isTestingPush ? (
                    <>
                      <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <>
                      <span>🧪 Tes Suara / Banner</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-3.5 py-2.5 border-b border-emerald-200 flex items-center justify-between gap-2 shrink-0">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-emerald-950 flex items-center gap-1">
                    <span>🔔</span> Notifikasi Belum Aktif
                  </p>
                  <p className="text-[9px] text-emerald-700 leading-tight">
                    Aktifkan agar jadwal baru meluncur ke HP Anda.
                  </p>
                </div>
                <button
                  onClick={handleReSubscribe}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shrink-0 cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1"
                >
                  <span>🔔</span>
                  <span>Izinkan Notif Banner</span>
                </button>
              </div>
            )}

            {/* Notification List */}
            <div className="max-h-[45vh] overflow-y-auto scrollbar-thin bg-white flex-1 p-0">
              {notifications.length === 0 && !showInstallCard ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Inbox className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-[11px] font-medium">Belum ada notifikasi baru.</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-50">

                  {/* ── PERSISTENT PWA INSTALL CARD (always on top) ── */}
                  {showInstallCard && (
                    <div className="relative overflow-hidden">
                      {/* Gradient background strip */}
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-400/5 to-transparent pointer-events-none" />
                      <div className="p-3.5 relative">
                        <div className="flex gap-2.5 items-start">
                          {/* Unread dot */}
                          <div className="shrink-0 mt-1.5 w-2 flex justify-center">
                            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Smartphone className="h-3 w-3 text-emerald-600 shrink-0" />
                              <p className="text-xs font-bold text-slate-900 truncate">
                                📲 Install AksaraSync AI
                              </p>
                            </div>
                            <p className="text-[10px] leading-relaxed text-slate-600">
                              {isIOS
                                ? 'Tambahkan ke Home Screen agar bisa dibuka seperti aplikasi native tanpa perlu buka browser!'
                                : 'Install aplikasi ke perangkat Anda agar bisa dibuka langsung dari taskbar / home screen — tanpa browser!'}
                            </p>

                            {/* iOS Tip */}
                            <AnimatePresence>
                              {isIOS && showIOSTip && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-2 p-2.5 bg-teal-50 border border-teal-200 rounded-lg"
                                >
                                  <p className="text-[10px] text-teal-800 font-medium leading-relaxed">
                                    Di Safari: Tap ikon <strong>Share (⬆)</strong> → pilih <strong>"Add to Home Screen"</strong> → tap <strong>Add</strong>.
                                  </p>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={handleInstallClick}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border-0 shadow-sm"
                              >
                                <Download className="h-3 w-3" />
                                {isIOS ? 'Cara Install (iOS)' : 'Install Sekarang'}
                              </button>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                PWA
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markAsRead(notif.id)}
                      className={`p-3.5 cursor-pointer transition-colors ${
                        notif.read ? 'bg-white hover:bg-slate-50' : 'bg-emerald-50/40 hover:bg-emerald-50/70'
                      }`}
                    >
                      <div className="flex gap-2.5">
                        <div className="shrink-0 mt-0.5 w-2 flex justify-center">
                          {!notif.read && <div className="h-2 w-2 bg-emerald-500 rounded-full" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${notif.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900'} truncate`}>
                            {notif.title}
                          </p>
                          <p className={`text-[10px] mt-0.5 leading-relaxed ${notif.read ? 'text-slate-500' : 'text-slate-600'}`}>
                            {notif.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[9px] font-mono text-slate-400">{formatTime(notif.timestamp)}</span>
                            {notif.priority && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                notif.priority === 'P1' ? 'bg-rose-100 text-rose-700' : 
                                notif.priority === 'P2' ? 'bg-amber-100 text-amber-700' : 
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {notif.priority}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
