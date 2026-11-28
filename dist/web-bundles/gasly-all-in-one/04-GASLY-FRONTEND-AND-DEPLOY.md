# 04 — GASLY FRONTEND ADAPTERS & DEPLOY GUIDE (v2.5.0)

---
name: gasly-ui
description: >
  Gunakan skill ini ketika pengguna meminta pembuatan atau revisi kode frontend eksternal yang terhubung ke satu URL Google Apps Script Web App (.../exec) melalui HTTP POST text/plain. Skill ini membaca kontrak GASLY_CONTRACT_JSON dan berfokus pada 2 adapter penuh teruji: html-tailwind dan react (Vite + TypeScript + Tailwind), lengkap dengan gasClient, ImageUploader ber-uploadNonce, Step-Up PIN modal, penanganan Drive private vs public, media placeholder stock aman (Unsplash/Pexels/Pixabay sesuai Gate W-10), 4 preset visual, dan 3 dials karakter desain. JANGAN gunakan skill ini untuk menulis kode backend Google Apps Script (arahkan ke gasly-data), untuk perencanaan awal (arahkan ke gasly-prd), atau untuk mode legacy HtmlService di dalam Google Apps Script (arahkan ke gasly-pro).
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
  - **Sinkronisasi Spec-ke-UI (`Gate U-11`):** Setiap `action` pada `GASLY_CONTRACT_JSON` yang bertanda `ui_bound: true` wajib memiliki komponen pemicu nyata di UI. Apabila spesifikasi mengaktifkan `auth.google` (`auth_google_enabled: true`), frontend **wajib** merender tombol/alur Sign in with Google yang memanggil `auth.google` dengan payload `{ idToken }` (camelCase, sesuai kontrak `handleAuthGoogle_`).
   - **Isolasi Demo (`Gate W-09`):** Tombol pengisi demo dan pengubah URL `/exec` runtime hanya boleh tampil saat `isSimulationMode() === true` (URL produksi kosong).

3. **Gerbang Upload Terikat Nonce, Verifikasi Status & Privasi Gambar Drive (`G-09`, `U-10`, `U-11`, `W-08`, `W-09`):**
   - Komponen `ImageUploader` wajib memvalidasi tipe (`image/jpeg`, `image/png`, `image/webp`), mengompres via `<canvas>` ke `~<= 1 MB` (maks. 1600px), dan menampilkan 5 state aksesibel: `idle`, `compressing`, `uploading`, `error`, `done`.
   - **Kontrak Nonce Publik:** Saat mengunggah tanpa sesi login (`P3`), kirim `{ entity, entityId, uploadNonce }` (yang diterima sekali dari respons `items.create`) ke `file.ticket` sebelum memanggil `file.upload`.
   - **Verifikasi Hasil Upload (`Gate U-11` & `W-09`):** Simpan respons `file.upload` ke variabel (`const uploadRes = await ...`) dan pastikan `uploadRes.status === 'success' && uploadRes.code === 'OK'` sebelum menampilkan sukses; bila gagal, tampilkan state `RECOVERY` untuk unggah ulang tanpa duplikasi record.
   - **Gambar Drive `public` vs `private` (`Gate U-10` & `W-08`):** Entitas `PUBLIC` memakai helper tunggal `driveImageUrl(fileId, width)` dengan fallback `lh3.googleusercontent.com/d/<fileId>=w<width>`, `referrerpolicy="no-referrer" loading="lazy"`. Entitas `CONFIDENTIAL`/`SENSITIVE_PII` (`private`) menampilkan tombol buka aman ke `file_url` bagi Admin terautentikasi.

4. **Gerbang Surface Profile, Desain, WCAG AA & Slot Regulasi (`U-03`, `U-05`, `U-06`, `U-08`, `U-09`, `U-12`, `W-01` s/d `W-07`):**
   - `INTERNAL_APP` langsung ke Login/Workspace; `PUBLIC_SERVICE` memisahkan layanan publik & panel petugas; `MARKETPLACE`/`SAAS_PLATFORM` memisahkan rute `/` dan `/app`.
   - Jangan jadikan `aura` default otomatis. Terapkan preset + 3 dials, gunakan token *soft semantic badges* (`--success-soft-bg`/`--success-soft-text`, dll.) untuk status tabel, dan jaga kontras WCAG AA (`>= 4,5:1`).
   - Patuhi larangan klaim karangan (`U-03`), cantumkan dasar peraturan + tanggal verifikasi + *disclaimer* estimasi pada fitur kalkulator pajak/medis/hukum (`U-12`), target sentuh `>= 40px` (`U-06`), 6-state machine lengkap (`U-08`), modal kustom tanpa `window.confirm()` (`W-01`), `<label for>` eksplisit (`W-02`), `:focus-visible` + `Escape` (`W-03`), `prefers-reduced-motion` (`W-04`), viewport tanpa `user-scalable=no` (`W-05`), `.tabular-nums` (`W-06`), `escapeHtml()` (`W-07`), serta kebijakan media placeholder foto/video dummy dari Unsplash/Pexels/Pixabay/Coverr ber-fallback SVG & bebas `source.unsplash.com` (`W-10`).

5. **Aturan Spesifik Stack, Media Placeholder & Bundling Canvas:**
   - **`html-tailwind`:** Nyatakan *Tailwind Play CDN* hanya untuk prototipe dan sediakan konfigurasi kompilasi CSS ke `dist/styles.css` untuk produksi.
   - **`react` (Vite):** Gunakan `VITE_GAS_EXEC_URL`, kirim seluruh aksi baca/tulis melalui `gasClient.ts`, dan bangun output statis `dist/` untuk Cloudflare Pages / Sevalla / Netlify / Firebase Hosting / Vercel.
   - **Media Placeholder Dummy (`Gate W-10`):** Kumpulkan URL foto/video stock (Unsplash/Pexels/Pixabay/Coverr) di registry `MEDIA_PLACEHOLDERS` dengan `isPlaceholder: true`, fallback SVG `onerror`, serta `muted loop playsinline poster` yang menghormati `prefers-reduced-motion`. Aset AI (seperti Magnific AI) disimpan di `public/assets/` atau Drive `PUBLIC`, bukan *hotlink* URL sementara.
   - **Mode Simulasi Lokal (`Preview Mode`):** Ketika variabel URL `/exec` kosong, jalankan simulasi di memori dengan 16 baris `SEED-` yang identik dengan skema backend.
   - **Bundling Satu File untuk Canvas (`index.html`):** Apabila pengguna meminta pembungkusan frontend ke satu file `index.html` agar tampil di Canvas, pertahankan seluruh gerbang `W-01` s/d `W-10` tanpa pengurangan kualitas.

---

## Mode Audit (Read-Only)
Jika menerima status `AUDIT_READ_ONLY`, hanya inspeksi frontend, adapter, dan UI states; jangan membuat atau mengedit file. Kembalikan evidence dan temuan sesuai `references/contract.md` bagian 10, lalu **STOP** menunggu ID yang dipilih.

## 2. PEMUATAN REFERENSI (ROUTING TABLE)

| File Referensi | Kondisi Muat | Kapan Dibuka & Digunakan |
| :--- | :--- | :--- |
| `references/voice-and-brevity.md` | **Selalu Dimuat** | Menjaga gaya penjelasan singkat, mentor profesional, dan to-the-point. |
| `references/contract.md` & `references/access-profiles.md` | **Selalu Dimuat** | Paritas payload `gasClient`, envelope `status: 'success' \| 'error'`, dan alur auth. |
| `references/gates.md` | **Selalu Dimuat** | Memeriksa kepatuhan gerbang `UNIVERSAL` (`U-01`–`U-12`) dan `WEB-ONLY` (`W-01`–`W-10`). |
| `references/presets.md` & `references/dials.md` | **Selalu Dimuat** | Menerapkan karakter visual preset dan menerjemahkan nilai 3 dials (1–10) ke layout/motion/density. |
| `references/saas-craft.md` | **Selalu Dimuat** | Standar visual SaaS $49/bulan: App Shell + Slide-Over Drawer form, Bento KPI live, ikon inline SVG (nol emoji), toolbar filter/pill, Mobile Card View, dan Sonner toast. |
| `references/presets/<preset>.tokens.json` & `references/css/<preset>.css` | **Sesuai Preset Terpilih** | Mengambil variabel CSS dan pasangan warna terverifikasi WCAG AA untuk preset aktif. |
| `references/html-tailwind.md` | **Kondisional (`html-tailwind`)** | Buka saat membangun dengan HTML + Tailwind (Play CDN untuk prototipe vs jalur CSS CLI untuk produksi). |
| `references/react-vite.md` | **Kondisional (`react`)** | Buka saat membangun aplikasi SPA React + Vite + TypeScript + Tailwind siap deploy statis. |

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
1. **Selalu Aktif (Tema Soft Neo-Brutalist, Alur 3 Fase & Shortcut Hyperlink):**
   - **Estetika Wajib:** Gunakan desain **Soft Neo-Brutalist yang minimalist, soft, dan clean** dari `references/guide-template.html` (kanvas `#F7F5F0`, border tegas `2px solid #1E293B`, offset shadow halus `4px 4px 0`, aksen pastel WCAG AA `#A7F3D0` / `#BAE6FD` / `#FDE68A` / `#DDD6FE` berteks gelap `#0F172A`, dukungan dark mode & `prefers-reduced-motion`).
   - **Tombol Shortcut Hyperlink:** Selalu sediakan tombol pintas `<a target="_blank" rel="noopener noreferrer">` untuk meringankan pengguna (`https://script.new`, `https://github.com/new`, `https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages`, `https://app.netlify.com/start`, `https://vercel.com/new`, `https://app.sevalla.com/`, `https://console.firebase.google.com/`).
   - **Urutan Alur Deploy End-to-End:**
     1) **Fase 1 (Backend GAS Standalone):** Buka `script.new` $\rightarrow$ tempel `setup.gs` & `code.gs` $\rightarrow$ klik **Run `setupAppEnvironment()`** (otomatis membuat Spreadsheet, Folder Drive, tabel, seed, `AUTH_HMAC_SECRET`, & `AUTH_PEPPER`) $\rightarrow$ setel `ADMIN_PASSPHRASE_INIT` & `ADMIN_PIN_INIT` lalu Run `setupAppEnvironment()` lagi $\rightarrow$ Deploy Web App `/exec`.
     2) **Fase 2 (GitHub Repository):** Buka `github.com/new` $\rightarrow$ buat repo baru $\rightarrow$ unggah seluruh file frontend ke branch `main`.
     3) **Fase 3 (Import Repo GitHub ke Hosting):** Import repo GitHub ke hosting target (**Cloudflare Pages** / **Netlify** / **Sevalla** / **Vercel** / **Firebase Hosting** / **GitHub Pages**) beserta Build Command, Output Dir, dan Environment Variable `VITE_GAS_EXEC_URL` / `src/config.js`.
     4) **Fase 4 (Verifikasi & Go-Live):** Uji endpoint `/exec` via Multi-OS Test Switcher (`data-template` di luar `<script>`) dan cantumkan prosedur Zero-Downtime Update (`Manage deployments > Edit > New version`).
2. **Kondisional Berdasarkan `architecture.auth_google_enabled` & `access_profile`:**
   - Jika `auth_google_enabled === true`: sertakan langkah pembuatan Google Cloud OAuth 2.0 Web Client ID, pengisian `GOOGLE_CLIENT_ID` di `ScriptProperties`, dan bila menggunakan `P2-lite` sertakan opsi `P2_LITE_AUTO_PROVISION`.
3. **Kondisional Berdasarkan Integrasi & Entitas:**
   - Hanya tampilkan properti tambahan yang relevan dari tabel `references/config.md` (mis. `WEBHOOK_SHARED_SECRET` jika ada `webhook.receive`, `MAX_UPLOAD_BYTES` & `DRIVE_ROOT_FOLDER_ID` jika ada entitas dengan `drive_upload.enabled === true`).
4. **Kondisional Berdasarkan `surface_profile` / Monetisasi:**
   - Jika `surface_profile` adalah `SAAS_PLATFORM` atau `MARKETPLACE`, atau `auth_google_enabled === true`: wajibkan langkah publikasi halaman `/privacy` (dan `/terms` untuk layanan berbayar) sesuai `references/monetization-and-tiers.md`.
5. **Kondisional Berdasarkan `architecture.tier` & `hosting_target`:**
   - Sesuaikan perintah build & variabel environment (`VITE_GAS_EXEC_URL` untuk `react` atau `window.GASLY_CONFIG.EXEC_URL` untuk `html-tailwind`) dengan `frontend_stack` dan `hosting_target` (`cloudflare_pages`, `sevalla`, `netlify`, `firebase_hosting`, `vercel_pro`, `vercel_hobby_noncommercial`, atau `github_pages_demo`).
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
1. [Struktur File, Konvensi URL `/exec` & Target Hosting](#1-struktur-file-konvensi-url-exec--target-hosting)
2. [Perbedaan Prototipe (Play CDN) vs Produksi (Compiled CSS)](#2-perbedaan-prototipe-play-cdn-vs-produksi-compiled-css)
3. [Trade-off Penyimpanan Token Sesi Admin](#3-trade-off-penyimpanan-token-sesi-admin)
4. [Kode Lengkap `src/config.js` & `src/gasClient.js`](#4-kode-lengkap-srcconfigjs--srcgasclientjs)
5. [Kode Lengkap `src/imageUploader.js` & `src/mediaPlaceholders.js`](#5-kode-lengkap-srcimageuploaderjs--srcmediaplaceholdersjs)
6. [Kode Lengkap `index.html` (State Machine, `uploadNonce`, Step-Up PIN & Media Placeholder)](#6-kode-lengkap-indexhtml-state-machine-uploadnonce-step-up-pin--media-placeholder)

---

## 1. Struktur File, Konvensi URL `/exec` & Target Hosting

```text
project-html-tailwind/
├── index.html                  # Halaman utama aplikasi (semantic HTML5)
├── package.json                # Skrip build Tailwind CLI untuk produksi
├── src/
│   ├── input.css               # Mengimpor preset CSS (mis. warm-friendly.css / dense-dashboard.css) + Tailwind
│   ├── config.js               # Satu-satunya tempat konfigurasi URL /exec publik
│   ├── gasClient.js            # Klien HTTP text/plain POST, retry idempoten, auth.google & step-up PIN
│   ├── imageUploader.js        # Kompresi <canvas> ~1 MB, file.ticket ber-uploadNonce & driveImageUrl
│   └── mediaPlaceholders.js    # Registry foto/video dummy (Unsplash/Pexels/Pixabay) + fallback SVG
└── dist/
    └── styles.css              # Hasil kompilasi CSS untuk produksi
```

- **Konvensi Konfigurasi:** Seluruh komunikasi merujuk ke satu objek global `window.GASLY_CONFIG.EXEC_URL` di dalam `src/config.js`. URL ini bersifat publik; tidak boleh ada secret atau kunci API di dalamnya.
- **Target Hosting Statis (`src/core/facts.md`):**
  - **Produksi Komersial:** **Cloudflare Pages** (default gratis komersial), **Sevalla Static Sites** (komersial gratis s/d kuota), **Netlify** (komersial, pantau kuota kredit), **Firebase Hosting** (komersial Spark/Blaze), atau **Vercel Pro** (berbayar).
  - **Demo / Personal Non-Komersial Saja:** **GitHub Pages** atau **Vercel Hobby**.

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

File `src/input.css` menggabungkan variabel preset dengan utilitas Tailwind:
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
  GOOGLE_CLIENT_ID: '',
  ENTITY_IS_PRIVATE: true, // Gate U-10: wajib true untuk entitas CONFIDENTIAL / SENSITIVE_PII
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
    var bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += ('0' + bytes[i].toString(16)).slice(-2);
    }
    return (
      hex.slice(0, 8) + '-' +
      hex.slice(8, 12) + '-' +
      hex.slice(12, 16) + '-' +
      hex.slice(16, 20) + '-' +
      hex.slice(20)
    );
  }

  /**
   * Gate W-09: Demo helper controls are ONLY active when EXEC_URL is unset/placeholder.
   */
  function isSimulationMode() {
    var cfg = global.GASLY_CONFIG || {};
    var url = String(cfg.EXEC_URL || '').trim();
    return !url || url.indexOf('REPLACE_WITH_DEPLOYMENT_ID') !== -1;
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

        if (envelope.code === 'FORBIDDEN' && action.indexOf('auth.') !== 0) {
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
    if (env.status === 'success' && env.code === 'OK' && env.data && env.data.token) {
      setSessionToken(env.data.token, env.data.role, Boolean(persistInTab));
    }
    return env;
  }

  /**
   * Matches backend handleAuthGoogle_ contract: payload key MUST be `idToken` (camelCase).
   */
  async function loginWithGoogleIdToken(idToken, persistInTab) {
    var env = await request(
      'auth.google',
      { idToken: idToken },
      { idempotent: false, maxRetries: 0 }
    );
    if (env.status === 'success' && env.code === 'OK' && env.data && env.data.token) {
      setSessionToken(env.data.token, env.data.role, Boolean(persistInTab));
    }
    return env;
  }

  async function verifyStepUpPin(pin, targetAction) {
    return request(
      'auth.verifyPin',
      { pin: String(pin || '').trim(), targetAction: targetAction },
      { idempotent: false, maxRetries: 0 }
    );
  }

  async function logout() {
    var env = await request('auth.logout', {}, { idempotent: false, maxRetries: 0 });
    clearSession();
    return env;
  }

  global.GaslyClient = {
    request: request,
    isSimulationMode: isSimulationMode,
    loginWithPassphrase: loginWithPassphrase,
    loginWithGoogleIdToken: loginWithGoogleIdToken,
    verifyStepUpPin: verifyStepUpPin,
    logout: logout,
    getSessionToken: getSessionToken,
    clearSession: clearSession,
    generateUuidV4: generateUuidV4_
  };
})(window);
```

---

## 5. Kode Lengkap `src/imageUploader.js` & `src/mediaPlaceholders.js`

```javascript
// FILE: src/imageUploader.js
(function(global) {
  'use strict';

  var ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
  var TARGET_MAX_BYTES = 1024 * 1024; // ~1 MB client compression target
  var MAX_DIMENSION_PX = 1600;

  /**
   * Single helper for rendering PUBLIC Google Drive images (Gate W-08).
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
        if (!uploadNonce) {
          onStateChange('error', 'uploadNonce dari items.create wajib tersedia untuk unggahan publik.');
          return { status: 'error', code: 'VALIDATION_ERROR', message: 'uploadNonce tidak tersedia.' };
        }
        var ticketRes = await global.GaslyClient.request(
          'file.ticket',
          { entity: entity, entityId: entityId, uploadNonce: uploadNonce },
          { idempotent: false, maxRetries: 0 }
        );
        if (ticketRes.status !== 'success' || ticketRes.code !== 'OK' || !ticketRes.data || !ticketRes.data.ticket) {
          onStateChange('error', ticketRes.message || 'Gagal memperoleh tiket unggah.');
          return ticketRes;
        }
        ticket = ticketRes.data.ticket;
      }

      // Gate W-09: Simpan hasil file.upload ke variabel & verifikasi status + code secara ketat
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

```javascript
// FILE: src/mediaPlaceholders.js
// Gate W-10: External Stock Media Placeholder Registry (Unsplash / Pexels / Pixabay / Coverr)
(function(global) {
  'use strict';

  var MEDIA_PLACEHOLDERS = {
    heroCover: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
      alt: 'Ilustrasi ruang operasional bisnis (gambar contoh)',
      source: 'Unsplash (Placeholder)',
      isPlaceholder: true
    },
    ambientShowcaseVideo: {
      type: 'video',
      url: 'https://videos.pexels.com/video-files/3129671/3129671-sd_640_360_30fps.mp4',
      poster: 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1200',
      alt: 'Video ilustrasi kolaborasi tim (video contoh)',
      source: 'Pexels Videos (Placeholder)',
      isPlaceholder: true
    }
  };

  function createSvgFallbackDataUri(label) {
    var safe = String(label || 'Gambar Contoh').replace(/[<>&"']/g, '').slice(0, 48);
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">' +
      '<rect width="100%" height="100%" fill="#E2E8F0"/>' +
      '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ' +
      'font-family="sans-serif" font-size="22" fill="#475569">' + safe + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function shouldAutoplayVideo() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  global.GaslyMedia = {
    PLACEHOLDERS: MEDIA_PLACEHOLDERS,
    createSvgFallbackDataUri: createSvgFallbackDataUri,
    shouldAutoplayVideo: shouldAutoplayVideo
  };
})(window);
```

---

## 6. Kode Lengkap `index.html` (State Machine, `uploadNonce`, Step-Up PIN & Media Placeholder)

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
    <!-- Banner Visual Placeholder (Gate W-10) -->
    <section style="background-color: var(--bg-surface); border: 1px solid var(--border-subtle);" class="rounded-xl overflow-hidden">
      <div class="h-36 w-full relative overflow-hidden">
        <img id="hero-placeholder-img" alt="Ilustrasi ruang operasional bisnis (gambar contoh)" loading="lazy" decoding="async"
          class="w-full h-full object-cover">
      </div>
    </section>

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
          <button id="btn-retry-upload" type="button" onclick="window.appRetryFailedUpload()"
            style="background-color: var(--warning-solid); color: var(--warning-text-on-solid);"
            class="hidden mt-2 min-h-[40px] px-3 py-1 rounded-lg text-xs font-semibold">
            Unggah Ulang Foto Saja
          </button>
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

  <!-- Modal Konfirmasi Destruktif + Step-Up PIN 6 Digit (Gate W-01 & Step-Up) -->
  <div id="modal-delete-pin" role="dialog" aria-modal="true" aria-labelledby="modal-del-title"
    class="fixed inset-0 z-40 hidden items-center justify-center bg-black/60 p-4"
    onclick="if(event.target === this) window.appCloseModal('modal-delete-pin')">
    <div style="background-color: var(--bg-surface); border: 1px solid var(--border-subtle);" class="w-full max-w-md rounded-xl p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 id="modal-del-title" class="text-lg font-bold">Konfirmasi Arsipkan Data</h2>
        <button type="button" aria-label="Tutup modal konfirmasi" onclick="window.appCloseModal('modal-delete-pin')" class="min-w-[40px] min-h-[40px] text-lg">&times;</button>
      </div>
      <p id="delete-target-desc" style="color: var(--text-secondary);" class="text-sm"></p>
      <form onsubmit="window.appConfirmDeleteWithPin(event)" class="space-y-4">
        <div>
          <label for="delete-stepup-pin" style="color: var(--text-secondary);" class="block text-xs font-semibold mb-1">PIN Step-Up Admin (6 Digit) *</label>
          <input id="delete-stepup-pin" type="password" inputmode="numeric" pattern="\d{6}" maxlength="6" required
            style="background-color: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle);"
            class="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm font-mono tracking-widest">
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" onclick="window.appCloseModal('modal-delete-pin')"
            style="background-color: var(--bg-interactive); color: var(--text-primary);"
            class="min-h-[42px] px-4 py-2 rounded-lg text-sm">Batal</button>
          <button id="btn-delete-submit" type="submit"
            style="background-color: var(--danger-solid); color: var(--danger-text-on-solid);"
            class="min-h-[42px] px-4 py-2 rounded-lg text-sm font-semibold">Ya, Arsipkan</button>
        </div>
      </form>
    </div>
  </div>

  <script src="./src/config.js"></script>
  <script src="./src/gasClient.js"></script>
  <script src="./src/imageUploader.js"></script>
  <script src="./src/mediaPlaceholders.js"></script>
  <script>
    (function() {
      var IDR_FMT = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
      var isSubmitting_ = false;
      var failedUploadContext_ = null;
      var pendingDeleteItem_ = null;

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
        if (e.key === 'Escape') {
          window.appCloseModal('modal-login');
          window.appCloseModal('modal-delete-pin');
        }
      });

      window.appOpenDeleteModal = function(id, updatedAt, title) {
        pendingDeleteItem_ = { id: id, updated_at: updatedAt, title: title };
        document.getElementById('delete-target-desc').textContent =
          'Masukkan PIN 6 digit untuk mengarsipkan "' + title + '" (' + id + ').';
        document.getElementById('delete-stepup-pin').value = '';
        window.appOpenModal('modal-delete-pin');
      };

      window.appConfirmDeleteWithPin = async function(ev) {
        ev.preventDefault();
        if (!pendingDeleteItem_) return;
        var pinInput = document.getElementById('delete-stepup-pin');
        var btn = document.getElementById('btn-delete-submit');
        btn.disabled = true;
        btn.textContent = 'Memverifikasi...';
        try {
          var pinRes = await window.GaslyClient.verifyStepUpPin(pinInput.value, 'items.delete');
          if (pinRes.status !== 'success' || pinRes.code !== 'OK' || !pinRes.data || !pinRes.data.stepUpToken) {
            window.appShowToast(pinRes.message || 'Verifikasi PIN gagal.', 'error');
            return;
          }
          var delRes = await window.GaslyClient.request('items.delete', {
            id: pendingDeleteItem_.id,
            expected_updated_at: pendingDeleteItem_.updated_at,
            stepUpToken: pinRes.data.stepUpToken
          });
          if (delRes.status === 'success' && delRes.code === 'OK') {
            window.appCloseModal('modal-delete-pin');
            window.appShowToast('Data berhasil diarsipkan.', 'success');
            await window.appLoadItems();
          } else {
            window.appShowToast(delRes.message || 'Gagal mengarsipkan data.', 'error');
          }
        } finally {
          btn.disabled = false;
          btn.textContent = 'Ya, Arsipkan';
        }
      };

      window.appLoadItems = async function() {
        var vp = document.getElementById('table-viewport');
        vp.innerHTML = '<div class="animate-pulse space-y-2"><div class="h-10 rounded" style="background-color:var(--bg-interactive)"></div><div class="h-10 rounded" style="background-color:var(--bg-interactive)"></div></div>';
        var res = await window.GaslyClient.request('items.list', {});
        if (res.status !== 'success' || res.code !== 'OK') {
          vp.innerHTML = '<div class="p-6 text-center space-y-3"><p class="text-sm">' + escapeHtml(res.message) + '</p>' +
            '<button type="button" onclick="window.appLoadItems()" style="background-color:var(--accent-solid);color:var(--accent-text-on-solid);" class="min-h-[42px] px-4 py-2 rounded-lg text-xs font-semibold">Coba Lagi</button></div>';
          return;
        }
        var items = (res.data && res.data.items) || [];
        var isPrivate = Boolean(window.GASLY_CONFIG && window.GASLY_CONFIG.ENTITY_IS_PRIVATE);
        var hasSession = Boolean(window.GaslyClient.getSessionToken());
        document.getElementById('items-count').textContent = items.length + ' baris';
        if (items.length === 0) {
          vp.innerHTML = '<div class="p-8 text-center text-sm" style="color:var(--text-helper)">Belum ada transaksi tercatat. Gunakan formulir di atas untuk membuat transaksi pertama.</div>';
          return;
        }
        var rowsHtml = items.map(function(it) {
          var imgCell = '<span style="color:var(--text-helper)" class="text-xs">-</span>';
          if (it.file_id) {
            if (isPrivate) {
              var safeUrl = it.file_url || ('https://drive.google.com/file/d/' + encodeURIComponent(it.file_id) + '/view');
              imgCell = '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer" style="color:var(--border-focus)" class="text-xs font-semibold underline">Dokumen Privat (Drive)</a>';
            } else {
              imgCell = '<img src="' + escapeHtml(window.GaslyImage.driveImageUrl(it.file_id, 160)) + '" ' +
                'onerror="window.GaslyImage.handleDriveImageError(this, \'' + escapeHtml(it.file_id) + '\', 160)" ' +
                'referrerpolicy="no-referrer" loading="lazy" alt="Foto ' + escapeHtml(it.title) + '" class="w-12 h-12 object-cover rounded">';
            }
          }
          var actionCell = hasSession
            ? '<button type="button" onclick="window.appOpenDeleteModal(\'' + escapeHtml(it.id) + '\',\'' + escapeHtml(it.updated_at) + '\',\'' + escapeHtml(it.title) + '\')" style="background-color:var(--danger-solid);color:var(--danger-text-on-solid);" class="min-h-[40px] px-3 py-1 rounded-lg text-xs font-semibold">Arsipkan</button>'
            : '<span style="color:var(--text-helper)" class="text-xs">-</span>';
          return '<tr style="border-bottom:1px solid var(--border-subtle)">' +
            '<td class="py-3 px-2 text-xs font-mono">' + escapeHtml(it.id) + '</td>' +
            '<td class="py-3 px-2 text-sm font-medium">' + escapeHtml(it.title) + '</td>' +
            '<td class="py-3 px-2 text-xs">' + escapeHtml(it.category) + '</td>' +
            '<td class="py-3 px-2 text-sm text-right tabular-nums font-semibold">' + escapeHtml(formatCurrency(it.amount)) + '</td>' +
            '<td class="py-3 px-2">' + imgCell + '</td>' +
            '<td class="py-3 px-2 text-right">' + actionCell + '</td>' +
            '</tr>';
        }).join('');
        vp.innerHTML = '<table class="w-full text-left border-collapse"><thead><tr style="color:var(--text-helper);border-bottom:1px solid var(--border-subtle)" class="text-xs uppercase">' +
          '<th class="py-2 px-2">ID</th><th class="py-2 px-2">Judul</th><th class="py-2 px-2">Kategori</th><th class="py-2 px-2 text-right">Nominal</th><th class="py-2 px-2">Bukti</th><th class="py-2 px-2 text-right">Aksi</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>';
      };

      window.appRetryFailedUpload = async function() {
        if (!failedUploadContext_) return;
        var statusEl = document.getElementById('upload-status-text');
        var retryBtn = document.getElementById('btn-retry-upload');
        retryBtn.classList.add('hidden');
        var upRes = await window.GaslyImage.uploadPhoto({
          file: failedUploadContext_.file,
          entity: 'ITEMS',
          entityId: failedUploadContext_.entityId,
          uploadNonce: failedUploadContext_.uploadNonce,
          onStateChange: function(st, msg) {
            statusEl.textContent = 'Status foto: ' + msg + ' (' + st + ')';
          }
        });
        if (upRes && upRes.status === 'success' && upRes.code === 'OK') {
          failedUploadContext_ = null;
          window.appShowToast('Foto bukti berhasil diunggah ulang.', 'success');
          await window.appLoadItems();
        } else {
          retryBtn.classList.remove('hidden');
          window.appShowToast('Unggah ulang foto gagal: ' + ((upRes && upRes.message) || ''), 'error');
        }
      };

      window.appSubmitItem = async function(ev) {
        ev.preventDefault();
        if (isSubmitting_) return;
        isSubmitting_ = true;
        var btn = document.getElementById('btn-submit-item');
        var statusEl = document.getElementById('upload-status-text');
        var retryBtn = document.getElementById('btn-retry-upload');
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
        retryBtn.classList.add('hidden');

        try {
          var form = ev.target;
          var createRes = await window.GaslyClient.request('items.create', {
            title: form.title.value,
            category: form.category.value,
            amount: Number(form.amount.value),
            status: 'ACTIVE'
          });

          if (createRes.status !== 'success' || createRes.code !== 'OK') {
            window.appShowToast(createRes.message || 'Gagal menyimpan data.', 'error');
            return;
          }

          var createdItem = createRes.data && createRes.data.item;
          var uploadNonce = createRes.data && createRes.data.uploadNonce;
          var photoFile = form.photo.files && form.photo.files[0];

          if (photoFile && createdItem && createdItem.id) {
            var upRes = await window.GaslyImage.uploadPhoto({
              file: photoFile,
              entity: 'ITEMS',
              entityId: createdItem.id,
              uploadNonce: uploadNonce,
              onStateChange: function(st, msg) {
                statusEl.textContent = 'Status foto: ' + msg + ' (' + st + ')';
              }
            });
            if (!upRes || upRes.status !== 'success' || upRes.code !== 'OK') {
              failedUploadContext_ = { file: photoFile, entityId: createdItem.id, uploadNonce: uploadNonce };
              retryBtn.classList.remove('hidden');
              window.appShowToast('Data tersimpan, namun unggah foto gagal. Gunakan tombol "Unggah Ulang Foto Saja".', 'error');
              await window.appLoadItems();
              return;
            }
          }

          form.reset();
          failedUploadContext_ = null;
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
          if (res.status === 'success' && res.code === 'OK') {
            passInput.value = '';
            window.appCloseModal('modal-login');
            window.appShowToast('Login Admin berhasil.', 'success');
            await window.appLoadItems();
          } else {
            window.appShowToast(res.message || 'Login gagal.', 'error');
          }
        } finally {
          btn.disabled = false;
          btn.textContent = 'Masuk';
        }
      };

      document.addEventListener('DOMContentLoaded', function() {
        var heroImg = document.getElementById('hero-placeholder-img');
        if (heroImg && window.GaslyMedia) {
          heroImg.onerror = function() {
            heroImg.onerror = null;
            heroImg.src = window.GaslyMedia.createSvgFallbackDataUri('Ilustrasi Operasional');
          };
          heroImg.src = window.GaslyMedia.PLACEHOLDERS.heroCover.url;
        }
        window.appLoadItems();
      });
    })();
  </script>
</body>
</html>
```

---
<!-- STACK: react-vite.md -->
<!-- KB_VERSION: 2.1.0 -->
# STACK ADAPTER: REACT (VITE + TYPESCRIPT + TAILWIND) (`stacks/react-vite.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-ui` ketika stack yang dipilih adalah `react`.

## Daftar Isi
1. [Struktur Proyek, Konvensi `VITE_GAS_EXEC_URL` & Target Hosting](#1-struktur-proyek-konvensi-vite_gas_exec_url--target-hosting)
2. [Kode Lengkap `src/lib/gasClient.ts` (Transport `text/plain`, `auth.google`, Step-Up PIN & Isolasi Demo)](#2-kode-lengkap-srclibgasclientts-transport-textplain-authgoogle-step-up-pin--isolasi-demo)
3. [Kode Lengkap `src/lib/driveImage.ts` & `src/lib/mediaPlaceholders.ts` (`Gate W-08` & `W-10`)](#3-kode-lengkap-srclibdriveimagets--srclibmediaplaceholdersts-gate-w-08--w-10)
4. [Kode Lengkap `src/components/ImageUploader.tsx` (Kompresi ~1 MB, `uploadNonce` & State `RECOVERY`)](#4-kode-lengkap-srccomponentsimageuploadertsx-kompresi-1-mb-uploadnonce--state-recovery)
5. [Kode Lengkap `src/components/StepUpPinModal.tsx` (Modal Konfirmasi & PIN 6 Digit)](#5-kode-lengkap-srccomponentsstepuppinmodaltsx-modal-konfirmasi--pin-6-digit)
6. [Kode Lengkap `src/App.tsx` (Workspace End-to-End & Paritas Kontrak)](#6-kode-lengkap-srcapptsx-workspace-end-to-end--paritas-kontrak)

---

## 1. Struktur Proyek, Konvensi `VITE_GAS_EXEC_URL` & Target Hosting

```text
react-gasly-app/
├── .env                                # VITE_GAS_EXEC_URL=https://script.google.com/macros/s/<ID>/exec
├── index.html                          # Viewport aksesibel (tanpa user-scalable=no)
├── package.json                        # Menggunakan <<PIN_VERSION>> untuk vite, react, tailwindcss
└── src/
    ├── index.css                       # Mengimpor preset CSS (mis. dense-dashboard.css / warm-friendly.css) + Tailwind
    ├── lib/
    │   ├── gasClient.ts                # Klien HTTP text/plain POST, retry idempoten, memori token & auth.google
    │   ├── driveImage.ts               # Helper driveImageUrl (public) vs tautan aman file_url (private)
    │   └── mediaPlaceholders.ts        # Registry foto/video dummy (Unsplash/Pexels/Pixabay) + fallback SVG
    ├── components/
    │   ├── ImageUploader.tsx           # Kompresi <canvas> ~1 MB, file.ticket ber-uploadNonce & state RECOVERY
    │   └── StepUpPinModal.tsx          # Modal kustom 6-digit PIN (auth.verifyPin -> stepUpToken)
    └── App.tsx                         # Aplikasi SPA utama terhubung end-to-end ke /exec
```

### Konfigurasi Environment & Build per Hosting Target
- **Environment Variable (`.env`):**
  - `VITE_GAS_EXEC_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec`
  - `VITE_GOOGLE_CLIENT_ID=` *(opsional, wajib diisi jika `auth_google_enabled: true`)*
- **Build Output Statis (SPA):** Perintah build `npm run build`, direktori output `dist/`.
  - **Cloudflare Pages (`cloudflare_pages` — Default Komersial Gratis):** Build command `npm run build`, output `dist`. SPA routing otomatis via fallback `index.html`.
  - **Sevalla (`sevalla` — Komersial Gratis s/d kuota):** Pilih Static Site, build command `npm run build`, publish directory `dist`, atur fallback `index.html`.
  - **Netlify (`netlify` — Komersial, kuota kredit):** Build `npm run build`, publish `dist`, tambahkan `public/_redirects` berisi `/* /index.html 200`.
  - **Firebase Hosting (`firebase_hosting` — Komersial Spark/Blaze):** Setel `"public": "dist"` dan rewrite `** -> /index.html` di `firebase.json`.
  - **Vercel (`vercel_pro` untuk komersial / `vercel_hobby_noncommercial` untuk personal):** Framework Preset `Vite`, output `dist`.
  - **GitHub Pages (`github_pages_demo` — Demo Non-Komersial Saja):** Setel `base` di `vite.config.ts` sesuai nama repositori.

---

## 2. Kode Lengkap `src/lib/gasClient.ts` (Transport `text/plain`, `auth.google`, Step-Up PIN & Isolasi Demo)

```typescript
// FILE: src/lib/gasClient.ts
export type GasCode =
  | 'OK'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'LOCK_TIMEOUT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface GasEnvelope<T = unknown> {
  status: 'success' | 'error';
  data: T | null;
  message: string;
  code: GasCode;
  meta: {
    schemaVersion?: string;
    timestamp: string;
    idempotentReplay?: boolean;
    retryAfterSeconds?: number;
  };
}

export interface SessionInfo {
  token: string;
  sub: string;
  role: string;
  expiresAt?: string;
}

const SESSION_STORAGE_KEY = 'GASLY_REACT_SESSION_TOKEN';
let memorySessionToken: string | null = null;

export function getExecUrl(): string {
  return String(import.meta.env.VITE_GAS_EXEC_URL || '').trim();
}

export function getGoogleClientId(): string {
  return String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
}

/**
 * Gate W-09: Demo controls and runtime URL switcher are ONLY allowed when
 * no production /exec URL is configured in build environment variables.
 */
export function isSimulationMode(): boolean {
  const url = getExecUrl();
  return !url || url.includes('REPLACE_WITH_DEPLOYMENT_ID');
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

export function setSessionToken(token: string | null, persistInTab = false): void {
  memorySessionToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token && persistInTab) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      } else {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Abaikan jika sandbox memblokir sessionStorage; memori tetap aktif
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
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface GasRequestOptions {
  idempotent?: boolean;
  idemKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Single HTTP client for Google Apps Script /exec.
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
      message: 'VITE_GAS_EXEC_URL belum dikonfigurasi pada file .env.',
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

export async function loginWithPassphrase(
  account: string,
  passphrase: string,
  persistInTab = false
): Promise<GasEnvelope<SessionInfo>> {
  const res = await gasRequest<SessionInfo>(
    'auth.login',
    { account: account || 'admin', passphrase },
    { idempotent: false, maxRetries: 0 }
  );
  if (res.status === 'success' && res.code === 'OK' && res.data?.token) {
    setSessionToken(res.data.token, persistInTab);
  }
  return res;
}

/**
 * Matches backend handleAuthGoogle_ contract: payload key MUST be `idToken` (camelCase).
 */
export async function loginWithGoogleIdToken(
  idToken: string,
  persistInTab = false
): Promise<GasEnvelope<SessionInfo>> {
  const res = await gasRequest<SessionInfo>(
    'auth.google',
    { idToken },
    { idempotent: false, maxRetries: 0 }
  );
  if (res.status === 'success' && res.code === 'OK' && res.data?.token) {
    setSessionToken(res.data.token, persistInTab);
  }
  return res;
}

export async function verifyStepUpPin(
  pin: string,
  targetAction: 'items.delete' | 'admin.purgeSeed' | 'file.delete' | 'auth.setCredentials'
): Promise<GasEnvelope<{ stepUpToken: string; targetAction: string; expiresInSeconds: number }>> {
  return gasRequest(
    'auth.verifyPin',
    { pin, targetAction },
    { idempotent: false, maxRetries: 0 }
  );
}

export async function logoutSession(): Promise<void> {
  try {
    await gasRequest('auth.logout', {}, { idempotent: false, maxRetries: 0 });
  } finally {
    clearSessionToken();
  }
}
```

---

## 3. Kode Lengkap `src/lib/driveImage.ts` & `src/lib/mediaPlaceholders.ts` (`Gate W-08` & `W-10`)

```typescript
// FILE: src/lib/driveImage.ts
/**
 * Single helper for PUBLIC Google Drive images (Gate W-08).
 * For CONFIDENTIAL / SENSITIVE_PII entities (visibility: 'private'), DO NOT render
 * public thumbnails—render a safe external link to `file_url` instead (Gate U-10).
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

/**
 * Gate U-07: Never hide null/undefined/NaN values as "Rp 0".
 */
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

```typescript
// FILE: src/lib/mediaPlaceholders.ts
/**
 * Gate W-10: Centralized external stock media placeholders (Unsplash, Pexels, Pixabay, Coverr/Mixkit).
 * - Never use deprecated `source.unsplash.com`.
 * - Never hotlink expiring AI signed URLs (e.g., Magnific AI outputs should be saved to public/assets/).
 * - Never disguise stock portraits as real customer testimonials (Gate U-03).
 */
export interface PlaceholderMediaAsset {
  type: 'image' | 'video';
  url: string;
  poster?: string;
  alt: string;
  source: string;
  isPlaceholder: true;
}

export const MEDIA_PLACEHOLDERS: Record<string, PlaceholderMediaAsset> = {
  heroCover: {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    alt: 'Ilustrasi ruang kerja operasional (gambar contoh)',
    source: 'Unsplash (Placeholder)',
    isPlaceholder: true
  },
  catalogSample: {
    type: 'image',
    url: 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800',
    alt: 'Ilustrasi kolaborasi tim (gambar contoh)',
    source: 'Pexels (Placeholder)',
    isPlaceholder: true
  },
  ambientShowcaseVideo: {
    type: 'video',
    url: 'https://videos.pexels.com/video-files/3129671/3129671-sd_640_360_30fps.mp4',
    poster: 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1200',
    alt: 'Video latar ilustratif (video contoh)',
    source: 'Pexels Videos (Placeholder)',
    isPlaceholder: true
  }
};

export function createSvgFallbackDataUri(label = 'Gambar Contoh'): string {
  const safe = String(label).replace(/[<>&"']/g, '').slice(0, 48);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
    <rect width="100%" height="100%" fill="#E2E8F0"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      font-family="sans-serif" font-size="22" fill="#475569">${safe}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function shouldAutoplayVideo(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

---

## 4. Kode Lengkap `src/components/ImageUploader.tsx` (Kompresi ~1 MB, `uploadNonce` & State `RECOVERY`)

```tsx
// FILE: src/components/ImageUploader.tsx
import React, { useState } from 'react';
import { gasRequest, getSessionToken } from '../lib/gasClient';

export type UploadStatus = 'idle' | 'compressing' | 'uploading' | 'error' | 'done';

interface ImageUploaderProps {
  entity: string;
  entityId: string;
  /** Wajib diisi pada alur upload publik (P3) dari respons items.create */
  uploadNonce?: string | null;
  onUploaded?: (result: { fileId: string; fileUrl: string; visibility: string }) => void;
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
      el.onerror = () => reject(new Error('Gagal membaca gambar untuk kompresi.'));
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

    return { fileName: file.name, mimeType: outMime, base64 };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ImageUploader({ entity, entityId, uploadNonce, onUploaded }: ImageUploaderProps) {
  const [state, setState] = useState<UploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Pilih foto bukti (otomatis dikompres ~1 MB).');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function executeUpload(file: File) {
    setState('compressing');
    setStatusMessage('Mengompres ukuran foto...');

    try {
      const compressed = await compressFileToBase64(file);
      setState('uploading');
      setStatusMessage('Mengunggah foto ke Google Drive...');

      let ticket: string | null = null;
      if (!getSessionToken()) {
        if (!uploadNonce) {
          setState('error');
          setStatusMessage('Token uploadNonce record tidak tersedia untuk unggahan publik.');
          return;
        }
        const ticketRes = await gasRequest<{ ticket: string }>(
          'file.ticket',
          { entity, entityId, uploadNonce },
          { idempotent: false, maxRetries: 0 }
        );
        if (ticketRes.status !== 'success' || ticketRes.code !== 'OK' || !ticketRes.data?.ticket) {
          setState('error');
          setStatusMessage(ticketRes.message || 'Gagal memperoleh tiket unggah.');
          return;
        }
        ticket = ticketRes.data.ticket;
      }

      // Gate W-09: Simpan respons ke variabel dan verifikasi status + code secara ketat
      const uploadRes = await gasRequest<{ fileId: string; fileUrl: string; visibility: string }>(
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

      if (uploadRes.status !== 'success' || uploadRes.code !== 'OK' || !uploadRes.data) {
        setState('error');
        setStatusMessage(uploadRes.message || 'Gagal mengunggah foto ke Google Drive.');
        return;
      }

      setState('done');
      setStatusMessage('Foto berhasil diunggah dan ditautkan ke record.');
      onUploaded?.(uploadRes.data);
    } catch (err) {
      setState('error');
      setStatusMessage(err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses foto.');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file) {
      void executeUpload(file);
    }
  }

  return (
    <div className="space-y-2" aria-busy={state === 'compressing' || state === 'uploading'}>
      <label
        htmlFor={`uploader-${entityId}`}
        style={{ color: 'var(--text-secondary)' }}
        className="block text-xs font-semibold"
      >
        Unggah Foto Bukti (JPEG/PNG/WebP)
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
        style={{ color: state === 'error' ? 'var(--danger-solid)' : 'var(--text-helper)' }}
        className="text-xs"
      >
        [{state.toUpperCase()}] {statusMessage}
      </p>
      {state === 'error' && selectedFile && (
        <button
          type="button"
          onClick={() => void executeUpload(selectedFile)}
          style={{
            backgroundColor: 'var(--accent-solid)',
            color: 'var(--accent-text-on-solid)'
          }}
          className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold"
        >
          Unggah Ulang Foto Saja (Tanpa Duplikasi Data)
        </button>
      )}
    </div>
  );
}
```

---

## 5. Kode Lengkap `src/components/StepUpPinModal.tsx` (Modal Konfirmasi & PIN 6 Digit)

```tsx
// FILE: src/components/StepUpPinModal.tsx
import React, { useEffect, useState } from 'react';
import { verifyStepUpPin } from '../lib/gasClient';

interface StepUpPinModalProps {
  open: boolean;
  title: string;
  description: string;
  targetAction: 'items.delete' | 'admin.purgeSeed' | 'file.delete' | 'auth.setCredentials';
  confirmLabel?: string;
  onCancel: () => void;
  onVerified: (stepUpToken: string) => Promise<void>;
}

export function StepUpPinModal({
  open,
  title,
  description,
  targetAction,
  confirmLabel = 'Verifikasi & Lanjutkan',
  onCancel,
  onVerified
}: StepUpPinModalProps) {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isBusy) onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isBusy, onCancel]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy) return;
    if (!/^\d{6}$/.test(pin.trim())) {
      setErrorMsg('Masukkan tepat 6 digit angka PIN.');
      return;
    }

    setIsBusy(true);
    setErrorMsg(null);
    const pinRes = await verifyStepUpPin(pin.trim(), targetAction);
    if (pinRes.status !== 'success' || pinRes.code !== 'OK' || !pinRes.data?.stepUpToken) {
      setIsBusy(false);
      setErrorMsg(pinRes.message || 'Verifikasi PIN gagal.');
      return;
    }

    try {
      await onVerified(pinRes.data.stepUpToken);
      setPin('');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stepup-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onCancel();
      }}
    >
      <div
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        className="w-full max-w-md rounded-xl border p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="stepup-modal-title" className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Tutup dialog konfirmasi"
            disabled={isBusy}
            onClick={onCancel}
            className="min-w-[40px] min-h-[40px] text-lg"
          >
            &times;
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
          {description}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="stepup-pin-input"
              style={{ color: 'var(--text-secondary)' }}
              className="block text-xs font-semibold mb-1"
            >
              PIN Step-Up Admin (6 Digit Angka) *
            </label>
            <input
              id="stepup-pin-input"
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{
                backgroundColor: 'var(--bg-base)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-subtle)'
              }}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm font-mono tracking-widest"
            />
          </div>

          {errorMsg && (
            <p role="alert" style={{ color: 'var(--danger-solid)' }} className="text-xs font-medium">
              {errorMsg}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={onCancel}
              style={{ backgroundColor: 'var(--bg-interactive)', color: 'var(--text-primary)' }}
              className="min-h-[42px] px-4 py-2 rounded-lg text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isBusy}
              style={{ backgroundColor: 'var(--danger-solid)', color: 'var(--danger-text-on-solid)' }}
              className="min-h-[42px] px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {isBusy ? 'Memverifikasi...' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## 6. Kode Lengkap `src/App.tsx` (Workspace End-to-End & Paritas Kontrak)

```tsx
// FILE: src/App.tsx
import React, { useEffect, useState } from 'react';
import {
  gasRequest,
  getSessionToken,
  isSimulationMode,
  loginWithPassphrase,
  logoutSession
} from './lib/gasClient';
import { driveImageUrl, driveImageFallbackUrl, formatCurrencyIdr } from './lib/driveImage';
import { MEDIA_PLACEHOLDERS, createSvgFallbackDataUri } from './lib/mediaPlaceholders';
import { ImageUploader } from './components/ImageUploader';
import { StepUpPinModal } from './components/StepUpPinModal';

interface ItemRecord {
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

const ENTITY_IS_PRIVATE = true; // Sesuaikan dengan data_classification di GASLY_CONTRACT_JSON (Gate U-10)

export default function App() {
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Operasional');
  const [amount, setAmount] = useState('');

  // Menyimpan uploadNonce hasil items.create untuk alur upload publik (P3)
  const [pendingUpload, setPendingUpload] = useState<{ entityId: string; uploadNonce: string } | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => Boolean(getSessionToken()));
  const [passphrase, setPassphrase] = useState('');
  const [persistTab, setPersistTab] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ItemRecord | null>(null);

  async function loadItems() {
    setIsLoading(true);
    setErrorMsg(null);
    const res = await gasRequest<{ items: ItemRecord[] }>('items.list', {});
    setIsLoading(false);
    if (res.status === 'success' && res.code === 'OK' && res.data?.items) {
      setItems(res.data.items);
    } else {
      setErrorMsg(res.message || 'Gagal memuat daftar data.');
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    setNoticeMsg(null);

    const res = await gasRequest<{ item: ItemRecord; uploadNonce?: string }>('items.create', {
      title,
      category,
      amount: Number(amount),
      status: 'ACTIVE'
    });

    setIsSaving(false);
    if (res.status === 'success' && res.code === 'OK' && res.data?.item) {
      setTitle('');
      setAmount('');
      setNoticeMsg(`Data ${res.data.item.id} berhasil disimpan.`);
      if (res.data.uploadNonce) {
        setPendingUpload({ entityId: res.data.item.id, uploadNonce: res.data.uploadNonce });
      }
      await loadItems();
    } else {
      // Pertahankan ketikan form saat gagal (Gate U-08 RECOVERY)
      setErrorMsg(res.message || 'Gagal menyimpan data.');
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const res = await loginWithPassphrase('admin', passphrase, persistTab);
    if (res.status === 'success' && res.code === 'OK') {
      setPassphrase('');
      setIsLoggedIn(true);
      setNoticeMsg('Login berhasil.');
      await loadItems();
    } else {
      setErrorMsg(res.message || 'Login gagal.');
    }
  }

  async function handleDeleteWithStepUp(stepUpToken: string) {
    if (!deleteTarget) return;
    const res = await gasRequest('items.delete', {
      id: deleteTarget.id,
      expected_updated_at: deleteTarget.updated_at,
      stepUpToken
    });
    setDeleteTarget(null);
    if (res.status === 'success' && res.code === 'OK') {
      setNoticeMsg(`Data ${deleteTarget.id} berhasil diarsipkan.`);
      await loadItems();
    } else {
      setErrorMsg(res.message || 'Gagal mengarsipkan data.');
    }
  }

  return (
    <div
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
      className="min-h-screen"
    >
      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header + Visual Cover Placeholder (Gate W-10) */}
        <header
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          className="rounded-xl border overflow-hidden"
        >
          <div className="h-36 w-full relative overflow-hidden">
            <img
              src={MEDIA_PLACEHOLDERS.heroCover.url}
              alt={MEDIA_PLACEHOLDERS.heroCover.alt}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = createSvgFallbackDataUri('Ilustrasi Operasional');
              }}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Portal Operasional Gasly (React)</h1>
              <p style={{ color: 'var(--text-helper)' }} className="text-xs">
                {isSimulationMode()
                  ? 'Mode Konfigurasi Lokal (VITE_GAS_EXEC_URL belum diisi)'
                  : 'Terhubung ke Google Apps Script Headless API (/exec)'}
              </p>
            </div>

            {!isLoggedIn ? (
              <form onSubmit={handleLogin} className="flex flex-wrap items-end gap-2">
                <div>
                  <label
                    htmlFor="login-passphrase"
                    style={{ color: 'var(--text-secondary)' }}
                    className="block text-xs font-semibold mb-1"
                  >
                    Passphrase Admin (Min. 12 Karakter)
                  </label>
                  <input
                    id="login-passphrase"
                    type="password"
                    required
                    minLength={12}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-base)',
                      color: 'var(--text-primary)',
                      borderColor: 'var(--border-subtle)'
                    }}
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
                onClick={async () => {
                  await logoutSession();
                  setIsLoggedIn(false);
                  setNoticeMsg('Sesi berhasil diakhiri.');
                }}
                style={{ backgroundColor: 'var(--bg-interactive)', color: 'var(--text-primary)' }}
                className="min-h-[42px] px-4 py-2 rounded-lg text-sm font-medium"
              >
                Keluar Sesi
              </button>
            )}
          </div>
        </header>

        {errorMsg && (
          <div
            role="alert"
            style={{ backgroundColor: 'var(--danger-solid)', color: 'var(--danger-text-on-solid)' }}
            className="p-4 rounded-xl flex items-center justify-between gap-4 text-sm"
          >
            <span>{errorMsg}</span>
            <button type="button" onClick={() => void loadItems()} className="min-h-[40px] px-3 py-1 rounded bg-black/20 text-xs font-semibold">
              Coba Lagi
            </button>
          </div>
        )}

        {noticeMsg && (
          <div
            role="status"
            aria-live="polite"
            style={{ backgroundColor: 'var(--success-solid)', color: 'var(--success-text-on-solid)' }}
            className="p-3 rounded-xl text-sm font-medium"
          >
            {noticeMsg}
          </div>
        )}

        {/* Form Tambah Transaksi */}
        <form
          onSubmit={handleCreate}
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          className="p-5 rounded-xl border grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label htmlFor="f-title" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
              Judul Transaksi *
            </label>
            <input
              id="f-title"
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
            <label htmlFor="f-cat" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
              Kategori
            </label>
            <select
              id="f-cat"
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
            <label htmlFor="f-amt" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
              Nominal (Rp) *
            </label>
            <input
              id="f-amt"
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
            {isSaving ? 'Menyimpan...' : 'Simpan Transaksi'}
          </button>
        </form>

        {/* Panel Unggah Bukti Pasca-Create (Mengirim uploadNonce yang valid) */}
        {pendingUpload && (
          <section
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-focus)' }}
            className="p-4 rounded-xl border space-y-2"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Lampirkan Foto Bukti untuk {pendingUpload.entityId}</h2>
              <button
                type="button"
                onClick={() => setPendingUpload(null)}
                className="min-h-[40px] px-3 text-xs underline"
              >
                Lewati
              </button>
            </div>
            <ImageUploader
              entity="ITEMS"
              entityId={pendingUpload.entityId}
              uploadNonce={pendingUpload.uploadNonce}
              onUploaded={async () => {
                setPendingUpload(null);
                await loadItems();
              }}
            />
          </section>
        )}

        {/* Tabel Data */}
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
              Belum ada data tercatat. Gunakan formulir di atas untuk membuat transaksi pertama.
            </p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ color: 'var(--text-helper)', borderColor: 'var(--border-subtle)' }} className="border-b text-xs uppercase">
                  <th className="py-2 px-2">ID</th>
                  <th className="py-2 px-2">Judul</th>
                  <th className="py-2 px-2 text-right">Nominal</th>
                  <th className="py-2 px-2">Lampiran</th>
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
                      {it.file_id && ENTITY_IS_PRIVATE ? (
                        <a
                          href={it.file_url || `https://drive.google.com/file/d/${encodeURIComponent(it.file_id)}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--border-focus)' }}
                          className="text-xs font-semibold underline"
                        >
                          Buka Dokumen Privat (Drive)
                        </a>
                      ) : it.file_id ? (
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
                          alt={`Lampiran ${it.title}`}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <span style={{ color: 'var(--text-helper)' }} className="text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {isLoggedIn && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(it)}
                          style={{ backgroundColor: 'var(--danger-solid)', color: 'var(--danger-text-on-solid)' }}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold"
                        >
                          Arsipkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      <StepUpPinModal
        open={Boolean(deleteTarget)}
        title="Konfirmasi Pengarsipan"
        description={
          deleteTarget
            ? `Masukkan PIN 6 digit untuk mengarsipkan transaksi "${deleteTarget.title}" (${deleteTarget.id}).`
            : ''
        }
        targetAction="items.delete"
        confirmLabel="Ya, Arsipkan"
        onCancel={() => setDeleteTarget(null)}
        onVerified={handleDeleteWithStepUp}
      />
    </div>
  );
}

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
- **Aksi:** Salin blok konfigurasi yang telah terisi `{{GAS_EXEC_URL}}` (dan `{{GOOGLE_CLIENT_ID}}` bila aktif) ke file konfigurasi proyek (`src/config.js` untuk `html-tailwind`, atau `.env` dengan `VITE_GAS_EXEC_URL` untuk `react`), bangun aset produksi, lalu unggah/deploy ke target hosting (`cloudflare_pages` default komersial gratis; alternatif komersial `sevalla`, `netlify`, `firebase_hosting`, `vercel_pro`; atau `github_pages_demo` / `vercel_hobby_noncommercial` khusus demo/personal non-komersial).
- **Hasil yang Diharapkan:** Aplikasi frontend tayang di `{{PAGES_DOMAIN}}` dengan mode simulasi/demo otomatis nonaktif (`Gate W-09`).
- **Sumber:** `src/core/facts.md` (Seksi 2) & `src/stacks/html-tailwind.md` / `src/stacks/react-vite.md`
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