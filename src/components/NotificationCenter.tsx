import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, BellRing, Inbox } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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

export default function NotificationCenter({ isFloating = false, className = '' }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load notifications from local storage on mount
  useEffect(() => {
    const savedNotifs = localStorage.getItem('aksara_notifications');
    if (savedNotifs) {
      try {
        setNotifications(JSON.parse(savedNotifs));
      } catch (e) {
        console.error('Error parsing notifications', e);
      }
    }
  }, []);

  // Sync notifications to local storage
  useEffect(() => {
    localStorage.setItem('aksara_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => setPermission(p));
      }
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

  // Supabase real-time subscription
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel('public:riksasync_notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        (payload: any) => {
          const eventType = payload.eventType;
          const schedule = payload.new;

          if (!schedule || !schedule.id) return;

          let title = '';
          let message = '';
          let priority = schedule.priority || 'P3';

          if (eventType === 'INSERT') {
            title = '📅 Agenda Baru Masuk!';
            message = `[${schedule.agenda_type || 'Riksa Uji'}] ${schedule.client_name || 'Klien Baru'} oleh ${schedule.pic_name || 'Tim'}.`;
          } else if (eventType === 'UPDATE') {
            if (schedule.status === 'Completed') {
              title = '✅ Agenda Selesai!';
              message = `Pengerjaan untuk ${schedule.client_name} telah selesai dilaksanakan.`;
              priority = 'P3';
            } else if (schedule.status === 'Cancelled') {
              title = '⚠️ Agenda Dibatalkan';
              message = `Jadwal [${schedule.agenda_type || 'Riksa Uji'}] ${schedule.client_name} dibatalkan.`;
              priority = 'P1';
            } else {
              title = '🔄 Agenda Reschedule / Diperbarui';
              message = `Jadwal ${schedule.client_name} (${schedule.agenda_type || 'Riksa Uji'}) diperbarui ke tanggal ${schedule.start_date}.`;
            }
          } else {
            return; // Ignore deletes
          }

          const notif: AppNotification = {
            id: `notif_${Date.now()}_${schedule.id}`,
            title,
            message,
            timestamp: new Date().toISOString(),
            read: false,
            priority,
          };

          setNotifications(prev => [notif, ...prev]);

          // Play custom sound
          playNotificationSound();

          // Native notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notif.title, {
              body: notif.message,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'manpower_absences' },
        (payload: any) => {
          const absence = payload.new;
          if (!absence) return;

          supabase
            .from('manpower')
            .select('name')
            .eq('id', absence.manpower_id)
            .single()
            .then(({ data }) => {
              const name = data?.name || 'Staf';
              const notif: AppNotification = {
                id: `notif_${Date.now()}_${absence.id}`,
                title: `🏥 Absensi K3: ${absence.absence_type}`,
                message: `${name} mengajukan ${absence.absence_type} pada ${absence.date}${absence.reason ? ` (${absence.reason})` : ''}.`,
                timestamp: new Date().toISOString(),
                read: false,
                priority: 'P2',
              };

              setNotifications(prev => [notif, ...prev]);

              // Play custom sound
              playNotificationSound();

              // Native notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(notif.title, {
                  body: notif.message,
                });
              }
            })
            .catch(err => {
              console.error('Error retrieving manpower name for absence', err);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
  
  const clearAll = () => {
    if (confirm('Hapus seluruh riwayat notifikasi?')) {
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
              : "absolute top-full right-0 mt-3 w-80 bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col z-50 origin-top-right text-left"
            }
          >
            {/* Header */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-800">Pusat Notifikasi</h3>
              </div>
              <div className="flex items-center gap-1.5">
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

            {/* Notification List */}
            <div className="max-h-[45vh] overflow-y-auto scrollbar-thin bg-white flex-1 p-0">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Inbox className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-[11px] font-medium">Belum ada notifikasi baru.</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-50">
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
            
            {/* Permission Alert (Optional) */}
            {permission !== 'granted' && (
              <div className="bg-amber-50 p-2 text-[9px] font-medium text-amber-800 border-t border-amber-100 shrink-0 text-center">
                Izin Push Notifikasi belum diberikan.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
