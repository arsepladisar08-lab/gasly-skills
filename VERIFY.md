# VERIFICATION LOG, ASSUMPTIONS & MANUAL TEST CHECKLIST (`VERIFY.md`)

Dokumen ini merupakan konsolidasi akhir dari seluruh penanda versi (`<<PIN_VERSION>>`), asumsi perilaku platform Google Apps Script & browser yang belum dapat diverifikasi di dalam ruang chat statis, dokumentasi pemeriksaan CI opsional, serta perintah dan daftar periksa pengujian manual bagi pemilik repositori.

> **Status Verifikasi:** CI GitHub menjalankan build, pemeriksaan WCAG AA, unit test Python, dan Node stub harness pada setiap push/PR (lihat [workflow runs](https://github.com/arsepladisar08-lab/gasly-skills/actions)). Status lulus/gagal harus dinilai dari run untuk commit terbaru. **Status Runtime Google Apps Script:** `NOT RUN` — belum ada bukti eksekusi di deployment GAS, Google Sheets, atau Google Drive yang sebenarnya.

---

## 1. Daftar Penanda `<<PIN_VERSION>>` yang Harus Dipakukan

| Lokasi File | Komponen / Paket | Nilai Saat Ini | Tindakan Verifikasi Pemilik |
| :--- | :--- | :--- | :--- |
| `.github/workflows/validate.yml` | `actions/setup-python` (`python-version`) | `"3.12"` (`<<PIN_VERSION>>`) | Sesuaikan dengan versi Python 3.10+ yang digunakan pada runner CI Anda. |
| `.github/workflows/validate.yml` | `actions/setup-node` (`node-version`) | `"22"` (`<<PIN_VERSION>>`) | Sesuaikan dengan versi Node.js 22+ yang dibutuhkan oleh `tests/harness.js`. |
| `src/stacks/html-tailwind.md` | `devDependencies.tailwindcss` pada contoh `package.json` | `"<<PIN_VERSION>>"` | Ganti dengan versi stabil `tailwindcss` saat menjalankan `npm init` pada proyek target. |
| `src/stacks/nextjs-shadcn.md` | Paket `next`, `react`, `react-dom`, `tailwindcss` | `"<<PIN_VERSION>>"` | Pakukan versi mayor/minor yang dihasilkan oleh `create-next-app` pada proyek target. |
| `src/stacks/astro.md` | Paket `astro`, `@astrojs/tailwind` | `"<<PIN_VERSION>>"` | Pakukan versi mayor/minor yang dihasilkan oleh `npm create astro` pada proyek target. |

---

## 2. Daftar Asumsi Teknis & Perilaku Platform untuk Diverifikasi

| ID | Asumsi / Klaim Teknis | Dampak Arsitektural | Cara Verifikasi di Lingkungan Target |
| :--- | :--- | :--- | :--- |
| `A-01` | **Permintaan `POST` dengan `Content-Type: text/plain;charset=utf-8` dan `redirect: "follow"` ke endpoint `/exec` tidak memicu CORS preflight (`OPTIONS`).** | Mencegah penolakan preflight oleh Google Apps Script Web App. | **Wajib diuji ulang pada Mobile Chrome (Android), Mobile Safari (iOS), dan Desktop Chrome/Firefox** dengan mengirim mutasi `items.create` dari domain frontend eksternal. |
| `A-02` | **Uncaught exception di dalam `doPost(e)` / `doGet(e)` mengembalikan halaman HTML error Google tanpa header CORS.** | Menyebabkan browser melaporkan error jaringan/CORS palsu jika tidak ditangkap. | Pastikan blok `try / catch` paling luar di `router.gs` tidak pernah dihapus dan selalu mengembalikan `ContentService.createTextOutput(JSON.stringify(envelope)).setMimeType(ContentService.MimeType.JSON)`. |
| `A-03` | **Apps Script Web App tidak mengekspos HTTP Request Headers maupun alamat IP client secara andal pada objek event `e`.** | Token sesi dan kunci idempotensi tidak dapat dikirim melalui header `Authorization` atau `X-Idempotency-Key`. | Seluruh pengiriman `auth` dan `idem` wajib tetap berada di dalam body JSON (`POST`) atau query string (`GET`), dan *throttling* dihitung per pengidentifikasi akun + batas global di `CacheService`. |
| `A-04` | **`multipart/form-data` tidak dapat di-parse secara andal di dalam `doPost(e)`, batas blob `DriveApp` sekitar 50 MB, dan tidak ada batas resmi khusus yang terdokumentasi untuk ukuran body `doPost(e)`.** | Mengharuskan kompresi foto di sisi browser (~1 MB) dan pengiriman sebagai string Base64 dengan batas decode server `5 MB`. | Uji `file.upload` dengan file JPEG, PNG, dan WebP hasil kompresi `<canvas>`, serta pastikan file > 5 MB ditolak dengan kode `VALIDATION_ERROR`. |
| `A-05` | **Verifikasi Google ID Token menggunakan `UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=...")`.** | Digunakan pada aksi opsional `auth.google` karena runtime V8 tidak menyediakan library verifikasi RSA/JWK bawaan. | Uji login Google dengan token GIS asli, verifikasi pencocokan `aud === GOOGLE_CLIENT_ID`, `email_verified === true`, `exp`, dan pencocokan email pada sheet `ALLOWLIST`. |
| `A-06` | **Rantai URL gambar Drive melalui `driveImageUrl(fileId, width)`: utama `drive.google.com/thumbnail?id=<id>&sz=w<width>`, fallback `lh3.googleusercontent.com/d/<id>=w<width>`.** | Menggantikan format lama `uc?export=view` yang sering mengembalikan `HTTP 403`. | Uji pemuatan gambar berklasifikasi `public` pada jendela penyamaran (*Incognito*) di berbagai browser dan pastikan handler `onerror` beralih ke URL fallback bila URL utama gagal. |
| `A-07` | **`CacheService.getScriptCache()` membatasi ukuran nilai maksimal 100 KB per kunci dan TTL maksimal 21.600 detik (6 jam).** | Menyimpan string > 100 KB pada satu kunci akan melempar eksepsi runtime. | Uji fungsi `cachePutChunked_()` dan `cacheGetChunked_()` di `auth.gs` dengan payload JSON berukuran > 120 KB. |
| `A-08` | **Cookie `HttpOnly` lintas domain tidak dapat dipasang dari `script.google.com` ke domain frontend eksternal.** | Mengharuskan penyimpanan session token di memori JavaScript (default) atau `sessionStorage` (opsional). | Pastikan tidak ada kode yang menyimpan token sesi admin di `window.localStorage` dan pastikan sesi dibersihkan saat menerima kode `FORBIDDEN` atau saat `auth.logout`. |

---

## 3. Dokumentasi Pemeriksaan CI Anti-Slop Opsional

Terinspirasi dari pendekatan audit deterministik pada referensi `impeccable` dan `vercel-labs/agent-skills`, pemilik proyek yang menggunakan skill ini untuk menghasilkan repositori aplikasi frontend dapat mengaktifkan langkah pemeriksaan statis opsional di CI guna menolak pola UI generik/terlarang:
- Menolak penggunaan `window.confirm(` atau `window.alert(`.
- Menolak meta viewport yang memuat `user-scalable=no` atau `maximum-scale=1.0`.
- Menolak klaim fabrikasi yang di-*hardcode* (seperti `"10,000+ UMKM"` atau `"Tanpa Biaya Server Tambahan"`).
- Menolak URL gambar Drive yang di-*hardcode* (`drive.google.com/uc?export=view`) di luar helper `driveImageUrl()`.

Contoh perintah pemeriksaan tersebut telah didokumentasikan sebagai komentar opsional di dalam `.github/workflows/validate.yml`.

---

## 4. Perintah Verifikasi Lengkap untuk Dijalankan Pemilik (`NOT RUN`)

Jalankan keempat perintah berikut secara berurutan dari direktori akar repositori (`gasly-skills/`):

```bash
# 1. Bangun seluruh paket skill (modular, flat, flat-lite) dan hasilkan dist/manifest.json
python build_skills.py

# 2. Jalankan pemeriksa rasio kontras WCAG AA (>= 4.5:1) pada seluruh preset token JSON
python tools/check_contrast.py

# 3. Jalankan seluruh unit test Python
python -m unittest discover -s tests -v

# 4. Jalankan Node execution harness
node tests/harness.js
```

---

## 5. Checklist Pengujian Manual pada Runtime Google Apps Script (`NOT RUN`)

1. [ ] Buat Spreadsheet kosong baru, buka **Extensions > Apps Script**, dan salin kode dari `src/gas/` (`setup.gs`, `router.gs`, `auth.gs`, `sheets.gs`, `drive.gs`, `webhook.gs`).
2. [ ] Jalankan `initialSetupDatabase()` dari toolbar editor Apps Script dan berikan izin akses (*Review Permissions*).
3. [ ] Jalankan `runDiagnostics()` dari toolbar editor dan pastikan log menampilkan `ok: true`.
4. [ ] Setel passphrase admin minimal 12 karakter menggunakan `configureAdminPassphrase_()` satu kali, lalu hapus teks passphrase dari kode.
5. [ ] Deploy sebagai **Web app** (**Execute as: Me**, **Who has access: Anyone**) dan salin URL `.../exec`.
6. [ ] Hubungkan salah satu adapter frontend (`html-tailwind`, `nextjs`+`shadcn`, atau `astro`) ke URL `/exec` tersebut, lalu uji alur:
   - Baca daftar awal (`items.list`).
   - Login admin (`auth.login`) dengan passphrase salah 5x (pastikan terkunci 15 menit) dan dengan passphrase benar.
   - Tambah transaksi baru (`items.create`) dengan retry idempoten (`idem`).
   - Unggah foto bukti (`file.ticket` $\rightarrow$ kompresi client ~1 MB $\rightarrow$ `file.upload`) dan pastikan foto tampil melalui `driveImageUrl(fileId, width)` serta gagal jika *magic bytes* dipalsukan.
   - Perbarui kode di editor GAS, lalu gunakan **Deploy > Manage deployments > Edit > Version: New version > Deploy** dan pastikan URL `/exec` tidak berubah.