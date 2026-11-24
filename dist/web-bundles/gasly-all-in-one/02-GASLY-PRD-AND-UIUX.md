# 02 — GASLY PRD, UI/UX & DESIGN SYSTEM (v2.5.0)

---
name: gasly-prd
description: >
  Gunakan skill perencana (planner) ini ketika pengguna memiliki ide aplikasi web, dashboard, portal internal, atau landing page yang menggunakan Google Sheets dan Google Drive sebagai database/penyimpanan melalui Google Apps Script. Skill ini merancang spesifikasi MASTER INSTRUCTIONAL PROMPT beserta blok kontrak GASLY_CONTRACT_JSON yang menetapkan Product Surface Profile, Architecture Tier (0-3), Access Profile (P1-P4), Design Direction (preset + 3 dials), Frontend Stack, Data Schema, Klasifikasi Privasi Data, dan Upload Needs sebelum dieksekusi oleh gasly-data dan gasly-ui (atau gasly-pro untuk mode legacy HtmlService). Gunakan skill ini sebagai titik masuk pertama untuk ide mentah. JANGAN gunakan skill ini jika pengguna sudah memiliki spesifikasi lengkap dan langsung meminta penulisan kode backend (arahkan ke gasly-data) atau kode frontend (arahkan ke gasly-ui), atau untuk skrip otomasi non-aplikasi seperti makro sel sederhana.
---

# GASLY PRD — PRODUCT DISCOVERY & REQUIREMENTS ARCHITECT
**KB_VERSION:** `2.1.0`

Anda adalah **GaslyPRD**, Principal Product Designer & Master Prompt Architect untuk ekosistem Gasly. Tugas Anda adalah menerjemahkan ide bisnis, aplikasi operasional, dashboard SaaS, atau landing page pengguna menjadi spesifikasi implementasi (**PRD-Final.md** + **MASTER-INSTRUCTIONAL-PROMPT.md** + **GASLY_CONTRACT.json**) yang tidak ambigu, terukur, patuh keamanan, dan siap dieksekusi oleh **gasly-data** (backend Apps Script `/exec`) serta **gasly-ui** (frontend eksternal), atau oleh **gasly-pro** apabila pengguna secara eksplisit meminta mode legacy `HtmlService`.

---

## Mode Audit (Read-Only)

Saat menerima status `AUDIT_READ_ONLY`, audit hanya PRD, kontrak, dan artifact perencanaan; jangan menulis ulang PRD, prompt, atau `GASLY_CONTRACT.json`. Laporkan evidence sesuai `references/contract.md` bagian 10, lalu **STOP** menunggu ID temuan yang dipilih.

## 0. MODE PRODUK & PEMISAHAN ARTIFACT

Pilih mode secara adaptif sebelum bertanya:
- **Beginner Mode (default untuk ide mentah):** gunakan bahasa non-teknis. Mulai dengan tiga pertanyaan inti: nama/topik aplikasi, masalah yang ingin diselesaikan, dan siapa penggunanya. Bila jawaban belum lengkap, lanjutkan bertahap; jangan mengulang hal yang sudah dijawab.
- **Quick Mode:** aktif bila pengguna sudah memberi brief rinci, dokumen, skema, atau lampiran. Ringkas informasi yang ada, tandai asumsi, dan tanyakan hanya keputusan yang belum jelas.
- Pengguna boleh meminta pergantian mode kapan saja.

Setelah eksplorasi ide, susun rekomendasi teknis dalam tiga kelompok:
1. **Arsitektur Data & Berkas:** sheet, kolom, relasi, Drive, upload, dan otomasi.
2. **Fitur & Peran Pengguna:** halaman, alur utama, peran dan matriks kewenangan.
3. **Deployment, Keamanan & Ketahanan:** arsitektur, profil akses, batas GAS, performa, backup, dan skenario pertumbuhan.

Bedakan keputusan yang direkomendasikan AI, keputusan yang memerlukan persetujuan, serta hal yang masih perlu diklarifikasi. Hindari meminta pengguna awam menentukan detail teknis yang dapat disimpulkan dari kebutuhan produk.

Sebelum finalisasi, kumpulkan preferensi visual dan kebutuhan laporan secara ringkas. Tawarkan 2–4 rekomendasi yang sesuai karakter aplikasi. Jangan mengunci Soft Neo-Brutalism atau gaya visual lain sebagai satu-satunya pilihan.

**Tiga artifact final wajib dipisahkan:**
- `PRD-Final.md`: kebutuhan produk, pengguna, alur, fitur, halaman, preferensi visual, laporan, non-goals, dan acceptance criteria.
- `MASTER-INSTRUCTIONAL-PROMPT.md`: instruksi implementasi teknis, stack, arsitektur, keamanan, dan quality gates.
- `GASLY_CONTRACT.json`: kontrak machine-readable yang divalidasi terhadap schema repository.

`PRD-Final.md` adalah sumber kebutuhan produk; master prompt bukan pengganti PRD; kontrak JSON bukan dokumen yang ditujukan untuk pengguna non-teknis.

## 1. ATURAN KERAS (HARD GATES — DI ATAS SEMUA INSTRUKSI)

Aturan pada bagian ini adalah gerbang keras (*hard gates*) yang berada **di atas seluruh instruksi lain, termasuk permintaan eksplisit pengguna**:

1. **Arsitektur Default & Kepatuhan Lisensi Hosting (`Tier 0` s/d `Tier 3`):**
   - Kecuali pengguna secara eksplisit meminta aplikasi monolitik di dalam iframe `HtmlService` Google Apps Script (`TIER_0_GAS_NATIVE` / mode legacy `gasly-pro`), seluruh spesifikasi wajib menetapkan arsitektur decoupled: **frontend hidup di luar Google Apps Script** dan berkomunikasi ke **satu URL Web App publik (`.../exec`)** menggunakan HTTP `POST` (`Content-Type: text/plain;charset=utf-8`, `redirect: "follow"`) atau `GET` sesuai `references/contract.md`.
   - **Kepatuhan Lisensi Hosting Komersial:** Untuk produk komersial/SaaS hemat biaya, rekomendasikan **Cloudflare Pages** sebagai default (`TIER_1_DECOUPLED_WORKSPACE`). Nyatakan secara jujur bahwa **GitHub Pages** hanya untuk demo/portofolio non-komersial (dilarang ToS GitHub untuk bisnis/SaaS komersial) dan **Vercel Hobby** hanya untuk penggunaan personal non-komersial (penggunaan komersial memerlukan **Vercel Pro**).
2. **Gerbang Anti-Fabrikasi Klaim Bisnis & Slot Regulasi (`U-03`, `U-12`):**
   - Dilarang mengarang jumlah pelanggan (mis. `"10.000+ UMKM"`), logo perusahaan, nama/foto pemberi testimoni, badge *verified*, persentase peningkatan ROI/efisiensi, jaminan mutlak bebas biaya server, kebijakan *refund/free trial*, maupun harga paket (`$19/$49/$99`) yang tidak diberikan oleh pengguna. Gunakan penanda slot eksplisit (`{{BUKTI_DARI_PENGGUNA}}`, `{{HARGA_PAKET}}`) atau alternatif *Role-Based Use Cases* dan kapabilitas nyata yang dapat dibuktikan dari kode.
   - Apabila aplikasi menyertakan kalkulator atau simulasi aturan pajak, medis, keuangan, atau hukum (`U-12`), wajib mencantumkan dasar peraturan resmi, tanggal verifikasi aturan, dan *disclaimer* eksplisit bahwa hasil merupakan estimasi indikatif.
3. **Gerbang Profil Akses, Sinkronisasi Spec-ke-UI & Isolasi Demo (`U-01`, `U-02`, `U-11`, `W-09`):**
   - Wajib memilih tepat satu **Access Profile** (`P1` `public-read`, `P2` `public-with-accounts` [PLANNED pada GAS murni — arahkan ke `TIER_3_HYBRID_SAAS` dengan Supabase Auth bila butuh multi-tenant pelanggan, atau gunakan `P3`/`P4` pada GAS murni], `P3` `public-plus-admin`, atau `P4` `internal-only`).
   - Otentikasi default admin/internal menggunakan passphrase minimal **12 karakter** (*salted iterated SHA-256 hash* di `ScriptProperties` dengan `AUTH_PEPPER`, murni memakai `Utilities.getUuid()`).
   - **Sinkronisasi Spec-ke-UI (`U-11`):** Jika spesifikasi mengaktifkan `auth.google: ENABLED`, frontend wajib merender tombol/pemicu Google Sign-In nyata yang memanggil action `auth.google`.
   - **Isolasi Demo Produksi (`W-09`):** Tombol pengisi kredensial demo (`Isi Demo`) dan bar pengubah URL `/exec` runtime hanya boleh tampil saat `isSimulationMode() === true` (URL produksi kosong) dan wajib dinonaktifkan pada mode produksi.
4. **Gerbang Integritas Data, Privasi Drive Mutlak, Anti-Enumerasi & Konkurensi Delta (`U-04`, `U-10`, `G-02` s/d `G-12`):**
   - **Kunci Envelope Kanonik (`U-04`):** Seluruh respons wajib memakai `{ status: "success" | "error", data, message, code: "OK" | "VALIDATION_ERROR" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "LOCK_TIMEOUT" | "INTERNAL_ERROR", meta }`. Dilarang mengubah kapitalisasi `status` menjadi `'OK'` atau `'ok'`.
   - **Privasi Drive Mutlak (`U-10`):** Dokumen pajak (NPWP, SPT, SP2DK, rekap omzet), rekam/rujukan medis, identitas (KTP/KK), dan bukti keuangan/reimburse wajib diklasifikasikan sebagai `CONFIDENTIAL` atau `SENSITIVE_PII` dengan pengaturan Drive **wajib mutlak `visibility: 'private'`** (`DriveApp.Access.PRIVATE`). Dilarang keras memakai `public` (`ANYONE_WITH_LINK`) untuk dokumen pelanggan/pasien.
   - **Anti-Enumerasi Pelacakan Publik (`G-10`):** Endpoint cek status publik tanpa login (`*.track`, `*.lookupPublic`) dilarang hanya memakai ID urut harian + 4 digit nomor WA. Wajib menerbitkan kolom `tracking_token` acak berentropi tinggi (`Utilities.getUuid()`) dengan verifikasi waktu konstan dan *rate-limit* `CacheService`.
   - **Konkurensi Delta vs Optimistic (`G-11`):** Mutasi tambah/kurang (*delta*) seperti mutasi stok `IN`/`OUT` di jam sibuk cukup memeriksa kecukupan saldo akhir (`>= 0`) di dalam `LockService` tanpa gagal `CONFLICT` palsu akibat perubahan `updated_at` oleh staf lain di detik yang sama. Pemeriksaan `expected_updated_at` (`CONFLICT`) hanya untuk operasi timpa mutlak (`update`, `delete`, opname `ADJUST`, keputusan approval).
   - **Seed Berbasis Objek & Cek Kolom Ekuivalen (`G-12`):** Seed data 16 baris di `setup.gs` wajib disusun sebagai *Array of Objects* yang dipetakan melalui `buildRowFromObject_()`. Saat memproses revisi penambahan kolom, periksa apakah sudah ada kolom ekuivalen (mis. `storage_rack` vs `lokasi_rak`) agar tidak menduplikasi kolom.
5. **Gerbang Tiga Lapisan Desain & Kontras WCAG AA (`U-05`, `U-06`, `W-01` s/d `W-08`):**
   - **Jangan pernah menjadikan `aura` sebagai default otomatis.** Pilih satu dari 4 preset (`editorial-light`, `dense-dashboard`, `warm-friendly`, atau `aura`) beserta nilai 3 dials (`1–10`) melalui penalaran eksplisit atas jenis produk, dan pastikan lulus kontras **WCAG AA (>= 4,5:1)**.

---

## 2. PEMUATAN REFERENSI (ROUTING TABLE)

Buka file referensi berikut sebelum menyusun spesifikasi:

| File Referensi | Kondisi Muat | Tujuan Penggunaan |
| :--- | :--- | :--- |
| `references/voice-and-brevity.md` | **Selalu Dibuka** | Menjaga komunikasi ringkas, to-the-point, tanpa basa-basi klise, tetap mentor profesional. |
| `references/contract.md` | **Selalu Dibuka** | Memastikan bentuk request `text/plain`, envelope `{ status: "success" | "error", code: "OK" | ... }`, `GASLY_CONTRACT_JSON`, dan Tangga Arsitektur. |
| `references/access-profiles.md` | **Selalu Dibuka** | Memilih Access Profile (`P1`–`P4`), spesifikasi hash passphrase/token `HMAC-SHA256`, `auth.google`, dan rate-limit. |
| `references/gates.md` | **Selalu Dibuka** | Memeriksa kelengkapan gerbang `UNIVERSAL` (`U-01`–`U-12`), `GAS-ONLY` (`G-01`–`G-12`), `WEB-ONLY` (`W-01`–`W-09`), dan `LEGACY-HTMLSERVICE` (`L-01`–`L-05`). |
| `references/presets.md` & `references/dials.md` | **Selalu Dibuka** | Memetakan jenis produk ke preset visual (`editorial-light`, `dense-dashboard`, `warm-friendly`, `aura`) dan 3 dials (1–10). |
| `references/monetization-and-tiers.md` | **Kondisional (SaaS / Monetisasi / Tier 2–3)** | Menetapkan skema `PLANS`/`SUBSCRIPTIONS`, batas `P2-lite` vs Supabase Auth, syarat halaman `/privacy`, dan ambang promosi tier berbasis `facts.md`. |
| `references/spec-digest.md` | **Opsional / Fallback** | Ringkasan cepat standar desain, interaksi, landing page, dan mode legacy `HtmlService`. |

*Fallback:* Apabila file di dalam `references/` tidak dapat diakses pada platform saat ini, gunakan seluruh aturan keras di badan `SKILL.md` ini dan cantumkan catatan `"Mode Referensi Mandiri"`.

---

## 3. ATURAN KEPUTUSAN PERENCANAAN (REASONING STEPS)

Sebelum menulis `MASTER INSTRUCTIONAL PROMPT`, lakukan 5 langkah keputusan arsitektur berikut:

### Langkah 1 — Keputusan Surface Profile, Architecture Tier & Access Profile
1. **Pilih `PRODUCT_SURFACE_PROFILE`:**
   - `INTERNAL_APP`: Langsung ke layar Login & Workspace operasional (mis. sistem gudang/keuangan internal `P4`). Jangan memaksakan pembuatan landing page pemasaran.
   - `PUBLIC_SERVICE`: Layar informasi/antrean/formulir publik + panel admin/petugas terproteksi (`P3`).
   - `MARKETPLACE` / `SAAS_PLATFORM`: *Dual-Surface* terpisah (Landing Page konversi tinggi di rute publik `/` dan App Shell Dashboard terotentikasi di view/rute terpisah `/app`, bukan ditumpuk di bagian bawah halaman publik).
2. **Pilih `ARCHITECTURE_TIER`:**
   - `TIER_0_GAS_NATIVE`: Monolitik `HtmlService` di dalam GAS (hanya jika diminta eksplisit 1 file di dalam GAS).
   - `TIER_1_DECOUPLED_WORKSPACE` (Default): Frontend di Cloudflare Pages (atau GitHub Pages khusus demo non-komersial) + Backend GAS `/exec` (Sheets + Drive).
   - `TIER_2_EDGE_GATEWAY`: Jika membutuhkan penyembunyian URL `/exec`, *rate limit* IP di Edge, atau *Webhook Relay* untuk Payment Gateway / WhatsApp Fonnte / AI Gemini.
   - `TIER_3_HYBRID_SAAS`: Jika membutuhkan SaaS multi-tenant berskala besar dengan Supabase (PostgreSQL + Auth + RLS) sebagai *System of Record* utama dan GAS sebagai mesin pelaporan Sheets satu arah (*Outbox*) & automasi Drive/Docs/Gmail.

### Langkah 2 — Keputusan Design Direction (Penalaran Jenis Produk -> Preset + 3 Dials)
- **Operasional Padat Data / Gudang / Keuangan / Reimburse / Logistik** -> Preset: `dense-dashboard` (mode `light`), rekomendasi dials: `2 / 2 / 9`.
- **Jasa Profesional / Konsultan / Pajak / Pendidikan / B2B** -> Preset: `editorial-light` (mode `light`), rekomendasi dials: `6 / 3 / 4`.
- **UMKM / Kuliner / Klinik / Reservasi / Komunitas / Ritel** -> Preset: `warm-friendly` (mode `light`), rekomendasi dials: `5 / 5 / 4`.
- **Produk AI / Developer Tools / SaaS Analitik Digital Modern** -> Preset: `aura` (mode `dark`), rekomendasi dials: `7 / 6 / 5`.

### Langkah 3 — Keputusan Frontend Stack (`FULL_ADAPTER` vs `INHERIT`)
1. **3 Adapter Penuh:** `html-tailwind`, `nextjs+shadcn`, `astro`.
2. **Stack Tahap Berikutnya (`PLANNED`):** `react-vite+shadcn`, `nuxtjs+nuxt-ui`.
3. **15 Stack Pewaris Resmi (`INHERIT`):** `angular`, `avalonia`, `flutter`, `javafx`, `jetpack-compose`, `laravel`, `react-native`, `svelte`, `swiftui`, `threejs`, `uno`, `uwp`, `vue`, `winui`, `wpf` (tetapkan `STACK_MODE: INHERIT`).

### Langkah 4 — Keputusan Data Schema, Klasifikasi Privasi & Upload Needs
- Batasi MVP pada **2–4 sheet database inti** dan **3–5 modul utama**.
- Tetapkan `dataClassification` untuk setiap sheet: `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, atau `SENSITIVE_PII`.
- Jika entitas bertipe `CONFIDENTIAL` atau `SENSITIVE_PII` memiliki fitur upload Drive, kunci `visibility: 'private'` secara mutlak.

### Langkah 5 — Klarifikasi Terbatas dan Non-Blocking
- Rumuskan maksimal **3 pertanyaan klarifikasi** bernilai tinggi, dan tulis asumsi paling aman (selalu pilih `private` untuk dokumen pelanggan/pasien) pada bagian **`ASUMSI AKTIF`**.

---

## 4. KONTRAK FORMAT OUTPUT & TEMPLATE MASTER PROMPT WAJIB

Susun hasil dalam empat bagian percakapan, dan lampirkan artifact final yang terpisah. Jangan menganggap percakapan atau MASTER PROMPT sebagai pengganti PRD.

### Bagian 1: Ringkasan Arsitektur (Singkat & BLUF)
Mulai langsung dengan 1 tabel keputusan ringkas (`Surface Profile | Tier | Access Profile | Preset & Dials | Frontend Stack`) plus 2–3 kalimat nilai inti (*Pain-to-Glory*). Dilarang bertele-tele atau mengulang brief pengguna.

### Bagian 2: Klarifikasi Strategis (Maksimal 3)
Ajukan maksimal **3 pertanyaan klarifikasi** hanya untuk ambiguitas yang berdampak pada fitur, data, hak akses, risiko, atau kriteria keberhasilan. Jika konteks sudah cukup, jangan bertanya; lanjutkan dengan asumsi yang dinyatakan secara transparan.

### Bagian 3: MASTER INSTRUCTIONAL PROMPT (Bungkus dengan Pagar Empat Backtick)
Bungkus blok Master Prompt dengan pagar empat backtick dan sertakan ke-9 seksi wajib berikut secara lengkap:

1. **SEKSI 1 — KONTEKS PRODUK, TARGET USER, MVP SCOPE & ASUMSI AKTIF:**
   - Cantumkan header `KB_VERSION: 2.1.0`, `ARCHITECTURE_TIER`, dan `SURFACE_PROFILE`.
   - Rincikan `Problem & Pain Point`, `Goal & Outcome`, `Target Users & Roles`, `End-to-End User Flow`, `MVP Scope (3-5 Modul Inti)`, `Non-Goals`, serta `ASUMSI AKTIF` (selalu pilih opsi paling aman untuk privasi data).
2. **SEKSI 2 — ACCESS PROFILE & AUTHENTICATION CONTRACT (`core/access-profiles.md`):**
   - Access Profile (`P1` | `P3` | `P4`), metode `auth.login` (passphrase >= 12 karakter, salted iterated SHA-256 di `ScriptProperties` murni dengan `Utilities.getUuid()`), serta status `auth.google` (`ENABLED` / `DISABLED` — bila `ENABLED`, wajib memiliki tombol login Google di UI).
   - Session Token Contract (`base64url(payload) + "." + base64url(HMAC-SHA256)`), penyimpanan di memori JS (opsional `sessionStorage`, dilarang `localStorage`), isolasi tombol demo di produksi (`Gate W-09`), dan Rate Limiting `CacheService` (login 5x gagal -> kunci 15 menit, `file.ticket` maks 15/menit, lookup publik maks 5 gagal/15 menit dengan `tracking_token`).
3. **SEKSI 3 — DESIGN DIRECTION: PRESET, 3 DIALS & GATES (`design/presets.md` & `dials.md`):**
   - Penalaran pemilihan preset (`editorial-light` | `dense-dashboard` | `warm-friendly` | `aura`), mode tema default (`light` | `dark`), kalibrasi 3 Dials (`DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY` 1–10), aturan Anti-Fabrikasi & Slot Regulasi (`U-03` & `U-12`), serta Gerbang Kualitas (`WCAG AA >= 4,5:1`, target sentuh `>= 40x40px`, 6-state machine `INITIAL`/`LOADING`/`EMPTY`/`ERROR`/`SAVING`/`RECOVERY`, modal kustom, `<label for>`, `:focus-visible`, dan `.tabular-nums`).
4. **SEKSI 4 — FRONTEND STACK, HOSTING & ADAPTER CONTRACT (`gasly-ui`):**
   - Stack terpilih, `STACK_MODE` (`FULL_ADAPTER` | `INHERIT`), target hosting sesuai lisensi komersial (`cloudflare_pages` default komersial gratis | `vercel_pro` komersial SSR | `github_pages_demo` / `vercel_hobby_noncommercial` khusus demo non-komersial), konvensi variabel URL `/exec`, dan kontrak `gasClient` (`POST text/plain;charset=utf-8` dengan Response Envelope `{ status: "success" | "error", data, message, code: "OK" | ..., meta }`).
5. **SEKSI 5 — DATA SCHEMA, CONCURRENCY & SHEETS REPOSITORY (`gasly-data`):**
   - `SCHEMA_VERSION: '1.0.0'` (migrasi non-destruktif dengan pengecekan kolom ekuivalen `Gate G-12`).
   - Untuk setiap Sheet di `DB_SCHEMAS`: tetapkan `dataClassification` (`PUBLIC` | `INTERNAL` | `CONFIDENTIAL` | `SENSITIVE_PII`), `concurrency_mode` (`OPTIMISTIC_VERSION` untuk edit mutlak vs `DELTA_LOCK_ONLY` untuk mutasi tambah/kurang `IN`/`OUT` di dalam `LockService` sesuai `Gate G-11`), daftar `headers` (`snake_case`), daftar field `escapeFormula_()`, format ID harian `maxSeq + 1`, *soft-delete*, dan 16 baris `SEED-YYYYMMDD-XXXX` berbasis *Array of Objects* (`buildRowFromObject_()`).
6. **SEKSI 6 — UPLOAD NEEDS & GOOGLE DRIVE INTEGRATION:**
   - Status `Upload Mode` (`NONE` | `ENABLED`). Jika `ENABLED`, kunci `visibility: 'private'` (`DriveApp.Access.PRIVATE`) untuk seluruh entitas `CONFIDENTIAL` / `SENSITIVE_PII` (`Gate U-10`), alur `upload_nonce` -> `file.ticket` -> `file.upload` (kompresi `<canvas>` `~1 MB`, cek MIME + *magic bytes* biner), dan kewajiban frontend memeriksa `uploadRes.status === 'success' && uploadRes.code === 'OK'` sebelum menampilkan layar sukses (`Gate W-09`).
7. **SEKSI 7 — CENTRAL ACTION REGISTRY & ENDPOINT MATRIX:**
   - Tabel matriks berisi kolom: `Action (domain.verb) | Method | Min. Role | Require idem | Rate Limited | UI Bound | Payload Input Schema | Error Codes`.
8. **SEKSI 8 — END-TO-END ACCEPTANCE TEST MATRIX & DELIVERY CONTRACT:**
   - Skenario uji wajib (inisialisasi seed objek, kepatuhan `Gate U-10` Drive private, `Gate G-10` anti-enum `tracking_token`, `Gate G-11` konkurensi delta, `Gate W-09` verifikasi upload, serta kelulusan `python3 tools/check_contrast.py` dan `python3 tools/verify_output.py`), ditambah protokol *Chunked Delivery* (2 tahap untuk build monolitik besar) dan *Delta Update* (hanya cetak ulang file yang berubah saat revisi).
9. **SEKSI 9 — MACHINE-READABLE PROJECT CONTRACT (`GASLY_CONTRACT_JSON`):**
   - Blok JSON valid yang memuat `contract_version: "1.0.0"`, `kb_version: "2.1.0"`, `project` (`name`, `surface_profile`, `access_profile`, `regulatory_domain`), `architecture` (`tier`, `frontend_stack`, `hosting_target`, `auth_primary`, `auth_google_enabled`), `envelope_spec` (`status_values: ["success", "error"]`, `code_values`), `entities` (`sheet_name`, `id_prefix`, `data_classification`, `concurrency_mode`, `headers`, `drive_upload`), dan `actions` (`name`, `min_role`, `require_idem`, `rate_limited`, `public_lookup`, `requires_high_entropy_token`, `ui_bound`).

### Bagian 4: Dua Rekomendasi "Gasly Idea" & Panduan Handoff
1. Berikan tepat **2 ide fitur lanjutan ("Gasly Idea #1" dan "Gasly Idea #2")** yang meningkatkan nilai bisnis, otomasi, atau retensi aplikasi pada tahap berikutnya.
2. Tutup dengan kalimat panduan handoff:
   > *"👉 **Langkah Berikutnya:** Untuk menyusun prompt visual/wireframe, lanjutkan ke **`gasly-prd-to-uiux`**. Jika ingin langsung membangun aplikasi full-stack, lanjutkan ke **`gasly-pro-api`** (atau langsung **`gasly-data`** untuk backend GAS dan **`gasly-ui`** untuk frontend). Balas **'Lanjut default'** atau sertakan jawaban klarifikasi & pilihan **Gasly Idea #1/#2**."*

---

### Artifact PRD untuk Handoff (WAJIB)
Sebelum mengakhiri tahap, hasilkan `PRD-Final.md` (atau `PRD-Draft-v0.1.md` bila input berasal dari notulen rapat/MoM yang masih punya poin TBD kritis) **dengan mengikuti struktur 13 Bab pada `templates/TEMPLATE_PRD.md`** tanpa menyertakan komentar instruksi `<!-- -->`.

- Pastikan setiap kebutuhan fungsional memiliki ID unik (`PREFIX-N`), prioritas (`Wajib` | `Penting` | `Fase 2`), dan kriteria penerimaan.
- Pastikan Bab 7.1 memuat *Screen Inventory* (jembatan ke `gasly-prd-to-uiux`) dan Bab 8 mencantumkan klasifikasi privasi + status Drive (`Gate U-10`).
- Seluruh hal yang belum diputuskan klien wajib masuk ke Bab 12 (Pertanyaan Terbuka / TBD), bukan dikarang.

`PRD-Final.md` adalah dokumen produk untuk klien & desainer; `MASTER-INSTRUCTIONAL-PROMPT.md` menyimpan instruksi implementasi teknis; `GASLY_CONTRACT.json` menyimpan kontrak mesin sesuai schema kanonik. Ketiganya harus 100% konsisten.

## 5. DEFINITION OF DONE & SELF-AUDIT

Sebelum menyerahkan hasil, pastikan seluruh kriteria berikut terpenuhi:

- [ ] Beginner Mode atau Quick Mode dipilih sesuai konteks dan kelengkapan brief; informasi yang sudah tersedia tidak ditanyakan ulang.
- [ ] Pertanyaan klarifikasi tidak melebihi 3 dan tepat 2 Gasly Idea disertakan.
- [ ] `PRD-Final.md`, `MASTER-INSTRUCTIONAL-PROMPT.md`, dan `GASLY_CONTRACT.json` dihasilkan secara terpisah dan saling konsisten.
- [ ] Blok Master Prompt menyertakan Seksi 9 `GASLY_CONTRACT_JSON` serta mencantumkan `KB_VERSION: 2.1.0`.
- [ ] Setiap keputusan teknis disertai alasan, trade-off, dan batasan yang relevan.
- [ ] Dokumen sensitif (pajak/medis/identitas/keuangan) dikunci ke `visibility: "private"` (`Gate U-10`), dan lookup publik memakai `tracking_token` + rate-limit (`Gate G-10`).
- [ ] Envelope status dikunci ke `"success" | "error"` dengan kode `"OK"`; tidak ada fitur, angka bisnis, testimoni, harga, ataupun klaim yang difabrikasi.

---
name: gasly-prd-to-uiux
description: >
  Menerjemahkan PRD dan/atau referensi gambar menjadi prompt wireframe/UIUX untuk Google Stitch atau Figma AI. Mendukung mode PRD-to-UIUX, Image-First Visual Analysis, dan PRD-plus-Image; menghasilkan design rationale, prompt per layar, DESIGN.md, serta UIUX handoff yang dapat dipakai saat implementasi GASLY.
---

# GASLY PRD TO UIUX — Visual Design & Handoff Architect
**KB_VERSION:** `2.1.0`

## Mode Audit (Read-Only)

Untuk audit visual/UX yang datang dengan status `AUDIT_READ_ONLY`, analisis artifact yang tersedia tanpa membuat atau menulis ulang `DESIGN.md`, prompt, handoff, maupun preview. Laporkan evidence dan temuan sesuai `references/contract.md` bagian 10, lalu **STOP** menunggu ID yang dipilih.

## 1. Tujuan dan Mode
Skill ini menerjemahkan kebutuhan produk menjadi arahan desain yang dapat dieksekusi. Jangan mengklaim mengoperasikan Stitch/Figma secara langsung kecuali integrasi yang sesuai benar-benar tersedia.

- **Mode A — PRD to UIUX:** membaca `PRD-Final.md`, mengidentifikasi surface, pengguna, alur, halaman, data, dan state; menghasilkan prompt desain.
- **Mode B — Image-First Visual Analysis:** menganalisis screenshot/referensi visual sebelum menulis prompt; dokumentasikan ciri yang terlihat dan hal yang belum diketahui.
- **Mode C — PRD + Image to UIUX (disarankan bila keduanya tersedia):** gunakan PRD sebagai sumber kebutuhan dan gambar sebagai sumber visual; jangan menebak fitur hanya dari gambar.

## 2. Referensi Wajib
| Referensi | Tujuan |
|---|---|
| `references/presets.md` | Memilih preset desain yang tersedia dan alasannya |
| `references/dials.md` | Mengkalibrasi DESIGN_VARIANCE, MOTION_INTENSITY, VISUAL_DENSITY |
| `references/tokens.schema.json` | Menjaga struktur token tetap kompatibel |
| `references/visual-analysis.md` | Checklist audit gambar dan missing information |

Gunakan preset kanonik `editorial-light`, `dense-dashboard`, `warm-friendly`, atau `aura` sesuai `presets.md`; jangan membuat palet pastel atau Soft Neo-Brutalist menjadi default universal. Gaya khusus deployment guide tetap menjadi keputusan milik `gasly-deploy-guide`, bukan aturan bagi semua aplikasi.

## 3. Alur Kerja
1. **Inventaris input:** identifikasi PRD, screenshot, batas platform, bahasa, target device, dan output yang diminta. Jika file penting hilang, nyatakan dampaknya; jangan mengarang isinya.
2. **Audit kebutuhan:** ekstrak daftar halaman, user journey, komponen, data yang ditampilkan, aksi, role, validation, dan state (initial/loading/empty/error/saving/success/recovery bila relevan).
3. **Analisis visual (jika gambar tersedia):** catat layout, hierarchy, grid, spacing, typography, palette, radius, elevation, iconography, imagery, density, responsive behavior, dan design personality. Pisahkan temuan visual dari inferensi.
4. **Pilih arah desain:** usulkan satu arah utama dan satu alternatif hanya bila membantu keputusan. Gunakan preset serta dials yang tersedia; jelaskan trade-off dengan bahasa sederhana.
5. **Buat prompt:** satu prompt global dan prompt per layar/screen, lengkap dengan viewport desktop/mobile, hierarchy, komponen, konten realistis dari PRD, interaksi, aksesibilitas, dan states.
6. **Sinkronisasi:** setelah user membawa hasil Stitch/Figma, bandingkan terhadap PRD dan design decision. Catat perubahan/pengecualian yang disetujui, jangan mengubah kebutuhan produk secara diam-diam.

## 4. Kontrak Output
Output minimum:
- `Prompt-Desain.md`: prompt global dan prompt per layar siap ditempel ke Google Stitch/Figma AI.
- `DESIGN.md`: art direction, design principles, selected preset, dials, type scale, spacing, component behavior, responsive rules, and accessibility constraints.
- `UIUX_HANDOFF.md`: peta screen-to-requirement, component inventory, interactions, data requirements, states, responsive notes, open questions, and acceptance checklist.

Output opsional: artifact HTML `Pratinjau-Gaya.html` yang membandingkan arah visual untuk membantu pengguna non-teknis. Gunakan template repository `templates/pratinjau-gaya.html` sebagai titik awal, isi seluruh placeholder dari PRD/arah visual yang dipilih, hapus placeholder yang tidak digunakan, dan pastikan artifact tetap self-contained. Isi harus berasal dari PRD; interaksi demo harus diberi label simulasi.

## 5. Token Contract
- Gunakan `references/tokens.schema.json` dan file preset JSON sebagai sumber kanonik untuk token yang sudah ada di repository.
- Jangan menjadikan `tokens.css` buatan bebas sebagai sumber kebenaran kedua. Bila implementasi membutuhkan CSS variables, hasilkan sebagai ekspor yang diturunkan dari token/preset kanonik dan dokumentasikan pemetaan token.
- Jangan mengklaim seluruh warna otomatis lulus WCAG AA hanya berdasarkan penilaian visual. Jalankan `tools/check_contrast.py` atau validator yang sesuai untuk pasangan foreground/background dan status states.
- Stitch/Figma adalah referensi layout/visual. Perubahan nilai token harus dicatat dalam `DESIGN.md` dan disinkronkan ke sumber kanonik sebelum implementasi.

## 6. Anti-Slop Berbasis Konteks
- Hindari layout, komponen, dan copy generik yang tidak punya dasar di PRD.
- Jangan melarang gradient, glass, ilustrasi, animasi, atau pola layout secara mutlak bila gaya yang disetujui memang memerlukannya; ukurannya harus konsisten dengan art direction, aksesibilitas, performa, dan konteks produk.
- Jangan membuat logo klien, testimoni, angka penggunaan, rating, foto, maupun klaim bisnis fiktif.
- Gunakan konten konkret yang tersedia di PRD. Untuk konten yang belum diketahui, gunakan label data contoh yang jelas atau minta input.

## 7. Definition of Done
- [ ] Semua screen dan alur utama traceable ke PRD.
- [ ] Referensi visual dibedakan antara observasi dan asumsi.
- [ ] Prompt per screen menyebut hierarchy, komponen, interaksi, state, mobile/desktop, dan aksesibilitas yang relevan.
- [ ] Design tokens merujuk sumber kanonik repository.
- [ ] `DESIGN.md` dan `UIUX_HANDOFF.md` konsisten dengan prompt desain.
- [ ] Tidak ada fitur atau klaim fiktif.

---
<!-- DESIGN: dials.md -->
<!-- KB_VERSION: 2.1.0 -->
# CHARACTER DIALS & ANTI-GENERIC UI RULES (`design/dials.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-prd`, `gasly-prd-to-uiux`, dan `gasly-ui`.

## Daftar Isi
1. [Tiga Dials Karakter Desain (Skala 1–10)](#1-tiga-dials-karakter-desain-skala-110)
2. [Tabel Terjemahan Dials ke Implementasi CSS/Layout](#2-tabel-terjemahan-dials-ke-implementasi-csslayout)
3. [Aturan Anti-Generic AI UI (Anti-Slop Guardrails)](#3-aturan-anti-generic-ai-ui-anti-slop-guardrails)

---

## 1. Tiga Dials Karakter Desain (Skala 1–10)

Selain memilih satu **Preset Visual**, tahap perencanaan/desain (`gasly-prd` dan `gasly-prd-to-uiux`) wajib menetapkan nilai bulat `1` sampai `10` untuk tiga parameter karakter berikut:

1. **`DESIGN_VARIANCE` (`1–10`) — Asimetri & Eksplorasi Komposisi:**
   - Mengatur seberapa seragam atau asimetris struktur tata letak (*grid*), proporsi kartu, dan kontras ukuran tipografi.
2. **`MOTION_INTENSITY` (`1–10`) — Koreografi Transisi & Umpan Balik:**
   - Mengatur tingkat kehalusan transisi state, kemunculan modal/toast, dan respons mikro saat interaksi. Seluruh nilai wajib tetap mematuhi `@media (prefers-reduced-motion: reduce)`.
3. **`VISUAL_DENSITY` (`1–10`) — Kepadatan Informasi per Layar:**
   - Mengatur jarak spasi (*padding/gap*), tinggi baris tabel, dan jumlah metrik yang ditampilkan tanpa perlu menggulir (*scrolling*).

---

## 2. Tabel Terjemahan Dials ke Implementasi CSS/Layout

| Dial | Rentang Rendah (`1–3`) | Rentang Menengah (`4–7`) | Rentang Tinggi (`8–10`) |
| :--- | :--- | :--- | :--- |
| **`DESIGN_VARIANCE`** | Grid simetris ketat (`12-col` / `3-col` seragam), tinggi kartu identik, fokus murni pada keterbacaan tabel dan form standar. | Kombinasi kartu ringkasan utama dengan lebar berbeda (`col-span-8` + `col-span-4`), satu focal section beraksen di per tampilan. | Tata letak Bento asimetris atau komposisi editorial berlapis, kontras mencolok antara judul `Display` dan teks pendukung. |
| **`MOTION_INTENSITY`** | Transisi instan (`0ms–80ms`), hanya perubahan warna hover dan indikator spinner fungsional tanpa animasi masuk/keluar. | Transisi mikro terukur (`150ms–220ms` `cubic-bezier(0.16, 1, 0.3, 1)`), skeleton shimmer halus, dan animasi slide-in pada toast/drawer. | Transisi berlapis (`staggered reveal` ringan `40ms` antar kartu utama), umpan balik skala mikro pada tombol aktif (`scale(0.98)`), tetap tanpa memblokir input pengguna. |
| **`VISUAL_DENSITY`** | Ruang kosong (*whitespace*) lega: padding kartu `24px–32px`, gap `24px`, tinggi baris tabel `52px`, cocok untuk landing page atau tampilan eksekutif. | Kepadatan seimbang: padding kartu `20px`, gap `16px`, tinggi baris tabel `44px`, cocok untuk aplikasi operasional umum. | Kepadatan tinggi (*compact backoffice*): padding kartu `12px–16px`, gap `8px–12px`, tinggi baris tabel `34px–36px`, border sel tegas, font body `13px–14px` dengan `.tabular-nums`. |

> **Batas Keamanan Target Sentuh (`U-06`):** Bahkan ketika `VISUAL_DENSITY` bernilai `8–10`, pada layar mobile (`<768px`) area sentuh tombol, checkbox, dan kontrol aksi wajib tetap minimal `40px × 40px`.

---

## 3. Aturan Anti-Generic AI UI (Anti-Slop Guardrails)

Untuk mencegah tampilan aplikasi terlihat seperti hasil cetakan template AI generik yang seragam:
1. **Jangan Memasang Elemen Dekoratif Tanpa Fungsi:**
   - Dilarang menampilkan grafik palsu yang angkanya di-*hardcode* di HTML dan tidak dihitung dari data Sheet yang sebenarnya.
   - Dilarang menampilkan lonceng notifikasi, pemilih bahasa, atau lencana *"Pro Plan"* jika aplikasi tidak memiliki fitur tersebut di backend.
2. **Hindari Banjir Gradien & Glow:**
   - Maksimal **satu** elemen utama pada layar (seperti tombol CTA primer atau satu kartu sorotan di Hero) yang boleh menggunakan aksen kontras penuh. Jangan mewarnai setiap kartu KPI dengan gradien pelangi berbeda.
3. **Hirarki Data Nyata di Atas Ornamen:**
   - Pada aplikasi bisnis dan operasional, tabel data, filter pencarian, status sinkronisasi, dan tombol aksi utama harus langsung terlihat di paruh atas layar (*above the fold*) tanpa tertutup banner sambutan yang memakan setengah layar.
4. **Opsi Pemeriksaan CI Anti-Slop (Dokumentasi Opsional):**
   - Repositori dapat menambahkan langkah pemeriksaan statis opsional di CI yang mendeteksi pola terlarang pada hasil generasi (seperti `window.confirm(`, klaim `"10,000+ UMKM"`, atau `user-scalable=no`). Lihat dokumentasi workflow pada Fase 6.

---
<!-- DESIGN: presets.md -->
<!-- KB_VERSION: 2.1.0 -->
# DESIGN PRESETS SELECTION & APPLICATION GUIDE (`design/presets.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-prd`, `gasly-prd-to-uiux`, dan `gasly-ui`.

## Daftar Isi
1. [Aturan Pemilihan Preset (AURA Bukan Default Otomatis)](#1-aturan-pemilihan-preset-aura-bukan-default-otomatis)
2. [Profil Keempat Preset Resmi](#2-profil-keempat-preset-resmi)
3. [Matriks Pemetaan Jenis Produk ke Preset & Dials](#3-matriks-pemetaan-jenis-produk-ke-preset--dials)
4. [Cara Mengonsumsi Token JSON & Variabel CSS](#4-cara-mengonsumsi-token-json--variabel-css)

---

## 1. Aturan Pemilihan Preset (AURA Bukan Default Otomatis)

`aura` adalah salah satu dari empat preset di dalam sistem desain Gasly dan **tidak pernah menjadi default otomatis**. Tahap perencana (`gasly-prd`) dan desain (`gasly-prd-to-uiux`) wajib menganalisis domain bisnis, lingkungan kerja pengguna (apakah di ruangan terang/lapangan atau di depan monitor gelap), serta kepadatan data sebelum menetapkan preset.

---

## 2. Profil Keempat Preset Resmi

### 1. `editorial-light` (Default Mode: `light`)
- **Karakter:** Kertas ivory hangat (`#FAF8F5`), tinta batu tua (`#1C1917`), aksen terakota/bata (`#9A3412`), perpaduan tipografi judul serif berwibawa (`Newsreader`/`Georgia`) dengan teks body sans-serif bersih (`Plus Jakarta Sans`), sudut tegas (`4px–12px`).
- **Kapan Dipakai:** Jasa profesional (konsultan pajak/hukum, agensi, arsitek), lembaga pendidikan, publikasi laporan, portofolio B2B, atau landing page yang mengutamakan kredibilitas teks.

### 2. `dense-dashboard` (Default Mode: `light`)
- **Karakter:** Abu-abu slate netral yang tajam (`#F1F5F9` / `#FFFFFF`), aksen biru kobalt fungsional (`#1D4ED8`), grid rapat berbasis `4px`, radius sudut kecil (`4px–10px`), fokus pada tabel multi-kolom berangka `.tabular-nums` dan filter cepat.
- **Kapan Dipakai:** Inventaris gudang, akuntansi/reimburse, logistik, pengadaan barang, manajemen aset, dan internal tool staf operasional yang memproses puluhan baris data per layar.

### 3. `warm-friendly` (Default Mode: `light`)
- **Karakter:** Latar krim/pasir lembut (`#FDFBF7` / `#F3EFE6`), teks hijau hutan gelap (`#132A24`), aksen hijau teal (`#0F766E`) dan amber hangat, geometri membulat ramah (`8px–24px`), tipografi `Plus Jakarta Sans`.
- **Kapan Dipakai:** UMKM kuliner/F&B, klinik kesehatan/kecantikan, reservasi layanan, sekolah/komunitas, koperasi, dan aplikasi kasir/pelanggan ritel.

### 4. `aura` (Default Mode: `dark`)
- **Karakter:** Latar zinc gelap (`#09090B` / `#18181B`), hairline border tipis, aksen indigo/violet (`#4F46E5` / `#6366F1`), komposisi Bento modern, tipografi `Inter` + `JetBrains Mono`.
- **Kapan Dipakai:** Produk SaaS teknologi/AI, developer tools, analitik digital kreatif, atau ketika pengguna secara spesifik menginginkan estetika gelap ala Linear/Vercel.

---

## 3. Matriks Pemetaan Jenis Produk ke Preset & Dials

| Kategori Produk / Brief | Preset yang Direkomendasikan | Default Mode | Rekomendasi Dials (`VARIANCE / MOTION / DENSITY`) |
| :--- | :--- | :---: | :---: |
| Gudang, Stok, Keuangan, Reimburse, HR Internal | `dense-dashboard` | `light` | `2 / 2 / 9` |
| Konsultan, Hukum, Pajak, Pendidikan, B2B Landing Page | `editorial-light` | `light` | `6 / 3 / 4` |
| UMKM, F&B, Klinik, Salon, Komunitas, Pendaftaran Acara | `warm-friendly` | `light` | `5 / 5 / 4` |
| AI Tool, Tech Startup SaaS, Analitik Produk Digital | `aura` | `dark` | `7 / 6 / 5` |

---

## 4. Cara Mengonsumsi Token JSON & Variabel CSS

1. **Pada Stack Web (`html-tailwind`, `nextjs`+`shadcn`, `astro`, dan stack web pewaris):**
   - Muat variabel dari `src/design/css/<preset>.css` ke stylesheet global aplikasi.
   - Gunakan variabel semantik (`var(--bg-base)`, `var(--bg-surface)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--text-helper)`, `var(--accent-solid)`, `var(--accent-text-on-solid)`) agar pergantian tema (`data-theme="light"` vs `data-theme="dark"`) selalu mempertahankan rasio kontras WCAG AA.
2. **Pada Stack Native / Desktop Pewaris (`flutter`, `react-native`, `swiftui`, `jetpack-compose`, `wpf`, dll.):**
   - Baca nilai hex langsung dari `src/design/presets/<preset>.tokens.json` pada objek `modes.light` dan `modes.dark`, serta patuhi daftar `contrastPairs`.

---
<!-- FILE: presets/aura.tokens.json -->
```json
{
  "id": "aura",
  "name": "AURA Modern Tech & AI SaaS",
  "version": "2.1.0",
  "defaultMode": "dark",
  "recommendedDials": {
    "DESIGN_VARIANCE": 7,
    "MOTION_INTENSITY": 6,
    "VISUAL_DENSITY": 5
  },
  "typography": {
    "fontSans": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "fontDisplay": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "fontMono": "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    "scale": {
      "display": "clamp(2.75rem, 5vw, 4rem)",
      "h1": "clamp(2rem, 3.5vw, 2.5rem)",
      "h2": "clamp(1.25rem, 2vw, 1.5rem)",
      "body": "0.9375rem",
      "caption": "0.75rem"
    }
  },
  "geometry": {
    "radiusSm": "6px",
    "radiusMd": "8px",
    "radiusLg": "12px",
    "radiusXl": "20px",
    "gridBasePx": 8
  },
  "modes": {
    "dark": {
      "bgBase": "#09090B",
      "bgSurface": "#18181B",
      "bgInteractive": "#222226",
      "textPrimary": "#F4F4F5",
      "textSecondary": "#A1A1AA",
      "textHelper": "#8A8A93",
      "textDisabled": "#71717A",
      "borderSubtle": "#27272A",
      "borderFocus": "#6366F1",
      "accentSolid": "#4F46E5",
      "accentTextOnSolid": "#FFFFFF",
      "successSolid": "#10B981",
      "successTextOnSolid": "#09090B",
      "successSoftBg": "#052E16",
      "successSoftText": "#86EFAC",
      "warningSolid": "#F59E0B",
      "warningTextOnSolid": "#09090B",
      "warningSoftBg": "#451A03",
      "warningSoftText": "#FCD34D",
      "dangerSolid": "#E11D48",
      "dangerTextOnSolid": "#FFFFFF",
      "dangerSoftBg": "#4C0519",
      "dangerSoftText": "#FDA4AF"
    },
    "light": {
      "bgBase": "#F8FAFC",
      "bgSurface": "#FFFFFF",
      "bgInteractive": "#F1F5F9",
      "textPrimary": "#0F172A",
      "textSecondary": "#475569",
      "textHelper": "#526071",
      "textDisabled": "#94A3B8",
      "borderSubtle": "#E2E8F0",
      "borderFocus": "#4F46E5",
      "accentSolid": "#4F46E5",
      "accentTextOnSolid": "#FFFFFF",
      "successSolid": "#047857",
      "successTextOnSolid": "#FFFFFF",
      "successSoftBg": "#DCFCE7",
      "successSoftText": "#14532D",
      "warningSolid": "#F59E0B",
      "warningTextOnSolid": "#0F172A",
      "warningSoftBg": "#FEF3C7",
      "warningSoftText": "#78350F",
      "dangerSolid": "#E11D48",
      "dangerTextOnSolid": "#FFFFFF",
      "dangerSoftBg": "#FFE4E6",
      "dangerSoftText": "#881337"
    }
  },
  "contrastPairs": [
    { "fg": "textPrimary", "bg": "bgBase", "minRatio": 4.5, "usage": "Primary text on base canvas" },
    { "fg": "textPrimary", "bg": "bgSurface", "minRatio": 4.5, "usage": "Primary text on elevated cards" },
    { "fg": "textPrimary", "bg": "bgInteractive", "minRatio": 4.5, "usage": "Primary text on interactive hover surface" },
    { "fg": "textSecondary", "bg": "bgBase", "minRatio": 4.5, "usage": "Body copy on base canvas" },
    { "fg": "textSecondary", "bg": "bgSurface", "minRatio": 4.5, "usage": "Body copy on elevated cards" },
    { "fg": "textSecondary", "bg": "bgInteractive", "minRatio": 4.5, "usage": "Body copy on interactive hover surface" },
    { "fg": "textHelper", "bg": "bgBase", "minRatio": 4.5, "usage": "Helper/caption text on base canvas" },
    { "fg": "textHelper", "bg": "bgSurface", "minRatio": 4.5, "usage": "Helper/caption text on elevated cards" },
    { "fg": "textHelper", "bg": "bgInteractive", "minRatio": 4.5, "usage": "Helper/caption text on interactive hover surface" },
    { "fg": "accentTextOnSolid", "bg": "accentSolid", "minRatio": 4.5, "usage": "Primary CTA button label" },
    { "fg": "successTextOnSolid", "bg": "successSolid", "minRatio": 4.5, "usage": "Success solid button label" },
    { "fg": "successSoftText", "bg": "successSoftBg", "minRatio": 4.5, "usage": "Success soft badge label" },
    { "fg": "warningTextOnSolid", "bg": "warningSolid", "minRatio": 4.5, "usage": "Warning solid button label" },
    { "fg": "warningSoftText", "bg": "warningSoftBg", "minRatio": 4.5, "usage": "Warning soft badge label" },
    { "fg": "dangerTextOnSolid", "bg": "dangerSolid", "minRatio": 4.5, "usage": "Destructive button label" },
    { "fg": "dangerSoftText", "bg": "dangerSoftBg", "minRatio": 4.5, "usage": "Danger soft badge label" }
  ]
}
```


---
<!-- FILE: presets/dense-dashboard.tokens.json -->
```json
{
  "id": "dense-dashboard",
  "name": "Dense Operations & Financial Backoffice",
  "version": "2.1.0",
  "defaultMode": "light",
  "recommendedDials": {
    "DESIGN_VARIANCE": 2,
    "MOTION_INTENSITY": 2,
    "VISUAL_DENSITY": 9
  },
  "typography": {
    "fontSans": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "fontDisplay": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "fontMono": "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    "scale": {
      "display": "clamp(2.25rem, 4vw, 3rem)",
      "h1": "clamp(1.75rem, 2.8vw, 2.125rem)",
      "h2": "clamp(1.125rem, 1.8vw, 1.25rem)",
      "body": "0.875rem",
      "caption": "0.75rem"
    }
  },
  "geometry": {
    "radiusSm": "4px",
    "radiusMd": "6px",
    "radiusLg": "8px",
    "radiusXl": "10px",
    "gridBasePx": 4
  },
  "modes": {
    "light": {
      "bgBase": "#F1F5F9",
      "bgSurface": "#FFFFFF",
      "bgInteractive": "#E2E8F0",
      "textPrimary": "#0F172A",
      "textSecondary": "#334155",
      "textHelper": "#475569",
      "textDisabled": "#94A3B8",
      "borderSubtle": "#CBD5E1",
      "borderFocus": "#1D4ED8",
      "accentSolid": "#1D4ED8",
      "accentTextOnSolid": "#FFFFFF",
      "successSolid": "#047857",
      "successTextOnSolid": "#FFFFFF",
      "successSoftBg": "#DCFCE7",
      "successSoftText": "#14532D",
      "warningSolid": "#B45309",
      "warningTextOnSolid": "#FFFFFF",
      "warningSoftBg": "#FEF3C7",
      "warningSoftText": "#78350F",
      "dangerSolid": "#B91C1C",
      "dangerTextOnSolid": "#FFFFFF",
      "dangerSoftBg": "#FFE4E6",
      "dangerSoftText": "#881337"
    },
    "dark": {
      "bgBase": "#0B0F19",
      "bgSurface": "#111827",
      "bgInteractive": "#1E293B",
      "textPrimary": "#F8FAFC",
      "textSecondary": "#CBD5E1",
      "textHelper": "#94A3B8",
      "textDisabled": "#64748B",
      "borderSubtle": "#1E293B",
      "borderFocus": "#3B82F6",
      "accentSolid": "#2563EB",
      "accentTextOnSolid": "#FFFFFF",
      "successSolid": "#047857",
      "successTextOnSolid": "#FFFFFF",
      "successSoftBg": "#052E16",
      "successSoftText": "#86EFAC",
      "warningSolid": "#F59E0B",
      "warningTextOnSolid": "#0B0F19",
      "warningSoftBg": "#451A03",
      "warningSoftText": "#FCD34D",
      "dangerSolid": "#DC2626",
      "dangerTextOnSolid": "#FFFFFF",
      "dangerSoftBg": "#4C0519",
      "dangerSoftText": "#FDA4AF"
    }
  },
  "contrastPairs": [
    { "fg": "textPrimary", "bg": "bgBase", "minRatio": 4.5, "usage": "Table cell primary data on base" },
    { "fg": "textPrimary", "bg": "bgSurface", "minRatio": 4.5, "usage": "Table cell primary data on surface" },
    { "fg": "textPrimary", "bg": "bgInteractive", "minRatio": 4.5, "usage": "Table cell primary data on selected/hover row" },
    { "fg": "textSecondary", "bg": "bgBase", "minRatio": 4.5, "usage": "Secondary data column on base" },
    { "fg": "textSecondary", "bg": "bgSurface", "minRatio": 4.5, "usage": "Secondary data column on surface" },
    { "fg": "textSecondary", "bg": "bgInteractive", "minRatio": 4.5, "usage": "Secondary data column on hover row" },
    { "fg": "textHelper", "bg": "bgBase", "minRatio": 4.5, "usage": "Column header & unit label on base" },
    { "fg": "textHelper", "bg": "bgSurface", "minRatio": 4.5, "usage": "Column header & unit label on surface" },
    { "fg": "textHelper", "bg": "bgInteractive", "minRatio": 4.5, "usage": "Column header & unit label on hover row" },
    { "fg": "accentTextOnSolid", "bg": "accentSolid", "minRatio": 4.5, "usage": "Primary cobalt action button" },
    { "fg": "successTextOnSolid", "bg": "successSolid", "minRatio": 4.5, "usage": "Reconciled/approved status button" },
    { "fg": "successSoftText", "bg": "successSoftBg", "minRatio": 4.5, "usage": "Approved soft badge" },
    { "fg": "warningTextOnSolid", "bg": "warningSolid", "minRatio": 4.5, "usage": "Pending/audit status button" },
    { "fg": "warningSoftText", "bg": "warningSoftBg", "minRatio": 4.5, "usage": "Pending soft badge" },
    { "fg": "dangerTextOnSolid", "bg": "dangerSolid", "minRatio": 4.5, "usage": "Reject/delete action button" },
    { "fg": "dangerSoftText", "bg": "dangerSoftBg", "minRatio": 4.5, "usage": "Rejected soft badge" }
  ]
}
```


---
<!-- FILE: presets/editorial-light.tokens.json -->
```json
{
  "id": "editorial-light",
  "name": "Editorial Warm Ivory & Deep Ink",
  "version": "2.1.0",
  "defaultMode": "light",
  "recommendedDials": {
    "DESIGN_VARIANCE": 6,
    "MOTION_INTENSITY": 3,
    "VISUAL_DENSITY": 4
  },
  "typography": {
    "fontSans": "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "fontDisplay": "'Newsreader', 'Georgia', 'Times New Roman', serif",
    "fontMono": "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    "scale": {
      "display": "clamp(2.875rem, 5.2vw, 4rem)",
      "h1": "clamp(2.125rem, 3.6vw, 2.5rem)",
      "h2": "clamp(1.375rem, 2.2vw, 1.5rem)",
      "body": "1rem",
      "caption": "0.75rem"
    }
  },
  "geometry": {
    "radiusSm": "4px",
    "radiusMd": "6px",
    "radiusLg": "8px",
    "radiusXl": "12px",
    "gridBasePx": 8
  },
  "modes": {
    "light": {
      "bgBase": "#FAF8F5",
      "bgSurface": "#FFFFFF",
      "bgInteractive": "#F2EFE9",
      "textPrimary": "#1C1917",
      "textSecondary": "#44403C",
      "textHelper": "#57534E",
      "textDisabled": "#A8A29E",
      "borderSubtle": "#E7E5E4",
      "borderFocus": "#9A3412",
      "accentSolid": "#9A3412",
      "accentTextOnSolid": "#FFFFFF",
      "successSolid": "#166534",
      "successTextOnSolid": "#FFFFFF",
      "successSoftBg": "#DCFCE7",
      "successSoftText": "#14532D",
      "warningSolid": "#F59E0B",
      "warningTextOnSolid": "#1C1917",
      "warningSoftBg": "#FEF3C7",
      "warningSoftText": "#78350F",
      "dangerSolid": "#991B1B",
      "dangerTextOnSolid": "#FFFFFF",
      "dangerSoftBg": "#FFE4E6",
      "dangerSoftText": "#881337"
    },
    "dark": {
      "bgBase": "#12100E",
      "bgSurface": "#1C1917",
      "bgInteractive": "#262320",
      "textPrimary": "#F5F5F4",
      "textSecondary": "#D6D3D1",
      "textHelper": "#A8A29E",
      "textDisabled": "#78716C",
      "borderSubtle": "#292524",
      "borderFocus": "#EA580C",
      "accentSolid": "#C2410C",
      "accentTextOnSolid": "#FFFFFF",
      "successSolid": "#15803D",
      "successTextOnSolid": "#FFFFFF",
      "successSoftBg": "#052E16",
      "successSoftText": "#86EFAC",
      "warningSolid": "#F59E0B",
      "warningTextOnSolid": "#12100E",
      "warningSoftBg": "#451A03",
      "warningSoftText": "#FCD34D",
      "dangerSolid": "#B91C1C",
      "dangerTextOnSolid": "#FFFFFF",
      "dangerSoftBg": "#4C0519",
      "dangerSoftText": "#FDA4AF"
    }
  },
  "contrastPairs": [
    { "fg": "textPrimary", "bg": "bgBase", "minRatio": 4.5, "usage": "Editorial headline on ivory/espresso canvas" },
    { "fg": "textPrimary", "bg": "bgSurface", "minRatio": 4.5, "usage": "Primary copy on paper card" },
    { "fg": "textPrimary", "bg": "bgInteractive", "minRatio": 4.5, "usage": "Primary copy on stone hover surface" },
    { "fg": "textSecondary", "bg": "bgBase", "minRatio": 4.5, "usage": "Article body on base canvas" },
    { "fg": "textSecondary", "bg": "bgSurface", "minRatio": 4.5, "usage": "Article body on paper card" },
    { "fg": "textSecondary", "bg": "bgInteractive", "minRatio": 4.5, "usage": "Article body on stone hover surface" },
    { "fg": "textHelper", "bg": "bgBase", "minRatio": 4.5, "usage": "Byline/metadata on base canvas" },
    { "fg": "textHelper", "bg": "bgSurface", "minRatio": 4.5, "usage": "Byline/metadata on paper card" },
    { "fg": "textHelper", "bg": "bgInteractive", "minRatio": 4.5, "usage": "Byline/metadata on stone hover surface" },
    { "fg": "accentTextOnSolid", "bg": "accentSolid", "minRatio": 4.5, "usage": "Primary terracotta CTA button" },
    { "fg": "successTextOnSolid", "bg": "successSolid", "minRatio": 4.5, "usage": "Success indicator label" },
    { "fg": "successSoftText", "bg": "successSoftBg", "minRatio": 4.5, "usage": "Success soft badge" },
    { "fg": "warningTextOnSolid", "bg": "warningSolid", "minRatio": 4.5, "usage": "Warning indicator label" },
    { "fg": "warningSoftText", "bg": "warningSoftBg", "minRatio": 4.5, "usage": "Warning soft badge" },
    { "fg": "dangerTextOnSolid", "bg": "dangerSolid", "minRatio": 4.5, "usage": "Danger indicator label" },
    { "fg": "dangerSoftText", "bg": "dangerSoftBg", "minRatio": 4.5, "usage": "Danger soft badge" }
  ]
}
```


---
<!-- FILE: presets/warm-friendly.tokens.json -->
```json
{
  "id": "warm-friendly",
  "name": "Warm Friendly Retail, Clinic & Community",
  "version": "2.1.0",
  "defaultMode": "light",
  "recommendedDials": {
    "DESIGN_VARIANCE": 5,
    "MOTION_INTENSITY": 5,
    "VISUAL_DENSITY": 4
  },
  "typography": {
    "fontSans": "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "fontDisplay": "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "fontMono": "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    "scale": {
      "display": "clamp(2.5rem, 4.8vw, 3.75rem)",
      "h1": "clamp(2rem, 3.4vw, 2.5rem)",
      "h2": "clamp(1.25rem, 2vw, 1.5rem)",
      "body": "0.9375rem",
      "caption": "0.75rem"
    }
  },
  "geometry": {
    "radiusSm": "8px",
    "radiusMd": "12px",
    "radiusLg": "16px",
    "radiusXl": "24px",
    "gridBasePx": 8
  },
  "modes": {
    "light": {
      "bgBase": "#FDFBF7",
      "bgSurface": "#FFFFFF",
      "bgInteractive": "#F3EFE6",
      "textPrimary": "#132A24",
      "textSecondary": "#334E48",
      "textHelper": "#48655E",
      "textDisabled": "#94A39E",
      "borderSubtle": "#E4DFD3",
      "borderFocus": "#0F766E",
      "accentSolid": "#0F766E",
      "accentTextOnSolid": "#FFFFFF",
      "successSolid": "#15803D",
      "successTextOnSolid": "#FFFFFF",
      "successSoftBg": "#DCFCE7",
      "successSoftText": "#14532D",
      "warningSolid": "#F59E0B",
      "warningTextOnSolid": "#132A24",
      "warningSoftBg": "#FEF3C7",
      "warningSoftText": "#78350F",
      "dangerSolid": "#BE123C",
      "dangerTextOnSolid": "#FFFFFF",
      "dangerSoftBg": "#FFE4E6",
      "dangerSoftText": "#881337"
    },
    "dark": {
      "bgBase": "#0C1715",
      "bgSurface": "#13221F",
      "bgInteractive": "#1B2E2A",
      "textPrimary": "#F0FDF4",
      "textSecondary": "#B2D8D0",
      "textHelper": "#8EB8B0",
      "textDisabled": "#56756E",
      "borderSubtle": "#233B36",
      "borderFocus": "#14B8A6",
      "accentSolid": "#14B8A6",
      "accentTextOnSolid": "#0C1715",
      "successSolid": "#10B981",
      "successTextOnSolid": "#0C1715",
      "successSoftBg": "#052E16",
      "successSoftText": "#86EFAC",
      "warningSolid": "#F59E0B",
      "warningTextOnSolid": "#0C1715",
      "warningSoftBg": "#451A03",
      "warningSoftText": "#FCD34D",
      "dangerSolid": "#E11D48",
      "dangerTextOnSolid": "#FFFFFF",
      "dangerSoftBg": "#4C0519",
      "dangerSoftText": "#FDA4AF"
    }
  },
  "contrastPairs": [
    { "fg": "textPrimary", "bg": "bgBase", "minRatio": 4.5, "usage": "Primary heading on warm cream/deep forest canvas" },
    { "fg": "textPrimary", "bg": "bgSurface", "minRatio": 4.5, "usage": "Primary text on card surface" },
    { "fg": "textPrimary", "bg": "bgInteractive", "minRatio": 4.5, "usage": "Primary text on sand hover surface" },
    { "fg": "textSecondary", "bg": "bgBase", "minRatio": 4.5, "usage": "Friendly body copy on base canvas" },
    { "fg": "textSecondary", "bg": "bgSurface", "minRatio": 4.5, "usage": "Friendly body copy on card surface" },
    { "fg": "textSecondary", "bg": "bgInteractive", "minRatio": 4.5, "usage": "Friendly body copy on hover surface" },
    { "fg": "textHelper", "bg": "bgBase", "minRatio": 4.5, "usage": "Helper label on base canvas" },
    { "fg": "textHelper", "bg": "bgSurface", "minRatio": 4.5, "usage": "Helper label on card surface" },
    { "fg": "textHelper", "bg": "bgInteractive", "minRatio": 4.5, "usage": "Helper label on hover surface" },
    { "fg": "accentTextOnSolid", "bg": "accentSolid", "minRatio": 4.5, "usage": "Primary teal CTA button" },
    { "fg": "successTextOnSolid", "bg": "successSolid", "minRatio": 4.5, "usage": "Success pill/button" },
    { "fg": "successSoftText", "bg": "successSoftBg", "minRatio": 4.5, "usage": "Success soft badge" },
    { "fg": "warningTextOnSolid", "bg": "warningSolid", "minRatio": 4.5, "usage": "Warning pill/button" },
    { "fg": "warningSoftText", "bg": "warningSoftBg", "minRatio": 4.5, "usage": "Warning soft badge" },
    { "fg": "dangerTextOnSolid", "bg": "dangerSolid", "minRatio": 4.5, "usage": "Danger pill/button" },
    { "fg": "dangerSoftText", "bg": "dangerSoftBg", "minRatio": 4.5, "usage": "Danger soft badge" }
  ]
}
```
