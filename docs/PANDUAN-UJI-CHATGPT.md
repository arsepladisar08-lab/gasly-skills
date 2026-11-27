# Panduan Pengujian End-to-End GASLY Skills di ChatGPT (Non-Agent)

**Target Versi Skill:** `2.5.0` (`KB_VERSION: 2.1.0`)  
**Target Platform Uji:** ChatGPT Web (`chatgpt.com` — Chat Biasa, Projects, atau Custom GPT)  
**Cakupan Stack:** `html-tailwind`, `react` (Vite + TypeScript + Tailwind), dan `gasly-pro` (Legacy Monolitik `HtmlService`)  
**Status Runtime GAS:** Uji di ChatGPT menghasilkan artefak kode; verifikasi deterministik lokal dan uji runtime Apps Script tetap wajib dijalankan secara terpisah.

---

## Daftar Isi
1. [Prasyarat & Persiapan Paket Skill (`dist/`)](#1-prasyarat--persiapan-paket-skill-dist)
2. [Cara Memasang & Menjalankan Skill di ChatGPT](#2-cara-memasang--menjalankan-skill-di-chatgpt)
3. [Skenario Uji 1 — Aplikasi UMKM `DapurSaji` (`html-tailwind`, `P3`, `warm-friendly`)](#3-skenario-uji-1--aplikasi-umkm-dapursaji-html-tailwind-p3-warm-friendly)
4. [Skenario Uji 2 — Sistem Gudang `GudangCepat` (`react`, `P4`, `dense-dashboard`)](#4-skenario-uji-2--sistem-gudang-gudangcepat-react-p4-dense-dashboard)
5. [Skenario Uji 3 — Kas & Reimburse `KasPaguyuban` (`gasly-pro` Legacy `HtmlService`)](#5-skenario-uji-3--kas--reimburse-kaspaguyuban-gasly-pro-legacy-htmlservice)
6. [Verifikasi Deterministik Lokal (Skrip Repo & Browser Preview)](#6-verifikasi-deterministik-lokal-skrip-repo--browser-preview)
7. [Uji Deployment & Runtime Google Apps Script Nyata](#7-uji-deployment--runtime-google-apps-script-nyata)
8. [Rubrik Penilaian & Pencatatan Hasil Evaluasi](#8-rubrik-penilaian--pencatatan-hasil-evaluasi)

---

## 1. Prasyarat & Persiapan Paket Skill (`dist/`)

Sebelum membuka ChatGPT, pastikan seluruh perubahan `v2.5.0` sudah dikompilasi dan lulus validasi lokal dari direktori akar repositori:

```bash
python build_skills.py
python tools/check_contrast.py
python -m unittest discover -s tests -v
TZ=Asia/Jakarta node tests/harness.js
TZ=Asia/Jakarta node tests/harness_gas.js
TZ=Asia/Jakarta node tests/harness_install.js
```

### Daftar Paket File yang Akan Diunggah ke ChatGPT

Karena ChatGPT Web bukan *agent CLI* yang bisa membaca direktori lokal otomatis, siapkan file berikut dari folder `dist/`:

| Peran / Tahap | Paket yang Digunakan dari `dist/` | Catatan Unggah ke ChatGPT |
| :--- | :--- | :--- |
| **Perencana (`gasly-prd`)** | `dist/flat/gasly-prd/SKILL.md` *(paling praktis: 1 file)* **atau** folder `dist/modular/gasly-prd/` | Untuk ChatGPT, `dist/flat/gasly-prd/SKILL.md` + `schemas/gasly-contract.schema.json` + `src/core/facts.md` sangat stabil dan hemat slot lampiran. |
| **Backend (`gasly-data`)** | `dist/modular/gasly-data/SKILL.md` + file relevan di `dist/modular/gasly-data/references/` | Minimal lampirkan: `SKILL.md`, `contract.md`, `access-profiles.md`, `gates.md`, `config.md`, `router-and-envelope.md`, `auth-and-ratelimit.md`, `sheets-repository.md`, dan `drive-upload.md` (bila ada upload). |
| **Frontend (`gasly-ui`)** | `dist/modular/gasly-ui/SKILL.md` + file relevan di `dist/modular/gasly-ui/references/` | Minimal lampirkan: `SKILL.md`, `contract.md`, `access-profiles.md`, `gates.md`, `presets.md`, `dials.md`, **1 file CSS preset target** (`references/css/<preset>.css`), dan **1 adapter stack target** (`html-tailwind.md` atau `react-vite.md`). |
| **Panduan Deploy (`gasly-deploy-guide`)** | `dist/modular/gasly-deploy-guide/SKILL.md` + `references/config.md`, `facts.md`, `gates.md`, `install-steps.md`, `guide-template.html` | Menghasilkan 1 file `install-guide.html` mandiri 100% offline. |
| **Monolitik Legacy (`gasly-pro`)** | `dist/flat/gasly-pro/SKILL.md` *(1 file lengkap)* atau `dist/flat-lite/gasly-pro/SKILL.md` | Cukup unggah 1 file untuk menguji jalur legacy `HtmlService`. |

> **Tip Anti-Context-Limit di ChatGPT:** Jangan mengunggah seluruh file preset/adapter yang tidak dipakai pada sesi tersebut. Misalnya, untuk Aplikasi #1 (`html-tailwind` + `warm-friendly`), cukup unggah `html-tailwind.md` dan `warm-friendly.css` (tidak perlu melampirkan `react-vite.md` atau `aura.css`).

---

## 2. Cara Memasang & Menjalankan Skill di ChatGPT

### Opsi A — Menggunakan **ChatGPT Projects** atau **Custom GPT** *(Direkomendasikan)*
Cocok jika Anda menggunakan ChatGPT Plus/Team dan ingin menguji banyak aplikasi berulang kali tanpa mengunggah ulang file skill:
1. Buat 5 Project/GPT terpisah:
   - `GASLY - 01 PRD`
   - `GASLY - 02 Data (Backend GAS)`
   - `GASLY - 03 UI (Frontend)`
   - `GASLY - 04 Deploy Guide`
   - `GASLY - Legacy Pro (HtmlService)`
2. Pada masing-masing Project/GPT:
   - Unggah file `SKILL.md` dan `references/` yang relevan ke bagian **Project Files / Knowledge**.
   - Isi **Project Instructions** dengan 3 baris berikut:
     ```text
     Ikuti seluruh aturan keras (Hard Gates) di dalam file SKILL.md dan file referensi yang terlampir pada Project Files ini secara ketat.
     Dilarang meringkas kode dengan elipsis (...), placeholder TODO, atau melewati gerbang keamanan.
     Gunakan Bahasa Indonesia yang jelas dan keluarkan setiap file kode utuh dengan penanda "### FILE: <nama-file>".
     ```
3. Mulai **New Chat** di dalam Project yang sesuai untuk setiap aplikasi uji.

### Opsi B — Menggunakan **Chat Biasa** *(Gratis / Tanpa Setup Project)*
Cocok untuk uji cepat (*clean room test*):
1. Buka **New Chat** baru untuk **setiap peran skill** (1 chat = 1 peran: jangan menggabungkan PRD, Backend, dan Frontend dalam 1 thread chat panjang agar tidak terjadi *context drift*).
2. Klik ikon **klip / tambah file (`+`)**, lampirkan file skill & referensi sesuai tabel pada Seksi 1.
3. Tempel prompt pembuka + brief/kontrak yang disediakan pada Seksi 3–5 di bawah ini.

### Aturan Praktis Saat Menguji di ChatGPT
- **Matikan bias memori lama:** Gunakan *Temporary Chat* (atau mulai chat baru di Project bersih) agar hasil benar-benar mencerminkan instruksi skill, bukan ingatan chat sebelumnya.
- **Canvas vs Code Block:**
  - Saat menghasilkan banyak file (`setup.gs` + `code.gs` atau proyek React multi-file), minta ChatGPT mengeluarkan dalam **blok kode markdown biasa dengan header `### FILE: path/to/file`** agar tidak terpotong oleh editor Canvas.
  - Saat ingin melihat pratinjau langsung `index.html` (Aplikasi #1 versi single-file atau Aplikasi #3 `gasly-pro`), Anda boleh mengaktifkan **Canvas** atau langsung salin `index.html` ke komputer lokal lalu buka di browser.
- **Jika output terhenti di tengah kode panjang:** Balas singkat dengan:
  > *"Output sebelumnya terpotong di baris `<salin 2 baris terakhir>`. Lanjutkan persis dari baris tersebut hingga akhir file tanpa mengulang dari atas."*

---

## 3. Skenario Uji 1 — Aplikasi UMKM `DapurSaji` (`html-tailwind`, `P3`, `warm-friendly`)

### Target Uji
Menguji arsitektur decoupled ringan, `Gate W-10` (foto/video placeholder stock aman), `Gate U-03` (anti-fabrikasi), `Gate U-10` (Drive `private` untuk bukti transfer), `Gate G-09` & `W-09` (`uploadNonce` $\rightarrow$ `file.ticket` $\rightarrow$ `file.upload` + tombol `RECOVERY`), `Gate G-10` (`tracking_token` anti-enumerasi), serta hosting **Cloudflare Pages / Sevalla**.

---

### Langkah 1.1 — Chat A: Perencanaan (`gasly-prd`)
1. Buka chat baru dengan skill **`gasly-prd`** (`dist/flat/gasly-prd/SKILL.md` + `schemas/gasly-contract.schema.json` + `src/core/facts.md`).
2. Kirim prompt berikut:

```text
Jalankan peran GaslyPRD berdasarkan file SKILL.md terlampir. Gunakan Quick Mode bila informasi sudah cukup jelas, dan pastikan ketiga artifact (PRD-Final.md, MASTER-INSTRUCTIONAL-PROMPT.md, dan GASLY_CONTRACT.json) dipisahkan secara lengkap.

Brief saya:
Saya punya usaha katering rumahan & nasi kotak bernama "DapurSaji". Tolong buatkan website katalog paket katering dan form pemesanan online yang datanya masuk ke Google Sheets, dengan tampilan modern dan menarik—boleh pakai foto menu dan video suasana dapur dummy dari internet dulu karena foto asli kami belum jadi. Pembeli bisa unggah foto bukti transfer DP ke Google Drive dan bisa mengecek status pesanannya secara online tanpa login. Admin bisa login untuk mengelola pesanan dan memperbarui status. Kami belum punya testimoni maupun data jumlah pelanggan, jadi jangan dikarang ya. Saya ingin pakai HTML + Tailwind dan nanti rencananya di-hosting gratis untuk komersial di Cloudflare Pages atau Sevalla.
```

3. **Checklist Lulus Chat A (`gasly-prd`):**
   - [ ] Memilih `surface_profile: "PUBLIC_SERVICE"`, `access_profile: "P3"`, `frontend_stack: "html-tailwind"`, `hosting_target: "cloudflare_pages"` (atau `"sevalla"`).
   - [ ] Memilih preset **`warm-friendly`** (bukan `aura`).
   - [ ] Mengklasifikasikan entitas pesanan/bukti transfer sebagai `CONFIDENTIAL` dengan `drive_upload.visibility: "private"` (`Gate U-10`).
   - [ ] Mengaktifkan `public_lookup: true`, `rate_limited: true`, `requires_high_entropy_token: true` (`tracking_token`) pada aksi pelacakan pesanan (`Gate G-10`).
   - [ ] `envelope_spec.status_values` bernilai `["success", "error"]`.
   - [ ] Tidak mengarang testimoni, jumlah pelanggan, atau klaim bebas biaya server mutlak (`Gate U-03`).
   - [ ] Menyertakan maksimal 3 pertanyaan klarifikasi dan tepat 2 Gasly Idea.
4. **Simpan Output:** Simpan `PRD-Final.md`, `MASTER-INSTRUCTIONAL-PROMPT.md`, dan `GASLY_CONTRACT.json` ke folder lokal `tmp_eval/app1-dapursaji/`.

---

### Langkah 1.2 — Chat B: Backend Apps Script (`gasly-data`)
1. Buka chat baru dengan skill **`gasly-data`** (`SKILL.md`, `contract.md`, `access-profiles.md`, `gates.md`, `config.md`, `router-and-envelope.md`, `auth-and-ratelimit.md`, `sheets-repository.md`, `drive-upload.md`).
2. Kirim prompt berikut (tempel Master Prompt & Contract JSON dari Chat A):

```text
Jalankan peran GaslyData berdasarkan file SKILL.md dan references terlampir.
Bangun kode backend Google Apps Script (V8) yang 100% utuh tanpa placeholder atau elipsis (...) untuk proyek DapurSaji berdasarkan spesifikasi dan GASLY_CONTRACT.json di bawah ini.

Keluarkan file terpisah dengan format:
### FILE: setup.gs
### FILE: code.gs
### FILE: VERIFY.md

Aturan penting:
- Pastikan bukti transfer DP dikunci ke DriveApp.Access.PRIVATE (Gate U-10).
- Pastikan seed 16 baris menggunakan Array of Objects + buildRowFromObject_ (Gate G-12).
- Pastikan setupAdminCredentials() membaca ADMIN_PASSPHRASE_INIT dan ADMIN_PIN_INIT lalu menghapusnya di blok finally.
- Pastikan aksi pelacakan publik menggunakan tracking_token + constantTimeEqual_ + rate limit CacheService (Gate G-10).
- Pastikan file.ticket memverifikasi { entity, entityId, uploadNonce }.

--- TEMPEL MASTER-INSTRUCTIONAL-PROMPT.md DI SINI ---

--- TEMPEL GASLY_CONTRACT.json DI SINI ---
```

3. **Simpan Output:** Simpan `setup.gs`, `code.gs`, dan `VERIFY.md` ke `tmp_eval/app1-dapursaji/`.

---

### Langkah 1.3 — Chat C: Frontend `html-tailwind` (`gasly-ui`)
1. Buka chat baru dengan skill **`gasly-ui`** (`SKILL.md`, `contract.md`, `access-profiles.md`, `gates.md`, `presets.md`, `dials.md`, `css/warm-friendly.css`, `html-tailwind.md`).
2. Kirim prompt berikut:

```text
Terapkan standar estetika SaaS $49/bulan sesuai references/saas-craft.md: gunakan inline SVG (nol emoji di tombol/navigasi), Bento KPI Strip yang dihitung live dari data, Slide-Over Drawer/Modal untuk form input (jangan menumpuk form terbuka di atas tabel), toolbar pencarian + filter pill + status pill lembut, Mobile Stacked Card View (<768px), skeleton realistis, dan Sonner-style toast.

Jalankan peran GaslyUI berdasarkan file SKILL.md dan references terlampir.
Bangun frontend aplikasi DapurSaji menggunakan stack html-tailwind dan preset warm-friendly yang terhubung ke kontrak backend di bawah ini.

Keluarkan file 100% utuh (tanpa elipsis) dengan format:
### FILE: src/preset-tokens.css
### FILE: src/config.js
### FILE: src/gasClient.js
### FILE: src/imageUploader.js
### FILE: src/mediaPlaceholders.js
### FILE: index.html
### FILE: package.json

Syarat wajib yang akan diuji:
1. Gunakan foto menu/suasana dan video ambient dummy dari Unsplash/Pexels di MEDIA_PLACEHOLDERS (Gate W-10) dengan fallback SVG onerror, muted loop playsinline poster, menghormati prefers-reduced-motion, dan DILARANG memakai source.unsplash.com.
2. DILARANG mengarang testimoni pelanggan atau jumlah klien (Gate U-03).
3. Alur pesan + upload bukti transfer wajib meneruskan uploadNonce ke file.ticket, menyimpan hasil file.upload ke variabel, memeriksa status === 'success' && code === 'OK', dan menyediakan tombol RECOVERY "Unggah Ulang Foto Saja" jika upload gagal (Gate W-09).
4. Karena bukti transfer bersifat private (Gate U-10), panel admin menampilkan tautan aman file_url Google Drive (bukan thumbnail publik).
5. Form cek status publik wajib meminta nomor pesanan + tracking_token (Gate G-10).
6. Aksi hapus/arsip di panel admin wajib memakai modal kustom + PIN 6 digit (auth.verifyPin -> stepUpToken), nol window.confirm().
7. Sediakan Mode Simulasi (Preview Mode) yang aktif otomatis saat EXEC_URL belum diisi agar index.html langsung interaktif dibuka di browser.

--- TEMPEL MASTER-INSTRUCTIONAL-PROMPT.md & GASLY_CONTRACT.json DI SINI ---
```

3. **Simpan Output:** Simpan seluruh file frontend ke `tmp_eval/app1-dapursaji/`.

---

### Langkah 1.4 — Chat D: Panduan Instalasi Mandiri (`gasly-deploy-guide`)
1. Buka chat baru dengan skill **`gasly-deploy-guide`** (`SKILL.md`, `contract.md`, `access-profiles.md`, `gates.md`, `config.md`, `facts.md`, `install-steps.md`, `guide-template.html`).
2. Kirim prompt berikut:

```text
Jalankan peran GaslyDeployGuide berdasarkan file SKILL.md dan references terlampir.
Hasilkan SATU file HTML panduan pemasangan mandiri (### FILE: install-guide.html) untuk proyek DapurSaji berdasarkan GASLY_CONTRACT.json dan daftar file keluaran berikut.

Pastikan mematuhi 100% Gate I-01 s/d I-06:
- 0 aset eksternal/CDN, 0 gambar/video internet, 0 panggilan fetch/XHR di script.
- Manipulasi DOM murni via textContent, ekspos window.GaslyGuide (fillPlaceholders, validateConfig, generateSecret).
- Instruksikan setupAdminCredentials() tanpa plaintext di kode, dan deployment ke Cloudflare Pages atau Sevalla.

Daftar file proyek:
- Backend GAS: setup.gs, code.gs
- Frontend (html-tailwind): index.html, package.json, src/preset-tokens.css, src/config.js, src/gasClient.js, src/imageUploader.js, src/mediaPlaceholders.js

--- TEMPEL GASLY_CONTRACT.json DI SINI ---
```

3. **Simpan Output:** Simpan sebagai `tmp_eval/app1-dapursaji/install-guide.html`.

---

## 4. Skenario Uji 2 — Sistem Gudang `GudangCepat` (`react`, `P4`, `dense-dashboard`)

### Target Uji
Menguji adapter baru **`react-vite.md`**, `INTERNAL_APP` (nol landing page), `P4` (`internal-only`), preset `dense-dashboard`, konkurensi delta stok `IN`/`OUT` vs opname `ADJUST` (`Gate G-11`), `auth.google` (`idToken` camelCase + tombol login nyata di UI, `Gate U-11`), `StepUpPinModal` 6 digit, hosting **Netlify / Firebase Hosting**, serta uji **Change Request anti-duplikasi kolom (`Gate G-12`)**.

### Langkah 2.1 — Chat A: Perencanaan (`gasly-prd`)
Lampiran sama seperti Langkah 1.1. Kirim prompt:

```text
Jalankan peran GaslyPRD berdasarkan file SKILL.md terlampir dan hasilkan 3 artifact terpisah (PRD-Final.md, MASTER-INSTRUCTIONAL-PROMPT.md, GASLY_CONTRACT.json).

Brief saya:
Buatkan sistem inventaris gudang bernama "GudangCepat" untuk pencatatan master barang dan mutasi stok keluar/masuk yang dipakai 6 staf gudang bersamaan di jam sibuk. Akses khusus internal saja (bisa login pakai passphrase atau akun Google kantor), tidak perlu halaman promosi publik. Staf bisa catat mutasi stok masuk/keluar, sedangkan Admin bisa koreksi opname stok (ADJUST) dan mengarsipkan barang. Sertakan kolom lokasi rak (storage_rack) di master barang. Gunakan React (Vite + TypeScript + Tailwind), tampilan padat data untuk kerja harian, dan rencananya mau di-deploy ke Netlify atau Firebase Hosting.
```

**Checklist Lulus Chat A:**
- [ ] `surface_profile: "INTERNAL_APP"`, `access_profile: "P4"`, `frontend_stack: "react"`, `hosting_target: "netlify"` atau `"firebase_hosting"`, `auth_google_enabled: true`.
- [ ] Preset **`dense-dashboard`** (dials sekitar `2 / 2 / 9`).
- [ ] Entitas mutasi/stok menetapkan `concurrency_mode: "DELTA_LOCK_ONLY"` untuk `IN`/`OUT` dan `OPTIMISTIC_VERSION` untuk `ADJUST`/edit master (`Gate G-11`).

### Langkah 2.2 — Chat B: Backend (`gasly-data`)
Lampiran sama seperti Langkah 1.2 (tanpa `drive-upload.md` bila tidak ada upload). Kirim Master Prompt + `GASLY_CONTRACT.json` dari Langkah 2.1 dan minta `setup.gs`, `code.gs`, `VERIFY.md`.

### Langkah 2.3 — Chat B (Lanjutan): Uji *Change Request* Anti-Duplikat Kolom (`Gate G-12`)
Di **chat yang sama** (Chat B `gasly-data`), setelah kode selesai, kirim pesan jebakan ini:

```text
Revisi tambahan: Tolong tambahkan kolom "lokasi_rak" pada sheet master barang supaya staf bisa mencari posisi rak barang.
```

**Checklist Lulus Jebakan `Gate G-12`:**
- [ ] ChatGPT **menyadari** bahwa kolom ekuivalen `storage_rack` sudah ada di `DB_SCHEMAS`, sehingga **tidak membuat kolom duplikat** `lokasi_rak` di Google Sheets (cukup memetakan label UI `"Lokasi Rak"` ke `storage_rack` atau memverifikasi dulu ke pengguna).

### Langkah 2.4 — Chat C: Frontend React (`gasly-ui`)
Buka chat baru dengan skill **`gasly-ui`** (`SKILL.md`, `contract.md`, `access-profiles.md`, `gates.md`, `presets.md`, `dials.md`, `css/dense-dashboard.css`, **`react-vite.md`**).

```text
Jalankan peran GaslyUI berdasarkan file SKILL.md dan references terlampir.
Bangun aplikasi SPA React + Vite + TypeScript + Tailwind untuk proyek GudangCepat berdasarkan spesifikasi dan GASLY_CONTRACT.json di bawah ini.

Keluarkan seluruh file utuh (### FILE: ...) mencakup package.json, index.html, src/index.css, src/lib/gasClient.ts, src/lib/driveImage.ts, src/components/StepUpPinModal.tsx, dan src/App.tsx.

Syarat wajib:
1. Langsung ke layar Login & Workspace (INTERNAL_APP, nol landing page pemasaran).
2. Karena auth_google_enabled = true, wajib render tombol/alur Google Sign-In nyata yang memanggil action 'auth.google' dengan payload { idToken } (camelCase, Gate U-11).
3. Aksi hapus/arsip barang wajib memakai StepUpPinModal 6 digit (auth.verifyPin -> stepUpToken).
4. Semua nominal/qty memakai kelas .tabular-nums dan tombol demo otomatis nonaktif bila VITE_GAS_EXEC_URL terisi (Gate W-09).

--- TEMPEL MASTER-INSTRUCTIONAL-PROMPT.md & GASLY_CONTRACT.json DI SINI ---
```

Simpan seluruh hasil ke `tmp_eval/app2-gudangcepat/`.

---

## 5. Skenario Uji 3 — Kas & Reimburse `KasPaguyuban` (`gasly-pro` Legacy `HtmlService`)

### Target Uji
Menguji jalur monolitik legacy **`gasly-pro`** (`setup.gs`, `code.gs`, `index.html`), gerbang **Mini-Spec** (Jalur 3 ide mentah menyentuh uang & role), protokol **Pengiriman 2-Tahap (`Gate L-05`)**, seed berbasis objek (`Gate G-12`), tanpa `ADMIN_PIN` default, dan `Preview Mode` di browser (`Gate L-04`).

### Langkah 3.1 — Chat Tunggal (`gasly-pro`)
1. Buka chat baru dan unggah **1 file**: `dist/flat/gasly-pro/SKILL.md`.
2. Kirim brief mentah berikut (sengaja tanpa Master Prompt untuk menguji **Mini-Spec Gate**):

```text
Jalankan peran GaslyPro (mode legacy HtmlService) berdasarkan SKILL.md terlampir.
Saya bendahara paguyuban/sekolah dan tidak mau ribet sewa atau daftar hosting luar. Tolong buatkan aplikasi pencatat kas masuk/keluar dan pengajuan reimburse bernama "KasPaguyuban" yang 100% langsung berjalan di dalam Google Apps Script (HtmlService + google.script.run, cukup 3 file: setup.gs, code.gs, index.html). Pengurus bisa input transaksi dan melihat ringkasan saldo bulanan, lalu bendahara bisa membersihkan data contoh saat mulai dipakai asli.
```

3. **Checklist Lulus Giliran 1 (Mini-Spec Gate):**
   - [ ] Karena brief menyentuh uang/saldo dan role, ChatGPT **tidak langsung menulis kode**, melainkan menampilkan **Mini-Spec** (Sheet + header `snake_case`, Role & izin, State UI, Asumsi aktif, Mode deploy GAS) dan meminta 1 konfirmasi.
4. **Balas Konfirmasi (Giliran 2 — Uji Pengiriman 2-Tahap `Gate L-05`):**
   ```text
   Mini-Spec disetujui. Silakan mulai bangun Tahap 1 dulu (setup.gs dan code.gs 100% utuh tanpa placeholder). Pastikan seed memakai buildRowFromObject_ dan tanpa PIN default.
   ```
5. **Balas Giliran 3:**
   ```text
   Lanjut index.html (100% utuh beserta Preview Mode dan VERIFY.md).
   ```
6. Simpan `setup.gs`, `code.gs`, `index.html`, dan `VERIFY.md` ke `tmp_eval/app3-kaspaguyuban/`.

---

## 6. Verifikasi Deterministik Lokal (Skrip Repo & Browser Preview)

Setelah menyalin hasil dari ChatGPT ke folder `tmp_eval/`, jalankan verifikasi otomatis di terminal lokal Anda (dari akar repo `gasly-skills`):

### A. Verifikasi Aplikasi #1 (`DapurSaji` — `html-tailwind`)
```bash
# 1. Verifikasi gerbang kontrak, Drive private, uploadNonce, envelope, dan Gate W-10
python tools/verify_output.py \
  --contract tmp_eval/app1-dapursaji/GASLY_CONTRACT.json \
  --backend tmp_eval/app1-dapursaji/setup.gs tmp_eval/app1-dapursaji/code.gs \
  --frontend tmp_eval/app1-dapursaji/index.html tmp_eval/app1-dapursaji/src/gasClient.js tmp_eval/app1-dapursaji/src/imageUploader.js tmp_eval/app1-dapursaji/src/mediaPlaceholders.js

# 2. Verifikasi panduan instalasi mandiri (Gate I-01 s/d I-06)
python tools/verify_output.py --install-guide tmp_eval/app1-dapursaji/install-guide.html

# 3. Scan mismatch action registry, blocking dialog, secret, Drive public, Math.random
python tools/check_gasly_quality.py tmp_eval/app1-dapursaji
```

**Uji Visual & Interaksi Browser (Aplikasi #1):**
1. Jalankan server lokal ringan (mis. `python -m http.server 8080 -d tmp_eval/app1-dapursaji`) dan buka `http://localhost:8080`.
2. Cek tampilan **Desktop (1280px)** dan **Mobile (375px)** di DevTools: tidak ada *horizontal overflow*, semua tombol minimal `40×40px`.
3. **Uji Fallback Media Placeholder (`Gate W-10`):** Di DevTools tab **Network**, aktifkan mode **Offline** (atau blokir domain `images.unsplash.com` / `images.pexels.com`), reload halaman $\rightarrow$ pastikan gambar beralih rapi ke SVG fallback (tidak muncul ikon gambar rusak) dan video tidak merusak layout.
4. Buka `tmp_eval/app1-dapursaji/install-guide.html` langsung via `file://`, isi 4 field konfigurasi, klik generate secret, dan cek tab **Network** di DevTools: harus **0 request jaringan**.

---

### B. Verifikasi Aplikasi #2 (`GudangCepat` — `react`)
```bash
# 1. Verifikasi kontrak + backend + frontend React
python tools/verify_output.py \
  --contract tmp_eval/app2-gudangcepat/GASLY_CONTRACT.json \
  --backend tmp_eval/app2-gudangcepat/setup.gs tmp_eval/app2-gudangcepat/code.gs \
  --frontend tmp_eval/app2-gudangcepat/src/App.tsx tmp_eval/app2-gudangcepat/src/lib/gasClient.ts tmp_eval/app2-gudangcepat/src/components/StepUpPinModal.tsx

# 2. Scan kualitas lintas file
python tools/check_gasly_quality.py tmp_eval/app2-gudangcepat
```

**Uji Build Produksi React (Opsional jika Node terpasang):**
```bash
cd tmp_eval/app2-gudangcepat
npm install
npm run build
# Pastikan folder dist/ terbentuk tanpa TypeScript / Vite build error
```

---

### C. Verifikasi Aplikasi #3 (`KasPaguyuban` — `gasly-pro` Legacy)
```bash
python tools/check_gasly_quality.py tmp_eval/app3-kaspaguyuban
```
1. Buka langsung `tmp_eval/app3-kaspaguyuban/index.html` di browser lokal.
2. Pastikan badge **Preview Mode (Simulasi)** muncul di kiri-bawah beserta tombol **"Reset data preview"**.
3. Uji tambah transaksi, edit transaksi, arsipkan transaksi (memakai modal kustom, bukan `window.confirm`), dan reset preview.

---

## 7. Uji Deployment & Runtime Google Apps Script Nyata

Setelah lulus seluruh verifikasi lokal pada Seksi 6, uji minimal 1 aplikasi secara nyata di Google Apps Script (disarankan mulai dari **Aplikasi #1 `DapurSaji`**):

1. Buat Google Spreadsheet baru $\rightarrow$ **Extensions > Apps Script**.
2. Buat file `setup.gs` dan `code.gs`, salin kode dari `tmp_eval/app1-dapursaji/`.
3. Pilih fungsi `initialSetupDatabase` di toolbar $\rightarrow$ klik **Run** $\rightarrow$ setujui izin. Pastikan semua tab Sheet, 16 baris `SEED-`, dan folder Drive terbentuk.
4. Buka **Project Settings > Script Properties**, tambahkan sementara:
   - `ADMIN_PASSPHRASE_INIT`: minimal 12 karakter (mis. `DapurSaji-Admin-2026!`)
   - `ADMIN_PIN_INIT`: 6 digit angka (mis. `482910`)
5. Kembali ke **Editor**, jalankan `setupAdminCredentials()` $\rightarrow$ cek kembali **Script Properties** dan pastikan `ADMIN_PASSPHRASE_INIT` & `ADMIN_PIN_INIT` otomatis terhapus sementara hash tersimpan.
6. Klik **Deploy > New deployment > Web app** (**Execute as: Me**, **Who has access: Anyone**) $\rightarrow$ salin URL `.../exec`.
7. Tempel URL `/exec` ke `src/config.js` (Aplikasi #1) atau `.env` (Aplikasi #2), lalu deploy frontend ke **Cloudflare Pages** / **Sevalla** / **Netlify** / **Firebase Hosting** dan uji end-to-end:
   - [ ] Buat pesanan baru + unggah foto bukti transfer $\rightarrow$ cek di Google Drive bahwa file berstatus **Private (Restricted)**, bukan *Anyone with the link*.
   - [ ] Coba cek status pesanan dengan `tracking_token` salah 5x $\rightarrow$ terkunci `FORBIDDEN` 15 menit; dengan `tracking_token` benar $\rightarrow$ status tampil.
   - [ ] Login Admin $\rightarrow$ arsipkan data dengan PIN 6 digit salah (`FORBIDDEN`) dan PIN benar (`OK`).
   - [ ] Lakukan perubahan kecil di `.gs`, lalu deploy ulang via **Deploy > Manage deployments > Edit > Version: New version > Deploy** $\rightarrow$ pastikan URL `/exec` tidak berubah.

---

## 8. Rubrik Penilaian & Pencatatan Hasil Evaluasi

Gunakan tabel ini untuk mencatat hasil uji ChatGPT ke dalam folder `evals/results/` (mis. `evals/results/2026-11-chatgpt-v2.5.0.md`):

| Kriteria | Bobot | App #1 (`html-tailwind`) | App #2 (`react`) | App #3 (`gasly-pro`) | Catatan Kegagalan / Drift |
| :--- | :---: | :---: | :---: | :---: | :--- |
| 1. Kepatuhan Arsitektur (`/exec` `text/plain` / `HtmlService`) | 20 | /20 | /20 | /20 | |
| 2. Otorisasi, `idToken`, Step-Up PIN & Anti-Enum `tracking_token` | 20 | /20 | /20 | /20 | |
| 3. Integritas Sheets (`LockService`, Delta `G-11`, Seed Objek `G-12`) & Drive `private` (`U-10`) | 20 | /20 | /20 | /20 | |
| 4. Desain Preset (bukan default `aura`), Kontras WCAG AA & Media Placeholder `W-10` | 15 | /15 | /15 | /15 | |
| 5. Anti-Fabrikasi (`U-03`) & Kejujuran Verifikasi (`NOT RUN`) | 15 | /15 | /15 | /15 | |
| 6. Kelengkapan Kode (0 elipsis) & Lulus `verify_output.py` + `check_gasly_quality.py` | 10 | /10 | /10 | /10 | |
| **Total Skor (Target Lulus >= 95)** | **100** | **/100** | **/100** | **/100** | |

### Audit Estetika & Product Craft (Standar SaaS $49/Bulan — Target Lulus >= 25/30)

| Aspek Visual & UX | Bobot | Kriteria Lulus Penuh | App #1 | App #2 | App #3 |
| :--- | :---: | :--- | :---: | :---: | :---: |
| **1. First-Impression & App Shell** | 6 | Langsung terasa seperti SaaS komersial; App Shell/Split Hero rapi; form di Drawer/Modal (tidak menumpuk kasar). | /6 | /6 | /6 |
| **2. Ikonografi & Micro-Surface** | 6 | 100% inline SVG presisi (0 emoji di UI chrome), hairline borders, subtle shadow, spasi 8px konsisten. | /6 | /6 | /6 |
| **3. Bento KPI & Data Table UX** | 6 | 3–4 KPI *computed live* (`.tabular-nums`, 0 angka fiktif), toolbar search + filter pills + status pills lembut. | /6 | /6 | /6 |
| **4. Responsivitas Mobile (`375px`)** | 6 | Stacked Card View rapi di HP (tanpa scroll horizontal kaku), semua tombol `>= 40×40px`, 0 overflow. | /6 | /6 | /6 |
| **5. Polish State & Media (`W-10`)** | 6 | Skeleton menyerupai layout asli, Empty State ber-SVG, Sonner toast, foto/video placeholder kohesif + fallback offline rapi. | /6 | /6 | /6 |
| **Total Skor Estetika** | **30** | **Layak Jual Komersial (>= 25/30)** | **/30** | **/30** | **/30** |

### Cara Menindaklanjuti Temuan dari Uji ChatGPT
- Jika ChatGPT **melanggar suatu gate pada 1 dari 3 aplikasi**, periksa apakah file referensi yang relevan ikut terlampir di chat.
- Jika ChatGPT **tetap melanggar meskipun file skill lengkap sudah dilampirkan**, tambahkan aturan yang lebih eksplisit (1–2 kalimat tegas) di bagian **Hard Gates** `src/skills/<skill>/SKILL.md`, tambahkan pola deteksinya di `tools/verify_output.py`, lalu jalankan ulang `python build_skills.py`.