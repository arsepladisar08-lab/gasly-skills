(function (global) {
  'use strict';

  global.GASLY_CONFIG = Object.freeze({
    EXEC_URL: '',
    REQUEST_TIMEOUT_MS: 20000,
    ALLOW_SESSION_STORAGE: false,
    TIMEZONE: 'Asia/Jakarta',
    CURRENCY: 'IDR',
    MAX_UPLOAD_BYTES: 1024 * 1024,
    SIMULATION_SEED_COUNT: 16
  });
})(window);