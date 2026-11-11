-- ==============================================================================
-- MIGRATION: 006_allow_all_users_penomoran.sql
-- Modul: Penomoran Surat (Document Numbering)
-- Deskripsi: Membuka akses penuh fitur penomoran untuk SELURUH akun staf internal
-- Idempotent: Yes
-- ==============================================================================

-- 1. Berikan role 'admin' ke seluruh akun profil penomoran
UPDATE public.pn_profil
SET role = 'admin', updated_at = now();

-- Pastikan semua user di app_users memiliki profil aktif di pn_profil
INSERT INTO public.pn_profil (id, nama, role)
SELECT 
  COALESCE(a.id, u.auth_id) AS id,
  COALESCE(u.full_name, u.username) AS nama,
  'admin' AS role
FROM auth.users a
LEFT JOIN public.app_users u ON u.auth_id = a.id
ON CONFLICT (id) DO UPDATE SET
  nama = EXCLUDED.nama,
  role = 'admin',
  updated_at = now();

-- 2. Update fungsi pn_is_admin: Seluruh akun staf internal diberikan hak akses penuh
CREATE OR REPLACE FUNCTION public.pn_is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Seluruh akun staf internal PT Aksara Riksa Perdana memiliki hak akses penuh
  RETURN TRUE;
END;
$$;

-- 3. Update fungsi pn_ambil_nomor: Tambahkan fallback aman jika auth.uid() null (mode guest / employee fallback)
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
  -- 1. Verifikasi Autentikasi Pengguna (dengan fallback otomatis agar seluruh akun bisa ambil nomor)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.pn_profil LIMIT 1;
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
    END IF;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Tidak ada profil pengguna terdaftar di sistem.'
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

    IF v_ref_record.jenis_id != v_jenis_id THEN
      RAISE EXCEPTION 'Dokumen revisi harus memiliki jenis dokumen yang sama dengan dokumen asal.'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 5. Hitung Tahun Operasional
  v_tahun := EXTRACT(YEAR FROM COALESCE(p_tanggal, CURRENT_DATE))::INT;

  -- 6. Dapatkan Nomor Urut Atomik (Row-Level Locking pada pn_counter)
  INSERT INTO public.pn_counter (jenis_id, tahun, terakhir)
  VALUES (v_jenis_id, v_tahun, 0)
  ON CONFLICT (jenis_id, tahun) DO NOTHING;

  UPDATE public.pn_counter
  SET terakhir = terakhir + 1
  WHERE jenis_id = v_jenis_id AND tahun = v_tahun
  RETURNING terakhir INTO v_no_baru;

  -- 7. Terbitkan Nomor Surat Resmi
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
    status
  )
  VALUES (
    v_jenis_id,
    v_tahun,
    v_no_baru,
    COALESCE(p_tanggal, CURRENT_DATE),
    v_user_id,
    NULLIF(trim(p_klien), ''),
    trim(p_perihal),
    NULLIF(trim(p_ref), ''),
    p_revisi_dari,
    'aktif'
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 4. Update fungsi pn_batalkan: Fallback jika auth.uid() null
CREATE OR REPLACE FUNCTION public.pn_batalkan(
  p_nomor_id UUID,
  p_alasan TEXT
)
RETURNS public.pn_nomor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_record public.pn_nomor%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.pn_profil LIMIT 1;
  END IF;

  IF p_alasan IS NULL OR char_length(trim(p_alasan)) < 3 THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi minimal 3 karakter.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_record
  FROM public.pn_nomor
  WHERE id = p_nomor_id;

  IF v_record.id IS NULL THEN
    RAISE EXCEPTION 'Nomor surat tidak ditemukan.'
      USING ERRCODE = '22023';
  END IF;

  IF v_record.status = 'batal' THEN
    RAISE EXCEPTION 'Nomor surat ini sudah dibatalkan sebelumnya.'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.pn_nomor
  SET 
    status = 'batal',
    alasan_batal = trim(p_alasan)
  WHERE id = p_nomor_id
  RETURNING * INTO v_record;

  RETURN v_record;
END;
$$;

-- 5. Berikan izin SELECT dan EXECUTE ke role anon dan authenticated
GRANT SELECT ON public.pn_profil TO anon, authenticated;
GRANT SELECT ON public.pn_jenis TO anon, authenticated;
GRANT SELECT ON public.pn_counter TO anon, authenticated;
GRANT SELECT ON public.pn_nomor TO anon, authenticated;
GRANT SELECT ON public.pn_log TO anon, authenticated;
GRANT SELECT ON public.pn_sync_log TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.pn_ambil_nomor(TEXT, TEXT, TEXT, TEXT, UUID, DATE) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.pn_batalkan(UUID, TEXT) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.pn_ubah(UUID, TEXT, TEXT, TEXT, DATE) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.pn_is_admin(UUID) TO anon, authenticated, public;

-- 6. Update RLS Policies agar anon dan authenticated bisa membaca seluruh nomor dan jenis
DROP POLICY IF EXISTS "pn_nomor_select_all" ON public.pn_nomor;
CREATE POLICY "pn_nomor_select_all" ON public.pn_nomor FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pn_jenis_select_all" ON public.pn_jenis;
CREATE POLICY "pn_jenis_select_all" ON public.pn_jenis FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pn_counter_select_all" ON public.pn_counter;
CREATE POLICY "pn_counter_select_all" ON public.pn_counter FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pn_profil_select_all" ON public.pn_profil;
CREATE POLICY "pn_profil_select_all" ON public.pn_profil FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pn_log_select_all" ON public.pn_log;
CREATE POLICY "pn_log_select_all" ON public.pn_log FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pn_sync_log_select_all" ON public.pn_sync_log;
CREATE POLICY "pn_sync_log_select_all" ON public.pn_sync_log FOR SELECT TO anon, authenticated USING (true);

