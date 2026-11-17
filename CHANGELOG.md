# Changelog (`CHANGELOG.md`)

Seluruh perubahan penting pada repositori **gasly-skills** didokumentasikan di dalam file ini.

---

## [2.3.0] — 2026-11-17 (`KB_VERSION: 2.1.0`)

### Added
- **Multi-User Auth (`USERS`), `P2-lite`, & Step-Up PIN (`src/gas/auth-and-ratelimit.md`, `src/gas/config.md`):**
  - Menambahkan skema tabel `USERS` (`SENSITIVE_PII`), auto-provisioning `P2-lite` ber-rate-limit pada `auth.google`, pengaturan kredensial `auth.setCredentials` (`currentPassphrase` wajib untuk self-service), serta verifikasi PIN 6 digit `auth.verifyPin` (`stepUpToken` sekali pakai yang terikat pada `STEP_UP_ALLOWED_ACTIONS_`).
- **Siklus Hidup File Drive & Konektor Integrasi (`src/gas/drive-upload.md`, `src/gas/integrations.md`):**
  - Menambahkan handler `file.replace` (memindahkan file Drive lama ke Trash setelah Sheet flush) dan `file.delete`.
  - Menambahkan `src/gas/integrations.md` berisi `mail.send` (dengan quota guard `MailApp.getRemainingDailyQuota() > 5`), `notify.whatsapp` (Fonnte + fallback `wa.me`), `ai.generate` (Gemini JSON dengan kuota harian per user di `CacheService`), wrapper `fetchExternalWithBreaker_` (*circuit breaker* `CacheService` + retry backoff), dan antrean `JOBS_OUTBOX`.
- **Blueprint Monetisasi & Matriks Promosi Tier (`src/core/monetization-and-tiers.md`):**
  - Menambahkan panduan skema `PLANS` & `SUBSCRIPTIONS`, batas `P2-lite` vs Supabase Auth, syarat halaman `/privacy`, dan ambang naik tier berbasis `facts.md`.
- **Harness Eksekusi V8 Headless (`tests/harness_gas.js` & `tests/fixtures/`):**
  - Menambahkan test runner VM Node.js khusus untuk mengeksekusi seluruh modul di `src/gas/*.md` beserta fixture uji untuk `tools/verify_output.py`.

### Changed
- **Verifier Output (`tools/verify_output.py`):**
  - Memperluas pemeriksaan deterministik untuk menolak status `'ok'`/`'OK'` (`Gate U-04`) dan memeriksa gerbang anti-slop web (`Gate W-01`, `Gate W-05`, `Gate W-08`, `Gate U-03`).

### Fixed
- **Sinkronisasi Kontrak Envelope (`schemas/gasly-contract.schema.json`, `src/skills/gasly-ui/SKILL.md`, `src/core/hardening-gates-p0.md`):**
  - Mengunci nilai `status_values` secara konsisten ke `["success", "error"]`.

### Security
- **Penegakan `verifyAndConsumeStepUp_` & Penyembunyian Kolom Hash (`src/gas/sheets-repository.md`, `src/gas/drive-upload.md`, `src/gas/webhook-receiver.md`):**
  - Mewajibkan `stepUpToken` sekali pakai ber-scope server pada `items.delete`, `admin.purgeSeed`, `file.delete`, dan rotasi PIN/admin di `auth.setCredentials`.
  - Menyembunyikan `password_salt`, `password_hash`, `pin_salt`, dan `pin_hash` di `readSheetObjects_` secara default, serta menambahkan deduplikasi `idem:webhook:<providerEventId>` (TTL `21600` detik) di `webhook.receive`.

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