-- ============================================================
-- MIGRATION: Supabase Auth & Attendance Module for RiksaSyncs
-- ============================================================
-- Jalankan script ini di Supabase Dashboard -> SQL Editor
-- 
-- JAWABAN TENTANG DATA LAMA:
-- 1. Tabel-tabel operasional utama (schedules, manpower, clients,
--    units, team_tasks, inspection_jobs) TIDAK AKAN HILANG / TERHAPUS.
-- 2. Script ini HANYA memodifikasi tabel `app_users` (profil akun)
--    dan membuat tabel baru `attendance_logs` (riwayat absensi).
-- 3. Data lama di `app_users` dibersihkan lalu diperbarui ke 11 karyawan
--    resmi agar tidak terjadi bentrok ID lama (u1, u2, dst).
-- ============================================================

-- 1. Upgrade tabel app_users dengan kolom baru (jika belum ada)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'Umum';

-- 2. Daftarkan / Perbarui 11 Karyawan Resmi (Aman: Menggunakan UPSERT tanpa hapus data lama)
INSERT INTO app_users (id, username, role, email, full_name, division) VALUES
  ('u1',  'Angga',    'Leader & Ahli Utama', 'angga@aksarariksapjk3.com',    'Rama Regawa Sri Anggayana',       'Ahli'),
  ('u2',  'Imam',     'Ahli Spesialis',      'imam@aksarariksapjk3.com',     'Lalu Imam Taufik Rahman Hidayat', 'Ahli'),
  ('u3',  'Fauzan',   'Ahli Spesialis',      'fauzan@aksarariksapjk3.com',   'Fauzan Akmaluddin',               'Ahli'),
  ('u4',  'Fakhziar', 'Ahli Spesialis',      'fakhziar@aksarariksapjk3.com', 'Fakhziar Wildan Hidayat',         'Ahli'),
  ('u5',  'Fazar',    'Ahli Spesialis',      'fazar@aksarariksapjk3.com',    'Muhammad Fazar Maulana',          'Ahli'),
  ('u6',  'Arya',     'Support Staff',       'arya@aksarariksapjk3.com',     'Arya Rizki Pratama',              'Admin'),
  ('u7',  'Rio',      'Support Staff',       'rio@aksarariksapjk3.com',      'Rio Andrian',                     'Admin'),
  ('u8',  'Aulia',    'Support Staff',       'aulia@aksarariksapjk3.com',    'Aulia Zahra Dikrika',             'Admin'),
  ('u9',  'Disa',     'Support Staff',       'disa@aksarariksapjk3.com',     'Disa Liestianie Putri',           'Admin'),
  ('u10', 'Marsya',   'Support Staff',       'marsya@aksarariksapjk3.com',   'Marsya Aulia Rohman',             'Admin'),
  ('u11', 'Zulfan',   'IT Staff',            'zulfan@aksarariksapjk3.com',   'Zulfan Rafly Baihaqi',            'IT')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  role = EXCLUDED.role,
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  division = EXCLUDED.division;

-- 4. Trigger otomatis untuk menghubungkan auth_id saat user dibuat di Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_auth_user_link()
RETURNS trigger AS $$
BEGIN
  UPDATE public.app_users
  SET auth_id = NEW.id
  WHERE LOWER(email) = LOWER(NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_link();

-- Link existing auth users jika sudah pernah dibuat sebelumnya
UPDATE public.app_users u
SET auth_id = a.id
FROM auth.users a
WHERE LOWER(u.email) = LOWER(a.email) AND u.auth_id IS NULL;

-- 5. Tabel Log Absensi (Attendance Records) di Supabase
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name TEXT NOT NULL,
  employee_email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Masuk', 'Pulang', 'Sakit', 'Cuti')),
  work_location_type TEXT DEFAULT 'Kantor' CHECK (work_location_type IN ('Kantor', 'On Site', 'WFH')),
  building_name TEXT,
  location_name TEXT,
  address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  photo_drive_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration fallback jika tabel attendance_logs sudah dibuat sebelumnya
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS work_location_type TEXT DEFAULT 'Kantor';
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS building_name TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS address TEXT;

-- Indeks untuk query riwayat absensi cepat per tanggal dan karyawan
CREATE INDEX IF NOT EXISTS idx_attendance_logs_created_at ON attendance_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_email ON attendance_logs(employee_email);

-- RLS untuk attendance_logs
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select attendance_logs" ON attendance_logs;
CREATE POLICY "Allow select attendance_logs" ON attendance_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert attendance_logs" ON attendance_logs;
CREATE POLICY "Allow insert attendance_logs" ON attendance_logs FOR INSERT WITH CHECK (true);
