-- ==============================================================================
-- ALL_PENOMORAN_MIGRATION.sql
-- Modul: Penomoran Surat (PT Aksara Riksa Perdana)
-- Petunjuk:
-- 1. Buka Supabase Dashboard -> Project Anda -> SQL Editor -> "New Query"
-- 2. Salin (Copy) SELURUH isi script ini dan tempel (Paste) ke editor tersebut
-- 3. Klik tombol "Run" (atau Ctrl + Enter)
-- 
-- Sifat Script: Idempotent (Aman dijalankan berulang kali, tidak akan merusak
-- data tabel lain seperti schedules, manpower, attendance_logs, dll).
-- ==============================================================================

-- ==============================================================================
-- BAGIAN 1: PEMBUATAN TABEL-TABEL BARU (pn_*)
-- ==============================================================================

-- 1. Profil Pengguna Penomoran
CREATE TABLE IF NOT EXISTS public.pn_profil (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staf' CHECK (role IN ('staf', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Master Jenis Dokumen
CREATE TABLE IF NOT EXISTS public.pn_jenis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  urutan INT NOT NULL DEFAULT 1,
  kelompok TEXT NOT NULL CHECK (kelompok IN ('tagihan', 'pemeriksaan', 'umum', 'tugas')),
  pad_digit INT NULL,
  label_klien TEXT NOT NULL DEFAULT 'Klien',
  label_perihal TEXT NOT NULL DEFAULT 'Perihal',
  label_ref TEXT NOT NULL DEFAULT 'Ref / Keterangan',
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Counter Tahunan Per Jenis Dokumen
CREATE TABLE IF NOT EXISTS public.pn_counter (
  jenis_id UUID NOT NULL REFERENCES public.pn_jenis(id) ON DELETE CASCADE,
  tahun INT NOT NULL,
  terakhir INT NOT NULL DEFAULT 0,
  PRIMARY KEY (jenis_id, tahun)
);

-- 4. Log Penomoran Dokumen Resmi
CREATE TABLE IF NOT EXISTS public.pn_nomor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis_id UUID NOT NULL REFERENCES public.pn_jenis(id) ON DELETE RESTRICT,
  tahun INT NOT NULL,
  no_urut INT NOT NULL,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  dibuat_oleh UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  klien TEXT,
  perihal TEXT NOT NULL,
  ref TEXT,
  revisi_dari UUID NULL REFERENCES public.pn_nomor(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'batal')),
  alasan_batal TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pn_nomor_urut UNIQUE (jenis_id, tahun, no_urut),
  CONSTRAINT ck_pn_nomor_perihal CHECK (char_length(trim(perihal)) >= 3)
);

-- 5. Audit Trail Otomatis
CREATE TABLE IF NOT EXISTS public.pn_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_id UUID NOT NULL REFERENCES public.pn_nomor(id) ON DELETE CASCADE,
  aksi TEXT NOT NULL CHECK (aksi IN ('buat', 'ubah', 'batal', 'revisi')),
  oleh UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  waktu TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_sebelum JSONB NULL,
  data_sesudah JSONB NULL
);

-- 6. Log & Antrean Sinkronisasi Google Sheets Mirror
CREATE TABLE IF NOT EXISTS public.pn_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_id UUID NULL REFERENCES public.pn_nomor(id) ON DELETE SET NULL,
  jenis_kode TEXT NOT NULL,
  no_urut INT NOT NULL,
  event TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sukses', 'gagal')),
  attempt_count INT NOT NULL DEFAULT 1,
  error_message TEXT NULL,
  payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indeks Performa
CREATE INDEX IF NOT EXISTS idx_pn_nomor_jenis_tahun ON public.pn_nomor(jenis_id, tahun, no_urut DESC);
CREATE INDEX IF NOT EXISTS idx_pn_nomor_tanggal ON public.pn_nomor(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_pn_nomor_dibuat_oleh ON public.pn_nomor(dibuat_oleh);
CREATE INDEX IF NOT EXISTS idx_pn_nomor_revisi ON public.pn_nomor(revisi_dari);
CREATE INDEX IF NOT EXISTS idx_pn_log_nomor ON public.pn_log(nomor_id);
CREATE INDEX IF NOT EXISTS idx_pn_sync_status ON public.pn_sync_log(status);


-- ==============================================================================
-- BAGIAN 2: FUNGSI INTI ATOMIK & TRIGGER AUDIT TRAIL
-- ==============================================================================

-- 1. Helper Function: Cek Role Admin
CREATE OR REPLACE FUNCTION public.pn_is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role
  FROM public.pn_profil
  WHERE id = p_user_id;

  RETURN (v_role = 'admin');
END;
$$;

-- 2. Fungsi Inti: Ambil Nomor Baru (Atomik, Row Lock, Nol Duplikasi)
CREATE OR REPLACE FUNCTION public.pn_ambil_nomor(
  p_jenis_kode TEXT,
  p_klien TEXT,
  p_perihal TEXT,
  p_ref TEXT DEFAULT NULL,
  p_revisi_dari UUID DEFAULT NULL,
  p_tanggal DATE DEFAULT CURRENT_DATE
)
RETURNS public.pn_nomor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_jenis_id UUID;
  v_jenis_aktif BOOLEAN;
  v_tahun INT;
  v_no_baru INT;
  v_ref_record public.pn_nomor%ROWTYPE;
  v_result public.pn_nomor%ROWTYPE;
BEGIN
  -- 1. Verifikasi Autentikasi Pengguna
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Anda harus login untuk mengambil nomor surat.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Validasi Input Perihal
  IF p_perihal IS NULL OR char_length(trim(p_perihal)) < 3 THEN
    RAISE EXCEPTION 'Perihal surat wajib diisi minimal 3 karakter.'
      USING ERRCODE = '22023';
  END IF;

  -- 3. Cari dan Validasi Jenis Dokumen
  SELECT id, aktif INTO v_jenis_id, v_jenis_aktif
  FROM public.pn_jenis
  WHERE LOWER(kode) = LOWER(trim(p_jenis_kode));

  IF v_jenis_id IS NULL THEN
    RAISE EXCEPTION 'Jenis dokumen dengan kode "%" tidak ditemukan.' , p_jenis_kode
      USING ERRCODE = '22023';
  END IF;

  IF NOT v_jenis_aktif THEN
    RAISE EXCEPTION 'Jenis dokumen "%" saat ini dinonaktifkan dan tidak menerima penomoran baru.' , p_jenis_kode
      USING ERRCODE = '55000';
  END IF;

  -- 4. Validasi Dokumen Rujukan Revisi (Jika Ada)
  IF p_revisi_dari IS NOT NULL THEN
    SELECT * INTO v_ref_record
    FROM public.pn_nomor
    WHERE id = p_revisi_dari;

    IF v_ref_record.id IS NULL THEN
      RAISE EXCEPTION 'Dokumen rujukan revisi tidak ditemukan.'
        USING ERRCODE = '22023';
    END IF;

    IF v_ref_record.jenis_id <> v_jenis_id THEN
      RAISE EXCEPTION 'Dokumen revisi harus memiliki jenis dokumen yang sama dengan dokumen asal.'
        USING ERRCODE = '22023';
    END IF;

    IF v_ref_record.status = 'batal' THEN
      RAISE EXCEPTION 'Nomor surat yang sudah dibatalkan tidak dapat direvisi.'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  -- 5. Ambil Tahun Penomoran (Rollover Otomatis Berdasarkan Tanggal)
  v_tahun := EXTRACT(YEAR FROM COALESCE(p_tanggal, CURRENT_DATE))::INT;

  -- 6. Lock & Update Counter Secara Atomik (Row-Level Locking)
  INSERT INTO public.pn_counter (jenis_id, tahun, terakhir)
  VALUES (v_jenis_id, v_tahun, 0)
  ON CONFLICT (jenis_id, tahun) DO NOTHING;

  UPDATE public.pn_counter
  SET terakhir = terakhir + 1
  WHERE jenis_id = v_jenis_id AND tahun = v_tahun
  RETURNING terakhir INTO v_no_baru;

  -- 7. Simpan Nomor Baru ke Tabel pn_nomor
  INSERT INTO public.pn_nomor (
    jenis_id,
    tahun,
    no_urut,
    tanggal,
    dibuat_oleh,
    klien,
    perihal,
    ref,
    revisi_dari,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_jenis_id,
    v_tahun,
    v_no_baru,
    COALESCE(p_tanggal, CURRENT_DATE),
    v_user_id,
    trim(p_klien),
    trim(p_perihal),
    trim(p_ref),
    p_revisi_dari,
    'aktif',
    now(),
    now()
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 3. Fungsi Pembatalan: pn_batalkan (Admin Only + Wajib Alasan)
CREATE OR REPLACE FUNCTION public.pn_batalkan(
  p_id UUID,
  p_alasan TEXT
)
RETURNS public.pn_nomor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_current public.pn_nomor%ROWTYPE;
  v_result public.pn_nomor%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Anda harus login terlebih dahulu.'
      USING ERRCODE = '42501';
  END IF;

  -- Cek Kewenangan Admin
  IF NOT public.pn_is_admin(v_user_id) THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya akun berwenang (Admin) yang dapat membatalkan nomor surat.'
      USING ERRCODE = '42501';
  END IF;

  -- Validasi Alasan
  IF p_alasan IS NULL OR char_length(trim(p_alasan)) < 3 THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi dengan jelas (minimal 3 karakter).'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_current
  FROM public.pn_nomor
  WHERE id = p_id;

  IF v_current.id IS NULL THEN
    RAISE EXCEPTION 'Nomor surat dengan ID tersebut tidak ditemukan.'
      USING ERRCODE = '22023';
  END IF;

  IF v_current.status = 'batal' THEN
    RAISE EXCEPTION 'Nomor surat ini sudah berstatus batal sebelumnya.'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.pn_nomor
  SET status = 'batal',
      alasan_batal = trim(p_alasan),
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 4. Fungsi Pengubahan: pn_ubah (Hanya Klien, Perihal, Ref, Tanggal)
CREATE OR REPLACE FUNCTION public.pn_ubah(
  p_id UUID,
  p_klien TEXT,
  p_perihal TEXT,
  p_ref TEXT,
  p_tanggal DATE DEFAULT NULL
)
RETURNS public.pn_nomor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_current public.pn_nomor%ROWTYPE;
  v_result public.pn_nomor%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Anda harus login terlebih dahulu.'
      USING ERRCODE = '42501';
  END IF;

  IF p_perihal IS NULL OR char_length(trim(p_perihal)) < 3 THEN
    RAISE EXCEPTION 'Perihal surat wajib diisi minimal 3 karakter.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_current
  FROM public.pn_nomor
  WHERE id = p_id;

  IF v_current.id IS NULL THEN
    RAISE EXCEPTION 'Nomor surat tidak ditemukan.'
      USING ERRCODE = '22023';
  END IF;

  IF v_current.status = 'batal' THEN
    RAISE EXCEPTION 'Nomor surat yang sudah berstatus batal tidak dapat diubah.'
      USING ERRCODE = '55000';
  END IF;

  v_is_admin := public.pn_is_admin(v_user_id);

  -- Otorisasi: Admin bebas edit; Staf hanya milik sendiri dalam 24 jam
  IF NOT v_is_admin THEN
    IF v_current.dibuat_oleh <> v_user_id THEN
      RAISE EXCEPTION 'Akses ditolak: Anda bukan pembuat nomor surat ini.'
        USING ERRCODE = '42501';
    END IF;

    IF v_current.created_at < (now() - INTERVAL '24 hours') THEN
      RAISE EXCEPTION 'Batas waktu perubahan mandiri oleh staf (24 jam) telah berakhir. Silakan hubungi admin.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.pn_nomor
  SET klien = trim(p_klien),
      perihal = trim(p_perihal),
      ref = trim(p_ref),
      tanggal = COALESCE(p_tanggal, tanggal),
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 5. Trigger Otomatis Audit Trail ke pn_log & Antrean pn_sync_log
CREATE OR REPLACE FUNCTION public.pn_trigger_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_aksi TEXT;
  v_user_id UUID;
  v_jenis_kode TEXT;
BEGIN
  v_user_id := COALESCE(auth.uid(), NEW.dibuat_oleh);

  SELECT kode INTO v_jenis_kode
  FROM public.pn_jenis
  WHERE id = NEW.jenis_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.revisi_dari IS NOT NULL THEN
      v_aksi := 'revisi';
    ELSE
      v_aksi := 'buat';
    END IF;

    -- Catat ke audit log
    INSERT INTO public.pn_log (nomor_id, aksi, oleh, waktu, data_sebelum, data_sesudah)
    VALUES (NEW.id, v_aksi, v_user_id, now(), NULL, to_jsonb(NEW));

    -- Enqueue ke log sinkronisasi Google Sheets mirror
    INSERT INTO public.pn_sync_log (nomor_id, jenis_kode, no_urut, event, status, payload)
    VALUES (NEW.id, COALESCE(v_jenis_kode, 'unknown'), NEW.no_urut, 'INSERT', 'pending', to_jsonb(NEW));

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> NEW.status AND NEW.status = 'batal' THEN
      v_aksi := 'batal';
    ELSE
      v_aksi := 'ubah';
    END IF;

    INSERT INTO public.pn_log (nomor_id, aksi, oleh, waktu, data_sebelum, data_sesudah)
    VALUES (NEW.id, v_aksi, v_user_id, now(), to_jsonb(OLD), to_jsonb(NEW));

    INSERT INTO public.pn_sync_log (nomor_id, jenis_kode, no_urut, event, status, payload)
    VALUES (NEW.id, COALESCE(v_jenis_kode, 'unknown'), NEW.no_urut, 'UPDATE', 'pending', to_jsonb(NEW));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pn_nomor_audit ON public.pn_nomor;
CREATE TRIGGER trg_pn_nomor_audit
  AFTER INSERT OR UPDATE ON public.pn_nomor
  FOR EACH ROW
  EXECUTE FUNCTION public.pn_trigger_audit_log();


-- ==============================================================================
-- BAGIAN 3: ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- ==============================================================================

ALTER TABLE public.pn_profil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pn_jenis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pn_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pn_nomor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pn_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pn_sync_log ENABLE ROW LEVEL SECURITY;

-- Cabut akses modifikasi langsung dari role authenticated & anon
REVOKE INSERT, UPDATE, DELETE ON public.pn_nomor FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.pn_counter FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.pn_log FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.pn_sync_log FROM authenticated, anon, public;

-- Berikan hak SELECT untuk user login
GRANT SELECT ON public.pn_profil TO authenticated;
GRANT SELECT ON public.pn_jenis TO authenticated;
GRANT SELECT ON public.pn_counter TO authenticated;
GRANT SELECT ON public.pn_nomor TO authenticated;
GRANT SELECT ON public.pn_log TO authenticated;
GRANT SELECT ON public.pn_sync_log TO authenticated;

-- Berikan izin pemanggilan fungsi inti
GRANT EXECUTE ON FUNCTION public.pn_ambil_nomor(TEXT, TEXT, TEXT, TEXT, UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pn_batalkan(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pn_ubah(UUID, TEXT, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pn_is_admin(UUID) TO authenticated;

-- Kebijakan SELECT (Semua user login bisa melihat seluruh nomor)
DROP POLICY IF EXISTS "pn_profil_select_all" ON public.pn_profil;
CREATE POLICY "pn_profil_select_all" ON public.pn_profil FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pn_profil_admin_manage" ON public.pn_profil;
CREATE POLICY "pn_profil_admin_manage" ON public.pn_profil FOR ALL TO authenticated USING (public.pn_is_admin(auth.uid())) WITH CHECK (public.pn_is_admin(auth.uid()));

DROP POLICY IF EXISTS "pn_jenis_select_all" ON public.pn_jenis;
CREATE POLICY "pn_jenis_select_all" ON public.pn_jenis FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pn_jenis_admin_manage" ON public.pn_jenis;
CREATE POLICY "pn_jenis_admin_manage" ON public.pn_jenis FOR ALL TO authenticated USING (public.pn_is_admin(auth.uid())) WITH CHECK (public.pn_is_admin(auth.uid()));

DROP POLICY IF EXISTS "pn_counter_select_all" ON public.pn_counter;
CREATE POLICY "pn_counter_select_all" ON public.pn_counter FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pn_nomor_select_all" ON public.pn_nomor;
CREATE POLICY "pn_nomor_select_all" ON public.pn_nomor FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pn_log_select_all" ON public.pn_log;
CREATE POLICY "pn_log_select_all" ON public.pn_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pn_sync_log_select_all" ON public.pn_sync_log;
CREATE POLICY "pn_sync_log_select_all" ON public.pn_sync_log FOR SELECT TO authenticated USING (true);


-- ==============================================================================
-- BAGIAN 4: SEED MASTER 20 DOKUMEN & COUNTER AWAL 2026 (CUTOFF 10 NOV 2026)
-- ==============================================================================

-- 1. Seed 20 Jenis Dokumen Resmi
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

-- 2. Seed Counter 2026 (Nomor Terakhir Dari Sheet Manual)
-- Nomor berikutnya yang diterbitkan sistem adalah: terakhir + 1
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

-- 3. Sinkronkan Akun Pengguna ke pn_profil
-- Akun Zulfan & Marsya otomatis memperoleh hak Admin
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

-- 4. Trigger Auto-Sync untuk Pengguna Baru
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

