# Panduan Modul Penomoran Surat (Supabase + Google Sheets Mirror)

Modul **Penomoran Surat** PT Aksara Riksa Perdana dirancang untuk memastikan setiap surat/dokumen resmi diterbitkan langsung oleh database Postgres secara atomik, sehingga **tidak akan ada nomor kembar, tidak ada nomor terlompati, serta tercatat siapa pembuatnya dan kapan dibuat**.

---

## 1. Cara Staf Mengambil Nomor (3 Langkah Mudah)

1. **Pilih Jenis Dokumen:**
   - Masuk ke tab **📜 Penomoran Surat** di menu atas atau navigasi bawah di HP.
   - Klik jenis dokumen yang ingin dibuat (misal: *Invoice*, *Penawaran*, *Surat Tugas*, dll).
2. **Isi Formulir Ringkas:**
   - Masukkan **Klien / Lokasi** (opsional).
   - Masukkan **Perihal / Pekerjaan** (wajib diisi jelas, minimal 3 karakter).
   - Masukkan **Ref / Keterangan** jika ada (misal: No PO atau No Kontrak).
   - Tanggal dan nama pembuat terisi otomatis oleh sistem.
3. **Klik "Ambil Nomor Sekarang" & Salin:**
   - Nomor resmi akan langsung terbit dalam ukuran **BESAR**.
   - Tekan tombol **"Salin Nomor"** untuk menempelkan nomor ke template Word/Excel Anda.

> **Ingin Merevisi Dokumen Lama?**
> Cukup cari baris dokumen lama di daftar, lalu klik tombol **"Revisi"**. Sistem akan menerbitkan nomor baru yang otomatis menautkan riwayat ke nomor sebelumnya.

---

## 2. Cara Admin Membatalkan Nomor Surat

Hanya akun berwenang (**Zulfan & Marsya / Admin**) yang memiliki hak untuk membatalkan nomor:
1. Buka nomor surat yang ingin dibatalkan di daftar dokumen.
2. Klik tombol **"Detail"**.
3. Di bagian bawah modal, klik tombol merah **"Batalkan (Admin)"**.
4. Masukkan **Alasan Pembatalan** secara jelas (wajib diisi min. 3 karakter).
5. Klik **"Ya, Batalkan Nomor Ini"**.
6. Status dokumen akan berubah menjadi **Batal (dicoret abu-abu)** dan dicatat dalam audit trail.
> ⚠️ **Catatan Keamanan:** Nomor yang sudah dibatalkan **tidak akan pernah dipakai ulang** oleh sistem agar nomor pengarsipan tetap runtut dan dapat dipertanggungjawabkan saat audit.

---

## 3. Cara Mengoreksi Angka Seed (Jika Ada Penomoran Manual Tertinggal)

Jika ada nomor surat manual di Excel lama yang baru ditemukan dan perlu disesuaikan di database:
1. Buka **Supabase Dashboard ➔ SQL Editor**.
2. Jalankan query berikut (ganti `'kode-dokumen'` dan angka `terakhir` yang diinginkan):
   ```sql
   UPDATE public.pn_counter
   SET terakhir = 180 -- Ganti dengan nomor terakhir yang sah
   WHERE tahun = 2026 
     AND jenis_id = (SELECT id FROM public.pn_jenis WHERE kode = 'invoice');
   ```
3. Nomor berikutnya yang diterbitkan oleh sistem otomatis menjadi `181`.

---

## 4. Cara Sinkron Ulang ke Google Sheets (Manual Rebuild)

Jika spreadsheet Google Sheets perlu di-*reset* atau dibangun ulang dari database:
1. Masuk ke halaman **📜 Penomoran Surat** dengan akun Admin.
2. Di pojok kanan atas, klik tombol **"Sinkron Sheets"** (atau gunakan tombol *Rebuild All*).
3. Konfirmasi aksi. Sistem akan memperbarui seluruh tab di Google Sheets sesuai data Supabase dan mencatat waktu sinkronisasi terbaru di cell `H2` masing-masing tab.

---

## 5. Checklist Setup Service Account & Proteksi Google Sheets

Agar sinkronisasi otomatis berjalan lancar dan aman:

### A. Setup Google Cloud Service Account
1. Buat Service Account di Google Cloud Console.
2. Berikan role **Editor** untuk Google Sheets API.
3. Unduh file kunci JSON Service Account.
4. Simpan nilai kredensial di **Supabase Secrets**:
   - `SHEETS_SPREADSHEET_ID`: ID Google Sheets Anda (diambil dari URL).
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Email Service Account (misal: `...@...iam.gserviceaccount.com`).
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: Private key dari JSON.

### B. Bagikan Spreadsheet ke Service Account
1. Buka Google Sheets `PENOMORAN_BARU`.
2. Klik tombol **Bagikan (Share)** di pojok kanan atas.
3. Masukkan email Service Account sebagai **Editor**.

### C. Kunci Tab Spreadsheet Sebagai Read-Only
1. Di Google Sheets, klik kanan pada setiap tab dokumen (misal: *Invoice*, *Penawaran*).
2. Pilih **Protect sheet (Lindungi sheet)**.
3. Atur izin pengeditan: **Hanya Anda dan email Service Account** yang boleh mengedit.
4. Dengan cara ini, staf lain hanya bisa melihat (*read-only*), mencegah pengetikan nomor manual yang dapat memicu duplikasi.

---

## 6. Rencana Transisi (Cutover Plan)

Untuk beralih mulus dari spreadsheet manual ke aplikasi:
1. **Freeze Sheet Manual:** Beritahu seluruh staf bahwa per tanggal/jam yang disepakati, spreadsheet lama ditutup untuk penginputan manual.
2. **Cek Nomor Terakhir:** Catat nomor terakhir dari masing-masing 20 jenis dokumen.
3. **Verifikasi `pn_counter`:** Pastikan tabel `pn_counter` di Supabase untuk tahun 2026 sudah terisi angka terakhir tersebut (file migrasi `004_seed_penomoran_2026.sql` sudah disiapkan).
4. **Deploy & Jalankan Webhook:** Aktifkan Supabase Webhook ke Edge Function `sync-sheets`.
5. **Switch Staf ke Web:** Seluruh staf mulai mengambil nomor hanya melalui tombol **"Ambil Nomor Baru"** di RiksaSync AI.
6. **Arsipkan Sheet Lama:** Jadikan sheet lama sebagai arsip baca saja (*view only*).

