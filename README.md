# Gasly Skills

Paket keahlian (*agent skill pack*) berbahasa Indonesia berlisensi MIT untuk merancang dan membangun aplikasi web produksi yang menggunakan **Google Sheets** sebagai database dan **Google Drive** sebagai penyimpanan file melalui **Google Apps Script**.

- [Panduan Instalasi AI LLM — Gemini, Claude, ChatGPT (`INSTALL.md`)](INSTALL.md)
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
   - **Lapisan 1 — Tokens:** Sumber kebenaran JSON netral (`src/design/presets/*.tokens.json`) dan ekspor variabel CSS (`src/design/css/*.css`), termasuk token *soft semantic badges*.
   - **Lapisan 2 — Character:** 4 preset visual yang lulus kontras WCAG AA (`editorial-light`, `dense-dashboard`, `warm-friendly`, dan `aura` — `aura` tidak pernah menjadi default otomatis) ditambah 3 dials (`DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY` berskala `1–10`).
   - **Lapisan 3 — Gates:** Gerbang kualitas yang diklasifikasikan ke dalam `UNIVERSAL`, `GAS-ONLY`, `WEB-ONLY`, `LEGACY-HTMLSERVICE`, dan `INSTALL-GUIDE` (`src/core/gates.md`).

---

## Delapan Skill Kanonik di Dalam Repositori

| Skill | Status | Peran Utama | Paket di `dist/` |
|---|---|---|---|
| `gasly-start` | Aktif | Router alur; mendeteksi titik masuk dan mengarahkan ke spesialis. Tidak mengasumsikan runtime dapat memanggil skill lain otomatis. | `modular`, `claude-zips`, `web-bundles` |
| `gasly-prd` | Aktif | Product discovery & perencanaan; menghasilkan `PRD-Final.md` (template 13 Bab), master prompt, serta `GASLY_CONTRACT.json`. | `modular`, `flat`, `claude-zips`, `web-bundles` |
| `gasly-prd-to-uiux` | Aktif | PRD-to-UIUX, Image-First Visual Analysis, atau gabungan; menghasilkan prompt Stitch/Figma dan handoff. | `modular`, `claude-zips`, `web-bundles` |
| `gasly-pro-api` | Aktif | Koordinator implementasi full-stack yang menjaga kontrak dan handoff ke spesialis backend/frontend. | `modular`, `claude-zips`, `web-bundles` |
| `gasly-data` | Aktif | Headless Google Apps Script API: auth, Sheets, Drive, router, dan integrasi yang tersedia. | `modular`, `claude-zips`, `web-bundles` |
| `gasly-ui` | Aktif | Frontend eksternal, adapter stack, design system, API client, dan responsive UI. | `modular`, `claude-zips`, `web-bundles` |
| `gasly-deploy-guide` | Aktif | Menghasilkan panduan instalasi/deployment HTML mandiri berdasarkan kontrak dan file proyek. | `modular`, `claude-zips`, `web-bundles` |
| `gasly-pro` | Legacy | Aplikasi monolitik `HtmlService` + `google.script.run`; hanya untuk permintaan legacy eksplisit. | `modular`, `flat`, `flat-lite`, `claude-zips`, `web-bundles` |

**Nama lama:** `gasly-prompt` dan `gasly-install` dipertahankan sebagai alias kompatibilitas di paket distribusi, tetapi tidak lagi menjadi skill utama.

Workflow yang disarankan: `gasly-start` → `gasly-prd` → `gasly-prd-to-uiux` → `gasly-pro-api` → `gasly-data` + `gasly-ui` → `gasly-deploy-guide`. Pengguna dapat masuk langsung ke skill yang sesuai bila artifact tahap sebelumnya sudah tersedia.

---

## Dukungan Frontend Stack (`gasly-ui`)

- **Adapter Penuh (Tahap 1):**
  1. `html-tailwind` (pemisahan prototipe Play CDN vs kompilasi CSS CLI produksi)
  2. `nextjs` + `shadcn` (pembacaan publik saat build/ISR revalidation, penulisan & step-up PIN dari browser)
  3. `astro` (pembacaan publik saat build-time, penulisan dari *client islands*)
- **Direncanakan (Tahap Berikutnya — `src/stacks/PLANNED.md`):**
  - `react` (Vite) + `shadcn`, `nuxtjs` + `nuxt-ui`, serta profil akses `P2` skala penuh (`public-with-accounts` via Supabase Auth; untuk skala ringan pada GAS murni tersedia `P2-lite` melalui `P2_LITE_AUTO_PROVISION` + tabel `USERS`).
- **Mode Pewarisan Token & Gates (`STACK_MODE: INHERIT` — `src/stacks/INHERIT.md`):**
  - `angular`, `avalonia`, `flutter`, `javafx`, `jetpack-compose`, `laravel`, `react-native`, `svelte`, `swiftui`, `threejs`, `uno`, `uwp`, `vue`, `winui`, `wpf`.

---

## Build, Verifikasi Kontras & Pengujian

> **Status Validasi Otomatis:** Build, pemeriksaan kontras, unit test Python, dan Node harness dijalankan oleh [GitHub Actions](.github/workflows/validate.yml) pada setiap push/PR. **Status Runtime Apps Script:** `NOT RUN` — checklist manual pada `VERIFY.md` tetap harus dijalankan pada deployment GAS sebenarnya.

```bash
python build_skills.py
python tools/check_contrast.py
python -m unittest discover -s tests -v
TZ=Asia/Jakarta node tests/harness.js
TZ=Asia/Jakarta node tests/harness_gas.js
TZ=Asia/Jakarta node tests/harness_install.js
```

---

## Cara Memasang Skill per Platform

Lihat panduan lengkap langkah demi langkah di **[INSTALL.md](INSTALL.md)**:
- **Claude Web & Desktop:** Unggah file `.zip` siap pakai dari `dist/claude-zips/`.
- **Gemini Web & Mobile (Gemini Skills):** Unggah file `.md` dari `dist/web-bundles/` (tanpa `.zip`).
- **ChatGPT Projects (Free/Plus/Pro) & Custom GPT:** Gunakan bundel 4 file di `dist/web-bundles/gasly-all-in-one/`.
- **Claude Code / Gemini CLI / Agentic IDE:** Salin folder dari `dist/modular/`.

---

## Lisensi

Dirilis di bawah [MIT License](LICENSE).