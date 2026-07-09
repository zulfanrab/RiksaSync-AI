import React, { useState } from 'react';
import { X, BookOpen, Sparkles, Calendar, Users, Phone, ShieldAlert, Award } from 'lucide-react';

interface GuideModalProps {
  onClose: () => void;
}

export default function GuideModal({ onClose }: GuideModalProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedule' | 'manpower' | 'whatsapp'>('dashboard');

  const tabs = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard & AI',
      icon: Sparkles,
      title: '🛠️ Bab 1: Ringkasan Dashboard & Gemini AI',
      description: 'Halaman utama dilengkapi analitik cerdas dan ringkasan cuaca operasional.',
      bullets: [
        'Pusat Ringkasan Gemini AI: Mensintesis jadwal aktif dan status tim secara instan. Cukup klik "Sintesis Ulang" jika ada jadwal baru.',
        'Laporan Cuaca Lapangan: Menampilkan perkiraan suhu, angin, dan kelembaban hari ini untuk acuan keselamatan tim luar ruangan.'
      ],
      image: '/guide/dashboard_main.png'
    },
    {
      id: 'schedule' as const,
      label: 'Jadwal & Plotting',
      icon: Calendar,
      title: '📅 Bab 2: Manajemen Jadwal & Riksa Uji',
      description: 'Mengatur proyek pengujian berdasarkan tanggal, unit K3, dan prioritas.',
      bullets: [
        'Kalender Interaktif: Menampilkan jadwal per bulan/minggu dengan indikator warna status (Selesai 🟢, Aktif 🔵, Draf 🟡, Batal 🔴).',
        'Formulir Responsif: Kolom Tanggal/Jam sudah dioptimalkan agar rapi dan tidak meluap di HP.',
        'AI Auto-Plotter: Secara otomatis menyarankan Tenaga Ahli yang memiliki lisensi SKP cocok dan bebas jadwal.'
      ],
      image: '/guide/add_plotting.png'
    },
    {
      id: 'manpower' as const,
      label: 'Tenaga Ahli & Absensi',
      icon: Users,
      title: '👥 Bab 3: Manajemen Manpower & Absensi',
      description: 'Sistem pencatatan kehadiran dan validasi kesiapan kerja personil.',
      bullets: [
        'Direktori Manpower: Daftarkan tenaga ahli baru lengkap dengan spesialisasi sertifikasi lisensi SKP.',
        'Smart Lock Absensi: Mencatat status Sakit 🤒, Cuti 🏖️, atau Izin 📝. Sistem otomatis memblokir penugasan jika personil sedang absen.'
      ],
      image: '/guide/kelola_manpower.png'
    },
    {
      id: 'whatsapp' as const,
      label: 'WhatsApp Dispatcher',
      icon: Phone,
      title: '💬 Bab 4: Dispatcher Notifikasi WhatsApp',
      description: 'Mengirim teks koordinasi otomatis ke grup lapangan tanpa salin-tempel manual.',
      bullets: [
        'Penyusunan Otomatis: Klik ikon WA di samping detail kegiatan untuk menyusun template notifikasi.',
        'Template Profesional: Notifikasi mencakup detail proyek, jam operasional, daftar tim ahli, dan panduan keselamatan K3.',
        'Kirim Langsung: Tombol mengarahkan langsung ke WhatsApp seluler maupun WhatsApp Web komputer.'
      ],
      image: '/guide/add_plotting.png'
    }
  ];

  const activeContent = tabs.find(t => t.id === activeTab)!;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col text-slate-800 overflow-hidden w-full max-w-4xl h-[92vh] md:h-[75vh] transition-all animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-700 border border-emerald-200">
              <BookOpen className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight uppercase">
                Panduan Penggunaan AksaraSync AI
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Panduan Cepat Sistem Informasi Penjadwalan & Koordinasi K3</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-250/20 transition-all cursor-pointer border-0 bg-transparent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Inner Content split in Left Sidebar and Right View */}
        <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
          {/* Left Sidebar Menu */}
          <div className="w-full md:w-60 bg-slate-50 border-r border-slate-100 p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-x-visible md:overflow-y-auto shrink-0 scrollbar-none">
            {tabs.map(t => {
              const TabIcon = t.icon;
              const isActive = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`w-auto md:w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border-0 text-left ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/50'
                  }`}
                >
                  <TabIcon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight mb-1">
                  {activeContent.title}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">{activeContent.description}</p>
              </div>

              {/* Bullet points */}
              <div className="space-y-2.5">
                {activeContent.bullets.map((bullet, idx) => {
                  const parts = bullet.split(':');
                  return (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 shrink-0 animate-pulse" />
                      <p>
                        {parts.length > 1 ? (
                          <>
                            <strong className="text-slate-800 font-bold">{parts[0]}:</strong>
                            <span>{parts.slice(1).join(':')}</span>
                          </>
                        ) : (
                          bullet
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Visual Screenshot display */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100/50 max-h-56 relative group shadow-sm shrink-0">
              <img
                src={activeContent.image}
                alt={activeContent.label}
                className="w-full h-full object-cover object-top transition-all duration-300 group-hover:scale-102"
              />
              <div className="absolute inset-0 bg-slate-900/10 pointer-events-none" />
              <div className="absolute bottom-2 left-2 bg-slate-900/60 text-white text-[9px] font-mono px-2 py-0.5 rounded backdrop-blur-xs font-bold tracking-wider">
                SCREENSHOT DEMO
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between bg-slate-50 border-t border-slate-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-medium">AksaraSync AI Panduan Pengguna v2.1</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer border-0"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
}
