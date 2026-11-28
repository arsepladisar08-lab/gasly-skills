
/**
 * DapurSaji — Headless Backend API
 * Google Apps Script V8
 * GASLY KB 2.1.0
 *
 * Transport:
 * POST text/plain;charset=utf-8
 * GET query parameters for read-only actions
 */

var SUPPORTED_API_VERSION = 1;
var CACHE_CHUNK_SIZE_ = 80000;

var ROLE_RANK_ = {
  PUBLIC: 0,
  STAFF: 1,
  MANAGER: 2,
  ADMIN: 3
};

var HIDDEN_SECURITY_COLUMNS_ = [
  'upload_nonce',
  'tracking_token_hash'
];

var ACTION_REGISTRY_ = {
  'catalog.list': {
    method: 'ANY',
    role: 'PUBLIC',
    rateLimit: true,
    handler: handleCatalogList_
  },
  'order.create': {
    method: 'POST',
    role: 'PUBLIC',
    requireIdem: true,
    rateLimit: true,
    handler: handleOrderCreate_
  },
  'order.track': {
    method: 'POST',
    role: 'PUBLIC',
    rateLimit: true,
    handler: handleOrderTrack_
  },
  'file.ticket': {
    method: 'POST',
    role: 'PUBLIC',
    requireIdem: true,
    rateLimit: true,
    handler: handleFileTicket_
  },
  'file.upload': {
    method: 'POST',
    role: 'PUBLIC',
    requireIdem: true,
    rateLimit: true,
    handler: handleFileUpload_
  },
  'auth.login': {
    method: 'POST',
    role: 'PUBLIC',
    rateLimit: true,
    handler: handleAuthLogin_
  },
  'auth.logout': {
    method: 'POST',
    role: 'ADMIN',
    handler: handleAuthLogout_
  },
  'order.adminList': {
    method: 'POST',
    role: 'ADMIN',
    rateLimit: true,
    handler: handleOrderAdminList_
  },
  'order.updateStatus': {
    method: 'POST',
    role: 'ADMIN',
    requireIdem: true,
    rateLimit: true,
    handler: handleOrderUpdateStatus_
  },
  'file.adminView': {
    method: 'POST',
    role: 'ADMIN',
    rateLimit: true,
    handler: handleFileAdminView_
  },
  'catalog.save': {
    method: 'POST',
    role: 'ADMIN',
    requireIdem: true,
    rateLimit: true,
    handler: handleCatalogSave_
  }
};

/* =========================================================
 * ENVELOPE AND TRANSPORT
 * ======================================================= */

function formatIsoOffset_(dateObj) {
  var tz = Session.getScriptTimeZone() || DEFAULT_TZ;

  return Utilities.formatDate(
    dateObj || new Date(),
    tz,
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  );
}

function sanitizeForClient_(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return formatIsoOffset_(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForClient_);
  }

  if (typeof value === 'object') {
    var output = {};

    Object.keys(value).forEach(function(key) {
      output[key] = sanitizeForClient_(value[key]);
    });

    return output;
  }

  return value;
}

function createResponse_(
  status,
  data,
  message,
  code,
  extraMeta
) {
  var props = PropertiesService.getScriptProperties();

  var meta = {
    schemaVersion:
      props.getProperty('SCHEMA_VERSION') || SCHEMA_VERSION,
    timestamp: formatIsoOffset_(new Date())
  };

  if (extraMeta && typeof extraMeta === 'object') {
    Object.keys(extraMeta).forEach(function(key) {
      meta[key] = extraMeta[key];
    });
  }

  return {
    status: status,
    data: data === undefined ? null : sanitizeForClient_(data),
    message: String(message || ''),
    code: code || (
      status === 'success' ? 'OK' : 'INTERNAL_ERROR'
    ),
    meta: meta
  };
}

function sendJsonOutput_(envelope) {
  return ContentService
    .createTextOutput(JSON.stringify(envelope))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (
      !e ||
      !e.postData ||
      typeof e.postData.contents !== 'string'
    ) {
      return sendJsonOutput_(
        createResponse_(
          'error',
          null,
          'Body request tidak ditemukan.',
          'VALIDATION_ERROR'
        )
      );
    }

    var request;

    try {
      request = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return sendJsonOutput_(
        createResponse_(
          'error',
          null,
          'Format JSON tidak valid.',
          'VALIDATION_ERROR'
        )
      );
    }

    return sendJsonOutput_(
      dispatchRequest_('POST', request)
    );
  } catch (error) {
    console.error('doPost internal error:', error);

    return sendJsonOutput_(
      createResponse_(
        'error',
        null,
        'Terjadi kesalahan internal server.',
        'INTERNAL_ERROR'
      )
    );
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var payload = {};

    if (params.payload) {
      try {
        payload = JSON.parse(params.payload);
      } catch (parseError) {
        return sendJsonOutput_(
          createResponse_(
            'error',
            null,
            'Payload GET bukan JSON valid.',
            'VALIDATION_ERROR'
          )
        );
      }
    }

    return sendJsonOutput_(
      dispatchRequest_('GET', {
        action: params.action || '',
        v: params.v === undefined ? 1 : Number(params.v),
        auth: params.auth || null,
        idem: params.idem || null,
        payload: payload
      })
    );
  } catch (error) {
    console.error('doGet internal error:', error);

    return sendJsonOutput_(
      createResponse_(
        'error',
        null,
        'Terjadi kesalahan internal server.',
        'INTERNAL_ERROR'
      )
    );
  }
}

function dispatchRequest_(method, rawRequest) {
  if (!rawRequest || typeof rawRequest !== 'object') {
    return createResponse_(
      'error',
      null,
      'Request tidak valid.',
      'VALIDATION_ERROR'
    );
  }

  var action = String(rawRequest.action || '').trim();
  var version = Number(rawRequest.v);

  if (!action) {
    return createResponse_(
      'error',
      null,
      'Action wajib disertakan.',
      'VALIDATION_ERROR'
    );
  }

  if (version !== SUPPORTED_API_VERSION) {
    return createResponse_(
      'error',
      null,
      'Versi API tidak didukung.',
      'VALIDATION_ERROR'
    );
  }

  var route = ACTION_REGISTRY_[action];

  if (!route) {
    return createResponse_(
      'error',
      null,
      'Action tidak ditemukan.',
      'NOT_FOUND'
    );
  }

  if (route.method === 'POST' && method !== 'POST') {
    return createResponse_(
      'error',
      null,
      'Action wajib menggunakan POST.',
      'VALIDATION_ERROR'
    );
  }

  var idem = String(rawRequest.idem || '').trim();

  if (
    route.requireIdem &&
    (idem.length < 8 || idem.length > 128)
  ) {
    return createResponse_(
      'error',
      null,
      'Idempotency key wajib diisi.',
      'VALIDATION_ERROR'
    );
  }

  var profile = PropertiesService
    .getScriptProperties()
    .getProperty('ACCESS_PROFILE') || ACCESS_PROFILE;

  if (profile !== 'P3') {
    return createResponse_(
      'error',
      null,
      'Access Profile server tidak sesuai konfigurasi.',
      'INTERNAL_ERROR'
    );
  }

  var requiredRank = ROLE_RANK_[route.role];
  var session = null;

  if (requiredRank > 0 || rawRequest.auth) {
    var verification = verifySessionToken_(
      String(rawRequest.auth || '')
    );

    if (!verification.ok) {
      if (requiredRank > 0) {
        return createResponse_(
          'error',
          null,
          'Sesi tidak valid atau telah berakhir.',
          'FORBIDDEN'
        );
      }
    } else {
      session = verification.session;
    }
  }

  var callerRank = session
    ? ROLE_RANK_[session.role] || 0
    : 0;

  if (callerRank < requiredRank) {
    return createResponse_(
      'error',
      null,
      'Akses ditolak.',
      'FORBIDDEN'
    );
  }

  if (route.rateLimit) {
    var rate = checkRequestRateLimit_(action, session, rawRequest);

    if (!rate.allowed) {
      return createResponse_(
        'error',
        null,
        'Batas permintaan tercapai. Silakan coba kembali.',
        'RATE_LIMITED',
        { retryAfterSeconds: rate.retryAfterSeconds }
      );
    }
  }

  if (route.requireIdem) {
    var replay = getIdempotentResponse_(action, idem);

    if (replay) {
      replay.meta.idempotentReplay = true;
      return replay;
    }
  }

  var request = {
    action: action,
    v: version,
    idem: idem,
    payload: rawRequest.payload &&
      typeof rawRequest.payload === 'object'
        ? rawRequest.payload
        : {},
    session: session,
    profile: profile
  };

  var response = route.handler(request);

  if (
    route.requireIdem &&
    response &&
    response.status === 'success'
  ) {
    saveIdempotentResponse_(action, idem, response);
  }

  return response;
}

/* =========================================================
 * CACHE, IDEMPOTENCY AND RATE LIMIT
 * ======================================================= */

function cachePutChunked_(key, value, ttl) {
  var cache = CacheService.getScriptCache();
  var textValue = String(value);
  var duration = Math.min(
    21600,
    Math.max(1, Number(ttl) || 600)
  );

  if (textValue.length <= CACHE_CHUNK_SIZE_) {
    cache.put(key, textValue, duration);
    return;
  }

  var count = Math.ceil(
    textValue.length / CACHE_CHUNK_SIZE_
  );

  var batch = {};

  for (var i = 0; i < count; i++) {
    batch[key + ':c:' + i] = textValue.slice(
      i * CACHE_CHUNK_SIZE_,
      (i + 1) * CACHE_CHUNK_SIZE_
    );
  }

  batch[key] = JSON.stringify({
    __chunked: true,
    count: count
  });

  cache.putAll(batch, duration);
}

function cacheGetChunked_(key) {
  var cache = CacheService.getScriptCache();
  var value = cache.get(key);

  if (!value) {
    return null;
  }

  if (value.indexOf('{"__chunked":true') !== 0) {
    return value;
  }

  try {
    var metadata = JSON.parse(value);
    var keys = [];

    for (var i = 0; i < metadata.count; i++) {
      keys.push(key + ':c:' + i);
    }

    var chunks = cache.getAll(keys);
    var output = [];

    for (var j = 0; j < metadata.count; j++) {
      var part = chunks[key + ':c:' + j];

      if (part === undefined || part === null) {
        return null;
      }

      output.push(part);
    }

    return output.join('');
  } catch (error) {
    return null;
  }
}

function getIdempotentResponse_(action, key) {
  var raw = cacheGetChunked_(
    'idem:' + action + ':' + key
  );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function saveIdempotentResponse_(action, key, response) {
  try {
    cachePutChunked_(
      'idem:' + action + ':' + key,
      JSON.stringify(response),
      600
    );
  } catch (error) {
    console.error('Idempotency cache error:', error);
  }
}

function checkRequestRateLimit_(action, session, request) {
  var cache = CacheService.getScriptCache();
  var subject = session
    ? String(session.sub)
    : String(
        request.payload.order_id ||
        request.payload.entityId ||
        request.payload.account ||
        'public'
      );

  var digest = base64UrlEncodeString_(subject).slice(0, 80);
  var key = 'rl:req:' + action + ':' + digest;
  var globalKey = 'rl:req:global';

  var count = Number(cache.get(key) || 0);
  var globalCount = Number(cache.get(globalKey) || 0);

  var max = action === 'order.track' ? 30 : 60;

  if (count >= max || globalCount >= 300) {
    return {
      allowed: false,
      retryAfterSeconds: 60
    };
  }

  cache.put(key, String(count + 1), 60);
  cache.put(globalKey, String(globalCount + 1), 60);

  return { allowed: true };
}

function checkAuthRateLimit_(account) {
  var cache = CacheService.getScriptCache();
  var props = PropertiesService.getScriptProperties();

  var threshold = Number(
    props.getProperty('LOCKOUT_THRESHOLD') || 5
  );

  var duration = Number(
    props.getProperty('LOCKOUT_DURATION_SEC') || 900
  );

  var key = 'rl:fail:' +
    base64UrlEncodeString_(
      String(account || 'admin').toLowerCase()
    ).slice(0, 100);

  var globalKey = 'rl:fail:global';

  var accountCount = Number(cache.get(key) || 0);
  var globalCount = Number(cache.get(globalKey) || 0);

  if (accountCount >= threshold || globalCount >= 30) {
    return {
      allowed: false,
      key: key,
      globalKey: globalKey,
      duration: duration,
      retryAfterSeconds: duration
    };
  }

  return {
    allowed: true,
    key: key,
    globalKey: globalKey,
    duration: duration
  };
}

function recordAuthFailure_(state) {
  var cache = CacheService.getScriptCache();

  cache.put(
    state.key,
    String(Number(cache.get(state.key) || 0) + 1),
    state.duration
  );

  cache.put(
    state.globalKey,
    String(Number(cache.get(state.globalKey) || 0) + 1),
    600
  );
}

function clearAuthFailures_(state) {
  if (state && state.key) {
    CacheService.getScriptCache().remove(state.key);
  }
}

/* =========================================================
 * CRYPTOGRAPHY AND AUTHENTICATION
 * ======================================================= */

function base64UrlEncodeBytes_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes)
    .replace(/=+$/, '');
}

function base64UrlEncodeString_(value) {
  return base64UrlEncodeBytes_(
    Utilities.newBlob(
      String(value),
      'text/plain'
    ).getBytes()
  );
}

function base64UrlDecodeToString_(value) {
  var clean = String(value || '').replace(/\s+/g, '');
  var padding = (4 - clean.length % 4) % 4;

  var decoded = Utilities.base64DecodeWebSafe(
    clean + '===='.slice(0, padding)
  );

  return Utilities.newBlob(decoded).getDataAsString('UTF-8');
}

function constantTimeEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  var diff = a.length ^ b.length;
  var maxLength = Math.max(a.length, b.length);

  for (var i = 0; i < maxLength; i++) {
    var ca = i < a.length ? a.charCodeAt(i) : 0;
    var cb = i < b.length ? b.charCodeAt(i) : 0;

    diff |= ca ^ cb;
  }

  return diff === 0;
}

function computeIteratedHash_(
  passphrase,
  salt,
  pepper,
  iterations
) {
  var count = Math.max(
    1000,
    Number(iterations) || 2000
  );

  var initial = Utilities.newBlob(
    salt + ':' + passphrase + ':' + pepper,
    'text/plain'
  ).getBytes();

  var saltBytes = Utilities.newBlob(
    salt,
    'text/plain'
  ).getBytes();

  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    initial
  );

  for (var i = 1; i < count; i++) {
    digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      digest.concat(saltBytes)
    );
  }

  return base64UrlEncodeBytes_(digest);
}

function computeHmacSignature_(data, secret) {
  var dataBytes = Utilities.newBlob(
    String(data),
    'text/plain'
  ).getBytes();

  var secretBytes = Utilities.newBlob(
    String(secret),
    'text/plain'
  ).getBytes();

  var signature = Utilities.computeHmacSha256Signature(
    dataBytes,
    secretBytes
  );

  return base64UrlEncodeBytes_(signature);
}

function issueSessionToken_(subject, role) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('AUTH_HMAC_SECRET');

  if (!secret) {
    throw new Error('AUTH_HMAC_SECRET belum tersedia.');
  }

  var ttl = Number(
    props.getProperty('SESSION_TTL_SECONDS') || 7200
  );

  var now = Math.floor(Date.now() / 1000);

  var payload = {
    sub: String(subject),
    role: String(role),
    iat: now,
    exp: now + ttl,
    jti: Utilities.getUuid()
  };

  var encoded = base64UrlEncodeString_(
    JSON.stringify(payload)
  );

  var signature = computeHmacSignature_(
    encoded,
    secret
  );

  return {
    token: encoded + '.' + signature,
    role: payload.role,
    expiresAt: formatIsoOffset_(
      new Date((now + ttl) * 1000)
    )
  };
}

function verifySessionToken_(token) {
  if (!token || typeof token !== 'string') {
    return { ok: false };
  }

  var parts = token.split('.');

  if (parts.length !== 2) {
    return { ok: false };
  }

  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('AUTH_HMAC_SECRET');

  if (!secret) {
    return { ok: false };
  }

  var expected = computeHmacSignature_(
    parts[0],
    secret
  );

  if (!constantTimeEqual_(parts[1], expected)) {
    return { ok: false };
  }

  var payload;

  try {
    payload = JSON.parse(
      base64UrlDecodeToString_(parts[0])
    );
  } catch (error) {
    return { ok: false };
  }

  var now = Math.floor(Date.now() / 1000);

  if (
    !payload.exp ||
    now >= Number(payload.exp) ||
    !payload.jti ||
    !payload.sub ||
    payload.role !== 'ADMIN'
  ) {
    return { ok: false };
  }

  if (
    CacheService.getScriptCache().get(
      'revoked:' + payload.jti
    )
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    session: payload
  };
}

function handleAuthLogin_(req) {
  var account = String(
    req.payload.account || 'admin'
  ).trim().toLowerCase();

  var passphrase = String(
    req.payload.passphrase || ''
  );

  var rate = checkAuthRateLimit_(account);

  if (!rate.allowed) {
    return createResponse_(
      'error',
      null,
      'Login dikunci sementara.',
      'FORBIDDEN',
      { retryAfterSeconds: rate.retryAfterSeconds }
    );
  }

  var props = PropertiesService.getScriptProperties();
  var salt = props.getProperty('ADMIN_PASSPHRASE_SALT');
  var storedHash = props.getProperty('ADMIN_PASSPHRASE_HASH');
  var pepper = props.getProperty('AUTH_PEPPER');

  if (!salt || !storedHash || !pepper) {
    return createResponse_(
      'error',
      null,
      'Kredensial admin belum dikonfigurasi.',
      'INTERNAL_ERROR'
    );
  }

  if (
    account !== 'admin' ||
    passphrase.trim().length < 12
  ) {
    recordAuthFailure_(rate);

    return createResponse_(
      'error',
      null,
      'Kredensial tidak valid.',
      'FORBIDDEN'
    );
  }

  var hash = computeIteratedHash_(
    passphrase.trim(),
    salt,
    pepper,
    Number(props.getProperty('ADMIN_PASSPHRASE_ITER') || 2000)
  );

  if (!constantTimeEqual_(hash, storedHash)) {
    recordAuthFailure_(rate);

    return createResponse_(
      'error',
      null,
      'Kredensial tidak valid.',
      'FORBIDDEN'
    );
  }

  clearAuthFailures_(rate);

  var session = issueSessionToken_('admin', 'ADMIN');

  return createResponse_(
    'success',
    session,
    'Login berhasil.',
    'OK'
  );
}

function handleAuthLogout_(req) {
  var session = req.session;

  if (!session || !session.jti) {
    return createResponse_(
      'error',
      null,
      'Sesi tidak ditemukan.',
      'FORBIDDEN'
    );
  }

  var remaining = Math.max(
    1,
    Number(session.exp) -
      Math.floor(Date.now() / 1000)
  );

  CacheService.getScriptCache().put(
    'revoked:' + session.jti,
    '1',
    remaining
  );

  return createResponse_(
    'success',
    { loggedOut: true },
    'Logout berhasil.',
    'OK'
  );
}

/* =========================================================
 * SHEETS REPOSITORY
 * ======================================================= */

function escapeFormula_(value) {
  if (typeof value !== 'string') {
    return value;
  }

  var text = value.trim();

  if (/^[=+\-@\t\r\n]/.test(text)) {
    return "'" + text;
  }

  return text;
}

function getSheet_(name) {
  var sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(name);

  if (!sheet) {
    throw new Error('Sheet tidak ditemukan: ' + name);
  }

  return sheet;
}

function getSheetData_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    return {
      headers: [],
      rows: []
    };
  }

  var values = sheet.getRange(
    1,
    1,
    lastRow,
    lastCol
  ).getValues();

  return {
    headers: values[0].map(normalizeHeader_),
    rows: values.slice(1)
  };
}

function rowToObject_(headers, row, includeInternal) {
  var obj = {};

  headers.forEach(function(header, index) {
    if (
      !includeInternal &&
      HIDDEN_SECURITY_COLUMNS_.indexOf(header) !== -1
    ) {
      return;
    }

    obj[header] = row[index];
  });

  return obj;
}

function generateNextId_(sheet, prefix) {
  var tz = Session.getScriptTimeZone() || DEFAULT_TZ;

  var ymd = Utilities.formatDate(
    new Date(),
    tz,
    'yyyyMMdd'
  );

  var prefixText = prefix + '-' + ymd + '-';
  var maxSequence = 0;

  if (sheet.getLastRow() > 1) {
    var values = sheet.getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      1
    ).getDisplayValues();

    values.forEach(function(row) {
      var id = String(row[0] || '');

      if (id.indexOf(prefixText) === 0) {
        var sequence = parseInt(
          id.substring(prefixText.length),
          10
        );

        if (!isNaN(sequence) && sequence > maxSequence) {
          maxSequence = sequence;
        }
      }
    });
  }

  return prefixText +
    ('0000' + (maxSequence + 1)).slice(-4);
}

function findRowById_(sheet, idHeader, id) {
  var data = getSheetData_(sheet);
  var index = data.headers.indexOf(idHeader);

  if (index < 0) {
    throw new Error('Kolom ID tidak tersedia.');
  }

  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i][index]) === String(id)) {
      return {
        rowNumber: i + 2,
        headers: data.headers,
        values: data.rows[i]
      };
    }
  }

  return null;
}

function readSheetObjects_(name, includeInternal) {
  var sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(name);

  if (!sheet) {
    return {
      ok: false,
      records: [],
      errorResponse: createResponse_(
        'error',
        null,
        'Sheet ' + name + ' belum diinisialisasi.',
        'NOT_FOUND'
      )
    };
  }

  var data = getSheetData_(sheet);
  var records = [];

  data.rows.forEach(function(row) {
    var obj = rowToObject_(
      data.headers,
      row,
      includeInternal === true
    );

    if (
      name === 'ORDERS' &&
      obj.deleted_at
    ) {
      return;
    }

    if (
      name === 'CATALOG' &&
      obj.deleted_at
    ) {
      return;
    }

    records.push(obj);
  });

  return {
    ok: true,
    records: records
  };
}

/* =========================================================
 * CATALOG
 * ======================================================= */

function handleCatalogList_(req) {
  var result = readSheetObjects_('CATALOG');

  if (!result.ok) {
    return result.errorResponse;
  }

  var packages = result.records.filter(function(item) {
    return item.is_active === true ||
      String(item.is_active).toUpperCase() === 'TRUE';
  });

  packages.sort(function(a, b) {
    return Number(a.sort_order || 0) -
      Number(b.sort_order || 0);
  });

  return createResponse_(
    'success',
    { packages: packages },
    'Katalog berhasil dimuat.',
    'OK'
  );
}

function validateCatalogPayload_(p) {
  if (!p || typeof p !== 'object') {
    return 'Data katalog tidak valid.';
  }

  var name = String(p.package_name || '').trim();
  var price = Number(p.price_amount);
  var minimum = Number(p.minimum_quantity);

  if (name.length < 3 || name.length > 120) {
    return 'Nama paket harus 3-120 karakter.';
  }

  if (!isFinite(price) || price < 0) {
    return 'Harga paket tidak valid.';
  }

  if (
    !isFinite(minimum) ||
    minimum < 1 ||
    Math.floor(minimum) !== minimum
  ) {
    return 'Minimum quantity harus bilangan bulat positif.';
  }

  return null;
}

function handleCatalogSave_(req) {
  var p = req.payload;
  var error = validateCatalogPayload_(p);

  if (error) {
    return createResponse_(
      'error',
      null,
      error,
      'VALIDATION_ERROR'
    );
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    return createResponse_(
      'error',
      null,
      'Server sedang sibuk.',
      'LOCK_TIMEOUT'
    );
  }

  try {
    var sheet = getSheet_('CATALOG');
    var data = getSheetData_(sheet);
    var id = String(p.package_id || '').trim();
    var existing = id
      ? findRowById_(sheet, 'package_id', id)
      : null;

    var now = formatIsoOffset_(new Date());
    var obj = {
      package_id: id || generateNextId_(sheet, 'PKG'),
      package_name: escapeFormula_(String(p.package_name).trim()),
      category: escapeFormula_(String(p.category || 'Umum').trim()),
      description: escapeFormula_(String(p.description || '').trim()),
      menu_details: escapeFormula_(String(p.menu_details || '').trim()),
      price_amount: Number(p.price_amount),
      minimum_quantity: Number(p.minimum_quantity),
      image_url: String(p.image_url || '').trim(),
      is_active: p.is_active !== false,
      sort_order: Number(p.sort_order || 0),
      updated_at: now,
      deleted_at: ''
    };

    if (existing) {
      if (!p.expected_updated_at) {
        return createResponse_(
          'error',
          null,
          'expected_updated_at wajib disertakan.',
          'VALIDATION_ERROR'
        );
      }

      var current = sanitizeForClient_(
        existing.values[
          data.headers.indexOf('updated_at')
        ]
      );

      if (String(current) !== String(p.expected_updated_at)) {
        return createResponse_(
          'error',
          null,
          'Katalog telah diubah oleh admin lain.',
          'CONFLICT'
        );
      }

      var updated = data.headers.map(function(header, index) {
        return obj[header] !== undefined
          ? obj[header]
          : existing.values[index];
      });

      sheet.getRange(
        existing.rowNumber,
        1,
        1,
        data.headers.length
      ).setValues([updated]);
    } else {
      var row = buildRowFromObject_(data.headers, obj);

      sheet.getRange(
        sheet.getLastRow() + 1,
        1,
        1,
        data.headers.length
      ).setValues([row]);
    }

    SpreadsheetApp.flush();

    return createResponse_(
      'success',
      obj,
      'Katalog berhasil disimpan.',
      'OK'
    );
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

/* =========================================================
 * ORDER CREATION
 * ======================================================= */

function validateOrderPayload_(p) {
  if (!p || typeof p !== 'object') {
    return 'Data pesanan tidak valid.';
  }

  var name = String(p.customer_name || '').trim();
  var phone = String(p.customer_phone || '').trim();
  var date = String(p.delivery_date || '').trim();
  var time = String(p.delivery_time || '').trim();
  var fulfillment = String(
    p.fulfillment_type || ''
  ).toUpperCase();

  if (name.length < 2 || name.length > 120) {
    return 'Nama pelanggan wajib diisi.';
  }

  if (!/^[0-9+()\-\s]{8,20}$/.test(phone)) {
    return 'Nomor telepon tidak valid.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'Tanggal pengiriman tidak valid.';
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    return 'Jam pengiriman tidak valid.';
  }

  if (FULFILLMENT_TYPES_.indexOf(fulfillment) === -1) {
    return 'Jenis pemenuhan pesanan tidak valid.';
  }

  if (
    fulfillment === 'DELIVERY' &&
    !String(p.delivery_address || '').trim()
  ) {
    return 'Alamat pengiriman wajib diisi.';
  }

  if (
    !Array.isArray(p.items) ||
    p.items.length < 1 ||
    p.items.length > 30
  ) {
    return 'Item pesanan harus berisi 1-30 paket.';
  }

  return null;
}

function handleOrderCreate_(req) {
  var p = req.payload;
  var error = validateOrderPayload_(p);

  if (error) {
    return createResponse_(
      'error',
      null,
      error,
      'VALIDATION_ERROR'
    );
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    return createResponse_(
      'error',
      null,
      'Server sedang sibuk memproses pesanan.',
      'LOCK_TIMEOUT'
    );
  }

  try {
    var ordersSheet = getSheet_('ORDERS');
    var itemsSheet = getSheet_('ORDER_ITEMS');
    var catalogResult = readSheetObjects_('CATALOG');

    if (!catalogResult.ok) {
      return catalogResult.errorResponse;
    }

    var catalogMap = {};

    catalogResult.records.forEach(function(item) {
      catalogMap[String(item.package_id)] = item;
    });

    var orderItems = [];
    var subtotal = 0;

    p.items.forEach(function(input) {
      var packageId = String(input.package_id || '').trim();
      var quantity = Number(input.quantity);
      var item = catalogMap[packageId];

      if (!item) {
        throw new Error('VALIDATION: Paket tidak ditemukan.');
      }

      if (
        item.is_active !== true &&
        String(item.is_active).toUpperCase() !== 'TRUE'
      ) {
        throw new Error('VALIDATION: Paket tidak aktif.');
      }

      if (
        !isFinite(quantity) ||
        quantity < Number(item.minimum_quantity) ||
        Math.floor(quantity) !== quantity
      ) {
        throw new Error('VALIDATION: Jumlah paket tidak memenuhi minimum.');
      }

      var unitPrice = Number(item.price_amount);
      var lineSubtotal = unitPrice * quantity;

      if (!isFinite(lineSubtotal) || lineSubtotal < 0) {
        throw new Error('VALIDATION: Subtotal item tidak valid.');
      }

      subtotal += lineSubtotal;

      orderItems.push({
        package_id: packageId,
        package_name_snapshot: item.package_name,
        unit_price: unitPrice,
        quantity: quantity,
        line_subtotal: lineSubtotal
      });
    });

    if (!isFinite(subtotal) || subtotal <= 0) {
      return createResponse_(
        'error',
        null,
        'Total pesanan tidak valid.',
        'VALIDATION_ERROR'
      );
    }

    var dpAmount = Number(p.dp_amount);

    if (
      !isFinite(dpAmount) ||
      dpAmount < 0 ||
      dpAmount > subtotal
    ) {
      return createResponse_(
        'error',
        null,
        'Nominal DP tidak valid.',
        'VALIDATION_ERROR'
      );
    }

    var now = new Date();
    var nowIso = formatIsoOffset_(now);
    var orderId = generateNextId_(ordersSheet, 'ORD');

    var trackingToken =
      Utilities.getUuid() + Utilities.getUuid();

    var uploadNonce =
      Utilities.getUuid() + Utilities.getUuid();

    var pepper = PropertiesService
      .getScriptProperties()
      .getProperty('AUTH_PEPPER');

    var trackingHash = computeHmacSignature_(
      trackingToken,
      pepper
    );

    var paymentDue = p.payment_due_at
      ? String(p.payment_due_at)
      : '';

    var orderObj = {
      order_id: orderId,
      created_at: nowIso,
      updated_at: nowIso,
      customer_name: escapeFormula_(String(p.customer_name).trim()),
      customer_phone: escapeFormula_(String(p.customer_phone).trim()),
      delivery_date: String(p.delivery_date),
      delivery_time: String(p.delivery_time),
      fulfillment_type: String(p.fulfillment_type).toUpperCase(),
      delivery_address: escapeFormula_(String(p.delivery_address || '').trim()),
      customer_note: escapeFormula_(String(p.customer_note || '').trim()),
      order_status: 'PENDING',
      subtotal_amount: subtotal,
      dp_amount: dpAmount,
      payment_due_at: paymentDue,
      tracking_token_hash: trackingHash,
      idempotency_key: req.idem,
      proof_file_id: '',
      proof_mime_type: '',
      proof_uploaded_at: '',
      deleted_at: '',
      upload_nonce: uploadNonce
    };

    var orderHeaders = getSheetData_(ordersSheet).headers;

    ordersSheet.getRange(
      ordersSheet.getLastRow() + 1,
      1,
      1,
      orderHeaders.length
    ).setValues([
      buildRowFromObject_(orderHeaders, orderObj)
    ]);

    var itemHeaders = getSheetData_(itemsSheet).headers;

    var itemRows = orderItems.map(function(item) {
      return buildRowFromObject_(itemHeaders, {
        item_id: generateNextId_(itemsSheet, 'ORI'),
        order_id: orderId,
        package_id: item.package_id,
        package_name_snapshot: escapeFormula_(
          String(item.package_name_snapshot)
        ),
        unit_price: item.unit_price,
        quantity: item.quantity,
        line_subtotal: item.line_subtotal,
        created_at: nowIso
      });
    });

    if (itemRows.length > 0) {
      itemsSheet.getRange(
        itemsSheet.getLastRow() + 1,
        1,
        itemRows.length,
        itemHeaders.length
      ).setValues(itemRows);
    }

    SpreadsheetApp.flush();

    return createResponse_(
      'success',
      {
        order_id: orderId,
        tracking_token: trackingToken,
        uploadNonce: uploadNonce,
        subtotal_amount: subtotal,
        dp_amount: dpAmount,
        order_status: 'PENDING',
        created_at: nowIso
      },
      'Pesanan berhasil dibuat.',
      'OK'
    );
  } catch (error) {
    console.error('order.create error:', error);

    if (
      String(error.message || '').indexOf('VALIDATION:') === 0
    ) {
      return createResponse_(
        'error',
        null,
        String(error.message).replace('VALIDATION: ', ''),
        'VALIDATION_ERROR'
      );
    }

    return createResponse_(
      'error',
      null,
      'Gagal menyimpan pesanan.',
      'INTERNAL_ERROR'
    );
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

/* =========================================================
 * PUBLIC ORDER TRACKING — GATE G-10
 * ======================================================= */

function handleOrderTrack_(req) {
  var orderId = String(
    req.payload.order_id || ''
  ).trim().toUpperCase();

  var token = String(
    req.payload.tracking_token || ''
  ).trim();

  if (
    !orderId ||
    token.length < 32 ||
    token.length > 256
  ) {
    return createResponse_(
      'error',
      null,
      'Nomor pesanan dan token pelacakan wajib disertakan.',
      'VALIDATION_ERROR'
    );
  }

  var cache = CacheService.getScriptCache();
  var failKey = 'rl:track:fail:' +
    base64UrlEncodeString_(orderId).slice(0, 100);

  var globalKey = 'rl:track:global';
  var failed = Number(cache.get(failKey) || 0);
  var globalCount = Number(cache.get(globalKey) || 0);

  if (failed >= 5 || globalCount >= 30) {
    return createResponse_(
      'error',
      null,
      'Permintaan pelacakan dibatasi sementara.',
      'RATE_LIMITED',
      { retryAfterSeconds: 900 }
    );
  }

  cache.put(
    globalKey,
    String(globalCount + 1),
    60
  );

  var sheet = getSheet_('ORDERS');
  var found = findRowById_(
    sheet,
    'order_id',
    orderId
  );

  if (!found) {
    cache.put(
      failKey,
      String(failed + 1),
      900
    );

    return createResponse_(
      'error',
      null,
      'Pesanan tidak ditemukan atau token tidak cocok.',
      'NOT_FOUND'
    );
  }

  var hashIndex = found.headers.indexOf(
    'tracking_token_hash'
  );

  var deletedIndex = found.headers.indexOf('deleted_at');

  if (
    hashIndex < 0 ||
    (deletedIndex >= 0 && found.values[deletedIndex])
  ) {
    return createResponse_(
      'error',
      null,
      'Pesanan tidak ditemukan.',
      'NOT_FOUND'
    );
  }

  var pepper = PropertiesService
    .getScriptProperties()
    .getProperty('AUTH_PEPPER');

  var suppliedHash = computeHmacSignature_(
    token,
    pepper
  );

  var storedHash = String(
    found.values[hashIndex] || ''
  );

  if (!constantTimeEqual_(suppliedHash, storedHash)) {
    cache.put(
      failKey,
      String(failed + 1),
      900
    );

    return createResponse_(
      'error',
      null,
      'Pesanan tidak ditemukan atau token tidak cocok.',
      'NOT_FOUND'
    );
  }

  cache.remove(failKey);

  var statusIndex = found.headers.indexOf('order_status');
  var dateIndex = found.headers.indexOf('delivery_date');
  var timeIndex = found.headers.indexOf('delivery_time');
  var fulfillmentIndex = found.headers.indexOf('fulfillment_type');

  return createResponse_(
    'success',
    {
      order_id: orderId,
      order_status: found.values[statusIndex],
      delivery_date: found.values[dateIndex],
      delivery_time: found.values[timeIndex],
      fulfillment_type: found.values[fulfillmentIndex]
    },
    'Informasi pesanan berhasil ditemukan.',
    'OK'
  );
}

/* =========================================================
 * DRIVE UPLOAD
 * PRIVATE ONLY — GATE U-10
 * ======================================================= */

function sanitizeFileName_(name, mime) {
  var extension = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  };

  var base = String(name || 'bukti_transfer')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);

  if (!base) {
    base = 'bukti_transfer';
  }

  return base + '_' +
    Utilities.getUuid().replace(/-/g, '') +
    extension[mime];
}

function verifyMagicBytes_(bytes, mime) {
  if (!bytes || bytes.length < 12) {
    return false;
  }

  function u8(index) {
    return bytes[index] & 0xFF;
  }

  if (mime === 'image/jpeg') {
    return (
      u8(0) === 0xFF &&
      u8(1) === 0xD8 &&
      u8(2) === 0xFF
    );
  }

  if (mime === 'image/png') {
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

  if (mime === 'image/webp') {
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

function getOrCreateSubfolder_(parent, name) {
  var folders = parent.getFoldersByName(name);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parent.createFolder(name);
}

function resolveUploadFolder_(entity) {
  var rootId = PropertiesService
    .getScriptProperties()
    .getProperty('DRIVE_ROOT_FOLDER_ID');

  if (!rootId) {
    throw new Error('DRIVE_ROOT_FOLDER_ID belum dikonfigurasi.');
  }

  var root = DriveApp.getFolderById(rootId);
  var entityFolder = getOrCreateSubfolder_(root, entity);

  var month = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || DEFAULT_TZ,
    'yyyy-MM'
  );

  return getOrCreateSubfolder_(entityFolder, month);
}

function handleFileTicket_(req) {
  var p = req.payload || {};

  var entity = String(p.entity || '').trim().toUpperCase();
  var entityId = String(p.entityId || '').trim();
  var uploadNonce = String(p.uploadNonce || '').trim();

  if (
    entity !== 'ORDERS' ||
    !entityId ||
    !uploadNonce
  ) {
    return createResponse_(
      'error',
      null,
      'entity, entityId, dan uploadNonce wajib disertakan.',
      'VALIDATION_ERROR'
    );
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    return createResponse_(
      'error',
      null,
      'Server sedang sibuk.',
      'LOCK_TIMEOUT'
    );
  }

  try {
    var sheet = getSheet_('ORDERS');
    var found = findRowById_(
      sheet,
      'order_id',
      entityId
    );

    if (!found) {
      return createResponse_(
        'error',
        null,
        'Pesanan tidak ditemukan.',
        'NOT_FOUND'
      );
    }

    var headers = found.headers;
    var values = found.values;

    var nonceIndex = headers.indexOf('upload_nonce');
    var createdIndex = headers.indexOf('created_at');
    var deletedIndex = headers.indexOf('deleted_at');
    var fileIndex = headers.indexOf('proof_file_id');

    if (
      nonceIndex < 0 ||
      createdIndex < 0 ||
      deletedIndex < 0 ||
      fileIndex < 0
    ) {
      return createResponse_(
        'error',
        null,
        'Skema upload belum lengkap.',
        'INTERNAL_ERROR'
      );
    }

    if (
      values[deletedIndex] ||
      values[fileIndex]
    ) {
      return createResponse_(
        'error',
        null,
        'Pesanan tidak dapat menerima unggahan baru.',
        'CONFLICT'
      );
    }

    if (
      !constantTimeEqual_(
        String(values[nonceIndex] || ''),
        uploadNonce
      )
    ) {
      return createResponse_(
        'error',
        null,
        'Bukti kepemilikan pesanan tidak valid.',
        'FORBIDDEN'
      );
    }

    var created = values[createdIndex] instanceof Date
      ? values[createdIndex].getTime()
      : new Date(values[createdIndex]).getTime();

    var now = Date.now();

    if (
      !isFinite(created) ||
      created > now + 60000 ||
      now - created > 900000
    ) {
      return createResponse_(
        'error',
        null,
        'Tiket hanya berlaku untuk pesanan baru maksimal 15 menit.',
        'FORBIDDEN'
      );
    }

    var cache = CacheService.getScriptCache();
    var globalKey = 'rl:ticket:global';
    var count = Number(cache.get(globalKey) || 0);

    if (count >= 15) {
      return createResponse_(
        'error',
        null,
        'Antrean unggah sedang penuh.',
        'RATE_LIMITED',
        { retryAfterSeconds: 60 }
      );
    }

    var ticket = Utilities.getUuid() + Utilities.getUuid();

    cache.put(globalKey, String(count + 1), 60);

    cache.put(
      'ticket:' + ticket,
      JSON.stringify({
        entity: entity,
        entityId: entityId,
        uploadNonce: uploadNonce
      }),
      300
    );

    return createResponse_(
      'success',
      {
        ticket: ticket,
        expiresInSeconds: 300
      },
      'Tiket unggah berhasil diterbitkan.',
      'OK'
    );
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function handleFileUpload_(req) {
  var p = req.payload || {};

  var entity = String(p.entity || '').trim().toUpperCase();
  var entityId = String(p.entityId || '').trim();
  var mime = String(p.mimeType || '').trim().toLowerCase();
  var ticket = String(p.ticket || '').trim();
  var base64 = String(p.base64 || '').trim();

  var config = ENTITY_UPLOAD_CONFIG_[entity];

  if (!config || entity !== 'ORDERS') {
    return createResponse_(
      'error',
      null,
      'Entitas upload tidak valid.',
      'VALIDATION_ERROR'
    );
  }

  if (!entityId || !ticket) {
    return createResponse_(
      'error',
      null,
      'entityId dan ticket wajib diisi.',
      'VALIDATION_ERROR'
    );
  }

  if (config.allowedMimes.indexOf(mime) === -1) {
    return createResponse_(
      'error',
      null,
      'Format bukti transfer tidak didukung.',
      'VALIDATION_ERROR'
    );
  }

  var comma = base64.indexOf(',');

  if (
    comma !== -1 &&
    base64.substring(0, comma).indexOf('base64') !== -1
  ) {
    base64 = base64.substring(comma + 1);
  }

  var maxBytes = Number(
    PropertiesService.getScriptProperties()
      .getProperty('MAX_UPLOAD_BYTES') || 5242880
  );

  if (
    !base64 ||
    base64.length > Math.ceil(maxBytes * 1.37) + 256
  ) {
    return createResponse_(
      'error',
      null,
      'Ukuran file melebihi 5 MB.',
      'VALIDATION_ERROR'
    );
  }

  var bytes;

  try {
    bytes = Utilities.base64Decode(base64);
  } catch (error) {
    return createResponse_(
      'error',
      null,
      'Base64 file tidak valid.',
      'VALIDATION_ERROR'
    );
  }

  if (
    !bytes ||
    bytes.length === 0 ||
    bytes.length > maxBytes ||
    !verifyMagicBytes_(bytes, mime)
  ) {
    return createResponse_(
      'error',
      null,
      'Isi file tidak valid atau melebihi batas ukuran.',
      'VALIDATION_ERROR'
    );
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    return createResponse_(
      'error',
      null,
      'Server sedang sibuk.',
      'LOCK_TIMEOUT'
    );
  }

  var createdFile = null;

  try {
    var cache = CacheService.getScriptCache();
    var ticketKey = 'ticket:' + ticket;
    var rawTicket = cache.get(ticketKey);

    if (!rawTicket) {
      return createResponse_(
        'error',
        null,
        'Tiket unggah tidak ditemukan atau kedaluwarsa.',
        'NOT_FOUND'
      );
    }

    var ticketScope;

    try {
      ticketScope = JSON.parse(rawTicket);
    } catch (error) {
      return createResponse_(
        'error',
        null,
        'Tiket unggah tidak valid.',
        'FORBIDDEN'
      );
    }

    var sheet = getSheet_('ORDERS');
    var found = findRowById_(
      sheet,
      'order_id',
      entityId
    );

    if (!found) {
      return createResponse_(
        'error',
        null,
        'Pesanan tidak ditemukan.',
        'NOT_FOUND'
      );
    }

    var nonceIndex = found.headers.indexOf('upload_nonce');
    var fileIndex = found.headers.indexOf('proof_file_id');
    var mimeIndex = found.headers.indexOf('proof_mime_type');
    var uploadedIndex = found.headers.indexOf('proof_uploaded_at');
    var deletedIndex = found.headers.indexOf('deleted_at');
    var updatedIndex = found.headers.indexOf('updated_at');

    if (
      ticketScope.entity !== entity ||
      ticketScope.entityId !== entityId ||
      !constantTimeEqual_(
        String(ticketScope.uploadNonce),
        String(found.values[nonceIndex] || '')
      )
    ) {
      return createResponse_(
        'error',
        null,
        'Tiket tidak cocok dengan pesanan.',
        'FORBIDDEN'
      );
    }

    if (
      found.values[deletedIndex] ||
      found.values[fileIndex]
    ) {
      return createResponse_(
        'error',
        null,
        'Pesanan sudah memiliki bukti transfer atau dihapus.',
        'CONFLICT'
      );
    }

    var folder = resolveUploadFolder_('ORDERS');

    var filename = sanitizeFileName_(
      p.fileName,
      mime
    );

    var blob = Utilities.newBlob(
      bytes,
      mime,
      filename
    );

    createdFile = folder.createFile(blob);

    /*
     * GATE U-10:
     * Bukti transfer adalah data keuangan SENSITIVE_PII.
     * Tidak ada jalur ANYONE_WITH_LINK.
     */
    createdFile.setSharing(
      DriveApp.Access.PRIVATE,
      DriveApp.Permission.NONE
    );

    var fileId = createdFile.getId();
    var nowIso = formatIsoOffset_(new Date());

    var updated = found.values.slice();

    updated[fileIndex] = fileId;
    updated[mimeIndex] = mime;
    updated[uploadedIndex] = nowIso;
    updated[nonceIndex] = '';

    if (updatedIndex >= 0) {
      updated[updatedIndex] = nowIso;
    }

    sheet.getRange(
      found.rowNumber,
      1,
      1,
      found.headers.length
    ).setValues([updated]);

    SpreadsheetApp.flush();

    /*
     * Tiket hanya dikonsumsi setelah penulisan Sheet berhasil.
     */
    cache.remove(ticketKey);

    return createResponse_(
      'success',
      {
        order_id: entityId,
        proof_file_id: fileId,
        proof_mime_type: mime,
        proof_uploaded_at: nowIso,
        visibility: 'private'
      },
      'Bukti transfer berhasil disimpan.',
      'OK'
    );
  } catch (error) {
    if (createdFile) {
      try {
        createdFile.setTrashed(true);
      } catch (trashError) {
        console.error('Drive rollback error:', trashError);
      }
    }

    console.error('file.upload error:', error);

    return createResponse_(
      'error',
      null,
      'Gagal menyimpan bukti transfer.',
      'INTERNAL_ERROR'
    );
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

/* =========================================================
 * ADMIN ORDER OPERATIONS
 * ======================================================= */

function handleOrderAdminList_(req) {
  var result = readSheetObjects_('ORDERS', true);

  if (!result.ok) {
    return result.errorResponse;
  }

  var orders = result.records.map(function(order) {
    var safe = {};

    Object.keys(order).forEach(function(key) {
      if (
        key !== 'tracking_token_hash' &&
        key !== 'upload_nonce'
      ) {
        safe[key] = order[key];
      }
    });

    return safe;
  });

  orders.sort(function(a, b) {
    return String(b.created_at).localeCompare(
      String(a.created_at)
    );
  });

  return createResponse_(
    'success',
    { orders: orders },
    'Daftar pesanan berhasil dimuat.',
    'OK'
  );
}

function handleOrderUpdateStatus_(req) {
  var p = req.payload || {};

  var orderId = String(p.order_id || '').trim();
  var status = String(
    p.order_status || ''
  ).trim().toUpperCase();

  var expected = String(
    p.expected_updated_at || ''
  );

  if (
    !orderId ||
    ORDER_STATUSES_.indexOf(status) === -1 ||
    !expected
  ) {
    return createResponse_(
      'error',
      null,
      'order_id, status valid, dan expected_updated_at wajib diisi.',
      'VALIDATION_ERROR'
    );
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    return createResponse_(
      'error',
      null,
      'Server sedang sibuk.',
      'LOCK_TIMEOUT'
    );
  }

  try {
    var sheet = getSheet_('ORDERS');
    var found = findRowById_(
      sheet,
      'order_id',
      orderId
    );

    if (!found) {
      return createResponse_(
        'error',
        null,
        'Pesanan tidak ditemukan.',
        'NOT_FOUND'
      );
    }

    var updatedIndex = found.headers.indexOf('updated_at');
    var statusIndex = found.headers.indexOf('order_status');
    var deletedIndex = found.headers.indexOf('deleted_at');

    if (
      deletedIndex >= 0 &&
      found.values[deletedIndex]
    ) {
      return createResponse_(
        'error',
        null,
        'Pesanan telah dihapus.',
        'NOT_FOUND'
      );
    }

    var current = sanitizeForClient_(
      found.values[updatedIndex]
    );

    if (String(current) !== expected) {
      return createResponse_(
        'error',
        null,
        'Pesanan berubah. Muat ulang sebelum menyimpan.',
        'CONFLICT'
      );
    }

    var updated = found.values.slice();
    var nowIso = formatIsoOffset_(new Date());

    updated[statusIndex] = status;
    updated[updatedIndex] = nowIso;

    sheet.getRange(
      found.rowNumber,
      1,
      1,
      found.headers.length
    ).setValues([updated]);

    SpreadsheetApp.flush();

    return createResponse_(
      'success',
      {
        order_id: orderId,
        order_status: status,
        updated_at: nowIso
      },
      'Status pesanan berhasil diperbarui.',
      'OK'
    );
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function handleFileAdminView_(req) {
  var orderId = String(
    req.payload.order_id || ''
  ).trim();

  if (!orderId) {
    return createResponse_(
      'error',
      null,
      'order_id wajib diisi.',
      'VALIDATION_ERROR'
    );
  }

  var sheet = getSheet_('ORDERS');
  var found = findRowById_(
    sheet,
    'order_id',
    orderId
  );

  if (!found) {
    return createResponse_(
      'error',
      null,
      'Pesanan tidak ditemukan.',
      'NOT_FOUND'
    );
  }

  var fileIndex = found.headers.indexOf('proof_file_id');
  var fileId = String(
    found.values[fileIndex] || ''
  ).trim();

  if (!fileId) {
    return createResponse_(
      'error',
      null,
      'Bukti transfer belum diunggah.',
      'NOT_FOUND'
    );
  }

  try {
    var file = DriveApp.getFileById(fileId);

    return createResponse_(
      'success',
      {
        order_id: orderId,
        file_id: fileId,
        file_name: file.getName(),
        file_url: 'https://drive.google.com/file/d/' +
          fileId + '/view',
        visibility: 'private'
      },
      'Informasi bukti transfer berhasil dimuat.',
      'OK'
    );
  } catch (error) {
    console.error('file.adminView error:', error);

    return createResponse_(
      'error',
      null,
      'File tidak dapat diakses.',
      'NOT_FOUND'
    );
  }
}

/* =========================================================
 * DIAGNOSTICS
 * ======================================================= */

function buildDiagnosticsReport_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  var checks = {};

  Object.keys(DB_SCHEMAS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);

    if (!sheet) {
      checks[name] = false;
      return;
    }

    var headers = sheet.getRange(
      1,
      1,
      1,
      sheet.getLastColumn()
    ).getValues()[0].map(normalizeHeader_);

    checks[name] = DB_SCHEMAS[name].every(function(header) {
      return headers.indexOf(header) !== -1;
    });
  });

  checks.AUTH_HMAC_SECRET = Boolean(
    props.getProperty('AUTH_HMAC_SECRET')
  );

  checks.AUTH_PEPPER = Boolean(
    props.getProperty('AUTH_PEPPER')
  );

  checks.ADMIN_PASSPHRASE_HASH = Boolean(
    props.getProperty('ADMIN_PASSPHRASE_HASH')
  );

  checks.DRIVE_ROOT_FOLDER_ID = Boolean(
    props.getProperty('DRIVE_ROOT_FOLDER_ID')
  );

  checks.ACCESS_PROFILE_P3 =
    props.getProperty('ACCESS_PROFILE') === 'P3';

  return {
    ok: Object.keys(checks).every(function(key) {
      return checks[key] === true;
    }),
    checks: checks,
    schemaVersion: SCHEMA_VERSION
  };
}
