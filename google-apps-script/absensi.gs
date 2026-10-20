/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: INTEGRASI ABSENSI RIKSA SYNCS (GOOGLE DRIVE + SHEETS)
 * Versi 2.0 — dengan Mode Kerja, Nama Gedung, Alamat, dan Laporan Bulanan Otomatis
 * ==============================================================================
 *
 * PANDUAN DEPLOYMENT (HANYA SEKALI):
 * 1. Buka Google Sheets baru di Google Drive (cth: "Data Absensi Aksara Riksa")
 * 2. Klik menu "Extensions" (Ekstensi) -> "Apps Script"
 * 3. Hapus seluruh isi default Code.gs, lalu copy-paste seluruh kode ini.
 * 4. Sesuaikan konstanta FOLDER_NAME, SHEET_TAB_NAME, EMAIL_LAPORAN di bawah.
 * 5. Klik menu "Deploy" -> "New deployment"
 *    - Type: Web app
 *    - Execute as: Me (Akun Google Anda)
 *    - Who has access: Anyone (wajib agar app bisa kirim POST)
 * 6. Klik "Deploy", beri izin akses Google jika diminta.
 * 7. Salin Web app URL lalu tempelkan di modal "Google Drive" di aplikasi.
 *
 * LAPORAN BULANAN OTOMATIS:
 * - Atur Trigger: Klik ikon jam (Triggers) di Apps Script -> Add Trigger
 *   Function: generateMonthlyReport | Time-based | Month timer | Hari ke-1 setiap bulan
 * ==============================================================================
 */

// ── KONFIGURASI ──────────────────────────────────────────────────────────────
var FOLDER_NAME   = "Foto_Absensi_RiksaSyncs";
var SHEET_TAB_NAME = "Log Absensi";
var SHEET_REPORT_NAME = "Laporan Bulanan";
// Email yang akan menerima PDF Laporan Bulanan (bisa diisi lebih dari 1, pisahkan koma)
var EMAIL_LAPORAN = "zulfan@aksarariksapjk3.com";
// Nama perusahaan untuk header laporan
var NAMA_PERUSAHAAN = "PT Aksara Riksa Perdana";

// ── HEADER KOLOM (12 kolom, sesuai skema database terbaru) ───────────────────
var HEADER_ROW = [
  "Timestamp ISO",          // col 0
  "Tanggal (WIB)",          // col 1
  "Waktu (WIB)",            // col 2
  "Nama Karyawan",          // col 3
  "Email / Username",       // col 4
  "Tipe Absen",             // col 5  — Masuk | Pulang | Sakit | Cuti
  "Mode Kerja",             // col 6  — Kantor | On Site | WFH
  "Nama Gedung / Lokasi",   // col 7
  "Latitude",               // col 8
  "Longitude",              // col 9
  "Alamat Lengkap (GPS)",   // col 10
  "Link Foto Google Drive"  // col 11
];

// ── SETUP: Sheet & Folder ─────────────────────────────────────────────────────
function setupSheetAndFolder() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_TAB_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_TAB_NAME);
    sheet.appendRow(HEADER_ROW);
    var headerRange = sheet.getRange(1, 1, 1, HEADER_ROW.length);
    headerRange.setFontWeight("bold")
               .setBackground("#D1FAE5")
               .setFontColor("#065F46")
               .setBorder(true, true, true, true, true, true);
    sheet.setFrozenRows(1);
    // Set kolom lebar agar mudah dibaca
    sheet.setColumnWidth(1, 180);  // Timestamp ISO
    sheet.setColumnWidth(2, 110);  // Tanggal
    sheet.setColumnWidth(3, 90);   // Waktu
    sheet.setColumnWidth(4, 150);  // Nama
    sheet.setColumnWidth(5, 190);  // Email
    sheet.setColumnWidth(6, 90);   // Tipe
    sheet.setColumnWidth(7, 90);   // Mode Kerja
    sheet.setColumnWidth(8, 160);  // Nama Gedung
    sheet.setColumnWidth(9, 80);   // Lat
    sheet.setColumnWidth(10, 80);  // Lng
    sheet.setColumnWidth(11, 240); // Alamat
    sheet.setColumnWidth(12, 300); // Link Foto
  }

  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
  return { sheet: sheet, folder: folder };
}

// ── POST: Terima Data Absensi dari Frontend ───────────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var setup = setupSheetAndFolder();
    var sheet  = setup.sheet;
    var folder = setup.folder;

    var empName         = data.employee_name       || "Tanpa Nama";
    var empEmail        = data.employee_email      || "-";
    var type            = data.type                || "Masuk";
    var workLocationType = data.work_location_type || "Kantor";
    var buildingName    = data.building_name       || data.location_name || "-";
    var address         = data.address             || "-";
    var lat             = data.latitude            || 0;
    var lng             = data.longitude           || 0;
    var clientTime      = data.timestamp ? new Date(data.timestamp) : new Date();

    var dateWIB = Utilities.formatDate(clientTime, "Asia/Jakarta", "yyyy-MM-dd");
    var timeWIB = Utilities.formatDate(clientTime, "Asia/Jakarta", "HH:mm:ss");

    var photoDriveUrl = "-";
    if (data.photo_base64) {
      var base64Data = data.photo_base64;
      if (base64Data.indexOf(",") > -1) base64Data = base64Data.split(",")[1];
      var decodedBytes = Utilities.base64Decode(base64Data);
      var safeName     = empName.replace(/[^a-zA-Z0-9]/g, "_");
      var fileName     = "Absen_" + type + "_" + workLocationType.replace(/\s+/g, "") +
                         "_" + safeName + "_" + dateWIB + "_" + timeWIB.replace(/:/g, "-") + ".jpg";
      var blob = Utilities.newBlob(decodedBytes, "image/jpeg", fileName);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoDriveUrl = file.getUrl();
    }

    // Tulis baris ke Sheet sesuai 12 kolom terbaru
    sheet.appendRow([
      clientTime.toISOString(), // 0 - Timestamp ISO
      dateWIB,                  // 1 - Tanggal
      timeWIB,                  // 2 - Waktu
      empName,                  // 3 - Nama Karyawan
      empEmail,                 // 4 - Email
      type,                     // 5 - Tipe Absen
      workLocationType,         // 6 - Mode Kerja (Kantor | On Site | WFH)
      buildingName,             // 7 - Nama Gedung / Lokasi
      lat,                      // 8 - Latitude
      lng,                      // 9 - Longitude
      address,                  // 10 - Alamat Lengkap
      photoDriveUrl             // 11 - Link Foto Drive
    ]);

    // Warnai baris sesuai tipe absen untuk kemudahan visual
    var lastRow = sheet.getLastRow();
    var rowRange = sheet.getRange(lastRow, 1, 1, HEADER_ROW.length);
    if (type === "Masuk")   rowRange.setBackground("#F0FFF4"); // hijau muda
    else if (type === "Pulang") rowRange.setBackground("#EFF6FF"); // biru muda
    else if (type === "Sakit")  rowRange.setBackground("#FFF7ED"); // oranye muda
    else if (type === "Cuti")   rowRange.setBackground("#F5F3FF"); // ungu muda

    return ContentService.createTextOutput(JSON.stringify({
      status:            "success",
      message:           "Absensi " + type + " (" + workLocationType + ") berhasil dicatat!",
      drive_url:         photoDriveUrl,
      timestamp:         clientTime.toISOString(),
      work_location_type: workLocationType,
      building_name:     buildingName
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── GET: Ambil Riwayat Absensi ────────────────────────────────────────────────
function doGet(e) {
  try {
    var setup = setupSheetAndFolder();
    var sheet = setup.sheet;
    var data  = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success", records: []
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var filterEmail = e.parameter.email ? e.parameter.email.toLowerCase() : "";
    var records = [];

    for (var i = data.length - 1; i >= 1; i--) {
      var row      = data[i];
      var rowEmail = String(row[4]).toLowerCase();
      if (!filterEmail || rowEmail === filterEmail) {
        records.push({
          timestamp:         row[0],
          date:              row[1],
          time:              row[2],
          employee_name:     row[3],
          employee_email:    row[4],
          type:              row[5],
          work_location_type: row[6] || "Kantor",
          building_name:     row[7] || "",
          location_name:     row[7] || "",
          latitude:          row[8],
          longitude:         row[9],
          address:           row[10] || "",
          photo_drive_url:   row[11] || ""
        });
      }
      if (records.length >= 50) break;
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success", records: records
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error", message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── LAPORAN BULANAN: Generator Sheet & PDF ────────────────────────────────────
/**
 * Fungsi ini bisa dipanggil:
 * - Manual: di Apps Script Editor klik Run -> generateMonthlyReport
 * - Otomatis: via Trigger (bulan lalu, tanggal 1 setiap bulan)
 *   Trigger > Add Trigger > generateMonthlyReport > Time-driven > Month timer
 *
 * Fungsi ini:
 * 1. Membaca Log Absensi bulan lalu dari sheet "Log Absensi".
 * 2. Membuat sheet baru "Laporan – YYYY-MM" berisi rekapitulasi per karyawan.
 * 3. Menyimpan sheet tersebut sebagai PDF ke Google Drive.
 * 4. Mengirimkan PDF ke EMAIL_LAPORAN via Gmail.
 */
function generateMonthlyReport() {
  var now       = new Date();
  // Ambil data bulan lalu
  var lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var year      = lastMonth.getFullYear();
  var month     = lastMonth.getMonth(); // 0-indexed
  var monthStr  = Utilities.formatDate(lastMonth, "Asia/Jakarta", "yyyy-MM");
  var monthLabel = Utilities.formatDate(lastMonth, "Asia/Jakarta", "MMMM yyyy");

  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet  = ss.getSheetByName(SHEET_TAB_NAME);
  if (!logSheet) {
    Logger.log("Sheet '" + SHEET_TAB_NAME + "' tidak ditemukan.");
    return;
  }

  var allData = logSheet.getDataRange().getValues();
  // Filter hanya baris bulan target (skip header row 0)
  var filtered = allData.slice(1).filter(function(row) {
    if (!row[1]) return false;
    var rowDate = new Date(row[1]);
    return rowDate.getFullYear() === year && rowDate.getMonth() === month;
  });

  // ── Hitung rekap per karyawan ──────────────────────────────────────────────
  var recap = {}; // key: empName
  filtered.forEach(function(row) {
    var name  = row[3] || "Tanpa Nama";
    var email = row[4] || "-";
    var type  = String(row[5]);
    var mode  = String(row[6] || "Kantor");
    var date  = String(row[1]);

    if (!recap[name]) {
      recap[name] = {
        email:   email,
        masuk:   0,
        pulang:  0,
        sakit:   0,
        cuti:    0,
        kantor:  0,
        onSite:  0,
        wfh:     0,
        hariHadir: {},  // unique dates
      };
    }

    var r = recap[name];
    if (type === "Masuk")  { r.masuk++;  r.hariHadir[date] = true; }
    if (type === "Pulang") r.pulang++;
    if (type === "Sakit")  r.sakit++;
    if (type === "Cuti")   r.cuti++;
    if (mode === "Kantor")  r.kantor++;
    if (mode === "On Site") r.onSite++;
    if (mode === "WFH")     r.wfh++;
  });

  // ── Buat / Hapus sheet laporan lama ───────────────────────────────────────
  var reportSheetName = "Laporan – " + monthStr;
  var existing = ss.getSheetByName(reportSheetName);
  if (existing) ss.deleteSheet(existing);
  var rptSheet = ss.insertSheet(reportSheetName);

  // ── Header Laporan ─────────────────────────────────────────────────────────
  rptSheet.getRange("A1").setValue(NAMA_PERUSAHAAN)
    .setFontSize(14).setFontWeight("bold").setFontColor("#065F46");
  rptSheet.getRange("A2").setValue("LAPORAN KEHADIRAN BULANAN – " + monthLabel.toUpperCase())
    .setFontSize(11).setFontWeight("bold");
  rptSheet.getRange("A3").setValue("Digenerate otomatis oleh RiksaSync AI pada " +
    Utilities.formatDate(now, "Asia/Jakarta", "dd MMMM yyyy, HH:mm") + " WIB")
    .setFontColor("#64748B").setFontSize(9);

  // Baris kosong pemisah
  var startRow = 5;

  // Header tabel
  var tblHeader = [
    "No", "Nama Karyawan", "Email", "Hari Hadir",
    "Masuk", "Pulang", "Sakit / Izin", "Cuti",
    "Kantor", "On Site", "WFH"
  ];
  var headerRange = rptSheet.getRange(startRow, 1, 1, tblHeader.length);
  headerRange.setValues([tblHeader])
    .setFontWeight("bold")
    .setBackground("#064E3B")
    .setFontColor("#FFFFFF");

  // ── Isi Tabel Rekap ────────────────────────────────────────────────────────
  var names  = Object.keys(recap).sort();
  var dataRows = names.map(function(name, idx) {
    var r = recap[name];
    return [
      idx + 1,
      name,
      r.email,
      Object.keys(r.hariHadir).length, // jumlah hari unik yang masuk
      r.masuk,
      r.pulang,
      r.sakit,
      r.cuti,
      r.kantor,
      r.onSite,
      r.wfh
    ];
  });

  if (dataRows.length > 0) {
    var bodyRange = rptSheet.getRange(startRow + 1, 1, dataRows.length, tblHeader.length);
    bodyRange.setValues(dataRows);
    // Warnai baris genap
    for (var r = 0; r < dataRows.length; r++) {
      if (r % 2 === 0) {
        rptSheet.getRange(startRow + 1 + r, 1, 1, tblHeader.length).setBackground("#F0FDF4");
      }
    }
    // Border seluruh tabel
    rptSheet.getRange(startRow, 1, dataRows.length + 1, tblHeader.length)
      .setBorder(true, true, true, true, true, true);
  } else {
    rptSheet.getRange(startRow + 1, 1).setValue("(Tidak ada data absensi pada bulan ini)");
  }

  // ── Total baris bawah ─────────────────────────────────────────────────────
  var summaryRow = startRow + dataRows.length + 2;
  rptSheet.getRange(summaryRow, 1).setValue("Total Karyawan Aktif: " + names.length)
    .setFontWeight("bold").setFontColor("#065F46");
  rptSheet.getRange(summaryRow + 1, 1).setValue("Total Record Absensi Bulan Ini: " + filtered.length)
    .setFontWeight("bold").setFontColor("#065F46");

  // Auto-resize kolom
  rptSheet.autoResizeColumns(1, tblHeader.length);

  // ── Simpan sebagai PDF ke Google Drive ─────────────────────────────────────
  var pdfBlob = exportSheetAsPdf(ss, rptSheet, monthStr);
  var reportFolder = DriveApp.getFoldersByName(FOLDER_NAME).hasNext()
    ? DriveApp.getFoldersByName(FOLDER_NAME).next()
    : DriveApp.createFolder(FOLDER_NAME);
  var pdfFile = reportFolder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var pdfUrl = pdfFile.getUrl();

  // ── Kirim Email ke Admin / HR ──────────────────────────────────────────────
  if (EMAIL_LAPORAN && EMAIL_LAPORAN.trim() !== "") {
    var emails = EMAIL_LAPORAN.split(",").map(function(e) { return e.trim(); });
    var subject = "[RiksaSync] Laporan Kehadiran " + monthLabel + " – " + NAMA_PERUSAHAAN;
    var body = "Halo,\n\n" +
      "Berikut adalah Laporan Kehadiran Bulanan untuk periode: " + monthLabel + ".\n\n" +
      "Ringkasan:\n" +
      "- Total karyawan aktif: " + names.length + " orang\n" +
      "- Total record presensi: " + filtered.length + " entri\n\n" +
      "PDF Laporan tersedia di: " + pdfUrl + "\n\n" +
      "Laporan ini digenerate secara otomatis oleh sistem RiksaSync AI.\n\n" +
      "Salam,\nRiksaSync AI\n" + NAMA_PERUSAHAAN;

    emails.forEach(function(emailAddr) {
      try {
        GmailApp.sendEmail(emailAddr, subject, body, {
          attachments: [pdfBlob],
          name: "RiksaSync AI – " + NAMA_PERUSAHAAN
        });
      } catch(mailErr) {
        Logger.log("Gagal kirim email ke " + emailAddr + ": " + mailErr.toString());
      }
    });
  }

  Logger.log("Laporan " + monthStr + " selesai dibuat. PDF: " + pdfUrl);
  return pdfUrl;
}

// ── Helper: Export sheet tertentu ke PDF blob ──────────────────────────────────
function exportSheetAsPdf(spreadsheet, sheet, monthStr) {
  var ssId = spreadsheet.getId();
  var sheetId = sheet.getSheetId();
  var url = "https://docs.google.com/spreadsheets/d/" + ssId +
    "/export?format=pdf" +
    "&gid=" + sheetId +
    "&size=A4&portrait=false&fitw=true" +
    "&sheetnames=false&printtitle=false" +
    "&pagenumbers=false&gridlines=false&fzr=false";

  var options = {
    headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    throw new Error("Gagal export PDF, response code: " + response.getResponseCode());
  }
  return response.getBlob().setName("Laporan_Kehadiran_" + monthStr + ".pdf");
}

// ── TRIGGER SETUP: Jalankan sekali di Apps Script Editor untuk daftarkan trigger ─
/**
 * Jalankan fungsi ini SATU KALI di Apps Script Editor untuk mendaftarkan
 * trigger otomatis: tanggal 1 setiap bulan, generateMonthlyReport() akan
 * otomatis berjalan dan laporan akan dikirim via email.
 *
 * Cara: Di editor klik Run -> installMonthlyTrigger
 */
function installMonthlyTrigger() {
  // Hapus trigger lama jika ada
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === "generateMonthlyReport") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Buat trigger baru: tanggal 1 setiap bulan
  ScriptApp.newTrigger("generateMonthlyReport")
    .timeBased()
    .onMonthDay(1)
    .atHour(6) // Jam 06:00 WIB (UTC+7 = jam 23:00 UTC hari sebelumnya)
    .create();

  Logger.log("Trigger bulanan berhasil didaftarkan. Laporan akan dikirim setiap tanggal 1.");
}
