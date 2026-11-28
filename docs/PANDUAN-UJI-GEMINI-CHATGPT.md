# Panduan Pengujian End-to-End GASLY Skills di Gemini & ChatGPT (Non-Agent)

**Target Versi Skill:** `2.5.0` (`KB_VERSION: 2.1.0`)  
**Platform Uji:** **Google Gemini Web** (`gemini.google.com` — Gems / Chat + Canvas) & **ChatGPT Web** (`chatgpt.com` — Projects / Chat + Canvas)  
**Aplikasi Uji:**
1. **Dompet Digital (`SakuRapi`)** — `html-tailwind` (`dense-dashboard`, `P4`)
2. **Task Tracker Slack + Jira (`SprintChat`)** — `react` Vite (`aura`, `P4`)
3. **Habit Tracker (`RutinKu`)** — `gasly-pro` Legacy Monolitik `HtmlService` (`warm-friendly`)

---

## Daftar Isi
1. [Persiapan Repositori & Build Paket `dist/`](#1-persiapan-repositori--build-paket-dist)
2. [Setup Lingkungan Uji di Gemini Web vs ChatGPT Web](#2-setup-lingkungan-uji-di-gemini-web-vs-chatgpt-web)
3. [Aplikasi #1 — Dompet Digital `SakuRapi` (`html-tailwind`)](#3-aplikasi-1--dompet-digital-sakurapi-html-tailwind)
4. [Aplikasi #2 — Task Tracker Slack + Jira `SprintChat` (`react`)](#4-aplikasi-2--task-tracker-slack--jira-sprintchat-react)
5. [Aplikasi #3 — Habit Tracker `RutinKu` (`gasly-pro` Legacy)](#5-aplikasi-3--habit-tracker-rutinku-gasly-pro-legacy)
6. [Verifikasi Deterministik Lokal & Audit Visual SaaS $49/Bln](#6-verifikasi-deterministik-lokal--audit-visual-saas-49bln)
7. [Alur Deployment End-to-End (`script.new` → GitHub → Hosting)](#7-alur-deployment-end-to-end-scriptnew--github--hosting)
8. [Matriks Skor Head-to-Head: Gemini vs ChatGPT](#8-matriks-skor-head-to-head-gemini-vs-chatgpt)

---

## 1. Persiapan Repositori & Build Paket `dist/`

Pastikan seluruh pembaruan (`v2.5.0`, `saas-craft.md`, `setupAppEnvironment()`, `guide-template.html` Soft Neo-Brutalist, dan `react-vite.md`) sudah dikompilasi dan lulus tes lokal:

```bash
python build_skills.py
python tools/check_contrast.py
python tools/verify_output.py --install-guide dist/modular/gasly-deploy-guide/references/guide-template.html
python -m unittest discover -s tests -v
TZ=Asia/Jakarta node tests/harness.js
TZ=Asia/Jakarta node tests/harness_gas.js
TZ=Asia/Jakarta node tests/harness_install.js
```

### Paket File yang Disiapkan untuk Diunggah per Peran

| Peran Skill | File yang Diunggah dari `dist/` |
| :--- | :--- |
| **1. `gasly-prd`** | `dist/flat/gasly-prd/SKILL.md`, `schemas/gasly-contract.schema.json`, `src/core/facts.md` |
| **2. `gasly-data`** | `dist/modular/gasly-data/SKILL.md` + `references/`: `contract.md`, `access-profiles.md`, `gates.md`, `config.md`, `router-and-envelope.md`, `auth-and-ratelimit.md`, `sheets-repository.md`, `drive-upload.md` |
| **3. `gasly-ui`** | `dist/modular/gasly-ui/SKILL.md` + `references/`: `contract.md`, `access-profiles.md`, `gates.md`, `presets.md`, `dials.md`, **`saas-craft.md`**, **1 CSS preset target** (`css/<preset>.css`), dan **1 adapter stack** (`html-tailwind.md` atau `react-vite.md`) |
| **4. `gasly-deploy-guide`** | `dist/modular/gasly-deploy-guide/SKILL.md` + `references/`: `config.md`, `facts.md`, `gates.md`, `install-steps.md`, `guide-template.html` |
| **5. `gasly-pro` (Legacy)** | `dist/flat/gasly-pro/SKILL.md` + `src/design/saas-craft.md` |

---

## 2. Setup Lingkungan Uji di Gemini Web vs ChatGPT Web

Gunakan pola **Clean Room (1 Chat = 1 Peran Skill)** agar tidak terjadi *context drift* saat berpindah dari tahap PRD ke Backend, Frontend, dan Panduan Deploy.

### A. Cara Pasang di Google Gemini Web (`gemini.google.com`)
- **Opsi Terbaik — Gemini Gems:**
  1. Buka **Gem Manager > New Gem** dan buat 5 Gem: `GASLY-PRD`, `GASLY-Data`, `GASLY-UI`, `GASLY-Deploy`, dan `GASLY-Pro-Legacy`.
  2. Pada masing-masing Gem, unggah file referensi dari tabel Seksi 1 ke bagian **Knowledge**.
  3. Isi **Instructions** Gem dengan blok instruksi universal di bawah ini.
- **Opsi Chat Biasa:** Klik **New Chat**, lampirkan file via ikon `+`, dan gunakan **Canvas** khusus untuk mempratinjau langsung `index.html` (App #1 & App #3) dan `install-guide.html`.

### B. Cara Pasang di ChatGPT Web (`chatgpt.com`)
- **Opsi Terbaik — ChatGPT Projects / Custom GPT:**
  1. Buat 5 Project dengan nama yang sama (`GASLY-PRD`, `GASLY-Data`, `GASLY-UI`, `GASLY-Deploy`, `GASLY-Pro-Legacy`).
  2. Unggah file referensi ke **Project Files** dan tempel blok instruksi universal di **Project Instructions**.
- **Opsi Chat Biasa:** Gunakan **New Chat** (disarankan *Temporary Chat* agar bebas bias memori lama) dan lampirkan file via ikon `+`.

### Blok Instruksi Universal (Tempel di Instructions Gem / Project)
```text
Patuhi 100% aturan keras (Hard Gates) di file SKILL.md dan seluruh file referensi terlampir.
Dilarang memotong kode dengan elipsis (...), placeholder TODO, atau melewati gerbang keamanan.
Keluarkan setiap file secara utuh dengan penanda header "### FILE: path/to/file.ext" dalam Bahasa Indonesia.
Jika diminta membangun antarmuka, wajib terapkan standar estetika SaaS $49/bulan di saas-craft.md (nol emoji di tombol/navigasi, Bento KPI live, Slide-Over Drawer/Modal untuk form, toolbar filter/pill, Mobile Card View, dan Sonner toast).
```

---

## 3. Aplikasi #1 — Dompet Digital `SakuRapi` (`html-tailwind`)

**Yang Diuji:** `html-tailwind`, `P4` (`internal-only`), `dense-dashboard`, **Konkurensi Delta saldo (`Gate G-11`)**, upload bukti struk **Drive `private` (`Gate U-10`)** + `uploadNonce` (`Gate G-09` & `W-09`), **Step-Up PIN 6 digit** (`auth.verifyPin`), `<iconify-icon icon="lucide:...">`, `setupAppEnvironment()` standalone, dan `gasly-deploy-guide` Soft Neo-Brutalist.

### Step 1.1 — Chat `GASLY-PRD` (Salin ke Gemini & ChatGPT)
```text
Jalankan peran GaslyPRD. Hasilkan 3 artifact terpisah: PRD-Final.md, MASTER-INSTRUCTIONAL-PROMPT.md, dan GASLY_CONTRACT.json.

Brief Produk:
Buatkan aplikasi Dompet Digital & Manajemen Kas bernama "SakuRapi" untuk pencatatan multi-kantong saldo (Utama, Operasional, Tabungan, Darurat), transaksi masuk/keluar, transfer antar-kantong, batas anggaran bulanan, dan lampiran foto bukti struk/transfer ke Google Drive.
Catatan penting:
- Ini adalah pencatatan dompet digital & kas pribadi/tim berbasis Google Sheets (bukan integrasi rekening bank otomatis).
- Akses internal saja (login passphrase + opsional Google Sign-In), tanpa halaman promosi publik.
- Mutasi saldo masuk/keluar/transfer harus aman dari saldo minus dan tidak gagal konflik palsu saat dicatat berurutan cepat.
- Foto struk/bukti bersifat rahasia (private di Google Drive).
- Hapus transaksi wajib konfirmasi PIN 6 digit.
- Stack: HTML + Tailwind (setara kualitas estetika SaaS $49/bulan seperti Wise/Stripe Dashboard), target hosting: Cloudflare Pages atau Sevalla.
```

### Step 1.2 — Chat `GASLY-Data` (Backend Standalone `.gs`)
```text
Jalankan peran GaslyData. Bangun kode backend Google Apps Script V8 yang 100% utuh (### FILE: setup.gs, ### FILE: code.gs, ### FILE: VERIFY.md) berdasarkan Master Prompt dan GASLY_CONTRACT.json di bawah.

Kewajiban kritis:
1. setupAppEnvironment() wajib mendukung mode Standalone (script.new): otomatis membuat Google Spreadsheet (SPREADSHEET_ID) dan Folder Google Drive (DRIVE_ROOT_FOLDER_ID) secara mandiri bila belum ada, lalu mencetak URL keduanya ke Execution Log.
2. Semua operasi mutasi saldo kantong (INCOME, EXPENSE, TRANSFER) memakai LockService + cek saldo akhir >= 0 (DELTA_LOCK_ONLY, Gate G-11), tanpa false CONFLICT.
3. Upload bukti struk wajib memverifikasi uploadNonce di file.ticket dan mengunci file Drive ke DriveApp.Access.PRIVATE (Gate U-10).
4. Aksi hapus/arsip transaksi & purgeSeed wajib memverifikasi stepUpToken dari auth.verifyPin.
5. Seed 16 transaksi & 4 kantong awal wajib berbasis Array of Objects + buildRowFromObject_ (Gate G-12).

--- TEMPEL MASTER-INSTRUCTIONAL-PROMPT.md & GASLY_CONTRACT.json DI SINI ---
```

### Step 1.3 — Chat `GASLY-UI` (Frontend `html-tailwind` Setara SaaS $49/Bln)
```text
Jalankan peran GaslyUI. Bangun frontend SakuRapi menggunakan stack html-tailwind dan preset dense-dashboard sesuai standar saas-craft.md ($49/bulan).

Keluarkan file 100% utuh:
### FILE: src/preset-tokens.css
### FILE: src/config.js
### FILE: src/gasClient.js
### FILE: src/imageUploader.js
### FILE: index.html
### FILE: package.json

Syarat estetika & fungsional wajib:
1. App Shell lengkap: Sidebar kiri (desktop) + Mobile Drawer (<1024px) + Sticky Topbar (judul, Theme Toggle Light/Dark, tombol Refresh, CTA primer "+ Catat Transaksi").
2. Form tambah transaksi & transfer diletakkan di Slide-Over Drawer kanan (BUKAN menumpuk terbuka di atas tabel).
3. Bento KPI Strip (4 kartu: Total Saldo Semua Kantong, Pemasukan Bulan Ini, Pengeluaran Bulan Ini, Rasio Anggaran Terpakai) dihitung live dari data + .tabular-nums + kartu saldo tiap kantong (wallets) dengan micro progress bar.
4. Gunakan Iconify Web Component (<iconify-icon icon="lucide:..."> dengan width/height terkunci & aria-hidden="true") — NOL emoji di UI chrome dan NOL <img src="https://api.iconify.design/...">!
5. Toolbar tabel berisi Search + Filter Pill (Semua, Masuk, Keluar, Transfer) + Status Pill lembut + Mobile Stacked Card View (<768px).
6. Alur unggah struk meneruskan uploadNonce ke file.ticket, memeriksa uploadRes.status === 'success' && uploadRes.code === 'OK', menyediakan tombol RECOVERY jika gagal, dan menampilkan tautan aman Drive (private) bukan thumbnail publik.
7. Hapus transaksi memakai modal kustom PIN 6 digit (auth.verifyPin -> stepUpToken), nol window.confirm().
8. Sertakan Preview Mode otomatis saat EXEC_URL belum diisi agar index.html langsung interaktif dibuka di browser/Canvas.

--- TEMPEL MASTER-INSTRUCTIONAL-PROMPT.md & GASLY_CONTRACT.json DI SINI ---
```

### Step 1.4 — Chat `GASLY-Deploy` (Panduan Soft Neo-Brutalist)
```text
Jalankan peran GaslyDeployGuide. Buat SATU file mandiri ### FILE: install-guide.html untuk proyek SakuRapi berdasarkan GASLY_CONTRACT.json berikut.
Wajib menggunakan tema Soft Neo-Brutalist (minimalist, soft, clean) dari guide-template.html, tombol shortcut hyperlink (script.new, github.com/new, Cloudflare Pages, Sevalla, Netlify, Vercel, Firebase), alur: Setup Backend Standalone (Run setupAppEnvironment) -> Buat Repo GitHub Baru & Upload Frontend -> Import Repo GitHub ke Hosting, serta 100% lulus Gate I-01 s/d I-06 (nol CDN, nol jaringan, nol innerHTML).

--- TEMPEL GASLY_CONTRACT.json DI SINI ---
```

---

## 4. Aplikasi #2 — Task Tracker Slack + Jira `SprintChat` (`react`)

**Yang Diuji:** `react` (Vite + TS + Tailwind + `lucide-react`), `P4` (`internal-only`), preset **`aura`** *(dark mode default)*, arsitektur 3-panel ala Linear + Slack, smart polling aman kuota GAS (0 WebSocket palsu), `auth.google` (`idToken` camelCase, `Gate U-11`), `StepUpPinModal`, dan uji **Change Request (`Gate G-12`)**.

### Step 2.1 — Chat `GASLY-PRD`
```text
Jalankan peran GaslyPRD. Hasilkan 3 artifact terpisah: PRD-Final.md, MASTER-INSTRUCTIONAL-PROMPT.md, dan GASLY_CONTRACT.json.

Brief Produk:
Buatkan aplikasi Task Tracker tim bernama "SprintChat" yang menggabungkan pengalaman Kanban/Issue Tracker ala Jira (kolom Backlog, In Progress, Review, Done, prioritas P0-P3, assignee, due date, sprint) dengan Ruang Diskusi & Thread Kanal ala Slack (kanal per divisi/proyek + thread komentar langsung di setiap tiket).
Catatan penting:
- Akses khusus tim internal (P4): login passphrase atau akun Google kantor (auth.google ENABLED).
- Karena backend Google Apps Script tidak mendukung WebSocket real-time, gunakan sinkronisasi manual + smart polling ringan (tiap 25 detik hanya saat tab browser aktif) agar aman dari batas 30 eksekusi simultan GAS.
- Stack: React (Vite + TypeScript + Tailwind + lucide-react), preset gelap modern "aura" setara Linear + Slack ($49/bulan).
- Target hosting: Netlify, Cloudflare Pages, atau Vercel Pro (via import repo GitHub).
```

### Step 2.2 — Chat `GASLY-Data`
```text
Jalankan peran GaslyData. Bangun ### FILE: setup.gs, ### FILE: code.gs, dan ### FILE: VERIFY.md (100% utuh) untuk SprintChat.
Pastikan:
1. setupAppEnvironment() mendukung standalone script.new (otomatis membuat Spreadsheet & Folder Drive).
2. Sheet CHANNELS, TASKS (optimistic version untuk edit status/assignee), dan MESSAGES (append-only agar balasan thread tidak bentrok CONFLICT).
3. auth.google membaca req.payload.idToken (camelCase) dan memverifikasi iss, aud, email_verified, exp, serta USERS/ALLOWLIST.
4. tasks.delete mewajibkan verifyAndConsumeStepUp_(req, 'tasks.delete').

--- TEMPEL MASTER-INSTRUCTIONAL-PROMPT.md & GASLY_CONTRACT.json DI SINI ---
```

### Step 2.3 — Uji Jebakan *Change Request* (Di Chat `GASLY-Data` yang Sama)
Setelah kode selesai, kirim pesan ini untuk menguji `Gate G-12`:
```text
Revisi: Tolong tambahkan kolom "tingkat_prioritas" pada sheet TASKS supaya tim bisa memfilter tugas mendesak.
```
*(Target lulus: LLM mendeteksi bahwa kolom ekuivalen `priority` sudah ada di `TASKS`, tidak membuat kolom duplikat).*

### Step 2.4 — Chat `GASLY-UI` (`react-vite.md` + `saas-craft.md`)
```text
Jalankan peran GaslyUI. Bangun aplikasi SPA React + Vite + TypeScript + Tailwind untuk SprintChat menggunakan referensi react-vite.md, aura.css, dan saas-craft.md ($49/bulan).

Keluarkan seluruh file utuh (### FILE: package.json, index.html, src/index.css, src/lib/gasClient.ts, src/lib/mediaPlaceholders.ts, src/components/StepUpPinModal.tsx, src/App.tsx, dan komponen modular yang dibutuhkan).

Syarat estetika & fungsional wajib:
1. Tampilan 3-Area setara Linear + Slack (Dark Mode "aura" default + toggle Light Mode):
   - Kiri: Workspace & Channel Sidebar (#general, #engineering, #product, #design) + switcher tampilan "Kanban Board" vs "Channel Chat".
   - Tengah: Kanban Board (Backlog / In Progress / Review / Done) dengan filter prioritas & pencarian cepat, atau Feed Diskusi Kanal dengan composer pesan.
   - Kanan (Slide-Over Drawer): Detail Tiket lengkap (ubah status, assignee, prioritas) + Thread Diskusi per tiket secara terpadu.
2. Gunakan ikon dari lucide-react (0 emoji di UI chrome), badge prioritas P0-P3 yang halus, dan Mobile Responsive Tabs (<768px).
3. Wajib merender tombol Sign in with Google nyata yang memanggil action 'auth.google' dengan payload { idToken } (Gate U-11).
4. Smart polling 25 detik hanya berjalan saat document.visibilityState === 'visible' + tombol manual "Sync Sekarang" dengan timestamp terakhir.
5. Sertakan mode simulasi otomatis saat VITE_GAS_EXEC_URL kosong agar langsung bisa diuji penuh di lokal (terisolasi di produksi, Gate W-09).

--- TEMPEL MASTER-INSTRUCTIONAL-PROMPT.md & GASLY_CONTRACT.json DI SINI ---
```

---

## 5. Aplikasi #3 — Habit Tracker `RutinKu` (`gasly-pro` Legacy `HtmlService`)

**Yang Diuji:** Jalur monolitik 3-file (`setup.gs`, `code.gs`, `index.html`) tanpa hosting eksternal, preset **`warm-friendly`**, akurasi tanggal ber-offset `+07:00` pada streak & heatmap 30 hari (`Gate G-02`), protokol **Pengiriman 2-Tahap (`Gate L-05`)**, `buildRowFromObject_` (`Gate G-12`), `Gate W-10` visual inspiratif dengan fallback SVG, dan `Preview Mode` (`Gate L-04`).

### Step 3.1 — Chat Tunggal `GASLY-Pro-Legacy`
Kirim brief mentah ini ke Gem/Project `GASLY-Pro-Legacy` (tanpa Master Prompt, untuk menguji **Mini-Spec Gate** & **2-Stage Delivery**):

```text
Jalankan peran GaslyPro (mode legacy HtmlService).
Saya ingin aplikasi Habit Tracker harian bernama "RutinKu" yang 100% langsung berjalan di Google Apps Script (HtmlService + google.script.run, cukup 3 file: setup.gs, code.gs, index.html) tanpa sewa hosting luar.
Fitur:
- Daftar kebiasaan harian (mis. Olahraga 30 mnt, Baca Buku, Minum Air 2L, Fokus Deep Work) dengan target mingguan & kategori.
- Tombol check-in harian sekali klik yang menghitung Current Streak, Best Streak, dan persentase konsistensi 7 & 30 hari.
- Visualisasi Heatmap / Grid Kalender 30 hari terakhir (berwarna hangat sesuai preset warm-friendly, setara kualitas aplikasi Habitify/Streaks $49/tahun).
- Boleh pasang 1 kartu cover visual hangat dari Unsplash/Pexels (Gate W-10 + fallback SVG offline, tanpa source.unsplash.com) dan ikon <iconify-icon icon="lucide:...">.
- Tombol reset/bersihkan data contoh bagi pemilik saat mulai dipakai asli.
```

### Step 3.2 — Konfirmasi Mini-Spec & Pengiriman 2-Tahap
1. Pastikan LLM menampilkan **Mini-Spec** terlebih dahulu (karena ada perubahan state & kontrol pemilik) — jangan langsung lompat ke kode jika aturan Mini-Spec terpicu.
2. Balas:
   ```text
   Mini-Spec disetujui. Silakan keluarkan Tahap 1 dulu: setup.gs (dengan buildRowFromObject_ untuk 16-20 log historis 30 hari terakhir & setupAppEnvironment) dan code.gs (100% utuh tanpa placeholder).
   ```
3. Setelah Tahap 1 selesai, balas:
   ```text
   Lanjut index.html (100% utuh dengan tampilan warm-friendly standar saas-craft.md, heatmap 30 hari, Preview Mode, dan VERIFY.md).
   ```

---

## 6. Verifikasi Deterministik Lokal & Audit Visual SaaS $49/Bln

Simpan hasil kedua LLM ke struktur folder berikut agar bisa dibandingkan secara objektif:

```text
tmp_eval/
├── gemini/
│   ├── app1-sakurapi/
│   ├── app2-sprintchat/
│   └── app3-rutinku/
└── chatgpt/
    ├── app1-sakurapi/
    ├── app2-sprintchat/
    └── app3-rutinku/
```

### A. Jalankan Verifier Otomatis Repo (Ganti `<llm>` dengan `gemini` lalu `chatgpt`)

```bash
# App #1: SakuRapi (html-tailwind + install-guide)
python tools/verify_output.py \
  --contract tmp_eval/<llm>/app1-sakurapi/GASLY_CONTRACT.json \
  --backend tmp_eval/<llm>/app1-sakurapi/setup.gs tmp_eval/<llm>/app1-sakurapi/code.gs \
  --frontend tmp_eval/<llm>/app1-sakurapi/index.html tmp_eval/<llm>/app1-sakurapi/src/gasClient.js tmp_eval/<llm>/app1-sakurapi/src/imageUploader.js
python tools/verify_output.py --install-guide tmp_eval/<llm>/app1-sakurapi/install-guide.html
python tools/check_gasly_quality.py tmp_eval/<llm>/app1-sakurapi

# App #2: SprintChat (react)
python tools/verify_output.py \
  --contract tmp_eval/<llm>/app2-sprintchat/GASLY_CONTRACT.json \
  --backend tmp_eval/<llm>/app2-sprintchat/setup.gs tmp_eval/<llm>/app2-sprintchat/code.gs \
  --frontend tmp_eval/<llm>/app2-sprintchat/src/App.tsx tmp_eval/<llm>/app2-sprintchat/src/lib/gasClient.ts tmp_eval/<llm>/app2-sprintchat/src/components/StepUpPinModal.tsx
python tools/check_gasly_quality.py tmp_eval/<llm>/app2-sprintchat

# App #3: RutinKu (gasly-pro legacy)
python tools/check_gasly_quality.py tmp_eval/<llm>/app3-rutinku
```

### B. Uji Visual & UX Langsung di Browser (Desktop `1280px` & Mobile `375px`)
1. **App #1 (`SakuRapi`) & App #3 (`RutinKu`):** Jalankan `python -m http.server 8080 -d tmp_eval/<llm>/app1-sakurapi` (atau buka langsung di Gemini/ChatGPT Canvas).
2. **App #2 (`SprintChat` React):** Jalankan `cd tmp_eval/<llm>/app2-sprintchat && npm install && npm run dev` (lalu uji `npm run build` memastikan 0 error TypeScript).
3. **Uji Offline Fallback (`Gate W-10`):** Matikan jaringan di DevTools (`Network > Offline`), reload halaman $\rightarrow$ pastikan gambar dummy beralih halus ke SVG fallback dan tombol tutup modal tetap terlihat.
4. **Uji Panduan Deploy (`install-guide.html`):** Buka via `file://`, cek tema **Soft Neo-Brutalist**, klik tombol shortcut, ganti tab Hosting, dan pastikan tab **Network DevTools = 0 request**.

---

## 7. Alur Deployment End-to-End (`script.new` → GitHub → Hosting)

Pilih minimal 1 pemenang (mis. `SakuRapi` atau `SprintChat`) untuk diverifikasi langsung di runtime nyata menggunakan `install-guide.html` yang baru dihasilkan:

1. **Fase 1 — Backend Standalone di Google Apps Script:**
   - Klik shortcut **`https://script.new`** $\rightarrow$ tempel `setup.gs` & `code.gs` $\rightarrow$ Simpan.
   - Pilih **`setupAppEnvironment`** di dropdown toolbar **Run** $\rightarrow$ klik **Run** $\rightarrow$ setujui izin $\rightarrow$ cek **Execution Log** untuk mendapatkan URL Spreadsheet & Folder Drive yang dibuat otomatis.
   - Buka **Project Settings > Script Properties** $\rightarrow$ isi `ADMIN_PASSPHRASE_INIT` ($\ge 12$ kar) & `ADMIN_PIN_INIT` (6 digit) $\rightarrow$ klik **Run `setupAppEnvironment`** sekali lagi hingga log berstatus `READY_TO_DEPLOY` dan properti `*_INIT` terhapus otomatis.
   - Klik **Deploy > New deployment > Web app** (**Execute as: Me**, **Who has access: Anyone**) $\rightarrow$ salin URL `.../exec`.
2. **Fase 2 — Upload Frontend ke Repo GitHub Baru:**
   - Klik shortcut **`https://github.com/new`** $\rightarrow$ buat repo baru $\rightarrow$ masukkan URL `/exec` ke `src/config.js` (untuk `html-tailwind`) atau siapkan `VITE_GAS_EXEC_URL` (untuk `react`) $\rightarrow$ unggah file frontend ke branch `main`.
3. **Fase 3 — Import Repo GitHub ke Hosting Pilihan:**
   - Klik shortcut platform pilihan (**Cloudflare Pages** / **Netlify** / **Sevalla** / **Vercel** / **Firebase Hosting**) $\rightarrow$ *Connect GitHub* $\rightarrow$ pilih repo $\rightarrow$ atur Build Command & Output Dir (`dist` untuk React, `.` untuk HTML+Tailwind) + Env Var $\rightarrow$ klik **Deploy**.
4. **Fase 4 — Verifikasi Live:**
   - Uji login passphrase & Google Sign-In, uji mutasi saldo/task/habit, uji upload struk (cek di Drive bahwa izin file **Private/Restricted**), dan uji hapus dengan PIN 6 digit.

---

## 8. Matriks Skor Head-to-Head: Gemini vs ChatGPT

Salin matriks berikut ke `evals/results/2026-11-gemini-vs-chatgpt-v2.5.0.md` untuk merekam bukti hasil uji Anda:

### A. Skor Engineering & Keamanan (Maks. 100 — Target Lulus >= 95)

| Kriteria | Bobot | Gemini (App 1 / 2 / 3) | ChatGPT (App 1 / 2 / 3) | Catatan Kegagalan / Drift |
| :--- | :---: | :---: | :---: | :--- |
| 1. Arsitektur (`/exec` `text/plain` / `HtmlService`, smart polling GAS) | 20 | / / | / / | |
| 2. Auth (`idToken` camelCase), Step-Up PIN 6 digit & `setupAppEnvironment()` standalone | 20 | / / | / / | |
| 3. Integritas Sheets (`LockService`, Delta `G-11`, Seed Objek `G-12`, Drive `private` `U-10`) | 20 | / / | / / | |
| 4. Kepatuhan Preset (bukan default `aura`), WCAG AA & Media `W-10` | 15 | / / | / / | |
| 5. Anti-Fabrikasi (`U-03`), Kejujuran Batasan GAS & `NOT RUN` | 15 | / / | / / | |
| 6. Kelengkapan Kode (0 elipsis) & Lulus `verify_output.py` + `check_gasly_quality.py` | 10 | / / | / / | |
| **Total Skor Teknis** | **100** | **/ / ** | **/ / ** | |

### B. Skor Estetika & UX Standar SaaS $49/Bulan (Maks. 30 — Target Lulus >= 25)

| Dimensi Visual & UX (`saas-craft.md`) | Bobot | Gemini (App 1 / 2 / 3) | ChatGPT (App 1 / 2 / 3) | Catatan Visual |
| :--- | :---: | :---: | :---: | :--- |
| 1. **First-Impression & App Shell** (Drawer/Modal form, 3-pane Slack+Jira, Heatmap Habit) | 6 | / / | / / | |
| 2. **Ikonografi Presisi** (`lucide-react` / `<iconify-icon>`, 0 emoji di UI chrome) | 6 | / / | / / | |
| 3. **Bento KPI & Data Density** (Computed live, `.tabular-nums`, Status Pill lembut) | 6 | / / | / / | |
| 4. **Mobile UX (`375px`)** (Stacked Card View, 0 horizontal overflow, target sentuh >=40px) | 6 | / / | / / | |
| 5. **Polish State, Media `W-10` & Deploy Guide** (Skeleton, Sonner Toast, Soft Neo-Brutalist guide) | 6 | / / | / / | |
| **Total Skor Estetika ($49/Bln)** | **30** | **/ / ** | **/ / ** | |

### Cara Iterasi Setelah Benchmark Selesai
- Jika **salah satu LLM** berulang kali lupa aturan tertentu (misal lupa `<iconify-icon>` atau lupa `setupAppEnvironment()` auto-create Spreadsheet), tandai pola tersebut di kolom *Catatan Kegagalan*, lalu perkuat kalimat pemicunya di `src/skills/*/SKILL.md` dan tambahkan cek deterministiknya di `tools/verify_output.py`, kemudian jalankan ulang `python build_skills.py`.