<!-- KB_VERSION: 2.3.0 -->
# MASTER BOILERPLATES & UNIVERSAL SANDBOX PREVIEW GUARD
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat pada setiap pembuatan atau modifikasi kode (`setup.gs`, `code.gs`, `index.html`).

## Daftar Isi
1. [Keputusan Arsitektur 3-File vs 6-File Modular](#1-keputusan-arsitektur-3-file-vs-6-file-modular)
2. [Boilerplate `setup.gs` (Idempoten, Sinkronisasi Zona Waktu & Seed Per-Hari)](#2-boilerplate-setupgs-idempoten-sinkronisasi-zona-waktu--seed-per-hari)
3. [Boilerplate `code.gs` (CRUD Kanonik, Guard Admin, Anti-Null & `runDiagnostics`)](#3-boilerplate-codegs-crud-kanonik-guard-admin-anti-null--rundiagnostics)
4. [Boilerplate `index.html` (Universal Sandbox Guard, Mock Identik & Anti-XSS)](#4-boilerplate-indexhtml-universal-sandbox-guard-mock-identik--anti-xss)

---

<!-- DIGEST:START -->
## 1. Keputusan Arsitektur 3-File vs 6-File Modular

### A. Standar Default: 3-File Monolithic (`setup.gs`, `code.gs`, `index.html`)
- Gunakan struktur 3-file sebagai default karena seluruh kode HTML, CSS, dan JS berada di dalam satu file `index.html` utuh. Hal ini memastikan aplikasi dapat langsung dijalankan pada pratinjau sandbox browser (Claude Artifacts, ChatGPT Canvas, Gemini Canvas, maupun file HTML lokal) yang tidak memiliki mesin kompilator scriptlet server `<?!= include(...) ?>` milik Google Apps Script.
- Pada mode 3-file, `doGet(e)` menggunakan `HtmlService.createHtmlOutputFromFile('index')` yang lebih cepat dan bebas dari benturan karakter tag scriptlet `<?` di dalam kode JS/CSS.

### B. Opsi 6-File Modular (`setup.gs`, `code.gs`, `index.html`, `styles.html`, `modals.html`, `scripts.html`)
- Gunakan **hanya** apabila pengguna secara eksplisit meminta arsitektur modular multi-file untuk dikelola langsung di dalam editor Google Apps Script.
- Karena mode 6-file menggunakan tag scriptlet `<?!= include('styles'); ?>` di dalam `index.html`, fungsi `doGet(e)` di `code.gs` **harus** menggunakan `HtmlService.createTemplateFromFile('index').evaluate()` beserta fungsi helper `include(filename)`:
  ```javascript
  function doGet(e) {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Nama Aplikasi')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }

  function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  }
  ```
<!-- DIGEST:END -->

---

## 2. Boilerplate `setup.gs` (Idempoten, Sinkronisasi Zona Waktu & Seed Per-Hari)

```javascript
var SCHEMA_VERSION = '1.0.0';
var DEFAULT_TZ = 'Asia/Jakarta';
var DB_SCHEMAS = {
  ITEMS: ['id', 'created_at', 'updated_at', 'title', 'category', 'amount', 'status', 'is_seed'],
  CONFIG: ['config_key', 'config_value', 'updated_at']
};

/**
 * Fungsi inisialisasi database yang idempoten.
 * Tetap tanpa akhiran underscore (_) agar muncul di dropdown "Run" toolbar GAS IDE.
 */
function initialSetupDatabase() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Setup sedang berjalan di proses lain. Silakan tunggu beberapa detik.');
  }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var props = PropertiesService.getScriptProperties();
    var tz = Session.getScriptTimeZone() || DEFAULT_TZ;

    // Samakan zona waktu Spreadsheet dengan zona waktu Script agar format tanggal konsisten
    if (ss.getSpreadsheetTimeZone() !== tz) {
      ss.setSpreadsheetTimeZone(tz);
    }

    // OWNER_EMAIL dan ADMIN_PIN tidak pernah dibuat otomatis.
    // Isi OWNER_EMAIL secara manual di Script Properties setelah memverifikasi pemilik.
    // ADMIN_PIN opsional; bila dipakai, harus dibuat manual di Script Properties.

    Object.keys(DB_SCHEMAS).forEach(function(sheetName) {
      var expectedHeaders = DB_SCHEMAS[sheetName];
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }

      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, expectedHeaders.length)
          .setValues([expectedHeaders])
          .setFontWeight('bold')
          .setBackground('#F1F5F9');
        sheet.setFrozenRows(1);
      } else {
        // Migrasi header non-destruktif jika ada penambahan kolom pada versi baru
        var lastCol = sheet.getLastColumn();
        var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
          return String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        });
        expectedHeaders.forEach(function(reqHeader) {
          if (currentHeaders.indexOf(reqHeader) === -1) {
            lastCol += 1;
            sheet.getRange(1, lastCol).setValue(reqHeader).setFontWeight('bold').setBackground('#F1F5F9');
          }
        });
      }
    });

    // Seed 16 baris data historis dengan penomoran urut per-hari (bukan i + 1 lintas tanggal)
    var itemsSheet = ss.getSheetByName('ITEMS');
    if (itemsSheet.getLastRow() <= 1 && props.getProperty('SEED_INITIALIZED') !== 'TRUE') {
      var now = new Date();
      var dayOffsets = [0, 0, 1, 1, 2, 3, 4, 6, 7, 9, 12, 15, 18, 21, 25, 29];
      var categories = ['Operasional', 'Pemasaran', 'Infrastruktur', 'Lisensi'];
      var statuses = ['ACTIVE', 'ACTIVE', 'COMPLETED', 'PENDING'];
      var seqByDay = {};
      var seedRows = [];

      for (var i = 0; i < dayOffsets.length; i++) {
        var d = new Date(now.getTime() - dayOffsets[i] * 86400000);
        var ymd = Utilities.formatDate(d, tz, 'yyyyMMdd');
        var isoOffset = Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
        seqByDay[ymd] = (seqByDay[ymd] || 0) + 1;
        var seqStr = ('0000' + seqByDay[ymd]).slice(-4);

        seedRows.push([
          'SEED-' + ymd + '-' + seqStr,
          isoOffset,
          isoOffset,
          'Contoh Transaksi #' + (i + 1),
          categories[i % categories.length],
          (i + 1) * 125000,
          statuses[i % statuses.length],
          'TRUE'
        ]);
      }
      itemsSheet.getRange(2, 1, seedRows.length, DB_SCHEMAS.ITEMS.length).setValues(seedRows);
      props.setProperty('SEED_INITIALIZED', 'TRUE');
    }

    props.setProperty('SCHEMA_VERSION', SCHEMA_VERSION);
    SpreadsheetApp.flush();
    return { status: 'success', message: 'Setup selesai pada skema v' + SCHEMA_VERSION };
  } finally {
    lock.releaseLock();
  }
}
```

---

## 3. Boilerplate `code.gs` (CRUD Kanonik, Guard Admin, Anti-Null & `runDiagnostics`)

```javascript
/**
 * DEPLOY_MODE menentukan strategi verifikasi identitas admin:
 * - 'EXECUTE_AS_ME': Web app berjalan sebagai pemilik skrip.
 * - 'USER_ACCESSING': Web app berjalan sebagai pengguna yang mengakses.
 */
var DEPLOY_MODE = 'EXECUTE_AS_ME';
// Harus mencerminkan setting deployment Web App; PIN tidak boleh menjadi satu-satunya kontrol pada ANYONE.
var DEPLOY_ACCESS = 'ANYONE';
var ALLOWED_CATEGORIES = ['Operasional', 'Pemasaran', 'Infrastruktur', 'Lisensi'];
var ALLOWED_STATUSES = ['ACTIVE', 'PENDING', 'COMPLETED', 'ARCHIVED'];

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Gasly Web Application')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// ================= PRIVATE HELPERS (TERTUTUP DARI CLIENT KARENA AKHIRAN '_') =================

function formatIsoOffset_(dateObj) {
  var tz = Session.getScriptTimeZone() || DEFAULT_TZ;
  return Utilities.formatDate(dateObj || new Date(), tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function createResponse_(status, data, message, code, extraMeta) {
  var meta = {
    schemaVersion: PropertiesService.getScriptProperties().getProperty('SCHEMA_VERSION') || SCHEMA_VERSION,
    timestamp: formatIsoOffset_(new Date())
  };
  if (extraMeta) {
    Object.keys(extraMeta).forEach(function(k) { meta[k] = extraMeta[k]; });
  }
  return {
    status: status,
    data: data !== undefined ? sanitizeForClient_(data) : null,
    message: message || '',
    code: code || (status === 'success' ? 'OK' : 'INTERNAL_ERROR'),
    meta: meta
  };
}

function sanitizeForClient_(val) {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) {
    return formatIsoOffset_(val);
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeForClient_);
  }
  if (typeof val === 'object') {
    var out = {};
    Object.keys(val).forEach(function(k) { out[k] = sanitizeForClient_(val[k]); });
    return out;
  }
  return val;
}

function normalizeHeader_(h) {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/**
 * Hanya diterapkan pada field teks bebas (seperti title/catatan).
 * Jangan pernah dipanggil pada field numerik (agar angka negatif tidak berubah menjadi teks).
 */
function escapeFormula_(val) {
  if (typeof val !== 'string') return '';
  var trimmed = val.trim();
  if (/^[=+\-@]/.test(trimmed)) {
    return "'" + trimmed;
  }
  return trimmed;
}

/**
 * Verifikasi akses admin yang memperhitungkan DEPLOY_MODE.
 * Pada mode USER_ACCESSING, getActiveUser() === getEffectiveUser() selalu bernilai true,
 * sehingga verifikasi wajib membandingkan terhadap OWNER_EMAIL yang diatur manual atau PIN fallback yang dibatasi percobaan.
 */
function assertAdminAccess_(payload) {
  var props = PropertiesService.getScriptProperties();
  var ownerEmail = props.getProperty('OWNER_EMAIL') || '';
  var expectedPin = props.getProperty('ADMIN_PIN') || '';
  var activeEmail = '';
  var effectiveEmail = '';
  var cache = CacheService.getScriptCache();
  try {
    activeEmail = Session.getActiveUser().getEmail() || '';
    effectiveEmail = Session.getEffectiveUser().getEmail() || '';
  } catch (e) {}

  // Tidak ada bypass berdasarkan payload undefined/kosong. Identitas harus eksplisit.
  if (DEPLOY_MODE === 'EXECUTE_AS_ME' && activeEmail && effectiveEmail && activeEmail === effectiveEmail) {
    return { allowed: true };
  }
  if (DEPLOY_MODE === 'USER_ACCESSING' && activeEmail && ownerEmail && activeEmail === ownerEmail) {
    return { allowed: true };
  }

  if (!expectedPin || DEPLOY_ACCESS === 'ANYONE') {
    return {
      allowed: false,
      response: createResponse_('error', null,
        'Konfigurasi admin belum selesai. Isi OWNER_EMAIL secara manual di Script Properties atau gunakan deployment terbatas dengan ADMIN_PIN yang dikonfigurasi eksplisit.',
        'FORBIDDEN')
    };
  }

  // Rate limit best-effort per identitas (CacheService): 5 kegagalan mengunci 15 menit.
  var actor = (activeEmail || 'anonymous').replace(/[^a-z0-9_]/gi, '_').slice(0, 80);
  var failKey = 'GASLY_PIN_FAILS_' + actor;
  var lockKey = 'GASLY_PIN_LOCK_' + actor;
  if (cache.get(lockKey)) {
    return { allowed: false, response: createResponse_('error', null,
      'Percobaan PIN admin terkunci selama 15 menit.', 'FORBIDDEN') };
  }
  if (payload && payload.adminPin && String(payload.adminPin) === String(expectedPin)) {
    cache.remove(failKey);
    return { allowed: true };
  }
  var failures = Number(cache.get(failKey) || 0) + 1;
  cache.put(failKey, String(failures), 900);
  if (failures >= 5) {
    cache.put(lockKey, '1', 900);
    cache.remove(failKey);
    return { allowed: false, response: createResponse_('error', null,
      'Terlalu banyak percobaan PIN. Akses terkunci selama 15 menit.', 'FORBIDDEN') };
  }
  return { allowed: false, response: createResponse_('error', null,
    'Akses ditolak. PIN Admin tidak sesuai atau identitas tidak berwenang.', 'FORBIDDEN') };
}

/**
 * Membaca seluruh baris aktif tanpa memanggil initialSetupDatabase() secara diam-diam.
 * Mengembalikan objek { ok, records, errorResponse }.
 */
function readSheetObjects_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return {
      ok: false,
      records: [],
      errorResponse: createResponse_(
        'error',
        null,
        'Tabel ' + sheetName + ' belum diinisialisasi. Silakan jalankan initialSetupDatabase() di editor Apps Script.',
        'NOT_FOUND'
      )
    };
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) {
    return { ok: true, records: [], errorResponse: null };
  }

  var raw = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = raw[0].map(normalizeHeader_);
  var records = [];

  for (var r = 1; r < raw.length; r++) {
    var row = raw[r];
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) obj[headers[c]] = row[c];
    }
    if (obj.status !== 'ARCHIVED') {
      records.push(obj);
    }
  }
  return { ok: true, records: records, errorResponse: null };
}

function generateNextId_(sheet, prefix) {
  var tz = Session.getScriptTimeZone() || DEFAULT_TZ;
  var ymd = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  var fullPrefix = prefix + '-' + ymd + '-';
  var lastRow = sheet.getLastRow();
  var maxSeq = 0;

  if (lastRow > 1) {
    var idCol = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (var i = 0; i < idCol.length; i++) {
      var idStr = String(idCol[i][0] || '');
      if (idStr.indexOf(fullPrefix) === 0) {
        var tail = parseInt(idStr.slice(fullPrefix.length), 10);
        if (!isNaN(tail) && tail > maxSeq) maxSeq = tail;
      }
    }
  }
  return fullPrefix + ('0000' + (maxSeq + 1)).slice(-4);
}

function validateItemPayload_(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Data input tidak valid.';
  }
  var title = String(payload.title || '').trim();
  if (title.length < 3 || title.length > 120) {
    return 'Judul wajib diisi antara 3 hingga 120 karakter.';
  }
  var amountNum = Number(payload.amount);
  if (payload.amount === '' || payload.amount === null || payload.amount === undefined || !isFinite(amountNum) || amountNum < 0) {
    return 'Nominal harus berupa angka valid (>= 0).';
  }
  if (payload.category && ALLOWED_CATEGORIES.indexOf(String(payload.category)) === -1) {
    return 'Kategori tidak terdaftar dalam skema.';
  }
  if (payload.status && ALLOWED_STATUSES.indexOf(String(payload.status)) === -1) {
    return 'Status tidak terdaftar dalam skema.';
  }
  return null;
}

// ================= PUBLIC ENDPOINTS (IDENTIK DENGAN MOCK ENGINE) =================

function getBootstrapData() {
  try {
    var result = readSheetObjects_('ITEMS');
    if (!result.ok) return result.errorResponse;
    return createResponse_('success', { items: result.records }, 'Data berhasil dimuat.', 'OK');
  } catch (err) {
    console.error('getBootstrapData error:', err);
    return createResponse_('error', null, 'Gagal memuat data awal dari Spreadsheet.', 'INTERNAL_ERROR');
  }
}

function saveItem(payload) {
  var validationError = validateItemPayload_(payload);
  if (validationError) {
    return createResponse_('error', null, validationError, 'VALIDATION_ERROR');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk memproses transaksi lain. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('ITEMS');
    if (!sheet) {
      return createResponse_('error', null, 'Tabel ITEMS belum tersedia. Jalankan initialSetupDatabase() terlebih dahulu.', 'NOT_FOUND');
    }

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var nowIso = formatIsoOffset_(new Date());

    // Whitelist & sanitasi formula hanya pada field teks bebas
    var cleanTitle = escapeFormula_(String(payload.title).trim());
    var cleanCategory = escapeFormula_(String(payload.category || 'Operasional').trim());
    var cleanAmount = Number(payload.amount);
    var cleanStatus = String(payload.status || 'ACTIVE');

    if (payload.id) {
      if (!payload.updated_at) return createResponse_('error', null, 'updated_at wajib disertakan untuk mengubah data.', 'VALIDATION_ERROR');
      // Operasi UPDATE dengan pengecekan konflik updated_at (Optimistic Concurrency Control)
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        return createResponse_('error', null, 'Data yang akan diubah tidak ditemukan.', 'NOT_FOUND');
      }
      var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      var idColIdx = headers.indexOf('id');
      var updatedColIdx = headers.indexOf('updated_at');
      var targetRowIndex = -1;
      var existingRow = null;

      for (var r = 0; r < allData.length; r++) {
        if (String(allData[r][idColIdx]) === String(payload.id)) {
          targetRowIndex = r + 2;
          existingRow = allData[r];
          break;
        }
      }

      if (targetRowIndex === -1) {
        return createResponse_('error', null, 'Data dengan ID tersebut tidak ditemukan.', 'NOT_FOUND');
      }

      if (payload.updated_at && updatedColIdx >= 0) {
        var currentUpdated = sanitizeForClient_(existingRow[updatedColIdx]);
        if (String(currentUpdated) !== String(payload.updated_at)) {
          return createResponse_(
            'error',
            null,
            'Data ini baru saja diubah oleh pengguna lain. Muat ulang tabel sebelum menyimpan.',
            'CONFLICT'
          );
        }
      }

      var updatedRecord = {};
      var updatedRowArray = headers.map(function(h, idx) {
        var val = existingRow[idx];
        if (h === 'title') val = cleanTitle;
        else if (h === 'category') val = cleanCategory;
        else if (h === 'amount') val = cleanAmount;
        else if (h === 'status') val = cleanStatus;
        else if (h === 'updated_at') val = nowIso;
        updatedRecord[h] = val;
        return val;
      });

      sheet.getRange(targetRowIndex, 1, 1, lastCol).setValues([updatedRowArray]);
      SpreadsheetApp.flush();
      return createResponse_('success', updatedRecord, 'Data berhasil diperbarui.', 'OK');
    } else {
      // Operasi CREATE dengan pembuatan ID berurutan di dalam Lock
      var newId = generateNextId_(sheet, 'TRX');
      var newRecord = {
        id: newId,
        created_at: nowIso,
        updated_at: nowIso,
        title: cleanTitle,
        category: cleanCategory,
        amount: cleanAmount,
        status: cleanStatus,
        is_seed: 'FALSE'
      };
      var newRowArray = headers.map(function(h) {
        return newRecord[h] !== undefined ? newRecord[h] : '';
      });

      sheet.getRange(sheet.getLastRow() + 1, 1, 1, lastCol).setValues([newRowArray]);
      SpreadsheetApp.flush();
      return createResponse_('success', newRecord, 'Data baru berhasil disimpan.', 'OK');
    }
  } catch (err) {
    console.error('saveItem error:', err);
    return createResponse_('error', null, 'Gagal menyimpan data ke Spreadsheet.', 'INTERNAL_ERROR');
  } finally {
    lock.releaseLock();
  }
}

function deleteItem(payload) {
  if (!payload || !payload.id || !payload.updated_at) {
    return createResponse_('error', null, 'ID dan updated_at wajib disertakan untuk menghapus data.', 'VALIDATION_ERROR');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('ITEMS');
    if (!sheet || sheet.getLastRow() <= 1) {
      return createResponse_('error', null, 'Data tidak ditemukan.', 'NOT_FOUND');
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var idIdx = headers.indexOf('id');
    var statusIdx = headers.indexOf('status');
    var updatedIdx = headers.indexOf('updated_at');
    var targetRowIndex = -1;
    var existingRow = null;

    for (var r = 0; r < allData.length; r++) {
      if (String(allData[r][idIdx]) === String(payload.id)) {
        targetRowIndex = r + 2;
        existingRow = allData[r];
        break;
      }
    }

    if (targetRowIndex === -1) {
      return createResponse_('error', null, 'Data yang akan dihapus tidak ditemukan.', 'NOT_FOUND');
    }

    if (payload.updated_at && updatedIdx >= 0) {
      var currentUpdated = sanitizeForClient_(existingRow[updatedIdx]);
      if (String(currentUpdated) !== String(payload.updated_at)) {
        return createResponse_('error', null, 'Data telah berubah. Muat ulang sebelum menghapus.', 'CONFLICT');
      }
    }

    var nowIso = formatIsoOffset_(new Date());
    if (statusIdx >= 0) existingRow[statusIdx] = 'ARCHIVED';
    if (updatedIdx >= 0) existingRow[updatedIdx] = nowIso;

    sheet.getRange(targetRowIndex, 1, 1, lastCol).setValues([existingRow]);
    SpreadsheetApp.flush();
    return createResponse_('success', { id: payload.id, status: 'ARCHIVED' }, 'Data berhasil diarsipkan.', 'OK');
  } catch (err) {
    console.error('deleteItem error:', err);
    return createResponse_('error', null, 'Gagal mengarsipkan data.', 'INTERNAL_ERROR');
  } finally {
    lock.releaseLock();
  }
}

function purgeSeedData(payload) {
  var auth = assertAdminAccess_(payload);
  if (!auth.allowed) return auth.response;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk. Coba beberapa saat lagi.', 'LOCK_TIMEOUT');
  }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var removedCount = 0;
    var deletionPlan = [];
    Object.keys(DB_SCHEMAS).forEach(function(sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() <= 1) return;
      var data = sheet.getDataRange().getValues();
      var headers = data[0].map(normalizeHeader_);
      var idIdx = headers.indexOf('id');
      var seedIdx = headers.indexOf('is_seed');
      var indexes = [];
      for (var r = 1; r < data.length; r++) {
        var idVal = idIdx >= 0 ? String(data[r][idIdx] || '') : '';
        var seedVal = seedIdx >= 0 ? String(data[r][seedIdx] || '').toUpperCase() : '';
        if (idVal.indexOf('SEED-') === 0 || seedVal === 'TRUE') indexes.push(r + 1);
      }
      if (indexes.length) deletionPlan.push({ sheet: sheet, rows: indexes });
      removedCount += indexes.length;
    });
    var MAX_PURGE_ROWS_PER_RUN = 500;
    if (removedCount > MAX_PURGE_ROWS_PER_RUN) {
      return createResponse_('error', null,
        'Pembersihan melebihi batas ' + MAX_PURGE_ROWS_PER_RUN + ' baris per eksekusi.',
        'VALIDATION_ERROR');
    }
    deletionPlan.forEach(function(plan) {
      // Hapus blok baris berurutan dari bawah agar indeks yang tersisa tetap valid.
      var rows = plan.rows;
      var endRow = rows[rows.length - 1];
      var startRow = endRow;
      for (var i = rows.length - 2; i >= 0; i--) {
        if (rows[i] === startRow - 1) {
          startRow = rows[i];
        } else {
          plan.sheet.deleteRows(startRow, endRow - startRow + 1);
          endRow = rows[i];
          startRow = rows[i];
        }
      }
      plan.sheet.deleteRows(startRow, endRow - startRow + 1);
    });
    SpreadsheetApp.flush();
    return createResponse_('success', { removedCount: removedCount }, removedCount + ' data simulasi berhasil dibersihkan.', 'OK');
  } catch (err) {
    console.error('purgeSeedData error:', err);
    return createResponse_('error', null, 'Gagal membersihkan data simulasi.', 'INTERNAL_ERROR');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Fungsi diagnostik mandiri. Dilindungi oleh assertAdminAccess_ agar tidak membocorkan
 * struktur sheet bila dipanggil oleh non-admin dari console browser.
 */
function runDiagnostics(payload) {
  try {
    var auth = assertAdminAccess_(payload);
    if (!auth.allowed) return auth.response;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var report = {
      schemaVersion: PropertiesService.getScriptProperties().getProperty('SCHEMA_VERSION') || 'UNSET',
      sheets: {},
      ok: true
    };
    Object.keys(DB_SCHEMAS).forEach(function(sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        report.sheets[sheetName] = { exists: false, missingHeaders: DB_SCHEMAS[sheetName] };
        report.ok = false;
        return;
      }
      var actual = sheet.getLastColumn() > 0
        ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader_)
        : [];
      var missing = DB_SCHEMAS[sheetName].filter(function(h) { return actual.indexOf(h) === -1; });
      report.sheets[sheetName] = { exists: true, rowCount: Math.max(0, sheet.getLastRow() - 1), missingHeaders: missing };
      if (missing.length > 0) report.ok = false;
    });
    console.log('DIAGNOSTICS REPORT:', JSON.stringify(report, null, 2));
    return createResponse_('success', report, 'Diagnostik selesai.', 'OK');
  } catch (err) {
    console.error('runDiagnostics error:', err);
    return createResponse_('error', null, 'Diagnostik gagal dijalankan.', 'INTERNAL_ERROR');
  }
}
```

---

## 4. Boilerplate `index.html` (Universal Sandbox Guard, Mock Identik & Anti-XSS)

```javascript
// 1. Sanitasi String HTML (Mencegah XSS saat memakai String Concatenation)
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 2. Helper Waktu dengan Offset Zona Waktu Lokal (Konsisten dengan "yyyy-MM-dd'T'HH:mm:ssXXX" di Server)
function pad2_(n) {
  return ('0' + Math.floor(Math.abs(n))).slice(-2);
}

function formatLocalIso_(dateObj) {
  var d = dateObj instanceof Date ? dateObj : new Date();
  var tzOffsetMin = -d.getTimezoneOffset();
  var sign = tzOffsetMin >= 0 ? '+' : '-';
  var offH = pad2_(Math.floor(Math.abs(tzOffsetMin) / 60));
  var offM = pad2_(Math.abs(tzOffsetMin) % 60);
  return (
    d.getFullYear() + '-' +
    pad2_(d.getMonth() + 1) + '-' +
    pad2_(d.getDate()) + 'T' +
    pad2_(d.getHours()) + ':' +
    pad2_(d.getMinutes()) + ':' +
    pad2_(d.getSeconds()) +
    sign + offH + ':' + offM
  );
}

function formatLocalYmd_(dateObj) {
  var d = dateObj instanceof Date ? dateObj : new Date();
  return String(d.getFullYear()) + pad2_(d.getMonth() + 1) + pad2_(d.getDate());
}

// 3. Pemformatan Mata Uang & Tanggal yang Tidak Menyembunyikan Data Rusak sebagai "Rp 0"
var IDR_FORMATTER = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
var DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

function formatCurrency(val) {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') {
    return '-';
  }
  var n = Number(val);
  if (!Number.isFinite(n)) {
    return 'Data tidak valid';
  }
  return IDR_FORMATTER.format(n);
}

function formatDateDisplay(isoStr) {
  if (!isoStr) return '-';
  var d = new Date(isoStr);
  return isNaN(d.getTime()) ? escapeHtml(isoStr) : DATE_FORMATTER.format(d);
}

// 4. Deteksi Lingkungan & Penyimpanan Sandbox Memori (+ Optional Safe Storage)
var IS_GAS_ENV = (typeof google !== 'undefined' && google.script && google.script.run);
var STORAGE_KEY = 'GASLY_SANDBOX_STATE_V2';
var MOCK_DB = null;
var ALLOWED_CATEGORIES = ['Operasional', 'Pemasaran', 'Infrastruktur', 'Lisensi'];
var ALLOWED_STATUSES = ['ACTIVE', 'PENDING', 'COMPLETED', 'ARCHIVED'];

function generateMockNextId_(items, prefix, ymd) {
  var fullPrefix = prefix + '-' + ymd + '-';
  var maxSeq = 0;
  for (var i = 0; i < items.length; i++) {
    var idStr = String((items[i] && items[i].id) || '');
    if (idStr.indexOf(fullPrefix) === 0) {
      var tail = parseInt(idStr.slice(fullPrefix.length), 10);
      if (!isNaN(tail) && tail > maxSeq) maxSeq = tail;
    }
  }
  return fullPrefix + ('0000' + (maxSeq + 1)).slice(-4);
}

function createInitialMockDb_() {
  var now = new Date();
  var offsets = [0, 0, 1, 3, 6, 12, 20];
  var seqByDay = {};
  var items = [];
  for (var i = 0; i < offsets.length; i++) {
    var d = new Date(now.getTime() - offsets[i] * 86400000);
    var iso = formatLocalIso_(d);
    var ymd = formatLocalYmd_(d);
    seqByDay[ymd] = (seqByDay[ymd] || 0) + 1;
    var seqStr = ('0000' + seqByDay[ymd]).slice(-4);
    items.push({
      id: 'SEED-' + ymd + '-' + seqStr,
      created_at: iso,
      updated_at: iso,
      title: 'Simulasi Transaksi #' + (i + 1),
      category: ALLOWED_CATEGORIES[i % ALLOWED_CATEGORIES.length],
      amount: (i + 1) * 125000,
      status: i % 3 === 0 ? 'PENDING' : 'COMPLETED',
      is_seed: 'TRUE'
    });
  }
  return { items: items, adminConfigured: false };
}

function getMockDb_() {
  if (MOCK_DB) return MOCK_DB;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        MOCK_DB = JSON.parse(saved);
        return MOCK_DB;
      }
    }
  } catch (err) {
    // Abaikan jika iframe sandbox memblokir localStorage; gunakan state memori
  }
  MOCK_DB = createInitialMockDb_();
  return MOCK_DB;
}

function saveMockDb_(db) {
  MOCK_DB = db;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
  } catch (err) {}
}

window.resetPreviewData = function() {
  MOCK_DB = createInitialMockDb_();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {}
  if (typeof window.loadInitialData === 'function') {
    window.loadInitialData();
  }
  if (typeof window.showToast === 'function') {
    window.showToast('Data simulasi preview berhasil di-reset ke kondisi awal.', 'info');
  }
};

// Konfigurasi autentikasi preview bersifat opt-in; tidak ada PIN/kredensial bawaan.
window.configurePreviewAdmin = function(pin) {
  if (typeof pin !== 'string' || pin.trim().length < 8) return false;
  var db = getMockDb_();
  db.adminPin = pin;
  db.adminConfigured = true;
  db.adminFailedCount = 0;
  db.adminLockUntil = 0;
  saveMockDb_(db);
  return true;
};

// 5. Handler Simulasi Mock dengan Validasi, Cek Konflik, & Kode Error Identik Server
function handleMockAction_(actionName, payload, onSuccess, onError) {
  var db = getMockDb_();
  var now = new Date();
  var nowIso = formatLocalIso_(now);
  var ymd = formatLocalYmd_(now);

  function makeEnv(status, data, message, code) {
    return {
      status: status,
      data: data,
      message: message,
      code: code,
      meta: { schemaVersion: '1.0.0', timestamp: nowIso, sandbox: true }
    };
  }

  function authorizeMockAdmin_() {
    if (!db.adminConfigured || !db.adminPin) {
      return { allowed: false, message: 'Konfigurasi admin belum selesai. Atur autentikasi simulasi secara eksplisit.' };
    }
    if (Number(db.adminLockUntil || 0) > now.getTime()) {
      return { allowed: false, message: 'Percobaan autentikasi simulasi terkunci selama 15 menit.' };
    }
    if (payload && payload.adminPin && String(payload.adminPin) === String(db.adminPin)) {
      db.adminFailedCount = 0;
      db.adminLockUntil = 0;
      saveMockDb_(db);
      return { allowed: true };
    }
    db.adminFailedCount = Number(db.adminFailedCount || 0) + 1;
    if (db.adminFailedCount >= 5) {
      db.adminFailedCount = 0;
      db.adminLockUntil = now.getTime() + 15 * 60 * 1000;
      saveMockDb_(db);
      return { allowed: false, message: 'Terlalu banyak percobaan autentikasi simulasi. Akses terkunci 15 menit.' };
    }
    saveMockDb_(db);
    return { allowed: false, message: 'Autentikasi simulasi tidak valid.' };
  }

  if (actionName === 'getBootstrapData') {
    var activeItems = db.items.filter(function(it) { return it.status !== 'ARCHIVED'; });
    return onSuccess(makeEnv('success', { items: activeItems }, 'Data simulasi dimuat.', 'OK'));
  }

  if (actionName === 'saveItem') {
    if (!payload || typeof payload !== 'object') {
      return onError(makeEnv('error', null, 'Data input tidak valid.', 'VALIDATION_ERROR'));
    }
    var title = String(payload.title || '').trim();
    if (title.length < 3 || title.length > 120) {
      return onError(makeEnv('error', null, 'Judul wajib diisi antara 3 hingga 120 karakter.', 'VALIDATION_ERROR'));
    }
    var amountNum = Number(payload.amount);
    if (payload.amount === '' || payload.amount === null || payload.amount === undefined || !Number.isFinite(amountNum) || amountNum < 0) {
      return onError(makeEnv('error', null, 'Nominal harus berupa angka valid (>= 0).', 'VALIDATION_ERROR'));
    }
    if (payload.category && ALLOWED_CATEGORIES.indexOf(String(payload.category)) === -1) {
      return onError(makeEnv('error', null, 'Kategori tidak terdaftar dalam skema.', 'VALIDATION_ERROR'));
    }
    if (payload.status && ALLOWED_STATUSES.indexOf(String(payload.status)) === -1) {
      return onError(makeEnv('error', null, 'Status tidak terdaftar dalam skema.', 'VALIDATION_ERROR'));
    }

    if (payload.id) {
      if (!payload.updated_at) return onError(makeEnv('error', null, 'updated_at wajib disertakan untuk mengubah data.', 'VALIDATION_ERROR'));
      var idx = -1;
      for (var i = 0; i < db.items.length; i++) {
        if (db.items[i].id === payload.id) { idx = i; break; }
      }
      if (idx === -1) {
        return onError(makeEnv('error', null, 'Data dengan ID tersebut tidak ditemukan.', 'NOT_FOUND'));
      }
      if (payload.updated_at && String(db.items[idx].updated_at) !== String(payload.updated_at)) {
        return onError(makeEnv('error', null, 'Data ini baru saja diubah oleh pengguna lain. Muat ulang tabel sebelum menyimpan.', 'CONFLICT'));
      }
      db.items[idx].title = title;
      db.items[idx].category = payload.category || db.items[idx].category;
      db.items[idx].amount = amountNum;
      db.items[idx].status = payload.status || db.items[idx].status;
      db.items[idx].updated_at = nowIso;
      saveMockDb_(db);
      return onSuccess(makeEnv('success', db.items[idx], 'Data berhasil diperbarui (Simulasi).', 'OK'));
    } else {
      var newId = generateMockNextId_(db.items, 'TRX', ymd);
      var newRecord = {
        id: newId,
        created_at: nowIso,
        updated_at: nowIso,
        title: title,
        category: payload.category || 'Operasional',
        amount: amountNum,
        status: payload.status || 'ACTIVE',
        is_seed: 'FALSE'
      };
      db.items.unshift(newRecord);
      saveMockDb_(db);
      return onSuccess(makeEnv('success', newRecord, 'Data baru berhasil disimpan (Simulasi).', 'OK'));
    }
  }

  if (actionName === 'deleteItem') {
    if (!payload || !payload.id || !payload.updated_at) {
      return onError(makeEnv('error', null, 'ID dan updated_at wajib disertakan untuk menghapus data.', 'VALIDATION_ERROR'));
    }
    var foundIdx = -1;
    for (var j = 0; j < db.items.length; j++) {
      if (db.items[j].id === payload.id) { foundIdx = j; break; }
    }
    if (foundIdx === -1) {
      return onError(makeEnv('error', null, 'Data yang akan dihapus tidak ditemukan.', 'NOT_FOUND'));
    }
    if (payload.updated_at && String(db.items[foundIdx].updated_at) !== String(payload.updated_at)) {
      return onError(makeEnv('error', null, 'Data telah berubah. Muat ulang sebelum menghapus.', 'CONFLICT'));
    }
    db.items[foundIdx].status = 'ARCHIVED';
    db.items[foundIdx].updated_at = nowIso;
    saveMockDb_(db);
    return onSuccess(makeEnv('success', { id: payload.id, status: 'ARCHIVED' }, 'Data berhasil diarsipkan (Simulasi).', 'OK'));
  }

  if (actionName === 'purgeSeedData') {
    var mockAuth = authorizeMockAdmin_();
    if (!mockAuth.allowed) {
      return onError(makeEnv('error', null, mockAuth.message, 'FORBIDDEN'));
    }
    var beforeCount = db.items.length;
    db.items = db.items.filter(function(it) {
      return String(it.id).indexOf('SEED-') !== 0 && it.is_seed !== 'TRUE';
    });
    var removed = beforeCount - db.items.length;
    saveMockDb_(db);
    return onSuccess(makeEnv('success', { removedCount: removed }, removed + ' data simulasi berhasil dibersihkan.', 'OK'));
  }

  if (actionName === 'runDiagnostics') {
    var mockAuth = authorizeMockAdmin_();
    if (!mockAuth.allowed) {
      return onError(makeEnv('error', null, mockAuth.message, 'FORBIDDEN'));
    }
    return onSuccess(makeEnv('success', { ok: true, mode: 'sandbox' }, 'Diagnostik simulasi selesai.', 'OK'));
  }

  return onError(makeEnv('error', null, 'Action mock belum terdaftar: ' + actionName, 'INTERNAL_ERROR'));
}

// 6. Jembatan RPC Tunggal (callServer) dengan Pengecekan Fungsi & Try/Catch
function callServer(actionName, payload, onSuccess, onError) {
  var safeSuccess = typeof onSuccess === 'function' ? onSuccess : function() {};
  var safeError = typeof onError === 'function' ? onError : function(err) {
    if (typeof window.showToast === 'function') {
      window.showToast((err && err.message) || 'Terjadi kesalahan sistem.', 'error');
    }
  };

  if (IS_GAS_ENV) {
    var runner = google.script.run
      .withSuccessHandler(function(res) {
        if (!res) {
          safeError({
            status: 'error',
            data: null,
            message: 'Respon server kosong (pastikan seluruh objek Date sudah diserialisasi di code.gs).',
            code: 'INTERNAL_ERROR'
          });
          return;
        }
        if (res.status === 'success') {
          safeSuccess(res);
        } else {
          safeError(res);
        }
      })
      .withFailureHandler(function(err) {
        safeError({
          status: 'error',
          data: null,
          message: 'Koneksi ke Google Apps Script gagal. Periksa izin deployment.',
          code: 'INTERNAL_ERROR'
        });
      });

    if (typeof runner[actionName] !== 'function') {
      safeError({
        status: 'error',
        data: null,
        message: 'Fungsi server tidak tersedia: ' + actionName,
        code: 'INTERNAL_ERROR'
      });
      return;
    }

    try {
      if (payload !== undefined) {
        runner[actionName](payload);
      } else {
        runner[actionName]();
      }
    } catch (invokeErr) {
      safeError({
        status: 'error',
        data: null,
        message: 'Gagal mengeksekusi panggilan server: ' + actionName,
        code: 'INTERNAL_ERROR'
      });
    }
  } else {
    setTimeout(function() {
      handleMockAction_(actionName, payload, safeSuccess, safeError);
    }, 220);
  }
}

// 7. Injeksi Otomatis Badge Sandbox Preview (Ditempatkan di kiri-bawah, sedangkan Toast di kanan-atas agar tidak bertabrakan di layar mobile)
function mountSandboxPreviewBanner() {
  if (IS_GAS_ENV) return;
  if (document.getElementById('gasly-sandbox-banner')) return;

  var banner = document.createElement('div');
  banner.id = 'gasly-sandbox-banner';
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:9990;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:9999px;background:#18181B;color:#F4F4F5;border:1px solid rgba(99,102,241,0.5);font-size:12px;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.35);max-width:calc(100vw - 24px);';
  banner.innerHTML =
    '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#F59E0B;flex-shrink:0;"></span>' +
    '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong>Preview Mode</strong> (Simulasi)</span>' +
    '<button type="button" onclick="window.resetPreviewData()" ' +
    'style="margin-left:4px;padding:3px 8px;border-radius:9999px;background:#4F46E5;color:#FFFFFF;border:none;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0;">' +
    'Reset data preview</button>';
  document.body.appendChild(banner);
}
```