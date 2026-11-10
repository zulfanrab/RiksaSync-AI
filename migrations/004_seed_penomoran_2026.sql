-- ==============================================================================
-- MIGRATION: 004_seed_penomoran_2026.sql
-- Module: Penomoran Surat (Document Numbering)
-- Description: Master data for 20 document types & starting counter for year 2026
-- Cutoff Date: 10 November 2026 (Verified from manual sheet)
-- Idempotent: Yes (ON CONFLICT DO UPDATE)
-- ==============================================================================

-- 1. SEED pn_jenis (20 Tipe Dokumen Resmi PT Aksara Riksa Perdana)
INSERT INTO public.pn_jenis (
  kode, nama, urutan, kelompok, pad_digit, label_klien, label_perihal, label_ref, aktif
) VALUES
  -- KELOMPOK: TAGIHAN
  ('invoice', 'Invoice', 1, 'tagihan', NULL, 'Klien', 'Perihal / Pekerjaan', 'Ref (No Penawaran / PO / Kontrak)', true),
  ('penawaran', 'Penawaran', 2, 'tagihan', NULL, 'Klien', 'Perihal / Lingkup', 'Ref / Keterangan (mis. Rev)', true),
  ('kontrak', 'Kontrak', 3, 'tagihan', NULL, 'Klien', 'Perihal / Perjanjian', 'Ref (No Penawaran / PO)', true),
  ('purchase-order', 'Purchase Order (PO)', 4, 'tagihan', 3, 'Vendor / Supplier', 'Barang / Perihal', 'Ref / Keterangan', true),

  -- KELOMPOK: PEMERIKSAAN
  ('pemberitahuan', 'Pemberitahuan', 5, 'pemeriksaan', 3, 'Klien', 'Perihal', 'Ref / No Surat Masuk', true),
  ('pernyataan', 'Pernyataan', 6, 'pemeriksaan', 3, 'Klien / Lokasi', 'Perihal / Objek', 'No Laporan (mis. PB001-014)', true),
  ('bap-papa', 'BAP PAPA', 7, 'pemeriksaan', NULL, 'Klien / Lokasi', 'Objek / Alat', 'Ref (No Laporan / Kontrak)', true),
  ('bap-ptp', 'BAP PTP', 8, 'pemeriksaan', NULL, 'Klien / Lokasi', 'Objek / Alat', 'Ref (No Laporan / Kontrak)', true),
  ('bap-elev-esc', 'BAP Elevator / Eskalator', 9, 'pemeriksaan', NULL, 'Klien / Lokasi', 'Objek / Alat', 'Ref (No Laporan / Kontrak)', true),
  ('bap-il-ipp', 'BAP IL / IPP', 10, 'pemeriksaan', NULL, 'Klien / Lokasi', 'Objek / Alat', 'Ref (No Laporan / Kontrak)', true),
  ('bap-pubt', 'BAP PUBT', 11, 'pemeriksaan', NULL, 'Klien / Lokasi', 'Objek / Alat', 'Ref (No Laporan / Kontrak)', true),
  ('bastp', 'BASTP', 12, 'pemeriksaan', NULL, 'Klien', 'Perihal', 'No PO / Kontrak', true),
  ('sk-dalam-proses', 'SK Dalam Proses', 13, 'pemeriksaan', 3, 'Klien', 'Perihal / Permohonan', 'Ref / Keterangan', true),

  -- KELOMPOK: UMUM
  ('surat-permohonan-skp', 'Surat Permohonan SKP', 14, 'umum', NULL, 'Tujuan', 'Perihal', 'Ref / Keterangan', true),
  ('surat-pengajuan', 'Surat Pengajuan', 15, 'umum', NULL, 'Tujuan', 'Perihal', 'Ref / Keterangan', true),
  ('surat-permohonan-random', 'Surat Permohonan (Random)', 16, 'umum', NULL, 'Tujuan', 'Perihal', 'Ref / Keterangan', true),
  ('s-refund', 'S-Refund', 17, 'umum', NULL, 'Tujuan', 'Perihal', 'Ref / Keterangan', true),
  ('list-pengajuan-admin', 'List Pengajuan Divisi Admin', 18, 'umum', NULL, 'Tujuan', 'Perihal', 'Ref / Keterangan', true),

  -- KELOMPOK: TUGAS
  ('surat-tugas-admin', 'Surat Tugas Tim Admin', 19, 'tugas', 3, 'Lokasi / Klien', 'Perihal / Pekerjaan', 'Petugas', true),
  ('surat-tugas-ahli', 'Surat Tugas Tim Ahli', 20, 'tugas', 3, 'Lokasi / Klien', 'Perihal / Pekerjaan', 'Petugas', true)
ON CONFLICT (kode) DO UPDATE SET
  nama = EXCLUDED.nama,
  urutan = EXCLUDED.urutan,
  kelompok = EXCLUDED.kelompok,
  pad_digit = EXCLUDED.pad_digit,
  label_klien = EXCLUDED.label_klien,
  label_perihal = EXCLUDED.label_perihal,
  label_ref = EXCLUDED.label_ref,
  aktif = EXCLUDED.aktif,
  updated_at = now();

-- 2. SEED pn_counter UNTUK TAHUN 2026 (Nomor Terakhir dari Sheet Manual Cutoff 10 Nov 2026)
-- Nomor berikutnya yang diterbitkan sistem adalah terakhir + 1
INSERT INTO public.pn_counter (jenis_id, tahun, terakhir)
SELECT id, 2026, 
  CASE kode
    WHEN 'invoice' THEN 174
    WHEN 'penawaran' THEN 280
    WHEN 'kontrak' THEN 3
    WHEN 'purchase-order' THEN 2
    WHEN 'pemberitahuan' THEN 165
    WHEN 'pernyataan' THEN 26
    WHEN 'bap-papa' THEN 0
    WHEN 'bap-ptp' THEN 1
    WHEN 'bap-elev-esc' THEN 0
    WHEN 'bap-il-ipp' THEN 2
    WHEN 'bap-pubt' THEN 0
    WHEN 'bastp' THEN 17
    WHEN 'sk-dalam-proses' THEN 43
    WHEN 'surat-permohonan-skp' THEN 10
    WHEN 'surat-pengajuan' THEN 109
    WHEN 'surat-permohonan-random' THEN 40
    WHEN 's-refund' THEN 3
    WHEN 'list-pengajuan-admin' THEN 1
    WHEN 'surat-tugas-admin' THEN 30
    WHEN 'surat-tugas-ahli' THEN 0
    ELSE 0
  END AS terakhir
FROM public.pn_jenis
ON CONFLICT (jenis_id, tahun) DO UPDATE SET
  terakhir = EXCLUDED.terakhir;

-- 3. INITIAL SEED pn_profil DARI USER YANG TERSEDIA DI auth.users & app_users
-- Akun Zulfan & Marsya otomatis diberikan role 'admin', lainnya 'staf'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_users') THEN
    INSERT INTO public.pn_profil (id, nama, role)
    SELECT 
      u.auth_id,
      COALESCE(u.full_name, u.username) AS nama,
      CASE 
        WHEN LOWER(u.username) IN ('zulfan', 'marsya') OR LOWER(u.division) = 'it' THEN 'admin'
        ELSE 'staf'
      END AS role
    FROM public.app_users u
    WHERE u.auth_id IS NOT NULL
    ON CONFLICT (id) DO UPDATE SET
      nama = EXCLUDED.nama,
      role = EXCLUDED.role,
      updated_at = now();
  END IF;
END $$;

-- Trigger untuk menambahkan user baru dari auth.users ke pn_profil secara otomatis jika belum terdaftar
CREATE OR REPLACE FUNCTION public.handle_pn_profil_sync()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.pn_profil (id, nama, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN LOWER(NEW.email) LIKE 'zulfan@%' OR LOWER(NEW.email) LIKE 'marsya@%' THEN 'admin'
      ELSE 'staf'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_pn_profil_sync ON auth.users;
CREATE TRIGGER on_auth_user_pn_profil_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_pn_profil_sync();

-- ==============================================================================
-- ROLLBACK NOTE:
-- Untuk membatalkan seed ini:
-- DROP TRIGGER IF EXISTS on_auth_user_pn_profil_sync ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_pn_profil_sync();
-- DELETE FROM public.pn_counter WHERE tahun = 2026;
-- DELETE FROM public.pn_jenis WHERE kode IN (
--   'invoice', 'penawaran', 'kontrak', 'purchase-order', 'pemberitahuan',
--   'pernyataan', 'bap-papa', 'bap-ptp', 'bap-elev-esc', 'bap-il-ipp',
--   'bap-pubt', 'bastp', 'sk-dalam-proses', 'surat-permohonan-skp',
--   'surat-pengajuan', 'surat-permohonan-random', 's-refund',
--   'list-pengajuan-admin', 'surat-tugas-admin', 'surat-tugas-ahli'
-- );
-- ==============================================================================
