(function (global) {
  'use strict';

  var memoryToken = null;
  var memoryRole = null;
  var SESSION_KEY = 'DAPURSAJI_ADMIN_SESSION';
  var CODE_VALUES = [
    'OK',
    'VALIDATION_ERROR',
    'NOT_FOUND',
    'FORBIDDEN',
    'CONFLICT',
    'LOCK_TIMEOUT',
    'RATE_LIMITED',
    'INTERNAL_ERROR'
  ];

  function uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }

    if (!global.crypto || !global.crypto.getRandomValues) {
      throw new Error('Browser tidak mendukung generator acak yang aman.');
    }

    var bytes = new Uint8Array(16);
    global.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;

    var hex = Array.from(bytes, function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20)
    ].join('-');
  }

  function isSimulationMode() {
    var url = String(global.GASLY_CONFIG.EXEC_URL || '').trim();
    return !url;
  }

  function success(data, message) {
    return {
      status: 'success',
      data: data || {},
      message: message || 'Berhasil.',
      code: 'OK',
      meta: {
        schemaVersion: '1.0.0',
        timestamp: new Date().toISOString()
      }
    };
  }

  function failure(message, code) {
    return {
      status: 'error',
      data: null,
      message: message || 'Permintaan tidak dapat diproses.',
      code: CODE_VALUES.indexOf(code) >= 0 ? code : 'INTERNAL_ERROR',
      meta: {
        schemaVersion: '1.0.0',
        timestamp: new Date().toISOString()
      }
    };
  }

  function getSessionToken() {
    if (memoryToken) return memoryToken;

    if (global.GASLY_CONFIG.ALLOW_SESSION_STORAGE) {
      try {
        return global.sessionStorage.getItem(SESSION_KEY);
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  function setSessionToken(token, role, persist) {
    memoryToken = token || null;
    memoryRole = role || null;

    try {
      if (global.GASLY_CONFIG.ALLOW_SESSION_STORAGE && persist && token) {
        global.sessionStorage.setItem(SESSION_KEY, token);
      } else if (global.sessionStorage) {
        global.sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (error) {
      /* Memori tetap menjadi penyimpanan utama. */
    }
  }

  function clearSession() {
    memoryToken = null;
    memoryRole = null;

    try {
      if (global.sessionStorage) {
        global.sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (error) {
      /* Tidak ada tindakan tambahan. */
    }
  }

  function timeoutFetch(url, options, timeout) {
    var controller = new AbortController();
    var timer = global.setTimeout(function () {
      controller.abort();
    }, timeout);

    return global.fetch(url, Object.assign({}, options, {
      signal: controller.signal
    })).finally(function () {
      global.clearTimeout(timer);
    });
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      global.setTimeout(resolve, ms);
    });
  }

  function validateEnvelope(value) {
    if (!value || typeof value !== 'object') {
      return failure('Respons server tidak valid.', 'INTERNAL_ERROR');
    }

    if (value.status !== 'success' && value.status !== 'error') {
      return failure('Format respons server tidak dikenali.', 'INTERNAL_ERROR');
    }

    if (CODE_VALUES.indexOf(value.code) < 0) {
      return failure('Kode respons server tidak dikenali.', 'INTERNAL_ERROR');
    }

    if (value.status === 'success' && value.code !== 'OK') {
      return failure('Respons sukses tidak sesuai kontrak.', 'INTERNAL_ERROR');
    }

    return value;
  }

  async function request(action, payload, options) {
    var opts = options || {};
    var config = global.GASLY_CONFIG;
    var url = String(opts.execUrl || config.EXEC_URL || '').trim();

    if (isSimulationMode() && !opts.forceNetwork) {
      if (global.DapurSajiSimulation) {
        return global.DapurSajiSimulation.handle(action, payload || {}, opts);
      }
      return failure('Mode simulasi belum siap.', 'INTERNAL_ERROR');
    }

    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
      return failure('URL backend harus berupa Google Apps Script Web App /exec yang valid.', 'VALIDATION_ERROR');
    }

    var isRead = action === 'catalog.list' || action === 'order.adminList';
    var idem = opts.idemKey || (opts.idempotent === false || isRead ? null : uuid());
    var body = {
      action: action,
      v: 1,
      auth: getSessionToken(),
      idem: idem,
      payload: payload || {}
    };

    var retries = opts.maxRetries === undefined ? (isRead || idem ? 2 : 0) : opts.maxRetries;
    var attempt = 0;
    var timeout = opts.timeoutMs || config.REQUEST_TIMEOUT_MS;

    while (true) {
      try {
        var response = await timeoutFetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          redirect: 'follow',
          body: JSON.stringify(body)
        }, timeout);

        var responseText = await response.text();
        var envelope;

        try {
          envelope = validateEnvelope(JSON.parse(responseText));
        } catch (parseError) {
          if (parseError instanceof SyntaxError) {
            return failure('Server tidak mengembalikan JSON yang valid. Periksa kompatibilitas CORS dan deployment.', 'INTERNAL_ERROR');
          }
          return failure('Respons backend tidak dapat diverifikasi.', 'INTERNAL_ERROR');
        }

        if (envelope.code === 'FORBIDDEN' && action !== 'auth.login') {
          clearSession();
        }

        if (envelope.code === 'LOCK_TIMEOUT' && attempt < retries) {
          attempt += 1;
          await wait(350 * Math.pow(2, attempt));
          continue;
        }

        return envelope;
      } catch (error) {
        if (attempt < retries) {
          attempt += 1;
          await wait(350 * Math.pow(2, attempt));
          continue;
        }

        return failure(
          error && error.name === 'AbortError'
            ? 'Permintaan melewati batas waktu 20 detik.'
            : 'Tidak dapat membaca respons backend. Periksa jaringan, CORS, dan redirect GAS.',
          'INTERNAL_ERROR'
        );
      }
    }
  }

  async function login(passphrase, persist) {
    if (!passphrase || passphrase.length < 12) {
      return failure('Passphrase minimal 12 karakter.', 'VALIDATION_ERROR');
    }

    var result = await request('auth.login', {
      passphrase: passphrase
    }, {
      idempotent: false,
      maxRetries: 0
    });

    if (result.status === 'success' && result.code === 'OK' && result.data) {
      var token = result.data.session_token || result.data.token;
      if (!token) return failure('Respons login tidak memiliki token sesi.', 'INTERNAL_ERROR');

      setSessionToken(token, result.data.role || 'ADMIN', Boolean(persist));
    }

    return result;
  }

  async function logout() {
    if (isSimulationMode()) {
      clearSession();
      return success({}, 'Keluar dari mode simulasi.');
    }

    var result = await request('auth.logout', {}, {
      idempotent: false,
      maxRetries: 0
    });

    clearSession();
    return result;
  }

  global.GaslyClient = Object.freeze({
    request: request,
    login: login,
    logout: logout,
    uuid: uuid,
    success: success,
    failure: failure,
    isSimulationMode: isSimulationMode,
    getSessionToken: getSessionToken,
    getSessionRole: function () { return memoryRole; },
    clearSession: clearSession
  });
})(window);