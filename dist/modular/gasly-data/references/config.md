<!-- KB_VERSION: 2.1.0 -->
# APPS SCRIPT CONFIGURATION, SCHEMA & DEPLOYMENT (`gas/config.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-data`.

## Daftar Isi
1. [Konstanta Arsitektur & Penyimpanan `ScriptProperties`](#1-konstanta-arsitektur--penyimpanan-scriptproperties)
2. [Boilerplate `setup.gs` (Idempoten, Timezone, Passphrase Hash & Seed)](#2-boilerplate-setupgs-idempoten-timezone-passphrase-hash--seed)
3. [Prosedur Pembaruan Deployment Tanpa Mengubah URL `/exec`](#3-prosedur-pembaruan-deployment-tanpa-mengubah-url-exec)

---

## 1. Konstanta Arsitektur & Penyimpanan `ScriptProperties`

Seluruh rahasia dan parameter konfigurasi lingkungan disimpan di dalam `PropertiesService.getScriptProperties()`, tidak pernah di dalam kode frontend maupun di dalam sel Google Sheets:

| Kunci `ScriptProperties` | Tujuan | Contoh Nilai / Default |
| :--- | :--- | :--- |
| `SCHEMA_VERSION` | Melacak versi struktur kolom Sheet untuk migrasi non-destruktif. | `"1.0.0"` |
| `ACCESS_PROFILE` | Profil akses aplikasi (`P1`, `P3`, atau `P4`). | `"P3"` |
| `AUTH_HMAC_SECRET` | Kunci rahasia 32-byte (base64url) untuk menandatangani session token HMAC-SHA256. | Dibuat otomatis saat `initialSetupDatabase()` |
| `AUTH_PEPPER` | Rahasia tambahan di server untuk *salted iterated passphrase hashing*. | Dibuat otomatis saat `initialSetupDatabase()` |
| `ADMIN_PASSPHRASE_SALT` | Salt acak 16-byte (base64url) untuk passphrase admin. | Dibuat oleh `setupAdminPassphrase()` |
| `ADMIN_PASSPHRASE_HASH` | Hash hasil iterasi SHA-256 dari passphrase admin (minimal 12 karakter). | Dibuat oleh `setupAdminPassphrase()` |
| `ADMIN_PASSPHRASE_ITER` | Jumlah iterasi SHA-256 (default `2000`). | `"2000"` |
| `SESSION_TTL_SECONDS` | Masa berlaku session token dalam detik (default 2 jam). | `"7200"` |
| `LOCKOUT_THRESHOLD` | Jumlah maksimum gagal login berturut-turut per akun sebelum dikunci. | `"5"` |
| `LOCKOUT_DURATION_SEC` | Durasi penguncian akun setelah melewati batas gagal login (15 menit). | `"900"` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Web Client ID jika fitur login Google (`auth.google`) diaktifkan. | `"<opsional>.apps.googleusercontent.com"` |
| `DRIVE_ROOT_FOLDER_ID` | ID folder Google Drive induk tempat file unggahan (`ROOT/<entity>/<yyyy-mm>`) disimpan. | Dibuat/diisi saat setup |
| `MAX_UPLOAD_BYTES` | Batas ukuran byte file hasil decode pada `file.upload` (default 5 MB). | `"5242880"` |
| `WEBHOOK_SHARED_SECRET` | Rahasia bersama untuk memverifikasi payload dari proxy webhook pembayaran. | `"<opsional>"` |

---

## 2. Boilerplate `setup.gs` (Idempoten, Timezone, Passphrase Hash & Seed)

```javascript
// FILE: setup.gs
// Runtime: Google Apps Script V8

var SCHEMA_VERSION = '1.0.0';
var DEFAULT_TZ = 'Asia/Jakarta';
var ACCESS_PROFILE = 'P3'; // 'P1' | 'P3' | 'P4'

var DB_SCHEMAS = {
  ITEMS: [
    'id',
    'created_at',
    'updated_at',
    'title',
    'category',
    'amount',
    'status',
    'file_id',
    'file_url',
    'is_seed'
  ],
  ALLOWLIST: [
    'email',
    'role',
    'status',
    'created_at'
  ]
};

/**
 * Generates random web-safe base64 string for secrets and salts.
 */
function generateRandomSecret_(byteLength) {
  var seeds = [];
  for (var i = 0; i < (byteLength || 32); i++) {
    seeds.push(Math.floor(Math.random() * 256) - 128);
  }
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + ':' + new Date().getTime() + ':' + seeds.join(',')
  );
  return Utilities.base64EncodeWebSafe(raw).replace(/=+$/, '');
}

/**
 * Idempotent database and ScriptProperties initializer.
 * Kept public (no trailing underscore) so the owner can run it from the GAS IDE toolbar.
 */
function initialSetupDatabase() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Setup is currently locked by another process. Please retry.');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var props = PropertiesService.getScriptProperties();
    var tz = Session.getScriptTimeZone() || DEFAULT_TZ;

    // 1. Align Spreadsheet timezone with Script timezone
    if (ss.getSpreadsheetTimeZone() !== tz) {
      ss.setSpreadsheetTimeZone(tz);
    }

    // 2. Initialize cryptographic secrets and default config in ScriptProperties if unset
    if (!props.getProperty('AUTH_HMAC_SECRET')) {
      props.setProperty('AUTH_HMAC_SECRET', generateRandomSecret_(32));
    }
    if (!props.getProperty('AUTH_PEPPER')) {
      props.setProperty('AUTH_PEPPER', generateRandomSecret_(32));
    }
    if (!props.getProperty('ACCESS_PROFILE')) {
      props.setProperty('ACCESS_PROFILE', ACCESS_PROFILE);
    }
    if (!props.getProperty('SESSION_TTL_SECONDS')) {
      props.setProperty('SESSION_TTL_SECONDS', '7200');
    }
    if (!props.getProperty('LOCKOUT_THRESHOLD')) {
      props.setProperty('LOCKOUT_THRESHOLD', '5');
    }
    if (!props.getProperty('LOCKOUT_DURATION_SEC')) {
      props.setProperty('LOCKOUT_DURATION_SEC', '900');
    }
    if (!props.getProperty('MAX_UPLOAD_BYTES')) {
      props.setProperty('MAX_UPLOAD_BYTES', '5242880');
    }

    // 3. Create or migrate sheets non-destructively
    Object.keys(DB_SCHEMAS).forEach(function(sheetName) {
      var expectedHeaders = DB_SCHEMAS[sheetName];
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }

      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, expectedHeaders.length)
          .setValues([expectedHeaders])
          .setFontWeight('bold')
          .setBackground('#F1F5F9');
        sheet.setFrozenRows(1);
      } else {
        var lastCol = sheet.getLastColumn();
        var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
          return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        });
        expectedHeaders.forEach(function(reqHeader) {
          if (currentHeaders.indexOf(reqHeader) === -1) {
            lastCol += 1;
            sheet.getRange(1, lastCol).setValue(reqHeader).setFontWeight('bold').setBackground('#F1F5F9');
          }
        });
      }
    });

    // 4. Seed 16 historical rows with per-day sequence numbers if not yet seeded
    var itemsSheet = ss.getSheetByName('ITEMS');
    if (itemsSheet.getLastRow() <= 1 && props.getProperty('SEED_INITIALIZED') !== 'TRUE') {
      var now = new Date();
      var dayOffsets = [0, 0, 1, 1, 2, 3, 4, 6, 7, 9, 12, 15, 18, 21, 25, 29];
      var categories = ['Operasional', 'Pemasaran', 'Infrastruktur', 'Lisensi'];
      var statuses = ['ACTIVE', 'ACTIVE', 'COMPLETED', 'PENDING'];
      var seqByDay = {};
      var seedRows = [];

      for (var i = 0; i < dayOffsets.length; i++) {
        var d = new Date(now.getTime() - dayOffsets[i] * 86400000);
        var ymd = Utilities.formatDate(d, tz, 'yyyyMMdd');
        var isoOffset = Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
        seqByDay[ymd] = (seqByDay[ymd] || 0) + 1;
        var seqStr = ('0000' + seqByDay[ymd]).slice(-4);

        seedRows.push([
          'SEED-' + ymd + '-' + seqStr,
          isoOffset,
          isoOffset,
          'Contoh Transaksi #' + (i + 1),
          categories[i % categories.length],
          (i + 1) * 125000,
          statuses[i % statuses.length],
          '',
          '',
          'TRUE'
        ]);
      }
      itemsSheet.getRange(2, 1, seedRows.length, DB_SCHEMAS.ITEMS.length).setValues(seedRows);
      props.setProperty('SEED_INITIALIZED', 'TRUE');
    }

    // 5. Ensure a root Drive folder exists for uploads if not yet configured
    if (!props.getProperty('DRIVE_ROOT_FOLDER_ID')) {
      var folder = DriveApp.createFolder('Gasly_App_Uploads_' + ss.getId().slice(0, 6));
      props.setProperty('DRIVE_ROOT_FOLDER_ID', folder.getId());
    }

    props.setProperty('SCHEMA_VERSION', SCHEMA_VERSION);
    SpreadsheetApp.flush();
    return { status: 'success', schemaVersion: SCHEMA_VERSION };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sets or rotates the admin passphrase from the GAS Editor.
 * Edit the test passphrase inside a one-time helper or pass via manual call in the IDE,
 * then clear any temporary caller function so plaintext never remains in code.
 */
function configureAdminPassphrase_(newPassphrase) {
  if (typeof newPassphrase !== 'string' || newPassphrase.trim().length < 12) {
    throw new Error('Admin passphrase must be at least 12 characters long.');
  }
  var props = PropertiesService.getScriptProperties();
  var pepper = props.getProperty('AUTH_PEPPER');
  if (!pepper) {
    pepper = generateRandomSecret_(32);
    props.setProperty('AUTH_PEPPER', pepper);
  }
  var salt = generateRandomSecret_(16);
  var iterations = 2000;
  var hash = computeIteratedHash_(newPassphrase.trim(), salt, pepper, iterations);

  props.setProperties({
    ADMIN_PASSPHRASE_SALT: salt,
    ADMIN_PASSPHRASE_HASH: hash,
    ADMIN_PASSPHRASE_ITER: String(iterations)
  });
  return { status: 'success', message: 'Admin passphrase hash stored in ScriptProperties.' };
}
```

---

## 3. Prosedur Pembaruan Deployment Tanpa Mengubah URL `/exec`

1. **Deployment Pertama Kali:**
   - Di editor Google Apps Script, klik **Deploy > New deployment**.
   - Pilih jenis **Web app**.
   - Setel **Execute as: Me** (pemilik skrip).
   - Setel **Who has access: Anyone** (agar request `POST` `text/plain` lintas domain dari aplikasi frontend tidak diblokir halaman login HTML Google).
   - Salin URL `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec` ke konfigurasi frontend.
2. **Pembaruan Kode Berikutnya (URL Tetap):**
   - Klik **Deploy > Manage deployments**.
   - Pilih deployment aktif, lalu klik ikon **Edit (pensil)**.
   - Pada dropdown **Version**, pilih **New version**, lalu klik **Deploy**.
   - Dengan cara ini, `<DEPLOYMENT_ID>` dan URL `/exec` tidak berubah sehingga aplikasi frontend yang sudah ter-deploy tidak perlu dibangun ulang.