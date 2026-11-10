-- ==============================================================================
-- MIGRATION: 003_rls_policies.sql
-- Module: Penomoran Surat (Document Numbering)
-- Description: Strict Row Level Security policies and privilege revocations.
-- Idempotent: Yes
-- ==============================================================================

-- 1. AKTIFKAN RLS PADA SELURUH TABEL pn_*
ALTER TABLE public.pn_profil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pn_jenis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pn_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pn_nomor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pn_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pn_sync_log ENABLE ROW LEVEL SECURITY;

-- 2. CABUT HAK AKSES MUTASI LANGSUNG DARI ROLE AUTHENTICATED & ANON
-- Direct INSERT, UPDATE, DELETE pada pn_nomor, pn_counter, dan pn_log DILARANG KERAS.
-- Seluruh nomor hanya boleh diterbitkan/diubah via fungsi SECURITY DEFINER.
REVOKE INSERT, UPDATE, DELETE ON public.pn_nomor FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.pn_counter FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.pn_log FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.pn_sync_log FROM authenticated, anon, public;

-- Berikan izin SELECT untuk pengguna terautentikasi
GRANT SELECT ON public.pn_profil TO authenticated;
GRANT SELECT ON public.pn_jenis TO authenticated;
GRANT SELECT ON public.pn_counter TO authenticated;
GRANT SELECT ON public.pn_nomor TO authenticated;
GRANT SELECT ON public.pn_log TO authenticated;
GRANT SELECT ON public.pn_sync_log TO authenticated;

-- Berikan hak eksekusi fungsi inti
GRANT EXECUTE ON FUNCTION public.pn_ambil_nomor(TEXT, TEXT, TEXT, TEXT, UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pn_batalkan(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pn_ubah(UUID, TEXT, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pn_is_admin(UUID) TO authenticated;

-- 3. POLICIES: pn_profil
DROP POLICY IF EXISTS "pn_profil_select_all" ON public.pn_profil;
CREATE POLICY "pn_profil_select_all"
  ON public.pn_profil
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "pn_profil_admin_manage" ON public.pn_profil;
CREATE POLICY "pn_profil_admin_manage"
  ON public.pn_profil
  FOR ALL
  TO authenticated
  USING (public.pn_is_admin(auth.uid()))
  WITH CHECK (public.pn_is_admin(auth.uid()));

-- 4. POLICIES: pn_jenis
DROP POLICY IF EXISTS "pn_jenis_select_all" ON public.pn_jenis;
CREATE POLICY "pn_jenis_select_all"
  ON public.pn_jenis
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "pn_jenis_admin_manage" ON public.pn_jenis;
CREATE POLICY "pn_jenis_admin_manage"
  ON public.pn_jenis
  FOR ALL
  TO authenticated
  USING (public.pn_is_admin(auth.uid()))
  WITH CHECK (public.pn_is_admin(auth.uid()));

-- 5. POLICIES: pn_counter
DROP POLICY IF EXISTS "pn_counter_select_all" ON public.pn_counter;
CREATE POLICY "pn_counter_select_all"
  ON public.pn_counter
  FOR SELECT
  TO authenticated
  USING (true);

-- 6. POLICIES: pn_nomor (Semua user login bisa melihat; modifikasi hanya via SECURITY DEFINER)
DROP POLICY IF EXISTS "pn_nomor_select_all" ON public.pn_nomor;
CREATE POLICY "pn_nomor_select_all"
  ON public.pn_nomor
  FOR SELECT
  TO authenticated
  USING (true);

-- 7. POLICIES: pn_log
DROP POLICY IF EXISTS "pn_log_select_all" ON public.pn_log;
CREATE POLICY "pn_log_select_all"
  ON public.pn_log
  FOR SELECT
  TO authenticated
  USING (true);

-- 8. POLICIES: pn_sync_log
DROP POLICY IF EXISTS "pn_sync_log_select_all" ON public.pn_sync_log;
CREATE POLICY "pn_sync_log_select_all"
  ON public.pn_sync_log
  FOR SELECT
  TO authenticated
  USING (true);

-- ==============================================================================
-- ROLLBACK NOTE:
-- Untuk membatalkan konfigurasi RLS dan permissions ini, jalankan:
-- DROP POLICY IF EXISTS "pn_sync_log_select_all" ON public.pn_sync_log;
-- DROP POLICY IF EXISTS "pn_log_select_all" ON public.pn_log;
-- DROP POLICY IF EXISTS "pn_nomor_select_all" ON public.pn_nomor;
-- DROP POLICY IF EXISTS "pn_counter_select_all" ON public.pn_counter;
-- DROP POLICY IF EXISTS "pn_jenis_admin_manage" ON public.pn_jenis;
-- DROP POLICY IF EXISTS "pn_jenis_select_all" ON public.pn_jenis;
-- DROP POLICY IF EXISTS "pn_profil_admin_manage" ON public.pn_profil;
-- DROP POLICY IF EXISTS "pn_profil_select_all" ON public.pn_profil;
-- ALTER TABLE public.pn_sync_log DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.pn_log DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.pn_nomor DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.pn_counter DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.pn_jenis DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.pn_profil DISABLE ROW LEVEL SECURITY;
-- ==============================================================================
