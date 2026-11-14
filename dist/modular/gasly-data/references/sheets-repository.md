<!-- KB_VERSION: 2.1.0 -->
# GOOGLE SHEETS REPOSITORY, LOCKING & IDEMPOTENCY (`gas/sheets-repository.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-data`.

## Daftar Isi
1. [Aturan Repositori Sheets & Idempotensi Mutasi](#1-aturan-repositori-sheets--idempotensi-mutasi)
2. [Boilerplate `sheets.gs` (CRUD Batch, LockService, Daily ID & Diagnostics)](#2-boilerplate-sheetsgs-crud-batch-lockservice-daily-id--diagnostics)

---

## 1. Aturan Repositori Sheets & Idempotensi Mutasi

1. **Idempotensi Berbasis `CacheService`:**
   Setiap aksi mutasi (`items.create`, `items.update`, `items.delete`, `file.upload`, `webhook.receive`) memeriksa kunci `idem:<action>:<idemKey>` sebelum menyentuh `LockService` dan menyimpan hasil sukses selama 10 menit (`600` detik).
2. **Urutan Kanonik di Dalam Lock:**
   Validasi payload & whitelist field $\rightarrow$ sanitasi `escapeFormula_()` hanya pada field teks bebas $\rightarrow$ `lock.tryLock(10000)` (`LOCK_TIMEOUT`) $\rightarrow$ baca data batch $\rightarrow$ cek `updated_at` (`CONFLICT`) $\rightarrow$ hitung ID harian `maxSeq + 1` (untuk create) $\rightarrow$ tulis batch `setValues()` $\rightarrow$ `SpreadsheetApp.flush()` $\rightarrow$ `lock.releaseLock()` di `finally`.

---

## 2. Boilerplate `sheets.gs` (CRUD Batch, LockService, Daily ID & Diagnostics)

```javascript
// FILE: sheets.gs
// Runtime: Google Apps Script V8

var ALLOWED_CATEGORIES = ['Operasional', 'Pemasaran', 'Infrastruktur', 'Lisensi'];
var ALLOWED_STATUSES = ['ACTIVE', 'PENDING', 'COMPLETED', 'ARCHIVED'];

function normalizeHeader_(h) {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/**
 * Applies formula-injection guard strictly to free-text fields.
 * Never call on numeric fields so negative numbers remain valid Numbers.
 */
function escapeFormula_(val) {
  if (typeof val !== 'string') return '';
  var trimmed = val.trim();
  if (/^[=+\-@]/.test(trimmed)) {
    return "'" + trimmed;
  }
  return trimmed;
}

function getIdempotentResponse_(action, idemKey) {
  var raw = cacheGetChunked_('idem:' + action + ':' + idemKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveIdempotentResponse_(action, idemKey, envelope) {
  try {
    cachePutChunked_('idem:' + action + ':' + idemKey, JSON.stringify(envelope), 600);
  } catch (e) {}
}

/**
 * Reads active records from a sheet without calling initialSetupDatabase().
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
        'Tabel ' + sheetName + ' belum diinisialisasi. Jalankan initialSetupDatabase() di editor Apps Script.',
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

/**
 * Generates daily sequential ID ([PREFIX]-YYYYMMDD-0001) inside LockService
 * by scanning the maximum sequence number for the current date.
 */
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
    return 'Payload data tidak valid.';
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

function handleItemsList_(req) {
  var result = readSheetObjects_('ITEMS');
  if (!result.ok) return result.errorResponse;
  return createResponse_('success', { items: result.records }, 'Daftar data berhasil dimuat.', 'OK');
}

function handleItemsGet_(req) {
  var targetId = String(req.payload.id || '').trim();
  if (!targetId) {
    return createResponse_('error', null, 'ID data wajib disertakan.', 'VALIDATION_ERROR');
  }
  var result = readSheetObjects_('ITEMS');
  if (!result.ok) return result.errorResponse;

  for (var i = 0; i < result.records.length; i++) {
    if (String(result.records[i].id) === targetId) {
      return createResponse_('success', { item: result.records[i] }, 'Data ditemukan.', 'OK');
    }
  }
  return createResponse_('error', null, 'Data dengan ID tersebut tidak ditemukan.', 'NOT_FOUND');
}

function handleItemsCreate_(req) {
  var err = validateItemPayload_(req.payload);
  if (err) return createResponse_('error', null, err, 'VALIDATION_ERROR');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk memproses transaksi lain. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('ITEMS');
    if (!sheet) {
      return createResponse_('error', null, 'Tabel ITEMS belum diinisialisasi.', 'NOT_FOUND');
    }

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var nowIso = formatIsoOffset_(new Date());
    var newId = generateNextId_(sheet, 'TRX');

    var newRecord = {
      id: newId,
      created_at: nowIso,
      updated_at: nowIso,
      title: escapeFormula_(String(req.payload.title).trim()),
      category: escapeFormula_(String(req.payload.category || 'Operasional').trim()),
      amount: Number(req.payload.amount),
      status: String(req.payload.status || 'ACTIVE'),
      file_id: '',
      file_url: '',
      is_seed: 'FALSE'
    };

    var rowValues = headers.map(function(h) {
      return newRecord[h] !== undefined ? newRecord[h] : '';
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, 1, lastCol).setValues([rowValues]);
    SpreadsheetApp.flush();
    return createResponse_('success', { item: newRecord }, 'Data baru berhasil disimpan.', 'OK');
  } finally {
    lock.releaseLock();
  }
}

function handleItemsUpdate_(req) {
  var targetId = String(req.payload.id || '').trim();
  if (!targetId) {
    return createResponse_('error', null, 'ID data wajib disertakan untuk pembaruan.', 'VALIDATION_ERROR');
  }
  var err = validateItemPayload_(req.payload);
  if (err) return createResponse_('error', null, err, 'VALIDATION_ERROR');

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
    var updatedIdx = headers.indexOf('updated_at');
    var targetRowNumber = -1;
    var existingRow = null;

    for (var r = 0; r < allData.length; r++) {
      if (String(allData[r][idIdx]) === targetId) {
        targetRowNumber = r + 2;
        existingRow = allData[r];
        break;
      }
    }

    if (targetRowNumber === -1) {
      return createResponse_('error', null, 'Data dengan ID tersebut tidak ditemukan.', 'NOT_FOUND');
    }

    if (req.payload.updated_at && updatedIdx >= 0) {
      var currentUpdated = sanitizeForClient_(existingRow[updatedIdx]);
      if (String(currentUpdated) !== String(req.payload.updated_at)) {
        return createResponse_(
          'error',
          null,
          'Data ini telah diubah oleh pengguna lain. Muat ulang data sebelum menyimpan.',
          'CONFLICT'
        );
      }
    }

    var nowIso = formatIsoOffset_(new Date());
    var cleanTitle = escapeFormula_(String(req.payload.title).trim());
    var cleanCategory = escapeFormula_(String(req.payload.category || 'Operasional').trim());
    var cleanAmount = Number(req.payload.amount);
    var cleanStatus = String(req.payload.status || 'ACTIVE');

    var updatedObj = {};
    var updatedRow = headers.map(function(h, idx) {
      var val = existingRow[idx];
      if (h === 'title') val = cleanTitle;
      else if (h === 'category') val = cleanCategory;
      else if (h === 'amount') val = cleanAmount;
      else if (h === 'status') val = cleanStatus;
      else if (h === 'updated_at') val = nowIso;
      updatedObj[h] = val;
      return val;
    });

    sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([updatedRow]);
    SpreadsheetApp.flush();
    return createResponse_('success', { item: updatedObj }, 'Data berhasil diperbarui.', 'OK');
  } finally {
    lock.releaseLock();
  }
}

function handleItemsDelete_(req) {
  var targetId = String(req.payload.id || '').trim();
  if (!targetId) {
    return createResponse_('error', null, 'ID data wajib disertakan untuk penghapusan.', 'VALIDATION_ERROR');
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
    var targetRowNumber = -1;
    var existingRow = null;

    for (var r = 0; r < allData.length; r++) {
      if (String(allData[r][idIdx]) === targetId) {
        targetRowNumber = r + 2;
        existingRow = allData[r];
        break;
      }
    }

    if (targetRowNumber === -1) {
      return createResponse_('error', null, 'Data yang akan diarsipkan tidak ditemukan.', 'NOT_FOUND');
    }

    if (req.payload.updated_at && updatedIdx >= 0) {
      var currentUpdated = sanitizeForClient_(existingRow[updatedIdx]);
      if (String(currentUpdated) !== String(req.payload.updated_at)) {
        return createResponse_('error', null, 'Data telah berubah. Muat ulang sebelum menghapus.', 'CONFLICT');
      }
    }

    var nowIso = formatIsoOffset_(new Date());
    if (statusIdx >= 0) existingRow[statusIdx] = 'ARCHIVED';
    if (updatedIdx >= 0) existingRow[updatedIdx] = nowIso;

    sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([existingRow]);
    SpreadsheetApp.flush();
    return createResponse_('success', { id: targetId, status: 'ARCHIVED' }, 'Data berhasil diarsipkan.', 'OK');
  } finally {
    lock.releaseLock();
  }
}

function handleAdminPurgeSeed_(req) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var removedCount = 0;
    Object.keys(DB_SCHEMAS).forEach(function(sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() <= 1) return;
      var data = sheet.getDataRange().getValues();
      var headers = data[0].map(normalizeHeader_);
      var idIdx = headers.indexOf('id');
      var seedIdx = headers.indexOf('is_seed');

      for (var r = data.length - 1; r >= 1; r--) {
        var idVal = idIdx >= 0 ? String(data[r][idIdx] || '') : '';
        var seedVal = seedIdx >= 0 ? String(data[r][seedIdx] || '').toUpperCase() : '';
        if (idVal.indexOf('SEED-') === 0 || seedVal === 'TRUE') {
          sheet.deleteRow(r + 1);
          removedCount++;
        }
      }
    });
    SpreadsheetApp.flush();
    return createResponse_('success', { removedCount: removedCount }, removedCount + ' baris data simulasi dibersihkan.', 'OK');
  } finally {
    lock.releaseLock();
  }
}

function buildDiagnosticsReport_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  var report = {
    schemaVersion: props.getProperty('SCHEMA_VERSION') || 'UNSET',
    accessProfile: props.getProperty('ACCESS_PROFILE') || ACCESS_PROFILE,
    hasHmacSecret: Boolean(props.getProperty('AUTH_HMAC_SECRET')),
    hasAdminHash: Boolean(props.getProperty('ADMIN_PASSPHRASE_HASH')),
    hasDriveRoot: Boolean(props.getProperty('DRIVE_ROOT_FOLDER_ID')),
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
    report.sheets[sheetName] = {
      exists: true,
      rowCount: Math.max(0, sheet.getLastRow() - 1),
      missingHeaders: missing
    };
    if (missing.length > 0) report.ok = false;
  });
  return report;
}

function handleAdminDiagnostics_(req) {
  return createResponse_('success', buildDiagnosticsReport_(), 'Diagnostik selesai.', 'OK');
}

/**
 * Public function for the GAS IDE "Run" toolbar.
 * Only executes when invoked directly in the editor (where argument is undefined).
 */
function runDiagnostics(fromClient) {
  if (fromClient !== undefined) {
    throw new Error('Use action "admin.diagnostics" with an ADMIN session token.');
  }
  var report = buildDiagnosticsReport_();
  console.log('DIAGNOSTICS REPORT:', JSON.stringify(report, null, 2));
  return report;
}
```