/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * documentGenerator.ts
 * Utility untuk generate Surat Tugas & SPPD.
 * - Format .DOCX: Dirender langsung di client menggunakan docxtemplater & pizzip.
 * - Format .PDF: Menghasilkan PDF 1:1 identik dengan Microsoft Word dengan cara
 *   mengirimkan Blob .DOCX yang sudah jadi ke Server-side Document Conversion API
 *   (ConvertAPI / Gotenberg / LibreOffice API), bukan rendering HTML browser.
 */

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
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

  // 6. Kerapihan Tabel Personel: Tambahkan w:tblGrid, lebar kolom eksplisit, dan <w:noWrap/> agar 'No' tidak berdiri vertikal
  const startP = xml.indexOf('{#PERSONNELS}');
  if (startP !== -1) {
    const tblStart = xml.lastIndexOf('<w:tbl>', startP);
    const tblEnd = xml.indexOf('</w:tbl>', startP) + 8;
    if (tblStart !== -1 && tblEnd > tblStart) {
      let tblXml = xml.slice(tblStart, tblEnd);

      // Sisipkan w:tblGrid jika belum ada
      if (!tblXml.includes('<w:tblGrid>')) {
        tblXml = tblXml.replace(
          /<\/w:tblPr>/,
          '</w:tblPr><w:tblGrid><w:gridCol w:w="600"/><w:gridCol w:w="4200"/><w:gridCol w:w="2200"/><w:gridCol w:w="2930"/></w:tblGrid>'
        );
      }

      // Pastikan kolom 'No' memiliki lebar 600 dxa dan w:noWrap agar tidak terpotong vertikal
      tblXml = tblXml.replace(
        /<w:tc><w:tcPr>[\s\S]*?<\/w:tcPr>(\s*<w:p[\s\S]*?>No<\/w:t>)/,
        '<w:tc><w:tcPr><w:tcW w:w="600" w:type="dxa"/><w:noWrap/><w:shd w:fill="d9ead3" w:val="clear"/><w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="40" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>$1'
      );
      tblXml = tblXml.replace(
        /<w:tc><w:tcPr>[\s\S]*?<\/w:tcPr>(\s*<w:p[\s\S]*?\{#PERSONNELS\})/,
        '<w:tc><w:tcPr><w:tcW w:w="600" w:type="dxa"/><w:noWrap/><w:shd w:fill="auto" w:val="clear"/><w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="40" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>$1'
      );

      // Kolom NIK juga diberikan w:noWrap
      tblXml = tblXml.replace(
        /<w:tc><w:tcPr>[\s\S]*?<\/w:tcPr>(\s*<w:p[\s\S]*?>NIK<\/w:t>)/,
        '<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/><w:noWrap/><w:shd w:fill="d9ead3" w:val="clear"/><w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>$1'
      );
      tblXml = tblXml.replace(
        /<w:tc><w:tcPr>[\s\S]*?<\/w:tcPr>(\s*<w:p[\s\S]*?\{\{NIK\}\})/,
        '<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/><w:noWrap/><w:shd w:fill="auto" w:val="clear"/><w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>$1'
      );

      // Ganti padding 0.0 menjadi padding seimbang: top/bottom 60 dxa (3pt), left 120 dxa (6pt), right 100 dxa (5pt)
      tblXml = tblXml.replace(
        /<w:tcMar><w:top w:w="0\.0" w:type="dxa"\/><w:left w:w="0\.0" w:type="dxa"\/><w:bottom w:w="0\.0" w:type="dxa"\/><w:right w:w="0\.0" w:type="dxa"\/><\/w:tcMar>/g,
        '<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>'
      );
      // Header vertikal align center
      tblXml = tblXml.replace(/<w:vAlign w:val="bottom"\/>/g, '<w:vAlign w:val="center"/>');
      // Ratakan spasi paragraf di dalam baris agar vertikal centering sempurna
      tblXml = tblXml.replace(
        /<w:spacing w:after="100" w:before="0" w:line="276" w:lineRule="auto"\/>/g,
        '<w:spacing w:after="0" w:before="0" w:line="240" w:lineRule="auto"/>'
      );
      // Sisipkan default tblCellMar di w:tblPr jika belum ada
      if (!tblXml.includes('<w:tblCellMar>')) {
        tblXml = tblXml.replace(
          /<\/w:tblBorders>/,
          '</w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar>'
        );
      }
      xml = xml.slice(0, tblStart) + tblXml + xml.slice(tblEnd);
    }
  }

  // 7. Normalisasi {{VAR}} -> {VAR}
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
      NAMA_PERSONEL_2: personnelsList[1]?.NAMA || '-',
      NAMA_PERSONEL_3: personnelsList[2]?.NAMA || '-',
    },
    nomorUrut,
    includeSppd: options.includeSppd !== false
  };
}

// ── CORE DOCX BLOB RENDERER ───────────────────────────────────────────────────

/**
 * Render file .docx di memory menggunakan template Word statis & docxtemplater.
 * Menghasilkan Blob Word murni yang siap diunduh atau dikirim ke API konversi.
 */
export async function renderSuratTugasDocxBlob(
  schedule: Schedule,
  manpowerList: Manpower[] = [],
  options: GenerateDocOptions = {}
): Promise<{
  blob: Blob;
  nomorUrut: number;
  fileNameBase: string;
}> {
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

  const paddedNomor = String(nomorUrut).padStart(3, '0');
  const cleanClient = (schedule.client_name || 'Klien')
    .replace(/[_/\\?%*:|"<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const fileNameBase = `Surat Tugas ${paddedNomor} ${cleanClient} ${schedule.start_date}`;

  return { blob, nomorUrut, fileNameBase };
}

/**
 * Alias untuk renderSuratTugasDocxBlob
 */
export const generateSuratTugasDocxBlob = renderSuratTugasDocxBlob;

// ── GENERATE DOCX DOWNLOAD ────────────────────────────────────────────────────

export async function generateSuratTugasDocx(
  schedule: Schedule,
  manpowerList: Manpower[] = [],
  options: GenerateDocOptions = {}
): Promise<void> {
  const { blob, fileNameBase } = await renderSuratTugasDocxBlob(schedule, manpowerList, options);
  saveAs(blob, `${fileNameBase}.docx`);
}

// ── BAGIAN 3: GENERATE PDF VIA SERVER-SIDE WORD CONVERSION API ────────────────

/**
 * Konversi DOCX Blob ke PDF menggunakan ConvertAPI REST API:
 * Endpoint: https://v2.convertapi.com/convert/docx/to/pdf
 */
async function convertDocxToPdfViaConvertApi(
  docxBlob: Blob,
  fileName: string,
  secret: string
): Promise<Blob> {
  const formData = new FormData();
  formData.append('File', docxBlob, fileName);
  formData.append('StoreFile', 'false');

  const response = await fetch(`https://v2.convertapi.com/convert/docx/to/pdf?Secret=${encodeURIComponent(secret)}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errDetail = '';
    try {
      const errJson = await response.json();
      errDetail = errJson.Message || JSON.stringify(errJson);
    } catch {
      errDetail = await response.text();
    }
    throw new Error(`ConvertAPI Error (${response.status}): ${errDetail}`);
  }

  const result = await response.json();
  if (result.Files && result.Files.length > 0) {
    const fileItem = result.Files[0];
    if (fileItem.FileData) {
      // Decode Base64 binary
      const binaryString = atob(fileItem.FileData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: 'application/pdf' });
    } else if (fileItem.Url) {
      const fileRes = await fetch(fileItem.Url);
      return await fileRes.blob();
    }
  }

  throw new Error('ConvertAPI tidak mengembalikan file PDF yang valid.');
}

/**
 * Helper: Konversi Blob ke string Base64 murni
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Konversi DOCX Blob ke PDF menggunakan backend proxy /api/convert-pdf:
 * Menghindari kendala CORS, ad-blocker, atau environment variable di client-side.
 */
async function convertDocxToPdfViaBackendProxy(
  docxBlob: Blob,
  fileName: string
): Promise<Blob> {
  const docxBase64 = await blobToBase64(docxBlob);
  const response = await fetch('/api/convert-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ docxBase64, fileName }),
  });

  if (!response.ok) {
    let errDetail = '';
    try {
      const errJson = await response.json();
      errDetail = errJson.error || JSON.stringify(errJson);
    } catch {
      errDetail = await response.text();
    }
    throw new Error(`Proxy Conversion Error (${response.status}): ${errDetail}`);
  }

  const result = await response.json();
  if (result.pdfBase64) {
    const binaryString = atob(result.pdfBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'application/pdf' });
  }

  throw new Error('Backend proxy tidak mengembalikan data PDF yang valid.');
}

/**
 * Konversi DOCX Blob ke PDF menggunakan Custom / Self-hosted LibreOffice API (seperti Gotenberg):
 * Endpoint: VITE_DOCX_TO_PDF_API_URL (e.g. https://your-gotenberg.com/forms/libreoffice/convert)
 */
async function convertDocxToPdfViaCustomService(
  docxBlob: Blob,
  fileName: string,
  apiUrl: string
): Promise<Blob> {
  const formData = new FormData();
  formData.append('files', docxBlob, fileName);

  const response = await fetch(apiUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`API Konversi Error (${response.status}): ${await response.text()}`);
  }

  return await response.blob();
}

/**
 * Fungsi Utama: Generate Surat Tugas & SPPD sebagai PDF 1:1 identik dengan Word.
 * Murni memanggil REST API (ConvertAPI) via fetch:
 * 1. Render template Word (.docx) di memory (presisi font, tabel, & kop surat).
 * 2. Kirim docx Blob ke ConvertAPI REST API (direct atau melalui backend proxy /api/convert-pdf).
 * 3. Unduh hasil PDF yang 100% identik dengan tampilan Microsoft Word asli.
 * 4. Jika API gagal atau API Key tidak terbaca: LEMPAR ERROR & ALERT USER, tanpa browser-side fallback.
 */
export async function generateSuratTugasPdf(
  schedule: Schedule,
  manpowerList: Manpower[] = [],
  options: GenerateDocOptions = {}
): Promise<void> {
  // 1. Render .docx di memory terlebih dahulu
  const { blob: docxBlob, fileNameBase } = await renderSuratTugasDocxBlob(schedule, manpowerList, options);

  // 2. Baca kredensial ConvertAPI dari env client-side (dengan multiple fallbacks)
  const convertApiSecret = (
    (import.meta.env.VITE_CONVERTAPI_SECRET as string | undefined) ||
    (import.meta.env.CONVERTAPI_SECRET as string | undefined) ||
    'qEjYBMPnr5Heup6mpL6Q4wjLa43J6BZb'
  )?.trim();
  const customApiUrl = (import.meta.env.VITE_DOCX_TO_PDF_API_URL as string | undefined)?.trim();

  let pdfBlob: Blob | null = null;
  let lastError: Error | null = null;

  // Jalur 1: Direct fetch ke ConvertAPI dari browser
  if (convertApiSecret) {
    try {
      console.log('[PDF Generator] Mengonversi DOCX ke PDF via ConvertAPI direct REST API...');
      pdfBlob = await convertDocxToPdfViaConvertApi(docxBlob, `${fileNameBase}.docx`, convertApiSecret);
    } catch (directErr) {
      console.warn('[PDF Generator] Direct ConvertAPI call failed, mencoba fallback ke backend proxy /api/convert-pdf...', directErr);
      lastError = directErr as Error;
    }
  } else if (customApiUrl) {
    try {
      pdfBlob = await convertDocxToPdfViaCustomService(docxBlob, `${fileNameBase}.docx`, customApiUrl);
    } catch (customErr) {
      console.warn('[PDF Generator] Custom conversion API failed:', customErr);
      lastError = customErr as Error;
    }
  }

  // Jalur 2: Fallback ke backend proxy /api/convert-pdf jika direct call gagal
  if (!pdfBlob) {
    try {
      console.log('[PDF Generator] Mengonversi DOCX ke PDF via backend /api/convert-pdf...');
      pdfBlob = await convertDocxToPdfViaBackendProxy(docxBlob, `${fileNameBase}.docx`);
    } catch (proxyErr) {
      console.error('[PDF Generator] Backend proxy conversion failed:', proxyErr);
      lastError = proxyErr as Error;
    }
  }

  // Jika semua jalur REST API gagal
  if (!pdfBlob) {
    const errorMsg = 'Gagal menghubungi server konversi PDF. Pastikan API Key valid atau coba unduh versi Word terlebih dahulu.';
    alert(errorMsg);
    throw lastError || new Error(errorMsg);
  }

  // 4. Unduh file PDF hasil konversi
  saveAs(pdfBlob, `${fileNameBase}.pdf`);
}
