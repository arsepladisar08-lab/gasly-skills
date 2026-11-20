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
| `A-09` | **`UrlFetchApp.fetch(url, params)` tidak menyediakan parameter `timeout` kustom; diasumsikan batas waktu tunggu per permintaan HTTP dikendalikan oleh runtime Google (~60 detik) di dalam batas total eksekusi 6 menit (`facts.md`).** | Mengharuskan penggunaan `muteHttpExceptions: true`, retry + exponential backoff, *circuit breaker* di `CacheService` (`cb:open:<service>`), dan antrean `JOBS_OUTBOX`. | Uji `fetchExternalWithBreaker_()` terhadap endpoint lambat/`5xx` di runtime GAS dan pastikan *circuit breaker* terbuka setelah 3 kegagalan berturut-turut tanpa menguras batas 30 eksekusi simultan. |
| `A-10` | **`MailApp.getRemainingDailyQuota()` melaporkan sisa kuota harian (100/hari konsumen, 1.500/hari Workspace) dan `DriveApp.getFileById(id).setTrashed(true)` memindahkan file ke Trash pada `file.replace` / `file.delete`.** | Mencegah kegagalan transaksi saat kuota email habis dan mencegah kebocoran penyimpanan Drive dari file yatim. | Uji `mail.send` (`handleMailSend_`), penggantian file (`file.replace`), dan penghapusan file (`file.delete`) langsung pada deployment GAS. |
| `A-11` | **`TODO-VERIFY` — Struktur payload request/response pada `handlePaymentCreateCheckout_()` (`PAYMENT_GATEWAY_URL` & `PAYMENT_GATEWAY_SECRET`).** | Setiap penyedia (Midtrans Snap, Xendit Invoice, Duitku) memiliki nama field URL pembayaran dan header otorisasi yang spesifik. | Sesuaikan dan verifikasi pemetaan field `payment_url` / `invoice_url` / `redirect_url` pada sandbox penyedia pembayaran yang dipilih sebelum produksi. |
| `A-12` | **`UNVERIFIED` — Label menu antarmuka pihak ketiga (Google Apps Script Project Settings/Deploy, Google Cloud Console OAuth Consent Screen & Credentials, Cloudflare Pages, Vercel, dan GitHub Pages) dapat berubah sewaktu-waktu oleh penyedia layanan.** | Panduan instalasi (`gasly-deploy-guide`) menandai langkah UI pihak ketiga yang belum diverifikasi langsung sebagai `UNVERIFIED` (`Gate I-05`). | Verifikasi jalur klik menu secara manual pada konsol masing-masing penyedia saat menjalankan checklist deployment. |


---


---

## 3. Targeted Scanner v1 untuk Proyek Hasil GASLY

Scanner opsional untuk memeriksa proyek aplikasi hasil GASLY dari direktori repo skill ini. Jalankan dengan menunjuk ke root proyek aplikasi:

```bash
python tools/check_gasly_quality.py ../path/to/generated-app
```

Scanner v1 dibatasi pada lima pemeriksaan deterministik:

1. **Action registry mismatch:** membandingkan action literal pada pemanggilan helper frontend yang dikenali (`callApi`, `callGasAction`, `gasRequest`, `gasPost`, `gasClient.request`, `GASLY_API.request`) dengan key pada `getActionRegistry_()` atau `ACTION_REGISTRY_` di backend.
2. **Browser blocking dialog:** mendeteksi pemanggilan `window.alert()`, `window.confirm()`, dan `window.prompt()` pada source frontend.
3. **Secret literal berkeyakinan tinggi:** mendeteksi signature kredensial umum yang jelas (misalnya Google API key, private-key PEM, token GitHub/Slack, dan Stripe secret key); bukan pencarian semua kemungkinan secret.
4. **Drive public access:** menandai `DriveApp.Access.ANYONE` dan `ANYONE_WITH_LINK` sebagai `REVIEW`. Temuan ini wajib diperiksa terhadap klasifikasi data; bukan bukti otomatis bahwa akses tersebut salah.
5. **Weak randomness pada fungsi keamanan:** mendeteksi `Math.random()` hanya di fungsi backend `.gs` yang namanya secara eksplisit menunjukkan pembuatan token, session, secret, nonce, credential, atau API key.

Scanner membaca source code (`.gs`, `.js`, `.jsx`, `.ts`, `.tsx`, `.html`) dan melewati direktori dependency/build umum. Cross-check action hanya mencakup pemanggilan literal dan pola registry yang dikenali; action dinamis, registry buatan khusus, atau wrapper yang tidak didukung harus diperiksa manual. Exit code: `0` tidak ada temuan yang dikenali, `1` ada temuan, `2` argumen/path tidak valid.

**Batas penting:** hasil bersih bukan sertifikasi keamanan dan tidak membuktikan tidak ada secret, endpoint, atau kelemahan lain. Scanner tidak memakai parser AST dan sengaja tidak mencoba menafsirkan seluruh semantik aplikasi. `DriveApp.Access.ANYONE` selalu memerlukan konfirmasi manusia atas klasifikasi dan tujuan file.

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
4. [ ] Buka **Project Settings > Script Properties**, tambahkan properti sementara `ADMIN_PASSPHRASE_INIT` (minimal 12 karakter) dan `ADMIN_PIN_INIT` (6 digit angka), lalu jalankan fungsi publik `setupAdminCredentials()` dari toolbar editor Apps Script. Pastikan kedua properti sementara `ADMIN_PASSPHRASE_INIT` dan `ADMIN_PIN_INIT` otomatis terhapus dan `ADMIN_PASSPHRASE_HASH` serta `ADMIN_PIN_HASH` tersimpan tanpa pernah menulis plaintext di kode.
5. [ ] Deploy sebagai **Web app** (**Execute as: Me**, **Who has access: Anyone**) dan salin URL `.../exec`.
6. [ ] Hubungkan salah satu adapter frontend (`html-tailwind`, `nextjs`+`shadcn`, atau `astro`) ke URL `/exec` tersebut, lalu uji alur:
   - Baca daftar awal (`items.list`).
   - Login admin (`auth.login`) dengan passphrase salah 5x (pastikan terkunci 15 menit) dan dengan passphrase benar.
   - Tambah transaksi baru (`items.create`) dengan retry idempoten (`idem`).
   - Unggah foto bukti (`file.ticket` $\rightarrow$ kompresi client ~1 MB $\rightarrow$ `file.upload`) dan pastikan foto tampil melalui `driveImageUrl(fileId, width)` serta gagal jika *magic bytes* dipalsukan.
   - [ ] `NOT RUN` — **`auth.setCredentials`:** Panggil dengan sesi aktif + `currentPassphrase` valid + `newPin: "123456"` $\rightarrow$ Hasil: `status: "success"`, hash tersimpan di `USERS`, dan panggilan ulang untuk mengganti PIN tanpa `stepUpToken` ditolak `FORBIDDEN`.
   - [ ] `NOT RUN` — **`auth.verifyPin`:** Panggil dengan `{ pin: "123456", targetAction: "items.delete" }` $\rightarrow$ Hasil: mengembalikan `stepUpToken` (TTL 300 detik); 3 kali PIN salah berturut-turut mencabut sesi (`revoked:<jti>`).
   - [ ] `NOT RUN` — **`file.replace`:** Panggil dengan sesi `STAFF`/`ADMIN` pada record yang sudah punya `file_id` $\rightarrow$ Hasil: `file_id` di Sheet berganti ke file baru dan file lama di Google Drive berpindah ke Trash.
   - [ ] `NOT RUN` — **`file.delete`:** Panggil tanpa `stepUpToken` (`FORBIDDEN`), lalu panggil dengan `stepUpToken` hasil `auth.verifyPin` (`targetAction: "file.delete"`) $\rightarrow$ Hasil: `file_id`/`file_url` di Sheet dikosongkan dan file Drive masuk Trash.
   - [ ] `NOT RUN` — **`mail.send`:** Panggil dengan `{ to, subject, htmlBody }` saat `MailApp.getRemainingDailyQuota() > 5` $\rightarrow$ Hasil: email terkirim (`OK`), dan ditolak `RATE_LIMITED` bila sisa kuota $\le 5$.
   - [ ] `NOT RUN` — **`notify.whatsapp`:** Panggil tanpa `FONNTE_TOKEN` (mengembalikan `WA_ME_FALLBACK` URL `wa.me`), lalu dengan `FONNTE_TOKEN` aktif $\rightarrow$ Hasil: pesan terkirim via API Fonnte (`FONNTE_API`).
   - [ ] `NOT RUN` — **`ai.generate`:** Panggil dengan `GEMINI_API_KEY` aktif di `ScriptProperties` $\rightarrow$ Hasil: mengembalikan JSON terstruktur tanpa membocorkan API key, dan menolak dengan `RATE_LIMITED` saat kuota harian user habis.
   - [ ] `NOT RUN` — **Dedup `webhook.receive`:** Kirim dua POST webhook dengan `providerEventId` sama dan `idem` berbeda $\rightarrow$ Hasil: baris Sheet hanya ditulis satu kali dan pengiriman kedua mengembalikan `meta.idempotentReplay: true`.
   - [ ] `NOT RUN` — **`P2-lite` (`auth.google`):** Aktifkan `P2_LITE_AUTO_PROVISION = "TRUE"` dan login dengan Google ID Token yang belum ada di `USERS` $\rightarrow$ Hasil: baris baru ber-role `STAFF` otomatis dibuat di `USERS` (maks. 10 pendaftaran / 10 menit).
   - [ ] `NOT RUN` — **`plans.list` & `payment.createCheckout`:** Panggil `plans.list` lalu panggil `payment.createCheckout` dengan `{ planCode: "PRO", price_amount: 1 }` $\rightarrow$ Hasil: harga palsu `1` dari klien diabaikan, server menggunakan `price_amount: 490000` dari sheet `PLANS`, dan membuat baris `PENDING` di `SUBSCRIPTIONS`.
   - [ ] `NOT RUN` — **Aktivasi `SUBSCRIPTIONS` via `webhook.receive` & `subscription.get`:** Kirim webhook dengan `entityId: "<externalInvoiceId>"` dan `newStatus: "ACTIVE"` $\rightarrow$ Hasil: baris `SUBSCRIPTIONS` berubah menjadi `ACTIVE` dengan `period_start`/`period_end` terisi, `subscription.get` mengembalikan langganan aktif, dan `assertEntitlement_` meloloskan kuota di bawah `max_quota`.
   - Perbarui kode di editor GAS, lalu gunakan **Deploy > Manage deployments > Edit > Version: New version > Deploy** dan pastikan URL `/exec` tidak berubah.