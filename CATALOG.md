# Katalog Skill & Pemilih Paket Gasly (`CATALOG.md`)

Gunakan panduan ini untuk memilih skill dan varian distribusi yang tepat sesuai kebutuhan proyek dan kemampuan platform AI yang Anda gunakan.

---

## 1. Pemilih Skill Berdasarkan Tugas

| Skenario Penggunaan | Skill yang Dipilih | Urutan Pemanggilan (Stackable Workflow) |
| :--- | :--- | :--- |
| Merancang aplikasi baru dari ide mentah (menentukan Access Profile `P1`–`P4`, Preset Desain + 3 Dials, Stack Frontend, Skema Sheet, dan Kebutuhan Upload Drive) | **`gasly-prompt`** | Langkah 1: Panggil `gasly-prompt` $\rightarrow$ Jawab 1 pertanyaan klarifikasi. |
| Membangun atau merevisi kode backend Google Apps Script (`setup.gs`, `router.gs`, `auth.gs`, `sheets.gs`, `drive.gs`, `webhook.gs`) di balik URL `/exec` | **`gasly-data`** | Langkah 2A: Panggil `gasly-data` menggunakan `MASTER INSTRUCTIONAL PROMPT` dari `gasly-prompt`. |
| Membangun atau merevisi aplikasi frontend eksternal (`html-tailwind`, `nextjs`+`shadcn`, `astro`, atau 15 stack pewaris) yang berkomunikasi ke URL `/exec` | **`gasly-ui`** | Langkah 2B: Panggil `gasly-ui` menggunakan `MASTER INSTRUCTIONAL PROMPT` yang sama. |
| **[LEGACY]** Membangun atau memelihara aplikasi monolitik yang disajikan langsung dari dalam iframe `HtmlService` Google Apps Script (`google.script.run`) | **`gasly-pro`** *(Legacy)* | Gunakan hanya jika pengguna secara eksplisit meminta mode `HtmlService` di dalam Google Apps Script. |

---

## 2. Daftar Paket Distribusi di `dist/`

Seluruh konten baru untuk arsitektur headless (`gasly-data` dan `gasly-ui`) dikompilasi secara eksklusif ke dalam **`dist/modular/`**, sementara paket `flat` dan `flat-lite` dipertahankan tanpa perubahan batas ukuran untuk kompatibilitas mundur.

### A. Paket Modular (`dist/modular/` — Direkomendasikan)
Cocok untuk platform yang mendukung standar `SKILL.md` beserta pemuatan file di dalam subfolder `references/` (Claude Code, Claude.ai Skills/Projects, ChatGPT Skills, Gemini Skills, Cursor, Windsurf):

- **`dist/modular/gasly-prompt/`**
  - `SKILL.md`
  - `references/contract.md`, `references/access-profiles.md`, `references/gates.md`, `references/presets.md`, `references/dials.md`, `references/spec-digest.md`
- **`dist/modular/gasly-data/`**
  - `SKILL.md`
  - `references/contract.md`, `references/access-profiles.md`, `references/gates.md`, `references/config.md`, `references/router-and-envelope.md`, `references/auth-and-ratelimit.md`, `references/sheets-repository.md`, `references/drive-upload.md`, `references/webhook-receiver.md`
- **`dist/modular/gasly-ui/`**
  - `SKILL.md`
  - `references/contract.md`, `references/access-profiles.md`, `references/gates.md`, `references/tokens.schema.json`, `references/presets.md`, `references/dials.md`, `references/presets/*.tokens.json`, `references/css/*.css`, `references/html-tailwind.md`, `references/nextjs-shadcn.md`, `references/astro.md`, `references/INHERIT.md`, `references/PLANNED.md`
- **`dist/modular/gasly-pro/`** *(Legacy HtmlService Mode)*
  - `SKILL.md`
  - `references/aura-design.md`, `references/interaction-primitives.md`, `references/app-ux.md`, `references/landing-conversion.md`, `references/gas-backend.md`, `references/boilerplates.md`

### B. Paket Legacy Flat & Flat-Lite (`dist/flat/` & `dist/flat-lite/`)
Dipertahankan khusus untuk platform yang hanya menerima satu blok teks instruksi tunggal tanpa lampiran file:

- **`dist/flat/gasly-prompt/SKILL.md`** — `gasly-prompt` dengan `spec-digest.md` terintegrasi inline.
- **`dist/flat/gasly-pro/SKILL.md`** — Skill legacy `gasly-pro` dengan keenam file `src/kb/*.md` terintegrasi inline.
- **`dist/flat-lite/gasly-pro/SKILL.md`** — Skill legacy `gasly-pro` tanpa `boilerplates.md` (di bawah ambang `48.000` karakter) untuk platform berbatas instruksi ketat.