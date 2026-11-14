/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { PnNomor, PnJenis, formatNomorUrut } from '../types/penomoran';

const KELOMPOK_NAMES: Record<string, string> = {
  tagihan: '1. Tagihan & Komersial',
  pemeriksaan: '2. Pemeriksaan & Riksa Uji',
  umum: '3. Dokumen Umum & Pengajuan',
  tugas: '4. Surat Tugas Lapangan'
};

export interface ExportFilterInfo {
  startDate?: string;
  endDate?: string;
  jenisName?: string;
  status?: string;
  totalData?: number;
}

/**
 * Ekspor data rekapan penomoran ke file Microsoft Excel (.xlsx)
 */
export function exportPenomoranToExcel(
  nomorList: PnNomor[],
  allJenis: PnJenis[],
  filterInfo?: ExportFilterInfo
) {
  const jenisMap = new Map<string, PnJenis>(allJenis.map(j => [j.id, j]));

  // 1. Data Rows
  const tableData = nomorList.map((n, idx) => {
    const j = jenisMap.get(n.jenis_id);
    const noFormatted = formatNomorUrut(n.no_urut, j?.pad_digit);
    const revFormatted = n.revisi_dari_no ? `Rev No. ${formatNomorUrut(n.revisi_dari_no, j?.pad_digit)}` : '';
    const kelompokStr = j ? (KELOMPOK_NAMES[j.kelompok] || j.kelompok) : '-';
    const statusStr = n.status === 'batal' ? 'BATAL' : (n.direvisi_di_no ? 'DIREVISI' : 'AKTIF');

    return [
      idx + 1,                                // No baris
      noFormatted,                            // No Dokumen Resmi
      j?.nama || 'Lainnya',                   // Jenis Dokumen
      kelompokStr,                            // Kelompok
      n.tanggal || '',                        // Tanggal
      n.dibuat_oleh_nama || 'Karyawan ARP',   // Dibuat Oleh
      n.klien || '',                          // Klien / Lokasi Tujuan
      n.perihal || '',                        // Perihal / Pekerjaan
      n.ref || '',                            // Ref / No. PO / Kontrak
      revFormatted,                           // Revisi dari
      statusStr,                              // Status
      n.alasan_batal || ''                    // Alasan Batal
    ];
  });

  // 2. Buat Header Rekapan
  const headers = [
    'No.',
    'No. Dokumen',
    'Jenis Dokumen',
    'Kelompok Dokumen',
    'Tanggal',
    'Dibuat Oleh',
    'Klien / Lokasi Tujuan',
    'Perihal / Pekerjaan',
    'Ref / Keterangan',
    'Revisi Dari',
    'Status',
    'Alasan Pembatalan'
  ];

  // 3. Susun Sheet dengan Info Filter di Atas
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const titleRows = [
    ['PT AKSARA RIKSA PERDANA (PJK3)'],
    ['REKAPITULASI PENOMORAN SURAT & DOKUMEN RESMI'],
    [
      `Periode: ${filterInfo?.startDate || 'Semua'} s/d ${filterInfo?.endDate || 'Semua'} | Jenis: ${filterInfo?.jenisName || 'Semua Dokumen'} | Dicetak: ${dateStr}`
    ],
    [] // baris kosong sebelum tabel
  ];

  const fullSheetData = [...titleRows, headers, ...tableData];

  // 4. Buat Worksheet & Workbook
  const ws = XLSX.utils.aoa_to_sheet(fullSheetData);

  // Set lebar kolom agar langsung rapi saat dibuka
  ws['!cols'] = [
    { wch: 6 },  // No baris
    { wch: 15 }, // No Dokumen
    { wch: 28 }, // Jenis Dokumen
    { wch: 26 }, // Kelompok
    { wch: 14 }, // Tanggal
    { wch: 20 }, // Dibuat Oleh
    { wch: 32 }, // Klien
    { wch: 42 }, // Perihal
    { wch: 22 }, // Ref
    { wch: 18 }, // Revisi
    { wch: 12 }, // Status
    { wch: 35 }  // Alasan Batal
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Penomoran');

  // 5. Tulis binary dan simpan
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const safeStart = filterInfo?.startDate || 'Awal';
  const safeEnd = filterInfo?.endDate || 'Akhir';
  const safeJenis = (filterInfo?.jenisName || 'Semua').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Rekap_Penomoran_ARP_${safeJenis}_${safeStart}_sd_${safeEnd}.xlsx`;

  saveAs(blob, filename);
}

/**
 * Ekspor data ke format CSV
 */
export function exportPenomoranToCSV(
  nomorList: PnNomor[],
  allJenis: PnJenis[],
  filterInfo?: ExportFilterInfo
) {
  const jenisMap = new Map<string, PnJenis>(allJenis.map(j => [j.id, j]));

  const headers = [
    'No.',
    'No Dokumen',
    'Jenis Dokumen',
    'Kelompok',
    'Tanggal',
    'Dibuat Oleh',
    'Klien',
    'Perihal',
    'Ref',
    'Revisi Dari',
    'Status',
    'Alasan Batal'
  ];

  const rows = nomorList.map((n, idx) => {
    const j = jenisMap.get(n.jenis_id);
    const noFormatted = formatNomorUrut(n.no_urut, j?.pad_digit);
    const revFormatted = n.revisi_dari_no ? `Rev No. ${formatNomorUrut(n.revisi_dari_no, j?.pad_digit)}` : '';
    const kelompokStr = j ? (KELOMPOK_NAMES[j.kelompok] || j.kelompok) : '-';
    const statusStr = n.status === 'batal' ? 'BATAL' : (n.direvisi_di_no ? 'DIREVISI' : 'AKTIF');

    return [
      idx + 1,
      noFormatted,
      j?.nama || '',
      kelompokStr,
      n.tanggal || '',
      n.dibuat_oleh_nama || '',
      n.klien || '',
      n.perihal || '',
      n.ref || '',
      revFormatted,
      statusStr,
      n.alasan_batal || ''
    ].map(val => `"${String(val).replace(/"/g, '""')}"`);
  });

  const csvContent = '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const safeStart = filterInfo?.startDate || 'Awal';
  const safeEnd = filterInfo?.endDate || 'Akhir';
  const safeJenis = (filterInfo?.jenisName || 'Semua').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Rekap_Penomoran_ARP_${safeJenis}_${safeStart}_sd_${safeEnd}.csv`;

  saveAs(blob, filename);
}

/**
 * Salin data tabel ke clipboard (TSV Format - siap di-paste ke Excel / Google Sheets)
 */
export async function copyPenomoranTableToClipboard(
  nomorList: PnNomor[],
  allJenis: PnJenis[]
): Promise<boolean> {
  const jenisMap = new Map<string, PnJenis>(allJenis.map(j => [j.id, j]));

  const headers = [
    'No.',
    'No Dokumen',
    'Jenis Dokumen',
    'Kelompok',
    'Tanggal',
    'Dibuat Oleh',
    'Klien',
    'Perihal',
    'Ref',
    'Revisi Dari',
    'Status',
    'Alasan Batal'
  ];

  const rows = nomorList.map((n, idx) => {
    const j = jenisMap.get(n.jenis_id);
    const noFormatted = formatNomorUrut(n.no_urut, j?.pad_digit);
    const revFormatted = n.revisi_dari_no ? `Rev No. ${formatNomorUrut(n.revisi_dari_no, j?.pad_digit)}` : '';
    const kelompokStr = j ? (KELOMPOK_NAMES[j.kelompok] || j.kelompok) : '-';
    const statusStr = n.status === 'batal' ? 'BATAL' : (n.direvisi_di_no ? 'DIREVISI' : 'AKTIF');

    return [
      idx + 1,
      noFormatted,
      j?.nama || '',
      kelompokStr,
      n.tanggal || '',
      n.dibuat_oleh_nama || '',
      n.klien || '',
      n.perihal || '',
      n.ref || '',
      revFormatted,
      statusStr,
      n.alasan_batal || ''
    ].join('\t');
  });

  const tsv = [headers.join('\t'), ...rows].join('\n');

  try {
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch (err) {
    console.error('Clipboard copy error:', err);
    return false;
  }
}

