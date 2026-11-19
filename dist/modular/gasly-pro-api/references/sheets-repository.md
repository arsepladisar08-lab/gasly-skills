<!-- KB_VERSION: 2.1.0 -->
# GOOGLE SHEETS REPOSITORY, LOCKING & IDEMPOTENCY (`gas/sheets-repository.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-data`.

## Daftar Isi
1. [Aturan Repositori Sheets & Idempotensi Mutasi](#1-aturan-repositori-sheets--idempotensi-mutasi)
2. [Boilerplate `sheets.gs` (CRUD Batch, Delta Concurrency, Anti-Enum Lookup & Diagnostics)](#2-boilerplate-sheetsgs-crud-batch-delta-concurrency-anti-enum-lookup--diagnostics)

---

## 1. Aturan Repositori Sheets & Idempotensi Mutasi

1. **Idempotensi Berbasis `CacheService` (Double-Checked Inside Lock):**
   Setiap aksi mutasi (`items.create`, `items.update`, `items.mutateDelta`, `items.delete`, `file.upload`, `webhook.receive`) memeriksa kunci `idem:<action>:<idemKey>` sebelum menyentuh `LockService`, memeriksanya kembali setelah `tryLock(10000)` berhasil diperoleh, dan menyimpan hasil sukses selama 10 menit (`600` detik).
2. **Pemisahan Konkurensi: Mutasi Timpa Mutlak (*Overwrite*) vs Mutasi Tambah/Kurang (*Delta* — `Gate G-11`):**
   - **Operasi Timpa Mutlak (`items.update`, `items.delete`, koreksi opname `ADJUST`, keputusan approval):** Wajib memeriksa kecocokan `payload.updated_at` (atau `expected_updated_at`) terhadap nilai `updated_at` saat ini di baris Sheet (`CONFLICT` bila berbeda).
   - **Operasi Mutasi Delta (`IN` / `OUT` stok gudang, kuota antrean harian):** Karena eksekusi sudah diserialkan satu per satu di dalam `LockService.getScriptLock()`, server membaca saldo terbaru langsung dari baris Sheet di dalam lock, menghitung `saldo_akhir = saldo_sekarang + delta`, dan memvalidasi `saldo_akhir >= 0` (`VALIDATION_ERROR` bila stok/kuota tidak cukup) **tanpa** memblokir transaksi dengan error `CONFLICT` hanya karena `updated_at` berubah oleh staf lain beberapa milidetik sebelumnya.
3. **Anti-Enumerasi pada Pelacakan Publik (`Gate G-10`):**
   - Apabila aplikasi menyediakan fitur lacak status publik tanpa login (`*.track` atau `*.lookupPublic`), dilarang hanya mengandalkan ID urut harian (`SUB-YYYYMMDD-0001`) + 4 digit nomor telepon/WhatsApp.
   - Saat baris dibuat, terbitkan kolom internal `tracking_token` menggunakan `Utilities.getUuid()`, sembunyikan kolom `tracking_token` dari `*.list`/`*.get` publik, wajibkan verifikasi `constantTimeEqual_()`, dan pasang *rate-limit* di `CacheService` (maksimal 5 percobaan gagal per 15 menit per ID tiket + batas global 30 permintaan/menit).
4. **Cek Ekuivalensi Kolom Sebelum Migrasi (`Gate G-12`):**
   - Ketika pengguna meminta penambahan field/kolom baru, periksa daftar kolom di `DB_SCHEMAS` terlebih dahulu. Jika sudah terdapat kolom dengan fungsi semantik yang sama (contoh: meminta `lokasi_rak` padahal sudah ada `storage_rack`), gunakan kolom yang sudah ada tanpa menduplikasi kolom di Sheet.

---

## 2. Boilerplate `sheets.gs` (CRUD Batch, Delta Concurrency, Anti-Enum Lookup & Diagnostics)

```javascript
// FILE: sheets.gs
// Runtime: Google Apps Script V8

var ALLOWED_CATEGORIES = ['Operasional', 'Pemasaran', 'Infrastruktur', 'Lisensi'];
var ALLOWED_STATUSES = ['ACTIVE', 'PENDING', 'COMPLETED', 'ARCHIVED'];
var HIDDEN_SECURITY_COLUMNS_ = [
  'upload_nonce',
  'tracking_token',
  'password_salt',
  'password_hash',
  'pin_salt',
  'pin_hash'
];

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
  if (/^[=+\-@\t\r\n]/.test(trimmed)) {
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
 * Automatically strips internal security columns (upload_nonce, tracking_token,
 * password_salt, password_hash, pin_salt, pin_hash) unless includeSecrets === true.
 */
function readSheetObjects_(sheetName, includeSecrets) {
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
      if (
        headers[c] &&
        (includeSecrets === true || (headers[c] !== 'upload_nonce' && headers[c] !== 'tracking_token' && HIDDEN_SECURITY_COLUMNS_.indexOf(headers[c]) === -1))
      ) {
        obj[headers[c]] = row[c];
      }
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
    if (headers.indexOf('upload_nonce') === -1) {
      return createResponse_('error', null, 'Skema upload belum diperbarui. Jalankan initialSetupDatabase() untuk migrasi kolom upload_nonce.', 'INTERNAL_ERROR');
    }

    var nowIso = formatIsoOffset_(new Date());
    var newId = generateNextId_(sheet, 'TRX');
    var uploadNonce = Utilities.getUuid() + Utilities.getUuid();
    var trackingToken = Utilities.getUuid();

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
      upload_nonce: uploadNonce,
      tracking_token: trackingToken,
      is_seed: 'FALSE'
    };

    var rowValues = headers.map(function(h) {
      return newRecord[h] !== undefined ? newRecord[h] : '';
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, 1, lastCol).setValues([rowValues]);
    SpreadsheetApp.flush();

    var publicRecord = {};
    Object.keys(newRecord).forEach(function(key) {
      if (key !== 'upload_nonce' && key !== 'tracking_token') {
        publicRecord[key] = newRecord[key];
      }
    });
    return createResponse_(
      'success',
      {
        item: publicRecord,
        uploadNonce: uploadNonce,
        trackingToken: trackingToken
      },
      'Data baru berhasil disimpan.',
      'OK'
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Overwrite Update (Gate G-03 & G-11): Checks expected updated_at for full-record edits.
 */
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

    var expectedUpdated = req.payload.expected_updated_at || req.payload.updated_at;
    if (expectedUpdated && updatedIdx >= 0) {
      var currentUpdated = sanitizeForClient_(existingRow[updatedIdx]);
      if (String(currentUpdated) !== String(expectedUpdated)) {
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
      if (h !== 'upload_nonce' && h !== 'tracking_token') {
        updatedObj[h] = val;
      }
      return val;
    });

    sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([updatedRow]);
    SpreadsheetApp.flush();
    return createResponse_('success', { item: updatedObj }, 'Data berhasil diperbarui.', 'OK');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delta Mutation Pattern (Gate G-11):
 * For high-concurrency IN/OUT stock or quota adjustments inside LockService.
 * Evaluates current balance + delta >= 0 inside the lock without false CONFLICT rejections.
 */
function handleItemsMutateDelta_(req) {
  var p = req.payload || {};
  var targetId = String(p.id || p.item_id || '').trim();
  var mutationType = String(p.mutation_type || 'OUT').trim().toUpperCase();
  var rawDelta = Number(p.qty_delta !== undefined ? p.qty_delta : p.amount_delta);

  if (!targetId || !isFinite(rawDelta) || rawDelta === 0) {
    return createResponse_('error', null, 'ID data dan nilai mutasi (bukan nol) wajib disertakan.', 'VALIDATION_ERROR');
  }
  if (['IN', 'OUT', 'ADJUST'].indexOf(mutationType) === -1) {
    return createResponse_('error', null, 'Tipe mutasi harus IN, OUT, atau ADJUST.', 'VALIDATION_ERROR');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang memproses antrean transaksi staf lain. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('ITEMS');
    if (!sheet || sheet.getLastRow() <= 1) {
      return createResponse_('error', null, 'Tabel ITEMS belum tersedia.', 'NOT_FOUND');
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var idIdx = headers.indexOf('id');
    var amountIdx = headers.indexOf('current_stock') !== -1 ? headers.indexOf('current_stock') : headers.indexOf('amount');
    var updatedIdx = headers.indexOf('updated_at');
    var statusIdx = headers.indexOf('status');

    var targetRowNumber = -1;
    var existingRow = null;
    for (var r = 0; r < allData.length; r++) {
      if (String(allData[r][idIdx]) === targetId) {
        targetRowNumber = r + 2;
        existingRow = allData[r];
        break;
      }
    }

    if (targetRowNumber === -1 || (statusIdx >= 0 && String(existingRow[statusIdx]) === 'ARCHIVED')) {
      return createResponse_('error', null, 'Data tidak ditemukan atau telah diarsipkan.', 'NOT_FOUND');
    }

    var expectedUpdated = p.expected_updated_at || p.expected_item_updated_at;
    if (mutationType === 'ADJUST' && expectedUpdated && updatedIdx >= 0) {
      var currentUpdated = sanitizeForClient_(existingRow[updatedIdx]);
      if (String(currentUpdated) !== String(expectedUpdated)) {
        return createResponse_('error', null, 'Saldo berubah saat opname. Muat ulang sebelum koreksi ADJUST.', 'CONFLICT');
      }
    }

    var balanceBefore = Number(existingRow[amountIdx] || 0);
    var signedDelta = mutationType === 'IN' ? Math.abs(rawDelta) : (mutationType === 'OUT' ? -Math.abs(rawDelta) : rawDelta);
    var balanceAfter = balanceBefore + signedDelta;

    if (balanceAfter < 0) {
      return createResponse_(
        'error',
        { balanceBefore: balanceBefore, requestedDelta: signedDelta },
        'Transaksi ditolak: Saldo tidak mencukupi (Tersedia: ' + balanceBefore + ').',
        'VALIDATION_ERROR'
      );
    }

    var nowIso = formatIsoOffset_(new Date());
    existingRow[amountIdx] = balanceAfter;
    if (updatedIdx >= 0) existingRow[updatedIdx] = nowIso;

    sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([existingRow]);
    SpreadsheetApp.flush();

    return createResponse_(
      'success',
      { id: targetId, balanceBefore: balanceBefore, balanceAfter: balanceAfter, updatedAt: nowIso },
      'Mutasi berhasil dicatat. Saldo terbaru: ' + balanceAfter + '.',
      'OK'
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Anti-Enumeration Public Lookup Pattern (Gate G-10):
 * Requires both record ID and high-entropy tracking_token, guarded by CacheService rate limiting.
 */
function handleItemsTrackPublic_(req) {
  var p = req.payload || {};
  var ticketId = String(p.ticket_id || p.id || '').trim().toUpperCase();
  var trackingToken = String(p.tracking_token || '').trim();

  if (!ticketId || trackingToken.length < 16) {
    return createResponse_('error', null, 'Nomor tiket dan token pelacakan wajib disertakan.', 'VALIDATION_ERROR');
  }

  var cache = CacheService.getScriptCache();
  var globalRateKey = 'rl:track:global';
  var ticketFailKey = 'rl:track:fail:' + ticketId;

  var ticketFails = Number(cache.get(ticketFailKey) || 0);
  if (ticketFails >= 5) {
    return createResponse_(
      'error',
      null,
      'Terlalu banyak percobaan gagal untuk tiket ini. Silakan coba lagi dalam 15 menit.',
      'FORBIDDEN',
      { retryAfterSeconds: 900 }
    );
  }

  var globalCount = Number(cache.get(globalRateKey) || 0);
  if (globalCount >= 30) {
    return createResponse_('error', null, 'Lalu lintas pelacakan sedang padat. Coba sesaat lagi.', 'FORBIDDEN');
  }
  cache.put(globalRateKey, String(globalCount + 1), 60);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ITEMS');
  if (!sheet || sheet.getLastRow() <= 1) {
    return createResponse_('error', null, 'Data tiket tidak ditemukan.', 'NOT_FOUND');
  }

  var raw = sheet.getDataRange().getValues();
  var headers = raw[0].map(normalizeHeader_);
  var idIdx = headers.indexOf('id');
  var tokenIdx = headers.indexOf('tracking_token');
  var statusIdx = headers.indexOf('status');
  var updatedIdx = headers.indexOf('updated_at');

  for (var r = 1; r < raw.length; r++) {
    if (String(raw[r][idIdx]).toUpperCase() === ticketId) {
      var storedToken = tokenIdx >= 0 ? String(raw[r][tokenIdx] || '') : '';
      if (!storedToken || !constantTimeEqual_(storedToken, trackingToken)) {
        cache.put(ticketFailKey, String(ticketFails + 1), 900);
        return createResponse_('error', null, 'Kombinasi nomor tiket dan token pelacakan tidak valid.', 'FORBIDDEN');
      }
      cache.remove(ticketFailKey);
      return createResponse_(
        'success',
        {
          ticketId: ticketId,
          status: statusIdx >= 0 ? raw[r][statusIdx] : 'ACTIVE',
          updatedAt: updatedIdx >= 0 ? sanitizeForClient_(raw[r][updatedIdx]) : ''
        },
        'Status tiket ditemukan.',
        'OK'
      );
    }
  }

  cache.put(ticketFailKey, String(ticketFails + 1), 900);
  return createResponse_('error', null, 'Kombinasi nomor tiket dan token pelacakan tidak valid.', 'FORBIDDEN');
}

function handleItemsDelete_(req) {
  var targetId = String(req.payload.id || '').trim();
  if (!targetId) {
    return createResponse_('error', null, 'ID data wajib disertakan untuk penghapusan.', 'VALIDATION_ERROR');
  }
  if (!verifyAndConsumeStepUp_(req, 'items.delete')) {
    return createResponse_('error', null, 'Verifikasi PIN step-up diperlukan.', 'FORBIDDEN');
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

    var expectedUpdated = req.payload.expected_updated_at || req.payload.updated_at;
    if (expectedUpdated && updatedIdx >= 0) {
      var currentUpdated = sanitizeForClient_(existingRow[updatedIdx]);
      if (String(currentUpdated) !== String(expectedUpdated)) {
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
  if (!verifyAndConsumeStepUp_(req, 'admin.purgeSeed')) {
    return createResponse_('error', null, 'Verifikasi PIN step-up diperlukan.', 'FORBIDDEN');
  }

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

/**
 * Handler: plans.list (Returns active subscription plans from PLANS sheet)
 */
function handlePlansList_(req) {
  var result = readSheetObjects_('PLANS');
  if (!result.ok) return result.errorResponse;
  var activePlans = result.records.filter(function(pl) {
    return String(pl.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
  });
  return createResponse_('success', { plans: activePlans }, 'Daftar paket berhasil dimuat.', 'OK');
}

/**
 * Handler: subscription.get (Returns the latest subscription record for the caller or target email for ADMIN)
 */
function handleSubscriptionGet_(req) {
  if (!req.session || !req.session.sub) {
    return createResponse_('error', null, 'Sesi login diperlukan.', 'FORBIDDEN');
  }
  var p = req.payload || {};
  var callerEmail = String(req.session.sub).trim().toLowerCase();
  var callerRole = String(req.session.role || '').toUpperCase();
  var targetEmail = p.email && callerRole === 'ADMIN' ? String(p.email).trim().toLowerCase() : callerEmail;

  var subsRes = readSheetObjects_('SUBSCRIPTIONS');
  if (!subsRes.ok) return subsRes.errorResponse;

  var matched = null;
  for (var i = subsRes.records.length - 1; i >= 0; i--) {
    var row = subsRes.records[i];
    if (String(row.user_email || '').trim().toLowerCase() === targetEmail) {
      matched = row;
      if (String(row.status || '').toUpperCase() === 'ACTIVE') {
        break;
      }
    }
  }
  return createResponse_('success', { subscription: matched }, 'Data langganan berhasil dimuat.', 'OK');
}

/**
 * Helper: assertEntitlement_(req, currentUsageCount)
 * Verifies active subscription period_end and max_quota in server before allowing gated operations.
 */
function assertEntitlement_(req, currentUsageCount) {
  if (!req.session || !req.session.sub) {
    return {
      allowed: false,
      errorResponse: createResponse_('error', null, 'Sesi login diperlukan.', 'FORBIDDEN')
    };
  }
  var role = String(req.session.role || '').toUpperCase();
  if (role === 'ADMIN') {
    return { allowed: true, planCode: 'ADMIN_BYPASS', maxQuota: -1 };
  }

  var email = String(req.session.sub).trim().toLowerCase();
  var subsRes = readSheetObjects_('SUBSCRIPTIONS');
  if (!subsRes.ok) {
    return { allowed: false, errorResponse: subsRes.errorResponse };
  }

  var nowMs = new Date().getTime();
  var activeSub = null;
  for (var i = subsRes.records.length - 1; i >= 0; i--) {
    var s = subsRes.records[i];
    if (
      String(s.user_email || '').trim().toLowerCase() === email &&
      String(s.status || '').toUpperCase() === 'ACTIVE'
    ) {
      var endVal = s.period_end;
      var endMs = endVal instanceof Date ? endVal.getTime() : new Date(String(endVal || '')).getTime();
      if (!isNaN(endMs) && endMs > nowMs) {
        activeSub = s;
        break;
      }
    }
  }

  if (!activeSub) {
    return {
      allowed: false,
      errorResponse: createResponse_(
        'error',
        null,
        'Langganan aktif tidak ditemukan atau masa berlangganan telah berakhir.',
        'FORBIDDEN'
      )
    };
  }

  var plansRes = readSheetObjects_('PLANS');
  if (!plansRes.ok) {
    return { allowed: false, errorResponse: plansRes.errorResponse };
  }

  var planCode = String(activeSub.plan_code || '').trim().toUpperCase();
  var matchedPlan = null;
  for (var j = 0; j < plansRes.records.length; j++) {
    if (String(plansRes.records[j].plan_code || '').trim().toUpperCase() === planCode) {
      matchedPlan = plansRes.records[j];
      break;
    }
  }

  if (!matchedPlan || String(matchedPlan.status || '').toUpperCase() !== 'ACTIVE') {
    return {
      allowed: false,
      errorResponse: createResponse_('error', null, 'Paket langganan tidak aktif.', 'FORBIDDEN')
    };
  }

  var maxQuota = Number(matchedPlan.max_quota || 0);
  var usage = Number(currentUsageCount || 0);
  if (maxQuota > 0 && usage >= maxQuota) {
    return {
      allowed: false,
      errorResponse: createResponse_(
        'error',
        { planCode: planCode, maxQuota: maxQuota, currentUsage: usage },
        'Kuota paket langganan Anda (' + maxQuota + ') telah habis.',
        'FORBIDDEN'
      )
    };
  }

  return {
    allowed: true,
    planCode: planCode,
    maxQuota: maxQuota,
    subscription: activeSub,
    plan: matchedPlan
  };
}