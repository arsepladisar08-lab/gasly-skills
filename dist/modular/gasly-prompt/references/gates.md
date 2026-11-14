<!-- KB_VERSION: 2.1.0 -->
# GASLY HARD GATES CLASSIFICATION (`core/gates.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh seluruh skill (`gasly-prompt`, `gasly-data`, `gasly-ui`, dan legacy `gasly-pro`).

## Daftar Isi
1. [Hierarki Otoritas & Aturan Penegakan](#1-hierarki-otoritas--aturan-penegakan)
2. [Kelas 1: `UNIVERSAL` Gates (Berlaku di Semua Skill & Stack)](#2-kelas-1-universal-gates-berlaku-di-semua-skill--stack)
3. [Kelas 2: `GAS-ONLY` Gates (Khusus Backend Apps Script)](#3-kelas-2-gas-only-gates-khusus-backend-apps-script)
4. [Kelas 3: `WEB-ONLY` Gates (Khusus Frontend Web)](#4-kelas-3-web-only-gates-khusus-frontend-web)
5. [Kelas 4: `LEGACY-HTMLSERVICE` Gates (Khusus Mode Legacy `gasly-pro`)](#5-kelas-4-legacy-htmlservice-gates-khusus-mode-legacy-gasly-pro)

---

## 1. Hierarki Otoritas & Aturan Penegakan

Seluruh aturan di dokumen ini merupakan **Hard Gates** yang berada di atas instruksi pengguna biasa. Tidak ada satu pun gerbang dari versi sebelumnya yang dihapus; setiap gerbang diklasifikasikan ke dalam 4 kelas sesuai ruang lingkup arsitekturnya:
- **`UNIVERSAL`**: Wajib dipatuhi oleh `gasly-prompt`, `gasly-data`, `gasly-ui` (termasuk ke-15 stack pewaris), dan `gasly-pro`.
- **`GAS-ONLY`**: Wajib dipatuhi oleh `gasly-data` dan bagian backend `gasly-pro`.
- **`WEB-ONLY`**: Wajib dipatuhi oleh `gasly-ui` (pada seluruh stack web) dan bagian frontend `gasly-pro`.
- **`LEGACY-HTMLSERVICE`**: Wajib dipatuhi oleh `gasly-pro` saat membangun aplikasi monolitik berbasis `HtmlService` + `google.script.run`.

---

## 2. Kelas 1: `UNIVERSAL` Gates (Berlaku di Semua Skill & Stack)

1. **Zero Client Secrets (`U-01`):**
   - Hanya URL Web App publik (`.../exec`) dan Client ID publik (bila memakai Google Sign-In) yang boleh berada di kode frontend. Semua secret, salt, hash passphrase, PIN, dan API key pihak ketiga wajib disimpan di `PropertiesService.getScriptProperties()`.
2. **Server-Side Authorization Only (`U-02`):**
   - Setiap pemeriksaan hak akses dan peran wajib dieksekusi di dalam Google Apps Script sebelum menyentuh Google Sheets atau Google Drive. Penyembunyian tombol di UI hanyalah bantuan navigasi, bukan pengaman.
3. **Anti-Fabrikasi Klaim Bisnis (`U-03`):**
   - Dilarang mengarang jumlah pengguna/pelanggan, logo klien, testimoni palsu, badge *verified*, persentase peningkatan ROI/efisiensi, jaminan mutlak bebas biaya server, kebijakan *refund/free trial*, maupun angka harga paket yang tidak diberikan oleh pengguna. Gunakan data asli dari pengguna, slot `{{...}}`, atau *Role-Based Use Cases* dan kapabilitas nyata dari kode.
4. **Canonical Response Envelope & Sanitized Errors (`U-04`):**
   - Seluruh komunikasi server-ke-client wajib memakai `{ status, data, message, code, meta }` dengan kode `OK`, `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `LOCK_TIMEOUT`, `INTERNAL_ERROR`. Dilarang membocorkan `err.stack` atau `err.toString()` mentah ke client.
5. **Kontras Warna WCAG AA (`U-05`):**
   - Setiap pasangan warna teks dan permukaan (*base*, *card*, *interactive hover*, dan *solid button*) pada semua preset wajib memenuhi rasio kontras minimum **4,5:1** untuk teks normal dan **3:1** untuk teks besar/komponen UI. Token *muted* yang di bawah 4,5:1 hanya boleh digunakan pada elemen `disabled` atau garis dekoratif.
6. **Ukuran Target Sentuh Minimum (`U-06`):**
   - Seluruh elemen interaktif (tombol, input, tab, pemicu aksi baris) pada viewport mobile/layar sentuh wajib memiliki area sentuh minimum `40px × 40px` (ideal `44px × 44px`).
7. **Angka Mentah & Waktu ISO Ber-Offset (`U-07`):**
   - Data numerik dikirim sebagai `Number` murni dan waktu dikirim sebagai string ISO-8601 ber-offset (`"yyyy-MM-dd'T'HH:mm:ssXXX"`). Pemformatan mata uang di client dilarang menyembunyikan data rusak/`null`/`NaN` sebagai `"Rp 0"` (tampilkan `"-"` atau `"Data tidak valid"`).
8. **Kelengkapan UI State Machine & Double-Submit Lock (`U-08`):**
   - Setiap tampilan dan form wajib menangani state `INITIAL`, `LOADING`, `EMPTY`, `ERROR` (dengan tombol Retry), `SAVING` (mengunci tombol submit agar tidak terjadi *double-submit*), dan `RECOVERY` (mempertahankan ketikan pengguna di form saat simpan gagal).
9. **Batas Aman Optimistic UI (`U-09`):**
   - *Optimistic UI* hanya diizinkan untuk toggle ringan non-kritikal yang memiliki logika *rollback* otomatis. Pembuatan data ber-ID baru, mutasi keuangan/stok, unggahan Drive, dan penghapusan wajib menunggu respon `status === 'success'` dari server.

---

## 3. Kelas 2: `GAS-ONLY` Gates (Khusus Backend Apps Script)

1. **Aturan Runtime V8 Murni (`G-01`):**
   - Kode Apps Script dilarang menggunakan `import`/`export` ES module, paket npm, API Node.js/browser (`fetch`, `crypto`, `Buffer`, `window`), melainkan hanya layanan resmi GAS (`SpreadsheetApp`, `DriveApp`, `LockService`, `CacheService`, `PropertiesService`, `Utilities`, `ContentService`, `UrlFetchApp`).
2. **Sinkronisasi Zona Waktu & Sanitasi `Date` Rekursif (`G-02`):**
   - `setup.gs` wajib menyamakan zona waktu Spreadsheet dengan zona waktu Script (`ss.setSpreadsheetTimeZone(tz)`). Seluruh nilai kembalian dari Sheet wajib melewati `sanitizeForClient_()` untuk mengubah instance `Date` menjadi `"yyyy-MM-dd'T'HH:mm:ssXXX"`.
3. **LockService, Pengecekan `updated_at` & Flush Sebelum Release (`G-03`):**
   - Semua mutasi Sheet wajib memperoleh `LockService.getScriptLock().tryLock(10000)` (`LOCK_TIMEOUT`), memverifikasi kecocokan `updated_at` pada operasi edit/hapus (`CONFLICT`), dan memanggil `SpreadsheetApp.flush()` di dalam blok `try` tepat sebelum `lock.releaseLock()` di blok `finally`.
4. **Penomoran ID Harian via `maxSeq + 1` (`G-04`):**
   - ID harian (`[PREFIX]-YYYYMMDD-0001`) wajib dihitung di dalam lock dengan mencari nilai integer maksimum dari 4 digit terakhir pada tanggal `YYYYMMDD` berjalan (`maxSeq + 1`), tidak pernah menggunakan `jumlah_baris + 1` atau indeks loop lintas tanggal.
5. **Batch I/O, Pemetaan Header `snake_case` & Larangan Self-Heal Baca (`G-05`):**
   - Baca dan tulis data secara batch (`getValues()` / `setValues()`). Petakan kolom berdasarkan nama header yang dinormalisasi ke `snake_case`, bukan indeks kolom hardcoded. Fungsi baca dilarang memanggil `initialSetupDatabase()` secara otomatis (kembalikan `NOT_FOUND`).
6. **Soft-Delete Default, `SCHEMA_VERSION`, Seed Deterministik & Guard Admin (`G-06`):**
   - Penghapusan data menggunakan *soft-delete* (`status = 'ARCHIVED'`). Gunakan `SCHEMA_VERSION` untuk migrasi kolom non-destruktif, tandai data awal dengan prefix `SEED-` dan `is_seed = 'TRUE'`, serta lindungi aksi `purgeSeed` dan `diagnostics` dengan otorisasi `ADMIN`.
7. **Pencegahan Formula Injection Khusus Teks Bebas (`G-07`):**
   - Terapkan `escapeFormula_()` (menambahkan apostrof `'` jika string diawali `=`, `+`, `-`, `@`) **hanya** pada kolom teks bebas menurut skema. Jangan terapkan pada kolom numerik agar angka negatif tetap tersimpan sebagai `Number`.
8. **Akhiran Underscore (`_`) pada Fungsi Internal (`G-08`):**
   - Seluruh fungsi helper dan repositori internal wajib diakhiri karakter `_`. Hanya entrypoint resmi (`doPost`, `doGet`, `initialSetupDatabase`, `runDiagnostics`) yang ditulis tanpa akhiran `_`.
9. **Keamanan Unggahan Drive & Penulisan Sheet Atomik (`G-09`):**
   - Aksi `file.upload` wajib memvalidasi profil akses / tiket sekali pakai (`file.ticket`), membatasi ukuran byte hasil decode (default `<= 5 MB`), memeriksa daftar putih MIME (`image/jpeg`, `image/png`, `image/webp`) **sekaligus** *magic bytes* header biner, menyanitasi nama file, menyimpan ke `ROOT/<entity>/<yyyy-mm>`, mengatur izin berbagi sesuai klasifikasi (`public` vs `private`), dan menulis `file_id` serta `file_url` ke baris Sheet di dalam satu operasi ber-lock (serta menghapus file Drive bila update Sheet gagal).

---

## 4. Kelas 3: `WEB-ONLY` Gates (Khusus Frontend Web)

1. **Dialog Konfirmasi Kustom (`W-01`):**
   - Aksi destruktif (hapus/arsip/purge) wajib melewati komponen modal konfirmasi kustom yang aksesibel, dilarang memakai `window.confirm()` bawaan browser.
2. **Label Form Eksplisit (`W-02`):**
   - Setiap kontrol form (`input`, `select`, `textarea`) wajib memiliki elemen `<label for="...">` yang terlihat jelas, bukan hanya mengandalkan atribut `placeholder`.
3. **Navigasi Keyboard, `:focus-visible` & Semantik HTML (`W-03`):**
   - Semua elemen interaktif wajib memiliki indikator `:focus-visible` yang kontras, tombol ikon wajib memiliki `aria-label`, dan modal wajib mendukung penutupan dengan tombol `Escape` serta pengembalian fokus.
4. **Dukungan `prefers-reduced-motion` & Batas Blur GPU (`W-04`):**
   - Sertakan aturan `@media (prefers-reduced-motion: reduce)` untuk mematikan animasi pergeseran/pulsasi, dan batasi penggunaan `backdrop-filter: blur()` hanya pada navigasi atas atau header modal.
5. **Kepatuhan Zoom Viewport (`W-05`):**
   - Meta viewport wajib menggunakan `width=device-width, initial-scale=1.0` tanpa `user-scalable=no` dan tanpa `maximum-scale=1.0`.
6. **Angka Tabular (`W-06`):**
   - Seluruh metrik KPI, harga, persentase, dan kolom angka tabel wajib menerapkan `font-variant-numeric: tabular-nums` (`.tabular-nums`).
7. **Pencegahan XSS (`W-07`):**
   - Saat merakit string HTML dinamis pada DOM vanilla (`html-tailwind`), seluruh data wajib dilewatkan ke fungsi `escapeHtml()`.
8. **Helper Tunggal Gambar Drive (`W-08`):**
   - Seluruh penampilan foto Drive di frontend wajib menggunakan helper `driveImageUrl(fileId, width)` dengan rantai fallback thumbnail `drive.google.com/thumbnail` ke `lh3.googleusercontent.com/d/`, dilengkapi atribut `referrerpolicy="no-referrer" loading="lazy"`.

---

## 5. Kelas 4: `LEGACY-HTMLSERVICE` Gates (Khusus Mode Legacy `gasly-pro`)

Gerbang berikut tetap berlaku penuh ketika agen menjalankan skill legacy `gasly-pro`:
1. **Verifikasi `DEPLOY_MODE` (`L-01`):** Membedakan `'EXECUTE_AS_ME'` vs `'USER_ACCESSING'` dan melarang perbandingan `getActiveUser() == getEffectiveUser()` pada mode `'USER_ACCESSING'`.
2. **Larangan Default `ALLOWALL` (`L-02`):** Tidak memanggil `.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)` kecuali *iframe embedding* diminta secara eksplisit.
3. **Arsitektur 3-File vs 6-File `HtmlService` (`L-03`):** Menggunakan `createHtmlOutputFromFile('index')` untuk 3-file default dan `createTemplateFromFile('index').evaluate()` + `include()` untuk 6-file.
4. **In-Browser `google.script.run` Sandbox Preview Guard (`L-04`):** Menyediakan `IS_GAS_ENV`, `handleMockAction_()` berparitas 100% dengan fungsi publik `code.gs`, penyimpanan memori default, serta badge **Preview Mode** kiri-bawah dengan tombol `"Reset data preview"`.