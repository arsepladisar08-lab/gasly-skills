<!-- KB_VERSION: 2.1.0 -->
# GOOGLE DRIVE PHOTO UPLOAD, TICKETS & MAGIC-BYTE VERIFICATION (`gas/drive-upload.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-data` ketika aplikasi membutuhkan unggahan foto/file ke Google Drive.

## Daftar Isi
1. [Arsitektur `file.ticket` dan `file.upload`](#1-arsitektur-fileticket-dan-fileupload)
2. [Pemeriksaan MIME Allowlist + Magic-Byte Biner](#2-pemeriksaan-mime-allowlist--magic-byte-biner)
3. [Hook Opsional CAPTCHA (Dokumentasi Saja)](#3-hook-opsional-captcha-dokumentasi-saja)
4. [Boilerplate `drive.gs` (Tiket, Validasi Biner, Folder `ROOT/<entity>/<yyyy-mm>` & Atomic Write)](#4-boilerplate-drivegs-tiket-validasi-biner-folder-rootentityyyyy-mm--atomic-write)

---

## 1. Arsitektur `file.ticket` dan `file.upload`

Laporan komunitas menunjukkan bahwa `multipart/form-data` tidak dapat di-parse secara native di dalam `doPost(e)` Google Apps Script, sehingga file foto harus dikompres oleh browser ke ukuran sekitar `1 MB` dan dikirim sebagai string **Base64** di dalam payload JSON:
1. **Tiket Sekali Pakai yang Terikat pada Record (`file.ticket`):**
   - Setelah `items.create`, server menyimpan `upload_nonce` acak pada kolom internal Sheet dan mengembalikan nilainya sebagai `uploadNonce` hanya pada respons create. Fungsi list/get tidak boleh mengekspos kolom ini.
   - Browser meminta `action: "file.ticket"` dengan `{ entity, entityId, uploadNonce }`. Server hanya menerbitkan tiket jika nonce cocok, record dibuat maksimal 15 menit sebelumnya, record belum diarsipkan, dan `file_id`/`file_url` masih kosong.
   - Tiket berisi scope `entity + entityId + uploadNonce`, berlaku 5 menit, dan dikonsumsi di dalam `LockService` ketika upload diproses. Tiket tidak boleh dipakai untuk record lain atau dipakai ulang.
   - Pengunggah tanpa sesi terautentikasi tidak boleh menimpa file yang sudah ada. Hanya sesi bertanda tangan dengan role `ADMIN` atau `STAFF` yang boleh mengganti attachment.
2. **Struktur Folder & Klasifikasi Berbagi (`private` sebagai Default Mutlak):**
   - File disimpan ke dalam sub-folder `ROOT/<entity>/<yyyy-mm>` di bawah folder `DRIVE_ROOT_FOLDER_ID`.
   - **Aturan Keras `Gate U-10`:** Jika entitas memuat dokumen pajak (NPWP, SPT, SP2DK, rekap omzet), rekam/rujukan medis, identitas (KTP/KK), atau struk/bukti keuangan (`dataClassification: 'CONFIDENTIAL' | 'SENSITIVE_PII'`), `visibility` **WAJIB disetel ke `'private'`** (`DriveApp.Access.PRIVATE, DriveApp.Permission.NONE`). Dilarang keras memakai `ANYONE_WITH_LINK` untuk dokumen pelanggan/pasien.
   - Pengaturan `visibility: 'public'` (`DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW`) **HANYA** boleh digunakan untuk entitas katalog/poster/avatar publik (`dataClassification: 'PUBLIC'`).
3. **Penulisan Atomik & Rollback File Yatim:**
   - Di dalam satu blok `LockService.getScriptLock()`, server memastikan baris target (`entityId`) ada di Sheet, membuat file di Drive, lalu menulis `file_id` dan `file_url` kanonik (`https://drive.google.com/file/d/<id>/view`) ke baris tersebut. Jika penulisan ke Sheet gagal, file Drive yang baru dibuat langsung dibuang (`file.setTrashed(true)`).

---

## 2. Pemeriksaan MIME Allowlist + Magic-Byte Biner

Di Google Apps Script, `Utilities.base64Decode(b64)` menghasilkan array integer bertanda (`-128` s/d `127`). Konversikan setiap byte menggunakan `(b & 0xFF)` sebelum memeriksa *magic bytes*:
- `image/jpeg`: 3 byte pertama wajib `0xFF, 0xD8, 0xFF`.
- `image/png`: 8 byte pertama wajib `0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A`.
- `image/webp`: Byte `0..3` wajib `0x52, 0x49, 0x46, 0x46` (`"RIFF"`) dan byte `8..11` wajib `0x57, 0x45, 0x42, 0x50` (`"WEBP"`).

---

## 3. Hook Opsional CAPTCHA (Dokumentasi Saja)

Untuk deployment publik (`P3`) dengan trafik tinggi, pemilik proyek dapat menambahkan verifikasi token Cloudflare Turnstile atau Google reCAPTCHA v3 di dalam `handleFileTicket_()` dengan memanggil endpoint verifikasi penyedia melalui `UrlFetchApp.fetch()` menggunakan secret yang disimpan di `ScriptProperties`. Hook ini bersifat opsional dan tidak diaktifkan secara default.

---

## 4. Boilerplate `drive.gs` (Tiket, Validasi Biner, Folder `ROOT/<entity>/<yyyy-mm>` & Atomic Write)

```javascript
// FILE: drive.gs
// Runtime: Google Apps Script V8

var ENTITY_UPLOAD_CONFIG_ = {
  ITEMS: {
    sheetName: 'ITEMS',
    dataClassification: 'CONFIDENTIAL', // 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SENSITIVE_PII'
    visibility: 'private', // 'private' (default wajib untuk data sensitif) | 'public' (khusus katalog/poster publik)
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp']
  }
};

function sanitizeFileName_(name, mimeType) {
  var extMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  };
  var ext = extMap[mimeType] || '.bin';
  var base = String(name || 'upload')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 60);
  if (!base) base = 'file';
  return base + '_' + new Date().getTime() + ext;
}

/**
 * Verifies that decoded binary bytes match the declared MIME type magic header.
 * Converts signed GAS bytes (-128..127) to unsigned (0..255) via (b & 0xFF).
 */
function verifyMagicBytes_(bytes, mimeType) {
  if (!bytes || bytes.length < 12) return false;

  function u8(idx) {
    return bytes[idx] & 0xFF;
  }

  if (mimeType === 'image/jpeg') {
    return u8(0) === 0xFF && u8(1) === 0xD8 && u8(2) === 0xFF;
  }

  if (mimeType === 'image/png') {
    return (
      u8(0) === 0x89 &&
      u8(1) === 0x50 &&
      u8(2) === 0x4E &&
      u8(3) === 0x47 &&
      u8(4) === 0x0D &&
      u8(5) === 0x0A &&
      u8(6) === 0x1A &&
      u8(7) === 0x0A
    );
  }

  if (mimeType === 'image/webp') {
    return (
      u8(0) === 0x52 &&
      u8(1) === 0x49 &&
      u8(2) === 0x46 &&
      u8(3) === 0x46 &&
      u8(8) === 0x57 &&
      u8(9) === 0x45 &&
      u8(10) === 0x42 &&
      u8(11) === 0x50
    );
  }

  return false;
}

function getOrCreateSubfolder_(parentFolder, childName) {
  var iter = parentFolder.getFoldersByName(childName);
  if (iter.hasNext()) {
    return iter.next();
  }
  return parentFolder.createFolder(childName);
}

function resolveUploadFolder_(entityKey) {
  var rootId = PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_FOLDER_ID');
  if (!rootId) {
    throw new Error('DRIVE_ROOT_FOLDER_ID is not configured in ScriptProperties.');
  }
  var rootFolder = DriveApp.getFolderById(rootId);
  var tz = Session.getScriptTimeZone() || DEFAULT_TZ;
  var yearMonth = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  var entityFolder = getOrCreateSubfolder_(rootFolder, entityKey);
  return getOrCreateSubfolder_(entityFolder, yearMonth);
}

/**
 * Handler: file.ticket (Issues a scoped one-time ticket for a recently created record)
 */
function handleFileTicket_(req) {
  var p = req.payload || {};
  var entityKey = String(p.entity || 'ITEMS').trim().toUpperCase();
  var entityId = String(p.entityId || '').trim();
  var uploadNonce = String(p.uploadNonce || '').trim();
  var entityCfg = ENTITY_UPLOAD_CONFIG_[entityKey];

  if (!entityCfg || !entityId || !uploadNonce) {
    return createResponse_('error', null, 'Entitas, entityId, dan uploadNonce dari respons items.create wajib disertakan.', 'VALIDATION_ERROR');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(entityCfg.sheetName);
    if (!sheet || sheet.getLastRow() <= 1) {
      return createResponse_('error', null, 'Tabel tujuan tidak ditemukan.', 'NOT_FOUND');
    }

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var idIdx = headers.indexOf('id');
    var createdIdx = headers.indexOf('created_at');
    var statusIdx = headers.indexOf('status');
    var fileIdIdx = headers.indexOf('file_id');
    var fileUrlIdx = headers.indexOf('file_url');
    var nonceIdx = headers.indexOf('upload_nonce');
    if ([idIdx, createdIdx, fileIdIdx, fileUrlIdx, nonceIdx].some(function(idx) { return idx < 0; })) {
      return createResponse_('error', null, 'Skema upload belum diperbarui. Jalankan initialSetupDatabase().', 'INTERNAL_ERROR');
    }

    var allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
    var targetRow = null;
    for (var r = 0; r < allData.length; r++) {
      if (String(allData[r][idIdx]) === entityId) {
        targetRow = allData[r];
        break;
      }
    }
    if (!targetRow) {
      return createResponse_('error', null, 'Record unggahan tidak ditemukan.', 'NOT_FOUND');
    }

    if (statusIdx >= 0 && String(targetRow[statusIdx]).toUpperCase() === 'ARCHIVED') {
      return createResponse_('error', null, 'Record yang diarsipkan tidak dapat menerima unggahan.', 'FORBIDDEN');
    }
    if (String(targetRow[fileIdIdx] || '').trim() || String(targetRow[fileUrlIdx] || '').trim()) {
      return createResponse_('error', null, 'Record ini sudah memiliki file. Gunakan sesi terautentikasi untuk menggantinya.', 'CONFLICT');
    }

    var createdValue = targetRow[createdIdx];
    var createdAtMs = createdValue instanceof Date ? createdValue.getTime() : new Date(String(createdValue)).getTime();
    var nowMs = new Date().getTime();
    if (isNaN(createdAtMs) || createdAtMs > nowMs + 60000 || nowMs - createdAtMs > 900000) {
      return createResponse_('error', null, 'Tiket hanya dapat diterbitkan untuk record baru (maksimal 15 menit).', 'FORBIDDEN');
    }

    var storedNonce = String(targetRow[nonceIdx] || '');
    if (!storedNonce || !constantTimeEqual_(storedNonce, uploadNonce)) {
      return createResponse_('error', null, 'Bukti kepemilikan record tidak valid.', 'FORBIDDEN');
    }

    var cache = CacheService.getScriptCache();
    var globalRateKey = 'rl:ticket:global';
    var issuedCount = Number(cache.get(globalRateKey) || 0);
    if (issuedCount >= 15) {
      return createResponse_(
        'error',
        null,
        'Batas antrean unggah tercapai. Silakan coba lagi dalam 1 menit.',
        'FORBIDDEN',
        { retryAfterSeconds: 60 }
      );
    }

    var ticket = Utilities.getUuid() + Utilities.getUuid();
    var ticketScope = {
      entity: entityKey,
      entityId: entityId,
      uploadNonce: storedNonce,
      sessionSub: req.session ? String(req.session.sub || '') : ''
    };
    cache.put(globalRateKey, String(issuedCount + 1), 60);
    cache.put('ticket:' + ticket, JSON.stringify(ticketScope), 300);

    return createResponse_(
      'success',
      { ticket: ticket, expiresInSeconds: 300 },
      'Tiket unggah terikat pada record baru dan hanya dapat digunakan sekali.',
      'OK'
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handler: file.upload
 * Expects payload: { entity, entityId, fileName, mimeType, base64, ticket }.
 * Public tickets are scoped to a matching entityId and hidden upload_nonce.
 */
function handleFileUpload_(req) {
  var p = req.payload || {};
  var entityKey = String(p.entity || 'ITEMS').trim().toUpperCase();
  var entityId = String(p.entityId || '').trim();
  var mimeType = String(p.mimeType || '').trim().toLowerCase();
  var base64Raw = String(p.base64 || '').trim();
  var ticket = String(p.ticket || '').trim();
  var entityCfg = ENTITY_UPLOAD_CONFIG_[entityKey];

  if (!entityCfg) {
    return createResponse_('error', null, 'Entitas tujuan unggah tidak valid.', 'VALIDATION_ERROR');
  }
  if (!entityId) {
    return createResponse_('error', null, 'ID baris data (entityId) wajib disertakan.', 'VALIDATION_ERROR');
  }
  if (entityCfg.allowedMimes.indexOf(mimeType) === -1) {
    return createResponse_('error', null, 'Format file tidak didukung. Gunakan JPEG, PNG, atau WebP.', 'VALIDATION_ERROR');
  }

  var commaIdx = base64Raw.indexOf(',');
  if (commaIdx !== -1 && base64Raw.slice(0, commaIdx).indexOf('base64') !== -1) {
    base64Raw = base64Raw.slice(commaIdx + 1);
  }

  var maxBytes = Number(PropertiesService.getScriptProperties().getProperty('MAX_UPLOAD_BYTES') || 5242880);
  if (!base64Raw || base64Raw.length > Math.ceil(maxBytes * 1.37) + 256) {
    return createResponse_('error', null, 'Ukuran file melebihi batas maksimum (5 MB).', 'VALIDATION_ERROR');
  }

  var decodedBytes;
  try {
    decodedBytes = Utilities.base64Decode(base64Raw);
  } catch (decErr) {
    return createResponse_('error', null, 'Data base64 file rusak.', 'VALIDATION_ERROR');
  }

  if (!decodedBytes || decodedBytes.length === 0 || decodedBytes.length > maxBytes) {
    return createResponse_('error', null, 'Ukuran byte file melebihi batas maksimum (5 MB).', 'VALIDATION_ERROR');
  }
  if (!verifyMagicBytes_(decodedBytes, mimeType)) {
    return createResponse_(
      'error',
      null,
      'Header biner file tidak cocok dengan tipe gambar ' + mimeType + '.',
      'VALIDATION_ERROR'
    );
  }

  var role = req.session ? String(req.session.role || '').toUpperCase() : '';
  var canManageExisting = role === 'ADMIN' || role === 'STAFF';
  if (!canManageExisting && !ticket) {
    return createResponse_('error', null, 'Tiket unggah yang terikat pada record wajib disertakan.', 'FORBIDDEN');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  var createdFile = null;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(entityCfg.sheetName);
    if (!sheet || sheet.getLastRow() <= 1) {
      return createResponse_('error', null, 'Tabel tujuan tidak ditemukan.', 'NOT_FOUND');
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var idIdx = headers.indexOf('id');
    var createdIdx = headers.indexOf('created_at');
    var fileIdIdx = headers.indexOf('file_id');
    var fileUrlIdx = headers.indexOf('file_url');
    var updatedIdx = headers.indexOf('updated_at');
    var nonceIdx = headers.indexOf('upload_nonce');
    var statusIdx = headers.indexOf('status');

    if ([idIdx, createdIdx, fileIdIdx, fileUrlIdx, nonceIdx].some(function(idx) { return idx < 0; })) {
      return createResponse_('error', null, 'Skema upload belum diperbarui. Jalankan initialSetupDatabase().', 'INTERNAL_ERROR');
    }

    var targetRowNumber = -1;
    var existingRow = null;
    for (var r = 0; r < allData.length; r++) {
      if (String(allData[r][idIdx]) === entityId) {
        targetRowNumber = r + 2;
        existingRow = allData[r];
        break;
      }
    }
    if (targetRowNumber === -1) {
      return createResponse_('error', null, 'Record unggahan tidak ditemukan.', 'NOT_FOUND');
    }
    if (statusIdx >= 0 && String(existingRow[statusIdx]).toUpperCase() === 'ARCHIVED') {
      return createResponse_('error', null, 'Record yang diarsipkan tidak dapat menerima unggahan.', 'FORBIDDEN');
    }

    var hasExistingFile = Boolean(String(existingRow[fileIdIdx] || '').trim() || String(existingRow[fileUrlIdx] || '').trim());
    if (hasExistingFile && !canManageExisting) {
      return createResponse_('error', null, 'Unggahan publik tidak dapat menimpa file yang sudah ada.', 'CONFLICT');
    }

    var cache = CacheService.getScriptCache();
    if (!canManageExisting) {
      var ticketRaw = cache.get('ticket:' + ticket);
      var ticketScope = null;
      try {
        ticketScope = ticketRaw ? JSON.parse(ticketRaw) : null;
      } catch (ticketErr) {
        ticketScope = null;
      }
      if (
        !ticketScope ||
        ticketScope.entity !== entityKey ||
        ticketScope.entityId !== entityId ||
        ticketScope.uploadNonce !== String(existingRow[nonceIdx] || '') ||
        (ticketScope.sessionSub && (!req.session || ticketScope.sessionSub !== String(req.session.sub || '')))
      ) {
        return createResponse_('error', null, 'Tiket tidak cocok dengan record tujuan, sudah digunakan, atau kedaluwarsa.', 'FORBIDDEN');
      }
      cache.remove('ticket:' + ticket);
    }

    var targetFolder = resolveUploadFolder_(entityKey);
    var safeName = sanitizeFileName_(p.fileName, mimeType);
    var blob = Utilities.newBlob(decodedBytes, mimeType, safeName);
    createdFile = targetFolder.createFile(blob);

    // Gate U-10: Hanya bagikan ke publik jika secara eksplisit PUBLIC dan bukan data sensitif
    var isStrictlyPublic =
      entityCfg.visibility === 'public' &&
      entityCfg.dataClassification === 'PUBLIC';

    if (isStrictlyPublic) {
      createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } else {
      createdFile.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    }

    var fileId = createdFile.getId();
    var canonicalUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
    var nowIso = formatIsoOffset_(new Date());
    var previousFileId = String(existingRow[fileIdIdx] || '').trim();

    existingRow[fileIdIdx] = fileId;
    existingRow[fileUrlIdx] = canonicalUrl;
    existingRow[nonceIdx] = '';
    if (updatedIdx >= 0) existingRow[updatedIdx] = nowIso;

    sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([existingRow]);
    SpreadsheetApp.flush();

    if (previousFileId && previousFileId !== fileId) {
      try {
        DriveApp.getFileById(previousFileId).setTrashed(true);
      } catch (oldTrashErr) {}
    }

    return createResponse_(
      'success',
      {
        entity: entityKey,
        entityId: entityId,
        fileId: fileId,
        fileUrl: canonicalUrl,
        visibility: isStrictlyPublic ? 'public' : 'private',
        updatedAt: nowIso
      },
      'File berhasil diunggah dan ditautkan ke data.',
      'OK'
    );
  } catch (err) {
    if (createdFile) {
      try {
        createdFile.setTrashed(true);
      } catch (trashErr) {}
    }
    console.error('handleFileUpload_ error:', err);
    return createResponse_('error', null, 'Gagal menyimpan file ke Google Drive.', 'INTERNAL_ERROR');
  } finally {
    lock.releaseLock();
  }
}
/**
 * Handler: file.replace
 * Replaces an existing attachment for an authenticated STAFF/MANAGER/ADMIN session
 * and moves the previous Drive file to Trash after Sheet flush.
 */
function handleFileReplace_(req) {
  var role = req.session ? String(req.session.role || '').toUpperCase() : '';
  if (role !== 'ADMIN' && role !== 'MANAGER' && role !== 'STAFF') {
    return createResponse_('error', null, 'Penggantian file memerlukan sesi terautentikasi.', 'FORBIDDEN');
  }
  return handleFileUpload_(req);
}

/**
 * Handler: file.delete
 * Clears file_id and file_url on the target entity row inside LockService and trashes the Drive file.
 */
function handleFileDelete_(req) {
  var role = req.session ? String(req.session.role || '').toUpperCase() : '';
  if (role !== 'ADMIN' && role !== 'MANAGER' && role !== 'STAFF') {
    return createResponse_('error', null, 'Penghapusan file memerlukan sesi terautentikasi.', 'FORBIDDEN');
  }

  var p = req.payload || {};
  var entityKey = String(p.entity || 'ITEMS').trim().toUpperCase();
  var entityId = String(p.entityId || '').trim();
  var entityCfg = ENTITY_UPLOAD_CONFIG_[entityKey];

  if (!entityCfg || !entityId) {
    return createResponse_('error', null, 'Entitas dan entityId wajib disertakan.', 'VALIDATION_ERROR');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(entityCfg.sheetName);
    if (!sheet || sheet.getLastRow() <= 1) {
      return createResponse_('error', null, 'Tabel tujuan tidak ditemukan.', 'NOT_FOUND');
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var idIdx = headers.indexOf('id');
    var fileIdIdx = headers.indexOf('file_id');
    var fileUrlIdx = headers.indexOf('file_url');
    var updatedIdx = headers.indexOf('updated_at');

    if (idIdx < 0 || fileIdIdx < 0 || fileUrlIdx < 0) {
      return createResponse_('error', null, 'Skema kolom file belum tersedia.', 'INTERNAL_ERROR');
    }

    var targetRowNumber = -1;
    var existingRow = null;
    for (var r = 0; r < allData.length; r++) {
      if (String(allData[r][idIdx]) === entityId) {
        targetRowNumber = r + 2;
        existingRow = allData[r];
        break;
      }
    }
    if (targetRowNumber === -1) {
      return createResponse_('error', null, 'Record tidak ditemukan.', 'NOT_FOUND');
    }

    var oldFileId = String(existingRow[fileIdIdx] || '').trim();
    if (!oldFileId) {
      return createResponse_('error', null, 'Record ini tidak memiliki lampiran file.', 'NOT_FOUND');
    }

    var nowIso = formatIsoOffset_(new Date());
    existingRow[fileIdIdx] = '';
    existingRow[fileUrlIdx] = '';
    if (updatedIdx >= 0) existingRow[updatedIdx] = nowIso;

    sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([existingRow]);
    SpreadsheetApp.flush();

    try {
      DriveApp.getFileById(oldFileId).setTrashed(true);
    } catch (trashErr) {}

    return createResponse_('success', { entity: entityKey, entityId: entityId, deletedFileId: oldFileId, updatedAt: nowIso }, 'Lampiran file berhasil dihapus.', 'OK');
  } finally {
    lock.releaseLock();
  }
}