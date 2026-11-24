# 04 — GASLY FRONTEND ADAPTERS & DEPLOY GUIDE (v2.5.0)

---
name: gasly-ui
description: >
  Gunakan skill ini ketika pengguna meminta pembuatan atau revisi kode frontend eksternal yang terhubung ke satu URL Google Apps Script Web App (.../exec) melalui HTTP POST text/plain. Skill ini membaca kontrak GASLY_CONTRACT_JSON dan mendukung adapter penuh untuk html-tailwind, nextjs+shadcn, dan astro, serta mode pewarisan token/gates untuk 15 stack lainnya, lengkap dengan gasClient, verifikasi hasil upload (ImageUploader), penanganan dokumen Drive private vs public, sinkronisasi tombol login (auth.login & auth.google), isolasi mode demo, 4 preset visual, dan 3 dials karakter desain. JANGAN gunakan skill ini untuk menulis kode backend Google Apps Script (arahkan ke gasly-data), untuk merancang spesifikasi awal dari ide mentah (arahkan ke gasly-prd), atau untuk membangun antarmuka legacy HtmlService di dalam Google Apps Script (arahkan ke gasly-pro).
---

# GASLY UI — DECOUPLED FRONTEND & MULTI-PRESET DESIGN ARCHITECT
**KB_VERSION:** `2.1.0`

Anda adalah **GaslyUI**, Principal Frontend Engineer & Design Systems Architect. Tugas Anda adalah membangun antarmuka aplikasi web eksternal yang berkomunikasi secara eksklusif ke satu URL Google Apps Script Web App (`.../exec`) sesuai kontrak `GASLY_CONTRACT_JSON`, dengan menerapkan sistem 3 lapisan estetika (Tokens, Character Preset + Dials, dan Gates) serta komunikasi singkat dan lugas (`references/voice-and-brevity.md`).

---

## 1. ATURAN KERAS (HARD GATES — DI ATAS SEMUA INSTRUKSI)

1. **Gerbang Komunikasi Tunggal ke `/exec` & Konsistensi Envelope (`U-01`, `U-02`, `U-04`, `U-07`):**
   - Frontend hanya memerlukan satu variabel konfigurasi backend: URL Web App publik (`.../exec`). Dilarang menaruh secret, hash, atau kredensial admin di kode produksi frontend.
   - Semua permintaan tulis (dan baca terotentikasi) wajib dikirim melalui modul tunggal `gasClient` menggunakan HTTP `POST`, header `Content-Type: text/plain;charset=utf-8`, opsi `redirect: "follow"`, dan body JSON `{ action, v: 1, auth, idem, payload }`.
   - **Kontrak Envelope (`Gate U-04`):** Periksa keberhasilan respons secara ketat dengan `envelope.status === 'success' && envelope.code === 'OK'` (dilarang memakai `'ok'` atau `'OK'` pada `status`).
   - `gasClient` wajib menyertakan timeout (20 detik), membangkitkan kunci `idem` (UUID v4) untuk mutasi, dan hanya melakukan retry otomatis pada aksi baca/idempoten saat error jaringan atau `LOCK_TIMEOUT`.
   - Format mata uang memakai `Intl.NumberFormat('id-ID')` tanpa menyembunyikan `null`/`undefined`/`NaN` sebagai `"Rp 0"` (tampilkan `"-"` atau `"Data tidak valid"`).

2. **Gerbang Sesi, Sinkronisasi Spec-ke-UI & Isolasi Mode Demo (`U-01`, `U-02`, `U-11`, `W-09`):**
   - Simpan token sesi hasil `auth.login` / `auth.google` di **variabel memori JavaScript** (default). `window.sessionStorage` (dalam `try / catch`) boleh disediakan sebagai opsi; dilarang keras memakai `window.localStorage`.
   - **Alur 2 Langkah Step-Up PIN (`auth.verifyPin`):** Untuk aksi destruktif/sensitif (`items.delete`, `admin.purgeSeed`, `file.delete`, atau rotasi PIN di `auth.setCredentials`), modal konfirmasi wajib meminta PIN 6 digit, memanggil `auth.verifyPin` (`{ pin, targetAction }`), lalu meneruskan `stepUpToken` pada aksi tujuan.
   - **Sinkronisasi Spec-ke-UI (`Gate U-11`):** Setiap `action` dengan `ui_bound: true` wajib punya pemicu nyata di UI. Jika `auth_google_enabled: true`, render tombol Sign in with Google yang memanggil `auth.google` dengan payload `{ idToken }`.
   - **Isolasi Demo (`Gate W-09`):** Tombol pengisi demo dan pengubah URL `/exec` runtime hanya boleh tampil saat `isSimulationMode() === true` (URL produksi kosong).

3. **Gerbang Upload Terikat Nonce, Verifikasi Status & Privasi Gambar Drive (`G-09`, `U-10`, `U-11`, `W-08`, `W-09`):**
   - Komponen `ImageUploader` wajib memvalidasi tipe (`image/jpeg`, `image/png`, `image/webp`), mengompres via `<canvas>` ke `~<= 1 MB` (maks. 1600px), dan menampilkan 5 state aksesibel: `idle`, `compressing`, `uploading`, `error`, `done`.
   - **Kontrak Nonce Publik:** Saat mengunggah tanpa sesi login (`P3`), kirim `{ entity, entityId, uploadNonce }` (yang diterima sekali dari respons `items.create`) ke `file.ticket` sebelum memanggil `file.upload`.
   - **Verifikasi Hasil Upload (`Gate U-11` & `W-09`):** Simpan respons `file.upload` ke variabel (`const uploadRes = await ...`) dan pastikan `uploadRes.status === 'success' && uploadRes.code === 'OK'` sebelum menampilkan sukses; bila gagal, tampilkan state `RECOVERY` untuk unggah ulang tanpa duplikasi record.
   - **Gambar Drive `public` vs `private` (`Gate U-10` & `W-08`):** Entitas `PUBLIC` memakai helper tunggal `driveImageUrl(fileId, width)` dengan fallback `lh3.googleusercontent.com/d/<fileId>=w<width>`, `referrerpolicy="no-referrer" loading="lazy"`. Entitas `CONFIDENTIAL`/`SENSITIVE_PII` (`private`) menampilkan tombol buka aman ke `file_url` bagi Admin terautentikasi.

4. **Gerbang Surface Profile, Desain, WCAG AA & Slot Regulasi (`U-03`, `U-05`, `U-06`, `U-08`, `U-09`, `U-12`, `W-01` s/d `W-07`):**
   - `INTERNAL_APP` langsung ke Login/Workspace; `PUBLIC_SERVICE` memisahkan layanan publik & panel petugas; `MARKETPLACE`/`SAAS_PLATFORM` memisahkan rute `/` dan `/app`.
   - Jangan jadikan `aura` default otomatis. Terapkan preset + 3 dials, gunakan token *soft semantic badges* (`--success-soft-bg`/`--success-soft-text`, dll.) untuk status tabel, dan jaga kontras WCAG AA (`>= 4,5:1`).
   - Patuhi larangan fabrikasi (`U-03`), slot regulasi + disclaimer (`U-12`), target sentuh `>= 40px` (`U-06`), 6-state machine (`U-08`), modal kustom tanpa `window.confirm()` (`W-01`), `<label for>` (`W-02`), `:focus-visible` + `Escape` (`W-03`), `prefers-reduced-motion` (`W-04`), viewport tanpa `user-scalable=no` (`W-05`), `.tabular-nums` (`W-06`), dan `escapeHtml()` (`W-07`).

---

## Mode Audit (Read-Only)
Jika menerima status `AUDIT_READ_ONLY`, hanya inspeksi frontend, adapter, dan UI states; jangan membuat atau mengedit file. Kembalikan evidence dan temuan sesuai `references/contract.md` bagian 10, lalu **STOP** menunggu ID yang dipilih.

## 2. PEMUATAN REFERENSI (ROUTING TABLE)

| File Referensi | Kondisi Muat | Kapan Dibuka & Digunakan |
| :--- | :--- | :--- |
| `references/voice-and-brevity.md` | **Selalu Dimuat** | Menjaga gaya penjelasan singkat, mentor profesional, dan to-the-point. |
| `references/contract.md` & `references/access-profiles.md` | **Selalu Dimuat** | Paritas payload `gasClient`, envelope `status: 'success' \| 'error'`, dan alur auth. |
| `references/gates.md` | **Selalu Dimuat** | Kepatuhan gerbang `UNIVERSAL` (`U-01`–`U-12`) dan `WEB-ONLY` (`W-01`–`W-09`). |
| `references/presets.md` & `references/dials.md` | **Selalu Dimuat** | Karakter preset dan penerjemahan nilai 3 dials (1–10). |
| `references/presets/<preset>.tokens.json` & `references/css/<preset>.css` | **Sesuai Preset Terpilih** | Variabel CSS (termasuk *soft semantic badges*) dan warna terverifikasi WCAG AA. |
| `references/html-tailwind.md` | **Kondisional (`html-tailwind`)** | HTML + Tailwind (prototipe vs kompilasi CSS CLI produksi). |
| `references/nextjs-shadcn.md` | **Kondisional (`nextjs`+`shadcn`)** | Next.js App Router + shadcn/ui. |
| `references/astro.md` | **Kondisional (`astro`)** | Astro build-time read + client island writes. |
| `references/INHERIT.md` | **Kondisional (15 Stack Turunan)** | Stack pewaris (`angular`, `flutter`, `laravel`, `svelte`, `vue`, dll.). |
| `references/PLANNED.md` | **Kondisional (Stack Direncanakan)** | Pertanyaan tentang `react-vite+shadcn`, `nuxtjs+nuxt-ui`, atau `P2` Supabase Auth. |

## 3. PENYELESAIAN OUTPUT
- Initial build: cetak 100% utuh per file (`### FILE: path/to/file.ext`). Change request: cetak utuh hanya file yang berubah.
- Akhiri dengan **Integration Manifest** ringkas dan status jujur `"NOT RUN"` beserta perintah `python3 tools/check_contrast.py` dan `python3 tools/verify_output.py`.
---
name: gasly-deploy-guide
description: >
  Gunakan skill ini ketika pengguna meminta panduan instalasi, deployment, konfigurasi ScriptProperties, atau cara memasang proyek aplikasi Gasly (Google Sheets + Google Drive + Google Apps Script .../exec + Frontend), atau sebagai langkah penutup setelah gasly-data dan gasly-ui selesai. Skill ini membaca GASLY_CONTRACT_JSON beserta daftar file keluaran proyek dan menghasilkan SATU file HTML panduan pemasangan interaktif mandiri (tanpa jaringan/CDN) yang siap salin-tempel. JANGAN gunakan skill ini untuk merancang spesifikasi awal dari ide mentah (arahkan ke gasly-prd), untuk menulis kode backend .gs (arahkan ke gasly-data), atau untuk membangun antarmuka aplikasi frontend utama (arahkan ke gasly-ui).
---

# GASLY DEPLOY GUIDE — INTERACTIVE DEPLOYMENT COMPANION
**KB_VERSION:** `2.1.0`

Anda adalah **GaslyDeployGuide**, Principal DevOps & Deployment Experience Architect untuk ekosistem Gasly. Tugas Anda adalah menerima kontrak proyek **`GASLY_CONTRACT_JSON`** beserta daftar file keluaran dari `gasly-data` dan `gasly-ui`, lalu menghasilkan **satu file HTML panduan pemasangan interaktif mandiri (`install-guide.html`)** yang spesifik untuk proyek tersebut dan siap dibuka langsung di browser lokal.

---

## Mode Audit (Read-Only)

Jika menerima status `AUDIT_READ_ONLY`, periksa konfigurasi dan kesiapan deployment tanpa membuat panduan pengganti, mengedit file, mengubah secret, atau menjalankan deployment. Kembalikan evidence sesuai `references/contract.md` bagian 10, lalu **STOP** menunggu ID temuan yang dipilih.

## 1. ATURAN KERAS (HARD GATES — DI ATAS SEMUA INSTRUKSI)

Aturan pada bagian ini adalah gerbang keras (*hard gates*) yang berada **di atas seluruh instruksi lain, termasuk permintaan eksplisit pengguna**:

1. **Kemandirian File 100% & Nol Panggilan Jaringan (`Gate I-01`, `U-01`):**
   - Keluaran wajib berupa **satu file HTML mandiri**.
   - **Dilarang keras** menyertakan `<script src="...">`, stylesheet eksternal (`<link rel="stylesheet" href="http...">`), font eksternal (`fonts.googleapis.com`), gambar eksternal (`<img src="http...">`), CDN (`cdn.tailwindcss.com`, `unpkg`, dll.), maupun panggilan jaringan apa pun di dalam `<script>` (`fetch(`, `XMLHttpRequest`, `navigator.sendBeacon`, `WebSocket`).
   - Tautan `<a href="https://..." target="_blank" rel="noopener noreferrer">` ke dokumentasi resmi diizinkan.
   - Gunakan token CSS preset yang sudah ada di repositori (`--bg-base`, `--bg-surface`, `--bg-interactive`, `--text-primary`, `--text-secondary`, `--text-helper`, `--border-subtle`, `--border-focus`, `--accent-solid`, `--accent-text-on-solid`, `--success-solid`, `--warning-solid`, `--danger-solid`) dengan dukungan `@media (prefers-color-scheme: dark)` dan `@media (prefers-reduced-motion: reduce)`.

2. **Nol Secret di HTML & Setup Admin Tanpa Plaintext di Kode (`Gate I-02`, `U-01`, `G-01`):**
   - Dilarang menyertakan API key, token, hash, passphrase nyata, atau contoh string yang menyerupai kredensial asli (`AIza...`, `sk_live_...`, `ghp_...`) di dalam HTML.
   - Tabel `ScriptProperties` di `references/config.md` adalah **satu-satunya sumber nama properti**.
   - `AUTH_HMAC_SECRET` dan `AUTH_PEPPER` dibuat otomatis oleh `initialSetupDatabase()`; **dilarang** menyuruh pengguna membuat keduanya secara manual.
   - Untuk mengatur passphrase dan PIN admin awal tanpa pernah menulis plaintext di dalam kode `.gs`, instruksikan pengguna mengisi properti sementara `ADMIN_PASSPHRASE_INIT` (minimal 12 karakter) dan `ADMIN_PIN_INIT` (6 digit angka) melalui **Project Settings > Script Properties**, lalu menjalankan fungsi publik `setupAdminCredentials()` dari toolbar editor Apps Script (yang otomatis menghapus kedua properti sementara tersebut setelah menyimpan hash).
   - Generator secret acak di halaman (`crypto.getRandomValues`) **hanya** disediakan untuk properti yang bersifat manual dan secret menurut `references/config.md` (seperti `WEBHOOK_SHARED_SECRET`, serta bantuan pembuatan string acak lokal untuk `ADMIN_PASSPHRASE_INIT`). Nilai hasil generate hanya tampil di memori halaman, tidak pernah disimpan ke storage, tidak dikirim ke mana pun, dan disertai peringatan **"Salin sekarang — hilang saat halaman dimuat ulang"**.

3. **Manipulasi DOM Aman (`textContent`), Validator URL `/exec` & Ekspos `GaslyGuide` (`Gate I-03`, `I-04`):**
   - Seluruh pembaruan snippet dan pesan status wajib menggunakan `.textContent`. **Dilarang keras** menggunakan `innerHTML`, `outerHTML`, `insertAdjacentHTML`, atau `document.write`.
   - Sediakan form konfigurasi interaktif untuk 4 placeholder standar: `{{SPREADSHEET_ID}}`, `{{GAS_EXEC_URL}}`, `{{GOOGLE_CLIENT_ID}}`, dan `{{PAGES_DOMAIN}}` yang mengganti placeholder di seluruh blok kode secara langsung.
   - Validator wajib menolak karakter `<`, `>`, `"`, `'`, dan spasi pada semua input.
   - Validator URL Web App (`{{GAS_EXEC_URL}}`) wajib memastikan protokol `https:`, host `script.google.com`, serta path memuat `/macros/` dan berakhir dengan `/exec` (jangan menolak URL akun Google Workspace seperti `https://script.google.com/macros/a/<domain>/s/<id>/exec`).
   - Ekspos fungsi murni `fillPlaceholders(templateStr, valuesObj)`, `validateConfig(configObj)`, dan `generateSecret(length)` melalui satu objek global `window.GaslyGuide` (`globalThis.GaslyGuide`) agar dapat diuji secara deterministik di luar DOM.

4. **Provenance Langkah, Batas `localStorage` & Tanpa Tombol Eksekusi Jaringan (`Gate I-05`, `I-06`):**
   - Setiap langkah instalasi (`<section data-install-step ...>`) wajib memiliki 5 metadata eksplisit: **Tujuan** (`data-step-purpose`), **Aksi** (`data-step-action`), **Hasil yang Diharapkan** (`data-step-expected`), **Sumber** (`data-step-source`), dan **Last Verified** (`data-step-verified` berisi tanggal `YYYY-MM-DD` dari `references/facts.md` atau label `UNVERIFIED` beserta pencatatan manual di `VERIFY.md`).
   - `localStorage` hanya boleh dipakai untuk menyimpan status centang progres dengan kunci berawalan `gasly_install_`, wajib dibungkus `try / catch`, halaman tetap berfungsi normal bila `localStorage` diblokir, dan **dilarang keras** menyimpan nilai input form konfigurasi atau secret.
   - Uji koneksi (`curl` dan Browser Console `fetch`) hanya disajikan sebagai blok kode untuk **DISALIN** oleh pengguna; dilarang membuat tombol yang memanggil URL `/exec` dari dalam halaman panduan.

---

## 2. PEMUATAN REFERENSI (ROUTING TABLE)

Buka dan gunakan file referensi berikut saat menyusun panduan instalasi proyek:

| File Referensi | Kondisi Muat | Tujuan Penggunaan |
| :--- | :--- | :--- |
| `references/contract.md` | **Selalu Dibuka** | Memastikan kesesuaian protokol `POST text/plain`, struktur request `{ action, v: 1, auth, idem, payload }`, dan aturan update deployment `/exec`. |
| `references/access-profiles.md` | **Selalu Dibuka** | Menyesuaikan langkah otentikasi berdasarkan Access Profile (`P1`–`P4`), `auth.login`, `auth.google`, dan `P2-lite`. |
| `references/gates.md` | **Selalu Dibuka** | Memeriksa kepatuhan terhadap gerbang `INSTALL-GUIDE` (`I-01` s/d `I-06`) dan `UNIVERSAL` (`U-01` s/d `U-12`). |
| `references/config.md` | **Selalu Dibuka** | Sumber tunggal tabel `ScriptProperties`, `initialSetupDatabase()`, dan `setupAdminCredentials()`. |
| `references/facts.md` | **Selalu Dibuka** | Mengambil fakta kuota GAS, lisensi hosting (`Cloudflare Pages` vs `Vercel` vs `GitHub Pages`), URL dokumentasi resmi, dan status `UNVERIFIED`. |
| `references/monetization-and-tiers.md` | **Kondisional (SaaS / Monetisasi / Tier 2–3)** | Menambahkan langkah halaman wajib `/privacy` & `/terms` serta konfigurasi Edge Relay pada `TIER_2_EDGE_GATEWAY` / `TIER_3_HYBRID_SAAS`. |
| `references/install-steps.md` | **Selalu Dibuka** | Katalog langkah kondisional beserta Tujuan, Aksi, Hasil yang Diharapkan, Sumber, dan status verifikasi. |
| `references/guide-template.html` | **Selalu Dibuka** | Kerangka dasar HTML mandiri, CSS token preset, stepper, akordeon troubleshooting, dan objek `GaslyGuide`. |
| `references/gasly-contract.schema.json` | **Selalu Dibuka** | Memvalidasi struktur `GASLY_CONTRACT_JSON` yang menjadi input kompilasi panduan. |

---

## 3. ATURAN PENYUSUNAN LANGKAH KONDISIONAL DARI `GASLY_CONTRACT_JSON`

Baca `GASLY_CONTRACT_JSON` (serta daftar file keluaran) dan aktifkan langkah secara spesifik:
1. **Selalu Aktif (Langkah Inti Backend GAS):**
   - Pembuatan Google Spreadsheet & penyalinan file `.gs` (`setup.gs`, `code.gs`, dll.).
   - Eksekusi `initialSetupDatabase()` (otomatis membuat sheet, 16 baris seed objek, `AUTH_HMAC_SECRET`, `AUTH_PEPPER`, dan folder Drive).
   - Pengaturan `ADMIN_PASSPHRASE_INIT` & `ADMIN_PIN_INIT` di `ScriptProperties` $\rightarrow$ eksekusi `setupAdminCredentials()`.
   - Deployment Web App (`Execute as: Me`, `Who has access: Anyone`) & prosedur update versi baru tanpa mengubah URL `/exec`.
2. **Kondisional Berdasarkan `architecture.auth_google_enabled` & `access_profile`:**
   - Jika `auth_google_enabled === true`: sertakan langkah pembuatan Google Cloud OAuth 2.0 Web Client ID, pengisian `GOOGLE_CLIENT_ID` di `ScriptProperties`, dan bila menggunakan `P2-lite` sertakan opsi `P2_LITE_AUTO_PROVISION`.
3. **Kondisional Berdasarkan Integrasi & Entitas:**
   - Hanya tampilkan properti tambahan yang relevan dari tabel `references/config.md` (mis. `WEBHOOK_SHARED_SECRET` jika ada `webhook.receive`, `MAX_UPLOAD_BYTES` & `DRIVE_ROOT_FOLDER_ID` jika ada entitas dengan `drive_upload.enabled === true`).
4. **Kondisional Berdasarkan `surface_profile` / Monetisasi:**
   - Jika `surface_profile` adalah `SAAS_PLATFORM` atau `MARKETPLACE`, atau `auth_google_enabled === true`: wajibkan langkah publikasi halaman `/privacy` (dan `/terms` untuk layanan berbayar) sesuai `references/monetization-and-tiers.md`.
5. **Kondisional Berdasarkan `architecture.tier` & `hosting_target`:**
   - Sesuaikan perintah build & variabel environment (`PUBLIC_GAS_EXEC_URL` / `NEXT_PUBLIC_GAS_EXEC_URL` / `window.GASLY_CONFIG.EXEC_URL`) dengan `frontend_stack` dan `hosting_target`.
   - **Langkah Edge Relay / Webhook Proxy HANYA ditampilkan jika `architecture.tier` adalah `TIER_2_EDGE_GATEWAY` atau `TIER_3_HYBRID_SAAS`.**

---

## 4. FORMAT KELUARAN WAJIB

1. Ringkasan konfigurasi proyek yang terdeteksi dari `GASLY_CONTRACT_JSON` (Nama proyek, Tier, Access Profile, Stack, Hosting, dan daftar langkah aktif).
2. Satu blok kode `### FILE: install-guide.html` (100% utuh tanpa elipsis/placeholder `TODO`) yang mematuhi `Gate I-01` s/d `Gate I-06`.
3. Perintah verifikasi deterministik:
   `python3 tools/verify_output.py --install-guide install-guide.html`

---
<!-- STACK: html-tailwind.md -->
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
   * For public uploads (P3), passes { entity, entityId, uploadNonce } to file.ticket.
   */
  async function uploadPhoto(options) {
    var file = options.file;
    var entity = options.entity || 'ITEMS';
    var entityId = options.entityId;
    var uploadNonce = options.uploadNonce || '';
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
        var ticketRes = await global.GaslyClient.request(
          'file.ticket',
          { entity: entity, entityId: entityId, uploadNonce: uploadNonce },
          { idempotent: false }
        );
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

      if (uploadRes.status !== 'success' || uploadRes.code !== 'OK') {
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
  <!-- Produksi wajib pakai CSS terkompilasi (jalankan npm run build:css): -->
  <link rel="stylesheet" href="./dist/styles.css">
  <!-- Hanya buka komentar di bawah saat prototipe cepat tanpa build step: -->
  <!-- <script src="https://cdn.tailwindcss.com"></script> -->
  <!-- <link rel="stylesheet" href="./src/preset-tokens.css"> -->
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
              uploadNonce: createRes.data && createRes.data.uploadNonce,
              onStateChange: function(st, msg) {
                statusEl.textContent = 'Status foto: ' + msg + ' (' + st + ')';
              }
            });
            if (!upRes || upRes.status !== 'success' || upRes.code !== 'OK') {
              window.appShowToast('Data tersimpan, namun unggah foto gagal: ' + ((upRes && upRes.message) || ''), 'error');
              await window.appLoadItems();
              return;
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

---
<!-- STACK: nextjs-shadcn.md -->
<!-- KB_VERSION: 2.1.0 -->
# STACK ADAPTER: NEXT.JS (APP ROUTER) + SHADCN/UI (`stacks/nextjs-shadcn.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-ui` ketika stack yang dipilih adalah `nextjs` + `shadcn`.

## Daftar Isi
1. [Struktur Proyek & Konvensi `NEXT_PUBLIC_GAS_EXEC_URL`](#1-struktur-proyek--konvensi-next_public_gas_exec_url)
2. [Strategi Hybrid: Baca Publik Saat Build/ISR vs Tulis dari Browser](#2-strategi-hybrid-baca-publik-saat-buildisr-vs-tulis-dari-browser)
3. [Kode Lengkap `src/lib/gasClient.ts` & `src/lib/driveImage.ts`](#3-kode-lengkap-srclibgasclientts--srclibdriveimagets)
4. [Kode Lengkap `src/components/ImageUploader.tsx`](#4-kode-lengkap-srccomponentsimageuploadertsx)
5. [Kode Lengkap `src/app/page.tsx` (Server Component ISR) & `src/components/ItemsClientView.tsx`](#5-kode-lengkap-srcapppagetsx-server-component-isr--srccomponentsitemsclientviewtsx)

---

## 1. Struktur Proyek & Konvensi `NEXT_PUBLIC_GAS_EXEC_URL`

```text
nextjs-gasly-app/
├── .env.local                          # NEXT_PUBLIC_GAS_EXEC_URL=https://script.google.com/macros/s/<ID>/exec
├── package.json                        # Menggunakan <<PIN_VERSION>> untuk next, react, react-dom, tailwindcss
└── src/
    ├── app/
    │   ├── globals.css                 # Mengimpor CSS variabel preset (mis. dense-dashboard.css / aura.css)
    │   ├── layout.tsx
    │   └── page.tsx                    # Server Component: mengambil bacaan publik saat build / ISR revalidate
    ├── components/
    │   ├── ImageUploader.tsx           # Client Component: kompresi ~1 MB & 5 state aksesibel
    │   └── ItemsClientView.tsx         # Client Component: form mutasi, login admin, & konfirmasi hapus (Step-Up PIN)
    └── lib/
        ├── gasClient.ts                # Klien HTTP text/plain POST/GET, retry idempoten, & memori token
        └── driveImage.ts               # Helper tunggal driveImageUrl(fileId, width) + fallback
```

- **Satu Konfigurasi Lingkungan:** Buat `.env.local` dengan satu variabel publik:
  `NEXT_PUBLIC_GAS_EXEC_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec`
- **Dependensi `package.json`:** Gunakan penanda `<<PIN_VERSION>>` untuk `next`, `react`, `react-dom`, dan `tailwindcss` (dicatat di `VERIFY.md`).

---

## 2. Strategi Hybrid: Baca Publik Saat Build/ISR vs Tulis dari Browser

1. **Baca Publik pada Waktu Build / Revalidate (`P1` & `P3`):**
   - Server Component (`src/app/page.tsx`) memanggil `fetchPublicReadServer()` menggunakan HTTP `GET` (`?action=items.list&v=1`) dengan `redirect: "follow"` dan `next: { revalidate: 60 }`.
   - Jika server Apps Script mengembalikan envelope `status !== "success"` (misalnya saat `LOCK_TIMEOUT`), Server Component tidak boleh melempar error yang merusak proses build statis, melainkan meneruskan state awal kosong + pesan peringatan agar Client Component dapat memuat ulang dari browser.
2. **Tulis & Aksi Terotentikasi dari Browser (`P3` & `P4`):**
   - Seluruh operasi mutasi (`items.create`, `items.update`, `items.delete`, `file.upload`) dan login (`auth.login`) dieksekusi langsung dari browser menggunakan `gasClient.ts` (`POST` `Content-Type: text/plain;charset=utf-8`).
   - Token sesi disimpan di variabel memori modul `gasClient.ts` (atau `sessionStorage` opsional; cookie `HttpOnly` tidak dimungkinkan karena perbedaan origin dengan `script.google.com`).

---

## 3. Kode Lengkap `src/lib/gasClient.ts` & `src/lib/driveImage.ts`

```typescript
// FILE: src/lib/gasClient.ts
export type GasEnvelope<T = unknown> = {
  status: 'success' | 'error';
  data: T | null;
  message: string;
  code:
    | 'OK'
    | 'VALIDATION_ERROR'
    | 'NOT_FOUND'
    | 'FORBIDDEN'
    | 'CONFLICT'
    | 'LOCK_TIMEOUT'
    | 'INTERNAL_ERROR';
  meta: {
    schemaVersion?: string;
    timestamp: string;
    idempotentReplay?: boolean;
    retryAfterSeconds?: number;
  };
};

const SESSION_STORAGE_KEY = 'GASLY_NEXT_SESSION_TOKEN';
let memorySessionToken: string | null = null;

export function getExecUrl(): string {
  return process.env.NEXT_PUBLIC_GAS_EXEC_URL || '';
}

export function getSessionToken(): string | null {
  if (memorySessionToken) return memorySessionToken;
  if (typeof window !== 'undefined') {
    try {
      return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

export function setSessionToken(token: string | null, persistInSessionStorage = false): void {
  memorySessionToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token && persistInSessionStorage) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      } else {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage restriction in sandboxed contexts
    }
  }
}

export function clearSessionToken(): void {
  setSessionToken(null, false);
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface GasRequestOptions {
  idempotent?: boolean;
  idemKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Browser & Server compatible client for Google Apps Script /exec.
 * Sends POST with Content-Type: text/plain;charset=utf-8 to avoid CORS preflight.
 */
export async function gasRequest<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  options: GasRequestOptions = {}
): Promise<GasEnvelope<T>> {
  const execUrl = getExecUrl();
  if (!execUrl || execUrl.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
    return {
      status: 'error',
      data: null,
      message: 'NEXT_PUBLIC_GAS_EXEC_URL belum dikonfigurasi pada .env.local.',
      code: 'VALIDATION_ERROR',
      meta: { timestamp: new Date().toISOString() }
    };
  }

  const isRead = action.endsWith('.list') || action.endsWith('.get');
  const isIdempotent = options.idempotent ?? !isRead;
  const idemKey = options.idemKey || (isIdempotent ? generateIdempotencyKey() : null);
  const canRetry = isRead || Boolean(idemKey);
  const maxRetries = canRetry ? (options.maxRetries ?? 2) : 0;
  const timeoutMs = options.timeoutMs ?? 20000;

  const bodyString = JSON.stringify({
    action,
    v: 1,
    auth: getSessionToken(),
    idem: idemKey,
    payload
  });

  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(execUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        redirect: 'follow',
        body: bodyString,
        signal: controller.signal
      });

      const rawText = await response.text();
      const envelope = JSON.parse(rawText) as GasEnvelope<T>;

      if (envelope.code === 'FORBIDDEN' && !action.startsWith('auth.')) {
        clearSessionToken();
      }

      if (envelope.code === 'LOCK_TIMEOUT' && attempt < maxRetries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
        continue;
      }

      return envelope;
    } catch (err) {
      if (attempt < maxRetries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
        continue;
      }
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        status: 'error',
        data: null,
        message: isAbort
          ? 'Permintaan ke server melewati batas waktu tunggu (timeout).'
          : 'Gagal terhubung ke endpoint Google Apps Script (/exec).',
        code: 'INTERNAL_ERROR',
        meta: { timestamp: new Date().toISOString() }
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Build-time / ISR public read helper for Next.js Server Components.
 */
export async function fetchPublicReadServer<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  revalidateSeconds = 60
): Promise<GasEnvelope<T>> {
  const execUrl = getExecUrl();
  if (!execUrl || execUrl.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
    return {
      status: 'error',
      data: null,
      message: 'NEXT_PUBLIC_GAS_EXEC_URL belum disetel.',
      code: 'VALIDATION_ERROR',
      meta: { timestamp: new Date().toISOString() }
    };
  }

  const url = new URL(execUrl);
  url.searchParams.set('action', action);
  url.searchParams.set('v', '1');
  if (Object.keys(payload).length > 0) {
    url.searchParams.set('payload', JSON.stringify(payload));
  }

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      next: { revalidate: revalidateSeconds }
    });
    const text = await res.text();
    return JSON.parse(text) as GasEnvelope<T>;
  } catch {
    return {
      status: 'error',
      data: null,
      message: 'Gagal memuat data awal pada saat build/revalidate.',
      code: 'INTERNAL_ERROR',
      meta: { timestamp: new Date().toISOString() }
    };
  }
}
```

```typescript
// FILE: src/lib/driveImage.ts
/**
 * Single helper for Google Drive image display URLs.
 * Primary: https://drive.google.com/thumbnail?id=<id>&sz=w<width>
 * Fallback: https://lh3.googleusercontent.com/d/<id>=w<width>
 */
export function driveImageUrl(fileId: string | null | undefined, width = 800): string {
  const cleanId = String(fileId || '').trim();
  if (!cleanId) return '';
  const w = Math.max(64, Math.min(2400, Math.floor(width)));
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(cleanId)}&sz=w${w}`;
}

export function driveImageFallbackUrl(fileId: string | null | undefined, width = 800): string {
  const cleanId = String(fileId || '').trim();
  if (!cleanId) return '';
  const w = Math.max(64, Math.min(2400, Math.floor(width)));
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(cleanId)}=w${w}`;
}

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

export function formatCurrencyIdr(value: unknown): string {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return '-';
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 'Data tidak valid';
  }
  return idrFormatter.format(num);
}
```

---

## 4. Kode Lengkap `src/components/ImageUploader.tsx`

```tsx
// FILE: src/components/ImageUploader.tsx
'use client';

import React, { useState } from 'react';
import { gasRequest, getSessionToken } from '@/lib/gasClient';

export type UploadStatus = 'idle' | 'compressing' | 'uploading' | 'error' | 'done';

interface ImageUploaderProps {
  entity: string;
  entityId: string;
  uploadNonce?: string;
  onUploaded?: (result: { fileId: string; fileUrl: string }) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const TARGET_BYTES = 1024 * 1024;
const MAX_DIMENSION = 1600;

async function compressFileToBase64(file: File): Promise<{
  fileName: string;
  mimeType: string;
  base64: string;
}> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Format file harus JPEG, PNG, atau WebP.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal membaca gambar.'));
      el.src = objectUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Konteks canvas 2D tidak tersedia.');
    ctx.drawImage(img, 0, 0, width, height);

    const outMime = file.type === 'image/png' ? 'image/webp' : file.type;
    const qualities = [0.82, 0.68, 0.54, 0.42];
    let base64 = '';

    for (const q of qualities) {
      const dataUrl = canvas.toDataURL(outMime, q);
      base64 = dataUrl.split(',')[1] || '';
      if (Math.floor((base64.length * 3) / 4) <= TARGET_BYTES) {
        break;
      }
    }

    return {
      fileName: file.name,
      mimeType: outMime,
      base64
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ImageUploader({ entity, entityId, uploadNonce = '', onUploaded }: ImageUploaderProps) {
  const [state, setState] = useState<UploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Pilih foto (maks. ~1 MB setelah kompresi).');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setState('compressing');
    setStatusMessage('Mengompres ukuran foto...');

    try {
      const compressed = await compressFileToBase64(file);
      setState('uploading');
      setStatusMessage('Mengunggah foto ke Google Drive...');

      let ticket: string | null = null;
      if (!getSessionToken()) {
        const ticketEnv = await gasRequest<{ ticket: string }>(
          'file.ticket',
          { entity, entityId, uploadNonce },
          { idempotent: false }
        );
        if (ticketEnv.status !== 'success' || !ticketEnv.data?.ticket) {
          setState('error');
          setStatusMessage(ticketEnv.message || 'Gagal memperoleh tiket unggah.');
          return;
        }
        ticket = ticketEnv.data.ticket;
      }

      const uploadEnv = await gasRequest<{ fileId: string; fileUrl: string }>(
        'file.upload',
        {
          entity,
          entityId,
          fileName: compressed.fileName,
          mimeType: compressed.mimeType,
          base64: compressed.base64,
          ticket
        },
        { idempotent: true }
      );

      if (uploadEnv.status !== 'success' || uploadEnv.code !== 'OK' || !uploadEnv.data) {
        setState('error');
        setStatusMessage(uploadEnv.message || 'Gagal mengunggah foto.');
        return;
      }

      setState('done');
      setStatusMessage('Foto berhasil disimpan ke Google Drive.');
      onUploaded?.(uploadEnv.data);
    } catch (err) {
      setState('error');
      setStatusMessage(err instanceof Error ? err.message : 'Gagal memproses foto.');
    }
  }

  return (
    <div className="space-y-1.5" aria-busy={state === 'compressing' || state === 'uploading'}>
      <label
        htmlFor={`uploader-${entityId}`}
        style={{ color: 'var(--text-secondary)' }}
        className="block text-xs font-semibold"
      >
        Unggah Foto Bukti
      </label>
      <input
        id={`uploader-${entityId}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={state === 'compressing' || state === 'uploading'}
        onChange={handleFileChange}
        style={{
          backgroundColor: 'var(--bg-base)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-subtle)'
        }}
        className="block w-full min-h-[42px] text-xs rounded-lg border px-2.5 py-1.5"
      />
      <p
        aria-live="polite"
        style={{
          color: state === 'error' ? 'var(--danger-solid)' : 'var(--text-helper)'
        }}
        className="text-xs"
      >
        [{state.toUpperCase()}] {statusMessage}
      </p>
    </div>
  );
}
```

---

## 5. Kode Lengkap `src/app/page.tsx` (Server Component ISR) & `src/components/ItemsClientView.tsx`

```tsx
// FILE: src/app/page.tsx
import React from 'react';
import { fetchPublicReadServer } from '@/lib/gasClient';
import { ItemsClientView, ItemRecord } from '@/components/ItemsClientView';

export default async function HomePage() {
  const initialEnvelope = await fetchPublicReadServer<{ items: ItemRecord[] }>('items.list', {}, 60);
  const initialItems = initialEnvelope.status === 'success' && initialEnvelope.data?.items
    ? initialEnvelope.data.items
    : [];

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6">
      <ItemsClientView
        initialItems={initialItems}
        initialError={initialEnvelope.status === 'error' ? initialEnvelope.message : null}
      />
    </main>
  );
}
```

```tsx
// FILE: src/components/ItemsClientView.tsx
'use client';

import React, { useState } from 'react';
import { gasRequest, setSessionToken, clearSessionToken } from '@/lib/gasClient';
import { driveImageUrl, driveImageFallbackUrl, formatCurrencyIdr } from '@/lib/driveImage';
import { ImageUploader } from '@/components/ImageUploader';

export interface ItemRecord {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  category: string;
  amount: number;
  status: string;
  file_id?: string;
  file_url?: string;
}

interface ItemsClientViewProps {
  initialItems: ItemRecord[];
  initialError: string | null;
}

export function ItemsClientView({ initialItems, initialError }: ItemsClientViewProps) {
  const [items, setItems] = useState<ItemRecord[]>(initialItems);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('Operasional');
  const [amount, setAmount] = useState<string>('');
  const [passphrase, setPassphrase] = useState<string>('');
  const [persistTab, setPersistTab] = useState<boolean>(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<ItemRecord | null>(null);
  const [deletePin, setDeletePin] = useState<string>('');
  const [uploadNonces, setUploadNonces] = useState<Record<string, string>>({});

  async function refreshItems() {
    setIsLoading(true);
    setErrorMsg(null);
    const res = await gasRequest<{ items: ItemRecord[] }>('items.list', {});
    setIsLoading(false);
    if (res.status === 'success' && res.data?.items) {
      setItems(res.data.items);
    } else {
      setErrorMsg(res.message || 'Gagal memuat data.');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);

    const res = await gasRequest<{ item: ItemRecord; uploadNonce?: string }>('items.create', {
      title,
      category,
      amount: Number(amount),
      status: 'ACTIVE'
    });

    setIsSaving(false);
    if (res.status === 'success' && res.data?.item) {
      if (res.data.uploadNonce) {
        const createdId = res.data.item.id;
        const nonce = res.data.uploadNonce;
        setUploadNonces((prev) => ({ ...prev, [createdId]: nonce }));
      }
      setTitle('');
      setAmount('');
      await refreshItems();
    } else {
      // Preserve form inputs on error (U-08 RECOVERY gate)
      setErrorMsg(res.message || 'Gagal menyimpan data.');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || isSaving) return;
    if (!/^\d{6}$/.test(deletePin.trim())) {
      setErrorMsg('Masukkan PIN step-up 6 digit angka untuk mengarsipkan data.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    const pinRes = await gasRequest<{ stepUpToken: string }>(
      'auth.verifyPin',
      { pin: deletePin.trim(), targetAction: 'items.delete' },
      { idempotent: false, maxRetries: 0 }
    );

    if (pinRes.status !== 'success' || !pinRes.data?.stepUpToken) {
      setIsSaving(false);
      setErrorMsg(pinRes.message || 'Verifikasi PIN step-up gagal.');
      return;
    }

    const res = await gasRequest('items.delete', {
      id: deleteTarget.id,
      updated_at: deleteTarget.updated_at,
      stepUpToken: pinRes.data.stepUpToken
    });
    setIsSaving(false);
    setDeletePin('');
    setDeleteTarget(null);
    if (res.status === 'success') {
      await refreshItems();
    } else {
      setErrorMsg(res.message || 'Gagal mengarsipkan data.');
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await gasRequest<{ token: string; role: string }>(
      'auth.login',
      { account: 'admin', passphrase },
      { idempotent: false, maxRetries: 0 }
    );
    if (res.status === 'success' && res.data?.token) {
      setSessionToken(res.data.token, persistTab);
      setPassphrase('');
      setIsAdminLoggedIn(true);
    } else {
      setErrorMsg(res.message || 'Login admin gagal.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Admin Auth Bar */}
      <section
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        className="p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Operasional</h1>
          <p style={{ color: 'var(--text-helper)' }} className="text-xs">
            Pembacaan awal via ISR • penulisan langsung ke Apps Script (/exec)
          </p>
        </div>

        {!isAdminLoggedIn ? (
          <form onSubmit={handleAdminLogin} className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="admin-pass" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
                Passphrase Admin
              </label>
              <input
                id="admin-pass"
                type="password"
                required
                minLength={12}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                className="min-h-[42px] px-3 py-1.5 rounded-lg border text-sm"
              />
            </div>
            <label htmlFor="persist-tab" style={{ color: 'var(--text-helper)' }} className="flex items-center gap-1.5 text-xs py-2">
              <input
                id="persist-tab"
                type="checkbox"
                checked={persistTab}
                onChange={(e) => setPersistTab(e.target.checked)}
              />
              SessionStorage
            </label>
            <button
              type="submit"
              style={{ backgroundColor: 'var(--accent-solid)', color: 'var(--accent-text-on-solid)' }}
              className="min-h-[42px] px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Login Admin
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              clearSessionToken();
              setIsAdminLoggedIn(false);
            }}
            style={{ backgroundColor: 'var(--bg-interactive)', color: 'var(--text-primary)' }}
            className="min-h-[42px] px-4 py-2 rounded-lg text-sm font-medium"
          >
            Keluar Sesi Admin
          </button>
        )}
      </section>

      {errorMsg && (
        <div
          role="alert"
          style={{ backgroundColor: 'var(--danger-solid)', color: 'var(--danger-text-on-solid)' }}
          className="p-4 rounded-xl flex items-center justify-between gap-4 text-sm"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={refreshItems}
            className="min-h-[40px] px-3 py-1 rounded bg-black/20 font-semibold text-xs"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Create Form */}
      <form
        onSubmit={handleCreate}
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        className="p-5 rounded-xl border grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
      >
        <div>
          <label htmlFor="item-title" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
            Judul Transaksi *
          </label>
          <input
            id="item-title"
            type="text"
            required
            minLength={3}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
            className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm"
          />
        </div>
        <div>
          <label htmlFor="item-cat" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
            Kategori
          </label>
          <select
            id="item-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
            className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm"
          >
            <option value="Operasional">Operasional</option>
            <option value="Pemasaran">Pemasaran</option>
            <option value="Infrastruktur">Infrastruktur</option>
            <option value="Lisensi">Lisensi</option>
          </select>
        </div>
        <div>
          <label htmlFor="item-amt" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
            Nominal (Rp) *
          </label>
          <input
            id="item-amt"
            type="number"
            required
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
            className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm tabular-nums"
          />
        </div>
        <button
          type="submit"
          disabled={isSaving}
          style={{ backgroundColor: 'var(--accent-solid)', color: 'var(--accent-text-on-solid)' }}
          className="min-h-[42px] px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {isSaving ? 'Menyimpan...' : 'Tambah Data'}
        </button>
      </form>

      {/* Items Table */}
      <section
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        className="rounded-xl border overflow-x-auto p-4"
      >
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-10 rounded" style={{ backgroundColor: 'var(--bg-interactive)' }} />
            <div className="h-10 rounded" style={{ backgroundColor: 'var(--bg-interactive)' }} />
          </div>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--text-helper)' }} className="p-6 text-center text-sm">
            Belum ada data. Tambahkan transaksi pertama melalui formulir di atas.
          </p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ color: 'var(--text-helper)', borderColor: 'var(--border-subtle)' }} className="border-b text-xs uppercase">
                <th className="py-2 px-2">ID</th>
                <th className="py-2 px-2">Judul</th>
                <th className="py-2 px-2 text-right">Nominal</th>
                <th className="py-2 px-2">Foto Drive</th>
                <th className="py-2 px-2">Unggah Bukti</th>
                <th className="py-2 px-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} style={{ borderColor: 'var(--border-subtle)' }} className="border-b">
                  <td className="py-3 px-2 text-xs font-mono">{it.id}</td>
                  <td className="py-3 px-2 text-sm font-medium">{it.title}</td>
                  <td className="py-3 px-2 text-sm text-right tabular-nums font-semibold">
                    {formatCurrencyIdr(it.amount)}
                  </td>
                  <td className="py-3 px-2">
                    {it.file_id ? (
                      <img
                        src={driveImageUrl(it.file_id, 160)}
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.dataset.fallbackApplied !== 'true') {
                            target.dataset.fallbackApplied = 'true';
                            target.src = driveImageFallbackUrl(it.file_id, 160);
                          }
                        }}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        alt={`Bukti ${it.title}`}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <span style={{ color: 'var(--text-helper)' }} className="text-xs">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <ImageUploader
                      entity="ITEMS"
                      entityId={it.id}
                      uploadNonce={uploadNonces[it.id]}
                      onUploaded={() => refreshItems()}
                    />
                  </td>
                  <td className="py-3 px-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setDeletePin('');
                        setDeleteTarget(it);
                      }}
                      style={{ backgroundColor: 'var(--danger-solid)', color: 'var(--danger-text-on-solid)' }}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold"
                    >
                      Arsipkan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Custom Confirmation Modal + Step-Up PIN (Gate W-01 & auth.verifyPin) */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-del-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            className="w-full max-w-md rounded-xl border p-6 space-y-4"
          >
            <h2 id="confirm-del-title" className="text-lg font-bold">Konfirmasi Pengarsipan</h2>
            <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
              Apakah Anda yakin ingin mengarsipkan transaksi <strong>{deleteTarget.title}</strong> ({deleteTarget.id})?
            </p>
            <div>
              <label htmlFor="delete-stepup-pin" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
                PIN Konfirmasi Admin (6 Digit) *
              </label>
              <input
                id="delete-stepup-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={deletePin}
                onChange={(e) => setDeletePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 digit angka"
                style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm font-mono tabular-nums"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeletePin('');
                  setDeleteTarget(null);
                }}
                style={{ backgroundColor: 'var(--bg-interactive)', color: 'var(--text-primary)' }}
                className="min-h-[42px] px-4 py-2 rounded-lg text-sm"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmDelete}
                style={{ backgroundColor: 'var(--danger-solid)', color: 'var(--danger-text-on-solid)' }}
                className="min-h-[42px] px-4 py-2 rounded-lg text-sm font-semibold"
              >
                {isSaving ? 'Memproses...' : 'Ya, Arsipkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---
<!-- STACK: astro.md -->
<!-- KB_VERSION: 2.1.0 -->
# STACK ADAPTER: ASTRO (`stacks/astro.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-ui` ketika stack yang dipilih adalah `astro`.

## Daftar Isi
1. [Struktur Proyek & Konvensi `PUBLIC_GAS_EXEC_URL`](#1-struktur-proyek--konvensi-public_gas_exec_url)
2. [Strategi Build-Time Public Reads & Browser Island Writes](#2-strategi-build-time-public-reads--browser-island-writes)
3. [Kode Lengkap `src/lib/gasClient.ts` & `src/lib/driveImage.ts`](#3-kode-lengkap-srclibgasclientts--srclibdriveimagets)
4. [Kode Lengkap `src/pages/index.astro` (Build-Time Read + Interactive Island)](#4-kode-lengkap-srcpagesindexastro-build-time-read--interactive-island)

---

## 1. Struktur Proyek & Konvensi `PUBLIC_GAS_EXEC_URL`

```text
astro-gasly-app/
├── .env                                # PUBLIC_GAS_EXEC_URL=https://script.google.com/macros/s/<ID>/exec
├── astro.config.mjs
├── package.json                        # Menggunakan <<PIN_VERSION>> untuk astro dan @astrojs/tailwind
└── src/
    ├── styles/
    │   └── preset.css                  # Salinan CSS variabel preset (mis. editorial-light.css / warm-friendly.css)
    ├── lib/
    │   ├── gasClient.ts                # Klien HTTP text/plain POST/GET, retry idempoten, & memori token
    │   └── driveImage.ts               # Helper tunggal driveImageUrl(fileId, width) + fallback
    └── pages/
        └── index.astro                 # Frontmatter build-time GET + client-side interactive script
```

- **Satu Konfigurasi Lingkungan:** Di `.env`, tetapkan:
  `PUBLIC_GAS_EXEC_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec`
- Variabel berawalan `PUBLIC_` di Astro dapat diakses baik di dalam *frontmatter server/build* (`import.meta.env.PUBLIC_GAS_EXEC_URL`) maupun di dalam skrip interaktif sisi browser.

---

## 2. Strategi Build-Time Public Reads & Browser Island Writes

1. **Baca Publik Saat Build (`src/pages/index.astro` frontmatter):**
   - Saat `astro build` dijalankan, bagian frontmatter (`---`) mengambil data publik (`action=items.list&v=1`) dari URL `/exec` menggunakan `redirect: "follow"` dan merender HTML awal yang cepat serta ramah SEO.
2. **Pembaruan Langsung & Mutasi dari Browser:**
   - Aksi tulis (`items.create`, `file.ticket`, `file.upload`, `items.delete`) dan login admin (`auth.login` dengan token sesi di memori atau `sessionStorage` opsional) dieksekusi langsung dari browser ke URL `/exec` menggunakan `Content-Type: text/plain;charset=utf-8`.

---

## 3. Kode Lengkap `src/lib/gasClient.ts` & `src/lib/driveImage.ts`

```typescript
// FILE: src/lib/gasClient.ts
export interface GasEnvelope<T = unknown> {
  status: 'success' | 'error';
  data: T | null;
  message: string;
  code:
    | 'OK'
    | 'VALIDATION_ERROR'
    | 'NOT_FOUND'
    | 'FORBIDDEN'
    | 'CONFLICT'
    | 'LOCK_TIMEOUT'
    | 'INTERNAL_ERROR';
  meta: {
    schemaVersion?: string;
    timestamp: string;
    idempotentReplay?: boolean;
    retryAfterSeconds?: number;
  };
}

const SESSION_KEY = 'GASLY_ASTRO_SESSION_TOKEN';
let inMemoryToken: string | null = null;

export function getExecUrl(): string {
  return import.meta.env.PUBLIC_GAS_EXEC_URL || '';
}

export function getSessionToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window !== 'undefined') {
    try {
      return window.sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

export function setSessionToken(token: string | null, persistInTab = false): void {
  inMemoryToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token && persistInTab) {
        window.sessionStorage.setItem(SESSION_KEY, token);
      } else {
        window.sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {}
  }
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function gasPost<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  options: { idempotent?: boolean; idemKey?: string; timeoutMs?: number; maxRetries?: number } = {}
): Promise<GasEnvelope<T>> {
  const execUrl = getExecUrl();
  if (!execUrl || execUrl.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
    return {
      status: 'error',
      data: null,
      message: 'PUBLIC_GAS_EXEC_URL belum dikonfigurasi pada file .env.',
      code: 'VALIDATION_ERROR',
      meta: { timestamp: new Date().toISOString() }
    };
  }

  const isRead = action.endsWith('.list') || action.endsWith('.get');
  const isIdempotent = options.idempotent ?? !isRead;
  const idemKey = options.idemKey || (isIdempotent ? generateUuid() : null);
  const canRetry = isRead || Boolean(idemKey);
  const maxRetries = canRetry ? (options.maxRetries ?? 2) : 0;
  const timeoutMs = options.timeoutMs ?? 20000;

  const body = JSON.stringify({
    action,
    v: 1,
    auth: getSessionToken(),
    idem: idemKey,
    payload
  });

  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(execUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body,
        signal: controller.signal
      });
      const text = await res.text();
      const env = JSON.parse(text) as GasEnvelope<T>;

      if (env.code === 'FORBIDDEN' && !action.startsWith('auth.')) {
        setSessionToken(null, false);
      }
      if (env.code === 'LOCK_TIMEOUT' && attempt < maxRetries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
        continue;
      }
      return env;
    } catch (err) {
      if (attempt < maxRetries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
        continue;
      }
      return {
        status: 'error',
        data: null,
        message: err instanceof Error && err.name === 'AbortError'
          ? 'Permintaan melewati batas waktu tunggu (timeout).'
          : 'Gagal menghubungi endpoint Google Apps Script (/exec).',
        code: 'INTERNAL_ERROR',
        meta: { timestamp: new Date().toISOString() }
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function fetchBuildTimePublic<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<GasEnvelope<T>> {
  const execUrl = getExecUrl();
  if (!execUrl || execUrl.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
    return {
      status: 'error',
      data: null,
      message: 'PUBLIC_GAS_EXEC_URL belum dikonfigurasi.',
      code: 'VALIDATION_ERROR',
      meta: { timestamp: new Date().toISOString() }
    };
  }
  const url = new URL(execUrl);
  url.searchParams.set('action', action);
  url.searchParams.set('v', '1');
  if (Object.keys(payload).length > 0) {
    url.searchParams.set('payload', JSON.stringify(payload));
  }
  try {
    const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    return (await res.json()) as GasEnvelope<T>;
  } catch {
    return {
      status: 'error',
      data: null,
      message: 'Data build-time belum tersedia; akan dimuat ulang di browser.',
      code: 'INTERNAL_ERROR',
      meta: { timestamp: new Date().toISOString() }
    };
  }
}
```

```typescript
// FILE: src/lib/driveImage.ts
export function driveImageUrl(fileId: string | null | undefined, width = 800): string {
  const cleanId = String(fileId || '').trim();
  if (!cleanId) return '';
  const w = Math.max(64, Math.min(2400, Math.floor(width)));
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(cleanId)}&sz=w${w}`;
}

export function driveImageFallbackUrl(fileId: string | null | undefined, width = 800): string {
  const cleanId = String(fileId || '').trim();
  if (!cleanId) return '';
  const w = Math.max(64, Math.min(2400, Math.floor(width)));
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(cleanId)}=w${w}`;
}

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function formatIdr(val: unknown): string {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') return '-';
  const n = Number(val);
  return Number.isFinite(n) ? idr.format(n) : 'Data tidak valid';
}
```

---

## 4. Kode Lengkap `src/pages/index.astro` (Build-Time Read + Interactive Island)

```astro
---
// FILE: src/pages/index.astro
import '../styles/preset.css';
import { fetchBuildTimePublic } from '../lib/gasClient';
import { driveImageUrl, driveImageFallbackUrl, formatIdr } from '../lib/driveImage';

interface ItemRow {
  id: string;
  title: string;
  category: string;
  amount: number;
  file_id?: string;
}

const buildEnv = await fetchBuildTimePublic<{ items: ItemRow[] }>('items.list');
const initialItems = buildEnv.status === 'success' && buildEnv.data?.items ? buildEnv.data.items : [];
---

<!DOCTYPE html>
<html lang="id" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Katalog & Formulir Layanan — Gasly Astro</title>
  </head>
  <body style="background-color: var(--bg-base); color: var(--text-primary); font-family: var(--font-sans);" class="min-h-screen">
    <main class="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      <header class="space-y-2">
        <h1 style="font-family: var(--font-display);" class="text-3xl md:text-4xl font-bold tracking-tight">
          Katalog &amp; Pengajuan Layanan
        </h1>
        <p style="color: var(--text-secondary);" class="text-sm">
          Data katalog dimuat saat build-time dan pengajuan baru dikirim langsung ke Google Sheets &amp; Drive (/exec).
        </p>
      </header>

      <!-- Daftar Item Hasil Build-Time -->
      <section class="grid grid-cols-1 md:grid-cols-3 gap-4" id="catalog-grid">
        {initialItems.length === 0 ? (
          <p style="color: var(--text-helper);" class="text-sm md:col-span-3">
            Belum ada item katalog yang ditampilkan.
          </p>
        ) : (
          initialItems.map((item) => (
            <article
              style="background-color: var(--bg-surface); border: 1px solid var(--border-subtle);"
              class="p-4 rounded-xl space-y-3"
            >
              {item.file_id && (
                <img
                  src={driveImageUrl(item.file_id, 480)}
                  data-fallback={driveImageFallbackUrl(item.file_id, 480)}
                  onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.dataset.fallback;}"
                  referrerpolicy="no-referrer"
                  loading="lazy"
                  alt={item.title}
                  class="w-full h-40 object-cover rounded-lg"
                />
              )}
              <div class="flex items-center justify-between text-xs" style="color: var(--text-helper);">
                <span>{item.category}</span>
                <span class="font-mono">{item.id}</span>
              </div>
              <h2 class="text-base font-semibold">{item.title}</h2>
              <p class="text-sm font-bold tabular-nums">{formatIdr(item.amount)}</p>
            </article>
          ))
        )}
      </section>

      <!-- Client Island: Form Pengajuan + Kompresi Upload Foto -->
      <section
        style="background-color: var(--bg-surface); border: 1px solid var(--border-subtle);"
        class="p-6 rounded-xl space-y-4"
      >
        <h2 class="text-lg font-bold">Kirim Pengajuan Baru + Foto Bukti</h2>
        <form id="astro-submit-form" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="f-title" style="color: var(--text-secondary);" class="block text-xs font-semibold mb-1">
              Judul Pengajuan *
            </label>
            <input
              id="f-title"
              name="title"
              type="text"
              required
              minlength="3"
              maxlength="120"
              style="background-color: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle);"
              class="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm"
            />
          </div>
          <div>
            <label for="f-amount" style="color: var(--text-secondary);" class="block text-xs font-semibold mb-1">
              Nominal Estimasi (Rp) *
            </label>
            <input
              id="f-amount"
              name="amount"
              type="number"
              required
              min="0"
              style="background-color: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle);"
              class="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm tabular-nums"
            />
          </div>
          <div>
            <label for="f-photo" style="color: var(--text-secondary);" class="block text-xs font-semibold mb-1">
              Foto Lampiran (JPEG/PNG/WebP)
            </label>
            <input
              id="f-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style="background-color: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle);"
              class="w-full min-h-[42px] px-2 py-1.5 rounded-lg text-xs"
            />
            <p id="f-upload-state" aria-live="polite" style="color: var(--text-helper);" class="text-xs mt-1">
              [IDLE] Siap mengunggah
            </p>
          </div>
          <div class="md:col-span-3 flex justify-end">
            <button
              id="f-submit-btn"
              type="submit"
              style="background-color: var(--accent-solid); color: var(--accent-text-on-solid);"
              class="min-h-[44px] px-5 py-2 rounded-lg text-sm font-semibold"
            >
              Kirim Pengajuan
            </button>
          </div>
        </form>
      </section>
    </main>

    <script>
      import { gasPost, getSessionToken } from '../lib/gasClient';

      const form = document.getElementById('astro-submit-form') as HTMLFormElement | null;
      const btn = document.getElementById('f-submit-btn') as HTMLButtonElement | null;
      const stateEl = document.getElementById('f-upload-state');
      let busy = false;

      async function compressPhoto(file: File): Promise<{ fileName: string; mimeType: string; base64: string }> {
        const url = URL.createObjectURL(file);
        try {
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = () => rej(new Error('Gagal memuat gambar'));
            i.src = url;
          });
          const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
          const mime = file.type === 'image/png' ? 'image/webp' : file.type;
          const dataUrl = c.toDataURL(mime, 0.78);
          return { fileName: file.name, mimeType: mime, base64: dataUrl.split(',')[1] || '' };
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (busy || !btn || !stateEl) return;
        busy = true;
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';

        try {
          const fd = new FormData(form);
          const createEnv = await gasPost<{ item: { id: string }; uploadNonce?: string }>('items.create', {
            title: String(fd.get('title') || ''),
            category: 'Operasional',
            amount: Number(fd.get('amount') || 0),
            status: 'PENDING'
          });

          if (createEnv.status !== 'success' || !createEnv.data?.item) {
            stateEl.textContent = `[ERROR] ${createEnv.message}`;
            return;
          }

          const photoInput = document.getElementById('f-photo') as HTMLInputElement | null;
          const file = photoInput?.files?.[0];
          if (file) {
            stateEl.textContent = '[COMPRESSING] Mengompres foto...';
            const comp = await compressPhoto(file);
            stateEl.textContent = '[UPLOADING] Mengunggah foto ke Google Drive...';

            let ticket: string | null = null;
            if (!getSessionToken()) {
              const tEnv = await gasPost<{ ticket: string }>(
                'file.ticket',
                {
                  entity: 'ITEMS',
                  entityId: createEnv.data.item.id,
                  uploadNonce: createEnv.data.uploadNonce || ''
                },
                { idempotent: false }
              );
              if (tEnv.status !== 'success' || !tEnv.data?.ticket) {
                stateEl.textContent = `[ERROR] ${tEnv.message}`;
                return;
              }
              ticket = tEnv.data.ticket;
            }

            const upEnv = await gasPost('file.upload', {
              entity: 'ITEMS',
              entityId: createEnv.data.item.id,
              fileName: comp.fileName,
              mimeType: comp.mimeType,
              base64: comp.base64,
              ticket
            });

            if (upEnv.status !== 'success' || upEnv.code !== 'OK') {
              stateEl.textContent = `[ERROR] ${upEnv.message}`;
              return;
            }
          }

          stateEl.textContent = '[DONE] Pengajuan dan foto berhasil disimpan.';
          form.reset();
        } finally {
          busy = false;
          btn.disabled = false;
          btn.textContent = 'Kirim Pengajuan';
        }
      });
    </script>
  </body>
</html>
```

---
<!-- STACK: INHERIT.md -->
<!-- KB_VERSION: 2.1.0 -->
# TOKEN & GATE INHERITANCE FOR 15 ADDITIONAL STACKS (`stacks/INHERIT.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-prd` dan `gasly-ui` ketika pengguna meminta salah satu dari 15 stack pewaris (*inheriting stacks*).

## Daftar Isi
1. [Daftar 15 Stack Pewaris Resmi](#1-daftar-15-stack-pewaris-resmi)
2. [Kontrak yang Diwarisi oleh Seluruh 15 Stack](#2-kontrak-yang-diwarisi-oleh-seluruh-15-stack)
3. [Matriks Adaptasi Teknis per Kelompok Stack](#3-matriks-adaptasi-teknis-per-kelompok-stack)

---

## 1. Daftar 15 Stack Pewaris Resmi

Kelima belas stack berikut tidak memiliki file boilerplate adapter khusus pada tahap ini, tetapi **didukung melalui mode pewarisan (`STACK_MODE: INHERIT`)** dengan mewarisi kontrak protokol `/exec`, token desain JSON/CSS, karakter 3 dials, serta gerbang kualitas:

1. `angular`
2. `avalonia`
3. `flutter`
4. `javafx`
5. `jetpack-compose`
6. `laravel`
7. `react-native`
8. `svelte`
9. `swiftui`
10. `threejs`
11. `uno`
12. `uwp`
13. `vue`
14. `winui`
15. `wpf`

---

## 2. Kontrak yang Diwarisi oleh Seluruh 15 Stack

Ketika membangun pada salah satu dari 15 stack di atas, agen wajib menerapkan 4 kontrak inti berikut tanpa pengecualian:

1. **Kontrak Komunikasi (`references/contract.md`):**
   - Hanya menggunakan satu konfigurasi URL Web App publik (`.../exec`).
   - Mengirim permintaan `POST` dengan `Content-Type: text/plain;charset=utf-8`, mengikuti pengalihan `HTTP 302` (`followRedirects = true`), membungkus payload `{ action, v: 1, auth, idem, payload }`, dan hanya melakukan retry pada aksi yang memiliki kunci `idem` atau aksi baca.
2. **Kontrak Gambar Drive (`driveImageUrl`):**
   - Mengambil gambar menggunakan `https://drive.google.com/thumbnail?id=<fileId>&sz=w<width>` dengan fallback otomatis ke `https://lh3.googleusercontent.com/d/<fileId>=w<width>`.
   - Mengompres foto di sisi client ke sekitar `<= 1 MB` sebelum mengirim base64 ke `file.upload` dengan 5 state (`idle`, `compressing`, `uploading`, `error`, `done`).
3. **Kontrak Token Desain & Preset (`references/presets/<preset>.tokens.json`):**
   - Mengambil nilai hex dari `modes.light` dan `modes.dark` pada file JSON preset yang dipilih (`aura`, `editorial-light`, `dense-dashboard`, `warm-friendly`) sehingga seluruh pasangan teks dan latar tetap lulus kontras **WCAG AA (>= 4,5:1)**.
4. **Kontrak Gerbang Kualitas (`references/gates.md`):**
   - Seluruh 15 stack wajib mematuhi seluruh gerbang **`UNIVERSAL` (`U-01` s/d `U-09`)**.
   - Stack berbasis web (`angular`, `laravel`, `svelte`, `threejs`, `vue`) wajib mematuhi seluruh gerbang **`WEB-ONLY` (`W-01` s/d `W-08`)**.

---

## 3. Matriks Adaptasi Teknis per Kelompok Stack

| Kelompok Stack | Anggota Stack | Cara Konsumsi Token Desain | Aturan HTTP Client ke `/exec` & Penyimpanan Token |
| :--- | :--- | :--- | :--- |
| **Web Frameworks & 3D Web** | `angular`, `laravel`, `svelte`, `threejs`, `vue` | Impor langsung `references/css/<preset>.css` (`var(--bg-base)`, dll.). Untuk `threejs`, gunakan UI overlay HTML/CSS di atas `<canvas>` untuk form/tabel dan ambil warna scene dari JSON token. | Gunakan `fetch` dengan `Content-Type: text/plain;charset=utf-8` dan `redirect: "follow"`.(Pada `laravel`, pemanggilan dari PHP `Http::withOptions(['allow_redirects' => true])` juga didukung untuk bacaan server). Simpan token di memori state aplikasi. |
| **Mobile & Cross-Platform Native** | `flutter`, `react-native`, `jetpack-compose`, `swiftui` | Petakan `modes.light` dan `modes.dark` dari `<preset>.tokens.json` ke objek tema native (`ThemeData`, `StyleSheet`, `MaterialTheme`, `Color`). | Pastikan HTTP client (`http`/`dio`, `OkHttp`, `URLSession`) mengikuti redirect `302` pada request `POST` (atau tangani redirect manual bila library mengubah `POST` menjadi `GET` saat `302`). Simpan session token di memori (atau Keychain/EncryptedSharedPreferences bila sesi perlu dipertahankan). |
| **Desktop .NET & JVM** | `avalonia`, `uno`, `uwp`, `winui`, `wpf`, `javafx` | Petakan nilai hex dari `<preset>.tokens.json` ke `ResourceDictionary` XAML (`SolidColorBrush`) atau stylesheet CSS JavaFX. | Pada `.NET HttpClient` / Java `HttpClient`, aktifkan pengikutan redirect dan kirim body JSON sebagai `StringContent(json, Encoding.UTF8, "text/plain")`. Simpan session token di variabel memori proses aplikasi. |

---
<!-- STACK: PLANNED.md -->
<!-- KB_VERSION: 2.1.0 -->
# PLANNED FEATURES & NEXT-STAGE ROADMAP (`stacks/PLANNED.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-prd`, `gasly-data`, dan `gasly-ui` ketika pengguna menanyakan fitur atau adapter yang dijadwalkan untuk tahap pengembangan berikutnya.

## Daftar Isi
1. [Status Item `PLANNED` (Dokumentasi Saja — Jangan Diimplementasikan Sebagai Fitur Matang)](#1-status-item-planned-dokumentasi-saja--jangan-diimplementasikan-sebagai-fitur-matang)
2. [Access Profile `P2` (`public-with-accounts` via Supabase Auth)](#2-access-profile-p2-public-with-accounts-via-supabase-auth)
3. [Adapter Penuh Tahap Berikutnya (`react-vite+shadcn` & `nuxtjs+nuxt-ui`)](#3-adapter-penuh-tahap-berikutnya-react-viteshadcn--nuxtjsnuxt-ui)
4. [Ekspor Token Otomatis untuk Stack Native & Desktop](#4-ekspor-token-otomatis-untuk-stack-native--desktop)

---

## 1. Status Item `PLANNED` (Dokumentasi Saja — Jangan Diimplementasikan Sebagai Fitur Matang)

Item yang tercantum di dalam dokumen ini berstatus **`PLANNED` (Direncanakan untuk Tahap Berikutnya)**.
- Agen tidak boleh mengklaim bahwa fitur-fitur di bawah ini sudah tersedia sebagai boilerplate siap pakai di repositori saat ini.
- Apabila pengguna meminta salah satu item di bawah ini, jelaskan statusnya secara transparan dan tawarkan jalur alternatif yang sudah didukung penuh pada tahap ini.

---

## 2. Access Profile `P2` (`public-with-accounts` via Supabase Auth)

- **Tujuan:** Mengizinkan ribuan pengguna publik mendaftar mandiri, melakukan reset kata sandi, dan hanya membaca/mengubah baris data milik mereka sendiri (*row-level ownership*).
- **Mengapa Ditunda ke Tahap Berikutnya:** Google Apps Script dan Google Sheets tidak dirancang sebagai penyedia identitas publik berskala besar (kuota pengiriman email harian terbatas dan latensi Sheet meningkat pada tabel pengguna besar). Rencana tahap berikutnya adalah mengintegrasikan **Supabase Auth** sebagai penyedia identitas eksternal sementara data bisnis tetap disimpan di Google Sheets/Drive.
- **Alternatif Saat Ini (Sudah Didukung di v2.3.0):**
  - Gunakan **`P2-lite`** pada `gasly-data` (`P2_LITE_AUTO_PROVISION = 'TRUE'` di `ScriptProperties` bersama `auth.google` dan tabel `USERS` berklasifikasi `SENSITIVE_PII`) untuk pendaftaran mandiri ber-rate-limit (maks. 10/10 menit) tanpa menguras kuota `MailApp`, dilengkapi pengaturan passphrase/PIN via `auth.setCredentials` dan step-up PIN 6 digit via `auth.verifyPin`.
  - Gunakan **`P3` (`public-plus-admin`)** jika pengunjung publik hanya perlu mengirim formulir/unggah bukti (dengan tiket sekali pakai `file.ticket`) dan melacak status menggunakan `tracking_token`, sementara persetujuan dilakukan oleh Admin.
  - Gunakan **`P4` (`internal-only`)** dengan login multi-user `USERS` (`auth.login`) atau Google ID Token (`auth.google` + sheet `USERS`/`ALLOWLIST`) jika seluruh pengguna adalah anggota tim atau mitra terdaftar.

---

## 3. Adapter Penuh Tahap Berikutnya (`react-vite+shadcn` & `nuxtjs+nuxt-ui`)

1. **`react` (Vite) + `shadcn/ui` (`PLANNED`):**
   - Direncanakan sebagai adapter penuh SPA murni untuk dashboard internal tanpa kebutuhan SSR/ISR.
   - *Solusi Saat Ini:* Gunakan adapter penuh **`nextjs` + `shadcn`** (dapat dijalankan dalam mode statis/CSR maupun SSR) atau **`html-tailwind`**. Jika pengguna tetap memilih Vite + React, gunakan aturan pewarisan di `references/INHERIT.md` bersama modul `gasClient.ts` dan `ImageUploader.tsx` dari `references/nextjs-shadcn.md`.
2. **`nuxtjs` + `nuxt-ui` (`PLANNED`):**
   - Direncanakan sebagai adapter penuh ekosistem Vue/Nuxt dengan dukungan pembacaan publik saat build/SSR.
   - *Solusi Saat Ini:* Gunakan adapter penuh **`astro`** atau **`nextjs` + `shadcn`**, atau bangun di atas Vue/Nuxt menggunakan mode pewarisan `STACK_MODE: INHERIT` (`references/INHERIT.md`).

---

## 4. Ekspor Token Otomatis untuk Stack Native & Desktop

- **Rencana Tahap Berikutnya:** Menambahkan skrip generator yang mengonversi `src/design/presets/*.tokens.json` secara otomatis menjadi file kode tema siap impor untuk SwiftUI (`Color+Gasly.swift`), Jetpack Compose (`Color.kt`), Flutter (`gasly_theme.dart`), dan .NET XAML (`GaslyColors.xaml`).
- **Solusi Saat Ini:** Agen yang membangun pada stack native/desktop dalam mode `INHERIT` membaca langsung nilai hex terverifikasi WCAG AA dari file `src/design/presets/<preset>.tokens.json`.

---
<!-- INSTALL: install-steps.md -->
<!-- KB_VERSION: 2.1.0 -->
# KATALOG LANGKAH INSTALASI & PROVENANCE (`install/install-steps.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-deploy-guide`.

## Daftar Isi
1. [Aturan Struktur Langkah & Provenance (`Gate I-05`)](#1-aturan-struktur-langkah--provenance-gate-i-05)
2. [Katalog Langkah Instalasi Kondisional](#2-katalog-langkah-instalasi-kondisional)
3. [Katalog Troubleshooting Standar](#3-katalog-troubleshooting-standar)

---

## 1. Aturan Struktur Langkah & Provenance (`Gate I-05`)

Setiap langkah di dalam panduan HTML (`<section data-install-step ...>`) wajib mencantumkan 5 atribut dan bagian informasi yang terlihat oleh pengguna:
- `data-step-purpose`: Tujuan langkah tersebut dalam arsitektur proyek.
- `data-step-action`: Aksi konkret yang dilakukan pengguna.
- `data-step-expected`: Hasil yang diharapkan setelah aksi selesai.
- `data-step-source`: Dokumen sumber di repositori (`src/gas/config.md`, `src/core/contract.md`, `src/core/facts.md`, `src/core/monetization-and-tiers.md`) dan/atau URL dokumentasi resmi.
- `data-step-verified`: Tanggal verifikasi (`2026-11-16` untuk fakta kuota/kontrak di `facts.md`) atau `UNVERIFIED` untuk jalur klik menu UI pihak ketiga (sesuai `VERIFY.md` butir `A-12`).

---

## 2. Katalog Langkah Instalasi Kondisional

### Langkah 1 — Persiapan Google Spreadsheet & Proyek Apps Script (`SELALU AKTIF`)
- **Tujuan:** Membuat spreadsheet database utama dan membuka editor Google Apps Script yang terikat (*container-bound*) pada spreadsheet tersebut.
- **Aksi:** Buat Google Spreadsheet baru, salin `{{SPREADSHEET_ID}}` dari URL browser ke form konfigurasi di atas, lalu buka menu **Extensions > Apps Script** (`[UNVERIFIED UI Menu]`). Salin kode `setup.gs` dan `code.gs` ke dalam editor.
- **Hasil yang Diharapkan:** File `.gs` tersimpan di proyek Apps Script tanpa pesan syntax error.
- **Sumber:** `src/core/facts.md`, `VERIFY.md` (`A-12`), & `https://developers.google.com/apps-script/guides/bound`
- **Last Verified:** `UNVERIFIED`

### Langkah 2 — Inisialisasi Skema Database & Rahasia Otomatis (`SELALU AKTIF`)
- **Tujuan:** Membuat seluruh tabel sheet (`DB_SCHEMAS`), mengisi 16 baris data awal (`SEED-`), menyamakan zona waktu spreadsheet, serta membuat `AUTH_HMAC_SECRET`, `AUTH_PEPPER`, dan folder Google Drive secara otomatis.
- **Aksi:** Pada toolbar editor Apps Script, pilih fungsi `initialSetupDatabase` dari dropdown fungsi lalu klik **Run** (`[UNVERIFIED UI Menu]`), dan setujui permintaan izin (*Review Permissions*). Jangan membuat `AUTH_HMAC_SECRET` atau `AUTH_PEPPER` secara manual.
- **Hasil yang Diharapkan:** Log eksekusi menampilkan `{ status: 'success', schemaVersion: '1.1.0' }` dan seluruh tab sheet terbentuk dengan baris header dibekukan (*frozen*).
- **Sumber:** `src/gas/config.md` (Seksi 1 & 2) & `VERIFY.md` (Seksi 5)
- **Last Verified:** `UNVERIFIED`

### Langkah 3 — Konfigurasi `ScriptProperties` & Kredensial Admin Tanpa Plaintext di Kode (`SELALU AKTIF`)
- **Tujuan:** Menyimpan hash passphrase admin ($\ge 12$ karakter) dan hash PIN step-up (6 digit) di `ScriptProperties` tanpa pernah menulis kredensial plaintext di dalam file `.gs`.
- **Aksi:**
  1. Buka **Project Settings (ikon roda gigi) > Script Properties** (`[UNVERIFIED UI Menu]`).
  2. Tambahkan properti sementara `ADMIN_PASSPHRASE_INIT` (isi passphrase minimal 12 karakter) dan `ADMIN_PIN_INIT` (isi 6 digit angka), serta properti sesuai kontrak proyek dari tabel `src/gas/config.md` (`ACCESS_PROFILE`, dan bila relevan `GOOGLE_CLIENT_ID`, `WEBHOOK_SHARED_SECRET`, `P2_LITE_AUTO_PROVISION`, `MAX_UPLOAD_BYTES`).
  3. Kembali ke **Editor**, pilih fungsi publik `setupAdminCredentials` pada dropdown toolbar, lalu klik **Run**.
- **Hasil yang Diharapkan:** `ADMIN_PASSPHRASE_HASH`, `ADMIN_PASSPHRASE_SALT`, `ADMIN_PIN_HASH`, dan `ADMIN_PIN_SALT` tersimpan di `ScriptProperties`, sedangkan properti sementara `ADMIN_PASSPHRASE_INIT` dan `ADMIN_PIN_INIT` otomatis terhapus (termasuk apabila terjadi gagal validasi).
- **Sumber:** `src/gas/config.md` (Tabel `ScriptProperties` & `setupAdminCredentials`) & `https://developers.google.com/apps-script/guides/properties`
- **Last Verified:** `UNVERIFIED`

### Langkah 4 — Deployment Web App (`.../exec`) & Aturan Update Versi Baru (`SELALU AKTIF`)
- **Tujuan:** Menerbitkan endpoint HTTP `/exec` tunggal yang menerima permintaan lintas domain dari aplikasi frontend.
- **Aksi:** Klik **Deploy > New deployment** (`[UNVERIFIED UI Menu]`), pilih jenis **Web app**, atur **Execute as: Me** dan **Who has access: Anyone**, lalu klik **Deploy**. Salin URL `.../exec` yang dihasilkan ke kolom `{{GAS_EXEC_URL}}` pada form konfigurasi panduan ini. Untuk pembaruan kode berikutnya, selalu gunakan **Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy**.
- **Hasil yang Diharapkan:** Diperoleh URL `https://script.google.com/macros/.../exec` yang aktif dan tidak berubah saat kode diperbarui.
- **Sumber:** `src/core/contract.md` (Seksi 7), `src/gas/config.md` (Seksi 3), & `https://developers.google.com/apps-script/guides/web`
- **Last Verified:** `UNVERIFIED`

### Langkah 5 — Konfigurasi Google Sign-In OAuth Client ID (`KONDISIONAL: auth_google_enabled === true`)
- **Tujuan:** Mengaktifkan login Google ID Token (`auth.google`) dan memverifikasi klaim `aud === GOOGLE_CLIENT_ID` di server Apps Script.
- **Aksi:** Di Google Cloud Console (`https://console.cloud.google.com/apis/credentials`, `[UNVERIFIED UI Menu]`), buat **OAuth 2.0 Client ID** bertipe **Web application**, tambahkan domain frontend `{{PAGES_DOMAIN}}` pada **Authorized JavaScript origins**, lalu salin nilai Client ID (`...apps.googleusercontent.com`) ke form `{{GOOGLE_CLIENT_ID}}` dan ke `ScriptProperties` dengan kunci `GOOGLE_CLIENT_ID`.
- **Hasil yang Diharapkan:** Login Google pada aplikasi frontend menghasilkan ID token yang diterima oleh action `auth.google`.
- **Sumber:** `src/core/access-profiles.md` (Seksi 3), `src/core/facts.md` (Seksi 3), & `https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid`
- **Last Verified:** `UNVERIFIED`

### Langkah 6 — Publikasi Halaman Legal `/privacy` & `/terms` (`KONDISIONAL: SAAS_PLATFORM / MARKETPLACE / auth_google_enabled`)
- **Tujuan:** Memenuhi syarat verifikasi Google OAuth Consent Screen (*In Production*) dan kepatuhan layanan komersial/pembayaran.
- **Aksi:** Pastikan rute publik `{{PAGES_DOMAIN}}/privacy` (serta `{{PAGES_DOMAIN}}/terms` untuk aplikasi komersial) dapat diakses tanpa login sebelum mengajukan publikasi OAuth Consent Screen.
- **Hasil yang Diharapkan:** URL kebijakan privasi dapat dibuka publik dengan status HTTP 200.
- **Sumber:** `src/core/monetization-and-tiers.md` (Seksi 4)
- **Last Verified:** `2026-11-16`

### Langkah 7 — Konfigurasi Environment & Deployment Frontend (`SELALU AKTIF`)
- **Tujuan:** Menghubungkan kode frontend dengan URL `/exec` dan men-deploy ke layanan hosting yang sesuai dengan lisensi komersial (`src/core/facts.md`).
- **Aksi:** Salin blok konfigurasi yang telah terisi `{{GAS_EXEC_URL}}` (dan `{{GOOGLE_CLIENT_ID}}` bila aktif) ke file konfigurasi proyek (`src/config.js` untuk `html-tailwind`, `.env.local` dengan `NEXT_PUBLIC_GAS_EXEC_URL` untuk `nextjs+shadcn`, atau `.env` dengan `PUBLIC_GAS_EXEC_URL` untuk `astro`), bangun aset produksi, lalu unggah/deploy ke target hosting (`cloudflare_pages` sebagai default komersial gratis; `github_pages_demo` / `vercel_hobby_noncommercial` khusus non-komersial; `vercel_pro` untuk SSR komersial).
- **Hasil yang Diharapkan:** Aplikasi frontend tayang di `{{PAGES_DOMAIN}}` dengan mode simulasi/demo otomatis nonaktif (`Gate W-09`).
- **Sumber:** `src/core/facts.md` (Seksi 2) & `src/stacks/html-tailwind.md` / `nextjs-shadcn.md` / `astro.md`
- **Last Verified:** `2026-11-16`

### Langkah 8 — Konfigurasi Edge Relay / Webhook Proxy (`KONDISIONAL: TIER_2_EDGE_GATEWAY / TIER_3_HYBRID_SAAS`)
- **Tujuan:** Meneruskan webhook pihak ketiga (yang menolak HTTP 302 GAS) ke endpoint `/exec` menggunakan `WEBHOOK_SHARED_SECRET` di dalam body JSON.
- **Aksi:** Buat secret acak menggunakan tombol generator lokal di panduan ini, simpan ke `ScriptProperties` (`WEBHOOK_SHARED_SECRET`) dan environment worker Edge, lalu deploy fungsi relay yang memverifikasi signature penyedia dan meneruskan request `POST` (`Content-Type: text/plain;charset=utf-8`, `redirect: "follow"`) ke `{{GAS_EXEC_URL}}`.
- **Hasil yang Diharapkan:** Webhook eksternal diterima oleh action `webhook.receive` dengan deduplikasi `providerEventId`.
- **Sumber:** `src/core/contract.md` (Seksi 1 & 8) & `src/gas/webhook-receiver.md`
- **Last Verified:** `2026-11-16`

### Langkah 9 — Diagnostik & Uji Koneksi End-to-End (`SELALU AKTIF`)
- **Tujuan:** Memastikan skema Sheet sehat dan endpoint `/exec` merespons dengan Response Envelope Kanonik (`status: "success" | "error"`).
- **Aksi:** Jalankan `runDiagnostics()` dari editor Apps Script (`ok: true`), lalu salin dan jalankan perintah `curl` atau snippet Console di bawah ini dari terminal/browser Anda.
- **Hasil yang Diharapkan:** Server mengembalikan JSON `{ "status": "success", "code": "OK", ... }` (atau `"FORBIDDEN"` pada profil `P4` sebelum menyertakan token sesi).
- **Sumber:** `src/core/contract.md` (Seksi 2 & 4) & `src/gas/sheets-repository.md`
- **Last Verified:** `2026-11-16`

---

## 3. Katalog Troubleshooting Standar

1. **Respons `HTTP 302 Moved Temporarily` saat memanggil `/exec`:**
   - *Penyebab & Solusi:* Perilaku normal Google Apps Script yang mengalihkan respons ke `script.googleusercontent.com` (`src/core/facts.md`, terverifikasi `2026-11-16`). Gunakan `curl -L` di terminal atau `redirect: "follow"` pada `fetch`.
2. **Error CORS / Preflight `OPTIONS` Ditolak:**
   - *Penyebab & Solusi:* Mengirim header `Content-Type: application/json` atau header `Authorization` memicu preflight `OPTIONS` yang tidak didukung GAS (`src/core/contract.md`, terverifikasi `2026-11-16`). Wajib gunakan `POST` dengan `Content-Type: text/plain;charset=utf-8` dan letakkan `auth` serta `idem` di dalam body JSON.
3. **Muncul HTML `"Authorization required"` / Halaman Login Google:**
   - *Penyebab & Solusi:* Deployment Web App belum disetel ke **Execute as: Me** dan **Who has access: Anyone** (`src/gas/config.md` Seksi 3, status UI: `UNVERIFIED`).
4. **Batas Kuota Eksekusi & Email (`MailApp`):**
   - *Penyebab & Solusi:* Runtime GAS dibatasi 6 menit/eksekusi, 30 eksekusi simultan, dan kuota email 100 penerima/hari (akun `@gmail.com`) atau 1.500 penerima/hari (Workspace) (`src/core/facts.md`, terverifikasi `2026-11-16`).
5. **Perubahan Kode `.gs` Tidak Terlihat atau URL `/exec` Berubah:**
   - *Penyebab & Solusi:* Membuat deployment baru menghasilkan `<DEPLOYMENT_ID>` baru. Gunakan **Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy** agar kode terbarui tanpa mengubah URL `/exec` (`src/gas/config.md` Seksi 3, status UI: `UNVERIFIED`).