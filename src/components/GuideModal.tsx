import React from 'react';
import { X, BookOpen, Info, Calendar, Users, MessageSquare, Database, Smartphone } from 'lucide-react';

interface GuideModalProps {
  onClose: () => void;
}

export default function GuideModal({ onClose }: GuideModalProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col text-slate-800 overflow-hidden w-full max-w-4xl max-h-[92vh] md:max-h-[85vh] transition-all animate-fadeIn">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-700 border border-emerald-200">
              <BookOpen className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-850 text-sm md:text-base tracking-tight uppercase">
                Buku Panduan Penggunaan Aplikasi
              </h3>
              <p className="text-[10px] text-slate-450 mt-0.5">Sistem Informasi Penjadwalan & Koordinasi K3 (PJK3) — PT Aksara Riksa Perdana</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-650 p-1.5 rounded-lg hover:bg-slate-200/50 transition-all cursor-pointer border-0 bg-transparent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 p-6 md:p-8 space-y-6 scrollbar-thin">
          <div className="bg-emerald-50/30 border border-emerald-100/50 p-4 rounded-xl text-xs leading-relaxed text-slate-700">
            <p className="font-bold text-slate-850 text-[13px] flex items-center gap-1.5 mb-1 text-emerald-800">
              <Info className="h-4 w-4 shrink-0" />
              Tentang AksaraSync AI
            </p>
            Sistem ini dirancang untuk memastikan pengerjaan inspeksi alat, pengujian teknik K3, dan mobilisasi tim di lapangan berjalan dengan aman, terstruktur, serta terpantau secara real-time.
          </div>

          <div className="space-y-6">
            {/* BAB 1 */}
            <div className="space-y-2.5 border-b border-slate-100 pb-5">
              <h4 className="font-bold text-slate-800 text-xs md:text-sm flex items-center gap-2 text-emerald-700">
                <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">BAB 1</span>
                <span>🛠️ RINGKASAN DASHBOARD TERPADU</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Saat pertama kali masuk ke aplikasi, Anda akan disajikan halaman utama (Dashboard) yang berisi widget analitik cerdas dan ringkasan cuaca operasional.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
                <li>
                  <strong className="text-slate-800">1. Pusat Ringkasan Operasional Terpadu (Gemini AI):</strong> Widget ini menggunakan teknologi Kecerdasan Buatan (Gemini AI) untuk mensintesis seluruh jadwal aktif dan status tim secara instan.
                  <ul className="list-circle pl-5 mt-1 space-y-1 text-slate-500">
                    <li><strong className="text-slate-700">Analisis Cerdas:</strong> Gemini AI membaca seluruh jadwal kegiatan di database dan menyusun narasi ringkasan eksekutif mengenai pengerjaan hari ini, proyek krusial minggu ini, serta potensi bentrok penugasan.</li>
                    <li><strong className="text-slate-700">Sintesis Ulang (Refresh):</strong> Klik tombol Sintesis Ulang atau Refresh pada sudut kanan atas widget untuk memaksa AI menganalisis data terbaru jika Anda baru saja mengubah atau menambahkan jadwal.</li>
                  </ul>
                </li>
                <li>
                  <strong className="text-slate-800">2. Laporan Cuaca Lapangan Hari Ini:</strong> Terintegrasi pada baris atas ringkasan operasional sebagai acuan keamanan K3 luar ruangan (outdoor). Menampilkan data perkiraan suhu (28°C - 33°C), kecepatan angin, dan tingkat kelembaban. Digunakan oleh koordinator untuk memastikan kondisi lapangan aman sebelum mengonfirmasi mobilisasi tim teknik K3 ke lokasi industri atau ketinggian.
                </li>
              </ul>
            </div>

            {/* BAB 2 */}
            <div className="space-y-2.5 border-b border-slate-100 pb-5">
              <h4 className="font-bold text-slate-800 text-xs md:text-sm flex items-center gap-2 text-emerald-700">
                <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">BAB 2</span>
                <span>📅 MANAJEMEN JADWAL KEGIATAN & INSPEKSI</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Modul ini adalah jantung dari aplikasi, tempat di mana seluruh proyek pengujian riksa uji diatur berdasarkan tanggal, jam kerja, unit spesifik, dan tingkat prioritas.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
                <li>
                  <strong className="text-slate-800">1. Kalender Kegiatan Interaktif:</strong>
                  <ul className="list-circle pl-5 mt-1 space-y-1 text-slate-500">
                    <li><strong className="text-slate-700">Navigasi:</strong> Anda dapat melihat jadwal per bulan, per minggu, atau per hari.</li>
                    <li><strong className="text-slate-700">Indikator Warna Status:</strong> 
                      <span className="inline-flex items-center gap-1 mx-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-250 px-1 py-0.2 rounded">🟢 Completed</span> (Selesai), 
                      <span className="inline-flex items-center gap-1 mx-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-250 px-1 py-0.2 rounded">🔵 Scheduled</span> (Aktif), 
                      <span className="inline-flex items-center gap-1 mx-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-250 px-1 py-0.2 rounded">🟡 Draft</span> (Rencana), dan 
                      <span className="inline-flex items-center gap-1 mx-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-250 px-1 py-0.2 rounded">🔴 Cancelled</span> (Batal).
                    </li>
                  </ul>
                </li>
                <li>
                  <strong className="text-slate-800">2. Formulir Pembuatan & Pengeditan Jadwal:</strong> Klik tombol "Tambah Jadwal" (+). Pengisian formulir dirancang responsif dengan rincian:
                  <ul className="list-circle pl-5 mt-1 space-y-1 text-slate-500">
                    <li><strong className="text-slate-700">Judul Kegiatan:</strong> Tuliskan nama proyek (contoh: Riksa Uji Instalasi Proteksi Kebakaran PT Pertamina).</li>
                    <li><strong className="text-slate-700">Kategori Unit K3:</strong> Pilih unit uji (PAA, PUBT, Proteksi Kebakaran, Listrik/Petir, Elevator/Eskalator, Lingkungan Kerja).</li>
                    <li><strong className="text-slate-700">Lokasi:</strong> Tulis alamat lengkap atau nama pabrik/situs target.</li>
                    <li><strong className="text-slate-700">Tanggal Kegiatan:</strong> Masukkan durasi. Kotak input telah dioptimalkan secara responsif agar sangat rapi di ponsel.</li>
                    <li><strong className="text-slate-700">Jam Kerja / Operasional:</strong> Tentukan jam pengerjaan (contoh: 08:00 hingga 17:00 WIB).</li>
                    <li><strong className="text-slate-700">Prioritas & Manpower:</strong> Tentukan tingkat prioritas riksa serta pilih Tenaga Ahli yang memiliki lisensi SKP cocok untuk memimpin pengerjaan.</li>
                  </ul>
                </li>
              </ul>
            </div>

            {/* BAB 3 */}
            <div className="space-y-2.5 border-b border-slate-100 pb-5">
              <h4 className="font-bold text-slate-800 text-xs md:text-sm flex items-center gap-2 text-emerald-700">
                <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">BAB 3</span>
                <span>👥 MANAJEMEN TENAGA AHLI & ABSENSI</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Keberhasilan inspeksi K3 bergantung pada ketersediaan Tenaga Ahli yang tersertifikasi. Aplikasi dilengkapi sistem validasi kehadiran yang ketat.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
                <li>
                  <strong className="text-slate-800">1. Profil Tenaga Ahli (Manpower):</strong> Akses melalui tombol "Kelola Manpower". Anda dapat mendaftarkan tenaga ahli beserta spesialisasi lisensi SKP mereka (PTP, PAA, PUBT, dll.) serta melihat status kerja mereka secara visual.
                </li>
                <li>
                  <strong className="text-slate-800">2. Sistem Pencatatan Absensi Lapangan:</strong> Mencegah penjadwalan personil yang berhalangan hadir.
                  <ul className="list-circle pl-5 mt-1 space-y-1 text-slate-500">
                    <li><strong className="text-slate-700">Pencatatan Absensi:</strong> Administrator dapat mencatat ketidakhadiran dengan tipe: 🤒 Sakit, 🏖️ Cuti, atau 📝 Izin.</li>
                    <li><strong className="text-slate-700">Validasi Bentrok Otomatis (Smart Lock):</strong> Jika seorang tenaga ahli sedang Cuti atau Sakit pada tanggal tertentu, sistem akan otomatis memblokir dan memberi peringatan jika nama mereka dimasukkan ke dalam jadwal pada rentang tanggal tersebut.</li>
                  </ul>
                </li>
              </ul>
            </div>

            {/* BAB 4 */}
            <div className="space-y-2.5 border-b border-slate-100 pb-5">
              <h4 className="font-bold text-slate-800 text-xs md:text-sm flex items-center gap-2 text-emerald-700">
                <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">BAB 4</span>
                <span>💬 DISPATCHER NOTIFIKASI WHATSAPP</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Untuk mempercepat mobilisasi tanpa menyalin teks secara manual, aplikasi dilengkapi dengan dispatcher pesan WhatsApp otomatis.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
                <li>
                  <strong className="text-slate-800">Penyusunan Otomatis:</strong> Setelah jadwal berhasil disimpan, klik ikon Whatsapp Dispatcher di samping detail kegiatan.
                </li>
                <li>
                  <strong className="text-slate-800">Template Standar Profesional:</strong> Aplikasi menyusun pesan berisi nama proyek, lokasi, waktu pelaksanaan, jam operasional, daftar tenaga ahli yang ditugaskan, dan catatan keselamatan pra-inspeksi.
                </li>
                <li>
                  <strong className="text-slate-800">Kirim Langsung:</strong> Klik tombol "Kirim ke Whatsapp" untuk langsung membuka aplikasi Whatsapp (ponsel) atau Whatsapp Web (komputer).
                </li>
              </ul>
            </div>

            {/* BAB 5 */}
            <div className="space-y-2.5 border-b border-slate-100 pb-5">
              <h4 className="font-bold text-slate-800 text-xs md:text-sm flex items-center gap-2 text-emerald-700">
                <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">BAB 5</span>
                <span>🗄️ INTEGRASI SUPABASE & SQL SCHEMA EDITOR</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Aplikasi menggunakan database Supabase (PostgreSQL Cloud) untuk menjamin seluruh data transaksi, riwayat penugasan, dan data absensi tersimpan dengan aman.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
                <li>
                  <strong className="text-slate-800">Fasilitas SQL Editor Supabase Mandiri:</strong> Akses pop-up database schema melalui menu sistem jika Anda perlu memigrasikan database atau memperbarui struktur tabel.
                </li>
                <li>
                  <strong className="text-slate-800">Langkah Migrasi Cepat:</strong> Salin script SQL yang tersedia di editor, buka dashboard Supabase Console Anda, masuk ke SQL Editor, tempelkan (paste) script, lalu klik Run. Seluruh tabel dan relasi otomatis dibuat dengan sempurna.
                </li>
              </ul>
            </div>

            {/* BAB 6 */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-800 text-xs md:text-sm flex items-center gap-2 text-emerald-700">
                <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">BAB 6</span>
                <span>📱 TIPS PENGGUNAAN PADA PONSEL (MOBILE-FRIENDLY)</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Seluruh bagian dari aplikasi ini telah melewati optimasi visual tingkat tinggi agar nyaman digunakan di lapangan oleh para inspektur:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
                <li>
                  <strong className="text-slate-800">Formulir Fleksibel:</strong> Pengisian kolom tanggal dan jam kerja otomatis bergeser ke bawah (stacked vertically) atau tersusun sejajar secara rapi dan proporsional untuk mencegah kesalahan input jari di HP.
                </li>
                <li>
                  <strong className="text-slate-800">Navigasi Sentuh:</strong> Tombol aksi utama (tambah data, re-sintesis AI, kirim Whatsapp, dan filter kalender) memiliki ukuran minimal 44 piksel agar mudah ditekan secara akurat oleh jempol pengguna.
                </li>
                <li>
                  <strong className="text-slate-800">Tampilan Compact:</strong> Tabel data yang panjang pada desktop akan otomatis menyusut menjadi format Card vertikal yang elegan di layar ponsel pintar.
                </li>
              </ul>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end bg-slate-50 border-t border-slate-100 px-6 py-4 shrink-0">
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
