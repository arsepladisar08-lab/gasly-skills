<!-- KB_VERSION: 2.1.0 -->
# ROUTER, CENTRAL ACTION REGISTRY & ENVELOPE HELPERS (`gas/router-and-envelope.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-data`.

## Daftar Isi
1. [Arsitektur Entrypoint `doPost(e)` dan `doGet(e)`](#1-arsitektur-entrypoint-doposte-dan-dogete)
2. [Central Action Registry (Allowlist & Penegakan Profil)](#2-central-action-registry-allowlist--penegakan-profil)
3. [Boilerplate Kode Router & Envelope (`router.gs`)](#3-boilerplate-kode-router--envelope-routergs)

---

## 1. Arsitektur Entrypoint `doPost(e)` dan `doGet(e)`

1. **Mengapa `try / catch` Terluar Wajib:**
   Apabila kode di dalam `doPost(e)` atau `doGet(e)` melempar eksepsi yang tidak tertangkap (*uncaught error*), runtime Google Apps Script akan merespons dengan halaman HTML error internal Google yang tidak menyertakan header `Access-Control-Allow-Origin`. Browser di sisi client akan melaporkan kegagalan tersebut sebagai **CORS Error**, sehingga menyulitkan proses debugging.
2. **Ekstraksi Request:**
   - Pada `doPost(e)`, baca string JSON dari `e && e.postData && e.postData.contents`.
   - Pada `doGet(e)`, baca parameter dari `e && e.parameter` (`action`, `v`, `auth`, `idem`, serta `payload` yang di-parse dari string JSON bila ada).
   - Jangan pernah memanggil metode baca pada request `GET` untuk mengeksekusi aksi mutasi (`requiresPost: true`).

---

## 2. Central Action Registry (Allowlist & Penegakan Profil)

Setiap `action` didefinisikan di dalam objek konstanta `ACTION_REGISTRY_` dengan properti:
- `handler`: Referensi fungsi internal (`fn_(req, session)`).
- `method`: `'POST'` atau `'ANY'` (`'GET'` hanya diizinkan pada aksi baca bila `method === 'ANY'`).
- `access`: Aturan izin berdasarkan profil aktif (`P1`, `P3`, `P4`), misalnya `{ P1: 'PUBLIC', P3: 'PUBLIC', P4: 'STAFF' }` atau `{ P1: 'ADMIN', P3: 'ADMIN', P4: 'ADMIN' }`.
- `requireIdem`: Boolean yang mewajibkan keberadaan kunci `idem` pada request mutasi.

---

## 3. Boilerplate Kode Router & Envelope (`router.gs`)

```javascript
// FILE: router.gs
// Runtime: Google Apps Script V8

var SUPPORTED_API_VERSION = 1;
var ROLE_RANK_ = {
  PUBLIC: 0,
  STAFF: 1,
  MANAGER: 2,
  ADMIN: 3
};

function formatIsoOffset_(dateObj) {
  var tz = Session.getScriptTimeZone() || DEFAULT_TZ;
  return Utilities.formatDate(dateObj || new Date(), tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
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
    Object.keys(val).forEach(function(k) {
      out[k] = sanitizeForClient_(val[k]);
    });
    return out;
  }
  return val;
}

function createResponse_(status, data, message, code, extraMeta) {
  var props = PropertiesService.getScriptProperties();
  var meta = {
    schemaVersion: props.getProperty('SCHEMA_VERSION') || SCHEMA_VERSION,
    timestamp: formatIsoOffset_(new Date())
  };
  if (extraMeta && typeof extraMeta === 'object') {
    Object.keys(extraMeta).forEach(function(k) {
      meta[k] = extraMeta[k];
    });
  }
  return {
    status: status,
    data: data !== undefined ? sanitizeForClient_(data) : null,
    message: message || '',
    code: code || (status === 'success' ? 'OK' : 'INTERNAL_ERROR'),
    meta: meta
  };
}

function sendJsonOutput_(envelope) {
  return ContentService.createTextOutput(JSON.stringify(envelope))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Central Action Registry (Allowlist).
 * Every supported action and its minimum role per Access Profile is declared here.
 */
function getActionRegistry_() {
  return {
    'auth.login': {
      method: 'POST',
      requireIdem: false,
      rolesByProfile: { P1: 'PUBLIC', P3: 'PUBLIC', P4: 'PUBLIC' },
      handler: handleAuthLogin_
    },
    'auth.google': {
      method: 'POST',
      requireIdem: false,
      rolesByProfile: { P1: 'PUBLIC', P3: 'PUBLIC', P4: 'PUBLIC' },
      handler: handleAuthGoogle_
    },
    'auth.logout': {
      method: 'POST',
      requireIdem: false,
      rolesByProfile: { P1: 'STAFF', P3: 'ADMIN', P4: 'STAFF' },
      handler: handleAuthLogout_
    },
    'items.list': {
      method: 'ANY',
      requireIdem: false,
      rolesByProfile: { P1: 'PUBLIC', P3: 'PUBLIC', P4: 'STAFF' },
      handler: handleItemsList_
    },
    'items.get': {
      method: 'ANY',
      requireIdem: false,
      rolesByProfile: { P1: 'PUBLIC', P3: 'PUBLIC', P4: 'STAFF' },
      handler: handleItemsGet_
    },
    'items.create': {
      method: 'POST',
      requireIdem: true,
      rolesByProfile: { P1: 'ADMIN', P3: 'PUBLIC', P4: 'STAFF' },
      handler: handleItemsCreate_
    },
    'items.update': {
      method: 'POST',
      requireIdem: true,
      rolesByProfile: { P1: 'ADMIN', P3: 'ADMIN', P4: 'STAFF' },
      handler: handleItemsUpdate_
    },
    'items.delete': {
      method: 'POST',
      requireIdem: true,
      rolesByProfile: { P1: 'ADMIN', P3: 'ADMIN', P4: 'ADMIN' },
      handler: handleItemsDelete_
    },
    'file.ticket': {
      method: 'POST',
      requireIdem: false,
      rolesByProfile: { P1: 'ADMIN', P3: 'PUBLIC', P4: 'STAFF' },
      handler: handleFileTicket_
    },
    'file.upload': {
      method: 'POST',
      requireIdem: true,
      rolesByProfile: { P1: 'ADMIN', P3: 'PUBLIC', P4: 'STAFF' },
      handler: handleFileUpload_
    },
    'admin.purgeSeed': {
      method: 'POST',
      requireIdem: true,
      rolesByProfile: { P1: 'ADMIN', P3: 'ADMIN', P4: 'ADMIN' },
      handler: handleAdminPurgeSeed_
    },
    'admin.diagnostics': {
      method: 'POST',
      requireIdem: false,
      rolesByProfile: { P1: 'ADMIN', P3: 'ADMIN', P4: 'ADMIN' },
      handler: handleAdminDiagnostics_
    },
    'webhook.receive': {
      method: 'POST',
      requireIdem: true,
      rolesByProfile: { P1: 'PUBLIC', P3: 'PUBLIC', P4: 'PUBLIC' },
      handler: handleWebhookReceive_
    }
  };
}

function dispatchRequest_(httpMethod, rawReq) {
  if (!rawReq || typeof rawReq !== 'object') {
    return createResponse_('error', null, 'Format request JSON tidak valid.', 'VALIDATION_ERROR');
  }

  var action = String(rawReq.action || '').trim();
  var version = Number(rawReq.v);
  if (!action) {
    return createResponse_('error', null, 'Parameter action wajib disertakan.', 'VALIDATION_ERROR');
  }
  if (version !== SUPPORTED_API_VERSION) {
    return createResponse_('error', null, 'Versi protokol API v=' + rawReq.v + ' tidak didukung.', 'VALIDATION_ERROR');
  }

  var registry = getActionRegistry_();
  var route = registry[action];
  if (!route) {
    return createResponse_('error', null, 'Action tidak terdaftar: ' + action, 'NOT_FOUND');
  }

  if (route.method === 'POST' && httpMethod !== 'POST') {
    return createResponse_('error', null, 'Action ' + action + ' wajib menggunakan metode HTTP POST.', 'VALIDATION_ERROR');
  }

  var idemKey = rawReq.idem ? String(rawReq.idem).trim() : '';
  if (route.requireIdem && (!idemKey || idemKey.length < 8 || idemKey.length > 128)) {
    return createResponse_('error', null, 'Action mutasi wajib menyertakan kunci idempotensi (idem) yang valid.', 'VALIDATION_ERROR');
  }

  // Enforce Access Profile & Role authorization
  var activeProfile = PropertiesService.getScriptProperties().getProperty('ACCESS_PROFILE') || ACCESS_PROFILE;
  var requiredRole = route.rolesByProfile[activeProfile] || 'ADMIN';
  var requiredRank = ROLE_RANK_[requiredRole] !== undefined ? ROLE_RANK_[requiredRole] : 3;

  var session = null;
  if (requiredRank > 0 || rawReq.auth) {
    var tokenResult = verifySessionToken_(rawReq.auth);
    if (!tokenResult.ok) {
      if (requiredRank > 0) {
        return createResponse_('error', null, tokenResult.message, 'FORBIDDEN');
      }
    } else {
      session = tokenResult.session;
    }
  }

  var callerRank = session && ROLE_RANK_[session.role] !== undefined ? ROLE_RANK_[session.role] : 0;
  if (callerRank < requiredRank) {
    return createResponse_('error', null, 'Akses ditolak. Peran minimum yang dibutuhkan: ' + requiredRole, 'FORBIDDEN');
  }

  // Check idempotency cache before running mutating handler
  if (route.requireIdem && idemKey) {
    var cachedReplay = getIdempotentResponse_(action, idemKey);
    if (cachedReplay) {
      cachedReplay.meta = cachedReplay.meta || {};
      cachedReplay.meta.idempotentReplay = true;
      return cachedReplay;
    }
  }

  var reqContext = {
    action: action,
    v: version,
    idem: idemKey,
    payload: rawReq.payload && typeof rawReq.payload === 'object' ? rawReq.payload : {},
    session: session,
    profile: activeProfile
  };

  var responseEnvelope = route.handler(reqContext);

  // Store successful mutation response in idempotency cache
  if (route.requireIdem && idemKey && responseEnvelope && responseEnvelope.status === 'success') {
    saveIdempotentResponse_(action, idemKey, responseEnvelope);
  }

  return responseEnvelope;
}

function doPost(e) {
  try {
    if (!e || !e.postData || typeof e.postData.contents !== 'string') {
      return sendJsonOutput_(createResponse_('error', null, 'Body POST kosong atau tidak terbaca.', 'VALIDATION_ERROR'));
    }
    var parsed;
    try {
      parsed = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return sendJsonOutput_(createResponse_('error', null, 'Body POST bukan string JSON yang valid.', 'VALIDATION_ERROR'));
    }
    return sendJsonOutput_(dispatchRequest_('POST', parsed));
  } catch (err) {
    console.error('Uncaught doPost error:', err);
    return sendJsonOutput_(createResponse_('error', null, 'Terjadi kesalahan internal pada server.', 'INTERNAL_ERROR'));
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var payloadObj = {};
    if (params.payload) {
      try {
        payloadObj = JSON.parse(params.payload);
      } catch (pErr) {
        return sendJsonOutput_(createResponse_('error', null, 'Query parameter payload bukan JSON yang valid.', 'VALIDATION_ERROR'));
      }
    }
    var reqObj = {
      action: params.action || '',
      v: params.v !== undefined ? Number(params.v) : 1,
      auth: params.auth || null,
      idem: params.idem || null,
      payload: payloadObj
    };
    return sendJsonOutput_(dispatchRequest_('GET', reqObj));
  } catch (err) {
    console.error('Uncaught doGet error:', err);
    return sendJsonOutput_(createResponse_('error', null, 'Terjadi kesalahan internal pada server.', 'INTERNAL_ERROR'));
  }
}
```