-- ==============================================================================
-- MIGRATION: 001_create_pn_tables.sql
-- Module: Penomoran Surat (Document Numbering)
-- Description: Core tables for document numbering, counter, logs, and sheets sync.
-- Idempotent: Yes (IF NOT EXISTS)
-- ==============================================================================

-- 1. PROFIL PENGGUNA PENOMORAN (pn_profil)
-- Memetakan auth.users ke role penomoran ('staf' atau 'admin')
CREATE TABLE IF NOT EXISTS public.pn_profil (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staf' CHECK (role IN ('staf', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. MASTER JENIS DOKUMEN (pn_jenis)
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

-- 3. COUNTER TAHUNAN PER JENIS DOKUMEN (pn_counter)
CREATE TABLE IF NOT EXISTS public.pn_counter (
  jenis_id UUID NOT NULL REFERENCES public.pn_jenis(id) ON DELETE CASCADE,
  tahun INT NOT NULL,
  terakhir INT NOT NULL DEFAULT 0,
  PRIMARY KEY (jenis_id, tahun)
);

-- 4. LOG PENOMORAN DOKUMEN (pn_nomor)
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

-- 5. AUDIT TRAIL OTOMATIS (pn_log)
CREATE TABLE IF NOT EXISTS public.pn_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_id UUID NOT NULL REFERENCES public.pn_nomor(id) ON DELETE CASCADE,
  aksi TEXT NOT NULL CHECK (aksi IN ('buat', 'ubah', 'batal', 'revisi')),
  oleh UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  waktu TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_sebelum JSONB NULL,
  data_sesudah JSONB NULL
);

-- 6. LOG & ANTREAN SINKRONISASI GOOGLE SHEETS (pn_sync_log)
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

-- INDEKS PERFORMA
CREATE INDEX IF NOT EXISTS idx_pn_nomor_jenis_tahun ON public.pn_nomor(jenis_id, tahun, no_urut DESC);
CREATE INDEX IF NOT EXISTS idx_pn_nomor_tanggal ON public.pn_nomor(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_pn_nomor_dibuat_oleh ON public.pn_nomor(dibuat_oleh);
CREATE INDEX IF NOT EXISTS idx_pn_nomor_revisi ON public.pn_nomor(revisi_dari);
CREATE INDEX IF NOT EXISTS idx_pn_log_nomor ON public.pn_log(nomor_id);
CREATE INDEX IF NOT EXISTS idx_pn_sync_status ON public.pn_sync_log(status);

-- ==============================================================================
-- ROLLBACK NOTE:
-- Untuk membatalkan migrasi ini, jalankan:
-- DROP TABLE IF EXISTS public.pn_sync_log CASCADE;
-- DROP TABLE IF EXISTS public.pn_log CASCADE;
-- DROP TABLE IF EXISTS public.pn_nomor CASCADE;
-- DROP TABLE IF EXISTS public.pn_counter CASCADE;
-- DROP TABLE IF EXISTS public.pn_jenis CASCADE;
-- DROP TABLE IF EXISTS public.pn_profil CASCADE;
-- ==============================================================================
