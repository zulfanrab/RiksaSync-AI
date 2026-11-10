/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: PENOMORAN SURAT & DOKUMEN RESMI (READ-ONLY MIRROR)
 * PT AKSARA RIKSA PERDANA (PJK3)
 * ==============================================================================
 * Skrip ini bertugas:
 * 1. Otomatis membuat 20 tab dokumen resmi dengan tata letak & warna standar
 * 2. Mengunci (Protect) tab agar berstatus Read-Only bagi staf
 * 3. Menerima Webhook dari Supabase / Aplikasi web untuk upsert nomor secara real-time
 * 4. Menyediakan endpoint untuk "Sinkron Ulang Semua"
 * 
 * CARA PAKAI:
 * 1. Buka spreadsheet baru di Google Sheets (atau template PENOMORAN_BARU).
 * 2. Klik menu: Extensions (Ekstensi) > Apps Script.
 * 3. Paste seluruh isi file ini.
 * 4. Pilih fungsi "setupSemuaTabPenomoran", lalu klik ▷ Run.
 *    (Otomatis 20 tab dokumen langsung terbuat rapi dan ber-header lengkap!)
 * 5. Klik tombol "Deploy" > "New deployment" > jenis "Web App".
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Salin URL Web App yang didapat, lalu gunakan sebagai webhook di Supabase atau Web App.
 * ==============================================================================
 */

// ── 1. DAFTAR 20 TAB DOKUMEN RESMI ─────────────────────────────────────────────
var DAFTAR_JENIS_DOKUMEN = [
  { kode: "invoice",                 namaTab: "Invoice",                  kelompok: "TAGIHAN",      pad: null },
  { kode: "penawaran",               namaTab: "Penawaran",                kelompok: "TAGIHAN",      pad: null },
  { kode: "kontrak",                 namaTab: "Kontrak",                  kelompok: "TAGIHAN",      pad: null },
  { kode: "purchase-order",          namaTab: "Purchase Order (PO)",      kelompok: "TAGIHAN",      pad: 3 },
  { kode: "pemberitahuan",           namaTab: "Pemberitahuan",            kelompok: "PEMERIKSAAN",  pad: 3 },
  { kode: "pernyataan",              namaTab: "Pernyataan",               kelompok: "PEMERIKSAAN",  pad: 3 },
  { kode: "bap-papa",                namaTab: "BAP PAPA",                 kelompok: "PEMERIKSAAN",  pad: null },
  { kode: "bap-ptp",                 namaTab: "BAP PTP",                  kelompok: "PEMERIKSAAN",  pad: null },
  { kode: "bap-elev-esc",            namaTab: "BAP ELEV-ESC",             kelompok: "PEMERIKSAAN",  pad: null },
  { kode: "bap-il-ipp",              namaTab: "BAP IL-IPP",               kelompok: "PEMERIKSAAN",  pad: null },
  { kode: "bap-pubt",                namaTab: "BAP PUBT",                 kelompok: "PEMERIKSAAN",  pad: null },
  { kode: "bastp",                   namaTab: "BASTP",                    kelompok: "PEMERIKSAAN",  pad: null },
  { kode: "sk-dalam-proses",         namaTab: "SK Dalam Proses",          kelompok: "PEMERIKSAAN",  pad: 3 },
  { kode: "surat-permohonan-skp",    namaTab: "Permohonan SKP",           kelompok: "UMUM",         pad: null },
  { kode: "surat-pengajuan",         namaTab: "Surat Pengajuan",          kelompok: "UMUM",         pad: null },
  { kode: "surat-permohonan-random", namaTab: "Permohonan Random",        kelompok: "UMUM",         pad: null },
  { kode: "s-refund",                namaTab: "S-Refund",                 kelompok: "UMUM",         pad: null },
  { kode: "list-pengajuan-admin",    namaTab: "List Pengajuan Admin",     kelompok: "UMUM",         pad: null },
  { kode: "surat-tugas-admin",       namaTab: "Surat Tugas Admin",        kelompok: "TUGAS",        pad: 3 },
  { kode: "surat-tugas-ahli",        namaTab: "Surat Tugas Ahli",         kelompok: "TUGAS",        pad: 3 }
];

var HEADER_KOLOM = [
  "No",
  "Tanggal",
  "Dibuat Oleh",
  "Klien / Tujuan",
  "Perihal / Pekerjaan",
  "Ref / Keterangan",
  "Revisi dari No.",
  "Status"
];

// ── 2. FUNGSI SETUP OTOMATIS 20 TAB SPREADSHEET ─────────────────────────────────
/**
 * ▷ JALANKAN FUNGSI INI PERTAMA KALI.
 * Otomatis membangun 20 tab dokumen lengkap dengan styling rapi, header, dan cell sinkronisasi.
 */
function setupSemuaTabPenomoran() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("Buka script ini dari menu Extensions > Apps Script pada Google Sheets Anda.");
  }

  for (var i = 0; i < DAFTAR_JENIS_DOKUMEN.length; i++) {
    var item = DAFTAR_JENIS_DOKUMEN[i];
    var sheet = ss.getSheetByName(item.namaTab);

    if (!sheet) {
      sheet = ss.insertSheet(item.namaTab);
    }

    // Set judul dokumen di baris 1-2
    sheet.getRange("A1").setValue("PT AKSARA RIKSA PERDANA");
    sheet.getRange("A1").setFontWeight("bold").setFontSize(14).setFontColor("#065f46");

    sheet.getRange("A2").setValue("LOG RESMI PENOMORAN DOKUMEN: " + item.namaTab.toUpperCase());
    sheet.getRange("A2").setFontWeight("bold").setFontSize(10).setFontColor("#475569");

    // Status sinkronisasi di cell H2
    sheet.getRange("H2").setValue("Terakhir disinkron: Belum pernah");
    sheet.getRange("H2").setFontStyle("italic").setFontSize(9).setFontColor("#64748b").setHorizontalAlignment("right");

    // Header tabel di baris 4
    for (var col = 0; col < HEADER_KOLOM.length; col++) {
      sheet.getRange(4, col + 1).setValue(HEADER_KOLOM[col]);
    }

    var headerRange = sheet.getRange("A4:H4");
    headerRange.setBackground("#059669"); // Emerald primary
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(10);
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");

    // Freeze 4 baris pertama
    sheet.setFrozenRows(4);

    // Atur lebar kolom ideal
    sheet.setColumnWidth(1, 80);   // No
    sheet.setColumnWidth(2, 110);  // Tanggal
    sheet.setColumnWidth(3, 160);  // Dibuat Oleh
    sheet.setColumnWidth(4, 220);  // Klien
    sheet.setColumnWidth(5, 320);  // Perihal
    sheet.setColumnWidth(6, 180);  // Ref
    sheet.setColumnWidth(7, 130);  // Revisi dari
    sheet.setColumnWidth(8, 120);  // Status

    // Protect sheet (Read-only bagi selain pemilik)
    try {
      var protection = sheet.protect().setDescription("Tab Read-Only: Dikelola Otomatis oleh RiksaSync AI");
      var me = Session.getEffectiveUser();
      protection.addEditor(me);
      protection.removeEditors(protection.getEditors());
      if (protection.canDomainEdit()) {
        protection.setDomainEdit(false);
      }
    } catch (e) {
      Logger.log("Proteksi sheet info: " + e.message);
    }
  }

  // Hapus tab default "Sheet1" jika ada
  var defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Sheet 1");
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  SpreadsheetApp.flush();
  Logger.log("✅ 20 tab dokumen penomoran berhasil dibuat dan dikunci rapi!");
}

// ── 3. FUNGSI SINKRONISASI SATU BARIS (WEBHOOK DARI SUPABASE/WEB) ───────────────
function upsertNomorKeSheet(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var kode = (data.jenis_kode || "").toLowerCase();
  
  // Cari nama tab berdasarkan kode jenis
  var targetItem = null;
  for (var i = 0; i < DAFTAR_JENIS_DOKUMEN.length; i++) {
    if (DAFTAR_JENIS_DOKUMEN[i].kode === kode) {
      targetItem = DAFTAR_JENIS_DOKUMEN[i];
      break;
    }
  }

  if (!targetItem) {
    targetItem = { namaTab: data.jenis_nama || "Lainnya", pad: null };
  }

  var sheet = ss.getSheetByName(targetItem.namaTab);
  if (!sheet) {
    sheet = ss.insertSheet(targetItem.namaTab);
  }

  // Format nomor dengan padding
  var noRaw = data.no_urut;
  var noFormatted = String(noRaw);
  if (targetItem.pad && targetItem.pad > 1) {
    noFormatted = ("000" + noRaw).slice(-targetItem.pad);
  }

  var rowValues = [
    noFormatted,
    data.tanggal || "",
    data.dibuat_oleh_nama || data.dibuat_oleh || "",
    data.klien || "",
    data.perihal || "",
    data.ref || "",
    data.revisi_dari_no ? "Rev No. " + data.revisi_dari_no : "",
    data.status === "batal" ? "BATAL: " + (data.alasan_batal || "") : "Aktif"
  ];

  // Cari apakah nomor sudah ada di kolom A mulai baris 5
  var lastRow = sheet.getLastRow();
  var rowIndexTarget = -1;

  if (lastRow >= 5) {
    var colA = sheet.getRange(5, 1, lastRow - 4, 1).getValues();
    for (var r = 0; r < colA.length; r++) {
      var cellVal = String(colA[r][0]).trim();
      if (cellVal === noFormatted || cellVal === String(noRaw)) {
        rowIndexTarget = 5 + r;
        break;
      }
    }
  }

  if (rowIndexTarget > 0) {
    // UPDATE baris yang sudah ada (Idempotent)
    sheet.getRange(rowIndexTarget, 1, 1, 8).setValues([rowValues]);
    if (data.status === "batal") {
      sheet.getRange(rowIndexTarget, 1, 1, 8).setFontStrikeThrough(true).setFontColor("#94a3b8");
    } else {
      sheet.getRange(rowIndexTarget, 1, 1, 8).setFontStrikeThrough(false).setFontColor("#0f172a");
    }
  } else {
    // APPEND baris baru
    var nextRow = Math.max(5, lastRow + 1);
    sheet.getRange(nextRow, 1, 1, 8).setValues([rowValues]);
    sheet.getRange(nextRow, 1).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(nextRow, 2).setHorizontalAlignment("center");
    sheet.getRange(nextRow, 8).setHorizontalAlignment("center");
    
    if (data.status === "batal") {
      sheet.getRange(nextRow, 1, 1, 8).setFontStrikeThrough(true).setFontColor("#94a3b8");
    }
  }

  // Update timestamp di cell H2
  var nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");
  sheet.getRange("H2").setValue("Terakhir disinkron: " + nowStr + " WIB");

  SpreadsheetApp.flush();
  return { success: true, tab: targetItem.namaTab, no: noFormatted };
}

// ── 4. WEBHOOK RECEIVER (POST REQUEST) ──────────────────────────────────────────
function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    // Mode: Rebuild All
    if (body.action === "rebuild_all" && body.records) {
      var count = 0;
      for (var i = 0; i < body.records.length; i++) {
        upsertNomorKeSheet(body.records[i]);
        count++;
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, count: count }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Mode: Single record upsert
    var record = body.record || body.new || body;
    var result = upsertNomorKeSheet(record);

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "PT Aksara Riksa Perdana - Penomoran Surat Mirror",
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
