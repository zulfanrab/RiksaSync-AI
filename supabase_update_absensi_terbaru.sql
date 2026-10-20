-- ============================================================
-- SQL PATCH: Update Kolom Baru Absensi (Kantor, On Site, WFH, Gedung)
-- ============================================================
-- Jalankan HANYA script ini di Supabase SQL Editor.
-- Script ini 100% AMAN:
-- - Tidak menghapus atau mereset data apapun.
-- - Hanya menambahkan kolom baru jika belum ada.
-- ============================================================

ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS work_location_type TEXT DEFAULT 'Kantor';
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS building_name TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS address TEXT;

-- Pastikan indeks query riwayat cepat tetap aktif
CREATE INDEX IF NOT EXISTS idx_attendance_logs_created_at ON attendance_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_email ON attendance_logs(employee_email);
