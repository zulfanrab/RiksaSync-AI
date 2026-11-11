/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * documentGenerator.ts
 * Utility untuk generate Surat Tugas & SPPD (.docx) menggunakan docxtemplater.
 * Template: /public/templates/template_surat_tugas.docx
 */

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { Schedule, Manpower } from '../types';

// ── HELPERS ───────────────────────────────────────────────────────────────────

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const TERBILANG_1_30: Record<number, string> = {
  1: 'Satu', 2: 'Dua', 3: 'Tiga', 4: 'Empat', 5: 'Lima',
  6: 'Enam', 7: 'Tujuh', 8: 'Delapan', 9: 'Sembilan', 10: 'Sepuluh',
  11: 'Sebelas', 12: 'Dua Belas', 13: 'Tiga Belas', 14: 'Empat Belas',
  15: 'Lima Belas', 16: 'Enam Belas', 17: 'Tujuh Belas', 18: 'Delapan Belas',
  19: 'Sembilan Belas', 20: 'Dua Puluh', 21: 'Dua Puluh Satu',
  22: 'Dua Puluh Dua', 23: 'Dua Puluh Tiga', 24: 'Dua Puluh Empat',
  25: 'Dua Puluh Lima', 26: 'Dua Puluh Enam', 27: 'Dua Puluh Tujuh',
  28: 'Dua Puluh Delapan', 29: 'Dua Puluh Sembilan', 30: 'Tiga Puluh'
};

/**
 * Format tanggal dari string YYYY-MM-DD ke format Indonesia.
 * Contoh: "2026-11-12" → "12 November 2026"
 */
export function formatTanggalIndonesia(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[0], 10);
  return `${day} ${BULAN_ID[month - 1] || ''} ${year}`;
}

/**
 * Konversi angka hari (1–30) ke terbilang Bahasa Indonesia.
 */
function terbilangHari(n: number): string {
  return TERBILANG_1_30[n] || `${n}`;
}

/**
 * Hitung selisih hari antara dua tanggal YYYY-MM-DD (minimal 1).
 */
function hitungLamaHari(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1; // inklusif
  return Math.max(1, diffDays);
}

/**
 * Ekstrak nama kota dari alamat lengkap.
 * Ambil segmen setelah koma terakhir, atau kata terakhir.
 * Contoh: "Jl. Raya No.1, Jakarta Selatan" → "Jakarta Selatan"
 */
function extractKotaTujuan(address: string): string {
  if (!address) return '-';
  const commaIdx = address.lastIndexOf(',');
  if (commaIdx !== -1) {
    return address.slice(commaIdx + 1).trim();
  }
  // Fallback: 2 kata terakhir
  const words = address.trim().split(/\s+/);
  if (words.length >= 2) return `${words[words.length - 2]} ${words[words.length - 1]}`;
  return address.trim();
}

/**
 * Generate nomor surat otomatis dengan counter di localStorage.
 * Format: 031/ARP/ST/{bulan-romawi}/{tahun}
 * Counter direset setiap tahun baru.
 */
function getNomorSuratAuto(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const storageKey = `st_counter_${year}`;

  let counter = parseInt(localStorage.getItem(storageKey) || '0', 10) + 1;
  localStorage.setItem(storageKey, String(counter));

  const nomorPadded = String(counter).padStart(3, '0');
  return `${nomorPadded}/ARP/ST/${ROMAWI[month]}/${year}`;
}

// ── MAIN GENERATOR ────────────────────────────────────────────────────────────

/**
 * Generate dan download Surat Tugas & SPPD (.docx) dari data jadwal.
 *
 * @param schedule - Data jadwal yang akan dicetak.
 * @param manpowerList - Opsional. Fallback jika support_team_details kosong.
 */
export async function generateSuratTugasDocx(
  schedule: Schedule,
  manpowerList?: Manpower[]
): Promise<void> {
  // ── 1. Fetch template binary ──────────────────────────────────────────────
  const templatePath = '/templates/template_surat_tugas.docx';
  let content: ArrayBuffer;
  try {
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Template tidak ditemukan di ${templatePath} (HTTP ${response.status})`);
    }
    content = await response.arrayBuffer();
  } catch (err) {
    throw new Error(`Gagal mengambil template dokumen: ${(err as Error).message}`);
  }

  // ── 2. Build daftar personel ──────────────────────────────────────────────
  type PersonnelItem = { NO: number; NAMA: string; NIK: string; JABATAN: string };
  let personnelsList: PersonnelItem[] = [];

  if (schedule.support_team_details && schedule.support_team_details.length > 0) {
    // Gunakan support_team_details (lebih lengkap, ada NIK & jabatan_resmi)
    personnelsList = schedule.support_team_details.map((person, idx) => ({
      NO: idx + 1,
      NAMA: person.nama_lengkap || person.name || '-',
      NIK: person.nik || '-',
      JABATAN: person.jabatan_resmi || person.role || '-',
    }));
  } else if (schedule.support_ids && schedule.support_ids.length > 0 && manpowerList) {
    // Fallback ke manpowerList bila support_team_details belum ada (data lama)
    personnelsList = schedule.support_ids
      .map((sid, idx) => {
        const mp = manpowerList.find(m => m.id === sid);
        if (!mp) return null;
        return {
          NO: idx + 1,
          NAMA: mp.nama_lengkap || mp.name || '-',
          NIK: mp.nik || '-',
          JABATAN: mp.jabatan_resmi || mp.role || '-',
        };
      })
      .filter((p): p is PersonnelItem => p !== null);
  }

  // Pastikan minimal ada 1 baris (supaya template tidak error)
  if (personnelsList.length === 0) {
    personnelsList = [{ NO: 1, NAMA: '-', NIK: '-', JABATAN: '-' }];
  }

  // ── 3. Data SPPD ──────────────────────────────────────────────────────────
  const ketuaNama = personnelsList[0].NAMA;
  const ketuaJabatan = personnelsList[0].JABATAN;

  let daftarPengikut = '-';
  if (personnelsList.length > 1) {
    daftarPengikut = personnelsList
      .slice(1)
      .map((p, i) => `${i + 1}. ${p.NAMA} (${p.JABATAN})`)
      .join('\n');
  }

  const kotaTujuan = extractKotaTujuan(
    schedule.client_address || schedule.location || schedule.client_name || '-'
  );

  // ── 4. Format tanggal ─────────────────────────────────────────────────────
  const tglMulaiFormatted = formatTanggalIndonesia(schedule.start_date);
  const tglSelesaiFormatted = formatTanggalIndonesia(schedule.end_date);
  const tglCetakFormatted = formatTanggalIndonesia(
    new Date().toISOString().split('T')[0]
  );

  const lamaHari = hitungLamaHari(schedule.start_date, schedule.end_date);
  const lamaHariTerbilang = terbilangHari(lamaHari);

  // ── 5. Nomor surat otomatis ───────────────────────────────────────────────
  const nomorSurat = getNomorSuratAuto();

  // ── 6. DETAIL UNIT ────────────────────────────────────────────────────────
  const detailUnit =
    schedule.agenda_type === 'Riksa Uji' && schedule.unit_descriptions && schedule.unit_descriptions.length > 0
      ? schedule.unit_descriptions.join(', ')
      : '-';

  // ── 7. Payload template ───────────────────────────────────────────────────
  const payload = {
    NOMOR_SURAT_AUTO: nomorSurat,
    PERSONNELS: personnelsList,
    JENIS_AGENDA: schedule.agenda_type || 'Riksa Uji',
    DETAIL_UNIT: detailUnit,
    NAMA_KLIEN: schedule.client_name || '-',
    PIC_LAPANGAN: schedule.pic_name || '-',
    KONTAK_PIC: schedule.pic_phone || '-',
    ALAMAT_KLIEN: schedule.client_address || schedule.location || '-',
    TANGGAL_MULAI: tglMulaiFormatted,
    TANGGAL_SELESAI: tglSelesaiFormatted,
    TANGGAL_CETAK: tglCetakFormatted,
    NAMA_KETUA: ketuaNama,
    JABATAN_KETUA: ketuaJabatan,
    DAFTAR_PENGIKUT: daftarPengikut,
    LOKASI_KOTA_TUJUAN: kotaTujuan,
    LAMA_HARI: `${lamaHari} (${lamaHariTerbilang}) Hari`,
  };

  // ── 8. Render docxtemplater ───────────────────────────────────────────────
  let zip: PizZip;
  try {
    zip = new PizZip(content);
  } catch {
    throw new Error('File template rusak atau bukan format .docx yang valid.');
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  try {
    doc.render(payload);
  } catch (renderError) {
    // Tangkap error template seperti tag yang tidak ditemukan
    const e = renderError as { properties?: { errors?: unknown[] } };
    if (e?.properties?.errors) {
      console.error('Docxtemplater render errors:', e.properties.errors);
    }
    throw new Error(
      'Gagal me-render template. Pastikan placeholder di template .docx sudah sesuai.'
    );
  }

  // ── 9. Generate blob & trigger download ───────────────────────────────────
  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });

  const safeClientName = (schedule.client_name || 'Klien').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const fileName = `Surat_Tugas_${safeClientName}_${schedule.start_date}.docx`;

  saveAs(blob, fileName);
}
