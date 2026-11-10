/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PnKelompok = 'tagihan' | 'pemeriksaan' | 'umum' | 'tugas';

export interface PnJenis {
  id: string;
  kode: string;
  nama: string;
  urutan: number;
  kelompok: PnKelompok;
  pad_digit: number | null;
  label_klien: string;
  label_perihal: string;
  label_ref: string;
  aktif: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PnCounter {
  jenis_id: string;
  tahun: number;
  terakhir: number;
}

export type PnNomorStatus = 'aktif' | 'batal';

export interface PnNomor {
  id: string;
  jenis_id: string;
  tahun: number;
  no_urut: number;
  tanggal: string; // YYYY-MM-DD
  dibuat_oleh: string; // uuid
  dibuat_oleh_nama?: string;
  klien: string | null;
  perihal: string;
  ref: string | null;
  revisi_dari: string | null;
  revisi_dari_no?: number | null;
  direvisi_di_no?: number | null;
  status: PnNomorStatus;
  alasan_batal: string | null;
  created_at: string;
  updated_at: string;
}

export interface PnLog {
  id: string;
  nomor_id: string;
  aksi: 'buat' | 'ubah' | 'batal' | 'revisi';
  oleh: string | null;
  oleh_nama?: string;
  waktu: string;
  data_sebelum: any;
  data_sesudah: any;
}

export interface PnProfil {
  id: string;
  nama: string;
  role: 'staf' | 'admin';
  created_at?: string;
  updated_at?: string;
}

export interface PnJenisSummary {
  jenis: PnJenis;
  nomorTerakhir: number;
  nomorBerikutnya: number;
  jumlahTerpakai: number;
  bulanIni: number;
  tanggalTerakhir: string | null;
}

/**
 * Format nomor urut sesuai dengan aturan pad_digit jenis dokumen.
 * Contoh: no_urut 3 dengan pad_digit 3 -> "003"
 *         no_urut 174 dengan pad_digit null -> "174"
 */
export function formatNomorUrut(noUrut: number, padDigit: number | null | undefined): string {
  if (!padDigit || padDigit <= 1) {
    return String(noUrut);
  }
  return String(noUrut).padStart(padDigit, '0');
}
