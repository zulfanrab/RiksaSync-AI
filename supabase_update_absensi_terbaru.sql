-- ============================================================
-- SQL PATCH: Update Kolom Baru Absensi & Izin Update/Edit (Khusus IT)
-- ============================================================
-- Jalankan di Supabase SQL Editor.
-- Script ini 100% AMAN:
-- - Tidak menghapus atau mereset data apapun.
-- - Menambahkan kolom baru jika belum ada.
-- - Mengaktifkan izin UPDATE agar waktu absen bisa diedit langsung.
-- ============================================================

ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS work_location_type TEXT DEFAULT 'Kantor';
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS building_name TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS address TEXT;

-- Pastikan indeks query riwayat cepat tetap aktif
CREATE INDEX IF NOT EXISTS idx_attendance_logs_created_at ON attendance_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_email ON attendance_logs(employee_email);

-- Kebijakan RLS: Pastikan izin UPDATE & DELETE aktif
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select attendance_logs" ON attendance_logs;
CREATE POLICY "Allow select attendance_logs" ON attendance_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert attendance_logs" ON attendance_logs;
CREATE POLICY "Allow insert attendance_logs" ON attendance_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update attendance_logs" ON attendance_logs;
CREATE POLICY "Allow update attendance_logs" ON attendance_logs FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete attendance_logs" ON attendance_logs;
CREATE POLICY "Allow delete attendance_logs" ON attendance_logs FOR DELETE USING (true);
