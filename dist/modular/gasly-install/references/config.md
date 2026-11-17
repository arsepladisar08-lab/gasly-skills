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
| `ADMIN_PASSPHRASE_SALT` | Salt acak 16-byte (base64url) untuk passphrase admin. | Dibuat oleh `configureAdminPassphrase_()` |
| `ADMIN_PASSPHRASE_HASH` | Hash hasil iterasi SHA-256 dari passphrase admin (minimal 12 karakter). | Dibuat oleh `configureAdminPassphrase_()` |
| `ADMIN_PASSPHRASE_ITER` | Jumlah iterasi SHA-256 (default `2000`). | `"2000"` |
| `SESSION_TTL_SECONDS` | Masa berlaku session token dalam detik (default 2 jam). | `"7200"` |
| `LOCKOUT_THRESHOLD` | Jumlah maksimum gagal login berturut-turut per akun sebelum dikunci. | `"5"` |
| `LOCKOUT_DURATION_SEC` | Durasi penguncian akun setelah melewati batas gagal login (15 menit). | `"900"` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Web Client ID jika fitur login Google (`auth.google`) diaktifkan. | `"<opsional>.apps.googleusercontent.com"` |
| `DRIVE_ROOT_FOLDER_ID` | ID folder Google Drive induk tempat file unggahan (`ROOT/<entity>/<yyyy-mm>`) disimpan. | Dibuat/diisi saat setup |
| `MAX_UPLOAD_BYTES` | Batas ukuran byte file hasil decode pada `file.upload` (default 5 MB). | `"5242880"` |
| `WEBHOOK_SHARED_SECRET` | Rahasia bersama untuk memverifikasi payload dari proxy webhook pembayaran. | `"<opsional>"` |
| `P2_LITE_AUTO_PROVISION` | Mengizinkan pembuatan baris `STAFF` otomatis pada sheet `USERS` saat login `auth.google` (`P2-lite`). | `"FALSE"` |
| `ADMIN_PASSPHRASE_INIT` | Passphrase admin awal minimal 12 karakter (sementara, dihapus otomatis oleh `setupAdminCredentials()`). | `"<sementara, dihapus otomatis>"` |
| `ADMIN_PIN_INIT` | PIN step-up admin 6 digit angka (sementara, dihapus otomatis oleh `setupAdminCredentials()`). | `"<sementara, dihapus otomatis>"` |

---

## 2. Boilerplate `setup.gs` (Idempoten, Timezone, Passphrase Hash & Seed)

```javascript
// FILE: setup.gs
// Runtime: Google Apps Script V8

var SCHEMA_VERSION = '1.1.0';
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
    'upload_nonce',
    'is_seed'
  ],
  ALLOWLIST: [
    'email',
    'role',
    'status',
    'created_at'
  ],
  USERS: [
    'id',
    'email',
    'name',
    'role',
    'status',
    'password_salt',
    'password_hash',
    'pin_salt',
    'pin_hash',
    'created_at',
    'updated_at'
  ],
  PLANS: [
    'id',
    'plan_code',
    'name',
    'price_amount',
    'billing_period',
    'max_quota',
    'features_json',
    'status',
    'updated_at',
    'is_seed'
  ],
  SUBSCRIPTIONS: [
    'id',
    'user_email',
    'plan_code',
    'status',
    'period_start',
    'period_end',
    'external_invoice_id',
    'provider_event_id',
    'created_at',
    'updated_at',
    'is_seed'
  ]
};

var DB_CLASSIFICATIONS = {
  ITEMS: 'CONFIDENTIAL',
  ALLOWLIST: 'INTERNAL',
  USERS: 'SENSITIVE_PII',
  PLANS: 'PUBLIC',
  SUBSCRIPTIONS: 'CONFIDENTIAL'
};

/**
 * Generates cryptographic web-safe base64 string for secrets and salts
 * using multiple CSPRNG UUIDv4 rounds (Zero Math.random()).
 */
function generateRandomSecret_(byteLength) {
  var targetLen = byteLength || 32;
  var entropyPool = [];
  var rounds = Math.ceil(targetLen / 16) + 2;
  for (var i = 0; i < rounds; i++) {
    entropyPool.push(Utilities.getUuid());
  }
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    entropyPool.join(':')
  );
  var encoded = Utilities.base64EncodeWebSafe(raw).replace(/=+$/, '');
  while (encoded.length < targetLen) {
    var extra = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      encoded + ':' + Utilities.getUuid()
    );
    encoded += Utilities.base64EncodeWebSafe(extra).replace(/=+$/, '');
  }
  return encoded.slice(0, targetLen);
}

/**
 * Maps a record object to an ordered row array matching expectedHeaders (Gate G-12).
 * Prevents setValues() column count mismatch during non-destructive schema migrations.
 */
function buildRowFromObject_(expectedHeaders, recordObj) {
  return expectedHeaders.map(function(col) {
    var val = recordObj[col];
    return val === undefined || val === null ? '' : val;
  });
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

    // 4. Seed 16 historical rows using Schema-Driven Object Mapping (Gate G-12)
    var itemsSheet = ss.getSheetByName('ITEMS');
    if (itemsSheet.getLastRow() <= 1 && props.getProperty('SEED_INITIALIZED') !== 'TRUE') {
      var now = new Date();
      var dayOffsets = [0, 0, 1, 1, 2, 3, 4, 6, 7, 9, 12, 15, 18, 21, 25, 29];
      var categories = ['Operasional', 'Pemasaran', 'Infrastruktur', 'Lisensi'];
      var statuses = ['ACTIVE', 'ACTIVE', 'COMPLETED', 'PENDING'];
      var seqByDay = {};
      var seedObjects = [];

      for (var i = 0; i < dayOffsets.length; i++) {
        var d = new Date(now.getTime() - dayOffsets[i] * 86400000);
        var ymd = Utilities.formatDate(d, tz, 'yyyyMMdd');
        var isoOffset = Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
        seqByDay[ymd] = (seqByDay[ymd] || 0) + 1;
        var seqStr = ('0000' + seqByDay[ymd]).slice(-4);

        seedObjects.push({
          id: 'SEED-' + ymd + '-' + seqStr,
          created_at: isoOffset,
          updated_at: isoOffset,
          title: 'Contoh Transaksi #' + (i + 1),
          category: categories[i % categories.length],
          amount: (i + 1) * 125000,
          status: statuses[i % statuses.length],
          file_id: '',
          file_url: '',
          upload_nonce: '',
          is_seed: 'TRUE'
        });
      }

      var activeHeaders = itemsSheet.getRange(1, 1, 1, itemsSheet.getLastColumn()).getValues()[0];
      var seedRows = seedObjects.map(function(obj) {
        return buildRowFromObject_(activeHeaders, obj);
      });
      itemsSheet.getRange(2, 1, seedRows.length, activeHeaders.length).setValues(seedRows);
      props.setProperty('SEED_INITIALIZED', 'TRUE');
    }

    var plansSheet = ss.getSheetByName('PLANS');
    if (plansSheet && plansSheet.getLastRow() <= 1) {
      var nowPlanIso = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
      var planYmd = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
      var planHeaders = plansSheet.getRange(1, 1, 1, plansSheet.getLastColumn()).getValues()[0];
      var planSeedObjects = [
        {
          id: 'SEED-' + planYmd + '-0001',
          plan_code: 'STARTER',
          name: 'Starter Plan',
          price_amount: 149000,
          billing_period: 'MONTHLY',
          max_quota: 50,
          features_json: '["50 Transaksi/Bulan","Dukungan Email"]',
          status: 'ACTIVE',
          updated_at: nowPlanIso,
          is_seed: 'TRUE'
        },
        {
          id: 'SEED-' + planYmd + '-0002',
          plan_code: 'PRO',
          name: 'Pro SaaS Plan',
          price_amount: 490000,
          billing_period: 'MONTHLY',
          max_quota: 1000,
          features_json: '["1.000 Transaksi/Bulan","Upload Drive & AI"]',
          status: 'ACTIVE',
          updated_at: nowPlanIso,
          is_seed: 'TRUE'
        }
      ];
      var planRows = planSeedObjects.map(function(obj) {
        return buildRowFromObject_(planHeaders, obj);
      });
      plansSheet.getRange(2, 1, planRows.length, planHeaders.length).setValues(planRows);
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

/**
 * Sets or rotates the 6-digit step-up PIN for the bootstrap 'admin' account in ScriptProperties.
 */
function configureAdminPin_(newPin) {
  var cleanPin = String(newPin || '').trim();
  if (!/^\d{6}$/.test(cleanPin)) {
    throw new Error('Admin step-up PIN must be exactly 6 digits.');
  }
  var props = PropertiesService.getScriptProperties();
  var pepper = props.getProperty('AUTH_PEPPER');
  if (!pepper) {
    pepper = generateRandomSecret_(32);
    props.setProperty('AUTH_PEPPER', pepper);
  }
  var iterations = Number(props.getProperty('ADMIN_PASSPHRASE_ITER') || 2000);
  var pinSalt = generateRandomSecret_(16);
  var pinHash = computeIteratedHash_(cleanPin, pinSalt, pepper, iterations);
  props.setProperties({
    ADMIN_PIN_SALT: pinSalt,
    ADMIN_PIN_HASH: pinHash
  });
  return { status: 'success', message: 'Admin step-up PIN hash stored in ScriptProperties.' };
}

/**
 * Public zero-argument initializer for bootstrap admin credentials from the GAS IDE toolbar.
 * Reads temporary ScriptProperties ADMIN_PASSPHRASE_INIT and ADMIN_PIN_INIT,
 * delegates to configureAdminPassphrase_ / configureAdminPin_, and ALWAYS deletes
 * both temporary properties (including when validation fails). Never logs or returns secret values.
 */
function setupAdminCredentials() {
  var props = PropertiesService.getScriptProperties();
  var rawPassphrase = props.getProperty('ADMIN_PASSPHRASE_INIT');
  var rawPin = props.getProperty('ADMIN_PIN_INIT');

  try {
    if (
      (rawPassphrase === null || rawPassphrase === undefined || rawPassphrase === '') &&
      (rawPin === null || rawPin === undefined || rawPin === '')
    ) {
      throw new Error('Set ADMIN_PASSPHRASE_INIT and/or ADMIN_PIN_INIT in ScriptProperties before running setupAdminCredentials().');
    }

    var passphraseConfigured = false;
    var pinConfigured = false;

    if (rawPassphrase !== null && rawPassphrase !== undefined && rawPassphrase !== '') {
      configureAdminPassphrase_(rawPassphrase);
      passphraseConfigured = true;
    }

    if (rawPin !== null && rawPin !== undefined && rawPin !== '') {
      configureAdminPin_(rawPin);
      pinConfigured = true;
    }

    return {
      status: 'success',
      code: 'OK',
      data: {
        passphraseConfigured: passphraseConfigured,
        pinConfigured: pinConfigured
      },
      message: 'Admin credentials configured and temporary init properties deleted.'
    };
  } finally {
    props.deleteProperty('ADMIN_PASSPHRASE_INIT');
    props.deleteProperty('ADMIN_PIN_INIT');
  }
}
  /**
  Sets or rotates the 6-digit step-up PIN for the bootstrap 'admin' account in ScriptProperties.
  */
  function configureAdminPin_(newPin) {
  var cleanPin = String(newPin || '').trim();
  if (!/^\d{6}$/.test(cleanPin)) {
  throw new Error('Admin step-up PIN must be exactly 6 digits.');
  }
  var props = PropertiesService.getScriptProperties();
  var pepper = props.getProperty('AUTH_PEPPER');
  if (!pepper) {
  pepper = generateRandomSecret_(32);
  props.setProperty('AUTH_PEPPER', pepper);
  }
  var iterations = Number(props.getProperty('ADMIN_PASSPHRASE_ITER') || 2000);
  var pinSalt = generateRandomSecret_(16);
  var pinHash = computeIteratedHash_(cleanPin, pinSalt, pepper, iterations);
  props.setProperties({
    ADMIN_PIN_SALT: pinSalt,
    ADMIN_PIN_HASH: pinHash
  });
  return { status: 'success', message: 'Admin step-up PIN hash stored in ScriptProperties.' };
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