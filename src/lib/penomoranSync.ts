/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PnNomor, PnJenis } from '../types/penomoran';

export interface SyncResult {
  success: boolean;
  message: string;
  count?: number;
  error?: string;
  tab?: string;
  no?: string;
}

const DEFAULT_GAS_PENOMORAN_URL = 'https://script.google.com/macros/s/AKfycbypLuxlpxS9ua52Wn05CC5HynEFIttYkxYbC_uEkmf8Jl_S9SCEpv-azrR3o7J4pbB5Xw/exec';

export function getGasPenomoranUrl(): string {
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('gas_penomoran_url');
    if (customUrl && customUrl.trim()) return customUrl.trim();
  }
  return (
    (import.meta.env.VITE_GAS_PENOMORAN_URL as string) ||
    DEFAULT_GAS_PENOMORAN_URL
  );
}

/**
 * Sinkronisasi single record nomor ke Google Sheets (Nomor Baru atau Pembatalan).
 * Menggunakan Content-Type: 'text/plain;charset=utf-8' agar tidak memicu preflight CORS
 * yang ditolak oleh Google Apps Script, dengan fallback otomatis ke server proxy /api/penomoran/sync-sheets.
 */
export async function syncSingleNomorToSheets(
  nomor: PnNomor,
  jenis: PnJenis,
  creatorName: string,
  revisiDariNo?: number | null
): Promise<SyncResult> {
  const gasUrl = getGasPenomoranUrl();

  const formattedRecord = {
    id: nomor.id,
    jenis_kode: jenis.kode,
    jenis_nama: jenis.nama,
    pad_digit: jenis.pad_digit,
    tahun: nomor.tahun,
    no_urut: nomor.no_urut,
    tanggal: nomor.tanggal,
    dibuat_oleh_nama: creatorName,
    klien: nomor.klien || '',
    perihal: nomor.perihal || '',
    ref: nomor.ref || '',
    revisi_dari_no: revisiDariNo !== undefined ? revisiDariNo : (nomor.revisi_dari_no || null),
    status: nomor.status,
    alasan_batal: nomor.alasan_batal || ''
  };

  const payload = { record: formattedRecord };

  // 1. Coba kirim langsung ke Google Apps Script Web App (CORS Simple Request via text/plain)
  try {
    const directRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    if (directRes.ok) {
      const data = await directRes.json().catch(() => ({ success: true, tab: jenis.nama, no: String(nomor.no_urut) }));
      return {
        success: true,
        message: `Tersinkron ke Google Sheets (${data.tab || jenis.nama} No. ${data.no || nomor.no_urut})`,
        tab: data.tab,
        no: data.no
      };
    }
  } catch (directErr) {
    console.warn('[GAS Direct Sync Info: Mencoba melalui server proxy]', directErr);
  }

  // 2. Fallback melalui backend server proxy
  try {
    const proxyRes = await fetch('/api/penomoran/sync-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, gas_url: gasUrl })
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      return {
        success: true,
        message: data.message || `Tersinkron ke Google Sheets via Server Proxy.`
      };
    }

    const errJson = await proxyRes.json().catch(() => ({}));
    return {
      success: false,
      message: errJson.error || 'Server proxy gagal memperbarui Google Sheets.'
    };
  } catch (proxyErr: any) {
    return {
      success: false,
      message: proxyErr.message || 'Gagal menghubungi server sinkronisasi Google Sheets.'
    };
  }
}

export interface SyncProgressInfo {
  current: number;
  total: number;
  percent: number;
  message: string;
}

/**
 * Sinkronisasi Seluruh Nomor ke Google Sheets (Batch Chunking Anti-Timeout)
 * Memecah data menjadi batch 35 baris per request sehingga aman dari batas waktu timeout HTTP GAS (30-50s)
 * dan menampilkan live progress ke pengguna.
 */
export async function syncAllNomorToSheets(
  allNomor: PnNomor[],
  allJenis: PnJenis[],
  onProgress?: (info: SyncProgressInfo) => void
): Promise<SyncResult> {
  const gasUrl = getGasPenomoranUrl();
  const jenisMap = new Map(allJenis.map(j => [j.id, j]));

  const formattedRecords = allNomor.map(n => {
    const j = jenisMap.get(n.jenis_id);
    return {
      id: n.id,
      jenis_kode: j?.kode || '',
      jenis_nama: j?.nama || '',
      pad_digit: j?.pad_digit || null,
      tahun: n.tahun,
      no_urut: n.no_urut,
      tanggal: n.tanggal,
      dibuat_oleh_nama: n.dibuat_oleh_nama || 'Admin ARP',
      klien: n.klien || '',
      perihal: n.perihal || '',
      ref: n.ref || '',
      revisi_dari_no: n.revisi_dari_no || null,
      status: n.status,
      alasan_batal: n.alasan_batal || ''
    };
  });

  const total = formattedRecords.length;
  if (total === 0) {
    return {
      success: true,
      message: 'Tidak ada data nomor yang perlu disinkronkan.',
      count: 0
    };
  }

  // Pecah menjadi kelompok (chunks) 35 baris per batch agar anti-timeout
  const CHUNK_SIZE = 35;
  const chunks: typeof formattedRecords[] = [];
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    chunks.push(formattedRecords.slice(i, i + CHUNK_SIZE));
  }

  let processed = 0;
  let hasFailure = false;

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx];
    const chunkNum = cIdx + 1;
    const totalChunks = chunks.length;

    onProgress?.({
      current: processed,
      total,
      percent: Math.round((processed / total) * 100),
      message: `Menyinkronkan batch ${chunkNum}/${totalChunks} (${processed}/${total} data)...`
    });

    let chunkSuccess = false;
    let lastError = '';

    // 1. Coba direct fetch ke Google Apps Script terlebih dahulu
    try {
      const directRes = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'batch_upsert',
          records: chunk
        })
      });

      if (directRes.ok) {
        chunkSuccess = true;
      }
    } catch (directErr: any) {
      lastError = directErr.message || 'Direct GAS sync failed';
    }

    // 2. Fallback melalui server proxy jika direct fetch ditolak/error
    if (!chunkSuccess) {
      try {
        const proxyRes = await fetch('/api/penomoran/sync-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batch_upsert',
            gas_url: gasUrl,
            records: chunk
          })
        });

        if (proxyRes.ok) {
          chunkSuccess = true;
        }
      } catch (proxyErr: any) {
        lastError = proxyErr.message || 'Proxy sync failed';
      }
    }

    if (!chunkSuccess) {
      console.warn(`[Sync Batch Warning]: Batch ${chunkNum} mengalami kendala: ${lastError}`);
      hasFailure = true;
    }

    processed += chunk.length;
    onProgress?.({
      current: Math.min(processed, total),
      total,
      percent: Math.round((Math.min(processed, total) / total) * 100),
      message: `Tersinkron ${Math.min(processed, total)} dari ${total} data...`
    });

    // Istirahat singkat 120ms antar batch agar browser dan Google Sheets responsif
    if (cIdx < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 120));
    }
  }

  return {
    success: !hasFailure,
    message: hasFailure
      ? `Sinkronisasi selesai sebagian (${total} nomor diproses). Jika ada data terlewat, periksa koneksi Google Apps Script.`
      : `Berhasil menyinkronkan seluruh ${total} nomor ke Google Sheets tanpa ada yang terlewat!`,
    count: total
  };
}

