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

## Delapan Skill Kanonik di Dalam Repositori

| Skill | Status | Peran Utama | Paket di `dist/` |
|---|---|---|---|
| `gasly-start` | Aktif | Router alur; mendeteksi titik masuk dan mengarahkan ke spesialis. Tidak mengasumsikan runtime dapat memanggil skill lain otomatis. | `dist/modular/gasly-start` |
| `gasly-prd` | Aktif | Product discovery dan perencanaan; menghasilkan PRD, master implementation prompt, serta `GASLY_CONTRACT.json`. | `dist/modular/gasly-prd`, `dist/flat/gasly-prd` |
| `gasly-prd-to-uiux` | Aktif | PRD-to-UIUX, Image-First Visual Analysis, atau gabungan; menghasilkan prompt Stitch/Figma dan handoff. | `dist/modular/gasly-prd-to-uiux` |
| `gasly-pro-api` | Aktif | Koordinator implementasi full-stack yang menjaga kontrak dan handoff ke spesialis backend/frontend. | `dist/modular/gasly-pro-api` |
| `gasly-data` | Aktif | Headless Google Apps Script API: auth, Sheets, Drive, router, dan integrasi yang tersedia. | `dist/modular/gasly-data` |
| `gasly-ui` | Aktif | Frontend eksternal, adapter stack, design system, API client, dan responsive UI. | `dist/modular/gasly-ui` |
| `gasly-deploy-guide` | Aktif | Menghasilkan panduan instalasi/deployment HTML mandiri berdasarkan kontrak dan file proyek. | `dist/modular/gasly-deploy-guide` |
| `gasly-pro` | Legacy | Aplikasi monolitik `HtmlService` + `google.script.run`; hanya untuk permintaan legacy eksplisit. | `dist/modular/gasly-pro`, `dist/flat/gasly-pro`, `dist/flat-lite/gasly-pro` |

**Nama lama:** `gasly-prompt` dan `gasly-install` dipertahankan sebagai alias kompatibilitas di paket distribusi, tetapi tidak lagi menjadi skill utama.

Workflow yang disarankan: `gasly-start` → `gasly-prd` → `gasly-prd-to-uiux` → `gasly-pro-api` → `gasly-data` + `gasly-ui` → `gasly-deploy-guide`. Pengguna dapat masuk langsung ke skill yang sesuai bila artifact tahap sebelumnya sudah tersedia.
---

## Dukungan Frontend Stack (`gasly-ui`)

- **Adapter Penuh (Tahap 1):**
  1. `html-tailwind` (mencakup pemisahan prototipe Play CDN vs kompilasi CSS CLI produksi)
  2. `nextjs` + `shadcn` (pembacaan publik saat build/ISR revalidation, penulisan dari browser)
  3. `astro` (pembacaan publik saat build-time, penulisan dari *client islands*)
- **Direncanakan (Tahap Berikutnya — `src/stacks/PLANNED.md`):**
  - `react` (Vite) + `shadcn`, `nuxtjs` + `nuxt-ui`, serta profil akses `P2` skala penuh (`public-with-accounts` multi-tenant via Supabase Auth; untuk skala ringan pada GAS murni sudah tersedia `P2-lite` melalui `P2_LITE_AUTO_PROVISION` + tabel `USERS`).
- **Mode Pewarisan Token & Gates (`STACK_MODE: INHERIT` — `src/stacks/INHERIT.md`):**
  - `angular`, `avalonia`, `flutter`, `javafx`, `jetpack-compose`, `laravel`, `react-native`, `svelte`, `swiftui`, `threejs`, `uno`, `uwp`, `vue`, `winui`, `wpf`.

---

## Build, Verifikasi Kontras & Pengujian

> **Status Validasi Otomatis:** Build, pemeriksaan kontras, unit test Python, dan Node harness dijalankan oleh [GitHub Actions](.github/workflows/validate.yml) pada setiap push/PR. Periksa tab Actions untuk hasil commit terbaru. **Status Runtime Apps Script:** `NOT RUN` — checklist manual pada `VERIFY.md` tetap harus dijalankan pada deployment GAS sebenarnya.

```bash
# 1. Kompilasi seluruh paket skill ke dist/ dan verifikasi kontrak RPC + manifest SHA-256
python build_skills.py

# 2. Verifikasi deterministik kontras warna WCAG AA (>= 4.5:1) pada seluruh preset
python tools/check_contrast.py

# 3. Jalankan unit test Python (frontmatter, <=1000 char description, cross-refs, schema, flat limits)
python -m unittest discover -s tests -v

# 4. Jalankan Node execution harness (Legacy, Headless GAS V8, & Install Guide)
TZ=Asia/Jakarta node tests/harness.js
TZ=Asia/Jakarta node tests/harness_gas.js
TZ=Asia/Jakarta node tests/harness_install.js
```

---

## Cara Memasang Skill per Platform

1. **Claude Code / Gemini CLI / Agentic IDE:**
   Salin folder `dist/modular/gasly-prd`, `dist/modular/gasly-data`, dan `dist/modular/gasly-ui` (serta `dist/modular/gasly-pro` bila membutuhkan mode legacy) ke direktori `.claude/skills/` atau `~/.claude/skills/`.
2. **Claude.ai (Web Skills / Projects):**
   Kompres masing-masing folder di dalam `dist/modular/<nama-skill>` menjadi file `.zip` dan unggah ke menu Skills, atau lampirkan `SKILL.md` beserta isi folder `references/` ke dalam Project Knowledge.
3. **Gemini Apps (Web) & ChatGPT:**
   Unggah paket dari `dist/modular/<nama-skill>/` (`SKILL.md` + file di dalam `references/`). Untuk platform yang belum memuat folder `references/` secara otomatis pada mode legacy, gunakan `dist/flat/` atau `dist/flat-lite/`.

---

## Lisensi

Dirilis di bawah [MIT License](LICENSE).