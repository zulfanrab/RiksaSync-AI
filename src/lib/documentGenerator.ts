/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * documentGenerator.ts
 * Utility untuk generate Surat Tugas & SPPD dalam format .DOCX dan .PDF.
 * Mendukung Auto-patch XML template Word, Fallback Database Personel Resmi,
 * serta sinkronisasi penomoran surat.
 */

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Schedule, Manpower } from '../types';

// ── BAGIAN 1: OFFICIAL PERSONNEL DATABASE ─────────────────────────────────────

export interface OfficialPersonnel {
  nama_lengkap: string; // Resmi, tanpa gelar akademik
  nik: string;          // 11 digit resmi
  title: string;        // Jabatan resmi Bahasa Inggris
  aliases: string[];    // Panggilan, variasi nama
}

export const OFFICIAL_PERSONNEL_DB: OfficialPersonnel[] = [
  {
    nama_lengkap: 'Habsi Gufira Pradana',
    nik: '20250701001',
    title: 'Director',
    aliases: ['habsi', 'habsi gufira', 'habsi gufira pradana']
  },
  {
    nama_lengkap: 'Rama Regawa Sri Anggayana',
    nik: '20220203001',
    title: 'Chief Safety Inspector',
    aliases: ['rama', 'rama regawa', 'rama regawa sri anggayana']
  },
  {
    nama_lengkap: 'Imam Taufiq Rakhman Hidayat',
    nik: '20220503003',
    title: 'Safety Technical Inspector',
    aliases: ['imam', 'imam taufiq', 'imam taufiq rakhman hidayat']
  },
  {
    nama_lengkap: 'Fauzan Akmaluddin',
    nik: '20240903002',
    title: 'Safety Technical Inspector',
    aliases: ['fauzan', 'fauzan akmaluddin']
  },
  {
    nama_lengkap: 'Fakhziar Wildan Hidayat',
    nik: '20250103001',
    title: 'Safety Technical Inspector',
    aliases: ['fakhziar', 'fakhziar wildan', 'wildan', 'fakhziar wildan hidayat']
  },
  {
    nama_lengkap: 'Demas Cahyadi Ningrat',
    nik: '20261003001',
    title: 'Inspector Assistant',
    aliases: ['demas', 'demas cahyadi', 'demas cahyadi ningrat']
  },
  {
    nama_lengkap: 'Arya Rizki Pratama',
    nik: '20240904002',
    title: 'Technical Support Officer',
    aliases: ['arya', 'arya rizki', 'arya rizki pratama']
  },
  {
    nama_lengkap: 'Muhammad Fazar Maulana',
    nik: '20220905001',
    title: 'Technical Administration Officer',
    aliases: ['fazar', 'fajar', 'muhammad fazar maulana', 'muhammad fajar maulana', 'm fazar maulana']
  },
  {
    nama_lengkap: 'Aulia Zahra Dikrika',
    nik: '20260904005',
    title: 'Finance Administration Officer',
    aliases: ['zahra', 'aulia zahra', 'aulia zahra dikrika']
  },
  {
    nama_lengkap: 'Marsya Aulia Rohmah',
    nik: '20261004006',
    title: 'HR & General Affairs Officer',
    aliases: ['marsya', 'marsya aulia', 'marsya aulia rohmah']
  },
  {
    nama_lengkap: 'Rio Adrianto',
    nik: '20250404001',
    title: 'Office Support Staff',
    aliases: ['rio', 'rio adrianto']
  },
  {
    nama_lengkap: 'Reyhan Afril Julianto',
    nik: '20261104007',
    title: 'Office Support Staff',
    aliases: ['reyhan', 'reyhan afril', 'reyhan afril julianto']
  },
  {
    nama_lengkap: 'Zulfan Rafly Baihaqi',
    nik: '20251105001',
    title: 'IT & Digital Specialist',
    aliases: ['zulfan', 'zulfan rafly', 'zulfan rafly baihaqi']
  }
];

// ── KONSTANTA & HELPERS PENANGGALAN ──────────────────────────────────────────

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
 * Bersihkan string nama dari gelar akademik (S.T., S.AP., dsb).
 */
export function stripAcademicTitle(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .replace(/,\s*(S\.T\.?|S\.AP\.?|S\.Pd\.?|M\.T\.?|A\.Md\.?|S\.Kom\.?|S\.E\.?|S\.Si\.?|Ir\.?|M\.M\.?|M\.Si\.?)/gi, '')
    .trim();
}

/**
 * Mencocokkan input nama/panggilan dengan database resmi.
 */
export function matchOfficialPersonnel(inputName: string): OfficialPersonnel | null {
  if (!inputName) return null;
  const cleaned = stripAcademicTitle(inputName).toLowerCase();

  // 1. Exact match on full official name
  for (const person of OFFICIAL_PERSONNEL_DB) {
    if (person.nama_lengkap.toLowerCase() === cleaned) return person;
  }

  // 2. Exact match on aliases
  for (const person of OFFICIAL_PERSONNEL_DB) {
    if (person.aliases.some(a => a.toLowerCase() === cleaned)) return person;
  }

  // 3. Substring / partial match
  for (const person of OFFICIAL_PERSONNEL_DB) {
    const pClean = person.nama_lengkap.toLowerCase();
    if (cleaned.includes(pClean) || pClean.includes(cleaned)) return person;
    for (const a of person.aliases) {
      if (cleaned.includes(a.toLowerCase())) return person;
    }
  }

  return null;
}

export interface ResolvedPersonnel {
  NO: number;
  NAMA: string;
  NIK: string;
  JABATAN: string;
  isLead?: boolean;
}

/**
 * Resolves single manpower / person input to official personnel representation.
 */
function resolvePerson(
  rawName: string,
  rawNik?: string,
  rawJabatan?: string,
  isInternal = true
): { nama: string; nik: string; jabatan: string } {
  const matched = matchOfficialPersonnel(rawName);
  if (matched) {
    return {
      nama: matched.nama_lengkap,
      nik: matched.nik,
      jabatan: matched.title
    };
  }

  // If not matched:
  const cleanedName = stripAcademicTitle(rawName) || '-';
  if (!isInternal) {
    return {
      nama: cleanedName,
      nik: '-',
      jabatan: 'Tenaga Ahli Mitra (External Specialist)'
    };
  }

  return {
    nama: cleanedName,
    nik: rawNik && rawNik !== '-' ? rawNik : '-',
    jabatan: rawJabatan || 'Technical Support Officer'
  };
}

/**
 * Resolves schedule personnels with strict ordering:
 * 1. No. 1 is ALWAYS Lead Expert (Ahli SKP)
 * 2. No. 2, 3, etc. are support team without duplicating the lead expert
 */
export function resolveSchedulePersonnels(
  schedule: Schedule,
  manpowerList: Manpower[] = []
): ResolvedPersonnel[] {
  const result: ResolvedPersonnel[] = [];
  const processedKeys = new Set<string>();

  // ── Step 1: Lead Expert (No. 1) ───────────────────────────────────────────
  let leadPerson: Manpower | undefined;
  if (schedule.lead_expert_id) {
    leadPerson = manpowerList.find(m => m.id === schedule.lead_expert_id);
  }

  if (leadPerson) {
    const isInternal = leadPerson.kategori_tim ? leadPerson.kategori_tim === 'Internal' : leadPerson.status === 'internal';
    const resolved = resolvePerson(
      leadPerson.nama_lengkap || leadPerson.name,
      leadPerson.nik,
      leadPerson.jabatan_resmi || leadPerson.role,
      isInternal
    );
    result.push({
      NO: 1,
      NAMA: resolved.nama,
      NIK: resolved.nik,
      JABATAN: resolved.jabatan,
      isLead: true
    });
    processedKeys.add(leadPerson.id);
    processedKeys.add(resolved.nama.toLowerCase());
    if (resolved.nik !== '-') processedKeys.add(resolved.nik);
  }

  // ── Step 2: Support Team (No. 2, 3, dst) ──────────────────────────────────
  if (schedule.support_team_details && schedule.support_team_details.length > 0) {
    for (const member of schedule.support_team_details) {
      if (member.id && processedKeys.has(member.id)) continue;
      const rawName = member.nama_lengkap || member.name;
      if (processedKeys.has(rawName.toLowerCase())) continue;

      const isInternal = member.kategori_tim ? member.kategori_tim === 'Internal' : true;
      const resolved = resolvePerson(rawName, member.nik, member.jabatan_resmi || member.role, isInternal);
      if (processedKeys.has(resolved.nama.toLowerCase())) continue;
      if (resolved.nik !== '-' && processedKeys.has(resolved.nik)) continue;

      result.push({
        NO: result.length + 1,
        NAMA: resolved.nama,
        NIK: resolved.nik,
        JABATAN: resolved.jabatan,
        isLead: false
      });
      if (member.id) processedKeys.add(member.id);
      processedKeys.add(resolved.nama.toLowerCase());
      if (resolved.nik !== '-') processedKeys.add(resolved.nik);
    }
  } else if (schedule.support_ids && schedule.support_ids.length > 0) {
    for (const sid of schedule.support_ids) {
      if (processedKeys.has(sid)) continue;
      const mp = manpowerList.find(m => m.id === sid);
      if (!mp) continue;

      const rawName = mp.nama_lengkap || mp.name;
      if (processedKeys.has(rawName.toLowerCase())) continue;

      const isInternal = mp.kategori_tim ? mp.kategori_tim === 'Internal' : mp.status === 'internal';
      const resolved = resolvePerson(rawName, mp.nik, mp.jabatan_resmi || mp.role, isInternal);
      if (processedKeys.has(resolved.nama.toLowerCase())) continue;
      if (resolved.nik !== '-' && processedKeys.has(resolved.nik)) continue;

      result.push({
        NO: result.length + 1,
        NAMA: resolved.nama,
        NIK: resolved.nik,
        JABATAN: resolved.jabatan,
        isLead: false
      });
      processedKeys.add(sid);
      processedKeys.add(resolved.nama.toLowerCase());
      if (resolved.nik !== '-') processedKeys.add(resolved.nik);
    }
  }

  // Fallback jika tidak ada lead dan tidak ada support
  if (result.length === 0) {
    result.push({
      NO: 1,
      NAMA: 'Petugas Inspeksi Lapangan',
      NIK: '-',
      JABATAN: 'Safety Technical Inspector',
      isLead: true
    });
  }

  // Pastikan nomor urut selalu 1, 2, 3...
  return result.map((item, idx) => ({ ...item, NO: idx + 1 }));
}

/**
 * Format tanggal dari string YYYY-MM-DD ke format Indonesia murni (tanpa jam).
 * Contoh: "2026-11-12" -> "12 November 2026"
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
 * Konversi angka hari ke terbilang Bahasa Indonesia (1-30).
 */
export function terbilangHari(n: number): string {
  return TERBILANG_1_30[n] ?? `${n}`;
}

/**
 * Hitung selisih hari antara dua YYYY-MM-DD (inklusif, minimal 1).
 */
export function hitungLamaHari(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

/**
 * Ekstrak nama kota yang valid dari alamat atau nama instansi.
 * Menghindari pemotongan nama PT. Default "Bandung".
 */
export function extractKotaTujuan(address: string): string {
  if (!address) return 'Bandung';

  const knownCities = [
    'Jakarta', 'Bandung', 'Bekasi', 'Karawang', 'Bogor', 'Depok', 'Tangerang',
    'Cilegon', 'Serang', 'Semarang', 'Surabaya', 'Cirebon', 'Purwakarta', 'Subang',
    'Sukabumi', 'Cianjur', 'Tasikmalaya', 'Garut', 'Cimahi', 'Batam', 'Medan',
    'Palembang', 'Balikpapan', 'Samarinda', 'Makassar', 'Cikarang'
  ];

  for (const city of knownCities) {
    const regex = new RegExp(`\\b${city}\\b`, 'i');
    if (regex.test(address)) {
      return city;
    }
  }

  // Cek segmen setelah koma terakhir
  const commaIdx = address.lastIndexOf(',');
  if (commaIdx !== -1) {
    const candidate = address.slice(commaIdx + 1).trim();
    if (candidate && !/^(pt|cv|tbk)\b/i.test(candidate) && candidate.length <= 30) {
      return candidate;
    }
  }

  return 'Bandung';
}

// ── BAGIAN PENOMORAN SURAT & FILENAME HELPER ──────────────────────────────────

/**
 * Format nomor surat standar: 003/ARP/ST/XI/2026 atau 003/ARP/SPPD/XI/2026
 */
export function formatNomorSurat(nomorUrut: number, jenis: 'ST' | 'SPPD', dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const padded = String(nomorUrut).padStart(3, '0');
  return `${padded}/ARP/${jenis}/${ROMAWI[month]}/${year}`;
}

/**
 * Format nama file hasil download:
 * - Menggunakan nomor surat murni (tanpa kode surat, e.g. "003")
 * - TANPA menggunakan tanda baca underscore (_), melainkan spasi
 * Contoh: "Surat Tugas 003 PT Indofood CBP Sukses Makmur Tbk 2026-11-12.docx"
 */
export function buildDocFileName(
  nomorUrut: number,
  clientName: string,
  startDate: string,
  extension: 'docx' | 'pdf'
): string {
  const paddedNomor = String(nomorUrut).padStart(3, '0');
  // Hapus tanda baca underscore, slash, backslash, simbol dilarang di filesystem
  const cleanClient = (clientName || 'Klien')
    .replace(/[_/\\?%*:|"<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return `Surat Tugas ${paddedNomor} ${cleanClient} ${startDate}.${extension}`;
}

/**
 * Ambil nomor urut yang sudah tersimpan untuk schedule tertentu,
 * atau ambil counter terakhir + 1 jika belum pernah disimpan.
 */
export function getStoredNomorUrut(scheduleId: string): number {
  const year = new Date().getFullYear();
  const scheduleKey = `st_nomor_${scheduleId}`;
  const savedForSchedule = localStorage.getItem(scheduleKey);
  if (savedForSchedule) {
    const parsed = parseInt(savedForSchedule, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  const globalCounterKey = `st_last_counter_${year}`;
  const lastGlobal = parseInt(localStorage.getItem(globalCounterKey) || '0', 10);
  return lastGlobal + 1;
}

/**
 * Simpan nomor urut untuk schedule tertentu dan update counter global jika lebih besar.
 */
export function saveStoredNomorUrut(scheduleId: string, nomorUrut: number): void {
  const year = new Date().getFullYear();
  localStorage.setItem(`st_nomor_${scheduleId}`, String(nomorUrut));

  const globalCounterKey = `st_last_counter_${year}`;
  const lastGlobal = parseInt(localStorage.getItem(globalCounterKey) || '0', 10);
  if (nomorUrut > lastGlobal) {
    localStorage.setItem(globalCounterKey, String(nomorUrut));
  }
}

// ── BAGIAN 2: AUTO-PATCH XML TEMPLATE WORD ───────────────────────────────────

export interface GenerateDocOptions {
  nomorUrut?: number;
  customNomorSurat?: string;
  detailUnit?: string;
  picName?: string;
  picPhone?: string;
  clientAddress?: string;
  kotaTujuan?: string;
  includeSppd?: boolean;
}

/**
 * Auto-patch XML template Word:
 * 1. Ubah kemunculan kedua {{NOMOR_SURAT_AUTO}} menjadi {{NOMOR_SURAT_SPPD}}
 * 2. Patch 1. {{NAMA_PERSONEL_2}} 2. {{NAMA_PERSONEL_3}} menjadi {{DAFTAR_PENGIKUT}}
 * 3. Typo & Format Tanda Tangan:
 *    - Di form awal: "Habsi Gufira Pradana" (Kapital pada huruf awal saja, tanpa gelar S.AP.)
 *    - Di bagian TTD: "HABSI GUFIRA PRADANA" (Kapital semua) & "DIRECTOR" (Kapital semua)
 * 4. Hapus duplikasi kalimat "Mengesahkan, Perwakilan Perusahaan / Instansi Tujuan" pada Lembar Visum
 * 5. Potong Halaman 2 jika includeSppd === false (Presisi XML tanpa merusak penutup tag)
 * 6. Normalisasi {{VAR}} -> {VAR}
 */
export function patchTemplateXml(zip: PizZip, options: { includeSppd?: boolean } = {}): void {
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) return;

  let xml = xmlFile.asText();

  // 1. Nomor SPPD Terpisah Kode pada kemunculan kedua
  const firstIndex = xml.indexOf('{{NOMOR_SURAT_AUTO}}');
  if (firstIndex !== -1) {
    const secondIndex = xml.indexOf('{{NOMOR_SURAT_AUTO}}', firstIndex + 20);
    if (secondIndex !== -1) {
      xml = xml.slice(0, secondIndex) + '{{NOMOR_SURAT_SPPD}}' + xml.slice(secondIndex + 20);
    }
  }

  // 2. Patch Pengikut SPPD menjadi variabel tunggal {{DAFTAR_PENGIKUT}}
  xml = xml.replace(/1\.\s*\{\{NAMA_PERSONEL_2\}\}\s*2\.\s*\{\{NAMA_PERSONEL_3\}\}\s*/g, '{{DAFTAR_PENGIKUT}}');
  xml = xml.replace(/1\.\s*\{NAMA_PERSONEL_2\}\s*2\.\s*\{NAMA_PERSONEL_3\}\s*/g, '{DAFTAR_PENGIKUT}');

  // 3. Nama Pak Habsi:
  // - Di form awal: "Habsi Gufira Pradana" (Title case, tanpa S.AP.)
  // - Di tanda tangan: "HABSI GUFIRA PRADANA" (All caps) & "DIRECTOR" (All caps)
  xml = xml.replace(
    /<w:t xml:space="preserve">HABSI GUFIRA PRADANA<\/w:t><w:br w:type="textWrapping"\/><w:t xml:space="preserve">DIREKTUR<\/w:t>/g,
    '<w:t xml:space="preserve">HABSI GUFIRA PRADANA</w:t><w:br/><w:t xml:space="preserve">DIRECTOR</w:t>'
  );
  xml = xml.replace(/HABSI GUFIRA PRADANADIREKTUR/g, 'HABSI GUFIRA PRADANA<w:br/>DIRECTOR');
  xml = xml.replace(/HABSI GUFIRA PRADANA,\s*S\.AP\.<w:br\/>Director/gi, 'HABSI GUFIRA PRADANA<w:br/>DIRECTOR');
  xml = xml.replace(/HABSI GUFIRA PRADANA,\s*S\.AP\./gi, 'HABSI GUFIRA PRADANA');
  xml = xml.replace(/Habsi Gufira Pradana,\s*S\.AP\./gi, 'Habsi Gufira Pradana');
  xml = xml.replace(/Habsi Gufira Pradana\s*\(Director\)/gi, 'Habsi Gufira Pradana (DIRECTOR)');

  // 4. Hapus duplikasi kalimat "Mengesahkan, Perwakilan Perusahaan / Instansi Tujuan" pada Lembar Visum
  const visumDuplicateRegex = /<w:p[^>]*w14:paraId="00000064"[\s\S]*?<w:p[^>]*w14:paraId="00000067"[\s\S]*?<\/w:p>/;
  if (visumDuplicateRegex.test(xml)) {
    xml = xml.replace(visumDuplicateRegex, '');
  } else {
    xml = xml.replace(
      /<w:p[^>]*>(?:(?!<\/w:p>)[\s\S])*?Mengesahkan,[\s\S]*?<\/w:p>\s*<w:p[^>]*>(?:(?!<\/w:p>)[\s\S])*?Perwakilan Perusahaan \/ Instansi Tujuan[\s\S]*?<\/w:p>/,
      ''
    );
  }

  // 5. Opsi Hanya Halaman 1: Jika includeSppd === false, hapus blok XML halaman 2
  // PENTING: pStart harus mencocokkan tag pembuka paragraf <w:p dengan spasi agar tidak memotong di tengah <w:pPr>!
  if (options.includeSppd === false) {
    const pb = xml.indexOf('<w:br w:type="page"/>');
    if (pb !== -1) {
      const pStart = xml.lastIndexOf('<w:p ', pb);
      const sectPrStart = xml.lastIndexOf('<w:sectPr');
      if (pStart !== -1 && sectPrStart !== -1) {
        xml = xml.slice(0, pStart) + xml.slice(sectPrStart);
      }
    }
  }

  // 6. Normalisasi {{VAR}} -> {VAR}
  xml = xml.replace(/\{\{([A-Z0-9_]+)\}\}/g, '{$1}');

  zip.file('word/document.xml', xml);
}

// ── BUILD PAYLOAD HELPER ──────────────────────────────────────────────────────

function buildPayload(
  schedule: Schedule,
  manpowerList: Manpower[] = [],
  options: GenerateDocOptions = {}
) {
  const nomorUrut = options.nomorUrut ?? getStoredNomorUrut(schedule.id);
  const nomorSuratAuto = options.customNomorSurat ?? formatNomorSurat(nomorUrut, 'ST', schedule.start_date);
  const nomorSuratSppd = nomorSuratAuto.replace('/ST/', '/SPPD/');

  // Resolusi Personel dengan Lead Expert selalu No. 1
  const personnelsList = resolveSchedulePersonnels(schedule, manpowerList);

  const ketuaNama = personnelsList[0]?.NAMA || '-';
  const ketuaJabatan = personnelsList[0]?.JABATAN || '-';

  // Daftar Pengikut SPPD:
  let daftarPengikut = '-';
  if (personnelsList.length > 1) {
    daftarPengikut = personnelsList
      .slice(1)
      .map((p, idx) => `${idx + 1}. ${p.NAMA} (${p.JABATAN})`)
      .join('\n');
  }

  // Format tanggal cetak: murni tanggal saja, tanpa jam/WIB
  const tglMulaiFormatted = formatTanggalIndonesia(schedule.start_date);
  const tglSelesaiFormatted = formatTanggalIndonesia(schedule.end_date);
  const todayIso = new Date().toISOString().split('T')[0];
  const tglCetakFormatted = formatTanggalIndonesia(todayIso);

  // Lama Hari: cukup angka + terbilang, contoh "1 (Satu)"
  const lamaHari = hitungLamaHari(schedule.start_date, schedule.end_date);
  const lamaHariFormatted = `${lamaHari} (${terbilangHari(lamaHari)})`;

  const detailUnit = options.detailUnit ?? (
    schedule.agenda_type === 'Riksa Uji' && schedule.unit_descriptions && schedule.unit_descriptions.length > 0
      ? schedule.unit_descriptions.join(', ')
      : (schedule.unit_descriptions?.join(', ') || '-')
  );

  const picName = options.picName ?? (schedule.pic_name || '-');
  const picPhone = options.picPhone ?? (schedule.pic_phone || '-');
  const alamatKlien = options.clientAddress ?? (schedule.client_address || schedule.location || '-');
  const kotaTujuan = options.kotaTujuan ?? extractKotaTujuan(alamatKlien || schedule.client_name || '');

  return {
    payload: {
      NOMOR_SURAT_AUTO: nomorSuratAuto,
      NOMOR_SURAT_SPPD: nomorSuratSppd,
      PERSONNELS: personnelsList,
      JENIS_AGENDA: schedule.agenda_type || 'Riksa Uji',
      DETAIL_UNIT: detailUnit,
      NAMA_KLIEN: schedule.client_name || '-',
      PIC_LAPANGAN: picName,
      KONTAK_PIC: picPhone,
      ALAMAT_KLIEN: alamatKlien,
      TANGGAL_MULAI: tglMulaiFormatted,
      TANGGAL_SELESAI: tglSelesaiFormatted,
      TANGGAL_CETAK: tglCetakFormatted,
      NAMA_KETUA: ketuaNama,
      JABATAN_KETUA: ketuaJabatan,
      DAFTAR_PENGIKUT: daftarPengikut,
      LOKASI_KOTA_TUJUAN: kotaTujuan,
      LAMA_HARI: lamaHariFormatted,
    },
    nomorUrut,
    includeSppd: options.includeSppd !== false
  };
}

// ── EKSTRAKSI KOP SURAT IMAGE ─────────────────────────────────────────────────

let cachedKopSuratBase64: string | null = null;

async function extractKopSuratBase64(zip: PizZip): Promise<string> {
  if (cachedKopSuratBase64) return cachedKopSuratBase64;
  const imgFile = zip.file('word/media/image1.png');
  if (imgFile) {
    const ab = imgFile.asArrayBuffer();
    if (typeof FileReader !== 'undefined') {
      const blob = new Blob([ab], { type: 'image/png' });
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          cachedKopSuratBase64 = reader.result as string;
          resolve(cachedKopSuratBase64);
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
    }
  }
  return '';
}

// ── GENERATE DOCX ─────────────────────────────────────────────────────────────

export async function generateSuratTugasDocx(
  schedule: Schedule,
  manpowerList: Manpower[] = [],
  options: GenerateDocOptions = {}
): Promise<void> {
  const templatePath = '/templates/template_surat_tugas.docx';
  let content: ArrayBuffer;
  try {
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Template tidak ditemukan (HTTP ${response.status}). Path: ${templatePath}`);
    }
    content = await response.arrayBuffer();
  } catch (err) {
    throw new Error(`Gagal mengambil template Word: ${(err as Error).message}`);
  }

  const { payload, nomorUrut, includeSppd } = buildPayload(schedule, manpowerList, options);

  let zip: PizZip;
  try {
    zip = new PizZip(content);
  } catch {
    throw new Error('File template Word rusak atau format .docx tidak valid.');
  }

  // Auto-patch XML
  patchTemplateXml(zip, { includeSppd });

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });

  try {
    doc.render(payload);
  } catch (renderError) {
    const e = renderError as { properties?: { errors?: Array<{ message?: string; name?: string }> }; message?: string };
    if (e?.properties?.errors?.length) {
      const details = e.properties.errors.map(err => `• ${err.name ?? 'Error'}: ${err.message ?? ''}`).join('\n');
      throw new Error(`Render template Word gagal:\n${details}`);
    }
    throw new Error(`Render template Word gagal: ${e?.message ?? 'Unknown error'}`);
  }

  // Simpan nomor urut yang digunakan ke localStorage
  saveStoredNomorUrut(schedule.id, nomorUrut);

  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });

  // Nama file tanpa underscore, memuat nomor surat murni
  const fileName = buildDocFileName(nomorUrut, schedule.client_name, schedule.start_date, 'docx');
  saveAs(blob, fileName);
}

// ── BAGIAN 3: GENERATE PDF ────────────────────────────────────────────────────

function generateHtmlContent(
  payload: ReturnType<typeof buildPayload>['payload'],
  kopSuratBase64: string,
  includeSppd: boolean
): string {
  return `
    <div style="background: #ffffff; color: #000000; box-sizing: border-box; font-family: 'Cambria', 'Times New Roman', serif;">
      <!-- HALAMAN 1: SURAT TUGAS -->
      <div id="pdf-page-1" style="width: 794px; min-height: 1123px; background: #ffffff; padding: 30px 42px 20px 42px; box-sizing: border-box; font-size: 10pt; line-height: 1.35; position: relative;">
        ${kopSuratBase64 ? `<img src="${kopSuratBase64}" style="width: 100%; max-height: 95px; object-fit: contain; margin-bottom: 8px; display: block;" />` : ''}

        <div style="text-align: center; margin-bottom: 12px;">
          <div style="font-size: 13pt; font-weight: bold; text-decoration: underline; letter-spacing: 0.5px;">SURAT TUGAS</div>
          <div style="font-size: 10pt; margin-top: 2px;">Nomor: ${payload.NOMOR_SURAT_AUTO}</div>
        </div>

        <div style="margin-bottom: 8px;">
          <div>Yang bertanda tangan di bawah ini:</div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 3px; font-size: 10pt;">
            <tr><td style="width: 100px; vertical-align: top;">Nama</td><td style="width: 15px; vertical-align: top;">:</td><td style="font-weight: bold;">Habsi Gufira Pradana</td></tr>
            <tr><td style="vertical-align: top;">Jabatan</td><td style="vertical-align: top;">:</td><td>Director</td></tr>
            <tr><td style="vertical-align: top;">Perusahaan</td><td style="vertical-align: top;">:</td><td>PT Aksara Riksa Perdana</td></tr>
          </table>
          <div style="margin-top: 6px;">Dalam hal ini bertindak sah untuk dan atas nama PT Aksara Riksa Perdana, menugaskan kepada:</div>
        </div>

        <!-- Tabel Personel -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9.5pt;">
          <thead>
            <tr style="background-color: #f7f7f7; text-align: center; font-weight: bold;">
              <th style="border: 1px solid #000; padding: 4px 6px; width: 35px;">No</th>
              <th style="border: 1px solid #000; padding: 4px 8px; text-align: left;">Nama Personel</th>
              <th style="border: 1px solid #000; padding: 4px 8px; text-align: center; width: 130px;">NIK</th>
              <th style="border: 1px solid #000; padding: 4px 8px; text-align: left; width: 220px;">Jabatan Resmi</th>
            </tr>
          </thead>
          <tbody>
            ${payload.PERSONNELS.map(p => `
              <tr>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">${p.NO}</td>
                <td style="border: 1px solid #000; padding: 4px 8px;">${p.NAMA}</td>
                <td style="border: 1px solid #000; padding: 4px 8px; text-align: center;">${p.NIK}</td>
                <td style="border: 1px solid #000; padding: 4px 8px;">${p.JABATAN}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Rincian Penugasan -->
        <div style="margin-bottom: 10px;">
          <div>Untuk melaksanakan tugas kedinasan dengan rincian sebagai berikut:</div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10pt;">
            <tr><td style="width: 25px; vertical-align: top;">1.</td><td style="width: 155px; vertical-align: top;">Jenis Kegiatan</td><td style="width: 15px; vertical-align: top;">:</td><td style="font-weight: bold;">${payload.JENIS_AGENDA}</td></tr>
            <tr><td style="vertical-align: top;">2.</td><td style="vertical-align: top;">Objek Pemeriksaan</td><td style="vertical-align: top;">:</td><td>${payload.DETAIL_UNIT}</td></tr>
            <tr><td style="vertical-align: top;">3.</td><td style="vertical-align: top;">Tujuan / Instansi</td><td style="vertical-align: top;">:</td><td style="font-weight: bold;">${payload.NAMA_KLIEN}</td></tr>
            <tr><td style="vertical-align: top;">4.</td><td style="vertical-align: top;">PIC & Kontak</td><td style="vertical-align: top;">:</td><td>${payload.PIC_LAPANGAN} (${payload.KONTAK_PIC})</td></tr>
            <tr><td style="vertical-align: top;">5.</td><td style="vertical-align: top;">Lokasi Penugasan</td><td style="vertical-align: top;">:</td><td>${payload.ALAMAT_KLIEN}</td></tr>
            <tr><td style="vertical-align: top;">6.</td><td style="vertical-align: top;">Waktu Pelaksanaan</td><td style="vertical-align: top;">:</td><td>${payload.TANGGAL_MULAI} s.d. ${payload.TANGGAL_SELESAI}</td></tr>
          </table>
        </div>

        <!-- Ketentuan dan Tanggung Jawab -->
        <div style="font-size: 9pt; line-height: 1.3; margin-bottom: 10px;">
          <div style="font-weight: bold; margin-bottom: 2px;">Ketentuan dan Tanggung Jawab:</div>
          <ol style="margin: 0; padding-left: 18px;">
            <li>Penerima tugas wajib mematuhi standar prosedur kerja (SOP), regulasi K3 yang berlaku, serta mematuhi peraturan keselamatan di lokasi pemberi kerja.</li>
            <li>Penerima tugas dilarang melakukan aktivitas di luar ruang lingkup yang telah ditetapkan tanpa persetujuan tertulis dari manajemen.</li>
            <li>Segera setelah penugasan selesai, penerima tugas wajib menyerahkan Laporan Hasil Pekerjaan (Berita Acara) kepada manajemen.</li>
          </ol>
          <div style="margin-top: 6px;">Demikian Surat Tugas ini diterbitkan untuk dilaksanakan dengan penuh rasa tanggung jawab dan dipergunakan sebagaimana mestinya.</div>
        </div>

        <!-- Tanda Tangan Surat Tugas -->
        <div style="margin-top: 14px; text-align: right;">
          <div style="display: inline-block; text-align: left; width: 250px; font-size: 10pt;">
            <div>Bandung, ${payload.TANGGAL_CETAK}</div>
            <div style="font-weight: bold;">PT AKSARA RIKSA PERDANA</div>
            <div style="height: 52px;"></div>
            <div style="font-weight: bold; text-decoration: underline;">HABSI GUFIRA PRADANA</div>
            <div style="font-weight: bold;">DIRECTOR</div>
          </div>
        </div>
      </div>

      <!-- HALAMAN 2: SPPD & LEMBAR VISUM -->
      ${includeSppd ? `
        <div id="pdf-page-2" style="width: 794px; min-height: 1123px; background: #ffffff; padding: 30px 42px 20px 42px; box-sizing: border-box; font-size: 10pt; line-height: 1.35; position: relative;">
          ${kopSuratBase64 ? `<img src="${kopSuratBase64}" style="width: 100%; max-height: 95px; object-fit: contain; margin-bottom: 8px; display: block;" />` : ''}

          <div style="text-align: center; margin-bottom: 12px;">
            <div style="font-size: 13pt; font-weight: bold; text-decoration: underline; letter-spacing: 0.5px;">SURAT PERINTAH PERJALANAN DINAS (SPPD)</div>
            <div style="font-size: 10pt; margin-top: 2px;">Nomor: ${payload.NOMOR_SURAT_SPPD}</div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9.5pt;">
            <tbody>
              <tr>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; width: 30px;">1</td>
                <td style="border: 1px solid #000; padding: 4px 8px; width: 220px;">Pejabat yang Memberi Perintah</td>
                <td style="border: 1px solid #000; padding: 4px 8px; font-weight: bold;">Habsi Gufira Pradana (DIRECTOR)</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">2</td>
                <td style="border: 1px solid #000; padding: 4px 8px;">Nama Pegawai yang Diperintahkan</td>
                <td style="border: 1px solid #000; padding: 4px 8px; font-weight: bold;">${payload.NAMA_KETUA} (${payload.JABATAN_KETUA})</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: top;">3</td>
                <td style="border: 1px solid #000; padding: 4px 8px; vertical-align: top;">Pengikut / Tim Pendukung</td>
                <td style="border: 1px solid #000; padding: 4px 8px; white-space: pre-line;">${payload.DAFTAR_PENGIKUT}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">4</td>
                <td style="border: 1px solid #000; padding: 4px 8px;">Maksud Perjalanan Dinas</td>
                <td style="border: 1px solid #000; padding: 4px 8px;">${payload.JENIS_AGENDA}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">5</td>
                <td style="border: 1px solid #000; padding: 4px 8px;">Alat Angkutan yang Digunakan</td>
                <td style="border: 1px solid #000; padding: 4px 8px;">Kendaraan Dinas / Pribadi</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: top;">6</td>
                <td style="border: 1px solid #000; padding: 4px 8px; vertical-align: top;">
                  a. Tempat Berangkat<br/>b. Tempat Tujuan
                </td>
                <td style="border: 1px solid #000; padding: 4px 8px; vertical-align: top;">
                  a. Kota Bandung<br/>b. ${payload.LOKASI_KOTA_TUJUAN}
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; vertical-align: top;">7</td>
                <td style="border: 1px solid #000; padding: 4px 8px; vertical-align: top;">
                  a. Lama Perjalanan Dinas<br/>b. Tanggal Berangkat<br/>c. Tanggal Harus Kembali
                </td>
                <td style="border: 1px solid #000; padding: 4px 8px; vertical-align: top;">
                  a. ${payload.LAMA_HARI} Hari<br/>b. ${payload.TANGGAL_MULAI}<br/>c. ${payload.TANGGAL_SELESAI}
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">8</td>
                <td style="border: 1px solid #000; padding: 4px 8px;">Pembebanan Anggaran</td>
                <td style="border: 1px solid #000; padding: 4px 8px;">Kas Operasional PT Aksara Riksa Perdana</td>
              </tr>
            </tbody>
          </table>

          <!-- Tanda Tangan SPPD -->
          <div style="margin-top: 10px; text-align: right;">
            <div style="display: inline-block; text-align: left; width: 250px; font-size: 10pt;">
              <div>Bandung, ${payload.TANGGAL_CETAK}</div>
              <div style="font-weight: bold;">PT AKSARA RIKSA PERDANA</div>
              <div style="height: 48px;"></div>
              <div style="font-weight: bold; text-decoration: underline;">HABSI GUFIRA PRADANA</div>
              <div style="font-weight: bold;">DIRECTOR</div>
            </div>
          </div>

          <!-- LEMBAR VISUM -->
          <div style="margin-top: 14px; border-top: 1px dashed #777; padding-top: 8px;">
            <div style="font-size: 10.5pt; font-weight: bold; text-align: center; margin-bottom: 6px;">LEMBAR VISUM / PENGESAHAN KLIEN</div>
            <div style="font-size: 9.5pt; line-height: 1.35; margin-bottom: 8px;">
              Telah Tiba di Tempat Tujuan<br/>
              Tempat: <strong>${payload.NAMA_KLIEN}</strong><br/>
              Tanggal: ${payload.TANGGAL_MULAI}
            </div>
            <div style="text-align: right;">
              <div style="display: inline-block; width: 260px; border: 1px solid #000; padding: 6px 10px; text-align: center; font-size: 9pt;">
                <div>Mengesahkan,</div>
                <div style="font-weight: bold;">Perwakilan Perusahaan / Instansi Tujuan</div>
                <div style="height: 50px;"></div>
                <div>(....................................................................)</div>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

export async function generateSuratTugasPdf(
  schedule: Schedule,
  manpowerList: Manpower[] = [],
  options: GenerateDocOptions = {}
): Promise<void> {
  const templatePath = '/templates/template_surat_tugas.docx';
  let kopSuratBase64 = '';
  try {
    const response = await fetch(templatePath);
    if (response.ok) {
      const content = await response.arrayBuffer();
      const zip = new PizZip(content);
      kopSuratBase64 = await extractKopSuratBase64(zip);
    }
  } catch {
    console.warn('Tidak dapat mengekstrak kop surat untuk PDF, rendering tanpa gambar kop.');
  }

  const { payload, nomorUrut, includeSppd } = buildPayload(schedule, manpowerList, options);

  // Simpan nomor urut
  saveStoredNomorUrut(schedule.id, nomorUrut);

  // Nama file tanpa underscore, memuat nomor surat murni
  const fileName = buildDocFileName(nomorUrut, schedule.client_name, schedule.start_date, 'pdf');

  // Buat container HTML
  // Gunakan position absolute di top: 0, left: 0 dengan z-index di bawah modal
  const container = document.createElement('div');
  container.id = 'surat-tugas-pdf-render-container';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '794px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '30';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  container.style.boxSizing = 'border-box';
  container.style.padding = '0';
  container.style.margin = '0';

  container.innerHTML = generateHtmlContent(payload, kopSuratBase64, includeSppd);
  document.body.appendChild(container);

  try {
    // Tunggu gambar (kop surat) selesai dimuat dan didecode oleh browser
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      images.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    // Beri jeda render font dan layout browser
    await new Promise(resolve => setTimeout(resolve, 300));

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const page1El = container.querySelector('#pdf-page-1') as HTMLElement;
    if (!page1El) throw new Error('Elemen Halaman 1 tidak ditemukan.');

    const canvas1 = await html2canvas(page1El, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: 794,
    });

    const imgData1 = canvas1.toDataURL('image/jpeg', 0.98);
    pdf.addImage(imgData1, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

    if (includeSppd) {
      const page2El = container.querySelector('#pdf-page-2') as HTMLElement;
      if (page2El) {
        const canvas2 = await html2canvas(page2El, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
        });
        const imgData2 = canvas2.toDataURL('image/jpeg', 0.98);
        pdf.addPage('a4', 'portrait');
        pdf.addImage(imgData2, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }
    }

    pdf.save(fileName);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
