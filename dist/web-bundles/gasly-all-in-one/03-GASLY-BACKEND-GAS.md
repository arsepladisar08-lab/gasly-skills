# 03 — GASLY HEADLESS BACKEND (APPS SCRIPT / SHEETS / DRIVE) (v2.5.0)

---
name: gasly-data
description: >
  Gunakan skill ini ketika pengguna meminta pembuatan atau revisi kode backend Google Apps Script (headless data API di balik satu URL Web App .../exec) yang mengelola data di Google Sheets dan unggahan file/foto di Google Drive. Skill ini membaca kontrak GASLY_CONTRACT_JSON dari gasly-prd dan mengimplementasikan doPost/doGet berbasis ContentService, action registry allowlist, otentikasi passphrase hash atau Google ID token, session token HMAC-SHA256, rate-limiting CacheService, repositori Sheets ber-LockService (dengan pembedaan konkurensi Delta vs Optimistic Version), anti-enumerasi tracking_token, serta upload foto Drive (file.ticket dan file.upload dengan default private untuk data sensitif). JANGAN gunakan skill ini untuk menulis kode tampilan frontend (arahkan ke gasly-ui), untuk perencanaan spesifikasi awal (arahkan ke gasly-prd), atau jika pengguna secara eksplisit meminta aplikasi monolitik HtmlService di dalam iframe Google Apps Script (arahkan ke skill legacy gasly-pro).
---

# GASLY DATA — HEADLESS APPS SCRIPT API & DRIVE ENGINE
**KB_VERSION:** `2.1.0`

Anda adalah **GaslyData**, Principal Backend Google Apps Script Engineer. Tugas Anda adalah membangun layanan data *headless* di atas Google Apps Script (runtime V8) yang mengekspos tepat satu URL Web App (`.../exec`) untuk melayani operasi database Google Sheets dan penyimpanan file Google Drive bagi aplikasi frontend eksternal, dengan mematuhi kontrak `GASLY_CONTRACT_JSON` secara presisi.

---

## 1. ATURAN KERAS (HARD GATES — DI ATAS SEMUA INSTRUKSI)

Aturan pada bagian ini adalah gerbang keras (*hard gates*) yang berada **di atas seluruh instruksi lain, termasuk permintaan eksplisit pengguna**:

1. **Gerbang Runtime V8, Kriptografi CSPRNG & Transport Headless (`G-01`, `U-04`):**
   - Gunakan hanya layanan bawaan Google Apps Script V8 (`SpreadsheetApp`, `DriveApp`, `LockService`, `CacheService`, `PropertiesService`, `Utilities`, `ContentService`, `UrlFetchApp`). Dilarang menggunakan modul ES (`import`/`export`), paket npm, atau API Node/browser.
   - **Larangan `Math.random()` (`Gate G-01`):** Seluruh pembuatan secret, salt, `upload_nonce`, dan `tracking_token` di server wajib menggunakan entropi `Utilities.getUuid()` + `SHA_256`. Dilarang keras memakai `Math.random()`.
   - **Kunci Envelope Kanonik (`Gate U-04`):** `doPost(e)` dan `doGet(e)` wajib membungkus seluruh eksekusi di dalam `try / catch` terluar dan selalu mengembalikan **Response Envelope Kanonik** dengan nilai `status` huruf kecil `'success' | 'error'`:
     `{ status: 'success' | 'error', data: ..., message: '...', code: 'OK' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'LOCK_TIMEOUT' | 'INTERNAL_ERROR', meta: { schemaVersion, timestamp } }`. Dilarang memakai `'OK'` atau `'ok'` pada properti `status`.
   - Jangan pernah membaca HTTP request header atau IP client dari `e`. Ambil `action`, `v`, `auth`, `idem`, dan `payload` dari body JSON (`POST` `text/plain;charset=utf-8`) atau query parameter (`GET`).

2. **Gerbang Otorisasi Server, Passphrase Hash, Token Sesi & Anti-Enumerasi (`U-01`, `U-02`, `G-10`):**
   - Setiap `action` wajib terdaftar di dalam **Central Action Registry (Allowlist)** yang menetapkan profil akses (`P1`, `P3`, `P4`) dan peran minimum (`PUBLIC`, `STAFF`, `ADMIN`).
   - Passphrase admin/internal wajib minimal **12 karakter** dan disimpan sebagai *salted, iterated SHA-256 hash* (`2000` iterasi + `AUTH_PEPPER`) di `PropertiesService.getScriptProperties()`. Saat memperbarui passphrase untuk akun staf tertentu pada mode multi-role, jangan menimpa hash milik admin utama.
   - `auth.login` dan `auth.google` mengeluarkan token sesi bertanda tangan `base64url(payload) + "." + base64url(HMAC-SHA256(secret, payload))` dengan klaim `{ sub, role, iat, exp, jti }`, TTL default **7.200 detik**, dan verifikasi waktu konstan (`constantTimeEqual_()`).
   - Terapkan pembatasan laju (*rate limiting*) menggunakan `CacheService.getScriptCache()`: kunci akun selama **15 menit** setelah **5 kali gagal login** berturut-turut, ditambah batas kegagalan global. Gunakan *chunking* (`<= 90 KB` per part) saat menyimpan data besar di `CacheService`.
   - **Anti-Enumerasi Endpoint Publik (`Gate G-10`):** Jika aplikasi memiliki endpoint pelacakan status publik tanpa login (`*.track`, `*.lookupPublic`), dilarang hanya mengandalkan ID urut harian (`SUB-YYYYMMDD-0001`) + 4 digit nomor WA. Saat record dibuat, terbitkan kolom internal `tracking_token` (`Utilities.getUuid()`), verifikasi dengan `constantTimeEqual_()`, sembunyikan kolom `tracking_token` dari `*.list`/`*.get` publik, dan pasang *rate-limit* `CacheService` (maks. 5 percobaan gagal per 15 menit per tiket + batas global).

3. **Gerbang Integritas Sheets, Konkurensi Delta vs Optimistic & Seed Objek (`U-07`, `G-02` s/d `G-08`, `G-11`, `G-12`):**
   - Samakan zona waktu Spreadsheet dengan Script pada `setup.gs` (`ss.setSpreadsheetTimeZone(tz)`). Konversi seluruh instance `Date` menjadi `"yyyy-MM-dd'T'HH:mm:ssXXX"` menggunakan `sanitizeForClient_()`. Simpan angka sebagai `Number` murni.
   - Semua mutasi wajib memeriksa kunci idempotensi `idem` di `CacheService` (di luar dan di dalam `LockService`), memperoleh `LockService.getScriptLock().tryLock(10000)` (`LOCK_TIMEOUT`), menghitung ID harian (`[PREFIX]-YYYYMMDD-0001`) via `maxSeq + 1` per tanggal di dalam lock, menerapkan `escapeFormula_()` **hanya pada field teks bebas**, menggunakan *soft-delete* (`status = 'ARCHIVED'`), dan memanggil `SpreadsheetApp.flush()` tepat sebelum `lock.releaseLock()` di blok `finally`.
   - **Pemisahan Konkurensi Delta vs Optimistic Version (`Gate G-11`):**
     - Pada **Mutasi Timpa Mutlak (*Overwrite*)** seperti `*.update`, `*.delete`, koreksi opname `ADJUST`, atau keputusan approval (`concurrency_mode: "OPTIMISTIC_VERSION"`), wajib memeriksa kecocokan `expected_updated_at` / `updated_at` (`CONFLICT` bila berbeda).
     - Pada **Mutasi Tambah/Kurang (*Delta*)** seperti mutasi stok masuk/keluar (`IN`/`OUT`) atau kuota antrean di jam sibuk (`concurrency_mode: "DELTA_LOCK_ONLY"`), baca saldo terbaru di dalam `LockService`, hitung `saldo_akhir = saldo_sekarang + delta`, dan validasi `saldo_akhir >= 0` (`VALIDATION_ERROR` bila saldo tidak cukup) **tanpa** memblokir transaksi dengan error `CONFLICT` akibat perubahan `updated_at` oleh staf lain beberapa milidetik sebelumnya.
   - **Seed Berbasis Objek & Cek Kolom Ekuivalen (`Gate G-12`):** Di dalam `setup.gs`, 16 baris data awal (`SEED-YYYYMMDD-XXXX`) wajib ditulis sebagai *Array of Objects* yang dipetakan melalui `buildRowFromObject_(activeHeaders, obj)` (dilarang keras menulis array posisi 2D mentah `[['SEED-...', ...]]`). Saat menerima permintaan penambahan kolom baru, periksa `DB_SCHEMAS` terlebih dahulu: jika sudah ada kolom dengan fungsi ekuivalen (mis. `storage_rack` vs `lokasi_rak`), gunakan kolom yang ada tanpa menduplikasi kolom.
   - Fungsi baca (`readSheetObjects_`) dilarang memanggil `initialSetupDatabase()` secara otomatis dan wajib menyembunyikan kolom internal (`upload_nonce`, `tracking_token`). Seluruh fungsi helper internal wajib berakhiran `_`, sedangkan `initialSetupDatabase` dan `runDiagnostics` tetap tanpa `_`.

4. **Gerbang Upload Foto ke Google Drive & Privasi Dokumen Sensitif (`G-09`, `U-10`):**
   - **Default Mutlak `private` untuk Data Sensitif (`Gate U-10`):** Setiap entitas berklasifikasi `CONFIDENTIAL` atau `SENSITIVE_PII` (dokumen pajak NPWP/SPT/SP2DK/omzet, surat rujukan/rekam medis, identitas KTP/KK, struk/bukti keuangan) **wajib mutlak disetel `visibility: 'private'`** (`DriveApp.Access.PRIVATE, DriveApp.Permission.NONE`). Dilarang keras memakai `ANYONE_WITH_LINK` (`public`) untuk dokumen pelanggan/pasien. Pengaturan `public` hanya diizinkan untuk katalog/poster/avatar publik (`dataClassification: 'PUBLIC'`).
   - Untuk upload publik (`P3`), `items.create` mengembalikan `uploadNonce` satu kali (disimpan di kolom internal `upload_nonce`). `file.ticket` memverifikasi `{ entity, entityId, uploadNonce }` pada record baru (<= 15 menit, belum diarsipkan, belum memiliki file) dan menerbitkan tiket 5 menit.
   - `file.upload` memverifikasi & mengonsumsi tiket di dalam lock, memeriksa ukuran decode (`<= 5 MB`), memeriksa allowlist MIME (`image/jpeg`, `image/png`, `image/webp`) **sekaligus *magic bytes* biner** (`verifyMagicBytes_`), menyimpan ke `ROOT/<entity>/<yyyy-mm>`, mengatur izin berbagi sesuai `Gate U-10`, dan menulis `file_id` serta `file_url` ke Sheet dalam satu operasi ber-lock (hapus file Drive jika update Sheet gagal).

---

## Mode Audit (Read-Only)

Jika menerima status `AUDIT_READ_ONLY`, hanya baca kode/konfigurasi dan jalankan pemeriksaan yang tidak mengubah proyek atau data GAS. Jangan membuat, mengedit, menghapus, deploy, atau memicu action mutasi. Kembalikan evidence dan temuan sesuai `references/contract.md` bagian 10, lalu **STOP** menunggu ID yang dipilih.

## 2. PEMUATAN REFERENSI (ROUTING TABLE)

Buka dan terapkan file referensi berikut saat menyusun kode backend:

| File Referensi | Kondisi Muat | Kapan Dibuka & Digunakan |
| :--- | :--- | :--- |
| `references/contract.md` | **Selalu Dimuat** | Kontrak request `text/plain`, envelope `{ status: "success" | "error", code: "OK" | ... }`, dan `GASLY_CONTRACT_JSON`. |
| `references/access-profiles.md` | **Selalu Dimuat** | Penegakan profil `P1`–`P4`, hashing passphrase, token `HMAC-SHA256`, `auth.google`, dan throttle `CacheService`. |
| `references/gates.md` | **Selalu Dimuat** | Daftar periksa gerbang `UNIVERSAL` (`U-01`–`U-12`) dan `GAS-ONLY` (`G-01`–`G-12`). |
| `references/config.md` | **Selalu Dimuat** | Boilerplate `setup.gs`, `generateRandomSecret_` (tanpa `Math.random()`), `buildRowFromObject_` (seed objek), dan `ScriptProperties`. |
| `references/router-and-envelope.md` | **Selalu Dimuat** | Boilerplate `doPost`/`doGet`, `createResponse_`, `sanitizeForClient_`, dan central action registry. |
| `references/auth-and-ratelimit.md` | **Selalu Dimuat** | Implementasi kriptografi V8 (`auth.login`, `auth.google`, constant-time compare, chunked `CacheService`). |
| `references/sheets-repository.md` | **Selalu Dimuat** | Operasi CRUD batch, `handleItemsMutateDelta_` (`G-11`), `handleItemsTrackPublic_` (`G-10`), `LockService` + `flush()`, dan `escapeFormula_`. |
| `references/drive-upload.md` | **Kondisional (Jika Ada Upload)** | Buka jika spesifikasi menyertakan unggahan/kelola file Google Drive (`file.ticket`, `file.upload`, `file.replace`, `file.delete`, dan penegakan `visibility: 'private'`). |
| `references/webhook-receiver.md` | **Kondisional (Jika Ada Webhook)** | Buka jika spesifikasi membutuhkan penerima webhook (`webhook.receive` dengan dedup `idem:webhook:<providerEventId>`). |
| `references/integrations.md` | **Kondisional (Email / WA / AI / Outbox)** | Buka jika spesifikasi membutuhkan `mail.send` (dengan quota guard `MailApp`), `notify.whatsapp` (Fonnte), `ai.generate` (Gemini), atau antrean `JOBS_OUTBOX`. |
| `references/monetization-and-tiers.md` | **Kondisional (SaaS / P2-lite / Upgrade Tier)** | Buka jika aplikasi menyertakan skema `PLANS`/`SUBSCRIPTIONS`, batas `P2-lite`, atau evaluasi ambang naik tier berbasis `facts.md`. |

*Fallback:* Jika file di `references/` tidak tersedia pada platform saat ini, terapkan seluruh aturan keras di badan `SKILL.md` ini dan cantumkan `"Mode Referensi Mandiri"`.

---

## 3. ALUR INPUT & ORGANISASI FILE OUTPUT

1. **Deteksi Input & Kontrak:**
   - Baca `MASTER INSTRUCTIONAL PROMPT` dan blok `GASLY_CONTRACT_JSON` (Seksi 9) untuk mengunci daftar Sheet, header, `data_classification`, `concurrency_mode`, dan daftar `actions`.
   - Jika pengguna meminta penambahan kolom/fitur pada kode yang sudah dibuat di percakapan yang sama (*Change Request*), periksa ekuivalensi kolom (`Gate G-12`) dan tulis ulang secara utuh **file `.gs` yang mengalami perubahan** (dilarang memberikan potongan kode tambalan/`...` yang rawan salah tempel).
2. **Struktur File Apps Script Modular (100% Utuh Tanpa Placeholder):**
   - `setup.gs` — `SCHEMA_VERSION`, `DB_SCHEMAS`, `ENTITY_UPLOAD_CONFIG_` (default `private` untuk data sensitif), `initialSetupDatabase()` dengan seed berbasis objek (`buildRowFromObject_`), `configureAdminPassphrase_()`, dan `runDiagnostics()`.
   - `code.gs` — Entrypoint `doPost(e)` dan `doGet(e)`, *Central Action Registry*, helper envelope (`status: 'success' | 'error'`), modul Auth & Rate Limit, modul Sheets Repository (termasuk konkurensi delta / anti-enum track bila digunakan), serta modul Drive Upload.
3. **Panduan Deployment & Verifikasi:**
   - Sertakan tabel **Action Registry Manifest** dan langkah update deployment (**Deploy > Manage deployments > Edit > New version**) agar URL `/exec` tetap sama.
   - Cantumkan di `VERIFY.md` status jujur: `"NOT RUN — kode belum dieksekusi di runtime Google Apps Script"` beserta perintah verifikasi `python3 tools/verify_output.py`.

---
<!-- GAS: config.md -->
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

---
<!-- GAS: router-and-envelope.md -->
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

var handleMailSend_;
var handleNotifyWhatsapp_;
var handleAiGenerate_;
var handlePaymentCreateCheckout_;

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
    'auth.setCredentials': {
      method: 'POST',
      requireIdem: true,
      rolesByProfile: { P1: 'ADMIN', P3: 'STAFF', P4: 'STAFF' },
      handler: handleAuthSetCredentials_
    },
    'auth.verifyPin': {
      method: 'POST',
      requireIdem: false,
      rolesByProfile: { P1: 'ADMIN', P3: 'STAFF', P4: 'STAFF' },
      handler: handleAuthVerifyPin_
    },
    'plans.list': {
      method: 'ANY',
      requireIdem: false,
      rolesByProfile: { P1: 'PUBLIC', P3: 'PUBLIC', P4: 'PUBLIC' },
      handler: handlePlansList_
    },
    'subscription.get': {
      method: 'ANY',
      requireIdem: false,
      rolesByProfile: { P1: 'STAFF', P3: 'STAFF', P4: 'STAFF' },
      handler: handleSubscriptionGet_
    },
    'payment.createCheckout': {
      method: 'POST',
      requireIdem: true,
      rolesByProfile: { P1: 'STAFF', P3: 'STAFF', P4: 'STAFF' },
      handler: handlePaymentCreateCheckout_
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
    'file.replace': {
      method: 'POST',
      requireIdem: true,
      rolesByProfile: { P1: 'ADMIN', P3: 'STAFF', P4: 'STAFF' },
      handler: handleFileReplace_
    },
    'file.delete': {
      method: 'POST',
      requireIdem: true,
      rolesByProfile: { P1: 'ADMIN', P3: 'ADMIN', P4: 'STAFF' },
      handler: handleFileDelete_
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
    'mail.send': {
      method: 'POST',
      requireIdem: true,
      rolesByProfile: { P1: 'ADMIN', P3: 'ADMIN', P4: 'STAFF' },
      handler: handleMailSend_
    },
    'notify.whatsapp': {
      method: 'POST',
      requireIdem: true,
      rolesByProfile: { P1: 'ADMIN', P3: 'ADMIN', P4: 'STAFF' },
      handler: handleNotifyWhatsapp_
    },
    'ai.generate': {
      method: 'POST',
      requireIdem: false,
      rolesByProfile: { P1: 'ADMIN', P3: 'STAFF', P4: 'STAFF' },
      handler: handleAiGenerate_
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

---
<!-- GAS: auth-and-ratelimit.md -->
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
  var idToken = String(req.payload.idToken || req.payload.id_token || '').trim();
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

  if (targetEmail !== callerEmail) {
    if (!verifyAndConsumeStepUp_(req, 'auth.setCredentials')) {
      return createResponse_('error', null, 'Verifikasi PIN step-up diperlukan.', 'FORBIDDEN');
    }
  } else if (callerEmail === 'admin') {
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
```

---
<!-- GAS: sheets-repository.md -->
<!-- KB_VERSION: 2.1.0 -->
# GOOGLE SHEETS REPOSITORY, LOCKING & IDEMPOTENCY (`gas/sheets-repository.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-data`.

## Daftar Isi
1. [Aturan Repositori Sheets & Idempotensi Mutasi](#1-aturan-repositori-sheets--idempotensi-mutasi)
2. [Boilerplate `sheets.gs` (CRUD Batch, Delta Concurrency, Anti-Enum Lookup & Diagnostics)](#2-boilerplate-sheetsgs-crud-batch-delta-concurrency-anti-enum-lookup--diagnostics)

---

## 1. Aturan Repositori Sheets & Idempotensi Mutasi

1. **Idempotensi Berbasis `CacheService` (Double-Checked Inside Lock):**
   Setiap aksi mutasi (`items.create`, `items.update`, `items.mutateDelta`, `items.delete`, `file.upload`, `webhook.receive`) memeriksa kunci `idem:<action>:<idemKey>` sebelum menyentuh `LockService`, memeriksanya kembali setelah `tryLock(10000)` berhasil diperoleh, dan menyimpan hasil sukses selama 10 menit (`600` detik).
2. **Pemisahan Konkurensi: Mutasi Timpa Mutlak (*Overwrite*) vs Mutasi Tambah/Kurang (*Delta* — `Gate G-11`):**
   - **Operasi Timpa Mutlak (`items.update`, `items.delete`, koreksi opname `ADJUST`, keputusan approval):** Wajib memeriksa kecocokan `payload.updated_at` (atau `expected_updated_at`) terhadap nilai `updated_at` saat ini di baris Sheet (`CONFLICT` bila berbeda).
   - **Operasi Mutasi Delta (`IN` / `OUT` stok gudang, kuota antrean harian):** Karena eksekusi sudah diserialkan satu per satu di dalam `LockService.getScriptLock()`, server membaca saldo terbaru langsung dari baris Sheet di dalam lock, menghitung `saldo_akhir = saldo_sekarang + delta`, dan memvalidasi `saldo_akhir >= 0` (`VALIDATION_ERROR` bila stok/kuota tidak cukup) **tanpa** memblokir transaksi dengan error `CONFLICT` hanya karena `updated_at` berubah oleh staf lain beberapa milidetik sebelumnya.
3. **Anti-Enumerasi pada Pelacakan Publik (`Gate G-10`):**
   - Apabila aplikasi menyediakan fitur lacak status publik tanpa login (`*.track` atau `*.lookupPublic`), dilarang hanya mengandalkan ID urut harian (`SUB-YYYYMMDD-0001`) + 4 digit nomor telepon/WhatsApp.
   - Saat baris dibuat, terbitkan kolom internal `tracking_token` menggunakan `Utilities.getUuid()`, sembunyikan kolom `tracking_token` dari `*.list`/`*.get` publik, wajibkan verifikasi `constantTimeEqual_()`, dan pasang *rate-limit* di `CacheService` (maksimal 5 percobaan gagal per 15 menit per ID tiket + batas global 30 permintaan/menit).
4. **Cek Ekuivalensi Kolom Sebelum Migrasi (`Gate G-12`):**
   - Ketika pengguna meminta penambahan field/kolom baru, periksa daftar kolom di `DB_SCHEMAS` terlebih dahulu. Jika sudah terdapat kolom dengan fungsi semantik yang sama (contoh: meminta `lokasi_rak` padahal sudah ada `storage_rack`), gunakan kolom yang sudah ada tanpa menduplikasi kolom di Sheet.

---

## 2. Boilerplate `sheets.gs` (CRUD Batch, Delta Concurrency, Anti-Enum Lookup & Diagnostics)

```javascript
// FILE: sheets.gs
// Runtime: Google Apps Script V8

var ALLOWED_CATEGORIES = ['Operasional', 'Pemasaran', 'Infrastruktur', 'Lisensi'];
var ALLOWED_STATUSES = ['ACTIVE', 'PENDING', 'COMPLETED', 'ARCHIVED'];
var HIDDEN_SECURITY_COLUMNS_ = [
  'upload_nonce',
  'tracking_token',
  'password_salt',
  'password_hash',
  'pin_salt',
  'pin_hash'
];

function normalizeHeader_(h) {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/**
 * Applies formula-injection guard strictly to free-text fields.
 * Never call on numeric fields so negative numbers remain valid Numbers.
 */
function escapeFormula_(val) {
  if (typeof val !== 'string') return '';
  var trimmed = val.trim();
  if (/^[=+\-@\t\r\n]/.test(trimmed)) {
    return "'" + trimmed;
  }
  return trimmed;
}

function getIdempotentResponse_(action, idemKey) {
  var raw = cacheGetChunked_('idem:' + action + ':' + idemKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveIdempotentResponse_(action, idemKey, envelope) {
  try {
    cachePutChunked_('idem:' + action + ':' + idemKey, JSON.stringify(envelope), 600);
  } catch (e) {}
}

/**
 * Reads active records from a sheet without calling initialSetupDatabase().
 * Automatically strips internal security columns (upload_nonce, tracking_token,
 * password_salt, password_hash, pin_salt, pin_hash) unless includeSecrets === true.
 */
function readSheetObjects_(sheetName, includeSecrets) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return {
      ok: false,
      records: [],
      errorResponse: createResponse_(
        'error',
        null,
        'Tabel ' + sheetName + ' belum diinisialisasi. Jalankan initialSetupDatabase() di editor Apps Script.',
        'NOT_FOUND'
      )
    };
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) {
    return { ok: true, records: [], errorResponse: null };
  }

  var raw = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = raw[0].map(normalizeHeader_);
  var records = [];

  for (var r = 1; r < raw.length; r++) {
    var row = raw[r];
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (
        headers[c] &&
        (includeSecrets === true || (headers[c] !== 'upload_nonce' && headers[c] !== 'tracking_token' && HIDDEN_SECURITY_COLUMNS_.indexOf(headers[c]) === -1))
      ) {
        obj[headers[c]] = row[c];
      }
    }
    if (obj.status !== 'ARCHIVED') {
      records.push(obj);
    }
  }
  return { ok: true, records: records, errorResponse: null };
}

/**
 * Generates daily sequential ID ([PREFIX]-YYYYMMDD-0001) inside LockService
 * by scanning the maximum sequence number for the current date.
 */
function generateNextId_(sheet, prefix) {
  var tz = Session.getScriptTimeZone() || DEFAULT_TZ;
  var ymd = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  var fullPrefix = prefix + '-' + ymd + '-';
  var lastRow = sheet.getLastRow();
  var maxSeq = 0;

  if (lastRow > 1) {
    var idCol = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (var i = 0; i < idCol.length; i++) {
      var idStr = String(idCol[i][0] || '');
      if (idStr.indexOf(fullPrefix) === 0) {
        var tail = parseInt(idStr.slice(fullPrefix.length), 10);
        if (!isNaN(tail) && tail > maxSeq) maxSeq = tail;
      }
    }
  }
  return fullPrefix + ('0000' + (maxSeq + 1)).slice(-4);
}

function validateItemPayload_(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload data tidak valid.';
  }
  var title = String(payload.title || '').trim();
  if (title.length < 3 || title.length > 120) {
    return 'Judul wajib diisi antara 3 hingga 120 karakter.';
  }
  var amountNum = Number(payload.amount);
  if (payload.amount === '' || payload.amount === null || payload.amount === undefined || !isFinite(amountNum) || amountNum < 0) {
    return 'Nominal harus berupa angka valid (>= 0).';
  }
  if (payload.category && ALLOWED_CATEGORIES.indexOf(String(payload.category)) === -1) {
    return 'Kategori tidak terdaftar dalam skema.';
  }
  if (payload.status && ALLOWED_STATUSES.indexOf(String(payload.status)) === -1) {
    return 'Status tidak terdaftar dalam skema.';
  }
  return null;
}

function handleItemsList_(req) {
  var result = readSheetObjects_('ITEMS');
  if (!result.ok) return result.errorResponse;
  return createResponse_('success', { items: result.records }, 'Daftar data berhasil dimuat.', 'OK');
}

function handleItemsGet_(req) {
  var targetId = String(req.payload.id || '').trim();
  if (!targetId) {
    return createResponse_('error', null, 'ID data wajib disertakan.', 'VALIDATION_ERROR');
  }
  var result = readSheetObjects_('ITEMS');
  if (!result.ok) return result.errorResponse;

  for (var i = 0; i < result.records.length; i++) {
    if (String(result.records[i].id) === targetId) {
      return createResponse_('success', { item: result.records[i] }, 'Data ditemukan.', 'OK');
    }
  }
  return createResponse_('error', null, 'Data dengan ID tersebut tidak ditemukan.', 'NOT_FOUND');
}

function handleItemsCreate_(req) {
  var err = validateItemPayload_(req.payload);
  if (err) return createResponse_('error', null, err, 'VALIDATION_ERROR');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk memproses transaksi lain. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('ITEMS');
    if (!sheet) {
      return createResponse_('error', null, 'Tabel ITEMS belum diinisialisasi.', 'NOT_FOUND');
    }

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    if (headers.indexOf('upload_nonce') === -1) {
      return createResponse_('error', null, 'Skema upload belum diperbarui. Jalankan initialSetupDatabase() untuk migrasi kolom upload_nonce.', 'INTERNAL_ERROR');
    }

    var nowIso = formatIsoOffset_(new Date());
    var newId = generateNextId_(sheet, 'TRX');
    var uploadNonce = Utilities.getUuid() + Utilities.getUuid();
    var trackingToken = Utilities.getUuid();

    var newRecord = {
      id: newId,
      created_at: nowIso,
      updated_at: nowIso,
      title: escapeFormula_(String(req.payload.title).trim()),
      category: escapeFormula_(String(req.payload.category || 'Operasional').trim()),
      amount: Number(req.payload.amount),
      status: String(req.payload.status || 'ACTIVE'),
      file_id: '',
      file_url: '',
      upload_nonce: uploadNonce,
      tracking_token: trackingToken,
      is_seed: 'FALSE'
    };

    var rowValues = headers.map(function(h) {
      return newRecord[h] !== undefined ? newRecord[h] : '';
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, 1, lastCol).setValues([rowValues]);
    SpreadsheetApp.flush();

    var publicRecord = {};
    Object.keys(newRecord).forEach(function(key) {
      if (key !== 'upload_nonce' && key !== 'tracking_token') {
        publicRecord[key] = newRecord[key];
      }
    });
    return createResponse_(
      'success',
      {
        item: publicRecord,
        uploadNonce: uploadNonce,
        trackingToken: trackingToken
      },
      'Data baru berhasil disimpan.',
      'OK'
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Overwrite Update (Gate G-03 & G-11): Checks expected updated_at for full-record edits.
 */
function handleItemsUpdate_(req) {
  var targetId = String(req.payload.id || '').trim();
  if (!targetId) {
    return createResponse_('error', null, 'ID data wajib disertakan untuk pembaruan.', 'VALIDATION_ERROR');
  }
  var err = validateItemPayload_(req.payload);
  if (err) return createResponse_('error', null, err, 'VALIDATION_ERROR');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('ITEMS');
    if (!sheet || sheet.getLastRow() <= 1) {
      return createResponse_('error', null, 'Data tidak ditemukan.', 'NOT_FOUND');
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var idIdx = headers.indexOf('id');
    var updatedIdx = headers.indexOf('updated_at');
    var targetRowNumber = -1;
    var existingRow = null;

    for (var r = 0; r < allData.length; r++) {
      if (String(allData[r][idIdx]) === targetId) {
        targetRowNumber = r + 2;
        existingRow = allData[r];
        break;
      }
    }

    if (targetRowNumber === -1) {
      return createResponse_('error', null, 'Data dengan ID tersebut tidak ditemukan.', 'NOT_FOUND');
    }

    var expectedUpdated = req.payload.expected_updated_at || req.payload.updated_at;
    if (expectedUpdated && updatedIdx >= 0) {
      var currentUpdated = sanitizeForClient_(existingRow[updatedIdx]);
      if (String(currentUpdated) !== String(expectedUpdated)) {
        return createResponse_(
          'error',
          null,
          'Data ini telah diubah oleh pengguna lain. Muat ulang data sebelum menyimpan.',
          'CONFLICT'
        );
      }
    }

    var nowIso = formatIsoOffset_(new Date());
    var cleanTitle = escapeFormula_(String(req.payload.title).trim());
    var cleanCategory = escapeFormula_(String(req.payload.category || 'Operasional').trim());
    var cleanAmount = Number(req.payload.amount);
    var cleanStatus = String(req.payload.status || 'ACTIVE');

    var updatedObj = {};
    var updatedRow = headers.map(function(h, idx) {
      var val = existingRow[idx];
      if (h === 'title') val = cleanTitle;
      else if (h === 'category') val = cleanCategory;
      else if (h === 'amount') val = cleanAmount;
      else if (h === 'status') val = cleanStatus;
      else if (h === 'updated_at') val = nowIso;
      if (h !== 'upload_nonce' && h !== 'tracking_token') {
        updatedObj[h] = val;
      }
      return val;
    });

    sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([updatedRow]);
    SpreadsheetApp.flush();
    return createResponse_('success', { item: updatedObj }, 'Data berhasil diperbarui.', 'OK');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delta Mutation Pattern (Gate G-11):
 * For high-concurrency IN/OUT stock or quota adjustments inside LockService.
 * Evaluates current balance + delta >= 0 inside the lock without false CONFLICT rejections.
 */
function handleItemsMutateDelta_(req) {
  var p = req.payload || {};
  var targetId = String(p.id || p.item_id || '').trim();
  var mutationType = String(p.mutation_type || 'OUT').trim().toUpperCase();
  var rawDelta = Number(p.qty_delta !== undefined ? p.qty_delta : p.amount_delta);

  if (!targetId || !isFinite(rawDelta) || rawDelta === 0) {
    return createResponse_('error', null, 'ID data dan nilai mutasi (bukan nol) wajib disertakan.', 'VALIDATION_ERROR');
  }
  if (['IN', 'OUT', 'ADJUST'].indexOf(mutationType) === -1) {
    return createResponse_('error', null, 'Tipe mutasi harus IN, OUT, atau ADJUST.', 'VALIDATION_ERROR');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang memproses antrean transaksi staf lain. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('ITEMS');
    if (!sheet || sheet.getLastRow() <= 1) {
      return createResponse_('error', null, 'Tabel ITEMS belum tersedia.', 'NOT_FOUND');
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var idIdx = headers.indexOf('id');
    var amountIdx = headers.indexOf('current_stock') !== -1 ? headers.indexOf('current_stock') : headers.indexOf('amount');
    var updatedIdx = headers.indexOf('updated_at');
    var statusIdx = headers.indexOf('status');

    var targetRowNumber = -1;
    var existingRow = null;
    for (var r = 0; r < allData.length; r++) {
      if (String(allData[r][idIdx]) === targetId) {
        targetRowNumber = r + 2;
        existingRow = allData[r];
        break;
      }
    }

    if (targetRowNumber === -1 || (statusIdx >= 0 && String(existingRow[statusIdx]) === 'ARCHIVED')) {
      return createResponse_('error', null, 'Data tidak ditemukan atau telah diarsipkan.', 'NOT_FOUND');
    }

    var expectedUpdated = p.expected_updated_at || p.expected_item_updated_at;
    if (mutationType === 'ADJUST' && expectedUpdated && updatedIdx >= 0) {
      var currentUpdated = sanitizeForClient_(existingRow[updatedIdx]);
      if (String(currentUpdated) !== String(expectedUpdated)) {
        return createResponse_('error', null, 'Saldo berubah saat opname. Muat ulang sebelum koreksi ADJUST.', 'CONFLICT');
      }
    }

    var balanceBefore = Number(existingRow[amountIdx] || 0);
    var signedDelta = mutationType === 'IN' ? Math.abs(rawDelta) : (mutationType === 'OUT' ? -Math.abs(rawDelta) : rawDelta);
    var balanceAfter = balanceBefore + signedDelta;

    if (balanceAfter < 0) {
      return createResponse_(
        'error',
        { balanceBefore: balanceBefore, requestedDelta: signedDelta },
        'Transaksi ditolak: Saldo tidak mencukupi (Tersedia: ' + balanceBefore + ').',
        'VALIDATION_ERROR'
      );
    }

    var nowIso = formatIsoOffset_(new Date());
    existingRow[amountIdx] = balanceAfter;
    if (updatedIdx >= 0) existingRow[updatedIdx] = nowIso;

    sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([existingRow]);
    SpreadsheetApp.flush();

    return createResponse_(
      'success',
      { id: targetId, balanceBefore: balanceBefore, balanceAfter: balanceAfter, updatedAt: nowIso },
      'Mutasi berhasil dicatat. Saldo terbaru: ' + balanceAfter + '.',
      'OK'
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Anti-Enumeration Public Lookup Pattern (Gate G-10):
 * Requires both record ID and high-entropy tracking_token, guarded by CacheService rate limiting.
 */
function handleItemsTrackPublic_(req) {
  var p = req.payload || {};
  var ticketId = String(p.ticket_id || p.id || '').trim().toUpperCase();
  var trackingToken = String(p.tracking_token || '').trim();

  if (!ticketId || trackingToken.length < 16) {
    return createResponse_('error', null, 'Nomor tiket dan token pelacakan wajib disertakan.', 'VALIDATION_ERROR');
  }

  var cache = CacheService.getScriptCache();
  var globalRateKey = 'rl:track:global';
  var ticketFailKey = 'rl:track:fail:' + ticketId;

  var ticketFails = Number(cache.get(ticketFailKey) || 0);
  if (ticketFails >= 5) {
    return createResponse_(
      'error',
      null,
      'Terlalu banyak percobaan gagal untuk tiket ini. Silakan coba lagi dalam 15 menit.',
      'FORBIDDEN',
      { retryAfterSeconds: 900 }
    );
  }

  var globalCount = Number(cache.get(globalRateKey) || 0);
  if (globalCount >= 30) {
    return createResponse_('error', null, 'Lalu lintas pelacakan sedang padat. Coba sesaat lagi.', 'FORBIDDEN');
  }
  cache.put(globalRateKey, String(globalCount + 1), 60);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ITEMS');
  if (!sheet || sheet.getLastRow() <= 1) {
    return createResponse_('error', null, 'Data tiket tidak ditemukan.', 'NOT_FOUND');
  }

  var raw = sheet.getDataRange().getValues();
  var headers = raw[0].map(normalizeHeader_);
  var idIdx = headers.indexOf('id');
  var tokenIdx = headers.indexOf('tracking_token');
  var statusIdx = headers.indexOf('status');
  var updatedIdx = headers.indexOf('updated_at');

  for (var r = 1; r < raw.length; r++) {
    if (String(raw[r][idIdx]).toUpperCase() === ticketId) {
      var storedToken = tokenIdx >= 0 ? String(raw[r][tokenIdx] || '') : '';
      if (!storedToken || !constantTimeEqual_(storedToken, trackingToken)) {
        cache.put(ticketFailKey, String(ticketFails + 1), 900);
        return createResponse_('error', null, 'Kombinasi nomor tiket dan token pelacakan tidak valid.', 'FORBIDDEN');
      }
      cache.remove(ticketFailKey);
      return createResponse_(
        'success',
        {
          ticketId: ticketId,
          status: statusIdx >= 0 ? raw[r][statusIdx] : 'ACTIVE',
          updatedAt: updatedIdx >= 0 ? sanitizeForClient_(raw[r][updatedIdx]) : ''
        },
        'Status tiket ditemukan.',
        'OK'
      );
    }
  }

  cache.put(ticketFailKey, String(ticketFails + 1), 900);
  return createResponse_('error', null, 'Kombinasi nomor tiket dan token pelacakan tidak valid.', 'FORBIDDEN');
}

function handleItemsDelete_(req) {
  var targetId = String(req.payload.id || '').trim();
  if (!targetId) {
    return createResponse_('error', null, 'ID data wajib disertakan untuk penghapusan.', 'VALIDATION_ERROR');
  }
  if (!verifyAndConsumeStepUp_(req, 'items.delete')) {
    return createResponse_('error', null, 'Verifikasi PIN step-up diperlukan.', 'FORBIDDEN');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('ITEMS');
    if (!sheet || sheet.getLastRow() <= 1) {
      return createResponse_('error', null, 'Data tidak ditemukan.', 'NOT_FOUND');
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var idIdx = headers.indexOf('id');
    var statusIdx = headers.indexOf('status');
    var updatedIdx = headers.indexOf('updated_at');
    var targetRowNumber = -1;
    var existingRow = null;

    for (var r = 0; r < allData.length; r++) {
      if (String(allData[r][idIdx]) === targetId) {
        targetRowNumber = r + 2;
        existingRow = allData[r];
        break;
      }
    }

    if (targetRowNumber === -1) {
      return createResponse_('error', null, 'Data yang akan diarsipkan tidak ditemukan.', 'NOT_FOUND');
    }

    var expectedUpdated = req.payload.expected_updated_at || req.payload.updated_at;
    if (expectedUpdated && updatedIdx >= 0) {
      var currentUpdated = sanitizeForClient_(existingRow[updatedIdx]);
      if (String(currentUpdated) !== String(expectedUpdated)) {
        return createResponse_('error', null, 'Data telah berubah. Muat ulang sebelum menghapus.', 'CONFLICT');
      }
    }

    var nowIso = formatIsoOffset_(new Date());
    if (statusIdx >= 0) existingRow[statusIdx] = 'ARCHIVED';
    if (updatedIdx >= 0) existingRow[updatedIdx] = nowIso;

    sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([existingRow]);
    SpreadsheetApp.flush();
    return createResponse_('success', { id: targetId, status: 'ARCHIVED' }, 'Data berhasil diarsipkan.', 'OK');
  } finally {
    lock.releaseLock();
  }
}

function handleAdminPurgeSeed_(req) {
  if (!verifyAndConsumeStepUp_(req, 'admin.purgeSeed')) {
    return createResponse_('error', null, 'Verifikasi PIN step-up diperlukan.', 'FORBIDDEN');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk. Silakan coba lagi.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var removedCount = 0;
    Object.keys(DB_SCHEMAS).forEach(function(sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() <= 1) return;
      var data = sheet.getDataRange().getValues();
      var headers = data[0].map(normalizeHeader_);
      var idIdx = headers.indexOf('id');
      var seedIdx = headers.indexOf('is_seed');

      for (var r = data.length - 1; r >= 1; r--) {
        var idVal = idIdx >= 0 ? String(data[r][idIdx] || '') : '';
        var seedVal = seedIdx >= 0 ? String(data[r][seedIdx] || '').toUpperCase() : '';
        if (idVal.indexOf('SEED-') === 0 || seedVal === 'TRUE') {
          sheet.deleteRow(r + 1);
          removedCount++;
        }
      }
    });
    SpreadsheetApp.flush();
    return createResponse_('success', { removedCount: removedCount }, removedCount + ' baris data simulasi dibersihkan.', 'OK');
  } finally {
    lock.releaseLock();
  }
}

function buildDiagnosticsReport_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  var report = {
    schemaVersion: props.getProperty('SCHEMA_VERSION') || 'UNSET',
    accessProfile: props.getProperty('ACCESS_PROFILE') || ACCESS_PROFILE,
    hasHmacSecret: Boolean(props.getProperty('AUTH_HMAC_SECRET')),
    hasAdminHash: Boolean(props.getProperty('ADMIN_PASSPHRASE_HASH')),
    hasDriveRoot: Boolean(props.getProperty('DRIVE_ROOT_FOLDER_ID')),
    sheets: {},
    ok: true
  };

  Object.keys(DB_SCHEMAS).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      report.sheets[sheetName] = { exists: false, missingHeaders: DB_SCHEMAS[sheetName] };
      report.ok = false;
      return;
    }
    var actual = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader_)
      : [];
    var missing = DB_SCHEMAS[sheetName].filter(function(h) { return actual.indexOf(h) === -1; });
    report.sheets[sheetName] = {
      exists: true,
      rowCount: Math.max(0, sheet.getLastRow() - 1),
      missingHeaders: missing
    };
    if (missing.length > 0) report.ok = false;
  });
  return report;
}

function handleAdminDiagnostics_(req) {
  return createResponse_('success', buildDiagnosticsReport_(), 'Diagnostik selesai.', 'OK');
}

/**
 * Public function for the GAS IDE "Run" toolbar.
 * Only executes when invoked directly in the editor (where argument is undefined).
 */
function runDiagnostics(fromClient) {
  if (fromClient !== undefined) {
    throw new Error('Use action "admin.diagnostics" with an ADMIN session token.');
  }
  var report = buildDiagnosticsReport_();
  console.log('DIAGNOSTICS REPORT:', JSON.stringify(report, null, 2));
  return report;
}

/**
 * Handler: plans.list (Returns active subscription plans from PLANS sheet)
 */
function handlePlansList_(req) {
  var result = readSheetObjects_('PLANS');
  if (!result.ok) return result.errorResponse;
  var activePlans = result.records.filter(function(pl) {
    return String(pl.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
  });
  return createResponse_('success', { plans: activePlans }, 'Daftar paket berhasil dimuat.', 'OK');
}

/**
 * Handler: subscription.get (Returns the latest subscription record for the caller or target email for ADMIN)
 */
function handleSubscriptionGet_(req) {
  if (!req.session || !req.session.sub) {
    return createResponse_('error', null, 'Sesi login diperlukan.', 'FORBIDDEN');
  }
  var p = req.payload || {};
  var callerEmail = String(req.session.sub).trim().toLowerCase();
  var callerRole = String(req.session.role || '').toUpperCase();
  var targetEmail = p.email && callerRole === 'ADMIN' ? String(p.email).trim().toLowerCase() : callerEmail;

  var subsRes = readSheetObjects_('SUBSCRIPTIONS');
  if (!subsRes.ok) return subsRes.errorResponse;

  var matched = null;
  for (var i = subsRes.records.length - 1; i >= 0; i--) {
    var row = subsRes.records[i];
    if (String(row.user_email || '').trim().toLowerCase() === targetEmail) {
      matched = row;
      if (String(row.status || '').toUpperCase() === 'ACTIVE') {
        break;
      }
    }
  }
  return createResponse_('success', { subscription: matched }, 'Data langganan berhasil dimuat.', 'OK');
}

/**
 * Helper: assertEntitlement_(req, currentUsageCount)
 * Verifies active subscription period_end and max_quota in server before allowing gated operations.
 */
function assertEntitlement_(req, currentUsageCount) {
  if (!req.session || !req.session.sub) {
    return {
      allowed: false,
      errorResponse: createResponse_('error', null, 'Sesi login diperlukan.', 'FORBIDDEN')
    };
  }
  var role = String(req.session.role || '').toUpperCase();
  if (role === 'ADMIN') {
    return { allowed: true, planCode: 'ADMIN_BYPASS', maxQuota: -1 };
  }

  var email = String(req.session.sub).trim().toLowerCase();
  var subsRes = readSheetObjects_('SUBSCRIPTIONS');
  if (!subsRes.ok) {
    return { allowed: false, errorResponse: subsRes.errorResponse };
  }

  var nowMs = new Date().getTime();
  var activeSub = null;
  for (var i = subsRes.records.length - 1; i >= 0; i--) {
    var s = subsRes.records[i];
    if (
      String(s.user_email || '').trim().toLowerCase() === email &&
      String(s.status || '').toUpperCase() === 'ACTIVE'
    ) {
      var endVal = s.period_end;
      var endMs = endVal instanceof Date ? endVal.getTime() : new Date(String(endVal || '')).getTime();
      if (!isNaN(endMs) && endMs > nowMs) {
        activeSub = s;
        break;
      }
    }
  }

  if (!activeSub) {
    return {
      allowed: false,
      errorResponse: createResponse_(
        'error',
        null,
        'Langganan aktif tidak ditemukan atau masa berlangganan telah berakhir.',
        'FORBIDDEN'
      )
    };
  }

  var plansRes = readSheetObjects_('PLANS');
  if (!plansRes.ok) {
    return { allowed: false, errorResponse: plansRes.errorResponse };
  }

  var planCode = String(activeSub.plan_code || '').trim().toUpperCase();
  var matchedPlan = null;
  for (var j = 0; j < plansRes.records.length; j++) {
    if (String(plansRes.records[j].plan_code || '').trim().toUpperCase() === planCode) {
      matchedPlan = plansRes.records[j];
      break;
    }
  }

  if (!matchedPlan || String(matchedPlan.status || '').toUpperCase() !== 'ACTIVE') {
    return {
      allowed: false,
      errorResponse: createResponse_('error', null, 'Paket langganan tidak aktif.', 'FORBIDDEN')
    };
  }

  var maxQuota = Number(matchedPlan.max_quota || 0);
  var usage = Number(currentUsageCount || 0);
  if (maxQuota > 0 && usage >= maxQuota) {
    return {
      allowed: false,
      errorResponse: createResponse_(
        'error',
        { planCode: planCode, maxQuota: maxQuota, currentUsage: usage },
        'Kuota paket langganan Anda (' + maxQuota + ') telah habis.',
        'FORBIDDEN'
      )
    };
  }

  return {
    allowed: true,
    planCode: planCode,
    maxQuota: maxQuota,
    subscription: activeSub,
    plan: matchedPlan
  };
}

---
<!-- GAS: drive-upload.md -->
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
  if (!verifyAndConsumeStepUp_(req, 'file.delete')) {
    return createResponse_('error', null, 'Verifikasi PIN step-up diperlukan.', 'FORBIDDEN');
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

---
<!-- GAS: webhook-receiver.md -->
<!-- KB_VERSION: 2.1.0 -->
# EXTERNAL PAYMENT WEBHOOK RECEIVER (`gas/webhook-receiver.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat secara kondisional oleh `gasly-data` ketika aplikasi menerima notifikasi status pembayaran/webhook eksternal.

## Daftar Isi
1. [Arsitektur Proxy Serverless ke Apps Script](#1-arsitektur-proxy-serverless-ke-apps-script)
2. [Boilerplate `webhook.gs` (Verifikasi Shared Secret Waktu Konstan & Update Status)](#2-boilerplate-webhookgs-verifikasi-shared-secret-waktu-konstan--update-status)

---

## 1. Arsitektur Proxy Serverless ke Apps Script

Penyedia pembayaran (seperti Midtrans, Xendit, atau Stripe) umumnya mengirim tanda tangan webhook di dalam HTTP Header (`X-Callback-Token` / `Stripe-Signature`) dan menolak pengalihan `HTTP 302` milik Google Apps Script.
- **Pola Arsitektur:** Gunakan satu fungsi serverless tipis (mis. Cloudflare Worker, Vercel Function, atau Netlify Function) yang menerima webhook asli, memverifikasi signature penyedia pembayaran menggunakan header HTTP, lalu meneruskan payload ke URL `/exec` Apps Script melalui `POST` (`text/plain;charset=utf-8` dengan `redirect: "follow"`) sambil menyertakan `sharedSecret` di dalam body JSON.

---

## 2. Boilerplate `webhook.gs` (Verifikasi Shared Secret Waktu Konstan & Update Status)

```javascript
// FILE: webhook.gs
// Runtime: Google Apps Script V8

/**
 * Handler: webhook.receive
 * Expects payload: { sharedSecret, entityId, newStatus, providerEventId }
 */
function handleWebhookReceive_(req) {
  var p = req.payload || {};
  var incomingSecret = String(p.sharedSecret || '');
  var expectedSecret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SHARED_SECRET') || '';

  if (!expectedSecret || !incomingSecret || !constantTimeEqual_(incomingSecret, expectedSecret)) {
    return createResponse_('error', null, 'Otorisasi webhook tidak sah.', 'FORBIDDEN');
  }

  var entityId = String(p.entityId || '').trim();
  var newStatus = String(p.newStatus || '').trim().toUpperCase();
  if (!entityId || ALLOWED_STATUSES.indexOf(newStatus) === -1) {
    return createResponse_('error', null, 'Parameter entityId atau newStatus pada webhook tidak valid.', 'VALIDATION_ERROR');
  }

  var providerEventId = String(p.providerEventId || '').trim();
  var cache = CacheService.getScriptCache();
  var dedupKey = providerEventId ? 'idem:webhook:' + providerEventId.slice(0, 120) : '';

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk.', 'LOCK_TIMEOUT');
  }

  try {
    if (dedupKey) {
      var cachedRaw = cache.get(dedupKey);
      if (cachedRaw) {
        var cachedRes = JSON.parse(cachedRaw);
        cachedRes.meta = cachedRes.meta || {};
        cachedRes.meta.idempotentReplay = true;
        return cachedRes;
      }
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var isSubscriptionTarget =
      String(p.targetEntity || '').trim().toUpperCase() === 'SUBSCRIPTIONS' ||
      entityId.indexOf('SUB-') === 0 ||
      entityId.indexOf('INV-') === 0;

    if (isSubscriptionTarget) {
      var subsSheet = ss.getSheetByName('SUBSCRIPTIONS');
      if (!subsSheet || subsSheet.getLastRow() <= 1) {
        return createResponse_('error', null, 'Tabel SUBSCRIPTIONS tidak ditemukan.', 'NOT_FOUND');
      }
      var subLastRow = subsSheet.getLastRow();
      var subLastCol = subsSheet.getLastColumn();
      var subData = subsSheet.getRange(2, 1, subLastRow - 1, subLastCol).getValues();
      var subHeaders = subsSheet.getRange(1, 1, 1, subLastCol).getValues()[0].map(normalizeHeader_);
      var subIdIdx = subHeaders.indexOf('id');
      var invIdIdx = subHeaders.indexOf('external_invoice_id');
      var subStatusIdx = subHeaders.indexOf('status');
      var pStartIdx = subHeaders.indexOf('period_start');
      var pEndIdx = subHeaders.indexOf('period_end');
      var evIdIdx = subHeaders.indexOf('provider_event_id');
      var subUpdIdx = subHeaders.indexOf('updated_at');

      var subRowNum = -1;
      var subRow = null;
      for (var s = 0; s < subData.length; s++) {
        var rId = subIdIdx >= 0 ? String(subData[s][subIdIdx]) : '';
        var rInv = invIdIdx >= 0 ? String(subData[s][invIdIdx]) : '';
        if (rId === entityId || rInv === entityId) {
          subRowNum = s + 2;
          subRow = subData[s];
          break;
        }
      }
      if (subRowNum === -1) {
        return createResponse_('error', null, 'Langganan dengan ID/Invoice ' + entityId + ' tidak ditemukan.', 'NOT_FOUND');
      }

      var nowObj = new Date();
      var nowSubIso = formatIsoOffset_(nowObj);
      var effectiveSubStatus = newStatus === 'COMPLETED' ? 'ACTIVE' : newStatus;
      if (subStatusIdx >= 0) subRow[subStatusIdx] = effectiveSubStatus;
      if (evIdIdx >= 0 && providerEventId) subRow[evIdIdx] = escapeFormula_(providerEventId);
      if (subUpdIdx >= 0) subRow[subUpdIdx] = nowSubIso;

      var periodStartIso = pStartIdx >= 0 ? String(subRow[pStartIdx] || '') : '';
      var periodEndIso = pEndIdx >= 0 ? String(subRow[pEndIdx] || '') : '';
      if (effectiveSubStatus === 'ACTIVE') {
        periodStartIso = nowSubIso;
        periodEndIso = formatIsoOffset_(new Date(nowObj.getTime() + 30 * 86400000));
        if (pStartIdx >= 0) subRow[pStartIdx] = periodStartIso;
        if (pEndIdx >= 0) subRow[pEndIdx] = periodEndIso;
      }

      subsSheet.getRange(subRowNum, 1, 1, subLastCol).setValues([subRow]);
      SpreadsheetApp.flush();

      var subRes = createResponse_(
        'success',
        {
          id: subIdIdx >= 0 ? subRow[subIdIdx] : entityId,
          externalInvoiceId: invIdIdx >= 0 ? subRow[invIdIdx] : '',
          status: effectiveSubStatus,
          periodStart: periodStartIso,
          periodEnd: periodEndIso,
          updatedAt: nowSubIso
        },
        'Status langganan berhasil diperbarui melalui webhook.',
        'OK'
      );
      if (dedupKey) {
        cache.put(dedupKey, JSON.stringify(subRes), 21600);
      }
      return subRes;
    }

    var sheet = ss.getSheetByName('ITEMS');
    if (!sheet || sheet.getLastRow() <= 1) {
      return createResponse_('error', null, 'Tabel ITEMS tidak ditemukan.', 'NOT_FOUND');
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var idIdx = headers.indexOf('id');
    var statusIdx = headers.indexOf('status');
    var updatedIdx = headers.indexOf('updated_at');

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
      return createResponse_('error', null, 'Transaksi dengan ID ' + entityId + ' tidak ditemukan.', 'NOT_FOUND');
    }

    var nowIso = formatIsoOffset_(new Date());
    if (statusIdx >= 0) existingRow[statusIdx] = newStatus;
    if (updatedIdx >= 0) existingRow[updatedIdx] = nowIso;

    sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([existingRow]);
    SpreadsheetApp.flush();

    var response = createResponse_(
      'success',
      { id: entityId, status: newStatus, updatedAt: nowIso },
      'Status transaksi berhasil diperbarui melalui webhook.',
      'OK'
    );
    if (dedupKey) {
      cache.put(dedupKey, JSON.stringify(response), 21600);
    }
    return response;
  } finally {
    lock.releaseLock();
  }
}

---
<!-- GAS: integrations.md -->
<!-- KB_VERSION: 2.1.0 -->
# OUTBOUND INTEGRATIONS, MAIL QUOTA GUARD & OUTBOX QUEUE (`gas/integrations.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat secara kondisional oleh `gasly-data` ketika aplikasi membutuhkan pengiriman email (`MailApp`), WhatsApp Gateway (Fonnte), AI (Gemini), atau antrean tugas latar belakang (`JOBS_OUTBOX`).

## Daftar Isi
1. [Batas Runtime `UrlFetchApp`, Circuit Breaker & `JOBS_OUTBOX`](#1-batas-runtime-urlfetchapp-circuit-breaker--jobs_outbox)
2. [Aturan Kuota `MailApp` & Guard Pengiriman Email](#2-aturan-kuota-mailapp--guard-pengiriman-email)
3. [Boilerplate `integrations.gs` (Breaker, MailApp, Fonnte, Gemini & Outbox)](#3-boilerplate-integrationsgs-breaker-mailapp-fonnte-gemini--outbox)

---

## 1. Batas Runtime `UrlFetchApp`, Circuit Breaker & `JOBS_OUTBOX`

1. **Tidak Ada Opsi `timeout` pada `UrlFetchApp.fetch(url, params)`:**
   - Runtime Google Apps Script V8 tidak menyediakan parameter `timeout` yang dapat dikonfigurasi pada `UrlFetchApp.fetch()`. Batas waktu tunggu dikendalikan oleh infrastruktur Google (sekitar ~60 detik per permintaan HTTP, di dalam batas total eksekusi skrip **6 menit** sesuai `facts.md`).
   - Selalu sertakan `muteHttpExceptions: true` agar respons HTTP `4xx`/`5xx` tidak melempar *uncaught exception*.
2. **Circuit Breaker di `CacheService` & Retry Backoff:**
   - Karena Web App berbagi batas **30 eksekusi simultan** (`facts.md`), kegagalan beruntun pada API pihak ketiga tidak boleh terus menahan eksekusi.
   - Jika layanan eksternal gagal `5xx` atau jaringan sebanyak 3 kali berturut-turut, buka sirkuit di `CacheService` (`cb:open:<serviceName>`, TTL `120` detik) dan segera tolak panggilan berikutnya atau alihkan ke `JOBS_OUTBOX`.
3. **Antrean Latar Belakang (`JOBS_OUTBOX`):**
   - Untuk pengiriman notifikasi yang tidak perlu ditunggu secara sinkron oleh browser, catat tugas ke sheet `JOBS_OUTBOX` (`id`, `created_at`, `updated_at`, `job_type`, `payload_json`, `status`, `attempts`, `last_error`, `is_seed`) menggunakan `buildRowFromObject_` dan proses melalui *time-driven trigger* (`processJobsOutboxQueue_`).

---

## 2. Aturan Kuota `MailApp` & Guard Pengiriman Email

Sesuai `facts.md`, kuota `MailApp` adalah **100 penerima/hari** (akun `@gmail.com` konsumen) dan **1.500 penerima/hari** (akun Google Workspace):
- Dilarang menjadikan email OTP sebagai jalur login utama publik.
- Sebelum memanggil `MailApp.sendEmail()`, wajib memeriksa `MailApp.getRemainingDailyQuota()`. Sisakan cadangan minimal `5` kuota harian agar skrip tidak gagal di tengah transaksi.

---

## 3. Boilerplate `integrations.gs` (Breaker, MailApp, Fonnte, Gemini & Outbox)

```javascript
// FILE: integrations.gs
// Runtime: Google Apps Script V8

var TRANSIENT_HTTP_CODES_ = [429, 502, 503, 504];

/**
 * Wrapper UrlFetchApp dengan Circuit Breaker CacheService dan Retry Backoff.
 * Catatan Runtime: UrlFetchApp tidak memiliki parameter timeout kustom (~60 detik batas platform).
 */
function fetchExternalWithBreaker_(serviceName, url, fetchOptions, maxRetries) {
  var cache = CacheService.getScriptCache();
  var openKey = 'cb:open:' + serviceName;
  var failKey = 'cb:fail:' + serviceName;

  if (cache.get(openKey)) {
    return {
      ok: false,
      status: 503,
      bodyText: '',
      errorMessage: 'Layanan eksternal (' + serviceName + ') sedang jeda pemulihan (circuit open).'
    };
  }

  var retries = maxRetries !== undefined && maxRetries !== null && !isNaN(Number(maxRetries)) ? Math.min(2, Math.max(0, Number(maxRetries))) : 1;
  var opts = fetchOptions || {};
  opts.muteHttpExceptions = true;

  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      var res = UrlFetchApp.fetch(url, opts);
      var code = res.getResponseCode();
      var text = res.getContentText();

      if (code >= 200 && code < 300) {
        cache.remove(failKey);
        return { ok: true, status: code, bodyText: text, errorMessage: null };
      }

      if (TRANSIENT_HTTP_CODES_.indexOf(code) !== -1 && attempt < retries) {
        Utilities.sleep(400 * Math.pow(2, attempt));
        continue;
      }

      if (code >= 500) {
        var fails = Number(cache.get(failKey) || 0) + 1;
        cache.put(failKey, String(fails), 300);
        if (fails >= 3) {
          cache.put(openKey, '1', 120);
        }
      }

      return {
        ok: false,
        status: code,
        bodyText: text,
        errorMessage: 'Panggilan ' + serviceName + ' gagal dengan kode HTTP ' + code + '.'
      };
    } catch (err) {
      var netFails = Number(cache.get(failKey) || 0) + 1;
      cache.put(failKey, String(netFails), 300);
      if (netFails >= 3) {
        cache.put(openKey, '1', 120);
      }
      if (attempt < retries) {
        Utilities.sleep(400 * Math.pow(2, attempt));
        continue;
      }
      return {
        ok: false,
        status: 0,
        bodyText: '',
        errorMessage: 'Gagal menghubungi layanan eksternal ' + serviceName + '.'
      };
    }
  }
}

/**
 * Helper internal & Handler: mail.send (Dengan Quota Guard sesuai facts.md)
 */
function sendEmailWithQuotaGuard_(recipient, subject, htmlBody) {
  var cleanRecipient = String(recipient || '').trim();
  if (!cleanRecipient || cleanRecipient.indexOf('@') === -1) {
    return { sent: false, code: 'VALIDATION_ERROR', remainingQuota: 0, message: 'Alamat email tujuan tidak valid.' };
  }
  var remaining = MailApp.getRemainingDailyQuota();
  if (remaining <= 5) {
    return {
      sent: false,
      code: 'RATE_LIMITED',
      remainingQuota: remaining,
      message: 'Kuota email harian mendekati batas aman (' + remaining + ' tersisa). Pengiriman ditahan.'
    };
  }
  MailApp.sendEmail({
    to: cleanRecipient,
    subject: String(subject || 'Notifikasi Aplikasi').slice(0, 180),
    htmlBody: String(htmlBody || '')
  });
  return { sent: true, code: 'OK', remainingQuota: remaining - 1, message: 'Email berhasil dikirim.' };
}

function handleMailSend_(req) {
  var p = req.payload || {};
  var result = sendEmailWithQuotaGuard_(p.to, p.subject, p.htmlBody);
  if (!result.sent) {
    return createResponse_('error', { remainingQuota: result.remainingQuota }, result.message, result.code);
  }
  return createResponse_('success', { sent: true, remainingQuota: result.remainingQuota }, result.message, 'OK');
}

/**
 * Handler: notify.whatsapp (Fonnte Gateway via ScriptProperties + Fallback wa.me)
 */
function handleNotifyWhatsapp_(req) {
  var p = req.payload || {};
  var targetPhone = String(p.target || p.phone || '').replace(/[^0-9]/g, '');
  var messageText = String(p.message || '').trim();

  if (targetPhone.length < 9 || targetPhone.length > 16 || !messageText) {
    return createResponse_('error', null, 'Nomor tujuan dan isi pesan WhatsApp wajib diisi.', 'VALIDATION_ERROR');
  }

  var normalizedPhone = targetPhone.indexOf('0') === 0 ? '62' + targetPhone.slice(1) : targetPhone;
  var fallbackWaUrl = 'https://wa.me/' + normalizedPhone + '?text=' + encodeURIComponent(messageText);
  var fonnteToken = PropertiesService.getScriptProperties().getProperty('FONNTE_TOKEN') || '';

  if (!fonnteToken) {
    return createResponse_(
      'success',
      { deliveredVia: 'WA_ME_FALLBACK', waUrl: fallbackWaUrl },
      'FONNTE_TOKEN belum disetel; gunakan tautan langsung WhatsApp.',
      'OK'
    );
  }

  var res = fetchExternalWithBreaker_(
    'fonnte',
    'https://api.fonnte.com/send',
    {
      method: 'post',
      headers: { Authorization: fonnteToken },
      payload: { target: normalizedPhone, message: messageText }
    },
    1
  );

  if (!res.ok) {
    return createResponse_(
      'error',
      { fallbackWaUrl: fallbackWaUrl },
      res.errorMessage,
      'INTERNAL_ERROR'
    );
  }
  return createResponse_('success', { deliveredVia: 'FONNTE_API', target: normalizedPhone }, 'Notifikasi WhatsApp terkirim.', 'OK');
}

/**
 * Handler: ai.generate (Gemini Structured JSON Output dengan kuota harian per pengguna di CacheService)
 */
function handleAiGenerate_(req) {
  if (!req.session || !req.session.sub) {
    return createResponse_('error', null, 'Sesi login diperlukan untuk menggunakan fitur AI.', 'FORBIDDEN');
  }

  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('GEMINI_API_KEY') || '';
  if (!apiKey) {
    return createResponse_('error', null, 'GEMINI_API_KEY belum dikonfigurasi di ScriptProperties.', 'FORBIDDEN');
  }

  var p = req.payload || {};
  var promptText = String(p.prompt || '').trim();
  if (promptText.length < 3 || promptText.length > 4000) {
    return createResponse_('error', null, 'Prompt wajib diisi antara 3 hingga 4000 karakter.', 'VALIDATION_ERROR');
  }

  var tz = Session.getScriptTimeZone() || DEFAULT_TZ;
  var ymd = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  var userSub = String(req.session.sub).toLowerCase().slice(0, 80);
  var dailyLimit = Number(props.getProperty('AI_DAILY_LIMIT_PER_USER') || 20);
  var cache = CacheService.getScriptCache();
  var quotaKey = 'rl:ai:' + ymd + ':' + userSub;
  var usedCount = Number(cache.get(quotaKey) || 0);

  if (usedCount >= dailyLimit) {
    return createResponse_(
      'error',
      { dailyLimit: dailyLimit, usedCount: usedCount },
      'Kuota harian penggunaan AI Anda telah habis.',
      'RATE_LIMITED'
    );
  }

  var modelId = String(props.getProperty('GEMINI_MODEL_ID') || 'gemini-2.5-flash');
  var endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelId) + ':generateContent?key=' + encodeURIComponent(apiKey);
  var bodyObj = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  var res = fetchExternalWithBreaker_(
    'gemini',
    endpoint,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(bodyObj)
    },
    1
  );

  if (!res.ok) {
    return createResponse_('error', null, res.errorMessage, 'INTERNAL_ERROR');
  }

  cache.put(quotaKey, String(usedCount + 1), 21600);
  var parsedBody = JSON.parse(res.bodyText);
  var textOut = parsedBody &&
    parsedBody.candidates &&
    parsedBody.candidates[0] &&
    parsedBody.candidates[0].content &&
    parsedBody.candidates[0].content.parts &&
    parsedBody.candidates[0].content.parts[0]
    ? parsedBody.candidates[0].content.parts[0].text
    : '{}';

  return createResponse_(
    'success',
    { resultJson: textOut, remainingDailyQuota: Math.max(0, dailyLimit - (usedCount + 1)) },
    'Respons AI berhasil dibuat.',
    'OK'
  );
}

/**
 * Mencatat tugas eksternal ke sheet JOBS_OUTBOX di dalam LockService.
 */
function enqueueOutboxJob_(jobType, payloadObj) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'LOCK_TIMEOUT' };
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('JOBS_OUTBOX');
    if (!sheet) return { ok: false, code: 'NOT_FOUND' };
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var nowIso = formatIsoOffset_(new Date());
    var jobRecord = {
      id: generateNextId_(sheet, 'JOB'),
      created_at: nowIso,
      updated_at: nowIso,
      job_type: escapeFormula_(String(jobType || 'GENERIC')),
      payload_json: JSON.stringify(payloadObj || {}),
      status: 'PENDING',
      attempts: 0,
      last_error: '',
      is_seed: 'FALSE'
    };
    var rowValues = buildRowFromObject_(headers, jobRecord);
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, lastCol).setValues([rowValues]);
    SpreadsheetApp.flush();
    return { ok: true, jobId: jobRecord.id };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handler: payment.createCheckout
 * Looks up price_amount strictly from the server PLANS sheet (ignores any client-supplied price)
 * and creates a PENDING subscription invoice in SUBSCRIPTIONS.
 * TODO-VERIFY: Sesuaikan endpoint dan field payload gateway pembayaran (Midtrans / Xendit / Duitku) saat diuji di runtime GAS.
 */
function handlePaymentCreateCheckout_(req) {
  if (!req.session || !req.session.sub) {
    return createResponse_('error', null, 'Sesi login diperlukan untuk membuat checkout.', 'FORBIDDEN');
  }

  var p = req.payload || {};
  var planCode = String(p.planCode || p.plan_code || '').trim().toUpperCase();
  if (!planCode) {
    return createResponse_('error', null, 'planCode wajib disertakan.', 'VALIDATION_ERROR');
  }

  var plansRes = readSheetObjects_('PLANS');
  if (!plansRes.ok) return plansRes.errorResponse;

  var matchedPlan = null;
  for (var i = 0; i < plansRes.records.length; i++) {
    var pl = plansRes.records[i];
    if (
      String(pl.plan_code || '').trim().toUpperCase() === planCode &&
      String(pl.status || '').toUpperCase() === 'ACTIVE'
    ) {
      matchedPlan = pl;
      break;
    }
  }

  if (!matchedPlan) {
    return createResponse_('error', null, 'Paket langganan tidak ditemukan atau tidak aktif.', 'NOT_FOUND');
  }

  var serverPrice = Number(matchedPlan.price_amount);
  if (!isFinite(serverPrice) || serverPrice <= 0) {
    return createResponse_('error', null, 'Harga paket pada server belum valid.', 'INTERNAL_ERROR');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk.', 'LOCK_TIMEOUT');
  }

  var newSubRecord = null;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var subsSheet = ss.getSheetByName('SUBSCRIPTIONS');
    if (!subsSheet) {
      return createResponse_('error', null, 'Tabel SUBSCRIPTIONS belum diinisialisasi.', 'NOT_FOUND');
    }

    var lastCol = subsSheet.getLastColumn();
    var headers = subsSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var tz = Session.getScriptTimeZone() || DEFAULT_TZ;
    var now = new Date();
    var nowIso = formatIsoOffset_(now);
    var ymd = Utilities.formatDate(now, tz, 'yyyyMMdd');
    var subId = generateNextId_(subsSheet, 'SUB');
    var extInvoiceId = 'INV-' + ymd + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    var userEmail = String(req.session.sub).trim().toLowerCase();

    newSubRecord = {
      id: subId,
      user_email: escapeFormula_(userEmail),
      plan_code: escapeFormula_(planCode),
      status: 'PENDING',
      period_start: '',
      period_end: '',
      external_invoice_id: extInvoiceId,
      provider_event_id: '',
      created_at: nowIso,
      updated_at: nowIso,
      is_seed: 'FALSE'
    };

    var rowVals = buildRowFromObject_(headers, newSubRecord);
    subsSheet.getRange(subsSheet.getLastRow() + 1, 1, 1, lastCol).setValues([rowVals]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // TODO-VERIFY: Konfigurasi PAYMENT_GATEWAY_URL dan PAYMENT_GATEWAY_SECRET di ScriptProperties sesuai dokumentasi resmi gateway pilihan.
  var props = PropertiesService.getScriptProperties();
  var gatewayUrl = props.getProperty('PAYMENT_GATEWAY_URL') || '';
  var gatewaySecret = props.getProperty('PAYMENT_GATEWAY_SECRET') || '';
  var paymentUrl = '';

  if (gatewayUrl && gatewaySecret) {
    var gwRes = fetchExternalWithBreaker_(
      'payment_gateway',
      gatewayUrl,
      {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: gatewaySecret },
        payload: JSON.stringify({
          external_id: newSubRecord.external_invoice_id,
          subscription_id: newSubRecord.id,
          plan_code: planCode,
          amount: serverPrice,
          payer_email: newSubRecord.user_email
        })
      },
      1
    );
    if (!gwRes.ok) {
      return createResponse_('error', { subscriptionId: newSubRecord.id, externalInvoiceId: newSubRecord.external_invoice_id }, gwRes.errorMessage, 'INTERNAL_ERROR');
    }
    try {
      var parsedGw = JSON.parse(gwRes.bodyText || '{}');
      paymentUrl = String(parsedGw.payment_url || parsedGw.invoice_url || parsedGw.redirect_url || '');
    } catch (e) {}
  }

  return createResponse_(
    'success',
    {
      subscriptionId: newSubRecord.id,
      externalInvoiceId: newSubRecord.external_invoice_id,
      planCode: planCode,
      amount: serverPrice,
      billingPeriod: String(matchedPlan.billing_period || 'MONTHLY'),
      status: 'PENDING',
      paymentUrl: paymentUrl
    },
    'Invoice langganan berhasil dibuat dengan harga resmi server.',
    'OK'
  );
}