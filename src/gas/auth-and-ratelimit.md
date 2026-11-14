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
  var accountId = String(req.payload.account || 'admin').trim().toLowerCase();
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
  var storedSalt = props.getProperty('ADMIN_PASSPHRASE_SALT');
  var storedHash = props.getProperty('ADMIN_PASSPHRASE_HASH');
  var pepper = props.getProperty('AUTH_PEPPER') || '';
  var iterations = Number(props.getProperty('ADMIN_PASSPHRASE_ITER') || 2000);

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
  var allowRes = readSheetObjects_('ALLOWLIST');
  if (!allowRes.ok) return allowRes.errorResponse;

  var matchedRole = null;
  for (var i = 0; i < allowRes.records.length; i++) {
    var row = allowRes.records[i];
    if (String(row.email || '').trim().toLowerCase() === email && String(row.status) === 'ACTIVE') {
      matchedRole = String(row.role || 'STAFF').toUpperCase();
      break;
    }
  }

  if (!matchedRole) {
    recordAuthFailure_(rl);
    return createResponse_('error', null, 'Email Google Anda tidak terdaftar pada daftar izin akses.', 'FORBIDDEN');
  }

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
```