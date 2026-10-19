/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: INTEGRASI ABSENSI RIKSA SYNCS (GOOGLE DRIVE + SHEETS)
 * ==============================================================================
 * 
 * PANDUAN DEPLOYMENT (HANYA SEKALI):
 * 1. Buka Google Sheets baru di Google Drive Anda (cth: "Data Absensi Aksara Riksa")
 * 2. Klik menu "Extensions" (Ekstensi) -> "Apps Script"
 * 3. Hapus seluruh isi default Code.gs, lalu copy-paste seluruh kode di bawah ini.
 * 4. Atur konstanta FOLDER_NAME di bawah (default: "Foto_Absensi_RiksaSyncs").
 * 5. Klik menu "Deploy" -> "New deployment"
 * 6. Pilih type: "Web app"
 *    - Description: "RiksaSyncs Attendance API v1"
 *    - Execute as: "Me" (Akun Google Anda)
 *    - Who has access: "Anyone" (Siapa saja, agar frontend dapat kirim POST)
 * 7. Klik "Deploy", beri izin akses Google jika diminta.
 * 8. Salin "Web app URL" (format: https://script.google.com/macros/s/.../exec)
 * 9. Tempelkan URL tersebut ke file `.env` di project Anda:
 *    VITE_GAS_ATTENDANCE_URL=https://script.google.com/macros/s/.../exec
 * ==============================================================================
 */

// Nama Folder di Google Drive tempat menyimpan selfie karyawan
var FOLDER_NAME = "Foto_Absensi_RiksaSyncs";
// Nama Sheet tab untuk mencatat log
var SHEET_TAB_NAME = "Log Absensi";

function setupSheetAndFolder() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_TAB_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_TAB_NAME);
    // Header kolom
    sheet.appendRow([
      "Timestamp ISO",
      "Tanggal (WIB)",
      "Waktu (WIB)",
      "Nama Karyawan",
      "Email/Username",
      "Tipe Absen",
      "Latitude",
      "Longitude",
      "Link Foto Google Drive"
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#D1FAE5");
    sheet.setFrozenRows(1);
  }

  // Cek / buat folder Drive
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(FOLDER_NAME);
  }
  return { sheet: sheet, folder: folder };
}

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);

    var setup = setupSheetAndFolder();
    var sheet = setup.sheet;
    var folder = setup.folder;

    var empName = data.employee_name || "Tanpa Nama";
    var empEmail = data.employee_email || "-";
    var type = data.type || "Masuk";
    var lat = data.latitude || 0;
    var lng = data.longitude || 0;
    var clientTime = data.timestamp ? new Date(data.timestamp) : new Date();

    // Format tanggal & waktu WIB
    var dateWIB = Utilities.formatDate(clientTime, "Asia/Jakarta", "yyyy-MM-dd");
    var timeWIB = Utilities.formatDate(clientTime, "Asia/Jakarta", "HH:mm:ss");

    var photoDriveUrl = "-";

    // Simpan foto jika ada payload base64
    if (data.photo_base64) {
      var base64Data = data.photo_base64;
      if (base64Data.indexOf(",") > -1) {
        base64Data = base64Data.split(",")[1];
      }
      var decodedBytes = Utilities.base64Decode(base64Data);
      var safeName = empName.replace(/[^a-zA-Z0-9]/g, "_");
      var fileName = "Absen_" + type + "_" + safeName + "_" + dateWIB + "_" + timeWIB.replace(/:/g, "-") + ".jpg";

      var blob = Utilities.newBlob(decodedBytes, "image/jpeg", fileName);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoDriveUrl = file.getUrl();
    }

    // Catat baris di Google Sheets
    sheet.appendRow([
      clientTime.toISOString(),
      dateWIB,
      timeWIB,
      empName,
      empEmail,
      type,
      lat,
      lng,
      photoDriveUrl
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Absensi " + type + " berhasil dicatat!",
      drive_url: photoDriveUrl,
      timestamp: clientTime.toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var setup = setupSheetAndFolder();
    var sheet = setup.sheet;
    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        records: []
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var filterEmail = e.parameter.email ? e.parameter.email.toLowerCase() : "";
    var records = [];

    // Skip header row (row 0), loop descending
    for (var i = data.length - 1; i >= 1; i--) {
      var row = data[i];
      var rowEmail = String(row[4]).toLowerCase();

      if (!filterEmail || rowEmail === filterEmail) {
        records.push({
          timestamp: row[0],
          date: row[1],
          time: row[2],
          employee_name: row[3],
          employee_email: row[4],
          type: row[5],
          latitude: row[6],
          longitude: row[7],
          photo_drive_url: row[8]
        });
      }
      if (records.length >= 50) break; // limit 50 data terbaru
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      records: records
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
