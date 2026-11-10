-- ==============================================================================
-- MIGRATION: 002_functions_and_triggers.sql
-- Module: Penomoran Surat (Document Numbering)
-- Description: Core atomic numbering function, cancellation, modification, and audit triggers.
-- Idempotent: Yes (CREATE OR REPLACE)
-- ==============================================================================

-- 1. HELPER FUNCTION: Periksa Status Admin
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

-- 2. FUNGSI INTI: Ambil Nomor Baru (Atomik, Row-Locking, Tanpa Duplikasi)
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
  -- Pastikan baris counter ada untuk jenis dan tahun ini
  INSERT INTO public.pn_counter (jenis_id, tahun, terakhir)
  VALUES (v_jenis_id, v_tahun, 0)
  ON CONFLICT (jenis_id, tahun) DO NOTHING;

  -- UPDATE ... RETURNING secara otomatis mengakuisisi exclusive row lock pada baris ini
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

-- 3. FUNGSI PEMBATALAN: pn_batalkan (Admin Only + Wajib Alasan)
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

-- 4. FUNGSI PENGUBAHAN: pn_ubah (Hanya Klien, Perihal, Ref, Tanggal)
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

  -- Aturan Otorisasi: Admin bebas edit kapan saja; Staf hanya milik sendiri dalam kurun 24 jam
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

-- 5. TRIGGER AUDIT TRAIL OTOMATIS KE pn_log & pn_sync_log
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

    -- Catat ke pn_log
    INSERT INTO public.pn_log (nomor_id, aksi, oleh, waktu, data_sebelum, data_sesudah)
    VALUES (NEW.id, v_aksi, v_user_id, now(), NULL, to_jsonb(NEW));

    -- Enqueue ke pn_sync_log untuk Google Sheets mirror
    INSERT INTO public.pn_sync_log (nomor_id, jenis_kode, no_urut, event, status, payload)
    VALUES (NEW.id, COALESCE(v_jenis_kode, 'unknown'), NEW.no_urut, 'INSERT', 'pending', to_jsonb(NEW));

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> NEW.status AND NEW.status = 'batal' THEN
      v_aksi := 'batal';
    ELSE
      v_aksi := 'ubah';
    END IF;

    -- Catat ke pn_log
    INSERT INTO public.pn_log (nomor_id, aksi, oleh, waktu, data_sebelum, data_sesudah)
    VALUES (NEW.id, v_aksi, v_user_id, now(), to_jsonb(OLD), to_jsonb(NEW));

    -- Enqueue ke pn_sync_log untuk update Google Sheets mirror
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
-- ROLLBACK NOTE:
-- Untuk membatalkan fungsi dan trigger ini, jalankan:
-- DROP TRIGGER IF EXISTS trg_pn_nomor_audit ON public.pn_nomor;
-- DROP FUNCTION IF EXISTS public.pn_trigger_audit_log();
-- DROP FUNCTION IF EXISTS public.pn_ubah(UUID, TEXT, TEXT, TEXT, DATE);
-- DROP FUNCTION IF EXISTS public.pn_batalkan(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.pn_ambil_nomor(TEXT, TEXT, TEXT, TEXT, UUID, DATE);
-- DROP FUNCTION IF EXISTS public.pn_is_admin(UUID);
-- ==============================================================================

