/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: INTEGRASI ABSENSI & MANPOWER RIKSA SYNC (VERSI 3.0)
 * ==============================================================================
 * Sistem Rekapitulasi Presensi Selfie, Cuti, Sakit, & Dashboard Bulanan Siap Print
 * PT AKSARA RIKSA PERDANA (PJK3)
 * 
 * FITUR UTAMA:
 * 1. TAB "Log Absensi"          : Menampung foto selfie & lokasi GPS Masuk / Pulang
 * 2. TAB "Data Cuti & Sakit"     : Menampung Sakit, Cuti, Izin (baik dari Web App
 *                                  maupun diisi LANGSUNG/MANUAL di Google Sheet)
 * 3. TAB "Dashboard Rekapan"     : Desain resmi eksekutif SIAP CETAK (A4 Landscape),
 *                                  lengkap dengan KPI, tabel 11 karyawan, & tanda tangan.
 * 4. MENU KHUSUS "📋 RiksaSync" : Muncul otomatis di toolbar atas Google Sheets untuk
 *                                  Refresh Rekap, Pilih Bulan (cth: Jan 2026 s/d Des 2026),
 *                                  dan Download PDF Siap Print.
 * 5. OTOMATIS BULANAN            : Kirim PDF ke email setiap tanggal 1.
 * ==============================================================================
 */

// ── 1. KONFIGURASI UMUM ────────────────────────────────────────────────────────
var NAMA_PERUSAHAAN   = "PT AKSARA RIKSA PERDANA";
var SUB_JUDUL         = "JASA PEMERIKSAAN & PENGUJIAN K3 (PJK3)";
var FOLDER_NAME       = "Foto_Absensi_RiksaSyncs";
var SHEET_LOG_ABSEN   = "Log Absensi";
var SHEET_LOG_CUTI    = "Data Cuti & Sakit";
var SHEET_DASHBOARD   = "Dashboard Rekapan";
var EMAIL_LAPORAN     = "zulfan@aksarariksapjk3.com";

// ── 2. MASTER 11 KARYAWAN RESMI ───────────────────────────────────────────────
var MASTER_KARYAWAN = [
  { id: 'u1',  name: 'Rama Regawa Sri Anggayana',       username: 'Angga',    role: 'Leader & Ahli Utama', division: 'Ahli',  email: 'angga@aksarariksapjk3.com' },
  { id: 'u2',  name: 'Lalu Imam Taufik Rahman Hidayat', username: 'Imam',     role: 'Ahli Spesialis',      division: 'Ahli',  email: 'imam@aksarariksapjk3.com' },
  { id: 'u3',  name: 'Fauzan Akmaluddin',               username: 'Fauzan',   role: 'Ahli Spesialis',      division: 'Ahli',  email: 'fauzan@aksarariksapjk3.com' },
  { id: 'u4',  name: 'Fakhziar Wildan Hidayat',         username: 'Fakhziar', role: 'Ahli Spesialis',      division: 'Ahli',  email: 'fakhziar@aksarariksapjk3.com' },
  { id: 'u5',  name: 'Muhammad Fazar Maulana',          username: 'Fazar',    role: 'Ahli Spesialis',      division: 'Ahli',  email: 'fazar@aksarariksapjk3.com' },
  { id: 'u6',  name: 'Arya Rizki Pratama',              username: 'Arya',     role: 'Support Staff',       division: 'Admin', email: 'arya@aksarariksapjk3.com' },
  { id: 'u7',  name: 'Rio Andrian',                     username: 'Rio',      role: 'Support Staff',       division: 'Admin', email: 'rio@aksarariksapjk3.com' },
  { id: 'u8',  name: 'Aulia Zahra Dikrika',             username: 'Aulia',    role: 'Support Staff',       division: 'Admin', email: 'aulia@aksarariksapjk3.com' },
  { id: 'u9',  name: 'Disa Liestianie Putri',           username: 'Disa',     role: 'Support Staff',       division: 'Admin', email: 'disa@aksarariksapjk3.com' },
  { id: 'u10', name: 'Marsya Aulia Rohman',             username: 'Marsya',   role: 'Support Staff',       division: 'Admin', email: 'marsya@aksarariksapjk3.com' },
  { id: 'u11', name: 'Zulfan Rafly Baihaqi',            username: 'Zulfan',   role: 'IT Staff',            division: 'IT',    email: 'zulfan@aksarariksapjk3.com' }
];

// Daftar nama resmi untuk dropdown validasi
var LIST_NAMA_KARYAWAN = MASTER_KARYAWAN.map(function(k) { return k.name; });

// ── 3. MENU TOOLBAR GOOGLE SHEETS ─────────────────────────────────────────────
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("📋 RiksaSync")
    .addItem("🔄 Update Rekapan Bulan Berjalan", "menuRefreshCurrentMonth")
    .addItem("📅 Pilih Bulan Rekapan (2026-XX)...", "menuChooseMonth")
    .addSeparator()
    .addItem("🖨️ Ekspor PDF Siap Cetak (A4 Landscape)", "menuExportPdf")
    .addSeparator()
    .addItem("⚙️ Inisialisasi / Reset Format 3 Sheet", "setupAllSheets")
    .addToUi();
}

// ── 4. SETUP MASTER & FORMAT TAMPILAN 3 SHEET ────────────────────────────────
/**
 * Jalankan fungsi ini pertama kali pada Google Spreadsheet baru.
 * Fungsi ini otomatis membuat & memformat 3 sheet:
 * 1. Log Absensi
 * 2. Data Cuti & Sakit
 * 3. Dashboard Rekapan
 */
function setupAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Setup Tab "Log Absensi"
  var sheetLog = ss.getSheetByName(SHEET_LOG_ABSEN);
  if (!sheetLog) sheetLog = ss.insertSheet(SHEET_LOG_ABSEN);
  sheetLog.clear();

  var headerLog = [
    "Timestamp ISO", "Tanggal (WIB)", "Waktu (WIB)", "Nama Karyawan",
    "Email / Username", "Tipe Absen", "Mode Kerja", "Nama Gedung / Lokasi",
    "Latitude", "Longitude", "Alamat Lengkap (GPS)", "Link Foto Google Drive"
  ];
  sheetLog.getRange(1, 1, 1, headerLog.length).setValues([headerLog])
    .setFontWeight("bold")
    .setBackground("#065F46")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheetLog.setRowHeight(1, 32);
  sheetLog.setFrozenRows(1);

  sheetLog.setColumnWidth(1, 170); // ISO
  sheetLog.setColumnWidth(2, 105); // Tgl
  sheetLog.setColumnWidth(3, 90);  // Wkt
  sheetLog.setColumnWidth(4, 180); // Nama
  sheetLog.setColumnWidth(5, 180); // Email
  sheetLog.setColumnWidth(6, 95);  // Tipe
  sheetLog.setColumnWidth(7, 95);  // Mode
  sheetLog.setColumnWidth(8, 160); // Gedung
  sheetLog.setColumnWidth(9, 85);  // Lat
  sheetLog.setColumnWidth(10, 85); // Lng
  sheetLog.setColumnWidth(11, 240);// Alamat
  sheetLog.setColumnWidth(12, 280);// Foto Drive

  // 2. Setup Tab "Data Cuti & Sakit"
  var sheetCuti = ss.getSheetByName(SHEET_LOG_CUTI);
  if (!sheetCuti) sheetCuti = ss.insertSheet(SHEET_LOG_CUTI);
  sheetCuti.clear();

  var headerCuti = [
    "Tanggal (YYYY-MM-DD)", "Nama Karyawan", "Jenis Ketidakhadiran",
    "Alasan / Keterangan", "Sumber Pencatatan", "Timestamp Sistem"
  ];
  sheetCuti.getRange(1, 1, 1, headerCuti.length).setValues([headerCuti])
    .setFontWeight("bold")
    .setBackground("#0D9488")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheetCuti.setRowHeight(1, 32);
  sheetCuti.setFrozenRows(1);

  sheetCuti.setColumnWidth(1, 140); // Tanggal
  sheetCuti.setColumnWidth(2, 240); // Nama
  sheetCuti.setColumnWidth(3, 160); // Jenis
  sheetCuti.setColumnWidth(4, 300); // Keterangan
  sheetCuti.setColumnWidth(5, 140); // Sumber
  sheetCuti.setColumnWidth(6, 170); // Timestamp

  // Pasang Dropdown Validasi Nama Karyawan (Kolom B, baris 2-500)
  var ruleNama = SpreadsheetApp.newDataValidation()
    .requireValueInList(LIST_NAMA_KARYAWAN, true)
    .setAllowInvalid(false)
    .setHelpText("Pilih salah satu nama karyawan resmi")
    .build();
  sheetCuti.getRange("B2:B500").setDataValidation(ruleNama);

  // Pasang Dropdown Validasi Jenis (Kolom C, baris 2-500)
  var ruleJenis = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Sakit", "Cuti", "Izin"], true)
    .setAllowInvalid(false)
    .setHelpText("Pilih: Sakit, Cuti, atau Izin")
    .build();
  sheetCuti.getRange("C2:C500").setDataValidation(ruleJenis);

  // Pasang Dropdown Validasi Sumber (Kolom E, baris 2-500)
  var ruleSumber = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Input Manual Sheet", "Aplikasi Web (Manpower)"], true)
    .setAllowInvalid(true)
    .build();
  sheetCuti.getRange("E2:E500").setDataValidation(ruleSumber);

  // 3. Setup Tab "Dashboard Rekapan" (Print-Ready A4 Landscape)
  var sheetDash = ss.getSheetByName(SHEET_DASHBOARD);
  if (!sheetDash) sheetDash = ss.insertSheet(SHEET_DASHBOARD);
  sheetDash.clear();
  sheetDash.setGridlines(true);

  // Hapus sheet default "Sheet1" jika ada & kosong
  var defSheet = ss.getSheetByName("Sheet1");
  if (defSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defSheet); } catch (e) {}
  }

  // Buat folder Drive untuk foto jika belum ada
  getOrCreateDriveFolder();

  // Bangun tampilan template dashboard
  buildDashboardLayout(sheetDash);

  // Hitung data bulan berjalan
  var now = new Date();
  refreshDashboardData(now.getFullYear(), now.getMonth());

  Logger.log("Setup 3 sheet berhasil diselesaikan!");
}

// ── 5. DESAIN LAYOUT DASHBOARD REKAPAN BULANAN (SIAP PRINT A4) ────────────────
function buildDashboardLayout(sheet) {
  sheet.clear();

  // Lebar kolom diatur presisi untuk kertas A4 Landscape
  sheet.setColumnWidth(1, 35);   // A: No
  sheet.setColumnWidth(2, 220);  // B: Nama Karyawan
  sheet.setColumnWidth(3, 140);  // C: Divisi / Role
  sheet.setColumnWidth(4, 65);   // D: Masuk
  sheet.setColumnWidth(5, 65);   // E: Pulang
  sheet.setColumnWidth(6, 60);   // F: Sakit
  sheet.setColumnWidth(7, 60);   // G: Cuti
  sheet.setColumnWidth(8, 60);   // H: Izin
  sheet.setColumnWidth(9, 65);   // I: Kantor
  sheet.setColumnWidth(10, 65);  // J: On Site
  sheet.setColumnWidth(11, 60);  // K: WFH
  sheet.setColumnWidth(12, 75);  // L: % Hadir
  sheet.setColumnWidth(13, 130); // M: Keterangan

  // Header Perusahaan
  sheet.getRange("A1:M1").merge()
    .setValue(NAMA_PERUSAHAAN)
    .setFontSize(15)
    .setFontWeight("bold")
    .setFontColor("#064E3B")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.getRange("A2:M2").merge()
    .setValue(SUB_JUDUL + " — REKAPITULASI KEHADIRAN & KETIDAKHADIRAN KARYAWAN")
    .setFontSize(10)
    .setFontWeight("bold")
    .setFontColor("#334155")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.getRange("A3:M3").merge()
    .setValue("Periode Laporan: Memuat...")
    .setFontSize(9)
    .setFontColor("#64748B")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.setRowHeight(1, 24);
  sheet.setRowHeight(2, 18);
  sheet.setRowHeight(3, 18);
  sheet.setRowHeight(4, 10); // spacing

  // KPI Summary Bar (Baris 5)
  sheet.getRange("B5:C5").merge().setValue("👥 Total Karyawan: " + MASTER_KARYAWAN.length + " Orang")
    .setFontWeight("bold").setBackground("#F0FDF4").setFontColor("#065F46").setHorizontalAlignment("center");
  sheet.getRange("D5:E5").merge().setValue("🟢 Total Masuk: 0")
    .setFontWeight("bold").setBackground("#ECFDF5").setFontColor("#047857").setHorizontalAlignment("center");
  sheet.getRange("F5:H5").merge().setValue("🔴 Total Izin/Sakit/Cuti: 0")
    .setFontWeight("bold").setBackground("#FFF7ED").setFontColor("#C2410C").setHorizontalAlignment("center");
  sheet.getRange("I5:K5").merge().setValue("🏢 Kantor / Site / WFH")
    .setFontWeight("bold").setBackground("#EFF6FF").setFontColor("#1D4ED8").setHorizontalAlignment("center");
  sheet.getRange("L5:M5").merge().setValue("📊 Rata-rata: 0%")
    .setFontWeight("bold").setBackground("#F1F5F9").setFontColor("#334155").setHorizontalAlignment("center");
  sheet.getRange("B5:M5").setBorder(true, true, true, true, true, true, "#CBD5E1", SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(5, 24);
  sheet.setRowHeight(6, 10); // spacing

  // Header Tabel Utama (Baris 7 & 8)
  var tblHeader = [
    "NO", "NAMA LENGKAP KARYAWAN", "DIVISI / JABATAN",
    "MASUK", "PULANG", "SAKIT", "CUTI", "IZIN",
    "KANTOR", "ON SITE", "WFH", "% HADIR", "STATUS / EVALUASI"
  ];

  var hRange = sheet.getRange(7, 1, 1, tblHeader.length);
  hRange.setValues([tblHeader])
    .setFontWeight("bold")
    .setFontSize(9)
    .setBackground("#064E3B")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(7, 26);

  // Tulis 11 Baris Karyawan (Baris 8 - 18)
  for (var i = 0; i < MASTER_KARYAWAN.length; i++) {
    var k = MASTER_KARYAWAN[i];
    var rNum = 8 + i;
    sheet.getRange(rNum, 1).setValue(i + 1).setHorizontalAlignment("center");
    sheet.getRange(rNum, 2).setValue(k.name).setFontWeight("bold").setHorizontalAlignment("left");
    sheet.getRange(rNum, 3).setValue(k.role + " (" + k.division + ")").setHorizontalAlignment("left");
    // Kolom D - K default 0
    sheet.getRange(rNum, 4, 1, 8).setValues([[0, 0, 0, 0, 0, 0, 0, 0]]).setHorizontalAlignment("center");
    // % Hadir
    sheet.getRange(rNum, 12).setValue("0%").setHorizontalAlignment("center").setFontWeight("bold");
    // Status
    sheet.getRange(rNum, 13).setValue("Aktif").setHorizontalAlignment("center");

    sheet.setRowHeight(rNum, 20);

    // Zebra striping
    if (i % 2 === 1) {
      sheet.getRange(rNum, 1, 1, tblHeader.length).setBackground("#F8FAFC");
    }
  }

  // Baris TOTAL (Baris 19)
  var totalRow = 8 + MASTER_KARYAWAN.length;
  sheet.getRange(totalRow, 1, 1, 3).merge().setValue("TOTAL KESELURUHAN")
    .setFontWeight("bold").setHorizontalAlignment("center").setBackground("#E2E8F0");
  for (var c = 4; c <= 11; c++) {
    var colLetter = String.fromCharCode(64 + c);
    sheet.getRange(totalRow, c).setFormula("=SUM(" + colLetter + "8:" + colLetter + (totalRow - 1) + ")")
      .setFontWeight("bold").setHorizontalAlignment("center").setBackground("#E2E8F0");
  }
  sheet.getRange(totalRow, 12).setFormula("=AVERAGE(L8:L" + (totalRow - 1) + ")")
    .setFontWeight("bold").setHorizontalAlignment("center").setBackground("#E2E8F0").setNumberFormat("0.0%");
  sheet.getRange(totalRow, 13).setValue("-").setHorizontalAlignment("center").setBackground("#E2E8F0");
  sheet.setRowHeight(totalRow, 22);

  // Border seluruh tabel utama (Baris 7 s/d totalRow)
  sheet.getRange(7, 1, (totalRow - 7 + 1), tblHeader.length)
    .setBorder(true, true, true, true, true, true, "#94A3B8", SpreadsheetApp.BorderStyle.SOLID);

  // Area Tanda Tangan Siap Print (Baris 22 s/d 26)
  var signStartRow = totalRow + 2;
  var todayStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "d MMMM yyyy");

  sheet.getRange(signStartRow, 2, 1, 2).merge().setValue("Dibuat Oleh,")
    .setHorizontalAlignment("center").setFontSize(9);
  sheet.getRange(signStartRow, 10, 1, 3).merge().setValue("Mengetahui & Menyetujui,")
    .setHorizontalAlignment("center").setFontSize(9);

  sheet.getRange(signStartRow + 1, 2, 1, 2).merge().setValue("IT & HR Operations")
    .setHorizontalAlignment("center").setFontSize(8).setFontColor("#64748B");
  sheet.getRange(signStartRow + 1, 10, 1, 3).merge().setValue("Leader & Ahli Utama")
    .setHorizontalAlignment("center").setFontSize(8).setFontColor("#64748B");

  sheet.setRowHeight(signStartRow + 2, 35); // ruang ttd fisik

  sheet.getRange(signStartRow + 3, 2, 1, 2).merge().setValue("Zulfan Rafly Baihaqi")
    .setFontWeight("bold").setFontSize(9).setHorizontalAlignment("center").setUnderline(true);
  sheet.getRange(signStartRow + 3, 10, 1, 3).merge().setValue("Rama Regawa Sri Anggayana")
    .setFontWeight("bold").setFontSize(9).setHorizontalAlignment("center").setUnderline(true);
}

// ── 6. KALKULASI & REFRESH DATA DASHBOARD ──────────────────────────────────────
/**
 * Menghitung data rekapitulasi untuk bulan & tahun yang dipilih,
 * menggabungkan data Hadir dari "Log Absensi" + data Sakit/Cuti/Izin dari "Data Cuti & Sakit".
 */
function refreshDashboardData(year, month) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDash = ss.getSheetByName(SHEET_DASHBOARD);
  var sheetLog  = ss.getSheetByName(SHEET_LOG_ABSEN);
  var sheetCuti = ss.getSheetByName(SHEET_LOG_CUTI);

  if (!sheetDash) return;

  var targetDate = new Date(year, month, 1);
  var monthLabel = Utilities.formatDate(targetDate, "Asia/Jakarta", "MMMM yyyy");

  // Update Judul Periode di A3
  var now = new Date();
  sheetDash.getRange("A3:M3").setValue(
    "Periode Laporan: " + monthLabel.toUpperCase() + " | Diperbarui: " +
    Utilities.formatDate(now, "Asia/Jakarta", "dd-MM-yyyy HH:mm") + " WIB | Siap Cetak (A4 Landscape)"
  );

  // Inisialisasi peta rekapitulasi untuk 11 karyawan
  var stats = {};
  MASTER_KARYAWAN.forEach(function(k) {
    stats[k.name.toLowerCase()] = {
      masuk: 0, pulang: 0, sakit: 0, cuti: 0, izin: 0,
      kantor: 0, onSite: 0, wfh: 0, uniqueDaysHadir: {}
    };
  });

  // 1. Ambil data dari "Log Absensi" (Hadir Masuk, Pulang, Lokasi)
  if (sheetLog && sheetLog.getLastRow() > 1) {
    var logValues = sheetLog.getDataRange().getValues();
    for (var r = 1; r < logValues.length; r++) {
      var row = logValues[r];
      var rawDate = row[1]; // Tanggal YYYY-MM-DD
      if (!rawDate) continue;

      var rowDate = new Date(rawDate);
      if (isNaN(rowDate.getTime())) continue;

      // Filter periode bulan & tahun target
      if (rowDate.getFullYear() === year && rowDate.getMonth() === month) {
        var empName = String(row[3] || "").trim().toLowerCase();
        var type    = String(row[5] || "").trim();
        var mode    = String(row[6] || "Kantor").trim();
        var dStr    = String(row[1]);

        // Cari karyawan yang cocok (berdasarkan nama lengkap atau panggilan)
        var matchedKey = findEmployeeKey(empName, stats);
        if (matchedKey) {
          var s = stats[matchedKey];
          if (type === "Masuk") {
            s.masuk++;
            s.uniqueDaysHadir[dStr] = true;
            if (mode === "On Site") s.onSite++;
            else if (mode === "WFH") s.wfh++;
            else s.kantor++;
          } else if (type === "Pulang") {
            s.pulang++;
          }
        }
      }
    }
  }

  // 2. Ambil data dari "Data Cuti & Sakit" (Sakit, Cuti, Izin)
  if (sheetCuti && sheetCuti.getLastRow() > 1) {
    var cutiValues = sheetCuti.getDataRange().getValues();
    for (var c = 1; c < cutiValues.length; c++) {
      var crow = cutiValues[c];
      var cDateRaw = crow[0];
      if (!cDateRaw) continue;

      var cDate = new Date(cDateRaw);
      if (isNaN(cDate.getTime())) continue;

      if (cDate.getFullYear() === year && cDate.getMonth() === month) {
        var cEmpName = String(crow[1] || "").trim().toLowerCase();
        var cJenis   = String(crow[2] || "").trim();

        var cMatched = findEmployeeKey(cEmpName, stats);
        if (cMatched) {
          var cs = stats[cMatched];
          if (cJenis === "Sakit") cs.sakit++;
          else if (cJenis === "Cuti") cs.cuti++;
          else if (cJenis === "Izin") cs.izin++;
        }
      }
    }
  }

  // Hitung jumlah hari kerja perkiraan di bulan target (Senin-Jumat)
  var workingDays = getWorkingDaysInMonth(year, month);

  // 3. Tuliskan angka hasil hitung ke tabel Dashboard (Baris 8 - 18)
  var totalMasukSemua = 0;
  var totalKetidakhadiranSemua = 0;

  for (var i = 0; i < MASTER_KARYAWAN.length; i++) {
    var k = MASTER_KARYAWAN[i];
    var s = stats[k.name.toLowerCase()];
    var rNum = 8 + i;

    var hariHadirUnik = Object.keys(s.uniqueDaysHadir).length;
    var pct = workingDays > 0 ? (hariHadirUnik / workingDays) : 0;
    if (pct > 1) pct = 1;

    sheetDash.getRange(rNum, 4).setValue(s.masuk);
    sheetDash.getRange(rNum, 5).setValue(s.pulang);
    sheetDash.getRange(rNum, 6).setValue(s.sakit);
    sheetDash.getRange(rNum, 7).setValue(s.cuti);
    sheetDash.getRange(rNum, 8).setValue(s.izin);
    sheetDash.getRange(rNum, 9).setValue(s.kantor);
    sheetDash.getRange(rNum, 10).setValue(s.onSite);
    sheetDash.getRange(rNum, 11).setValue(s.wfh);
    sheetDash.getRange(rNum, 12).setValue(pct).setNumberFormat("0.0%");

    // Status evaluasi
    var statusText = "Hadir Tertib";
    if (s.sakit > 0) statusText = "Izin Sakit (" + s.sakit + "h)";
    else if (s.cuti > 0) statusText = "Cuti (" + s.cuti + "h)";
    else if (s.izin > 0) statusText = "Izin (" + s.izin + "h)";
    else if (s.masuk === 0) statusText = "Belum Ada Presensi";
    sheetDash.getRange(rNum, 13).setValue(statusText);

    totalMasukSemua += s.masuk;
    totalKetidakhadiranSemua += (s.sakit + s.cuti + s.izin);
  }

  // 4. Update KPI Bar di baris 5
  sheetDash.getRange("D5:E5").setValue("🟢 Total Masuk: " + totalMasukSemua);
  sheetDash.getRange("F5:H5").setValue("🔴 Total Izin/Sakit/Cuti: " + totalKetidakhadiranSemua + " Hari");
}

// ── 7. HELPER PENCOCOKAN KARYAWAN & HARI KERJA ────────────────────────────────
function findEmployeeKey(inputName, statsObj) {
  if (!inputName) return null;
  inputName = inputName.toLowerCase();

  // Cocok persis
  if (statsObj[inputName]) return inputName;

  // Cek apakah input cocok dengan nama panggilan (username) atau sebagian nama
  for (var i = 0; i < MASTER_KARYAWAN.length; i++) {
    var k = MASTER_KARYAWAN[i];
    var full = k.name.toLowerCase();
    var user = k.username.toLowerCase();
    if (full.indexOf(inputName) > -1 || inputName.indexOf(full) > -1 ||
        inputName === user || inputName.indexOf(user) > -1) {
      return full;
    }
  }
  return null;
}

function getWorkingDaysInMonth(year, month) {
  var days = 0;
  var date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    var dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Bukan Sabtu & Minggu
      days++;
    }
    date.setDate(date.getDate() + 1);
  }
  return days || 22;
}

function getOrCreateDriveFolder() {
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
}

// ── 8. MENU ACTION HANDLERS ───────────────────────────────────────────────────
function menuRefreshCurrentMonth() {
  var now = new Date();
  refreshDashboardData(now.getFullYear(), now.getMonth());
  SpreadsheetApp.getUi().alert("✅ Berhasil!", "Rekapan bulan berjalan berhasil diperbarui.", SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuChooseMonth() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    "Pilih Periode Bulan Rekapan",
    "Masukkan format YYYY-MM yang ingin direkap (Contoh: 2026-01 untuk Januari 2026, 2026-02, dst):",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var input = response.getResponseText().trim();
    var parts = input.split("-");
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      var y = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10) - 1; // 0-indexed
      refreshDashboardData(y, m);
      ui.alert("✅ Sukses!", "Dashboard telah diupdate untuk periode " + input + " dan siap di-print!", ui.ButtonSet.OK);
    } else {
      ui.alert("❌ Format Salah", "Gunakan format YYYY-MM, contoh: 2026-01", ui.ButtonSet.OK);
    }
  }
}

function menuExportPdf() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDash = ss.getSheetByName(SHEET_DASHBOARD);
  if (!sheetDash) {
    SpreadsheetApp.getUi().alert("Sheet '" + SHEET_DASHBOARD + "' belum ada. Jalankan Inisialisasi Sheet terlebih dahulu.");
    return;
  }

  var now = new Date();
  var dateStr = Utilities.formatDate(now, "Asia/Jakarta", "yyyyMMdd_HHmm");
  var pdfBlob = exportSheetAsPdf(ss, sheetDash, "Rekap_Bulanan_" + dateStr);

  var folder = getOrCreateDriveFolder();
  var pdfFile = folder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var pdfUrl = pdfFile.getUrl();

  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif; padding:15px; text-align:center;">' +
    '<h3 style="color:#065F46; margin-top:0;">PDF Rekapan Berhasil Dibuat! 📄</h3>' +
    '<p style="font-size:12px; color:#475569;">PDF format A4 Landscape siap dicetak atau disimpan:</p>' +
    '<a href="' + pdfUrl + '" target="_blank" style="display:inline-block; margin-top:10px; padding:10px 20px; background:#059669; color:#fff; text-decoration:none; font-weight:bold; border-radius:8px;">Buka & Cetak PDF</a>' +
    '</div>'
  ).setWidth(360).setHeight(180);

  SpreadsheetApp.getUi().showModalDialog(html, "Cetak PDF Rekapan");
}

// ── 9. POST: TERIMA DARI FRONTEND (PRESENSI & CUTI/SAKIT) ──────────────────────
function doPost(e) {
  try {
    var contents = e.postData.contents;
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ─────────────────────────────────────────────────────────────────────────
    // KASUS A: Catat Ketidakhadiran (Sakit / Cuti / Izin) dari Kelola Manpower
    // ─────────────────────────────────────────────────────────────────────────
    if (data.action === "record_absence" || data.action === "save_absence" ||
        data.type === "Sakit" || data.type === "Cuti" || data.type === "Izin") {
      
      var sheetCuti = ss.getSheetByName(SHEET_LOG_CUTI);
      if (!sheetCuti) {
        setupAllSheets();
        sheetCuti = ss.getSheetByName(SHEET_LOG_CUTI);
      }

      var cDate    = data.date || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
      var cName    = data.employee_name || "Karyawan";
      var cType    = data.absence_type  || data.type || "Sakit";
      var cReason  = data.reason || "-";
      var cSource  = data.source || "Aplikasi Web (Manpower)";
      var cTimeISO = new Date().toISOString();

      sheetCuti.appendRow([
        cDate,
        cName,
        cType,
        cReason,
        cSource,
        cTimeISO
      ]);

      // Refresh Dashboard untuk bulan terkait
      var dObj = new Date(cDate);
      if (!isNaN(dObj.getTime())) {
        refreshDashboardData(dObj.getFullYear(), dObj.getMonth());
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Data " + cType + " untuk " + cName + " tanggal " + cDate + " berhasil dicatat ke Google Sheets!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KASUS B: Hapus Ketidakhadiran dari Kelola Manpower
    // ─────────────────────────────────────────────────────────────────────────
    if (data.action === "delete_absence") {
      var sheetCutiDel = ss.getSheetByName(SHEET_LOG_CUTI);
      if (sheetCutiDel && sheetCutiDel.getLastRow() > 1) {
        var rows = sheetCutiDel.getDataRange().getValues();
        var targetDate = data.date;
        var targetName = (data.employee_name || "").toLowerCase();

        for (var i = rows.length - 1; i >= 1; i--) {
          var rDate = rows[i][0];
          var rName = String(rows[i][1] || "").toLowerCase();
          if (rDate === targetDate && (rName.indexOf(targetName) > -1 || targetName.indexOf(rName) > -1)) {
            sheetCutiDel.deleteRow(i + 1);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success", message: "Ketidakhadiran berhasil dihapus dari Google Sheets."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KASUS C: Presensi Selfie Masuk / Pulang dari Modul Absensi
    // ─────────────────────────────────────────────────────────────────────────
    var sheetLog = ss.getSheetByName(SHEET_LOG_ABSEN);
    if (!sheetLog) {
      setupAllSheets();
      sheetLog = ss.getSheetByName(SHEET_LOG_ABSEN);
    }

    var folder = getOrCreateDriveFolder();

    var empName          = data.employee_name       || "Tanpa Nama";
    var empEmail         = data.employee_email      || "-";
    var type             = data.type                || "Masuk";
    var workLocationType = data.work_location_type  || "Kantor";
    var buildingName     = data.building_name       || data.location_name || "-";
    var address          = data.address             || "-";
    var lat              = data.latitude            || 0;
    var lng              = data.longitude           || 0;
    var clientTime       = data.timestamp ? new Date(data.timestamp) : new Date();

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

    // Tulis baris ke Log Absensi
    sheetLog.appendRow([
      clientTime.toISOString(),
      dateWIB,
      timeWIB,
      empName,
      empEmail,
      type,
      workLocationType,
      buildingName,
      lat,
      lng,
      address,
      photoDriveUrl
    ]);

    // Warnai baris sesuai tipe absen
    var lastRow = sheetLog.getLastRow();
    var rowRange = sheetLog.getRange(lastRow, 1, 1, 12);
    if (type === "Masuk")   rowRange.setBackground("#F0FDF4");
    else if (type === "Pulang") rowRange.setBackground("#EFF6FF");

    // Otomatis update angka di Dashboard Rekapan
    refreshDashboardData(clientTime.getFullYear(), clientTime.getMonth());

    return ContentService.createTextOutput(JSON.stringify({
      status:             "success",
      message:            "Presensi " + type + " (" + workLocationType + ") berhasil dicatat!",
      drive_url:          photoDriveUrl,
      timestamp:          clientTime.toISOString(),
      work_location_type: workLocationType,
      building_name:      buildingName
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── 10. GET: KONEKSI & AMBIL RIWAYAT ──────────────────────────────────────────
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetLog = ss.getSheetByName(SHEET_LOG_ABSEN);
    if (!sheetLog) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success", message: "Google Apps Script RiksaSync Aktif & Siap", records: []
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheetLog.getDataRange().getValues();
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success", records: []
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var filterEmail = (e && e.parameter && e.parameter.email) ? e.parameter.email.toLowerCase() : "";
    var records = [];

    for (var i = data.length - 1; i >= 1; i--) {
      var row      = data[i];
      var rowEmail = String(row[4] || "").toLowerCase();
      if (!filterEmail || rowEmail === filterEmail) {
        records.push({
          timestamp:          row[0],
          date:               row[1],
          time:               row[2],
          employee_name:      row[3],
          employee_email:     row[4],
          type:               row[5],
          work_location_type: row[6] || "Kantor",
          building_name:      row[7] || "",
          latitude:           row[8],
          longitude:          row[9],
          address:            row[10] || "",
          photo_drive_url:    row[11] || ""
        });
      }
      if (records.length >= 50) break;
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      records: records
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error", message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── 11. LAPORAN BULANAN OTOMATIS KE EMAIL ─────────────────────────────────────
function generateMonthlyReport() {
  var now = new Date();
  var lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var y = lastMonth.getFullYear();
  var m = lastMonth.getMonth();
  var monthLabel = Utilities.formatDate(lastMonth, "Asia/Jakarta", "MMMM yyyy");
  var monthCode  = Utilities.formatDate(lastMonth, "Asia/Jakarta", "yyyy-MM");

  // Refresh dashboard dengan data bulan lalu
  refreshDashboardData(y, m);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDash = ss.getSheetByName(SHEET_DASHBOARD);
  if (!sheetDash) return;

  var pdfBlob = exportSheetAsPdf(ss, sheetDash, "Laporan_Kehadiran_" + monthCode);
  var folder = getOrCreateDriveFolder();
  var pdfFile = folder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var pdfUrl = pdfFile.getUrl();

  if (EMAIL_LAPORAN && EMAIL_LAPORAN.trim() !== "") {
    var subject = "[RiksaSync] Rekapitulasi Kehadiran " + monthLabel + " – " + NAMA_PERUSAHAAN;
    var body = "Halo,\n\n" +
      "Terlampir adalah Laporan Rekapitulasi Presensi & Ketidakhadiran (A4 Print-Ready) untuk periode: " + monthLabel + ".\n\n" +
      "Laporan mencakup:\n" +
      "- Presensi Masuk & Pulang Selfie\n" +
      "- Data Cuti, Sakit, dan Izin Karyawan\n" +
      "- Mode Kerja (Kantor, On Site, WFH)\n" +
      "- Format tanda tangan resmi IT Staff dan Leader Utama\n\n" +
      "PDF Laporan dapat diunduh di: " + pdfUrl + "\n\n" +
      "Salam,\nRiksaSync AI Operations\n" + NAMA_PERUSAHAAN;

    EMAIL_LAPORAN.split(",").forEach(function(emailAddr) {
      try {
        GmailApp.sendEmail(emailAddr.trim(), subject, body, {
          attachments: [pdfBlob],
          name: "RiksaSync AI – " + NAMA_PERUSAHAAN
        });
      } catch (e) {
        Logger.log("Gagal kirim email ke " + emailAddr + ": " + e.toString());
      }
    });
  }

  // Kembalikan view dashboard ke bulan ini
  refreshDashboardData(now.getFullYear(), now.getMonth());
}

// ── 12. HELPER EXPORT PDF ─────────────────────────────────────────────────────
function exportSheetAsPdf(spreadsheet, sheet, filename) {
  var ssId = spreadsheet.getId();
  var sheetId = sheet.getSheetId();
  var url = "https://docs.google.com/spreadsheets/d/" + ssId +
    "/export?format=pdf" +
    "&gid=" + sheetId +
    "&size=A4&portrait=false&fitw=true" +
    "&sheetnames=false&printtitle=false" +
    "&pagenumbers=false&gridlines=false&fzr=false" +
    "&top_margin=0.4&bottom_margin=0.4&left_margin=0.4&right_margin=0.4";

  var options = {
    headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    throw new Error("Gagal export PDF, HTTP: " + response.getResponseCode());
  }
  return response.getBlob().setName(filename + ".pdf");
}

function installMonthlyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === "generateMonthlyReport") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("generateMonthlyReport")
    .timeBased()
    .onMonthDay(1)
    .atHour(6)
    .create();

  Logger.log("Trigger bulanan aktif (tiap tanggal 1 jam 06:00 WIB).");
}
