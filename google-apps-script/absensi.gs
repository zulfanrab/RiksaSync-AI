/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: INTEGRASI ABSENSI & MANPOWER RIKSA SYNC (VERSI 3.3)
 * ==============================================================================
 * Sistem Rekapitulasi Presensi Selfie, Cuti, Sakit, & Dashboard Bulanan Siap Print
 * PT AKSARA RIKSA PERDANA (PJK3)
 * 
 * FITUR UTAMA & PENYEMPURNAAN TOTAL:
 * 1. SINKRONISASI SUPABASE       : 1-Klik Impor 284 data riwayat presensi dari Supabase (CSV)
 *                                  lengkap dari Oktober s/d November 2026 (tanpa duplikat).
 * 2. BEBAS FORMULA ERROR (#ERROR): Seluruh total, KPI, dan % kehadiran dihitung langsung oleh
 *                                  script sehingga 100% kebal terhadap perbedaan bahasa/locale
 *                                  (titik-koma vs koma di Google Sheets).
 * 3. LOGIKA BULAN PRESISI        : Filter tanggal berbasis string YYYY-MM dan WIB (UTC+7),
 *                                  mencegah pergeseran hari atau timezone bug.
 * 4. PENGELOMPOKAN EMAIL         : Prioritas pencocokan log absensi menggunakan email karyawan
 *                                  resmi (angga, imam, fauzan, fakhziar, fazar, demas, arya,
 *                                  rio, aulia, disa, marsya, reyhan, zulfan).
 * 5. ANTI-DUPLIKAT HARIAN        : 1 Masuk & 1 Pulang per hari per karyawan.
 * 6. SUBFOLDER DRIVE BULANAN     : Foto selfie tersimpan rapi per subfolder bulanan.
 * 7. MENU TOOLBAR "📋 RiksaSync" : Update Rekap, Pilih Bulan, Ekspor PDF A4, dan Impor Supabase.
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

// ── 2. MASTER 13 KARYAWAN RESMI ───────────────────────────────────────────────
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
  { id: 'u11', name: 'Zulfan Rafly Baihaqi',            username: 'Zulfan',   role: 'IT Staff',            division: 'IT',    email: 'zulfan@aksarariksapjk3.com' },
  { id: 'u12', name: 'Demas',                           username: 'Demas',    role: 'Inspector Assistant', division: 'Ahli',   email: 'demas@aksarariksapjk3.com' },
  { id: 'u13', name: 'Reyhan',                          username: 'Reyhan',   role: 'Support Staff',       division: 'Admin', email: 'reyhan@aksarariksapjk3.com' }
];

var LIST_NAMA_KARYAWAN = MASTER_KARYAWAN.map(function(k) { return k.name; });

// ── 3. MENU TOOLBAR GOOGLE SHEETS ─────────────────────────────────────────────
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("📋 RiksaSync")
    .addItem("🔄 Update Rekapan Bulan Berjalan (Nov 2026)", "menuRefreshCurrentMonth")
    .addItem("📅 Pilih Bulan Rekapan (2026-XX)...", "menuChooseMonth")
    .addSeparator()
    .addItem("📥 Sinkronkan Seluruh Data Supabase (284 Data)", "syncAllSupabaseData")
    .addSeparator()
    .addItem("🖨️ Ekspor PDF Siap Cetak (A4 Landscape)", "menuExportPdf")
    .addSeparator()
    .addItem("⚙️ Inisialisasi Ulang Format 3 Sheet", "setupAllSheets")
    .addToUi();
}

// ── 4. SETUP MASTER & FORMAT TAMPILAN 3 SHEET ────────────────────────────────
function setupAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      "Spreadsheet tidak terdeteksi! Pastikan Apps Script dibuka dari menu: " +
      "'Ekstensi' > 'Apps Script' di dalam Google Sheet Anda."
    );
  }

  Logger.log("Mulai setup 3 sheet...");

  // 1. Setup Tab "Log Absensi"
  var sheetLog = ss.getSheetByName(SHEET_LOG_ABSEN);
  if (!sheetLog) sheetLog = ss.insertSheet(SHEET_LOG_ABSEN);
  
  if (sheetLog.getLastRow() === 0) {
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
  }

  // 2. Setup Tab "Data Cuti & Sakit"
  var sheetCuti = ss.getSheetByName(SHEET_LOG_CUTI);
  if (!sheetCuti) sheetCuti = ss.insertSheet(SHEET_LOG_CUTI);
  
  if (sheetCuti.getLastRow() === 0) {
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

    sheetCuti.setColumnWidth(1, 140);
    sheetCuti.setColumnWidth(2, 240);
    sheetCuti.setColumnWidth(3, 160);
    sheetCuti.setColumnWidth(4, 300);
    sheetCuti.setColumnWidth(5, 140);
    sheetCuti.setColumnWidth(6, 170);

    var ruleNama = SpreadsheetApp.newDataValidation()
      .requireValueInList(LIST_NAMA_KARYAWAN, true)
      .setAllowInvalid(false)
      .setHelpText("Pilih salah satu nama karyawan resmi")
      .build();
    sheetCuti.getRange("B2:B500").setDataValidation(ruleNama);

    var ruleJenis = SpreadsheetApp.newDataValidation()
      .requireValueInList(["Sakit", "Cuti", "Izin"], true)
      .setAllowInvalid(false)
      .setHelpText("Pilih: Sakit, Cuti, atau Izin")
      .build();
    sheetCuti.getRange("C2:C500").setDataValidation(ruleJenis);
  }

  // 3. Setup Tab "Dashboard Rekapan" (Print-Ready A4 Landscape)
  var sheetDash = ss.getSheetByName(SHEET_DASHBOARD);
  if (!sheetDash) sheetDash = ss.insertSheet(SHEET_DASHBOARD);

  var defSheet = ss.getSheetByName("Sheet1");
  if (defSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defSheet); } catch (e) {}
  }

  getOrCreateDriveFolder();
  buildDashboardLayout(sheetDash);

  // Otomatis sinkronkan data Supabase jika Log Absensi masih kosong
  if (sheetLog.getLastRow() <= 1) {
    syncAllSupabaseData();
  } else {
    var now = new Date();
    refreshDashboardData(now.getFullYear(), now.getMonth());
  }

  Logger.log("Setup 3 sheet berhasil diselesaikan!");
}

// ── 5. DESAIN LAYOUT DASHBOARD REKAPAN BULANAN (SIAP PRINT A4) ────────────────
function buildDashboardLayout(sheet) {
  sheet.clear();

  // Kolom A4 Landscape
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
  sheet.setRowHeight(4, 10); // Spacing

  // KPI Summary Bar (Baris 5)
  sheet.getRange("B5:C5").merge().setValue("👥 Total Karyawan: " + MASTER_KARYAWAN.length + " Orang")
    .setFontWeight("bold").setBackground("#F0FDF4").setFontColor("#065F46").setHorizontalAlignment("center");
  sheet.getRange("D5:E5").merge().setValue("🟢 Total Masuk: 0")
    .setFontWeight("bold").setBackground("#ECFDF5").setFontColor("#047857").setHorizontalAlignment("center");
  sheet.getRange("F5:H5").merge().setValue("🔴 Total Izin/Sakit/Cuti: 0")
    .setFontWeight("bold").setBackground("#FFF7ED").setFontColor("#C2410C").setHorizontalAlignment("center");
  sheet.getRange("I5:K5").merge().setValue("🏢 Kantor: 0 | Site: 0 | WFH: 0")
    .setFontWeight("bold").setBackground("#EFF6FF").setFontColor("#1D4ED8").setHorizontalAlignment("center");
  sheet.getRange("L5:M5").merge().setValue("📊 Rata-rata: 0.0%")
    .setFontWeight("bold").setBackground("#F1F5F9").setFontColor("#334155").setHorizontalAlignment("center");

  var kpiRanges = ["B5:C5", "D5:E5", "F5:H5", "I5:K5", "L5:M5"];
  kpiRanges.forEach(function(r) {
    sheet.getRange(r).setBorder(true, true, true, true, false, false, "#CBD5E1", SpreadsheetApp.BorderStyle.SOLID);
  });

  sheet.setRowHeight(5, 24);
  sheet.setRowHeight(6, 10); // Spacing

  // Header Tabel Utama (Baris 7)
  var tblHeader = [
    "NO", "NAMA LENGKAP KARYAWAN", "DIVISI / JABATAN",
    "MASUK", "PULANG", "SAKIT", "CUTI", "IZIN",
    "KANTOR", "ON SITE", "WFH", "% HADIR", "STATUS / EVALUASI"
  ];

  sheet.getRange(7, 1, 1, tblHeader.length).setValues([tblHeader])
    .setFontWeight("bold")
    .setFontSize(9)
    .setBackground("#064E3B")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(7, 26);

  // Tulis 13 Baris Karyawan (Baris 8 s/d 20)
  for (var i = 0; i < MASTER_KARYAWAN.length; i++) {
    var k = MASTER_KARYAWAN[i];
    var rNum = 8 + i;
    sheet.getRange(rNum, 1).setValue(i + 1).setHorizontalAlignment("center");
    sheet.getRange(rNum, 2).setValue(k.name).setFontWeight("bold").setHorizontalAlignment("left");
    sheet.getRange(rNum, 3).setValue(k.role + " (" + k.division + ")").setHorizontalAlignment("left");
    sheet.getRange(rNum, 4, 1, 8).setValues([[0, 0, 0, 0, 0, 0, 0, 0]]).setHorizontalAlignment("center");
    sheet.getRange(rNum, 12).setValue(0).setNumberFormat("0.0%").setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(rNum, 13).setValue("Aktif").setHorizontalAlignment("center");

    sheet.setRowHeight(rNum, 20);
    if (i % 2 === 1) {
      sheet.getRange(rNum, 1, 1, tblHeader.length).setBackground("#F8FAFC");
    }
  }

  // Baris TOTAL KESELURUHAN (Baris 21)
  var totalRow = 8 + MASTER_KARYAWAN.length;
  sheet.getRange(totalRow, 1, 1, 3).merge().setValue("TOTAL KESELURUHAN")
    .setFontWeight("bold").setHorizontalAlignment("center").setBackground("#E2E8F0");
  sheet.getRange(totalRow, 4, 1, 8).setValues([[0, 0, 0, 0, 0, 0, 0, 0]])
    .setFontWeight("bold").setHorizontalAlignment("center").setBackground("#E2E8F0");
  sheet.getRange(totalRow, 12).setValue(0).setNumberFormat("0.0%")
    .setFontWeight("bold").setHorizontalAlignment("center").setBackground("#E2E8F0");
  sheet.getRange(totalRow, 13).setValue("-").setHorizontalAlignment("center").setBackground("#E2E8F0");
  sheet.setRowHeight(totalRow, 22);

  // Border tabel utama
  sheet.getRange(7, 1, (totalRow - 7 + 1), tblHeader.length)
    .setBorder(true, true, true, true, true, true, "#94A3B8", SpreadsheetApp.BorderStyle.SOLID);

  // Area Tanda Tangan Siap Print
  var signStartRow = totalRow + 2;
  sheet.getRange(signStartRow, 2, 1, 2).merge().setValue("Dibuat Oleh,")
    .setHorizontalAlignment("center").setFontSize(9);
  sheet.getRange(signStartRow, 10, 1, 3).merge().setValue("Mengetahui & Menyetujui,")
    .setHorizontalAlignment("center").setFontSize(9);

  sheet.getRange(signStartRow + 1, 2, 1, 2).merge().setValue("IT & HR Operations")
    .setHorizontalAlignment("center").setFontSize(8).setFontColor("#64748B");
  sheet.getRange(signStartRow + 1, 10, 1, 3).merge().setValue("Leader & Ahli Utama")
    .setHorizontalAlignment("center").setFontSize(8).setFontColor("#64748B");

  sheet.setRowHeight(signStartRow + 2, 35);

  sheet.getRange(signStartRow + 3, 2, 1, 2).merge().setValue("Zulfan Rafly Baihaqi")
    .setFontWeight("bold").setFontSize(9).setHorizontalAlignment("center").setFontLine("underline");
  sheet.getRange(signStartRow + 3, 10, 1, 3).merge().setValue("Rama Regawa Sri Anggayana")
    .setFontWeight("bold").setFontSize(9).setHorizontalAlignment("center").setFontLine("underline");
}

// ── 6. KALKULASI & REFRESH DATA DASHBOARD (BEBAS FORMULA ERROR) ────────────────
function refreshDashboardData(year, month) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;

  var sheetDash = ss.getSheetByName(SHEET_DASHBOARD);
  var sheetLog  = ss.getSheetByName(SHEET_LOG_ABSEN);
  var sheetCuti = ss.getSheetByName(SHEET_LOG_CUTI);

  if (!sheetDash) return;

  var targetDate = new Date(year, month, 1);
  var monthLabel = Utilities.formatDate(targetDate, "Asia/Jakarta", "MMMM yyyy");

  var now = new Date();
  sheetDash.getRange("A3:M3").setValue(
    "Periode Laporan: " + monthLabel.toUpperCase() + " | Diperbarui: " +
    Utilities.formatDate(now, "Asia/Jakarta", "dd-MM-yyyy HH:mm") + " WIB | Format: A4 Landscape Siap Cetak"
  );

  var stats = {};
  MASTER_KARYAWAN.forEach(function(k) {
    stats[k.name.toLowerCase()] = {
      masuk: 0, pulang: 0, sakit: 0, cuti: 0, izin: 0,
      kantor: 0, onSite: 0, wfh: 0,
      uniqueDaysMasuk: {},
      uniqueDaysPulang: {},
      uniqueDaysHadir: {}
    };
  });

  // 1. Baca data dari Log Absensi
  if (sheetLog && sheetLog.getLastRow() > 1) {
    var logValues = sheetLog.getDataRange().getValues();
    for (var r = 1; r < logValues.length; r++) {
      var row = logValues[r];
      var rawDate = row[1];
      if (!rawDate) continue;

      var rYear = (rawDate instanceof Date) ? rawDate.getFullYear() : parseInt(String(rawDate).substring(0, 4), 10);
      var rMonth = (rawDate instanceof Date) ? rawDate.getMonth() : (parseInt(String(rawDate).substring(5, 7), 10) - 1);

      if (rYear === year && rMonth === month) {
        var empName  = String(row[3] || "").trim();
        var empEmail = String(row[4] || "").trim();
        var type     = String(row[5] || "").trim();
        var mode     = String(row[6] || "Kantor").trim();
        var dStr     = (rawDate instanceof Date) ? Utilities.formatDate(rawDate, "Asia/Jakarta", "yyyy-MM-dd") : String(rawDate).substring(0, 10);

        var matchedKey = findEmployeeKey(empName, empEmail, stats);
        if (matchedKey) {
          var s = stats[matchedKey];
          if (type === "Masuk") {
            if (!s.uniqueDaysMasuk[dStr]) {
              s.masuk++;
              s.uniqueDaysMasuk[dStr] = true;
              if (mode === "On Site") s.onSite++;
              else if (mode === "WFH") s.wfh++;
              else s.kantor++;
            }
            s.uniqueDaysHadir[dStr] = true;
          } else if (type === "Pulang") {
            if (!s.uniqueDaysPulang[dStr]) {
              s.pulang++;
              s.uniqueDaysPulang[dStr] = true;
            }
          }
        }
      }
    }
  }

  // 2. Baca data dari Data Cuti & Sakit
  if (sheetCuti && sheetCuti.getLastRow() > 1) {
    var cutiValues = sheetCuti.getDataRange().getValues();
    for (var c = 1; c < cutiValues.length; c++) {
      var crow = cutiValues[c];
      var cDateRaw = crow[0];
      if (!cDateRaw) continue;

      var cYear = (cDateRaw instanceof Date) ? cDateRaw.getFullYear() : parseInt(String(cDateRaw).substring(0, 4), 10);
      var cMonth = (cDateRaw instanceof Date) ? cDateRaw.getMonth() : (parseInt(String(cDateRaw).substring(5, 7), 10) - 1);

      if (cYear === year && cMonth === month) {
        var cEmpName = String(crow[1] || "").trim();
        var cJenis   = String(crow[2] || "").trim();

        var cMatched = findEmployeeKey(cEmpName, "", stats);
        if (cMatched) {
          var cs = stats[cMatched];
          if (cJenis === "Sakit") cs.sakit++;
          else if (cJenis === "Cuti") cs.cuti++;
          else if (cJenis === "Izin") cs.izin++;
        }
      }
    }
  }

  var workingDays = getWorkingDaysInMonth(year, month);
  var totalMasukSemua = 0;
  var totalPulangSemua = 0;
  var totalSakitSemua = 0;
  var totalCutiSemua = 0;
  var totalIzinSemua = 0;
  var totalKantorSemua = 0;
  var totalSiteSemua = 0;
  var totalWfhSemua = 0;
  var totalPctSum = 0;

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

    var statusText = "Hadir Tertib";
    if (s.sakit > 0) statusText = "Izin Sakit (" + s.sakit + "h)";
    else if (s.cuti > 0) statusText = "Cuti (" + s.cuti + "h)";
    else if (s.izin > 0) statusText = "Izin (" + s.izin + "h)";
    else if (s.masuk === 0) statusText = "Belum Ada Presensi";
    sheetDash.getRange(rNum, 13).setValue(statusText);

    totalMasukSemua += s.masuk;
    totalPulangSemua += s.pulang;
    totalSakitSemua += s.sakit;
    totalCutiSemua += s.cuti;
    totalIzinSemua += s.izin;
    totalKantorSemua += s.kantor;
    totalSiteSemua += s.onSite;
    totalWfhSemua += s.wfh;
    totalPctSum += pct;
  }

  var avgPctSemua = MASTER_KARYAWAN.length > 0 ? (totalPctSum / MASTER_KARYAWAN.length) : 0;
  var totalKetidakhadiranSemua = (totalSakitSemua + totalCutiSemua + totalIzinSemua);

  // 4. Update KPI Bar di baris 5 secara aman
  sheetDash.getRange("D5").setValue("🟢 Total Masuk: " + totalMasukSemua);
  sheetDash.getRange("F5").setValue("🔴 Total Izin/Sakit/Cuti: " + totalKetidakhadiranSemua + " Hari");
  sheetDash.getRange("I5").setValue("🏢 Kantor: " + totalKantorSemua + " | Site: " + totalSiteSemua + " | WFH: " + totalWfhSemua);
  sheetDash.getRange("L5").setValue("📊 Rata-rata: " + (avgPctSemua * 100).toFixed(1) + "%");

  // 5. Update Baris TOTAL (Baris 21) secara langsung bebas error rumus
  var totalRow = 8 + MASTER_KARYAWAN.length;
  sheetDash.getRange(totalRow, 4).setValue(totalMasukSemua);
  sheetDash.getRange(totalRow, 5).setValue(totalPulangSemua);
  sheetDash.getRange(totalRow, 6).setValue(totalSakitSemua);
  sheetDash.getRange(totalRow, 7).setValue(totalCutiSemua);
  sheetDash.getRange(totalRow, 8).setValue(totalIzinSemua);
  sheetDash.getRange(totalRow, 9).setValue(totalKantorSemua);
  sheetDash.getRange(totalRow, 10).setValue(totalSiteSemua);
  sheetDash.getRange(totalRow, 11).setValue(totalWfhSemua);
  sheetDash.getRange(totalRow, 12).setValue(avgPctSemua).setNumberFormat("0.0%");
}

// ── 7. SINKRONISASI 284 DATA SUPABASE (ANTI-DUPLIKAT) ─────────────────────────
/**
 * Jalankan fungsi ini untuk memasukkan ke-284 data riwayat presensi dari Supabase
 * langsung ke tab 'Log Absensi' dalam 1 detik, lalu mengupdate Dashboard Rekapan!
 */
function syncAllSupabaseData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetLog = ss.getSheetByName(SHEET_LOG_ABSEN);
  if (!sheetLog) {
    setupAllSheets();
    sheetLog = ss.getSheetByName(SHEET_LOG_ABSEN);
  }

  // Ambil ISO timestamp yang sudah ada di sheet agar tidak terjadi duplikasi data
  var existingTimestamps = {};
  if (sheetLog.getLastRow() > 1) {
    var currentValues = sheetLog.getRange(2, 1, sheetLog.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < currentValues.length; i++) {
      var ts = String(currentValues[i][0]).trim();
      if (ts) existingTimestamps[ts] = true;
    }
  }

  var newRows = [];
  for (var j = 0; j < SUPABASE_HISTORICAL_LOGS.length; j++) {
    var r = SUPABASE_HISTORICAL_LOGS[j];
    var iso = String(r[0]).trim();
    if (!existingTimestamps[iso]) {
      newRows.push(r);
      existingTimestamps[iso] = true;
    }
  }

  if (newRows.length > 0) {
    var startRow = sheetLog.getLastRow() + 1;
    sheetLog.getRange(startRow, 1, newRows.length, 12).setValues(newRows);
    Logger.log("Berhasil menyinkronkan " + newRows.length + " data baru dari Supabase!");
  } else {
    Logger.log("Seluruh data Supabase sudah tersinkronisasi sebelumnya.");
  }

  // Refresh Dashboard untuk November 2026
  refreshDashboardData(2026, 10);

  if (SpreadsheetApp.getActiveSpreadsheet()) {
    try {
      SpreadsheetApp.getUi().alert(
        "✅ Sinkronisasi Sukses!",
        "Sebanyak " + newRows.length + " data dari Supabase berhasil dimasukkan ke tab 'Log Absensi'.\n" +
        "Dashboard Rekapan telah otomatis diperbarui untuk bulan November 2026!",
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {}
  }
}

// ── 8. HELPER PENCOCOKAN KARYAWAN & HARI KERJA ────────────────────────────────
function findEmployeeKey(inputName, inputEmail, statsObj) {
  if (inputEmail) {
    var cleanEmail = String(inputEmail).trim().toLowerCase();
    for (var i = 0; i < MASTER_KARYAWAN.length; i++) {
      if (MASTER_KARYAWAN[i].email.toLowerCase() === cleanEmail) {
        return MASTER_KARYAWAN[i].name.toLowerCase();
      }
    }
  }

  if (!inputName) return null;
  inputName = String(inputName).trim().toLowerCase();
  if (statsObj && statsObj[inputName]) return inputName;

  for (var i = 0; i < MASTER_KARYAWAN.length; i++) {
    var k = MASTER_KARYAWAN[i];
    if (k.username.toLowerCase() === inputName) {
      return k.name.toLowerCase();
    }
  }

  for (var i = 0; i < MASTER_KARYAWAN.length; i++) {
    var k = MASTER_KARYAWAN[i];
    var full = k.name.toLowerCase();
    if (full.indexOf(inputName) > -1 || inputName.indexOf(full) > -1) {
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
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days++;
    }
    date.setDate(date.getDate() + 1);
  }
  return days || 22;
}

function getOrCreateDriveFolder(subfolderName) {
  var parentFolders = DriveApp.getFoldersByName(FOLDER_NAME);
  var parentFolder = parentFolders.hasNext() ? parentFolders.next() : DriveApp.createFolder(FOLDER_NAME);

  if (!subfolderName) return parentFolder;

  var subFolders = parentFolder.getFoldersByName(subfolderName);
  return subFolders.hasNext() ? subFolders.next() : parentFolder.createFolder(subfolderName);
}

// ── 9. MENU ACTION HANDLERS ───────────────────────────────────────────────────
function menuRefreshCurrentMonth() {
  refreshDashboardData(2026, 10);
  SpreadsheetApp.getUi().alert("✅ Berhasil!", "Rekapan bulan berjalan berhasil diperbarui.", SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuChooseMonth() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    "Pilih Periode Bulan Rekapan",
    "Masukkan format YYYY-MM yang ingin direkap (Contoh: 2026-11 untuk November 2026, 2026-10 untuk Oktober 2026):",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var input = response.getResponseText().trim();
    var parts = input.split("-");
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      var y = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10) - 1;
      refreshDashboardData(y, m);
      ui.alert("✅ Sukses!", "Dashboard telah diupdate untuk periode " + input + " dan siap di-print!", ui.ButtonSet.OK);
    } else {
      ui.alert("❌ Format Salah", "Gunakan format YYYY-MM, contoh: 2026-11", ui.ButtonSet.OK);
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

// ── 10. POST: TERIMA DARI FRONTEND (PRESENSI, CUTI/SAKIT & BATCH IMPORT) ────────
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var contents = e.postData.contents;
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // KASUS 0: Batch Import Logs
    if (data.action === "batch_import_logs" && Array.isArray(data.records)) {
      var sheetLog = ss.getSheetByName(SHEET_LOG_ABSEN);
      if (!sheetLog) {
        setupAllSheets();
        sheetLog = ss.getSheetByName(SHEET_LOG_ABSEN);
      }
      var rowsToAdd = [];
      data.records.forEach(function(r) {
        var cTime = r.timestamp ? new Date(r.timestamp) : new Date();
        var dWib = Utilities.formatDate(cTime, "Asia/Jakarta", "yyyy-MM-dd");
        var tWib = Utilities.formatDate(cTime, "Asia/Jakarta", "HH:mm:ss");
        rowsToAdd.push([
          cTime.toISOString(),
          dWib,
          tWib,
          r.employee_name || "Tanpa Nama",
          r.employee_email || "-",
          r.type || "Masuk",
          r.work_location_type || "Kantor",
          r.building_name || "-",
          r.latitude || 0,
          r.longitude || 0,
          r.address || "-",
          r.photo_drive_url || "-"
        ]);
      });
      if (rowsToAdd.length > 0) {
        sheetLog.getRange(sheetLog.getLastRow() + 1, 1, rowsToAdd.length, 12).setValues(rowsToAdd);
      }
      refreshDashboardData(2026, 10);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success", message: rowsToAdd.length + " data berhasil dimasukkan!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // KASUS A: Catat Ketidakhadiran (Sakit / Cuti / Izin)
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

      var dParts = String(cDate).split("-");
      if (dParts.length === 3) {
        refreshDashboardData(parseInt(dParts[0], 10), parseInt(dParts[1], 10) - 1);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Data " + cType + " untuk " + cName + " tanggal " + cDate + " berhasil dicatat ke Google Sheets!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // KASUS B: Presensi Selfie Masuk / Pulang
    var sheetLog = ss.getSheetByName(SHEET_LOG_ABSEN);
    if (!sheetLog) {
      setupAllSheets();
      sheetLog = ss.getSheetByName(SHEET_LOG_ABSEN);
    }

    var folder = getOrCreateDriveFolder(data.folderMonth);

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
    var base64Data = data.imageBase64 || data.photo_base64;
    if (base64Data) {
      if (base64Data.indexOf(",") > -1) base64Data = base64Data.split(",")[1];
      var decodedBytes = Utilities.base64Decode(base64Data);
      var safeName     = empName.replace(/[^a-zA-Z0-9]/g, "_");
      var fileName     = data.fileName || ("Absen_" + type + "_" + workLocationType.replace(/\s+/g, "") +
                         "_" + safeName + "_" + dateWIB + "_" + timeWIB.replace(/:/g, "-") + ".jpg");
      var blob = Utilities.newBlob(decodedBytes, "image/jpeg", fileName);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoDriveUrl = file.getUrl();
    }

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

    var lastRow = sheetLog.getLastRow();
    var rowRange = sheetLog.getRange(lastRow, 1, 1, 12);
    if (type === "Masuk")       rowRange.setBackground("#F0FDF4");
    else if (type === "Pulang") rowRange.setBackground("#EFF6FF");

    refreshDashboardData(clientTime.getFullYear(), clientTime.getMonth());

    return ContentService.createTextOutput(JSON.stringify({
      status:             "success",
      message:            "Presensi " + type + " (" + workLocationType + ") berhasil dicatat!",
      url:                photoDriveUrl,
      fileUrl:            photoDriveUrl,
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
  } finally {
    lock.releaseLock();
  }
}

// ── 11. GET: KONEKSI & AMBIL RIWAYAT ──────────────────────────────────────────
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

    var filterEmail = (e && e.parameter && e.parameter.email) ? e.parameter.email.toLowerCase().trim() : "";
    var records = [];

    for (var i = data.length - 1; i >= 1; i--) {
      var row      = data[i];
      var rowEmail = String(row[4] || "").toLowerCase().trim();
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
      if (records.length >= 100) break;
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

// ── 13. MASTER 284 DATA RIWAYAT PRESENSI SUPABASE (OKTOBER - NOVEMBER 2026) ────
var SUPABASE_HISTORICAL_LOGS = [
  [
    "2026-10-19T11:37:10.917Z",
    "2026-10-19",
    "18:37:10",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "-",
    "-6.92738102975318",
    "107.664924473738",
    "-",
    "-"
  ],
  [
    "2026-10-19T11:37:47.996Z",
    "2026-10-19",
    "18:37:47",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "-",
    "-6.92738102975318",
    "107.664924473738",
    "-",
    "-"
  ],
  [
    "2026-10-19T11:38:06.925Z",
    "2026-10-19",
    "18:38:06",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "-",
    "-6.92738102975318",
    "107.664924473738",
    "-",
    "-"
  ],
  [
    "2026-10-19T11:38:21.016Z",
    "2026-10-19",
    "18:38:21",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "-",
    "-6.92738102975318",
    "107.664924473738",
    "-",
    "-"
  ],
  [
    "2026-10-19T11:50:34.309Z",
    "2026-10-19",
    "18:50:34",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "-",
    "-6.92753125917651",
    "107.664891588892",
    "-",
    "-"
  ],
  [
    "2026-10-19T12:01:34.859Z",
    "2026-10-19",
    "19:01:34",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "-",
    "-6.92749113644316",
    "107.66500805164",
    "-",
    "-"
  ],
  [
    "2026-10-19T12:02:10.437Z",
    "2026-10-19",
    "19:02:10",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "-",
    "-6.92738102975318",
    "107.664924473738",
    "-",
    "-"
  ],
  [
    "2026-10-19T13:39:41.782Z",
    "2026-10-19",
    "20:39:41",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "-",
    "-6.92743926656613",
    "107.665036360144",
    "-",
    "-"
  ],
  [
    "2026-10-20T02:06:34.619Z",
    "2026-10-20",
    "09:06:34",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "-",
    "-6.92724055396135",
    "107.664938799686",
    "-",
    "-"
  ],
  [
    "2026-10-20T02:53:25.153Z",
    "2026-10-20",
    "09:53:25",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "-",
    "-6.92753125917651",
    "107.664891588892",
    "-",
    "-"
  ],
  [
    "2026-10-20T03:26:19.962Z",
    "2026-10-20",
    "10:26:19",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "-",
    "-6.9274306",
    "107.6649815",
    "-",
    "-"
  ],
  [
    "2026-10-20T04:29:09.063Z",
    "2026-10-20",
    "11:29:09",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "-",
    "-6.92753125917651",
    "107.664891588892",
    "-",
    "-"
  ],
  [
    "2026-10-20T10:03:10.969Z",
    "2026-10-20",
    "17:03:10",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Kian Santang, Kota Baru Parahyangan, Bandung Barat",
    "-6.86707517611523",
    "107.463376739737",
    "Jl. Jalan Kian Santang, Kota Baru Parahyangan, Bandung Barat",
    "-"
  ],
  [
    "2026-10-20T10:05:27.415Z",
    "2026-10-20",
    "17:05:27",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274331",
    "107.6649891",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-20T10:07:09.372Z",
    "2026-10-20",
    "17:07:09",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274308",
    "107.6649768",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-20T10:39:05.655Z",
    "2026-10-20",
    "17:39:05",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92738106784316",
    "107.664924545267",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-20T10:39:14.191Z",
    "2026-10-20",
    "17:39:14",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92738106784316",
    "107.664924545267",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-20T14:16:21.244Z",
    "2026-10-20",
    "21:16:21",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "-",
    "-6.9274523",
    "107.6650254",
    "-",
    "-"
  ],
  [
    "2026-10-21T00:04:29.364Z",
    "2026-10-21",
    "07:04:29",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Kamayangan Residence Blok A1 & A2, Cisaranten Endah, Kota Bandung",
    "-6.93327422542712",
    "107.671812993421",
    "Jl. Kamayangan Residence Blok A1 & A2, Cisaranten Endah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-21T01:57:22.221Z",
    "2026-10-21",
    "08:57:22",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92742610235883",
    "107.664810027901",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-21T01:57:49.745Z",
    "2026-10-21",
    "08:57:49",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92752457080806",
    "107.664894170974",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-21T01:59:30.745Z",
    "2026-10-21",
    "08:59:30",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92737532999641",
    "107.664990532754",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-21T02:35:53.919Z",
    "2026-10-21",
    "09:35:53",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274463",
    "107.6650252",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-21T02:59:17.500Z",
    "2026-10-21",
    "09:59:17",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274493",
    "107.6650056",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-21T03:08:48.198Z",
    "2026-10-21",
    "10:08:48",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92749184145171",
    "107.665014760592",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-21T10:11:24.590Z",
    "2026-10-21",
    "17:11:24",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274234",
    "107.664983",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-21T10:11:36.174Z",
    "2026-10-21",
    "17:11:36",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92750755542264",
    "107.664978204811",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-21T11:01:08.136Z",
    "2026-10-21",
    "18:01:08",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274843706077",
    "107.665009394983",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-21T12:52:12.168Z",
    "2026-10-21",
    "19:52:12",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92741771326647",
    "107.66500886264",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-22T01:50:24.848Z",
    "2026-10-22",
    "08:50:24",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9276133",
    "107.664925",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-22T01:58:38.561Z",
    "2026-10-22",
    "08:58:38",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92740449074127",
    "107.664909238069",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-22T01:59:46.063Z",
    "2026-10-22",
    "08:59:46",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92738381548316",
    "107.664916598342",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-22T02:03:31.039Z",
    "2026-10-22",
    "09:03:31",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92732854502607",
    "107.664903274034",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-22T02:04:35.385Z",
    "2026-10-22",
    "09:04:35",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92724172388039",
    "107.664933418059",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-22T02:21:39.088Z",
    "2026-10-22",
    "09:21:39",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274082",
    "107.6649872",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-22T02:27:56.840Z",
    "2026-10-22",
    "09:27:56",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92754119879188",
    "107.664864097",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-22T04:01:33.210Z",
    "2026-10-22",
    "11:01:33",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274314",
    "107.6649941",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-22T10:02:47.145Z",
    "2026-10-22",
    "17:02:47",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274535",
    "107.6650284",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-22T10:07:36.153Z",
    "2026-10-22",
    "17:07:36",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274263",
    "107.6649891",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-22T11:28:48.778Z",
    "2026-10-22",
    "18:28:48",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92752953419608",
    "107.664892847097",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-22T11:28:54.862Z",
    "2026-10-22",
    "18:28:54",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274433714512",
    "107.664894587948",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-22T15:33:16.417Z",
    "2026-10-22",
    "22:33:16",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Pratista Timur, Antapani Kidul, Bandung City",
    "-6.92789969782429",
    "107.664661564648",
    "Jl. Jalan Pratista Timur, Antapani Kidul, Bandung City",
    "-"
  ],
  [
    "2026-10-22T16:58:46.393Z",
    "2026-10-22",
    "23:58:46",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92756663629905",
    "107.66482394755",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-22T18:57:29.347Z",
    "2026-10-23",
    "01:57:29",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.927435",
    "107.6649986",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-22T19:05:24.084Z",
    "2026-10-23",
    "02:05:24",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Pratista Timur, Antapani Kidul, Bandung City",
    "-6.92759167795641",
    "107.664747521777",
    "Jl. Jalan Pratista Timur, Antapani Kidul, Bandung City",
    "-"
  ],
  [
    "2026-10-23T01:50:14.891Z",
    "2026-10-23",
    "08:50:14",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274153",
    "107.664991",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-23T01:50:47.121Z",
    "2026-10-23",
    "08:50:47",
    "Fauzan Akmaluddin",
    "fauzan@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Jend. H. Amir Machmud, Cijerah, Cimahi",
    "-6.9084472",
    "107.5677191",
    "Jl. Jalan Jend. H. Amir Machmud, Cijerah, Cimahi",
    "-"
  ],
  [
    "2026-10-23T01:58:19.042Z",
    "2026-10-23",
    "08:58:19",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92735203983408",
    "107.664913726977",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-23T02:04:17.182Z",
    "2026-10-23",
    "09:04:17",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92729254579705",
    "107.664919778821",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-23T03:02:18.057Z",
    "2026-10-23",
    "10:02:18",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Lengkong, Bojongsoang",
    "-6.97898871429704",
    "107.636580212188",
    "Lengkong, Bojongsoang",
    "-"
  ],
  [
    "2026-10-23T03:02:22.936Z",
    "2026-10-23",
    "10:02:22",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Lengkong, Bojongsoang",
    "-6.97898871429704",
    "107.636580212188",
    "Lengkong, Bojongsoang",
    "-"
  ],
  [
    "2026-10-23T03:11:03.689Z",
    "2026-10-23",
    "10:11:03",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92750755542264",
    "107.664978204811",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-23T03:51:23.415Z",
    "2026-10-23",
    "10:51:23",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-23T03:55:30.607Z",
    "2026-10-23",
    "10:55:30",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Tol Padalarang–Cileunyi",
    "-6.89053",
    "107.524165",
    "Jl. Jalan Tol Padalarang–Cileunyi, Cimahi",
    "-"
  ],
  [
    "2026-10-23T10:07:56.366Z",
    "2026-10-23",
    "17:07:56",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Jl. Jalan Jend. H. Amir Machmud",
    "-6.8709171484809",
    "107.537771875146",
    "Jl. Jalan Jend. H. Amir Machmud, Karangmekar, Cimahi",
    "-"
  ],
  [
    "2026-10-23T10:21:13.174Z",
    "2026-10-23",
    "17:21:13",
    "Fauzan Akmaluddin",
    "fauzan@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Jl. Jalan Sekejati, Sukapura, Bandung City",
    "-6.9418499",
    "107.6490131",
    "Jl. Jalan Sekejati, Sukapura, Bandung City",
    "-"
  ],
  [
    "2026-10-23T10:22:11.305Z",
    "2026-10-23",
    "17:22:11",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Sekejati, Sukapura, Kota Bandung",
    "-6.9418175",
    "107.6490664",
    "Jl. Jalan Sekejati, Sukapura, Kota Bandung",
    "-"
  ],
  [
    "2026-10-23T10:23:45.407Z",
    "2026-10-23",
    "17:23:45",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Jl. Jalan Sekejati",
    "-6.9417947",
    "107.6490863",
    "Jl. Jalan Sekejati, Sukapura, Kota Bandung",
    "-"
  ],
  [
    "2026-10-23T11:45:02.744Z",
    "2026-10-23",
    "18:45:02",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92752975161557",
    "107.664892764583",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-24T01:48:11.879Z",
    "2026-10-24",
    "08:48:11",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92739",
    "107.6649674",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-24T01:48:27.528Z",
    "2026-10-24",
    "08:48:27",
    "Fauzan Akmaluddin",
    "fauzan@aksarariksapjk3.com",
    "Masuk",
    "WFH",
    "Cibeureum, Cimahi",
    "-6.9095369",
    "107.5669973",
    "Cibeureum, Cimahi",
    "-"
  ],
  [
    "2026-10-24T02:00:16.871Z",
    "2026-10-24",
    "09:00:16",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Antapani Tengah, Bandung City",
    "-6.92629872777145",
    "107.666254485768",
    "Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-24T02:02:22.297Z",
    "2026-10-24",
    "09:02:22",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-24T02:06:27.625Z",
    "2026-10-24",
    "09:06:27",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92745464688054",
    "107.664963878499",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-24T02:26:45.054Z",
    "2026-10-24",
    "09:26:45",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274208",
    "107.6649897",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-24T02:58:07.547Z",
    "2026-10-24",
    "09:58:07",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Grand Icon Caman",
    "-6.2521635",
    "106.9523889",
    "Grand Icon Caman, Jl. Jalan Caman Raya, Bekasi",
    "-"
  ],
  [
    "2026-10-24T03:04:03.849Z",
    "2026-10-24",
    "10:04:03",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Sekolah",
    "-6.5968047",
    "106.790375",
    "Jl. Jalan Sekolah, Bogor Tengah, Bogor",
    "-"
  ],
  [
    "2026-10-24T03:36:34.953Z",
    "2026-10-24",
    "10:36:34",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "RSIA Parahyangan",
    "-6.8667482288605",
    "107.463417843249",
    "RSIA Parahyangan, Jl. Jalan Parahyangan, Bandung Barat",
    "-"
  ],
  [
    "2026-10-24T08:49:42.395Z",
    "2026-10-24",
    "15:49:42",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274468",
    "107.665008",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-24T10:21:07.859Z",
    "2026-10-24",
    "17:21:07",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92750755542264",
    "107.664978204811",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-24T12:15:14.801Z",
    "2026-10-24",
    "19:15:14",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274351088467",
    "107.665046154998",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-26T01:09:23.141Z",
    "2026-10-26",
    "08:09:23",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92741043332728",
    "107.664912917434",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-26T01:48:43.441Z",
    "2026-10-26",
    "08:48:43",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274059",
    "107.6649925",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-26T02:00:05.675Z",
    "2026-10-26",
    "09:00:05",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-26T02:00:07.657Z",
    "2026-10-26",
    "09:00:07",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92744694039381",
    "107.664908586357",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-26T02:09:30.260Z",
    "2026-10-26",
    "09:09:30",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92736499060034",
    "107.664972952287",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-26T03:23:35.983Z",
    "2026-10-26",
    "10:23:35",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274399",
    "107.66498",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-26T03:23:40.093Z",
    "2026-10-26",
    "10:23:40",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274666554837",
    "107.664955610964",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-26T03:45:10.741Z",
    "2026-10-26",
    "10:45:10",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92743",
    "107.6649885",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-26T10:03:42.309Z",
    "2026-10-26",
    "17:03:42",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-26T12:53:26.743Z",
    "2026-10-26",
    "19:53:26",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92741771326647",
    "107.66500886264",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-26T14:46:20.240Z",
    "2026-10-26",
    "21:46:20",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Jl. Jalan Pasar Ahad, Wangunharja, Bandung Barat",
    "-6.8048955",
    "107.6631002",
    "Jl. Jalan Pasar Ahad, Wangunharja, Bandung Barat",
    "-"
  ],
  [
    "2026-10-26T15:19:33.230Z",
    "2026-10-26",
    "22:19:33",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274509",
    "107.6650229",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-27T01:53:53.225Z",
    "2026-10-27",
    "08:53:53",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-27T01:57:33.504Z",
    "2026-10-27",
    "08:57:33",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92745480100145",
    "107.664909202903",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-27T02:00:10.087Z",
    "2026-10-27",
    "09:00:10",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-27T02:08:18.344Z",
    "2026-10-27",
    "09:08:18",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92739538990816",
    "107.664928736417",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-27T02:54:48.726Z",
    "2026-10-27",
    "09:54:48",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Bank Central Asia",
    "-6.9158745",
    "107.6336901",
    "Bank Central Asia, Jl. Jalan Cianjur, Kota Bandung",
    "-"
  ],
  [
    "2026-10-27T03:39:13.211Z",
    "2026-10-27",
    "10:39:13",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-27T09:30:10.454Z",
    "2026-10-27",
    "16:30:10",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92744909841843",
    "107.665042352968",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-27T09:39:28.082Z",
    "2026-10-27",
    "16:39:28",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.92742384234436",
    "107.665041732464",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-27T10:31:16.741Z",
    "2026-10-27",
    "17:31:16",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274285",
    "107.6649817",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-27T11:36:16.899Z",
    "2026-10-27",
    "18:36:16",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92742992220095",
    "107.665036813733",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-27T11:36:34.239Z",
    "2026-10-27",
    "18:36:34",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92740544015058",
    "107.66494591631",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-27T11:37:26.898Z",
    "2026-10-27",
    "18:37:26",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274605",
    "107.6649993",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-27T12:11:24.674Z",
    "2026-10-27",
    "19:11:24",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92744641037561",
    "107.665042820067",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-27T12:11:36.540Z",
    "2026-10-27",
    "19:11:36",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274403",
    "107.6649999",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-28T01:17:31.201Z",
    "2026-10-28",
    "08:17:31",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Cibodas Raya",
    "-6.92746368330335",
    "107.664911241464",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-28T01:57:49.461Z",
    "2026-10-28",
    "08:57:49",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92754339174658",
    "107.664820226826",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-28T01:58:51.640Z",
    "2026-10-28",
    "08:58:51",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92744330009823",
    "107.664952011109",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-28T01:59:22.862Z",
    "2026-10-28",
    "08:59:22",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-28T02:05:43.325Z",
    "2026-10-28",
    "09:05:43",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92725708861737",
    "107.664859209633",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-28T02:22:12.013Z",
    "2026-10-28",
    "09:22:12",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274279",
    "107.6649962",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-28T03:02:12.423Z",
    "2026-10-28",
    "10:02:12",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Plaza IBCC",
    "-6.9151156",
    "107.6341981",
    "Plaza IBCC, Jl. Jalan Jenderal Ahmad Yani, Kota Bandung",
    "-"
  ],
  [
    "2026-10-28T03:03:58.876Z",
    "2026-10-28",
    "10:03:58",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Jendral Sudirman, Cijerah, Kota Bandung",
    "-6.9123477",
    "107.5698054",
    "Jl. Jalan Jendral Sudirman, Cijerah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-28T03:04:41.998Z",
    "2026-10-28",
    "10:04:41",
    "Fauzan Akmaluddin",
    "fauzan@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Jendral Sudirman",
    "-6.9123477",
    "107.5698865",
    "Jl. Jalan Jendral Sudirman, Cijerah, Bandung City",
    "-"
  ],
  [
    "2026-10-28T03:16:14.402Z",
    "2026-10-28",
    "10:16:14",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Plaza IBCC",
    "-6.9151385",
    "107.6341373",
    "Plaza IBCC, Jl. Jalan Jenderal Ahmad Yani, Kota Bandung",
    "-"
  ],
  [
    "2026-10-28T10:00:57.187Z",
    "2026-10-28",
    "17:00:57",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Bank Central Asia",
    "-6.9158336",
    "107.6336786",
    "Bank Central Asia, Jl. Jalan Cianjur, Kota Bandung",
    "-"
  ],
  [
    "2026-10-28T10:02:09.910Z",
    "2026-10-28",
    "17:02:09",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-28T10:03:16.574Z",
    "2026-10-28",
    "17:03:16",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Bank Central Asia",
    "-6.9158336",
    "107.633646",
    "Bank Central Asia, Jl. Jalan Cianjur, Kota Bandung",
    "-"
  ],
  [
    "2026-10-28T11:28:53.727Z",
    "2026-10-28",
    "18:28:53",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Jl. Jalan Babakan Muncang",
    "-6.85402823835501",
    "107.555976784105",
    "Jl. Jalan Babakan Muncang, Padaasih, Bandung Barat",
    "-"
  ],
  [
    "2026-10-28T11:48:30.287Z",
    "2026-10-28",
    "18:48:30",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Kamayangan Residence Blok C, Cisaranten Endah, Bandung City",
    "-6.9333469625868",
    "107.671800656522",
    "Jl. Kamayangan Residence Blok C, Cisaranten Endah, Bandung City",
    "-"
  ],
  [
    "2026-10-28T11:48:35.827Z",
    "2026-10-28",
    "18:48:35",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Kamayangan Residence Blok C, Cisaranten Endah, Bandung City",
    "-6.9333469625868",
    "107.671800656522",
    "Jl. Kamayangan Residence Blok C, Cisaranten Endah, Bandung City",
    "-"
  ],
  [
    "2026-10-29T01:06:22.853Z",
    "2026-10-29",
    "08:06:22",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9275182",
    "107.6647999",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-29T01:50:10.738Z",
    "2026-10-29",
    "08:50:10",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Cianjur, Kacapiring, Kota Bandung",
    "-6.9159605",
    "107.6336541",
    "Jl. Jalan Cianjur, Kacapiring, Kota Bandung",
    "-"
  ],
  [
    "2026-10-29T01:55:22.530Z",
    "2026-10-29",
    "08:55:22",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-29T01:58:31.588Z",
    "2026-10-29",
    "08:58:31",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274555717739",
    "107.664909605296",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-29T02:03:18.555Z",
    "2026-10-29",
    "09:03:18",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92741771326647",
    "107.66500886264",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-29T02:07:44.982Z",
    "2026-10-29",
    "09:07:44",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92731413118677",
    "107.664945549491",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-29T02:11:31.866Z",
    "2026-10-29",
    "09:11:31",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Cibodas Raya",
    "-6.92742680508629",
    "107.665031464055",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-29T02:17:16.486Z",
    "2026-10-29",
    "09:17:16",
    "Fauzan Akmaluddin",
    "fauzan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Pertamina (Jl. Jalan Tol Padalarang–Cileunyi)",
    "-6.884778",
    "107.5195149",
    "Pertamina, Jl. Jalan Tol Padalarang–Cileunyi, Cimahi",
    "-"
  ],
  [
    "2026-10-29T02:17:26.261Z",
    "2026-10-29",
    "09:17:26",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Bank Central Asia",
    "-6.9158788",
    "107.6336779",
    "Bank Central Asia, Jl. Jalan Cianjur, Kota Bandung",
    "-"
  ],
  [
    "2026-10-29T02:40:42.145Z",
    "2026-10-29",
    "09:40:42",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Parakan Saat, Antapani Tengah, Bandung City",
    "-6.92766035687781",
    "107.665452399001",
    "Jl. Jalan Parakan Saat, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-29T03:01:19.892Z",
    "2026-10-29",
    "10:01:19",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274308",
    "107.6649768",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-29T10:51:05.794Z",
    "2026-10-29",
    "17:51:05",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Jl. Jalan Pasar Ahad, Wangunharja, Bandung Barat",
    "-6.8048956",
    "107.6631004",
    "Jl. Jalan Pasar Ahad, Wangunharja, Bandung Barat",
    "-"
  ],
  [
    "2026-10-29T16:51:11.182Z",
    "2026-10-29",
    "23:51:11",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92734421381317",
    "107.664995341542",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-30T01:37:56.632Z",
    "2026-10-30",
    "08:37:56",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-30T01:51:21.287Z",
    "2026-10-30",
    "08:51:21",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-30T01:53:15.114Z",
    "2026-10-30",
    "08:53:15",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Antapani Tengah, Bandung City",
    "-6.9274797",
    "107.66521425",
    "Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-30T01:59:41.893Z",
    "2026-10-30",
    "08:59:41",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92742994658393",
    "107.665034997241",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-30T02:07:17.007Z",
    "2026-10-30",
    "09:07:17",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92738431491876",
    "107.664842170978",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-30T02:35:59.234Z",
    "2026-10-30",
    "09:35:59",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Bank Central Asia (Jl. Jalan Cianjur)",
    "-6.9158419",
    "107.6337048",
    "Bank Central Asia, Jl. Jalan Cianjur, Kota Bandung",
    "-"
  ],
  [
    "2026-10-30T02:42:23.821Z",
    "2026-10-30",
    "09:42:23",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "SDN POLISI 5 BOGOR",
    "-6.5981766",
    "106.7908971",
    "SDN POLISI 5 BOGOR, Jl. Jalan Polisi 1, Bogor",
    "-"
  ],
  [
    "2026-10-30T02:46:27.852Z",
    "2026-10-30",
    "09:46:27",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274524",
    "107.6650233",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-30T03:25:54.351Z",
    "2026-10-30",
    "10:25:54",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Pet's World (Jl. Jalan Jenderal Ahmad Yani)",
    "-6.915679",
    "107.6336673",
    "Pet's World, Jl. Jalan Jenderal Ahmad Yani, Kota Bandung",
    "-"
  ],
  [
    "2026-10-30T06:34:17.497Z",
    "2026-10-30",
    "13:34:17",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Antapani Tengah, Bandung City",
    "-6.9274797",
    "107.66521425",
    "Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-30T10:02:52.703Z",
    "2026-10-30",
    "17:02:52",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274241",
    "107.6649863",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-30T10:11:13.496Z",
    "2026-10-30",
    "17:11:13",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-30T10:11:39.235Z",
    "2026-10-30",
    "17:11:39",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-30T10:19:16.892Z",
    "2026-10-30",
    "17:19:16",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92732755022134",
    "107.664936559445",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-30T10:19:17.617Z",
    "2026-10-30",
    "17:19:17",
    "Disa Liestianie Putri",
    "disa@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92712245915117",
    "107.664945559004",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-30T10:20:41.711Z",
    "2026-10-30",
    "17:20:41",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-10-31T02:00:21.002Z",
    "2026-10-31",
    "09:00:21",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92722766261957",
    "107.66490950782",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-31T02:01:59.525Z",
    "2026-10-31",
    "09:01:59",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274218",
    "107.6648081",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-31T02:02:19.809Z",
    "2026-10-31",
    "09:02:19",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Cibodas Raya",
    "-6.92742680508629",
    "107.665031464055",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-31T02:07:15.670Z",
    "2026-10-31",
    "09:07:15",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92745190580089",
    "107.665033685144",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-10-31T02:34:52.274Z",
    "2026-10-31",
    "09:34:52",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274384",
    "107.664997",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-10-31T02:38:28.353Z",
    "2026-10-31",
    "09:38:28",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Rumah Bolen Lilit",
    "-6.8661996",
    "107.4647066",
    "Rumah Bolen Lilit, Jl. Jalan Parahyangan, Bandung Barat",
    "-"
  ],
  [
    "2026-10-31T02:58:42.708Z",
    "2026-10-31",
    "09:58:42",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Rumah Bolen Lilit",
    "-6.8663715",
    "107.4647095",
    "Rumah Bolen Lilit, Jl. Jalan Parahyangan, Bandung Barat",
    "-"
  ],
  [
    "2026-10-31T10:53:54.341Z",
    "2026-10-31",
    "17:53:54",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92745596769458",
    "107.665007921947",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-02T01:52:30.214Z",
    "2026-11-02",
    "08:52:30",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-02T01:54:26.587Z",
    "2026-11-02",
    "08:54:26",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-02T02:00:20.035Z",
    "2026-11-02",
    "09:00:20",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274596",
    "107.664931",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-02T02:05:41.454Z",
    "2026-11-02",
    "09:05:41",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92731737303382",
    "107.664916848038",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-02T02:23:09.321Z",
    "2026-11-02",
    "09:23:09",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Batununggal Sentosa",
    "-6.9593721",
    "107.6245176",
    "Jl. Jalan Batununggal Sentosa, Batununggal Indah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-02T03:30:30.983Z",
    "2026-11-02",
    "10:30:30",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92743986818195",
    "107.665022280294",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-02T03:31:22.994Z",
    "2026-11-02",
    "10:31:22",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-02T03:31:50.491Z",
    "2026-11-02",
    "10:31:50",
    "Fauzan Akmaluddin",
    "fauzan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Batununggal Sentosa, Batununggal Indah, Bandung City",
    "-6.9593714",
    "107.6245211",
    "Jl. Jalan Batununggal Sentosa, Batununggal Indah, Bandung City",
    "-"
  ],
  [
    "2026-11-02T10:00:23.241Z",
    "2026-11-02",
    "17:00:23",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274423",
    "107.6649931",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-02T10:47:37.875Z",
    "2026-11-02",
    "17:47:37",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92743487892953",
    "107.665016937221",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-02T10:47:43.214Z",
    "2026-11-02",
    "17:47:43",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-03T01:48:19.422Z",
    "2026-11-03",
    "08:48:19",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274077898036",
    "107.664957170953",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-03T01:52:18.790Z",
    "2026-11-03",
    "08:52:18",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-03T01:59:30.316Z",
    "2026-11-03",
    "08:59:30",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274554",
    "107.665038",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-03T02:00:52.050Z",
    "2026-11-03",
    "09:00:52",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274409",
    "107.6649917",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-03T02:52:24.441Z",
    "2026-11-03",
    "09:52:24",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Batununggal Sentosa",
    "-6.95942332796873",
    "107.624468112852",
    "Jl. Jalan Batununggal Sentosa, Batununggal Indah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-03T03:29:57.900Z",
    "2026-11-03",
    "10:29:57",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92742651112362",
    "107.665071661187",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-03T04:45:02.285Z",
    "2026-11-03",
    "11:45:02",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274517",
    "107.6650168",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-03T10:02:51.813Z",
    "2026-11-03",
    "17:02:51",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274416",
    "107.6649869",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-03T10:03:13.228Z",
    "2026-11-03",
    "17:03:13",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274334",
    "107.6649805",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-03T10:03:31.172Z",
    "2026-11-03",
    "17:03:31",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274401",
    "107.664994",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-04T01:19:54.428Z",
    "2026-11-04",
    "08:19:54",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-04T01:42:45.593Z",
    "2026-11-04",
    "08:42:45",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Dr. Djunjunan, Sukabungah, Kota Bandung",
    "-6.89532509224954",
    "107.588982797129",
    "Jl. Jalan Dr. Djunjunan, Sukabungah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-04T01:57:01.348Z",
    "2026-11-04",
    "08:57:01",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-04T02:04:27.767Z",
    "2026-11-04",
    "09:04:27",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92739088771807",
    "107.665038873619",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-04T02:43:39.231Z",
    "2026-11-04",
    "09:43:39",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "RS Dustira (Jl. Jalan Dustira)",
    "-6.8864723",
    "107.5358278",
    "RS Dustira, Jl. Jalan Dustira, Cimahi",
    "-"
  ],
  [
    "2026-11-04T02:47:47.773Z",
    "2026-11-04",
    "09:47:47",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.927433",
    "107.6649784",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-04T02:52:03.838Z",
    "2026-11-04",
    "09:52:03",
    "Fauzan Akmaluddin",
    "fauzan@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Raya Kopo Katapang",
    "-6.9932295",
    "107.554867",
    "Jl. Jalan Raya Kopo Katapang, Katapang",
    "-"
  ],
  [
    "2026-11-04T02:59:34.483Z",
    "2026-11-04",
    "09:59:34",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-04T10:48:51.007Z",
    "2026-11-04",
    "17:48:51",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274077898036",
    "107.664957170953",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-04T23:42:09.090Z",
    "2026-11-05",
    "06:42:09",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "WFH",
    "Kediaman Pribadi (WFH)",
    "-6.95013331174963",
    "107.784149655529",
    "Cinta Mulya, Sumedang",
    "-"
  ],
  [
    "2026-11-05T00:48:54.923Z",
    "2026-11-05",
    "07:48:54",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-05T01:22:05.490Z",
    "2026-11-05",
    "08:22:05",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274077898036",
    "107.664957170953",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-05T02:10:40.251Z",
    "2026-11-05",
    "09:10:40",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "ATM BRI (Jl. Jalan Buah Batu)",
    "-6.9382571",
    "107.6236618",
    "ATM BRI, Jl. Jalan Buah Batu, Kota Bandung",
    "-"
  ],
  [
    "2026-11-05T02:46:08.700Z",
    "2026-11-05",
    "09:46:08",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-05T09:29:57.343Z",
    "2026-11-05",
    "16:29:57",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274392",
    "107.6650248",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-05T09:30:10.244Z",
    "2026-11-05",
    "16:30:10",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92743733202856",
    "107.665063465128",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-05T10:01:37.437Z",
    "2026-11-05",
    "17:01:37",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.927296",
    "107.664972",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-05T12:44:10.381Z",
    "2026-11-05",
    "19:44:10",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Jl. Jalan Pembangunan",
    "-6.9197626",
    "106.9589135",
    "Jl. Jalan Pembangunan, Sukabumi",
    "-"
  ],
  [
    "2026-11-06T01:02:51.053Z",
    "2026-11-06",
    "08:02:51",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "WFH",
    "Kediaman Pribadi (WFH)",
    "-6.95014025929491",
    "107.784146908824",
    "Cinta Mulya, Sumedang",
    "-"
  ],
  [
    "2026-11-06T01:56:45.344Z",
    "2026-11-06",
    "08:56:45",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-06T02:20:03.072Z",
    "2026-11-06",
    "09:20:03",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274404",
    "107.6650185",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-06T02:26:29.988Z",
    "2026-11-06",
    "09:26:29",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274077898036",
    "107.664957170953",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-06T02:35:00.240Z",
    "2026-11-06",
    "09:35:00",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Site Proyek Klien",
    "-6.8668891039921",
    "107.462914863695",
    "Kota Baru Parahyangan, Bandung Barat",
    "-"
  ],
  [
    "2026-11-06T02:35:13.631Z",
    "2026-11-06",
    "09:35:13",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274358",
    "107.665026",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-06T05:23:58.617Z",
    "2026-11-06",
    "12:23:58",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.927296",
    "107.664972",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-06T10:00:11.138Z",
    "2026-11-06",
    "17:00:11",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274003",
    "107.6649348",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-06T10:02:01.588Z",
    "2026-11-06",
    "17:02:01",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.927432",
    "107.664969",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-06T11:23:01.205Z",
    "2026-11-06",
    "18:23:01",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92743778594414",
    "107.665061998139",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-06T11:23:04.134Z",
    "2026-11-06",
    "18:23:04",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92743778594414",
    "107.665061998139",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-06T11:39:24.412Z",
    "2026-11-06",
    "18:39:24",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274077898036",
    "107.664957170953",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-07T01:57:04.691Z",
    "2026-11-07",
    "08:57:04",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-07T01:58:17.779Z",
    "2026-11-07",
    "08:58:17",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274003",
    "107.6649348",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-07T02:04:43.475Z",
    "2026-11-07",
    "09:04:43",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.927437",
    "107.6650265",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-07T02:16:16.046Z",
    "2026-11-07",
    "09:16:16",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92728686438435",
    "107.664892781932",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-07T02:28:43.877Z",
    "2026-11-07",
    "09:28:43",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274069",
    "107.6649439",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-07T03:06:24.828Z",
    "2026-11-07",
    "10:06:24",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274168",
    "107.6649624",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-07T08:41:09.115Z",
    "2026-11-07",
    "15:41:09",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-07T09:36:32.298Z",
    "2026-11-07",
    "16:36:32",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-07T10:08:06.753Z",
    "2026-11-07",
    "17:08:06",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92734494352332",
    "107.665026005535",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-07T13:02:24.952Z",
    "2026-11-07",
    "20:02:24",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9273331",
    "107.6648999",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-09T01:14:56.716Z",
    "2026-11-09",
    "08:14:56",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Cibodas Raya",
    "-6.9274891",
    "107.6648007",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-09T01:48:26.219Z",
    "2026-11-09",
    "08:48:26",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Asia Afrika",
    "-6.9218394",
    "107.6139903",
    "Jl. Jalan Asia Afrika, Kebon Pisang, Kota Bandung",
    "-"
  ],
  [
    "2026-11-09T01:55:21.399Z",
    "2026-11-09",
    "08:55:21",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-09T01:55:39.620Z",
    "2026-11-09",
    "08:55:39",
    "Fauzan Akmaluddin",
    "fauzan@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Asia Africa Avenue",
    "-6.9218251",
    "107.6139779",
    "Jl. Asia Africa Avenue, Kebon Pisang, Bandung City",
    "-"
  ],
  [
    "2026-11-09T02:06:20.773Z",
    "2026-11-09",
    "09:06:20",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92732663825797",
    "107.664878871392",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-09T03:24:04.612Z",
    "2026-11-09",
    "10:24:04",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Eatalia",
    "-6.9239",
    "107.6115703",
    "Eatalia, Jl. Jalan Lengkong Besar, Kota Bandung",
    "-"
  ],
  [
    "2026-11-09T03:53:47.317Z",
    "2026-11-09",
    "10:53:47",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Eatalia",
    "-6.92396409635279",
    "107.61169354455",
    "Eatalia, Jl. Jalan Lengkong Besar, Kota Bandung",
    "-"
  ],
  [
    "2026-11-09T05:36:24.168Z",
    "2026-11-09",
    "12:36:24",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Terusan Jakarta, Antapani Tengah, Bandung City",
    "-6.91246046835654",
    "107.653648029058",
    "Jl. Jalan Terusan Jakarta, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-09T11:42:55.946Z",
    "2026-11-09",
    "18:42:55",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Site Proyek Klien",
    "-6.4729155",
    "107.4465869",
    "Cigelam, Purwakarta",
    "-"
  ],
  [
    "2026-11-09T12:37:23.638Z",
    "2026-11-09",
    "19:37:23",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Eatalia",
    "-6.92433700773879",
    "107.611842378974",
    "Eatalia, Jl. Jalan Lengkong Besar, Kota Bandung",
    "-"
  ],
  [
    "2026-11-09T14:03:55.579Z",
    "2026-11-09",
    "21:03:55",
    "Fauzan Akmaluddin",
    "fauzan@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Cikarang Primebiz Hotel",
    "-6.3161876",
    "107.1374746",
    "Cikarang Primebiz Hotel, Jl. Jalan Raya Cibarusah, Sukaresmi",
    "-"
  ],
  [
    "2026-11-10T01:41:28.935Z",
    "2026-11-10",
    "08:41:28",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Lengkong, Bojongsoang",
    "-6.97904622540055",
    "107.636542846865",
    "Lengkong, Bojongsoang",
    "-"
  ],
  [
    "2026-11-10T01:58:47.980Z",
    "2026-11-10",
    "08:58:47",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-10T02:06:00.659Z",
    "2026-11-10",
    "09:06:00",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92741700563511",
    "107.664874872254",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-10T02:43:03.040Z",
    "2026-11-10",
    "09:43:03",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274421",
    "107.665023",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-10T03:04:00.596Z",
    "2026-11-10",
    "10:04:00",
    "Reyhan",
    "reyhan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-10T03:46:07.184Z",
    "2026-11-10",
    "10:46:07",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274246",
    "107.6649778",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-10T04:29:31.580Z",
    "2026-11-10",
    "11:29:31",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-10T10:37:51.579Z",
    "2026-11-10",
    "17:37:51",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92744108823436",
    "107.665054321566",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-10T11:56:22.799Z",
    "2026-11-10",
    "18:56:22",
    "Reyhan",
    "reyhan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274372",
    "107.6650222",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-10T11:57:08.838Z",
    "2026-11-10",
    "18:57:08",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Batununggal Sentosa, Batununggal Indah, Kota Bandung",
    "-6.95941563924053",
    "107.624475101172",
    "Jl. Jalan Batununggal Sentosa, Batununggal Indah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-10T15:33:01.012Z",
    "2026-11-10",
    "22:33:01",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Pratista Timur, Antapani Kidul, Kota Bandung",
    "-6.9278231",
    "107.6645451",
    "Jl. Jalan Pratista Timur, Antapani Kidul, Kota Bandung",
    "-"
  ],
  [
    "2026-11-11T01:52:22.196Z",
    "2026-11-11",
    "08:52:22",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92739348370186",
    "107.664859935465",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-11T01:54:42.641Z",
    "2026-11-11",
    "08:54:42",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92730123751293",
    "107.664919338896",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-11T02:03:16.021Z",
    "2026-11-11",
    "09:03:16",
    "Reyhan",
    "reyhan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274331",
    "107.6650275",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-11T02:51:43.283Z",
    "2026-11-11",
    "09:51:43",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274313",
    "107.6650228",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-11T03:21:46.555Z",
    "2026-11-11",
    "10:21:46",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274638",
    "107.6650251",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-11T04:21:15.170Z",
    "2026-11-11",
    "11:21:15",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274053",
    "107.664971",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-11T04:33:24.193Z",
    "2026-11-11",
    "11:33:24",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274544",
    "107.6650515",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-11T05:43:49.334Z",
    "2026-11-11",
    "12:43:49",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92744106025186",
    "107.665054380425",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-11T10:29:36.867Z",
    "2026-11-11",
    "17:29:36",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-11T10:29:52.188Z",
    "2026-11-11",
    "17:29:52",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-11T13:32:53.840Z",
    "2026-11-11",
    "20:32:53",
    "Reyhan",
    "reyhan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274474",
    "107.6650365",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-11T13:36:03.963Z",
    "2026-11-11",
    "20:36:03",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92722713248668",
    "107.664922515533",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-11T13:36:34.252Z",
    "2026-11-11",
    "20:36:34",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-11T16:49:27.110Z",
    "2026-11-11",
    "23:49:27",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274774",
    "107.6650069",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-12T01:34:50.643Z",
    "2026-11-12",
    "08:34:50",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92739502914629",
    "107.664959052673",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-12T01:54:52.954Z",
    "2026-11-12",
    "08:54:52",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-12T01:59:24.389Z",
    "2026-11-12",
    "08:59:24",
    "Reyhan",
    "reyhan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.927448",
    "107.6650385",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-12T02:37:57.222Z",
    "2026-11-12",
    "09:37:57",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274241",
    "107.6650083",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-12T02:40:53.036Z",
    "2026-11-12",
    "09:40:53",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274812",
    "107.664997",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-12T02:41:31.904Z",
    "2026-11-12",
    "09:41:31",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274608",
    "107.66501",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-12T02:42:23.573Z",
    "2026-11-12",
    "09:42:23",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274779",
    "107.6649956",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-12T03:03:30.792Z",
    "2026-11-12",
    "10:03:30",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92743998893092",
    "107.665054538804",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-12T10:29:20.356Z",
    "2026-11-12",
    "17:29:20",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Jl. Jalan Depok VII",
    "-6.9127058",
    "107.6567514",
    "Jl. Jalan Depok VII, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-12T12:40:17.084Z",
    "2026-11-12",
    "19:40:17",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92730158863244",
    "107.664973289684",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-12T13:06:25.615Z",
    "2026-11-12",
    "20:06:25",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Batununggal Sentosa",
    "-6.95947817064186",
    "107.624458394471",
    "Jl. Jalan Batununggal Sentosa, Batununggal Indah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-13T01:25:53.565Z",
    "2026-11-13",
    "08:25:53",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Cibodas Raya",
    "-6.9274453",
    "107.665052",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-13T01:31:23.508Z",
    "2026-11-13",
    "08:31:23",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-13T01:39:04.901Z",
    "2026-11-13",
    "08:39:04",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274825",
    "107.6649925",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-13T01:55:15.707Z",
    "2026-11-13",
    "08:55:15",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9273823022995",
    "107.664818305859",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-13T02:00:56.660Z",
    "2026-11-13",
    "09:00:56",
    "Reyhan",
    "reyhan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274353",
    "107.6650143",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-13T02:12:18.762Z",
    "2026-11-13",
    "09:12:18",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92740654950568",
    "107.664973320919",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-13T03:00:56.275Z",
    "2026-11-13",
    "10:00:56",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-13T03:20:37.735Z",
    "2026-11-13",
    "10:20:37",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.9274617",
    "107.6650137",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-13T11:12:01.389Z",
    "2026-11-13",
    "18:12:01",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cimekar, Cimincrang, Kota Bandung",
    "-6.94911911041883",
    "107.712677721452",
    "Jl. Jalan Cimekar, Cimincrang, Kota Bandung",
    "-"
  ],
  [
    "2026-11-13T11:23:02.652Z",
    "2026-11-13",
    "18:23:02",
    "Reyhan",
    "reyhan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-13T12:41:41.835Z",
    "2026-11-13",
    "19:41:41",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Jl. Jalan Cimekar",
    "-6.949305",
    "107.7131379",
    "Jl. Jalan Cimekar, Cimincrang, Kota Bandung",
    "-"
  ],
  [
    "2026-11-13T13:20:26.135Z",
    "2026-11-13",
    "20:20:26",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Aster, Ciwaruga, West Bandung",
    "-6.85761597704221",
    "107.581412598205",
    "Jl. Jalan Aster, Ciwaruga, West Bandung",
    "-"
  ],
  [
    "2026-11-13T13:20:29.074Z",
    "2026-11-13",
    "20:20:29",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Jl. Jalan Aster, Ciwaruga, West Bandung",
    "-6.85761597704221",
    "107.581412598205",
    "Jl. Jalan Aster, Ciwaruga, West Bandung",
    "-"
  ],
  [
    "2026-11-13T15:57:59.295Z",
    "2026-11-13",
    "22:57:59",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Pulang",
    "On Site",
    "Jl. Jalan Pasar Ahad",
    "-6.8049084",
    "107.6630859",
    "Jl. Jalan Pasar Ahad, Wangunharja, Bandung Barat",
    "-"
  ],
  [
    "2026-11-14T01:56:08.811Z",
    "2026-11-14",
    "08:56:08",
    "Marsya Aulia Rohman",
    "marsya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-14T01:56:36.015Z",
    "2026-11-14",
    "08:56:36",
    "Arya Rizki Pratama",
    "arya@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-14T02:03:37.205Z",
    "2026-11-14",
    "09:03:37",
    "Aulia Zahra Dikrika",
    "aulia@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-6.92743708321783",
    "107.664902000489",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-14T02:13:59.326Z",
    "2026-11-14",
    "09:13:59",
    "Reyhan",
    "reyhan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-14T02:50:12.524Z",
    "2026-11-14",
    "09:50:12",
    "Lalu Imam Taufik Rahman Hidayat",
    "imam@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Katsunyaka",
    "-6.8686647",
    "107.5321864",
    "Katsunyaka, Jl. Jalan Jend. H. Amir Machmud, Cimahi",
    "-"
  ],
  [
    "2026-11-14T02:58:51.978Z",
    "2026-11-14",
    "09:58:51",
    "Fauzan Akmaluddin",
    "fauzan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Katsunyaka (Jl. Jalan Jend. H. Amir Machmud)",
    "-6.8686579",
    "107.5321608",
    "Katsunyaka, Jl. Jalan Jend. H. Amir Machmud, Cimahi",
    "-"
  ],
  [
    "2026-11-14T02:58:53.216Z",
    "2026-11-14",
    "09:58:53",
    "Demas",
    "demas@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Katsunyaka",
    "-6.8686896",
    "107.5321699",
    "Katsunyaka, Jl. Jalan Jend. H. Amir Machmud, Cimahi",
    "-"
  ],
  [
    "2026-11-14T04:26:55.378Z",
    "2026-11-14",
    "11:26:55",
    "Muhammad Fazar Maulana",
    "fazar@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.9274326",
    "107.665025",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-14T04:27:39.884Z",
    "2026-11-14",
    "11:27:39",
    "Zulfan Rafly Baihaqi",
    "zulfan@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-6.92737940370605",
    "107.665041328601",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Bandung City",
    "-"
  ],
  [
    "2026-11-14T04:39:39.842Z",
    "2026-11-14",
    "11:39:39",
    "Rama Regawa Sri Anggayana",
    "angga@aksarariksapjk3.com",
    "Masuk",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ],
  [
    "2026-11-14T04:40:37.680Z",
    "2026-11-14",
    "11:40:37",
    "Fakhziar Wildan Hidayat",
    "fakhziar@aksarariksapjk3.com",
    "Masuk",
    "On Site",
    "Jl. Jalan Cibodas Raya",
    "-6.92735170883259",
    "107.664908664214",
    "Jl. Jalan Cibodas Raya, Antapani Tengah, Kota Bandung",
    "-"
  ],
  [
    "2026-11-14T11:29:25.265Z",
    "2026-11-14",
    "18:29:25",
    "Reyhan",
    "reyhan@aksarariksapjk3.com",
    "Pulang",
    "Kantor",
    "Kantor Pusat PT Aksara Riksa Perdana",
    "-6.208763",
    "106.845599",
    "Kantor Pusat PT Aksara Riksa Perdana (Default Lokasi Laptop/PC)",
    "-"
  ]
];
