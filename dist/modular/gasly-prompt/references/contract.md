<!-- KB_VERSION: 2.1.0 -->
# GASLY HEADLESS ARCHITECTURE & WIRE CONTRACT (`core/contract.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-prompt`, `gasly-data`, dan `gasly-ui`.

## Daftar Isi
1. [Topologi Arsitektur Tunggal](#1-topologi-arsitektur-tunggal)
2. [Protokol Transport HTTP (`text/plain` POST & GET)](#2-protokol-transport-http-textplain-post--get)
3. [Skema Request, Penamaan Action & Versioning](#3-skema-request-penamaan-action--versioning)
4. [Kontrak Response Envelope Kanonik & Kode Error](#4-kontrak-response-envelope-kanonik--kode-error)
5. [Idempotensi Mutasi (`idem`)](#5-idempotensi-mutasi-idem)
6. [Format Data pada Jalur Komunikasi & URL Gambar Drive](#6-format-data-pada-jalur-komunikasi--url-gambar-drive)
7. [Aturan Deployment Berkelanjutan (URL `/exec` Tetap)](#7-aturan-deployment-berkelanjutan-url-exec-tetap)

---

## 1. Topologi Arsitektur Tunggal

Seluruh aplikasi pada arsitektur utama Gasly memisahkan lapisan tampilan (*frontend*) dari lapisan penyimpanan (*Google Apps Script*):

```text
Browser / Client (Stack Frontend Apa Pun)
   │
   ├── HTTP POST (Content-Type: text/plain;charset=utf-8) ──► Apps Script Web App (.../exec)
   └── HTTP GET  (Query Params untuk Baca Publik/Idempoten) ─►   ├── Google Sheets (Database)
                                                                 └── Google Drive  (File & Foto)

Payment / External Webhook
   └──► Fungsi Serverless Kecil (Verifikasi Signature) ──────► Apps Script Web App (Shared Secret di Body)
```

1. **Satu Konfigurasi Frontend:** Frontend hanya membutuhkan tepat satu nilai konfigurasi lingkungan, yaitu URL Google Apps Script Web App (`https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`).
2. **URL Bersifat Publik:** Karena URL `/exec` dikirim ke bundle browser, URL tersebut dianggap publik. Seluruh keputusan otentikasi, otorisasi peran (*role*), validasi skema, dan pembatasan laju (*rate limiting*) wajib dieksekusi di dalam Google Apps Script, tidak pernah dipercaya dari sisi frontend.
3. **Headless Murni:** Dalam arsitektur ini, Google Apps Script tidak pernah merender halaman HTML frontend (`HtmlService` tidak dipakai untuk UI aplikasi).

---

## 2. Protokol Transport HTTP (`text/plain` POST & GET)

### A. Mengapa `Content-Type: text/plain;charset=utf-8` Wajib untuk POST
Endpoint Web App Google Apps Script (`.../exec`) merespons permintaan dengan pengalihan `HTTP 302` ke domain konten sementara (`script.googleusercontent.com`) dan tidak menjawab permintaan preflight `HTTP OPTIONS`.
- Jika browser mengirim header `Content-Type: application/json` atau header kustom (seperti `Authorization: Bearer ...` atau `X-Idempotency-Key`), browser akan mengirim preflight `OPTIONS` yang gagal karena ditolak oleh server Google.
- Dengan mengirim metode `POST`, header `Content-Type: text/plain;charset=utf-8`, opsi `redirect: "follow"`, dan meletakkan seluruh metadata (`auth`, `idem`, `action`, `v`, `payload`) di dalam body string JSON, permintaan dikategorikan sebagai *CORS simple request* sehingga tidak memicu preflight.

### B. Penanganan Error Terluar (`doPost` & `doGet`)
- Seluruh isi `doPost(e)` dan `doGet(e)` di Apps Script wajib dibungkus di dalam blok `try / catch` paling luar yang selalu mengembalikan objek JSON melalui:
  ```javascript
  ContentService.createTextOutput(JSON.stringify(envelope))
    .setMimeType(ContentService.MimeType.JSON);
  ```
- Jika terjadi *uncaught exception* di Apps Script, Google akan mengembalikan halaman HTML error bawaan tanpa header CORS, yang akan terlihat di browser sebagai error CORS palsu dan menyembunyikan penyebab aslinya.
- Jangan berasumsi Apps Script dapat membaca HTTP request header atau alamat IP client pada objek `e`. Oleh sebab itu, token sesi selalu dikirim di dalam properti `auth` pada body/query, dan pembatasan laju (*throttling*) dihitung per pengidentifikasi akun ditambah batas global di `CacheService`.

---

## 3. Skema Request, Penamaan Action & Versioning

### A. Format Body Request `POST`
Body HTTP `POST` adalah string JSON yang valid dengan struktur berikut:

```json
{
  "action": "domain.verb",
  "v": 1,
  "auth": "<session_token_string_atau_null>",
  "idem": "<idempotency_key_string_atau_null>",
  "payload": {}
}
```

### B. Format Query Parameter `GET` (Khusus Operasi Baca)
Operasi baca (`*.list`, `*.get`) boleh dipanggil melalui HTTP `GET` (misalnya saat *build-time* atau *ISR revalidation* di Next.js/Astro) dengan parameter query:
`?action=domain.verb&v=1&auth=<opsional>&payload=<encodeURIComponent(JSON.stringify(payload))>`

### C. Konvensi Penamaan `action` dan Allowlist Registry
- Gunakan format huruf kecil `domain.verb` yang dipisahkan satu titik.
- Contoh aksi standar:
  - Otentikasi: `auth.login`, `auth.google`, `auth.logout`, `auth.me`
  - Entitas Data: `<entity>.list`, `<entity>.get`, `<entity>.create`, `<entity>.update`, `<entity>.delete`
  - Unggahan File Drive: `file.ticket`, `file.upload`
  - Administrasi & Pemeliharaan: `admin.purgeSeed`, `admin.diagnostics`
  - Integrasi Eksternal: `webhook.receive`
- Server wajib memeriksa `action` terhadap *Central Action Registry* (allowlist eksplisit). Jika `action` tidak terdaftar atau nilai `v` tidak didukung, kembalikan error envelope dengan kode `VALIDATION_ERROR` (atau `NOT_FOUND` untuk action yang tidak dikenal).

---

## 4. Kontrak Response Envelope Kanonik & Kode Error

Arsitektur ini menggunakan kembali **Response Envelope Kanonik** repositori Gasly tanpa perubahan struktur agar seluruh tooling tetap kompatibel:

```json
{
  "status": "success | error",
  "data": {},
  "message": "Pesan ramah pengguna dalam Bahasa Indonesia",
  "code": "OK | VALIDATION_ERROR | NOT_FOUND | FORBIDDEN | CONFLICT | LOCK_TIMEOUT | INTERNAL_ERROR",
  "meta": {
    "schemaVersion": "1.0.0",
    "timestamp": "2026-11-14T08:00:00+07:00"
  }
}
```

### Taksonomi Kode (`code`)
| Kode | Status | Kondisi Penggunaan |
| :--- | :--- | :--- |
| `OK` | `success` | Permintaan berhasil diproses. |
| `VALIDATION_ERROR` | `error` | JSON body rusak, versi `v` tidak didukung, field wajib kosong, tipe/panjang salah, MIME/magic-byte file tidak valid, atau ukuran file melebihi batas. |
| `NOT_FOUND` | `error` | `action` tidak terdaftar di registry, baris data dengan `id` terkait tidak ditemukan, sheet belum diinisialisasi, atau `ticket` upload tidak ditemukan/kedaluwarsa. |
| `FORBIDDEN` | `error` | Token `auth` kosong/tidak valid/kedaluwarsa, peran pengguna tidak memiliki izin pada `action` tersebut, kredensial login salah, atau akun/sistem sedang dikunci oleh *rate limiter* (sertakan `meta.retryAfterSeconds` bila terkena throttle). |
| `CONFLICT` | `error` | Kegagalan konkurensi optimis (`payload.updated_at` berbeda dengan nilai `updated_at` saat ini di Sheet) atau duplikasi kunci unik. |
| `LOCK_TIMEOUT` | `error` | `LockService.getScriptLock().tryLock(10000)` gagal memperoleh kunci dalam batas waktu karena antrean tulis sedang padat. |
| `INTERNAL_ERROR` | `error` | Kesalahan tak terduga di sisi server. Detail teknis dicatat ke `console.error`, sedangkan `message` berisi teks aman bagi pengguna. |

---

## 5. Idempotensi Mutasi (`idem`)

1. **Kewajiban Key Idempotensi:** Seluruh aksi yang mengubah state (`*.create`, `*.update`, `*.delete`, `file.upload`, `webhook.receive`) wajib menyertakan string unik pada properti `idem` (misalnya UUID v4 yang dibuat oleh `gasClient` saat tombol submit ditekan).
2. **Perilaku Server:**
   - Sebelum menjalankan mutasi di dalam lock, server memeriksa kunci `idem:<action>:<idem>` di `CacheService.getScriptCache()`.
   - Jika ditemukan respon sukses yang tersimpan sebelumnya, server langsung mengembalikan envelope tersebut dengan tambahan `meta.idempotentReplay = true` tanpa mengeksekusi ulang penulisan Sheet/Drive.
   - Setelah mutasi berhasil, server menyimpan envelope sukses ke `CacheService` (misalnya selama 600 detik).
3. **Aturan Retry di Client (`gasClient`):**
   - `gasClient` hanya boleh melakukan *automatic retry* (maksimal 2 kali dengan *exponential backoff*) untuk aksi baca (`*.list`, `*.get`) atau aksi tulis yang menyertakan kunci `idem` yang sama ketika terjadi kegagalan jaringan atau kode `LOCK_TIMEOUT`. Jangan pernah me-retry error `VALIDATION_ERROR`, `FORBIDDEN`, atau `CONFLICT`.

---

## 6. Format Data pada Jalur Komunikasi & URL Gambar Drive

1. **Angka Mentah (`Number`):** Nominal uang, kuantitas, dan skor dikirim serta disimpan sebagai `Number` JSON murni. Pemformatan mata uang (`Intl.NumberFormat('id-ID')`) dilakukan di client dan dilarang mengubah nilai `null`/`undefined`/`NaN` menjadi `"Rp 0"`.
2. **Waktu Ber-Offset (`ISO-8601`):** Seluruh waktu dikirim sebagai string berformat `"yyyy-MM-dd'T'HH:mm:ssXXX"` sesuai zona waktu skrip (contoh: `"2026-11-14T09:30:00+07:00"`). Objek `Date` mentah dilarang keluar menuju JSON serializer tanpa melewati `sanitizeForClient_()`.
3. **Penyimpanan & Penampilan Gambar Google Drive:**
   - Pada baris Google Sheets, simpan dua kolom untuk setiap foto: `file_id` (sumber kebenaran utama) dan `file_url` (tautan kanonik `https://drive.google.com/file/d/<fileId>/view`).
   - Frontend dilarang menulis URL tampilan gambar secara *hardcoded* di komponen. Seluruh komponen wajib memanggil satu fungsi helper `driveImageUrl(fileId, width)` yang memiliki rantai fallback:
     1) Utama: `https://drive.google.com/thumbnail?id=<fileId>&sz=w<width>`
     2) Cadangan (`onerror`): `https://lh3.googleusercontent.com/d/<fileId>=w<width>`

---

## 7. Aturan Deployment Berkelanjutan (URL `/exec` Tetap)

- Saat pertama kali men-deploy Apps Script sebagai Web App, pilih **Execute as: Me** dan **Who has access: Anyone** agar endpoint `/exec` dapat menerima permintaan lintas-origin dari aplikasi frontend eksternal.
- Untuk setiap pembaruan kode berikutnya, **jangan membuat deployment baru** (karena akan mengubah URL `/exec` dan memutus konfigurasi frontend). Selalu gunakan menu **Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy** sehingga URL `/exec` tetap sama.