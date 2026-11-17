<!-- KB_VERSION: 2.1.0 -->
# AUTHENTICATION, SESSION TOKENS & CHUNKED CACHE RATE LIMITING (`gas/auth-and-ratelimit.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-data`.

## Daftar Isi
1. [Kriptografi V8: Passphrase Hash, HMAC-SHA256 & Constant-Time Compare](#1-kriptografi-v8-passphrase-hash-hmac-sha256--constant-time-compare)
2. [Batas Nilai `CacheService` (100 KB) & Chunking Helper](#2-batas-nilai-cacheservice-100-kb--chunking-helper)
3. [Boilerplate `auth.gs` (Passphrase, Google ID Token & Rate Limiting)](#3-boilerplate-authgs-passphrase-google-id-token--rate-limiting)

---

## 1. Kriptografi V8: Passphrase Hash, HMAC-SHA256 & Constant-Time Compare

1. **Konversi UTF-8 Byte Array yang Deterministik:**
   Pada Google Apps Script V8, gunakan `Utilities.newBlob(str, 'text/plain').getBytes()` ketika membutuhkan representasi byte UTF-8 untuk diteruskan ke `Utilities.computeDigest` atau `Utilities.computeHmacSha256Signature`.
2. **Base64URL Tanpa Padding:**
   `Utilities.base64EncodeWebSafe()` menyertakan karakter padding `=` di akhir string. Hapus `=` saat membuat token (`replace(/=+$/, '')`) dan pulihkan panjang kelipatan 4 sebelum memanggil `Utilities.base64DecodeWebSafe()`.
3. **Perbandingan Waktu Konstan (`constantTimeEqual_`):**
   Jangan pernah membandingkan signature HMAC atau hash passphrase menggunakan operator `===` biasa. Gunakan operasi bitwise XOR di sepanjang karakter string.

---

## 2. Batas Nilai `CacheService` (100 KB) & Chunking Helper

`CacheService.getScriptCache()` memiliki batas panjang kunci 250 karakter dan batas ukuran nilai **100 KB per kunci**.
- Untuk nilai kecil (seperti penghitung rate-limit `rl:fail:<sub>` atau tiket upload `ticket:<id>`), simpan langsung.
- Untuk nilai JSON besar (seperti cache daftar data atau respon idempoten besar), gunakan helper `cachePutChunked_()` dan `cacheGetChunked_()` yang memecah string di atas `80.000` karakter menjadi potongan-potongan terindeks.

**Batas Operasional yang Wajib Didokumentasikan:**
- `CacheService` bersifat best-effort: nilai dapat ter-evict sebelum TTL dan operasi read-modify-write tidak memberikan transaksi atomik. Counter rate-limit dapat kehilangan update atau meloloskan beberapa request paralel. Jangan mengklaim ini sebagai proteksi brute-force yang kuat; untuk kebutuhan ketat, serialisasikan seluruh pemeriksaan+update di bawah lock atau gunakan gateway/penyimpanan rate-limit eksternal.
- Batas global gagal login (`30` kegagalan dengan TTL `600` detik) dapat dipicu oleh pengunjung publik dan sementara menghambat login semua pengguna. Karena GAS Web App tidak menyediakan IP client yang andal, perlakukan ini sebagai trade-off DoS; blok global otomatis kedaluwarsa, sedangkan lockout per akun berakhir sesuai TTL `LOCKOUT_DURATION_SEC`.
- `computeIteratedHash_()` saat ini menggunakan iterasi SHA-256 sebanyak `2000` putaran. Ini bukan KDF memory-hard dan tidak setara dengan bcrypt, scrypt, atau Argon2. Jangan membuat klaim kesetaraan; gunakan identity provider atau penyimpanan kredensial eksternal dengan KDF yang sesuai jika ancaman/keperluan produksi menuntutnya.

---

## 3. Boilerplate `auth.gs` (Passphrase, Google ID Token & Rate Limiting)

```javascript
// FILE: auth.gs
// Runtime: Google Apps Script V8

var CACHE_CHUNK_SIZE_ = 80000;

function base64UrlEncodeBytes_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function base64UrlEncodeString_(str) {
  var bytes = Utilities.newBlob(String(str), 'text/plain').getBytes();
  return base64UrlEncodeBytes_(bytes);
}

function base64UrlDecodeToString_(b64Url) {
  var clean = String(b64Url || '').replace(/\s+/g, '');
  var padLen = (4 - (clean.length % 4)) % 4;
  var padded = clean + '===='.slice(0, padLen);
  var bytes = Utilities.base64DecodeWebSafe(padded);
  return Utilities.newBlob(bytes).getDataAsString('UTF-8');
}

/**
 * Constant-time string comparison to prevent timing side-channel leaks.
 */
function constantTimeEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  var lenA = a.length;
  var lenB = b.length;
  var diff = lenA ^ lenB;
  var maxLen = Math.max(lenA, lenB);
  for (var i = 0; i < maxLen; i++) {
    var codeA = i < lenA ? a.charCodeAt(i) : 0;
    var codeB = i < lenB ? b.charCodeAt(i) : 0;
    diff |= (codeA ^ codeB);
  }
  return diff === 0;
}

/**
 * Computes iterated salted SHA-256 hash over UTF-8 byte arrays.
 */
function computeIteratedHash_(passphrase, salt, pepper, iterations) {
  var count = Math.max(1000, Number(iterations) || 2000);
  var initialBytes = Utilities.newBlob(salt + ':' + passphrase + ':' + pepper, 'text/plain').getBytes();
  var saltBytes = Utilities.newBlob(salt, 'text/plain').getBytes();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, initialBytes);

  for (var i = 1; i < count; i++) {
    var combined = digest.concat(saltBytes);
    digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, combined);
  }
  return base64UrlEncodeBytes_(digest);
}

function computeHmacSignature_(dataStr, secretStr) {
  var dataBytes = Utilities.newBlob(String(dataStr), 'text/plain').getBytes();
  var keyBytes = Utilities.newBlob(String(secretStr), 'text/plain').getBytes();
  var sigBytes = Utilities.computeHmacSha256Signature(dataBytes, keyBytes);
  return base64UrlEncodeBytes_(sigBytes);
}

/**
 * Chunk-safe CacheService helpers respecting the 100 KB per-key limit.
 */
function cachePutChunked_(key, jsonStr, ttlSeconds) {
  var cache = CacheService.getScriptCache();
  var ttl = Math.min(21600, Math.max(1, Number(ttlSeconds) || 600));
  if (jsonStr.length <= CACHE_CHUNK_SIZE_) {
    cache.put(key, jsonStr, ttl);
    return;
  }
  var totalChunks = Math.ceil(jsonStr.length / CACHE_CHUNK_SIZE_);
  var batch = {};
  for (var i = 0; i < totalChunks; i++) {
    batch[key + ':c:' + i] = jsonStr.slice(i * CACHE_CHUNK_SIZE_, (i + 1) * CACHE_CHUNK_SIZE_);
  }
  batch[key] = JSON.stringify({ __chunked: true, count: totalChunks });
  cache.putAll(batch, ttl);
}

function cacheGetChunked_(key) {
  var cache = CacheService.getScriptCache();
  var head = cache.get(key);
  if (!head) return null;
  if (head.indexOf('{"__chunked":true') !== 0) {
    return head;
  }
  try {
    var meta = JSON.parse(head);
    var keys = [];
    for (var i = 0; i < meta.count; i++) {
      keys.push(key + ':c:' + i);
    }
    var partsObj = cache.getAll(keys);
    var assembled = [];
    for (var j = 0; j < meta.count; j++) {
      var part = partsObj[key + ':c:' + j];
      if (part === undefined || part === null) return null;
      assembled.push(part);
    }
    return assembled.join('');
  } catch (e) {
    return null;
  }
}

/**
 * Rate-limit helpers for per-account login lockouts and global failure caps.
 */
function checkAuthRateLimit_(accountKey) {
  var props = PropertiesService.getScriptProperties();
  var maxFailures = Number(props.getProperty('LOCKOUT_THRESHOLD') || 5);
  var lockDuration = Number(props.getProperty('LOCKOUT_DURATION_SEC') || 900);
  var cache = CacheService.getScriptCache();

  var acctKey = 'rl:fail:' + String(accountKey || 'admin').toLowerCase().slice(0, 120);
  var globalKey = 'rl:fail:global';

  var acctCount = Number(cache.get(acctKey) || 0);
  var globalCount = Number(cache.get(globalKey) || 0);

  if (acctCount >= maxFailures || globalCount >= 30) {
    return {
      allowed: false,
      retryAfterSeconds: lockDuration
    };
  }
  return { allowed: true, acctKey: acctKey, globalKey: globalKey, lockDuration: lockDuration };
}

function recordAuthFailure_(rlState) {
  var cache = CacheService.getScriptCache();
  var acctCount = Number(cache.get(rlState.acctKey) || 0) + 1;
  var globalCount = Number(cache.get(rlState.globalKey) || 0) + 1;
  cache.put(rlState.acctKey, String(acctCount), rlState.lockDuration);
  cache.put(rlState.globalKey, String(globalCount), 600);
}

function clearAuthFailures_(rlState) {
  if (rlState && rlState.acctKey) {
    CacheService.getScriptCache().remove(rlState.acctKey);
  }
}

/**
 * Issues a signed session token: base64url(payload) + "." + base64url(HMAC-SHA256(secret, payload))
 */
function issueSessionToken_(sub, role) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('AUTH_HMAC_SECRET');
  if (!secret) {
    throw new Error('AUTH_HMAC_SECRET is not initialized. Run initialSetupDatabase() first.');
  }
  var ttl = Number(props.getProperty('SESSION_TTL_SECONDS') || 7200);
  var nowSec = Math.floor(new Date().getTime() / 1000);
  var payloadObj = {
    sub: String(sub),
    role: String(role || 'ADMIN'),
    iat: nowSec,
    exp: nowSec + ttl,
    jti: Utilities.getUuid()
  };
  var encodedPayload = base64UrlEncodeString_(JSON.stringify(payloadObj));
  var signature = computeHmacSignature_(encodedPayload, secret);
  return {
    token: encodedPayload + '.' + signature,
    expiresAt: formatIsoOffset_(new Date((nowSec + ttl) * 1000)),
    role: payloadObj.role,
    sub: payloadObj.sub
  };
}

function verifySessionToken_(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string') {
    return { ok: false, message: 'Sesi otentikasi tidak ditemukan. Silakan login terlebih dahulu.' };
  }
  var parts = tokenStr.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, message: 'Format token sesi tidak valid.' };
  }

  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('AUTH_HMAC_SECRET');
  if (!secret) {
    return { ok: false, message: 'Konfigurasi otentikasi server belum siap.' };
  }

  var expectedSig = computeHmacSignature_(parts[0], secret);
  if (!constantTimeEqual_(parts[1], expectedSig)) {
    return { ok: false, message: 'Tanda tangan token sesi tidak sah.' };
  }

  var payload;
  try {
    payload = JSON.parse(base64UrlDecodeToString_(parts[0]));
  } catch (e) {
    return { ok: false, message: 'Isi token sesi rusak.' };
  }

  var nowSec = Math.floor(new Date().getTime() / 1000);
  if (!payload.exp || nowSec >= Number(payload.exp)) {
    return { ok: false, message: 'Sesi Anda telah berakhir. Silakan login kembali.' };
  }

  if (payload.jti && CacheService.getScriptCache().get('revoked:' + payload.jti)) {
    return { ok: false, message: 'Sesi ini telah keluar (logged out).' };
  }

  return { ok: true, session: payload };
}

/**
 * Handler: auth.login (Default passphrase authentication)
 */
function handleAuthLogin_(req) {
  var accountId = String(req.payload.account || req.payload.email || 'admin').trim().toLowerCase();
  var passphrase = String(req.payload.passphrase || '');

  var rl = checkAuthRateLimit_(accountId);
  if (!rl.allowed) {
    return createResponse_(
      'error',
      null,
      'Terlalu banyak percobaan gagal. Akun dikunci sementara.',
      'FORBIDDEN',
      { retryAfterSeconds: rl.retryAfterSeconds }
    );
  }

  if (passphrase.length < 12) {
    recordAuthFailure_(rl);
    return createResponse_('error', null, 'Kredensial tidak valid.', 'FORBIDDEN');
  }

  var props = PropertiesService.getScriptProperties();
  var pepper = props.getProperty('AUTH_PEPPER') || '';
  var iterations = Number(props.getProperty('ADMIN_PASSPHRASE_ITER') || 2000);

if (accountId === 'admin') {
    var storedSalt = props.getProperty('ADMIN_PASSPHRASE_SALT');
    var storedHash = props.getProperty('ADMIN_PASSPHRASE_HASH');

    if (!storedSalt || !storedHash) {
      return createResponse_(
        'error',
        null,
        'Passphrase admin belum dikonfigurasi di ScriptProperties.',
        'INTERNAL_ERROR'
      );
    }

    var candidateHash = computeIteratedHash_(passphrase.trim(), storedSalt, pepper, iterations);
    if (!constantTimeEqual_(candidateHash, storedHash)) {
      recordAuthFailure_(rl);
      return createResponse_('error', null, 'Kredensial tidak valid.', 'FORBIDDEN');
    }

    clearAuthFailures_(rl);
    var issued = issueSessionToken_(accountId, 'ADMIN');
    return createResponse_('success', issued, 'Login berhasil.', 'OK');
  }

  var usersRes = readSheetObjects_('USERS', true);
  if (!usersRes.ok) return usersRes.errorResponse;

  var matchedUser = null;
  for (var i = 0; i < usersRes.records.length; i++) {
    var row = usersRes.records[i];
    if (String(row.email || '').trim().toLowerCase() === accountId && String(row.status || '').toUpperCase() === 'ACTIVE') {
      matchedUser = row;
      break;
    }
  }

  var userSalt = matchedUser && matchedUser.password_salt ? String(matchedUser.password_salt) : 'dummy_salt_anti_timing_00000000';
  var userHash = matchedUser && matchedUser.password_hash ? String(matchedUser.password_hash) : '';
  var computedUserHash = computeIteratedHash_(passphrase.trim(), userSalt, pepper, iterations);

  if (!matchedUser || !userHash || !constantTimeEqual_(computedUserHash, userHash)) {
    recordAuthFailure_(rl);
    return createResponse_('error', null, 'Kredensial tidak valid.', 'FORBIDDEN');
  }

  var userRole = String(matchedUser.role || 'STAFF').toUpperCase();
  if (ROLE_RANK_[userRole] === undefined) userRole = 'STAFF';

  clearAuthFailures_(rl);
  var issuedUser = issueSessionToken_(accountId, userRole);
  return createResponse_('success', issuedUser, 'Login berhasil.', 'OK');
}

/**
 * Handler: auth.google (Optional Google Identity Services ID Token verification)
 */
function handleAuthGoogle_(req) {
  var idToken = String(req.payload.idToken || '').trim();
  if (!idToken) {
    return createResponse_('error', null, 'Google ID token wajib disertakan.', 'VALIDATION_ERROR');
  }

  var rl = checkAuthRateLimit_('google_signin');
  if (!rl.allowed) {
    return createResponse_(
      'error',
      null,
      'Terlalu banyak percobaan login. Silakan tunggu beberapa saat.',
      'FORBIDDEN',
      { retryAfterSeconds: rl.retryAfterSeconds }
    );
  }

  var expectedClientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
  if (!expectedClientId) {
    return createResponse_('error', null, 'Login Google belum diaktifkan pada server ini.', 'FORBIDDEN');
  }

  var verifyUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  var httpRes = UrlFetchApp.fetch(verifyUrl, { muteHttpExceptions: true });
  if (httpRes.getResponseCode() !== 200) {
    recordAuthFailure_(rl);
    return createResponse_('error', null, 'Token Google tidak valid atau telah kedaluwarsa.', 'FORBIDDEN');
  }

  var tokenInfo = JSON.parse(httpRes.getContentText());
  var nowSec = Math.floor(new Date().getTime() / 1000);
  var emailVerified = tokenInfo.email_verified === true || tokenInfo.email_verified === 'true';
  var issuer = String(tokenInfo.iss || '');
  var validIssuer = issuer === 'https://accounts.google.com' || issuer === 'accounts.google.com';

  if (
    !validIssuer ||
    tokenInfo.aud !== expectedClientId ||
    !emailVerified ||
    !tokenInfo.email ||
    Number(tokenInfo.exp || 0) <= nowSec
  ) {
    recordAuthFailure_(rl);
    return createResponse_('error', null, 'Klaim identitas Google tidak memenuhi syarat.', 'FORBIDDEN');
  }

  var email = String(tokenInfo.email).trim().toLowerCase();
  var matchedRole = null;
  var usersRes = readSheetObjects_('USERS');
  if (usersRes.ok) {
    for (var u = 0; u < usersRes.records.length; u++) {
      var uRow = usersRes.records[u];
      if (String(uRow.email || '').trim().toLowerCase() === email && String(uRow.status || '').toUpperCase() === 'ACTIVE') {
        matchedRole = String(uRow.role || 'STAFF').toUpperCase();
        break;
      }
    }
  }

  if (!matchedRole) {
    var allowRes = readSheetObjects_('ALLOWLIST');
    if (!allowRes.ok && !usersRes.ok) return allowRes.errorResponse;
    if (allowRes.ok) {
      for (var i = 0; i < allowRes.records.length; i++) {
        var row = allowRes.records[i];
        if (String(row.email || '').trim().toLowerCase() === email && String(row.status) === 'ACTIVE') {
          matchedRole = String(row.role || 'STAFF').toUpperCase();
          break;
        }
      }
    }
    }

    if (!matchedRole && PropertiesService.getScriptProperties().getProperty('P2_LITE_AUTO_PROVISION') === 'TRUE') {
    var cache = CacheService.getScriptCache();
    var signupRateKey = 'rl:p2signup:global';
    var signupCount = Number(cache.get(signupRateKey) || 0);
    if (signupCount >= 10) {
      return createResponse_('error', null, 'Batas pendaftaran mandiri sementara penuh. Coba beberapa saat lagi.', 'FORBIDDEN', { retryAfterSeconds: 600 });
    }
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
     return createResponse_('error', null, 'Server sedang sibuk.', 'LOCK_TIMEOUT');
    }
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
     var usersSheet = ss.getSheetByName('USERS');
      if (!usersSheet) {
        return createResponse_('error', null, 'Tabel USERS belum diinisialisasi.', 'NOT_FOUND');
      }
      var lastCol = usersSheet.getLastColumn();
      var headers = usersSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
      var nowIso = formatIsoOffset_(new Date());
      var newUserObj = {
        id: generateNextId_(usersSheet, 'USR'),
        email: escapeFormula_(email),
        name: escapeFormula_(String(tokenInfo.name || email.split('@')[0]).trim()),
        role: 'STAFF',
       status: 'ACTIVE',
        password_salt: '',
        password_hash: '',
        pin_salt: '',
        pin_hash: '',
        created_at: nowIso,
        updated_at: nowIso
      };
      var rowVals = buildRowFromObject_(headers, newUserObj);
      usersSheet.getRange(usersSheet.getLastRow() + 1, 1, 1, lastCol).setValues([rowVals]);
      SpreadsheetApp.flush();
      cache.put(signupRateKey, String(signupCount + 1), 600);
      matchedRole = 'STAFF';
    } finally {
      lock.releaseLock();
    }
  }

  if (!matchedRole) {
    recordAuthFailure_(rl);
    return createResponse_('error', null, 'Email Google Anda tidak terdaftar pada daftar izin akses.', 'FORBIDDEN');
  }

  if (ROLE_RANK_[matchedRole] === undefined) matchedRole = 'STAFF';

  clearAuthFailures_(rl);
  var issued = issueSessionToken_(email, matchedRole);
  return createResponse_('success', issued, 'Login Google berhasil.', 'OK');
}

/**
 * Handler: auth.logout (Revokes active token JTI until expiration)
 */
function handleAuthLogout_(req) {
  if (req.session && req.session.jti) {
    var nowSec = Math.floor(new Date().getTime() / 1000);
    var remaining = Math.max(60, Number(req.session.exp || nowSec + 3600) - nowSec);
    CacheService.getScriptCache().put('revoked:' + req.session.jti, '1', Math.min(21600, remaining));
  }
  return createResponse_('success', { loggedOut: true }, 'Sesi berhasil diakhiri.', 'OK');
}

var STEP_UP_ALLOWED_ACTIONS_ = [
  'items.delete',
  'admin.purgeSeed',
  'file.delete',
  'auth.setCredentials'
];

/**
 * Handler: auth.setCredentials (Sets or rotates user passphrase >=12 chars and/or 6-digit step-up PIN in USERS)
 */
function handleAuthSetCredentials_(req) {
  if (!req.session || !req.session.sub) {
    return createResponse_('error', null, 'Sesi otentikasi diperlukan.', 'FORBIDDEN');
  }
  var p = req.payload || {};
  var callerEmail = String(req.session.sub).trim().toLowerCase();
  var callerRole = String(req.session.role || '').toUpperCase();
  var targetEmail = p.email ? String(p.email).trim().toLowerCase() : callerEmail;

  if (targetEmail !== callerEmail && callerRole !== 'ADMIN') {
    return createResponse_('error', null, 'Hanya ADMIN yang dapat mengatur kredensial pengguna lain.', 'FORBIDDEN');
  }

  var newPassphrase = p.newPassphrase !== undefined ? String(p.newPassphrase) : '';
  var newPin = p.newPin !== undefined ? String(p.newPin).trim() : '';
  var currentPassphrase = p.currentPassphrase !== undefined ? String(p.currentPassphrase) : '';

  if (!newPassphrase && !newPin) {
    return createResponse_('error', null, 'Sertakan newPassphrase atau newPin yang akan diperbarui.', 'VALIDATION_ERROR');
  }
  if (newPassphrase && newPassphrase.trim().length < 12) {
    return createResponse_('error', null, 'Passphrase wajib minimal 12 karakter.', 'VALIDATION_ERROR');
  }
  if (newPin && !/^\d{6}$/.test(newPin)) {
    return createResponse_('error', null, 'PIN step-up wajib tepat 6 digit angka.', 'VALIDATION_ERROR');
  }

  var props = PropertiesService.getScriptProperties();
  var pepper = props.getProperty('AUTH_PEPPER') || '';
  var iterations = Number(props.getProperty('ADMIN_PASSPHRASE_ITER') || 2000);

  // Jika ADMIN mengubah pengguna lain, wajib stepUpToken milik ADMIN untuk 'auth.setCredentials'
  if (targetEmail !== callerEmail) {
    if (!verifyAndConsumeStepUp_(req, 'auth.setCredentials')) {
      return createResponse_('error', null, 'Verifikasi PIN step-up diperlukan.', 'FORBIDDEN');
    }
  } else if (callerEmail === 'admin') {
    // Bootstrap 'admin' mengubah kredensial sendiri di ScriptProperties
    var rlAdmin = checkAuthRateLimit_('admin');
    if (!rlAdmin.allowed) {
      return createResponse_('error', null, 'Terlalu banyak percobaan gagal.', 'FORBIDDEN', { retryAfterSeconds: rlAdmin.retryAfterSeconds });
    }
    var adminSalt = props.getProperty('ADMIN_PASSPHRASE_SALT') || '';
    var adminHash = props.getProperty('ADMIN_PASSPHRASE_HASH') || '';
    if (!currentPassphrase || currentPassphrase.trim().length < 12 || !adminSalt || !adminHash) {
      recordAuthFailure_(rlAdmin);
      return createResponse_('error', null, 'currentPassphrase wajib disertakan dan valid.', 'FORBIDDEN');
    }
    var candAdmin = computeIteratedHash_(currentPassphrase.trim(), adminSalt, pepper, iterations);
    if (!constantTimeEqual_(candAdmin, adminHash)) {
      recordAuthFailure_(rlAdmin);
      return createResponse_('error', null, 'currentPassphrase tidak sesuai.', 'FORBIDDEN');
    }
    clearAuthFailures_(rlAdmin);
    var existingAdminPinHash = props.getProperty('ADMIN_PIN_HASH') || '';
    if (newPin && existingAdminPinHash) {
      if (!verifyAndConsumeStepUp_(req, 'auth.setCredentials')) {
        return createResponse_('error', null, 'Verifikasi PIN step-up diperlukan.', 'FORBIDDEN');
      }
    }
    if (newPassphrase) {
      var newAdminSalt = generateRandomSecret_(16);
      props.setProperty('ADMIN_PASSPHRASE_SALT', newAdminSalt);
      props.setProperty('ADMIN_PASSPHRASE_HASH', computeIteratedHash_(newPassphrase.trim(), newAdminSalt, pepper, iterations));
    }
    if (newPin) {
      var newAdminPinSalt = generateRandomSecret_(16);
      props.setProperty('ADMIN_PIN_SALT', newAdminPinSalt);
      props.setProperty('ADMIN_PIN_HASH', computeIteratedHash_(newPin, newAdminPinSalt, pepper, iterations));
    }
    return createResponse_('success', { email: 'admin', updated: true }, 'Kredensial admin berhasil diperbarui.', 'OK');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('USERS');
    if (!sheet || sheet.getLastRow() <= 1) {
      return createResponse_('error', null, 'Tabel USERS belum tersedia.', 'NOT_FOUND');
    }
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var emailIdx = headers.indexOf('email');
    var passSaltIdx = headers.indexOf('password_salt');
    var passHashIdx = headers.indexOf('password_hash');
    var pinSaltIdx = headers.indexOf('pin_salt');
    var pinHashIdx = headers.indexOf('pin_hash');
    var updatedIdx = headers.indexOf('updated_at');

    var targetRowNumber = -1;
    var existingRow = null;
    for (var r = 0; r < allData.length; r++) {
      if (String(allData[r][emailIdx] || '').trim().toLowerCase() === targetEmail) {
        targetRowNumber = r + 2;
        existingRow = allData[r];
        break;
      }
    }
    if (targetRowNumber === -1) {
      return createResponse_('error', null, 'Pengguna tidak ditemukan pada tabel USERS.', 'NOT_FOUND');
    }

    if (targetEmail === callerEmail) {
      var rlSelf = checkAuthRateLimit_(callerEmail);
      if (!rlSelf.allowed) {
        return createResponse_('error', null, 'Terlalu banyak percobaan gagal.', 'FORBIDDEN', { retryAfterSeconds: rlSelf.retryAfterSeconds });
      }
      var curSalt = passSaltIdx >= 0 ? String(existingRow[passSaltIdx] || '') : '';
      var curHash = passHashIdx >= 0 ? String(existingRow[passHashIdx] || '') : '';
      // Jika akun sudah punya password_hash (atau bahkan jika P2-lite, currentPassphrase wajib saat punya hash; jika belum punya hash maka wajib menyertakan currentPassphrase minimal 12 karakter atau gagal bila kosong)
      if (!currentPassphrase || (curHash && (!curSalt || !constantTimeEqual_(computeIteratedHash_(currentPassphrase.trim(), curSalt, pepper, iterations), curHash)))) {
        recordAuthFailure_(rlSelf);
        return createResponse_('error', null, 'currentPassphrase wajib disertakan dan valid.', 'FORBIDDEN');
      }
      clearAuthFailures_(rlSelf);

      var existingPinHash = pinHashIdx >= 0 ? String(existingRow[pinHashIdx] || '').trim() : '';
      if (newPin && existingPinHash) {
        if (!verifyAndConsumeStepUp_(req, 'auth.setCredentials')) {
          return createResponse_('error', null, 'Verifikasi PIN step-up diperlukan.', 'FORBIDDEN');
        }
      }
    }

    if (newPassphrase && passSaltIdx >= 0 && passHashIdx >= 0) {
      var pSalt = generateRandomSecret_(16);
      existingRow[passSaltIdx] = pSalt;
      existingRow[passHashIdx] = computeIteratedHash_(newPassphrase.trim(), pSalt, pepper, iterations);
    }
    if (newPin && pinSaltIdx >= 0 && pinHashIdx >= 0) {
      var pinSalt = generateRandomSecret_(16);
      existingRow[pinSaltIdx] = pinSalt;
      existingRow[pinHashIdx] = computeIteratedHash_(newPin, pinSalt, pepper, iterations);
    }
    if (updatedIdx >= 0) existingRow[updatedIdx] = formatIsoOffset_(new Date());

    sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([existingRow]);
    SpreadsheetApp.flush();
    return createResponse_('success', { email: targetEmail, updated: true }, 'Kredensial berhasil diperbarui.', 'OK');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handler: auth.verifyPin (Step-up 6-digit PIN verification after primary login; server-scoped action)
 */
function handleAuthVerifyPin_(req) {
  if (!req.session || !req.session.sub) {
    return createResponse_('error', null, 'Sesi login aktif diperlukan untuk verifikasi PIN.', 'FORBIDDEN');
  }
  var p = req.payload || {};
  var pin = String(p.pin || '').trim();
  var targetAction = String(p.targetAction || '').trim();

  if (STEP_UP_ALLOWED_ACTIONS_.indexOf(targetAction) === -1) {
    return createResponse_('error', null, 'Action tujuan step-up tidak diizinkan oleh server.', 'VALIDATION_ERROR');
  }

  var subEmail = String(req.session.sub).trim().toLowerCase();
  var cache = CacheService.getScriptCache();
  var pinFailKey = 'rl:pin:' + subEmail.slice(0, 120);
  var failCount = Number(cache.get(pinFailKey) || 0);
  if (failCount >= 3) {
    if (req.session.jti) cache.put('revoked:' + req.session.jti, '1', 7200);
    return createResponse_('error', null, 'Terlalu banyak kegagalan PIN. Sesi dicabut.', 'FORBIDDEN', { retryAfterSeconds: 900 });
  }

  if (!/^\d{6}$/.test(pin)) {
    cache.put(pinFailKey, String(failCount + 1), 900);
    return createResponse_('error', null, 'PIN wajib terdiri dari 6 digit angka.', 'VALIDATION_ERROR');
  }

  var props = PropertiesService.getScriptProperties();
  var pepper = props.getProperty('AUTH_PEPPER') || '';
  var iterations = Number(props.getProperty('ADMIN_PASSPHRASE_ITER') || 2000);
  var pinSalt = 'dummy_pin_salt_anti_timing_000000';
  var pinHash = '';
  var foundIdentity = false;

  if (subEmail === 'admin') {
    var adminPinSalt = props.getProperty('ADMIN_PIN_SALT') || '';
    var adminPinHash = props.getProperty('ADMIN_PIN_HASH') || '';
    if (adminPinSalt && adminPinHash) {
      pinSalt = adminPinSalt;
      pinHash = adminPinHash;
      foundIdentity = true;
    }
  }

  if (!foundIdentity) {
    var usersRes = readSheetObjects_('USERS', true);
    if (!usersRes.ok) return usersRes.errorResponse;
    for (var i = 0; i < usersRes.records.length; i++) {
      var row = usersRes.records[i];
      if (String(row.email || '').trim().toLowerCase() === subEmail && String(row.status || '').toUpperCase() === 'ACTIVE') {
        pinSalt = row.pin_salt ? String(row.pin_salt) : pinSalt;
        pinHash = row.pin_hash ? String(row.pin_hash) : '';
        foundIdentity = true;
        break;
      }
    }
  }

  var candidatePinHash = computeIteratedHash_(pin, pinSalt, pepper, iterations);

  if (!foundIdentity || !pinHash || !constantTimeEqual_(candidatePinHash, pinHash)) {
    var nextFail = failCount + 1;
    cache.put(pinFailKey, String(nextFail), 900);
    if (nextFail >= 3 && req.session.jti) {
      cache.put('revoked:' + req.session.jti, '1', 7200);
    }
    return createResponse_('error', null, 'PIN tidak valid.', 'FORBIDDEN');
  }

  cache.remove(pinFailKey);
  var stepUpToken = Utilities.getUuid();
  cache.put('stepup:' + stepUpToken, JSON.stringify({ sub: subEmail, action: targetAction }), 300);
  return createResponse_('success', { stepUpToken: stepUpToken, targetAction: targetAction, expiresInSeconds: 300 }, 'Verifikasi PIN berhasil.', 'OK');
}

function verifyAndConsumeStepUp_(req, expectedAction) {
  var token = req.payload && req.payload.stepUpToken ? String(req.payload.stepUpToken).trim() : '';
  if (!token || !req.session || !req.session.sub) return false;
  var cache = CacheService.getScriptCache();
  var raw = cache.get('stepup:' + token);
  if (!raw) return false;
  try {
    var data = JSON.parse(raw);
    if (data.sub !== String(req.session.sub).trim().toLowerCase() || data.action !== expectedAction) {
      return false;
    }
    cache.remove('stepup:' + token);
    return true;
  } catch (e) {
    return false;
  }
}