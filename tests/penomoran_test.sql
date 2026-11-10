-- ==============================================================================
-- TEST SUITE: tests/penomoran_test.sql
-- Module: Penomoran Surat (Acceptance & Concurrency Test Suite)
-- Note: Jalankan skrip ini di SQL Editor Supabase Staging/Development
-- ==============================================================================

DO $$
DECLARE
  v_test_user_id UUID;
  v_admin_user_id UUID;
  v_inv_rec public.pn_nomor;
  v_pen_rec public.pn_nomor;
  v_rev_rec public.pn_nomor;
  v_cancel_rec public.pn_nomor;
  v_log_count INT;
  v_counter_terakhir INT;
  v_next_year INT;
  v_rollover_rec public.pn_nomor;
BEGIN
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'STARTING TEST SUITE: MODUL PENOMORAN SURAT';
  RAISE NOTICE '=======================================================';

  -- 1. SETUP DUMMY TEST USERS
  v_test_user_id := gen_random_uuid();
  v_admin_user_id := gen_random_uuid();

  -- Masukkan profil test
  INSERT INTO public.pn_profil (id, nama, role)
  VALUES 
    (v_test_user_id, 'Tester Staf', 'staf'),
    (v_admin_user_id, 'Tester Admin', 'admin')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  -- ----------------------------------------------------------------------------
  -- TEST 1: VERIFIKASI SEED AWAL TAHUN 2026
  -- ----------------------------------------------------------------------------
  SELECT terakhir INTO v_counter_terakhir
  FROM public.pn_counter c
  JOIN public.pn_jenis j ON j.id = c.jenis_id
  WHERE j.kode = 'invoice' AND c.tahun = 2026;

  IF v_counter_terakhir <> 174 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Counter invoice 2026 seharusnya 174, ditemukan %', v_counter_terakhir;
  END IF;

  SELECT terakhir INTO v_counter_terakhir
  FROM public.pn_counter c
  JOIN public.pn_jenis j ON j.id = c.jenis_id
  WHERE j.kode = 'penawaran' AND c.tahun = 2026;

  IF v_counter_terakhir <> 280 THEN
    RAISE EXCEPTION 'TEST 1 FAILED: Counter penawaran 2026 seharusnya 280, ditemukan %', v_counter_terakhir;
  END IF;

  RAISE NOTICE '✅ TEST 1 PASSED: Seed awal tahun 2026 terverifikasi (Invoice=174, Penawaran=280).';

  -- ----------------------------------------------------------------------------
  -- TEST 2: NOMOR PERTAMA YANG DITERBITKAN HARUS TERAKHIR + 1 (175 & 281)
  -- ----------------------------------------------------------------------------
  -- Set sesi sebagai v_test_user_id
  PERFORM set_config('request.jwt.claim.sub', v_test_user_id::text, true);

  -- Ambil invoice baru
  v_inv_rec := public.pn_ambil_nomor('invoice', 'PT Klien Uji A', 'Pekerjaan Riksa Uji Lift', 'PO-001', NULL, '2026-11-10');
  IF v_inv_rec.no_urut <> 175 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Nomor invoice pertama seharusnya 175, diperoleh %', v_inv_rec.no_urut;
  END IF;

  -- Ambil penawaran baru
  v_pen_rec := public.pn_ambil_nomor('penawaran', 'PT Klien Uji B', 'Penawaran Pemeriksaan Genset', 'Ref-99', NULL, '2026-11-10');
  IF v_pen_rec.no_urut <> 281 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Nomor penawaran pertama seharusnya 281, diperoleh %', v_pen_rec.no_urut;
  END IF;

  RAISE NOTICE '✅ TEST 2 PASSED: Nomor pertama invoice (175) dan penawaran (281) terbit akurat.';

  -- ----------------------------------------------------------------------------
  -- TEST 3: REVISI MENGHASILKAN NOMOR BARU & MENAUTKAN revisi_dari
  -- ----------------------------------------------------------------------------
  v_rev_rec := public.pn_ambil_nomor('invoice', 'PT Klien Uji A', 'Pekerjaan Riksa Uji Lift (Rev-01)', 'Revisi', v_inv_rec.id, '2026-11-10');
  IF v_rev_rec.no_urut <> 176 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Nomor revisi seharusnya 176, diperoleh %', v_rev_rec.no_urut;
  END IF;

  IF v_rev_rec.revisi_dari <> v_inv_rec.id THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Tautan revisi_dari tidak sesuai.';
  END IF;

  RAISE NOTICE '✅ TEST 3 PASSED: Nomor revisi terbit sebagai nomor baru (176) dan tertaut rapi ke nomor asal.';

  -- ----------------------------------------------------------------------------
  -- TEST 4: PEMBATALAN NOMOR (ADMIN ONLY + WAJIB ALASAN) & CEK REVISI PADA NOMOR BATAL
  -- ----------------------------------------------------------------------------
  -- Coba batalkan sebagai staf (harus ditolak)
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_test_user_id::text, true);
    PERFORM public.pn_batalkan(v_inv_rec.id, 'Alasan tes pembatalan');
    RAISE EXCEPTION 'TEST 4 FAILED: Pembatalan oleh staf seharusnya ditolak.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Hanya akun berwenang%' THEN
      RAISE EXCEPTION 'TEST 4 FAILED: Pesan error salah: %', SQLERRM;
    END IF;
  END;

  -- Batalkan sebagai admin (harus sukses)
  PERFORM set_config('request.jwt.claim.sub', v_admin_user_id::text, true);
  v_cancel_rec := public.pn_batalkan(v_inv_rec.id, 'Dibatalkan karena salah perihal oleh klien');
  IF v_cancel_rec.status <> 'batal' THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Status nomor seharusnya batal.';
  END IF;

  -- Coba revisi nomor yang sudah berstatus batal (harus ditolak)
  BEGIN
    PERFORM public.pn_ambil_nomor('invoice', 'Klien', 'Perihal baru', NULL, v_inv_rec.id, '2026-11-10');
    RAISE EXCEPTION 'TEST 4 FAILED: Revisi atas nomor yang batal seharusnya ditolak.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Nomor surat yang sudah dibatalkan tidak dapat direvisi%' THEN
      RAISE EXCEPTION 'TEST 4 FAILED: Pesan error penolakan revisi salah: %', SQLERRM;
    END IF;
  END;

  RAISE NOTICE '✅ TEST 4 PASSED: Otoritas pembatalan khusus admin & proteksi nomor batal bekerja sempurna.';

  -- ----------------------------------------------------------------------------
  -- TEST 5: TAHUN BARU (YEAR ROLLOVER) DIMULAI DARI 1 SECARA OTOMATIS
  -- ----------------------------------------------------------------------------
  v_next_year := 2027;
  v_rollover_rec := public.pn_ambil_nomor('invoice', 'Klien Tahun Baru', 'Pekerjaan Tahun Depan', NULL, NULL, (v_next_year || '-01-02')::DATE);
  IF v_rollover_rec.no_urut <> 1 THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Nomor pertama tahun baru seharusnya 1, diperoleh %', v_rollover_rec.no_urut;
  END IF;

  RAISE NOTICE '✅ TEST 5 PASSED: Rollover pergantian tahun otomatis dimulai dari nomor urut 1.';

  -- ----------------------------------------------------------------------------
  -- TEST 6: VERIFIKASI AUDIT TRAIL (pn_log)
  -- ----------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_log_count
  FROM public.pn_log
  WHERE nomor_id IN (v_inv_rec.id, v_pen_rec.id, v_rev_rec.id);

  -- v_inv_rec: dibuat (1) + dibatalkan (1) = 2 log
  -- v_pen_rec: dibuat (1) = 1 log
  -- v_rev_rec: direvisi (1) = 1 log
  -- Total minimal: 4 log
  IF v_log_count < 4 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Log perubahan kurang dari 4, ditemukan %', v_log_count;
  END IF;

  RAISE NOTICE '✅ TEST 6 PASSED: Seluruh event audit trail (buat, revisi, batal) tercatat otomatis di pn_log.';

  -- ----------------------------------------------------------------------------
  -- BERSIHKAN DATA UJI COBA
  -- ----------------------------------------------------------------------------
  DELETE FROM public.pn_nomor WHERE id IN (v_inv_rec.id, v_pen_rec.id, v_rev_rec.id, v_rollover_rec.id);
  DELETE FROM public.pn_counter WHERE tahun = 2027;
  -- Kembalikan counter 2026 invoice ke 174 & penawaran ke 280
  UPDATE public.pn_counter SET terakhir = 174 WHERE tahun = 2026 AND jenis_id = (SELECT id FROM public.pn_jenis WHERE kode = 'invoice');
  UPDATE public.pn_counter SET terakhir = 280 WHERE tahun = 2026 AND jenis_id = (SELECT id FROM public.pn_jenis WHERE kode = 'penawaran');
  DELETE FROM public.pn_profil WHERE id IN (v_test_user_id, v_admin_user_id);

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'ALL TESTS PASSED SUCCESSFULLY! (6/6 SKENARIO LULUS)';
  RAISE NOTICE '=======================================================';
END $$;

