# Changelog (`CHANGELOG.md`)

Seluruh perubahan penting pada repositori **gasly-skills** didokumentasikan di dalam file ini.

---

## [2.2.0] — 2026-11-14 (`KB_VERSION: 2.1.0`)

### Added
- **Arsitektur Headless `/exec` Tunggal (`src/core/`):**
  - Menambahkan `src/core/contract.md` yang mendefinisikan protokol komunikasi HTTP `POST` (`Content-Type: text/plain;charset=utf-8` untuk menghindari kegagalan CORS preflight di Apps Script) dan `GET` dengan struktur `{ action, v: 1, auth, idem, payload }`, penamaan `domain.verb`, kunci idempotensi `idem`, serta penggunaan kembali Response Envelope Kanonik.
  - Menambahkan `src/core/access-profiles.md` untuk profil akses `P1` (`public-read`), `P2` (`public-with-accounts` — berstatus `PLANNED`), `P3` (`public-plus-admin`), dan `P4` (`internal-only`), lengkap dengan skema *salted iterated SHA-256 passphrase hash* (min. 12 karakter) di `ScriptProperties`, session token `HMAC-SHA256` (TTL 2 jam, verifikasi waktu konstan), login opsional Google ID Token via `UrlFetchApp`, dan *rate limiting* di `CacheService`.
  - Menambahkan `src/core/gates.md` yang mengklasifikasikan ulang seluruh 26 gerbang keras ke dalam 4 kelas: `UNIVERSAL`, `GAS-ONLY`, `WEB-ONLY`, dan `LEGACY-HTMLSERVICE` tanpa menghapus satu pun gerbang lama.
- **Tiga Lapisan Desain & Pemeriksa Kontras Deterministik (`src/design/` & `tools/check_contrast.py`):**
  - Menambahkan skema JSON `src/design/tokens.schema.json`, 4 preset token JSON (`aura`, `editorial-light`, `dense-dashboard`, `warm-friendly`) beserta ekspor CSS custom properties di `src/design/css/*.css`.
  - Menambahkan spesifikasi 3 character dials (`DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY` 1–10) di `src/design/dials.md` dan panduan pemilihan preset di `src/design/presets.md` (`aura` tidak lagi menjadi default otomatis).
  - Menambahkan skrip `tools/check_contrast.py` yang menguji seluruh pasangan warna teks dan surface terhadap standar WCAG 2.1 AA (`>= 4.5:1`).
- **Skill Baru `gasly-data` (`src/skills/gasly-data/SKILL.md` & `src/gas/*.md`):**
  - Menyediakan boilerplate modular V8 untuk konfigurasi (`config.md`), router & central action registry allowlist (`router-and-envelope.md`), otentikasi & chunked cache 100 KB (`auth-and-ratelimit.md`), repositori Google Sheets ber-`LockService` (`sheets-repository.md`), unggahan foto Google Drive dengan tiket sekali pakai `file.ticket` + pemeriksaan *magic bytes* biner `file.upload` (`drive-upload.md`), serta penerima webhook pembayaran (`webhook-receiver.md`).
- **Skill Baru `gasly-ui` (`src/skills/gasly-ui/SKILL.md` & `src/stacks/*.md`):**
  - Menyediakan 3 adapter penuh tahap 1: `html-tailwind.md`, `nextjs-shadcn.md`, dan `astro.md` (dilengkapi `gasClient`, `ImageUploader` 5-state dengan kompresi `<canvas>` ~1 MB, helper tunggal `driveImageUrl(fileId, width)` dengan rantai fallback thumbnail ke `lh3.googleusercontent.com`, serta penyimpanan token sesi di memori).
  - Menambahkan `src/stacks/INHERIT.md` untuk 15 stack pewaris dan `src/stacks/PLANNED.md` untuk fitur tahap berikutnya.
- **Dokumentasi Verifikasi, Referensi & Evaluasi:**
  - Menambahkan `VERIFY.md`, `docs/REFERENCES.md`, 3 skenario evaluasi baru di `evals/README.md` (Brief 6, 7, 8), serta pengujian unit baru di `tests/test_skills.py`.

### Changed
- **Pembaruan `gasly-prompt` (`src/skills/gasly-prompt/SKILL.md`):**
  - Memperbarui template `MASTER INSTRUCTIONAL PROMPT` menjadi 8 seksi yang mencakup Access Profile, Design Direction (Preset + 3 Dials), Frontend Stack (beserta aturan fallback `INHERIT`), Data Schema, dan Upload Needs.
- **Penandaan Legacy pada `gasly-pro` (`src/skills/gasly-pro/SKILL.md`):**
  - Menandai `gasly-pro` sebagai `LEGACY SKILL (GAS-Hosted HtmlService Frontend Mode)` sambil mempertahankan seluruh gerbang keras dan paket `flat`/`flat-lite` tanpa perubahan batas ukuran.
- **Pembaruan Compiler (`build_skills.py`):**
  - Mengompilasi keempat skill ke `dist/modular/` dengan pertukaran direktori staging atomik dan pencatatan hash SHA-256 ke `dist/manifest.json`.