<!-- KB_VERSION: 2.1.0 -->
# STACK ADAPTER: HTML + TAILWIND CSS (`stacks/html-tailwind.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-ui` ketika stack yang dipilih adalah `html-tailwind`.

## Daftar Isi
1. [Struktur File & Konvensi Konfigurasi URL `/exec`](#1-struktur-file--konvensi-konfigurasi-url-exec)
2. [Perbedaan Prototipe (Play CDN) vs Produksi (Compiled CSS)](#2-perbedaan-prototipe-play-cdn-vs-produksi-compiled-css)
3. [Trade-off Penyimpanan Token Sesi Admin](#3-trade-off-penyimpanan-token-sesi-admin)
4. [Kode Lengkap `src/config.js` & `src/gasClient.js`](#4-kode-lengkap-srcconfigjs--srcgasclientjs)
5. [Kode Lengkap `src/imageUploader.js` & `driveImageUrl`](#5-kode-lengkap-srcimageuploaderjs--driveimageurl)
6. [Kode Lengkap `index.html` (State Machine, Login Admin & Upload)](#6-kode-lengkap-indexhtml-state-machine-login-admin--upload)

---

## 1. Struktur File & Konvensi Konfigurasi URL `/exec`

```text
project-html-tailwind/
├── index.html                  # Halaman utama aplikasi (semantic HTML5)
├── package.json                # Skrip build Tailwind CLI untuk produksi
├── src/
│   ├── input.css               # Mengimpor preset CSS (mis. aura.css / dense-dashboard.css) + direktif Tailwind
│   ├── config.js               # Satu-satunya tempat konfigurasi URL /exec publik
│   ├── gasClient.js            # Klien HTTP text/plain POST/GET, retry idempoten, & manajemen token sesi
│   └── imageUploader.js        # Kompresi <canvas> ~1 MB, 5 state aksesibel, & helper driveImageUrl
└── dist/
    └── styles.css              # Hasil kompilasi CSS untuk produksi
```

- **Konvensi Konfigurasi:** Seluruh komunikasi merujuk ke satu objek global `window.GASLY_CONFIG.EXEC_URL` di dalam `src/config.js`. URL ini bersifat publik; tidak boleh ada secret atau kunci API di dalamnya.

---

## 2. Perbedaan Prototipe (Play CDN) vs Produksi (Compiled CSS)

1. **Mode Prototipe / Sandbox Preview (`cdn.tailwindcss.com`):**
   - *Tailwind Play CDN* (`<script src="https://cdn.tailwindcss.com"></script>`) **hanya diperuntukkan bagi prototipe cepat atau pratinjau langsung di browser/sandbox** karena mem-parsing DOM saat runtime dan mengunduh skrip besar.
2. **Jalur Produksi Wajib (Compiled CSS):**
   - Untuk deployment produksi, gunakan *Tailwind CSS CLI* agar menghasilkan file `dist/styles.css` statis yang kecil dan cepat:

```json
{
  "name": "gasly-html-tailwind-app",
  "private": true,
  "scripts": {
    "dev:css": "npx tailwindcss -i ./src/input.css -o ./dist/styles.css --watch",
    "build:css": "npx tailwindcss -i ./src/input.css -o ./dist/styles.css --minify"
  },
  "devDependencies": {
    "tailwindcss": "<<PIN_VERSION>>"
  }
}
```

File `src/input.css` menggabungkan variabel preset dari Fase 2 dengan utilitas Tailwind:
```css
@import "./preset-tokens.css";
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 3. Trade-off Penyimpanan Token Sesi Admin

Dalam arsitektur *decoupled frontend* yang memanggil `https://script.google.com/macros/s/.../exec` lintas origin:
- **Cookie `HttpOnly` Tidak Tersedia:** Google Apps Script `ContentService` tidak dapat memasang cookie `HttpOnly` lintas domain ke domain frontend eksternal.
- **Default Utama (Diutamakan):** Simpan token sesi di dalam **variabel memori tertutup (`memoryToken_`)** di dalam modul `gasClient.js`. Token aman dari pembacaan lintas sesi dan otomatis musnah saat tab ditutup.
- **Opsi Kenyamanan (`sessionStorage`):** Jika pengguna mencentang *"Pertahankan sesi selama tab ini terbuka"*, simpan token di `window.sessionStorage` (dibungkus `try / catch`). Penyimpanan di `window.localStorage` dilarang untuk token sesi.

---

## 4. Kode Lengkap `src/config.js` & `src/gasClient.js`

```javascript
// FILE: src/config.js
window.GASLY_CONFIG = {
  // Ganti dengan URL Web App Google Apps Script (.../exec) Anda
  EXEC_URL: 'https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec',
  REQUEST_TIMEOUT_MS: 20000,
  ALLOW_SESSION_STORAGE: false
};
```

```javascript
// FILE: src/gasClient.js
(function(global) {
  'use strict';

  var SESSION_KEY = 'GASLY_AUTH_TOKEN_SESSION';
  var memoryToken_ = null;
  var memoryRole_ = null;

  function generateUuidV4_() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getSessionToken() {
    if (memoryToken_) return memoryToken_;
    if (global.GASLY_CONFIG && global.GASLY_CONFIG.ALLOW_SESSION_STORAGE) {
      try {
        if (global.sessionStorage) {
          return global.sessionStorage.getItem(SESSION_KEY);
        }
      } catch (e) {}
    }
    return null;
  }

  function setSessionToken(token, role, persistInTab) {
    memoryToken_ = token || null;
    memoryRole_ = role || null;
    try {
      if (global.sessionStorage) {
        if (token && (persistInTab || (global.GASLY_CONFIG && global.GASLY_CONFIG.ALLOW_SESSION_STORAGE))) {
          global.sessionStorage.setItem(SESSION_KEY, token);
        } else {
          global.sessionStorage.removeItem(SESSION_KEY);
        }
      }
    } catch (e) {}
  }

  function clearSession() {
    setSessionToken(null, null, false);
  }

  function fetchWithTimeout_(url, options, timeoutMs) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    if (controller) {
      options.signal = controller.signal;
      timer = setTimeout(function() {
        controller.abort();
      }, timeoutMs);
    }
    return fetch(url, options).finally(function() {
      if (timer) clearTimeout(timer);
    });
  }

  /**
   * Sends a request to the Google Apps Script /exec endpoint.
   * Uses text/plain;charset=utf-8 to avoid CORS preflight OPTIONS failure.
   * Retries ONLY when the action is idempotent (has idem key or is a read action)
   * and the failure is a network/timeout error or LOCK_TIMEOUT.
   */
  async function request(action, payload, options) {
    var opts = options || {};
    var cfg = global.GASLY_CONFIG || {};
    var execUrl = opts.execUrl || cfg.EXEC_URL || '';
    var timeoutMs = opts.timeoutMs || cfg.REQUEST_TIMEOUT_MS || 20000;

    if (!execUrl || execUrl.indexOf('REPLACE_WITH_DEPLOYMENT_ID') !== -1) {
      return {
        status: 'error',
        data: null,
        message: 'URL Web App (/exec) belum dikonfigurasi pada src/config.js.',
        code: 'VALIDATION_ERROR',
        meta: { timestamp: new Date().toISOString() }
      };
    }

    var isReadAction = /\.list$|\.get$/.test(action);
    var requiresIdem = opts.idempotent !== undefined ? Boolean(opts.idempotent) : !isReadAction;
    var idemKey = opts.idemKey || (requiresIdem ? generateUuidV4_() : null);
    var canRetry = isReadAction || Boolean(idemKey);
    var maxRetries = canRetry ? (opts.maxRetries !== undefined ? opts.maxRetries : 2) : 0;

    var bodyStr = JSON.stringify({
      action: action,
      v: 1,
      auth: getSessionToken(),
      idem: idemKey,
      payload: payload || {}
    });

    var attempt = 0;
    while (true) {
      try {
        var res = await fetchWithTimeout_(
          execUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8'
            },
            redirect: 'follow',
            body: bodyStr
          },
          timeoutMs
        );

        var text = await res.text();
        var envelope;
        try {
          envelope = JSON.parse(text);
        } catch (parseErr) {
          throw new Error('Respons server bukan JSON valid (periksa deployment /exec).');
        }

        if (envelope.code === 'FORBIDDEN' && action !== 'auth.login' && action !== 'auth.google') {
          clearSession();
        }

        if (envelope.code === 'LOCK_TIMEOUT' && attempt < maxRetries) {
          attempt++;
          await new Promise(function(r) { setTimeout(r, 400 * Math.pow(2, attempt)); });
          continue;
        }

        return envelope;
      } catch (netErr) {
        if (attempt < maxRetries) {
          attempt++;
          await new Promise(function(r) { setTimeout(r, 400 * Math.pow(2, attempt)); });
          continue;
        }
        return {
          status: 'error',
          data: null,
          message: netErr && netErr.name === 'AbortError'
            ? 'Permintaan melewati batas waktu tunggu (timeout). Silakan coba lagi.'
            : 'Gagal terhubung ke server Apps Script. Periksa koneksi internet Anda.',
          code: 'INTERNAL_ERROR',
          meta: { timestamp: new Date().toISOString() }
        };
      }
    }
  }

  async function loginWithPassphrase(account, passphrase, persistInTab) {
    var env = await request(
      'auth.login',
      { account: account || 'admin', passphrase: passphrase },
      { idempotent: false, maxRetries: 0 }
    );
    if (env.status === 'success' && env.data && env.data.token) {
      setSessionToken(env.data.token, env.data.role, Boolean(persistInTab));
    }
    return env;
  }

  async function logout() {
    var env = await request('auth.logout', {}, { idempotent: false, maxRetries: 0 });
    clearSession();
    return env;
  }

  global.GaslyClient = {
    request: request,
    loginWithPassphrase: loginWithPassphrase,
    logout: logout,
    getSessionToken: getSessionToken,
    clearSession: clearSession,
    generateUuidV4: generateUuidV4_
  };
})(window);
```

---

## 5. Kode Lengkap `src/imageUploader.js` & `driveImageUrl`

```javascript
// FILE: src/imageUploader.js
(function(global) {
  'use strict';

  var ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
  var TARGET_MAX_BYTES = 1024 * 1024; // ~1 MB client compression target
  var MAX_DIMENSION_PX = 1600;

  /**
   * Single source of truth helper for rendering Google Drive images.
   * Primary: drive.google.com/thumbnail?id=<id>&sz=w<width>
   * Fallback: lh3.googleusercontent.com/d/<id>=w<width>
   */
  function driveImageUrl(fileId, width) {
    var cleanId = String(fileId || '').trim();
    if (!cleanId) return '';
    var w = Math.max(64, Math.min(2400, Number(width) || 800));
    return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(cleanId) + '&sz=w' + w;
  }

  function driveImageFallbackUrl(fileId, width) {
    var cleanId = String(fileId || '').trim();
    if (!cleanId) return '';
    var w = Math.max(64, Math.min(2400, Number(width) || 800));
    return 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(cleanId) + '=w' + w;
  }

  function handleDriveImageError(imgElement, fileId, width) {
    if (!imgElement || imgElement.getAttribute('data-fallback-applied') === 'true') {
      return;
    }
    imgElement.setAttribute('data-fallback-applied', 'true');
    imgElement.src = driveImageFallbackUrl(fileId, width);
  }

  /**
   * Compresses and resizes an image File in the browser to approximately <= 1 MB.
   */
  function compressImageFile(file) {
    return new Promise(function(resolve, reject) {
      if (!file || ALLOWED_MIMES.indexOf(file.type) === -1) {
        reject(new Error('Format gambar harus JPEG, PNG, atau WebP.'));
        return;
      }

      var objectUrl = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function() {
        URL.revokeObjectURL(objectUrl);
        var width = img.naturalWidth || img.width;
        var height = img.naturalHeight || img.height;

        if (width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
          var ratio = Math.min(MAX_DIMENSION_PX / width, MAX_DIMENSION_PX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        var outputMime = file.type === 'image/png' ? 'image/webp' : file.type;
        var qualities = [0.82, 0.68, 0.54, 0.42];
        var dataUrl = '';

        for (var i = 0; i < qualities.length; i++) {
          dataUrl = canvas.toDataURL(outputMime, qualities[i]);
          var base64Part = dataUrl.split(',')[1] || '';
          var approxBytes = Math.floor((base64Part.length * 3) / 4);
          if (approxBytes <= TARGET_MAX_BYTES) {
            break;
          }
        }

        var rawBase64 = dataUrl.split(',')[1] || '';
        resolve({
          fileName: file.name,
          mimeType: outputMime,
          base64: rawBase64,
          approxBytes: Math.floor((rawBase64.length * 3) / 4)
        });
      };
      img.onerror = function() {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Gagal membaca file gambar untuk kompresi.'));
      };
      img.src = objectUrl;
    });
  }

  /**
   * Orchestrates the 5 accessible upload states: idle -> compressing -> uploading -> done | error.
   */
  async function uploadPhoto(options) {
    var file = options.file;
    var entity = options.entity || 'ITEMS';
    var entityId = options.entityId;
    var onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : function() {};

    if (!file) {
      onStateChange('error', 'Pilih file foto terlebih dahulu.');
      return null;
    }

    try {
      onStateChange('compressing', 'Mengompres foto agar hemat kuota (~1 MB)...');
      var compressed = await compressImageFile(file);

      onStateChange('uploading', 'Mengunggah foto ke Google Drive...');
      var ticket = null;
      if (!global.GaslyClient.getSessionToken()) {
        var ticketRes = await global.GaslyClient.request('file.ticket', {}, { idempotent: false });
        if (ticketRes.status !== 'success' || !ticketRes.data || !ticketRes.data.ticket) {
          onStateChange('error', ticketRes.message || 'Gagal memperoleh tiket unggah.');
          return ticketRes;
        }
        ticket = ticketRes.data.ticket;
      }

      var uploadRes = await global.GaslyClient.request(
        'file.upload',
        {
          entity: entity,
          entityId: entityId,
          fileName: compressed.fileName,
          mimeType: compressed.mimeType,
          base64: compressed.base64,
          ticket: ticket
        },
        { idempotent: true }
      );

      if (uploadRes.status !== 'success') {
        onStateChange('error', uploadRes.message || 'Gagal mengunggah foto.');
        return uploadRes;
      }

      onStateChange('done', 'Foto berhasil diunggah.');
      return uploadRes;
    } catch (err) {
      onStateChange('error', err.message || 'Terjadi kesalahan saat memproses foto.');
      return { status: 'error', message: err.message, code: 'VALIDATION_ERROR' };
    }
  }

  global.GaslyImage = {
    driveImageUrl: driveImageUrl,
    driveImageFallbackUrl: driveImageFallbackUrl,
    handleDriveImageError: handleDriveImageError,
    compressImageFile: compressImageFile,
    uploadPhoto: uploadPhoto
  };
})(window);
```

---

## 6. Kode Lengkap `index.html` (State Machine, Login Admin & Upload)

```html
<!-- FILE: index.html -->
<!DOCTYPE html>
<html lang="id" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gasly Operations Portal</title>
  <!-- Produksi: gunakan <link rel="stylesheet" href="./dist/styles.css"> -->
  <!-- Prototipe / Sandbox Preview saja: -->
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="./src/preset-tokens.css">
</head>
<body style="background-color: var(--bg-base); color: var(--text-primary); font-family: var(--font-sans);" class="min-h-screen antialiased">

  <!-- Toast Notification Region -->
  <div id="toast-region" aria-live="polite" class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"></div>

  <!-- Top Navigation -->
  <header style="background-color: var(--bg-surface); border-bottom: 1px solid var(--border-subtle);" class="sticky top-0 z-30 px-4 py-3">
    <div class="max-w-6xl mx-auto flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Portal Operasional Gasly</h1>
        <p style="color: var(--text-helper);" class="text-xs">Terhubung ke Google Sheets &amp; Drive API (/exec)</p>
      </div>
      <div class="flex items-center gap-2">
        <button id="btn-refresh" type="button" onclick="window.appLoadItems()"
          style="background-color: var(--bg-interactive); color: var(--text-primary); border: 1px solid var(--border-subtle);"
          class="min-h-[42px] px-3 py-2 rounded-lg text-sm font-medium">
          Muat Ulang
        </button>
        <button id="btn-auth-modal" type="button" onclick="window.appOpenModal('modal-login')"
          style="background-color: var(--accent-solid); color: var(--accent-text-on-solid);"
          class="min-h-[42px] px-4 py-2 rounded-lg text-sm font-semibold">
          Login Admin
        </button>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
    <!-- Form Tambah Data + Upload Foto -->
    <section style="background-color: var(--bg-surface); border: 1px solid var(--border-subtle);" class="p-5 rounded-xl">
      <h2 class="text-lg font-semibold mb-4">Tambah Catatan Transaksi</h2>
      <form id="form-item" onsubmit="window.appSubmitItem(event)" class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label for="input-title" style="color: var(--text-secondary);" class="block text-xs font-semibold mb-1">Judul Transaksi *</label>
          <input id="input-title" name="title" type="text" required minlength="3" maxlength="120"
            placeholder="Contoh: Pembelian Bahan Baku"
            style="background-color: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle);"
            class="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm">
        </div>
        <div>
          <label for="input-category" style="color: var(--text-secondary);" class="block text-xs font-semibold mb-1">Kategori</label>
          <select id="input-category" name="category"
            style="background-color: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle);"
            class="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm">
            <option value="Operasional">Operasional</option>
            <option value="Pemasaran">Pemasaran</option>
            <option value="Infrastruktur">Infrastruktur</option>
            <option value="Lisensi">Lisensi</option>
          </select>
        </div>
        <div>
          <label for="input-amount" style="color: var(--text-secondary);" class="block text-xs font-semibold mb-1">Nominal (Rp) *</label>
          <input id="input-amount" name="amount" type="number" required min="0" step="1"
            placeholder="150000"
            style="background-color: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle);"
            class="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm tabular-nums">
        </div>
        <div>
          <label for="input-photo" style="color: var(--text-secondary);" class="block text-xs font-semibold mb-1">Foto Bukti (Opsional)</label>
          <input id="input-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
            style="background-color: var(--bg-base); color: var(--text-secondary); border: 1px solid var(--border-subtle);"
            class="w-full min-h-[42px] px-2 py-1.5 rounded-lg text-xs">
          <p id="upload-status-text" aria-live="polite" style="color: var(--text-helper);" class="text-xs mt-1">Status foto: siap (idle)</p>
        </div>
        <div class="md:col-span-4 flex justify-end">
          <button id="btn-submit-item" type="submit"
            style="background-color: var(--accent-solid); color: var(--accent-text-on-solid);"
            class="min-h-[44px] px-5 py-2 rounded-lg text-sm font-semibold">
            Simpan Transaksi
          </button>
        </div>
      </form>
    </section>

    <!-- Data Table Section -->
    <section style="background-color: var(--bg-surface); border: 1px solid var(--border-subtle);" class="rounded-xl overflow-hidden">
      <div class="p-4 border-b flex items-center justify-between" style="border-color: var(--border-subtle);">
        <h2 class="text-base font-semibold">Daftar Transaksi</h2>
        <span id="items-count" style="color: var(--text-helper);" class="text-xs tabular-nums">0 baris</span>
      </div>
      <div id="table-viewport" class="overflow-x-auto p-4"></div>
    </section>
  </main>

  <!-- Modal Login Admin -->
  <div id="modal-login" role="dialog" aria-modal="true" aria-labelledby="modal-login-title"
    class="fixed inset-0 z-40 hidden items-center justify-center bg-black/60 p-4"
    onclick="if(event.target === this) window.appCloseModal('modal-login')">
    <div style="background-color: var(--bg-surface); border: 1px solid var(--border-subtle);" class="w-full max-w-md rounded-xl p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 id="modal-login-title" class="text-lg font-bold">Login Admin</h2>
        <button type="button" aria-label="Tutup modal login" onclick="window.appCloseModal('modal-login')" class="min-w-[40px] min-h-[40px] text-lg">&times;</button>
      </div>
      <form onsubmit="window.appSubmitLogin(event)" class="space-y-4">
        <div>
          <label for="login-passphrase" style="color: var(--text-secondary);" class="block text-xs font-semibold mb-1">Passphrase Admin (Min. 12 Karakter)</label>
          <input id="login-passphrase" type="password" required minlength="12"
            style="background-color: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle);"
            class="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm">
        </div>
        <div class="flex items-center gap-2">
          <input id="login-persist" type="checkbox" class="w-4 h-4">
          <label for="login-persist" style="color: var(--text-helper);" class="text-xs">Simpan di sessionStorage selama tab ini terbuka</label>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" onclick="window.appCloseModal('modal-login')"
            style="background-color: var(--bg-interactive); color: var(--text-primary);"
            class="min-h-[42px] px-4 py-2 rounded-lg text-sm">Batal</button>
          <button id="btn-login-submit" type="submit"
            style="background-color: var(--accent-solid); color: var(--accent-text-on-solid);"
            class="min-h-[42px] px-4 py-2 rounded-lg text-sm font-semibold">Masuk</button>
        </div>
      </form>
    </div>
  </div>

  <script src="./src/config.js"></script>
  <script src="./src/gasClient.js"></script>
  <script src="./src/imageUploader.js"></script>
  <script>
    (function() {
      var IDR_FMT = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
      var isSubmitting_ = false;

      function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function formatCurrency(val) {
        if (val === null || val === undefined || val === '' || typeof val === 'boolean') return '-';
        var n = Number(val);
        return Number.isFinite(n) ? IDR_FMT.format(n) : 'Data tidak valid';
      }

      window.appShowToast = function(msg, type) {
        var region = document.getElementById('toast-region');
        var item = document.createElement('div');
        var bgVar = type === 'error' ? 'var(--danger-solid)' : 'var(--accent-solid)';
        var fgVar = type === 'error' ? 'var(--danger-text-on-solid)' : 'var(--accent-text-on-solid)';
        item.style.cssText = 'background-color:' + bgVar + ';color:' + fgVar + ';';
        item.className = 'pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium';
        item.textContent = msg;
        region.appendChild(item);
        setTimeout(function() { if (item.parentNode) item.parentNode.removeChild(item); }, 3500);
      };

      window.appOpenModal = function(id) {
        var el = document.getElementById(id);
        if (el) { el.classList.remove('hidden'); el.classList.add('flex'); }
      };

      window.appCloseModal = function(id) {
        var el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.classList.remove('flex'); }
      };

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') window.appCloseModal('modal-login');
      });

      window.appLoadItems = async function() {
        var vp = document.getElementById('table-viewport');
        vp.innerHTML = '<div class="animate-pulse space-y-2"><div class="h-10 rounded" style="background-color:var(--bg-interactive)"></div><div class="h-10 rounded" style="background-color:var(--bg-interactive)"></div></div>';
        var res = await window.GaslyClient.request('items.list', {});
        if (res.status !== 'success') {
          vp.innerHTML = '<div class="p-6 text-center space-y-3"><p class="text-sm">' + escapeHtml(res.message) + '</p>' +
            '<button type="button" onclick="window.appLoadItems()" style="background-color:var(--accent-solid);color:var(--accent-text-on-solid);" class="min-h-[42px] px-4 py-2 rounded-lg text-xs font-semibold">Coba Lagi</button></div>';
          return;
        }
        var items = (res.data && res.data.items) || [];
        document.getElementById('items-count').textContent = items.length + ' baris';
        if (items.length === 0) {
          vp.innerHTML = '<div class="p-8 text-center text-sm" style="color:var(--text-helper)">Belum ada transaksi tercatat. Gunakan formulir di atas untuk membuat transaksi pertama.</div>';
          return;
        }
        var rowsHtml = items.map(function(it) {
          var imgCell = it.file_id
            ? '<img src="' + escapeHtml(window.GaslyImage.driveImageUrl(it.file_id, 160)) + '" ' +
              'onerror="window.GaslyImage.handleDriveImageError(this, \'' + escapeHtml(it.file_id) + '\', 160)" ' +
              'referrerpolicy="no-referrer" loading="lazy" alt="Foto ' + escapeHtml(it.title) + '" class="w-12 h-12 object-cover rounded">'
            : '<span style="color:var(--text-helper)" class="text-xs">-</span>';
          return '<tr style="border-bottom:1px solid var(--border-subtle)">' +
            '<td class="py-3 px-2 text-xs font-mono">' + escapeHtml(it.id) + '</td>' +
            '<td class="py-3 px-2 text-sm font-medium">' + escapeHtml(it.title) + '</td>' +
            '<td class="py-3 px-2 text-xs">' + escapeHtml(it.category) + '</td>' +
            '<td class="py-3 px-2 text-sm text-right tabular-nums font-semibold">' + escapeHtml(formatCurrency(it.amount)) + '</td>' +
            '<td class="py-3 px-2">' + imgCell + '</td>' +
            '</tr>';
        }).join('');
        vp.innerHTML = '<table class="w-full text-left border-collapse"><thead><tr style="color:var(--text-helper);border-bottom:1px solid var(--border-subtle)" class="text-xs uppercase">' +
          '<th class="py-2 px-2">ID</th><th class="py-2 px-2">Judul</th><th class="py-2 px-2">Kategori</th><th class="py-2 px-2 text-right">Nominal</th><th class="py-2 px-2">Bukti</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>';
      };

      window.appSubmitItem = async function(ev) {
        ev.preventDefault();
        if (isSubmitting_) return;
        isSubmitting_ = true;
        var btn = document.getElementById('btn-submit-item');
        var statusEl = document.getElementById('upload-status-text');
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';

        try {
          var form = ev.target;
          var createRes = await window.GaslyClient.request('items.create', {
            title: form.title.value,
            category: form.category.value,
            amount: Number(form.amount.value),
            status: 'ACTIVE'
          });

          if (createRes.status !== 'success') {
            window.appShowToast(createRes.message || 'Gagal menyimpan data.', 'error');
            return;
          }

          var createdItem = createRes.data && createRes.data.item;
          var photoFile = form.photo.files && form.photo.files[0];

          if (photoFile && createdItem && createdItem.id) {
            var upRes = await window.GaslyImage.uploadPhoto({
              file: photoFile,
              entity: 'ITEMS',
              entityId: createdItem.id,
              onStateChange: function(st, msg) {
                statusEl.textContent = 'Status foto: ' + msg + ' (' + st + ')';
              }
            });
            if (!upRes || upRes.status !== 'success') {
              window.appShowToast('Data tersimpan, namun unggah foto gagal: ' + ((upRes && upRes.message) || ''), 'error');
            }
          }

          form.reset();
          statusEl.textContent = 'Status foto: siap (idle)';
          window.appShowToast('Transaksi berhasil disimpan.', 'success');
          await window.appLoadItems();
        } finally {
          isSubmitting_ = false;
          btn.disabled = false;
          btn.textContent = 'Simpan Transaksi';
        }
      };

      window.appSubmitLogin = async function(ev) {
        ev.preventDefault();
        var passInput = document.getElementById('login-passphrase');
        var persistInput = document.getElementById('login-persist');
        var btn = document.getElementById('btn-login-submit');
        btn.disabled = true;
        btn.textContent = 'Memverifikasi...';
        try {
          var res = await window.GaslyClient.loginWithPassphrase('admin', passInput.value, persistInput.checked);
          if (res.status === 'success') {
            passInput.value = '';
            window.appCloseModal('modal-login');
            window.appShowToast('Login Admin berhasil.', 'success');
          } else {
            window.appShowToast(res.message || 'Login gagal.', 'error');
          }
        } finally {
          btn.disabled = false;
          btn.textContent = 'Masuk';
        }
      };

      document.addEventListener('DOMContentLoaded', function() {
        window.appLoadItems();
      });
    })();
  </script>
</body>
</html>
```