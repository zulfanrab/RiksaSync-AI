/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * documentGenerator.ts
 * Utility untuk generate Surat Tugas & SPPD (.docx) menggunakan docxtemplater.
 * Template: /public/templates/template_surat_tugas.docx
 *
 * CATATAN FORMAT TEMPLATE:
 * - Field biasa memakai double curly brace: {{FIELD_NAME}}
 * - Loop memakai single curly brace:        {#PERSONNELS} ... {/PERSONNELS}
 * - Field di dalam loop:                    {{NO}} {{NAMA}} {{NIK}} {{JABATAN}}
 * - SPPD pakai fixed slot:                  {{NAMA_PERSONEL_2}}, {{NAMA_PERSONEL_3}}
 *
 * Pre-processing: ubah {{VAR}} → {VAR} di XML agar docxtemplater bisa baca.
 * Loop tags {# /} dibiarkan (sudah single brace).
 */

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { Schedule, Manpower } from '../types';

// ── KONSTANTA ─────────────────────────────────────────────────────────────────

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

// ── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * Format tanggal dari YYYY-MM-DD ke format Indonesia.
 * Contoh: "2026-11-12" → "12 November 2026"
 */
export function formatTanggalIndonesia(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[0], 10);
  return `${day} ${BULAN_ID[month - 1] ?? ''} ${year}`;
}

/**
 * Konversi angka hari ke terbilang Bahasa Indonesia (1–30).
 */
function terbilangHari(n: number): string {
  return TERBILANG_1_30[n] ?? `${n}`;
}

/**
 * Hitung selisih hari antara dua YYYY-MM-DD (inklusif, minimal 1).
 */
function hitungLamaHari(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

/**
 * Ekstrak nama kota dari alamat lengkap.
 * Ambil segmen setelah koma terakhir, atau 2 kata terakhir.
 * Contoh: "Jl. Raya No.1, Jakarta Selatan" → "Jakarta Selatan"
 */
function extractKotaTujuan(address: string): string {
  if (!address) return '-';
  const commaIdx = address.lastIndexOf(',');
  if (commaIdx !== -1) return address.slice(commaIdx + 1).trim();
  const words = address.trim().split(/\s+/);
  if (words.length >= 2) return `${words[words.length - 2]} ${words[words.length - 1]}`;
  return address.trim();
}

/**
 * Generate nomor surat otomatis dengan counter di localStorage.
 * Format: 001/ARP/ST/XI/2026
 * Counter direset tiap tahun baru.
 */
function getNomorSuratAuto(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const storageKey = `st_counter_${year}`;
  const counter = parseInt(localStorage.getItem(storageKey) ?? '0', 10) + 1;
  localStorage.setItem(storageKey, String(counter));
  const nomorPadded = String(counter).padStart(3, '0');
  return `${nomorPadded}/ARP/ST/${ROMAWI[month]}/${year}`;
}

/**
 * Tanggal + jam saat ini dalam format WIB (Asia/Jakarta).
 * Contoh: "12 November 2026, 09:30 WIB"
 */
function getTanggalCetakWIB(): string {
  const now = new Date();
  // Konversi ke WIB (UTC+7)
  const wibOffset = 7 * 60; // menit
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibDate = new Date(utc + wibOffset * 60000);

  const day = wibDate.getDate();
  const month = BULAN_ID[wibDate.getMonth()];
  const year = wibDate.getFullYear();
  const hours = String(wibDate.getHours()).padStart(2, '0');
  const minutes = String(wibDate.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${year}, ${hours}.${minutes} WIB`;
}

/**
 * Pre-process XML di dalam zip:
 * Ubah {{VAR}} → {VAR} agar docxtemplater (delimiter default { }) bisa baca.
 * Loop tags {#TAG} dan {/TAG} sudah benar (single brace), dibiarkan.
 *
 * Hati-hati: regex replace hanya untuk {{HURUF_BESAR_UNDERSCORE}} pattern
 * supaya tidak mengganggu XML lain.
 */
function normalizeTemplateBraces(zip: PizZip): void {
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) return;

  let xml = xmlFile.asText();

  // Ubah {{VARIABLE_NAME}} → {VARIABLE_NAME}
  // Hanya match huruf kapital, angka, underscore (placeholder konvensi)
  xml = xml.replace(/\{\{([A-Z0-9_]+)\}\}/g, '{$1}');

  zip.file('word/document.xml', xml);

  // Lakukan hal sama untuk header & footer jika ada
  ['word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'].forEach(path => {
    const f = zip.file(path);
    if (f) {
      zip.file(path, f.asText().replace(/\{\{([A-Z0-9_]+)\}\}/g, '{$1}'));
    }
  });
}

// ── MAIN GENERATOR ────────────────────────────────────────────────────────────

/**
 * Generate dan download Surat Tugas & SPPD (.docx).
 *
 * @param schedule    - Data jadwal yang akan dicetak.
 * @param manpowerList - Opsional. Fallback bila support_team_details kosong.
 */
export async function generateSuratTugasDocx(
  schedule: Schedule,
  manpowerList?: Manpower[]
): Promise<void> {
  // ── 1. Fetch template ─────────────────────────────────────────────────────
  const templatePath = '/templates/template_surat_tugas.docx';
  let content: ArrayBuffer;
  try {
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Template tidak ditemukan (HTTP ${response.status}). Path: ${templatePath}`);
    }
    content = await response.arrayBuffer();
  } catch (err) {
    throw new Error(`Gagal mengambil template: ${(err as Error).message}`);
  }

  // ── 2. Build daftar personel ──────────────────────────────────────────────
  type PersonnelItem = { NO: number; NAMA: string; NIK: string; JABATAN: string };
  let personnelsList: PersonnelItem[] = [];

  if (schedule.support_team_details && schedule.support_team_details.length > 0) {
    personnelsList = schedule.support_team_details.map((person, idx) => ({
      NO: idx + 1,
      NAMA: person.nama_lengkap || person.name || '-',
      NIK: person.nik || '-',
      JABATAN: person.jabatan_resmi || person.role || '-',
    }));
  } else if (schedule.support_ids?.length && manpowerList?.length) {
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

  if (personnelsList.length === 0) {
    personnelsList = [{ NO: 1, NAMA: '-', NIK: '-', JABATAN: '-' }];
  }

  // ── 3. Data SPPD ──────────────────────────────────────────────────────────
  const ketuaNama    = personnelsList[0].NAMA;
  const ketuaJabatan = personnelsList[0].JABATAN;

  // Template SPPD punya fixed slot: NAMA_PERSONEL_2, NAMA_PERSONEL_3
  const getPersonelSlot = (idx: number): string => {
    const p = personnelsList[idx];
    if (!p) return '-';
    return `${p.NAMA}  |  ${p.JABATAN}`;
  };

  const kotaTujuan = extractKotaTujuan(
    schedule.client_address || schedule.location || schedule.client_name || '-'
  );

  // ── 4. Format tanggal & waktu WIB ────────────────────────────────────────
  const tglMulaiFormatted   = formatTanggalIndonesia(schedule.start_date);
  const tglSelesaiFormatted = formatTanggalIndonesia(schedule.end_date);
  const tglCetakFormatted   = getTanggalCetakWIB(); // "12 November 2026, 09.30 WIB"

  const lamaHari          = hitungLamaHari(schedule.start_date, schedule.end_date);
  const lamaHariTerbilang = terbilangHari(lamaHari);

  // ── 5. Nomor surat ────────────────────────────────────────────────────────
  const nomorSurat = getNomorSuratAuto();

  // ── 6. Detail unit ────────────────────────────────────────────────────────
  const detailUnit =
    schedule.agenda_type === 'Riksa Uji' &&
    schedule.unit_descriptions &&
    schedule.unit_descriptions.length > 0
      ? schedule.unit_descriptions.join(', ')
      : '-';

  // ── 7. Payload ────────────────────────────────────────────────────────────
  const payload = {
    // Surat Tugas
    NOMOR_SURAT_AUTO:  nomorSurat,
    PERSONNELS:        personnelsList,   // loop {#PERSONNELS}...{/PERSONNELS}
    JENIS_AGENDA:      schedule.agenda_type || 'Riksa Uji',
    DETAIL_UNIT:       detailUnit,
    NAMA_KLIEN:        schedule.client_name   || '-',
    PIC_LAPANGAN:      schedule.pic_name      || '-',
    KONTAK_PIC:        schedule.pic_phone     || '-',
    ALAMAT_KLIEN:      schedule.client_address || schedule.location || '-',
    TANGGAL_MULAI:     tglMulaiFormatted,
    TANGGAL_SELESAI:   tglSelesaiFormatted,
    TANGGAL_CETAK:     tglCetakFormatted,

    // SPPD
    NAMA_KETUA:        ketuaNama,
    JABATAN_KETUA:     ketuaJabatan,
    NAMA_PERSONEL_2:   getPersonelSlot(1),
    NAMA_PERSONEL_3:   getPersonelSlot(2),
    LOKASI_KOTA_TUJUAN: kotaTujuan,
    LAMA_HARI:         `${lamaHari} (${lamaHariTerbilang}) Hari`,
  };

  // ── 8. PizZip → Normalize brace → Docxtemplater ──────────────────────────
  let zip: PizZip;
  try {
    zip = new PizZip(content);
  } catch {
    throw new Error('File template rusak atau bukan format .docx yang valid.');
  }

  // Normalize {{VAR}} → {VAR} di XML sebelum render
  normalizeTemplateBraces(zip);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // nullGetter: kembalikan string kosong untuk tag yang tidak ada di payload
    nullGetter: () => '',
  });

  try {
    doc.render(payload);
  } catch (renderError) {
    const e = renderError as {
      properties?: { errors?: Array<{ message?: string; name?: string }> };
      message?: string;
    };
    if (e?.properties?.errors?.length) {
      const details = e.properties.errors
        .map(err => `• ${err.name ?? 'Error'}: ${err.message ?? ''}`)
        .join('\n');
      throw new Error(`Render template gagal:\n${details}`);
    }
    throw new Error(`Render template gagal: ${e?.message ?? 'Unknown error'}`);
  }

  // ── 9. Generate blob & download ───────────────────────────────────────────
  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });

  const safeClientName = (schedule.client_name || 'Klien')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '');
  const fileName = `Surat_Tugas_${safeClientName}_${schedule.start_date}.docx`;

  saveAs(blob, fileName);
}
