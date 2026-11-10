/**
 * Supabase Edge Function: sync-sheets
 * One-way read-only mirror from Supabase pn_nomor to Google Sheets
 * 
 * Target workbook layout (PENOMORAN_BARU):
 * - One tab per jenis (<= 31 chars, no invalid characters)
 * - Header in row 4, data from row 5
 * - Columns: [No, Tanggal, Dibuat Oleh, Klien, Perihal, Ref, Revisi dari No., Status]
 * - Cell H2: "Terakhir disinkron: <timestamp>"
 */

import { google } from "npm:googleapis@^140.0.1";
import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const SPREADSHEET_ID = Deno.env.get("SHEETS_SPREADSHEET_ID") || "";
const CLIENT_EMAIL = Deno.env.get("GOOGLE_CLIENT_EMAIL") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") || "";
const RAW_PRIVATE_KEY = Deno.env.get("GOOGLE_PRIVATE_KEY") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function formatPrivateKey(key: string): string {
  let cleaned = key.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  return cleaned.replace(/\\n/g, "\n");
}

function getSheetTabName(kode: string, nama: string): string {
  switch (kode) {
    case 'invoice': return 'Invoice';
    case 'penawaran': return 'Penawaran';
    case 'kontrak': return 'Kontrak';
    case 'purchase-order': return 'Purchase Order (PO)';
    case 'pemberitahuan': return 'Pemberitahuan';
    case 'pernyataan': return 'Pernyataan';
    case 'bap-papa': return 'BAP PAPA';
    case 'bap-ptp': return 'BAP PTP';
    case 'bap-elev-esc': return 'BAP ELEV-ESC';
    case 'bap-il-ipp': return 'BAP IL-IPP';
    case 'bap-pubt': return 'BAP PUBT';
    case 'bastp': return 'BASTP';
    case 'sk-dalam-proses': return 'SK Dalam Proses';
    case 'surat-permohonan-skp': return 'Permohonan SKP';
    case 'surat-pengajuan': return 'Surat Pengajuan';
    case 'surat-permohonan-random': return 'Permohonan Random';
    case 's-refund': return 'S-Refund';
    case 'list-pengajuan-admin': return 'List Pengajuan Admin';
    case 'surat-tugas-admin': return 'Surat Tugas Admin';
    case 'surat-tugas-ahli': return 'Surat Tugas Ahli';
    default: return nama.replace(/[\\/?*[\]:]/g, '-').substring(0, 31);
  }
}

function formatNoUrut(no: number, padDigit: number | null): string {
  if (padDigit && padDigit > 1) {
    return String(no).padStart(padDigit, '0');
  }
  return String(no);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-webhook-secret"
      }
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    console.log("[sync-sheets] Webhook event received:", body.type || body.action);

    if (!SPREADSHEET_ID || !CLIENT_EMAIL || !RAW_PRIVATE_KEY) {
      throw new Error("Missing Google Sheets credentials in Supabase secrets (SHEETS_SPREADSHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)");
    }

    const auth = new google.auth.JWT({
      email: CLIENT_EMAIL,
      key: formatPrivateKey(RAW_PRIVATE_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });

    // ────────────────────────────────────────────────────────────────────────
    // MODE: REBUILD ALL TABS (Manual Admin Recovery)
    // ────────────────────────────────────────────────────────────────────────
    if (body.action === "rebuild_all") {
      console.log("[sync-sheets] Rebuilding all tabs from database...");

      const { data: allJenis } = await supabase.from("pn_jenis").select("*").order("urutan");
      const { data: allNomor } = await supabase.from("pn_nomor").select("*").order("no_urut", { ascending: true });
      const { data: allProfil } = await supabase.from("pn_profil").select("id, nama");

      const profilMap = new Map((allProfil || []).map((p: any) => [p.id, p.nama]));
      const nomorMap = new Map((allNomor || []).map((n: any) => [n.id, n.no_urut]));

      let syncCount = 0;

      for (const jenis of (allJenis || [])) {
        const tabName = getSheetTabName(jenis.kode, jenis.nama);
        const rowsForJenis = (allNomor || []).filter((n: any) => n.jenis_id === jenis.id);

        const rowsData = rowsForJenis.map((n: any) => [
          formatNoUrut(n.no_urut, jenis.pad_digit),
          n.tanggal || '',
          profilMap.get(n.dibuat_oleh) || n.dibuat_oleh,
          n.klien || '',
          n.perihal || '',
          n.ref || '',
          n.revisi_dari ? `Rev No. ${nomorMap.get(n.revisi_dari) || ''}` : '',
          n.status === 'batal' ? `BATAL: ${n.alasan_batal || ''}` : 'Aktif'
        ]);

        // Bersihkan data lama mulai baris 5 ke bawah
        try {
          await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${tabName}'!A5:H1000`
          });
        } catch (e) {
          console.warn(`[sync-sheets] Tab '${tabName}' clear warning:`, e);
        }

        // Tulis ulang seluruh data
        if (rowsData.length > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${tabName}'!A5`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: rowsData }
          });
        }

        // Tulis waktu sinkronisasi di cell H2
        const nowStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${tabName}'!H2`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[`Terakhir disinkron: ${nowStr} WIB`]] }
        });

        syncCount += rowsData.length;
      }

      return new Response(JSON.stringify({ success: true, message: `Berhasil sinkron ulang ${syncCount} nomor.` }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // MODE: WEBHOOK INSERT / UPDATE ROW TUNGGAL
    // ────────────────────────────────────────────────────────────────────────
    const record = body.record || body.new || body;
    if (!record || !record.id || !record.jenis_id) {
      return new Response(JSON.stringify({ message: "No valid record found in payload. Skipped." }), { status: 200 });
    }

    // Ambil metadata jenis dan nama pembuat
    const [{ data: jenis }, { data: profil }, { data: refRow }] = await Promise.all([
      supabase.from("pn_jenis").select("*").eq("id", record.jenis_id).single(),
      supabase.from("pn_profil").select("nama").eq("id", record.dibuat_oleh).maybeSingle(),
      record.revisi_dari ? supabase.from("pn_nomor").select("no_urut").eq("id", record.revisi_dari).maybeSingle() : Promise.resolve({ data: null })
    ]);

    if (!jenis) {
      throw new Error(`pn_jenis not found for ID: ${record.jenis_id}`);
    }

    const tabName = getSheetTabName(jenis.kode, jenis.nama);
    const formattedNo = formatNoUrut(record.no_urut, jenis.pad_digit);
    const creatorName = profil?.nama || record.dibuat_oleh;
    const revText = refRow?.no_urut ? `Rev No. ${formatNoUrut(refRow.no_urut, jenis.pad_digit)}` : '';
    const statusText = record.status === 'batal' ? `BATAL: ${record.alasan_batal || ''}` : 'Aktif';

    const rowValues = [
      formattedNo,
      record.tanggal || '',
      creatorName,
      record.klien || '',
      record.perihal || '',
      record.ref || '',
      revText,
      statusText
    ];

    // Cek apakah No ini sudah ada di kolom A (mulai baris 5)
    let existingRowIndex = -1;
    try {
      const colARes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${tabName}'!A5:A`
      });

      const colA = colARes.data.values || [];
      for (let i = 0; i < colA.length; i++) {
        const val = (colA[i][0] || '').toString().trim();
        if (val === formattedNo || val === String(record.no_urut)) {
          existingRowIndex = 5 + i; // Baris riil di spreadsheet
          break;
        }
      }
    } catch (e: any) {
      console.warn(`[sync-sheets] Read range error on '${tabName}':`, e.message);
    }

    if (existingRowIndex > 0) {
      // UPDATE baris yang sudah ada (Idempotent: menimpa baris yang sama)
      console.log(`[sync-sheets] Updating existing row ${existingRowIndex} in '${tabName}' for No ${formattedNo}`);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${tabName}'!A${existingRowIndex}:H${existingRowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [rowValues] }
      });
    } else {
      // APPEND baris baru
      console.log(`[sync-sheets] Appending new row in '${tabName}' for No ${formattedNo}`);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${tabName}'!A5:H`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [rowValues] }
      });
    }

    // Update timestamp sinkronisasi di cell H2
    const nowStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${tabName}'!H2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[`Terakhir disinkron: ${nowStr} WIB`]] }
    });

    // Catat status sukses di pn_sync_log
    await supabase.from("pn_sync_log")
      .update({ status: 'sukses', updated_at: new Date().toISOString() })
      .match({ nomor_id: record.id, status: 'pending' });

    return new Response(JSON.stringify({ success: true, tab: tabName, no: formattedNo }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("[sync-sheets Error]:", err.message);

    // Catat status gagal di pn_sync_log
    try {
      const body = await req.clone().json().catch(() => ({}));
      const record = body?.record || body?.new;
      if (record?.id) {
        await supabase.from("pn_sync_log")
          .update({
            status: 'gagal',
            error_message: err.message,
            updated_at: new Date().toISOString()
          })
          .match({ nomor_id: record.id, status: 'pending' });
      }
    } catch (_) {}

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

