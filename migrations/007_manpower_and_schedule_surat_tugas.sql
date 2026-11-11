-- ==============================================================================
-- MIGRATION 007: PERSIAPAN AUTO-GENERATE PDF SURAT TUGAS
-- PT AKSARA RIKSA PERDANA (PJK3)
-- ==============================================================================

-- 1. Tambahkan kolom pendukung cetak PDF Surat Tugas pada tabel manpower
ALTER TABLE public.manpower 
  ADD COLUMN IF NOT EXISTS nama_panggilan TEXT,
  ADD COLUMN IF NOT EXISTS nama_lengkap TEXT,
  ADD COLUMN IF NOT EXISTS nik TEXT,
  ADD COLUMN IF NOT EXISTS jabatan_resmi TEXT,
  ADD COLUMN IF NOT EXISTS kategori_tim TEXT DEFAULT 'Internal',
  ADD COLUMN IF NOT EXISTS status_aktif BOOLEAN DEFAULT true;

-- 2. Isi default data lama agar tidak null
UPDATE public.manpower
SET 
  nama_panggilan = COALESCE(nama_panggilan, name),
  nama_lengkap = COALESCE(nama_lengkap, name),
  jabatan_resmi = COALESCE(jabatan_resmi, role),
  kategori_tim = COALESCE(kategori_tim, CASE WHEN status = 'external' THEN 'Eksternal' ELSE 'Internal' END),
  status_aktif = COALESCE(status_aktif, true)
WHERE nama_panggilan IS NULL OR nama_lengkap IS NULL OR kategori_tim IS NULL;

-- 3. Tambahkan kolom alamat lokasi proyek dan rincian tim support pada tabel schedules
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS client_address TEXT,
  ADD COLUMN IF NOT EXISTS support_team_details JSONB;

-- 4. Notifikasi
COMMENT ON COLUMN public.manpower.nama_panggilan IS 'Nama panggilan untuk label UI / checklist';
COMMENT ON COLUMN public.manpower.nama_lengkap IS 'Nama lengkap resmi dengan gelar untuk dicetak di PDF';
COMMENT ON COLUMN public.manpower.nik IS 'Nomor Induk Kependudukan / Karyawan untuk PDF Surat Tugas';
COMMENT ON COLUMN public.manpower.jabatan_resmi IS 'Jabatan resmi lengkap untuk dicetak di PDF Surat Tugas';
COMMENT ON COLUMN public.manpower.kategori_tim IS 'Kategori kepegawaian: Internal atau Eksternal';
COMMENT ON COLUMN public.manpower.status_aktif IS 'Status keaktifan personel (true/false)';
COMMENT ON COLUMN public.schedules.client_address IS 'Alamat lengkap lokasi proyek/klien wajib untuk Surat Tugas';
COMMENT ON COLUMN public.schedules.support_team_details IS 'Snapshot data lengkap tim support (nama lengkap, nik, jabatan) saat jadwal dibuat';

