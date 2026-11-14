# Gasly Skills

Paket keahlian (*agent skill pack*) berbahasa Indonesia berlisensi MIT untuk merancang dan membangun aplikasi web produksi yang menggunakan **Google Sheets** sebagai database dan **Google Drive** sebagai penyimpanan file melalui **Google Apps Script**.

- [Katalog Skill & Pemilih Paket (`CATALOG.md`)](CATALOG.md)
- [Catatan Perubahan (`CHANGELOG.md`)](CHANGELOG.md)
- [Log Verifikasi, Asumsi & Checklist Manual (`VERIFY.md`)](VERIFY.md)
- [Referensi Eksternal & Lisensi (`docs/REFERENCES.md`)](docs/REFERENCES.md)
- [Indeks Agen & Crawler (`llms.txt`)](llms.txt)
- [Panduan Kontribusi (`CONTRIBUTING.md`)](CONTRIBUTING.md)
- [Kebijakan Keamanan (`SECURITY.md`)](SECURITY.md)
- [Kode Etik (`CODE_OF_CONDUCT.md`)](CODE_OF_CONDUCT.md)
- [Manifest Distribusi & SHA-256 (`dist/manifest.json`)](dist/manifest.json)

---

## Arsitektur Utama (Decoupled Frontend + Headless Apps Script `/exec`)

```text
Browser / Client (Stack Frontend Apa Pun)
   │
   ├── HTTP POST (Content-Type: text/plain;charset=utf-8) ──► Apps Script Web App (.../exec)
   └── HTTP GET  (Query Params untuk Baca Publik/Idempoten) ─►   ├── Google Sheets (Database)
                                                                 └── Google Drive  (File & Foto)

Payment / External Webhook
   └──► Fungsi Serverless Kecil (Verifikasi Signature) ──────► Apps Script Web App (Shared Secret di Body)
```

1. **Satu Konfigurasi Frontend:** Aplikasi frontend hidup di luar Google Apps Script dan hanya membutuhkan satu nilai konfigurasi publik, yaitu URL Web App (`https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`).
2. **Keamanan Terpusat di Apps Script:** Karena URL `/exec` bersifat publik di dalam bundle browser, setiap keputusan otentikasi, otorisasi peran (*role*), validasi skema, pemeriksaan *magic bytes* file, dan *rate limiting* dieksekusi di dalam Google Apps Script (`gasly-data`).
3. **Tiga Lapisan Desain:**
   - **Lapisan 1 — Tokens:** Sumber kebenaran JSON netral (`src/design/presets/*.tokens.json`) dan ekspor variabel CSS (`src/design/css/*.css`).
   - **Lapisan 2 — Character:** 4 preset visual yang lulus kontras WCAG AA (`editorial-light`, `dense-dashboard`, `warm-friendly`, dan `aura` — `aura` tidak pernah menjadi default otomatis) ditambah 3 dials (`DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY` berskala `1–10`).
   - **Lapisan 3 — Gates:** Gerbang kualitas yang diklasifikasikan ke dalam `UNIVERSAL`, `GAS-ONLY`, `WEB-ONLY`, dan `LEGACY-HTMLSERVICE` (`src/core/gates.md`).

---

## Empat Skill di Dalam Repositori

| Skill | Status | Peran Utama | Paket di `dist/` |
| :--- | :---: | :--- | :--- |
| **`gasly-prompt`** | **Aktif** | **Planner / Arsitek:** Menerjemahkan ide bisnis menjadi `MASTER INSTRUCTIONAL PROMPT` 8-seksi (Access Profile `P1`–`P4`, Design Preset + 3 Dials, Stack, Data Schema, Upload Needs). | `dist/modular/gasly-prompt`<br>`dist/flat/gasly-prompt` |
| **`gasly-data`** | **Aktif** | **Headless Backend Engineer:** Membangun API Google Apps Script (`doPost`/`doGet` via `ContentService`) di atas Google Sheets dan Google Drive (`file.ticket` + `file.upload`). | `dist/modular/gasly-data` |
| **`gasly-ui`** | **Aktif** | **Frontend & Design Engineer:** Membangun aplikasi frontend eksternal yang berbicara ke `/exec` menggunakan adapter penuh (`html-tailwind`, `nextjs`+`shadcn`, `astro`) atau mode pewarisan (`INHERIT` untuk 15 stack lainnya). | `dist/modular/gasly-ui` |
| **`gasly-pro`** | **LEGACY** | **GAS-Hosted `HtmlService` Engineer:** Dipertahankan khusus untuk pengguna yang secara eksplisit meminta aplikasi monolitik di dalam iframe Google Apps Script (`HtmlService` + `google.script.run`). | `dist/modular/gasly-pro`<br>`dist/flat/gasly-pro`<br>`dist/flat-lite/gasly-pro` |

---

## Dukungan Frontend Stack (`gasly-ui`)

- **Adapter Penuh (Tahap 1):**
  1. `html-tailwind` (mencakup pemisahan prototipe Play CDN vs kompilasi CSS CLI produksi)
  2. `nextjs` + `shadcn` (pembacaan publik saat build/ISR revalidation, penulisan dari browser)
  3. `astro` (pembacaan publik saat build-time, penulisan dari *client islands*)
- **Direncanakan (Tahap Berikutnya — `src/stacks/PLANNED.md`):**
  - `react` (Vite) + `shadcn`, `nuxtjs` + `nuxt-ui`, serta profil akses `P2` (`public-with-accounts` via Supabase Auth).
- **Mode Pewarisan Token & Gates (`STACK_MODE: INHERIT` — `src/stacks/INHERIT.md`):**
  - `angular`, `avalonia`, `flutter`, `javafx`, `jetpack-compose`, `laravel`, `react-native`, `svelte`, `swiftui`, `threejs`, `uno`, `uwp`, `vue`, `winui`, `wpf`.

---

## Build, Verifikasi Kontras & Pengujian

> **Status Eksekusi di Chat:** `NOT RUN` — Jalankan perintah berikut di terminal lokal Anda (membutuhkan Python 3.10+ dan Node.js 22+ untuk harness):

```bash
# 1. Kompilasi seluruh paket skill ke dist/ dan verifikasi kontrak RPC + manifest SHA-256
python build_skills.py

# 2. Verifikasi deterministik kontras warna WCAG AA (>= 4.5:1) pada seluruh preset
python tools/check_contrast.py

# 3. Jalankan unit test Python (frontmatter, <=1000 char description, cross-refs, schema, flat limits)
python -m unittest discover -s tests -v

# 4. Jalankan Node execution harness (bila tersedia di lingkungan Anda)
node tests/harness.js
```

---

## Cara Memasang Skill per Platform

1. **Claude Code / Gemini CLI / Agentic IDE:**
   Salin folder `dist/modular/gasly-prompt`, `dist/modular/gasly-data`, dan `dist/modular/gasly-ui` (serta `dist/modular/gasly-pro` bila membutuhkan mode legacy) ke direktori `.claude/skills/` atau `~/.claude/skills/`.
2. **Claude.ai (Web Skills / Projects):**
   Kompres masing-masing folder di dalam `dist/modular/<nama-skill>` menjadi file `.zip` dan unggah ke menu Skills, atau lampirkan `SKILL.md` beserta isi folder `references/` ke dalam Project Knowledge.
3. **Gemini Apps (Web) & ChatGPT:**
   Unggah paket dari `dist/modular/<nama-skill>/` (`SKILL.md` + file di dalam `references/`). Untuk platform yang belum memuat folder `references/` secara otomatis pada mode legacy, gunakan `dist/flat/` atau `dist/flat-lite/`.

---

## Lisensi

Dirilis di bawah [MIT License](LICENSE).