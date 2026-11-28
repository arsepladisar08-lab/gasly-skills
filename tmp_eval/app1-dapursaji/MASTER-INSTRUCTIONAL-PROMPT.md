# MASTER-INSTRUCTIONAL-PROMPT.md
**Project:** DapurSaji  
**KB_VERSION:** `2.1.0`  
**Architecture:** `TIER_1_DECOUPLED_WORKSPACE`  
**Surface:** `PUBLIC_SERVICE`  
**Mode:** Quick Mode — Mode Referensi Mandiri

Anda adalah engineer implementasi Gasly. Bangun aplikasi sesuai PRD-Final.md dan GASLY_CONTRACT.json. Jangan mengubah kebutuhan produk, jangan mengarang konten bisnis, dan jangan mengendurkan hard gates. PRD adalah sumber kebutuhan; kontrak adalah sumber enum/schema API. Bila ada konflik, hentikan bagian yang konflik dan laporkan, jangan diam-diam mengubah kontrak.

## SEKSI 1 — KONTEKS PRODUK, TARGET USER, MVP SCOPE & ASUMSI AKTIF

### Problem & Pain Point
DapurSaji membutuhkan katalog paket katering/nasi kotak, formulir pemesanan terstruktur, unggah bukti DP, pelacakan status tanpa akun, dan panel admin. Hindari proses pemesanan yang tersebar dan data yang tidak konsisten.

### Goal & Outcome
1. Pengunjung melihat katalog yang dikelola admin.
2. Pembeli membuat pesanan dan memperoleh nomor pesanan serta token pelacakan.
3. Bukti DP diunggah ke Google Drive privat.
4. Pembeli memeriksa status dengan nomor pesanan + token.
5. Admin mengelola pesanan, memeriksa bukti secara privat, dan memperbarui status.

### Target Users & Roles
- `PUBLIC`: pengunjung katalog.
- `PUBLIC_ORDER_OWNER`: pembeli yang membawa token pesanan/tiket upload sah.
- `ADMIN`: admin DapurSaji dengan sesi HMAC valid.
Tidak ada akun pelanggan dan tidak ada multi-tenant.

### End-to-End User Flow
Katalog → pilih paket → isi form → `order.create` → terbitkan nomor + tracking token → tampilkan token satu kali → `file.ticket` → `file.upload` → cek status melalui `order.track`. Admin login → daftar pesanan → detail → lihat bukti melalui `file.adminView` → update status.

### MVP Scope (5 Modul Inti)
1. Katalog publik dan detail paket.
2. Pemesanan dan kalkulasi harga server-side.
3. Unggah bukti transfer DP privat.
4. Pelacakan status publik anti-enumerasi.
5. Admin login, manajemen pesanan, dan CRUD katalog.

### Non-Goals
Tidak membuat customer login, payment gateway, WhatsApp API, OTP email, multi-cabang, multi-tenant, inventori bahan baku, testimoni palsu, statistik pelanggan fiktif, refund, atau kebijakan DP yang belum diberikan.

### ASUMSI AKTIF
- Bahasa Indonesia, IDR, timezone `Asia/Jakarta`.
- `auth.google = DISABLED`; autentikasi admin menggunakan passphrase.
- Frontend eksternal Cloudflare Pages; backend satu GAS Web App `/exec`.
- Bukti transfer diklasifikasikan sebagai data keuangan pelanggan dan disimpan private.
- `ORDERS` `SENSITIVE_PII`; `ORDER_ITEMS` `CONFIDENTIAL`; `CATALOG` `PUBLIC`.
- Status awal yang diusulkan: `MENUNGGU_DP`, `DP_DITERIMA`, `DIPROSES`, `SIAP_DIANTAR`, `SELESAI`, `DIBATALKAN`; pemilik harus menyetujui transisi.
- Harga, DP, rekening, biaya kirim, minimum order, area layanan, jam operasional, retensi, kontak, dan media asli adalah TBD.
- Media eksternal harus memiliki hak penggunaan sesuai sumber, diberi label ilustrasi/referensi, dan tidak boleh diklaim sebagai dokumentasi DapurSaji.
- File upload MVP maksimal sekitar 1 MB, hanya format gambar yang diizinkan setelah pemeriksaan MIME dan magic bytes.
- Karena `references/` dan template PRD terpisah tidak tersedia, implementasi mengikuti hard gates dan referensi inline yang tersedia (`Mode Referensi Mandiri`).

## SEKSI 2 — ACCESS PROFILE & AUTHENTICATION CONTRACT

### Access Profile
Pilih tepat `P3` — `public-plus-admin`.

### Admin authentication
- `auth.login` memakai passphrase minimal 12 karakter.
- Tidak boleh ada password, PIN, atau passphrase default.
- Simpan salt acak yang dibuat menggunakan `Utilities.getUuid()`, hash iterated SHA-256, dan `AUTH_PEPPER` di `ScriptProperties`. Gunakan iterasi dan format penyimpanan yang terdokumentasi di source backend; jangan menyimpan secret di Sheet atau frontend.
- Login gagal 5 kali mengunci percobaan selama 15 menit menggunakan CacheService.
- `auth.google = DISABLED`; jangan tampilkan tombol Google Sign-In.
- `auth.logout` mencabut/menonaktifkan sesi sesuai strategi server-side.

### Session Token Contract
- Format token: `base64url(payload) + "." + base64url(HMAC-SHA256)`.
- Payload minimal berisi subject admin, issued-at, expiry, dan nonce/session ID.
- Verifikasi signature secara aman di server; bandingkan signature dalam waktu konstan.
- Simpan token di memori JavaScript; `sessionStorage` boleh sebagai opsi dengan mitigasi XSS. Dilarang menyimpan token di `localStorage`.
- Jangan mencetak token ke log.
- Semua endpoint admin memanggil guard otorisasi server-side sebelum membaca atau memutasi data.

### Rate Limits
- Login: 5 kegagalan → lock 15 menit.
- `file.ticket`: maksimal 15 request/menit sesuai batas aplikasi.
- Lookup publik: maksimal 5 kegagalan/15 menit per kunci rate-limit yang tersedia; gunakan `CacheService` best-effort dan pesan gagal generik.
- `CacheService` bukan sumber kebenaran permanen. Jangan bergantung pada IP klien karena GAS tidak menyediakan IP klien.
- Semua action sensitif memvalidasi input dan role di server, bukan hanya menyembunyikan tombol UI.

### Demo isolation (Gate W-09)
- Tombol “Isi Demo”, kredensial demo, serta bar editor URL `/exec` hanya boleh tampil bila `isSimulationMode() === true` dan konfigurasi URL produksi kosong.
- Pada produksi seluruh fitur demo dinonaktifkan dan tidak boleh ada kredensial contoh yang dapat dipakai.

## SEKSI 3 — DESIGN DIRECTION: PRESET, 3 DIALS & GATES

### Preset & rationale
Pilih `warm-friendly`, mode `light`, karena produk adalah UMKM kuliner yang membutuhkan kesan hangat, ramah, bersih, dan menggugah selera. Jangan menggunakan preset `aura` sebagai default.

### 3 Dials
- `DESIGN_VARIANCE = 5`
- `MOTION_INTENSITY = 5`
- `VISUAL_DENSITY = 4`

### Visual system
Gunakan cream/off-white sebagai dasar, hijau daun sebagai aksen utama, dan terracotta/oranye hangat sebagai aksen sekunder terbatas. Tetapkan token warna yang menghasilkan rasio kontras WCAG AA minimal 4.5:1 untuk teks normal dan 3:1 untuk teks besar/komponen UI. Jangan mengandalkan warna saja untuk menyampaikan status.

### Anti-fabrication (U-03) & regulatory slot (U-12)
- Dilarang mengarang jumlah pelanggan, testimoni, rating, badge verified, logo klien, angka ROI, harga, kebijakan refund, atau klaim “gratis selamanya”.
- Ganti social proof dengan capability strip berbasis fitur yang benar-benar dibangun: katalog paket, form online, penyimpanan pesanan di Sheets, bukti transfer privat, dan pelacakan status.
- Tidak ada kalkulator pajak/medis/keuangan/hukum dalam scope ini.

### Quality gates
- WCAG AA >= 4.5:1 untuk teks normal.
- Target sentuh >= 40x40 px.
- Semua input memiliki `<label for="...">` yang benar.
- Sediakan `:focus-visible`, navigasi keyboard, dan `prefers-reduced-motion`.
- Gunakan `.tabular-nums` untuk nominal.
- Gunakan modal kustom yang accessible; jangan memakai native `alert()`/`confirm()` sebagai UX utama.
- Komponen data wajib mendukung state `INITIAL`, `LOADING`, `EMPTY`, `ERROR`, `SAVING`, `RECOVERY`.
- Pada error simpan, pertahankan nilai form; jangan mengosongkan input.
- Skeleton mengikuti bentuk konten, empty state memberi aksi, error state memberi retry.
- Gunakan ukuran font dan hirarki yang konsisten; hindari teks helper berkontras rendah.

## SEKSI 4 — FRONTEND STACK, HOSTING, MEDIA PLACEHOLDER & ADAPTER CONTRACT

### Frontend stack
Gunakan `html-tailwind`: HTML semantik, Tailwind CSS, dan JavaScript modular ringan tanpa React. Hasil harus berupa static site yang dapat dipasang di Cloudflare Pages. Untuk produksi, gunakan Tailwind CSS yang telah dikompilasi/minified; jangan mengandalkan Tailwind Play CDN sebagai pipeline produksi. Hindari dependency berat.

### Hosting
Default `cloudflare_pages` untuk penggunaan komersial hemat biaya. Alternatif: `sevalla`, `netlify`, `firebase_hosting`, atau `vercel_pro`. `vercel_hobby_noncommercial` dan `github_pages_demo` hanya boleh dipakai untuk demo/portofolio non-komersial. Jangan deploy website bisnis DapurSaji ke Vercel Hobby atau GitHub Pages.

### Struktur frontend yang diharapkan
- `index.html`: shell aplikasi, metadata, landmark semantik.
- `assets/css/styles.css`: Tailwind hasil build dan custom tokens.
- `assets/js/app.js`: routing ringan, state UI, render view.
- `assets/js/gas-client.js`: adapter API.
- `assets/js/validation.js`: validasi form client-side sebagai UX; server tetap sumber validasi.
- `assets/media/`: hanya media yang hak pakainya sudah diperiksa atau placeholder yang disetujui.
Bila tool implementasi memilih struktur file lain, semua file harus dicetak utuh dan sinkron.

### Media placeholder (Gate W-10)
- Sumber yang dapat dipertimbangkan: Unsplash, Pexels, Pixabay, Coverr.
- Periksa lisensi dan syarat penggunaan tiap aset sebelum deploy.
- Foto menu diberi label “Foto ilustrasi” atau “Foto referensi”.
- Video dapur diberi label “Visual ilustrasi suasana dapur”; jangan menyebutnya dapur DapurSaji.
- Jangan hotlink aset yang melarang hotlink; lebih baik simpan salinan yang diizinkan di aset static project dan catat provenance.
- Sediakan fallback bila media gagal dimuat.
- Jangan mengarang caption yang menyiratkan kepemilikan atau pengalaman nyata.

### URL konfigurasi
- `GAS_WEB_APP_URL` disediakan melalui konfigurasi environment/build yang aman untuk URL publik `/exec`; URL bukan secret.
- Jangan menanam secret backend, passphrase, AUTH_PEPPER, atau signing key di frontend.
- Produksi harus memiliki URL GAS yang dikonfigurasi dan tidak boleh menampilkan editor URL runtime.

### gasClient adapter contract
- Request: HTTP `POST`, header `Content-Type: text/plain;charset=utf-8`, `redirect: "follow"`.
- Body JSON string berisi `action`, `payload`, `request_id`, dan `idempotency_key` bila diperlukan.
- Semua response wajib memakai envelope:
  `{ "status": "success" | "error", "data": {}, "message": "...", "code": "OK" | "VALIDATION_ERROR" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "LOCK_TIMEOUT" | "RATE_LIMITED" | "INTERNAL_ERROR", "meta": {} }`
- `status` hanya `success` atau `error`; jangan menggantinya dengan `OK`/`ok`.
- Frontend wajib menangani redirect/CORS dan membaca envelope secara nyata. Jangan menganggap request berhasil hanya karena fetch tidak melempar error. Lakukan proof-of-compatibility terhadap deployment GAS dan browser target; bila browser tidak dapat membaca response akibat batasan CORS/redirect, jangan merilis dengan asumsi solusi. Laporkan blocker dan minta keputusan arsitektur edge relay atau mekanisme transport yang kompatibel.
- Jangan memakai `mode: "no-cors"` karena response opaque tidak dapat diverifikasi.
- Parse JSON dengan penanganan response invalid; jangan tampilkan stack trace.

## SEKSI 5 — DATA SCHEMA, CONCURRENCY & SHEETS REPOSITORY

### Schema version
`SCHEMA_VERSION: '1.0.0'`. Migrasi non-destruktif. Sebelum menambahkan kolom, periksa nama ekuivalen (contoh `phone` vs `customer_phone`) agar tidak ada kolom duplikat. Jangan menghapus kolom/data saat migrasi.

### Database schemas

#### `ORDERS` — `SENSITIVE_PII`
Headers:
`order_id, created_at, updated_at, customer_name, customer_phone, delivery_date, delivery_time, fulfillment_type, delivery_address, customer_note, order_status, subtotal_amount, dp_amount, payment_due_at, tracking_token_hash, idempotency_key, proof_file_id, proof_mime_type, proof_uploaded_at, deleted_at`

- `order_id`: `ORD-YYYYMMDD-XXXX`.
- `tracking_token_hash`: HMAC/hash token; token mentah tidak disimpan dan tidak dilog.
- `idempotency_key`: unique per operasi create.
- `proof_file_id`: internal Drive file ID, jangan dikirim ke public response.
- `concurrency_mode`: `OPTIMISTIC_VERSION` untuk edit status/overwrite.
- Soft delete melalui `deleted_at`; jangan hard delete data transaksi dari UI MVP.
- Drive upload enabled dengan visibility `private`.

#### `ORDER_ITEMS` — `CONFIDENTIAL`
Headers:
`item_id, order_id, package_id, package_name_snapshot, unit_price, quantity, line_subtotal, created_at`

- Snapshot nama dan harga pada saat order dibuat agar perubahan katalog tidak mengubah histori.
- `concurrency_mode`: `APPEND_ONLY`.
- Drive upload disabled.

#### `CATALOG` — `PUBLIC`
Headers:
`package_id, package_name, category, description, menu_details, price_amount, minimum_quantity, image_url, is_active, sort_order, updated_at, deleted_at`

- `package_id`: `PKG-YYYYMMDD-XXXX`.
- `concurrency_mode`: `OPTIMISTIC_VERSION`.
- Harga kosong/null bukan nol dan tidak boleh ditampilkan sebagai Rp0.
- Drive upload disabled; image_url hanya URL media publik yang disetujui.

### ID generation
Untuk ID harian gunakan ScriptLock, format tanggal timezone script, scan seluruh ID dengan prefix dan tanggal tersebut, cari `maxSeq`, lalu `maxSeq + 1`. Jangan memakai jumlah baris + 1. Pola sama untuk data seed/mock. Gunakan `Utilities.formatDate()` dan timezone `Asia/Jakarta`.

### Seed data
- Seed wajib berupa Array of Objects dan dipetakan dengan `buildRowFromObject_()`.
- Sediakan tepat 16 baris seed total untuk lingkungan simulasi/test, bukan sebagai klaim transaksi atau pelanggan nyata.
- Seed katalog hanya boleh berisi placeholder yang ditandai jelas `SIMULASI`; jangan tampilkan sebagai paket/harga produksi.
- Jangan seed testimoni atau pelanggan.
- Seed ID mengikuti pola `SEED-YYYYMMDD-XXXX` sesuai aturan seed repository.
- Jangan membuat seed otomatis pada jalur read. `readSheetObjects_()` tidak boleh memanggil setup otomatis bila sheet hilang.

### Data handling
- Batch read satu kali per operasi menggunakan `getDataRange().getValues()`.
- Batch write dengan `setValues(rows2D)`.
- Serialisasi Date menjadi ISO ber-offset melalui `sanitizeForClient_()`.
- Samakan timezone Spreadsheet dan Script.
- Gunakan `escapeFormula_()` hanya untuk teks bebas terpilih; jangan terapkan pada angka, tanggal, atau enum.
- `SpreadsheetApp.flush()` dilakukan di dalam lock sebelum `releaseLock()` pada blok `finally`.
- Gunakan `tryLock(10000)`; jika gagal, envelope `LOCK_TIMEOUT`.
- Optimistic version (`expected_updated_at`) hanya untuk overwrite/update/delete/status approval; delta inventory tidak ada dalam scope MVP.

## SEKSI 6 — UPLOAD NEEDS & GOOGLE DRIVE INTEGRATION

### Upload Mode
`ENABLED`.

### Data and privacy rule
Bukti transfer adalah data keuangan pelanggan. File wajib disimpan dengan `DriveApp.Access.PRIVATE`. Tidak boleh `ANYONE_WITH_LINK`, public folder, atau URL file pada respons publik.

### Flow
1. Setelah `order.create` sukses, frontend menerima `order_id` dan tracking token mentah satu kali.
2. Frontend meminta `file.ticket` dengan `order_id`, tracking token, metadata file, dan request id.
3. Backend memverifikasi kepemilikan menggunakan token pesanan, membuat `upload_nonce` acak dan tiket singkat sekali pakai, mengikatnya pada order dan batas file.
4. Frontend mengompresi gambar via `<canvas>` hingga sekitar 1 MB (batas akhir tetap ditegakkan backend).
5. Frontend mengirim `file.upload` dengan tiket dan payload file yang tervalidasi.
6. Backend memeriksa tiket, kedaluwarsa, pemakaian sekali, ukuran, MIME dan magic bytes, lalu menyimpan file ke folder Drive privat.
7. Backend menulis `proof_file_id`, MIME, dan timestamp ke `ORDERS` dengan lock/version checks.
8. Frontend hanya menampilkan sukses bila `uploadRes.status === 'success' && uploadRes.code === 'OK'`.
9. Jika gagal, tampilkan pesan dan retry; jangan menghapus data order/form atau menampilkan status unggahan berhasil.

### File constraints
- Allowlist gambar raster yang ditentukan implementer (mis. JPEG, PNG, WebP); jangan percaya ekstensi atau MIME dari browser saja.
- Magic bytes wajib diverifikasi server-side.
- Maksimal sekitar 1 MB setelah kompresi.
- Tolak SVG, HTML, script, executable, file kosong, dan mismatch MIME/magic bytes.
- File Drive hanya bisa diperiksa admin melalui `file.adminView`, yang memvalidasi sesi admin di server sebelum streaming/menyajikan konten. Jangan mengembalikan URL Drive langsung.

### Ticket and rate limit
- `file.ticket` maksimal 15 request/menit.
- Ticket nonce sekali pakai, berumur pendek, terikat order, dan tidak dapat dipakai lintas pesanan.
- Rate limit adalah lapisan tambahan, bukan pengganti otorisasi token.
- Jangan mencatat token mentah, nonce, atau konten file ke log.

## SEKSI 7 — CENTRAL ACTION REGISTRY & ENDPOINT MATRIX

Semua action dikirim melalui satu endpoint `/exec` dengan method POST dan envelope kanonik.

| Action (domain.verb) | Method | Min. Role | Require idem | Rate Limited | UI Bound | Payload Input Schema | Error Codes |
|---|---|---|---|---|---|---|---|
| `catalog.list` | POST | PUBLIC | No | Yes | Yes | `{category?, active_only:true}` | VALIDATION_ERROR, INTERNAL_ERROR |
| `order.create` | POST | PUBLIC | Yes | Yes | Yes | `{customer_name, customer_phone, delivery_date, delivery_time, fulfillment_type, delivery_address?, customer_note?, items:[{package_id, quantity}]}` | VALIDATION_ERROR, NOT_FOUND, CONFLICT, LOCK_TIMEOUT, RATE_LIMITED |
| `order.track` | POST | PUBLIC | No | Yes | Yes | `{order_id, tracking_token}` | VALIDATION_ERROR, NOT_FOUND, FORBIDDEN, RATE_LIMITED |
| `file.ticket` | POST | PUBLIC_ORDER_OWNER | Yes | Yes | Yes | `{order_id, tracking_token, file_name, mime_type, size_bytes, request_id}` | VALIDATION_ERROR, FORBIDDEN, NOT_FOUND, RATE_LIMITED |
| `file.upload` | POST | PUBLIC_ORDER_OWNER | Yes | Yes | Yes | `{ticket, upload_nonce, file_base64, mime_type}` | VALIDATION_ERROR, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED |
| `auth.login` | POST | PUBLIC | No | Yes | Yes | `{passphrase}` | VALIDATION_ERROR, FORBIDDEN, RATE_LIMITED |
| `auth.logout` | POST | ADMIN | No | No | Yes | `{session_token}` | FORBIDDEN, INTERNAL_ERROR |
| `order.adminList` | POST | ADMIN | No | Yes | Yes | `{session_token, status?, query?, page?, page_size?}` | FORBIDDEN, VALIDATION_ERROR, INTERNAL_ERROR |
| `order.updateStatus` | POST | ADMIN | Yes | Yes | Yes | `{session_token, order_id, next_status, expected_updated_at, admin_note?}` | FORBIDDEN, VALIDATION_ERROR, NOT_FOUND, CONFLICT, LOCK_TIMEOUT |
| `file.adminView` | POST | ADMIN | No | Yes | Yes | `{session_token, order_id}` | FORBIDDEN, NOT_FOUND, RATE_LIMITED |
| `catalog.save` | POST | ADMIN | Yes | Yes | Yes | `{session_token, package_id?, package_name, category, description, menu_details, price_amount?, minimum_quantity?, image_url?, is_active, expected_updated_at?}` | FORBIDDEN, VALIDATION_ERROR, CONFLICT, LOCK_TIMEOUT |

### Canonical envelope
Setiap response:
- `status`: `success` atau `error`.
- `data`: object atau array aman untuk client.
- `message`: pesan Bahasa Indonesia.
- `code`: salah satu `OK`, `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `LOCK_TIMEOUT`, `RATE_LIMITED`, `INTERNAL_ERROR`.
- `meta`: minimal `schemaVersion`, timestamp ISO ber-offset, dan correlation/request ID bila tersedia.

## SEKSI 8 — END-TO-END ACCEPTANCE TEST MATRIX & DELIVERY CONTRACT

### Wajib diuji
1. Inisialisasi 3 sheet dan schema version.
2. Seed Array of Objects dipetakan melalui `buildRowFromObject_()`, total 16 baris khusus simulation/test.
3. Migrasi memeriksa kolom ekuivalen dan tidak menggandakan kolom.
4. `ORDERS` dan `ORDER_ITEMS` tidak terbuka untuk publik.
5. File bukti disimpan `DriveApp.Access.PRIVATE`; akun non-admin gagal mengakses.
6. Lookup publik gagal tanpa token, gagal dengan token salah, berhasil dengan token benar, dan rate limit berjalan.
7. Respons lookup tidak membedakan secara informatif antara nomor pesanan yang tidak ada dan token salah.
8. Pembuatan order bersamaan tidak menghasilkan ID duplikat.
9. Idempotency key mencegah order ganda saat retry.
10. Status update dengan `expected_updated_at` lama menghasilkan `CONFLICT`.
11. Upload ticket sekali pakai; tiket kadaluarsa atau dipakai ulang ditolak.
12. MIME dan magic bytes diverifikasi; file di atas batas ditolak.
13. Frontend tidak menyatakan sukses sampai envelope upload `success` + `OK`.
14. Login 5 kali gagal memicu lock 15 menit.
15. Tidak ada tombol demo/kredensial demo/editor URL pada produksi.
16. Semua komponen data mengimplementasikan enam state UI.
17. Form mempertahankan input saat terjadi error.
18. Kontras lulus `python3 tools/check_contrast.py`.
19. Output lulus `python3 tools/verify_output.py`.
20. Uji browser lintas-origin terhadap GAS `/exec` membuktikan response envelope dapat dibaca; `no-cors` dilarang.

### Security gates
- Tidak ada secret di frontend, Sheet publik, source control, atau log.
- Tidak ada public Drive link untuk bukti transfer.
- Tidak ada stack trace ke client.
- Tidak ada token pelacakan mentah yang disimpan atau dilog.
- Admin guard selalu dilakukan server-side.
- Semua data input divalidasi ulang server-side.
- Gunakan `CacheService` hanya untuk rate limit/cache best-effort.

### Chunked Delivery
Untuk implementasi besar, kirim dalam dua tahap:
- Tahap 1: backend GAS, schema, setup, auth, API, upload, security tests.
- Tahap 2: frontend lengkap, adapter, seluruh screen, responsive/accessibility, deployment config.
Setiap tahap harus menyebut daftar file lengkap dan file yang sudah selesai. Jangan memotong kode.

### Delta Update
Pada revisi, cetak ulang hanya file yang berubah, tetapi setiap file yang dicetak harus utuh dari baris pertama sampai terakhir. Jangan gunakan elipsis, placeholder TODO, atau potongan kode yang tidak dapat dijalankan. Sertakan ringkasan perubahan dan pengujian yang relevan.

### Delivery contract
- Berikan seluruh kode dengan penanda `### FILE: <nama-file>`.
- Tidak boleh ada `...`, `TODO`, placeholder implementasi, atau klaim test lulus tanpa menjalankannya.
- Jangan menandai aplikasi siap produksi sebelum seluruh security, CORS, upload, schema, contrast, dan output gates lulus.
- Laporkan semua blocker dan keputusan yang menunggu pemilik secara eksplisit.

## SEKSI 9 — MACHINE-READABLE PROJECT CONTRACT (GASLY_CONTRACT_JSON)

Gunakan isi file `GASLY_CONTRACT.json` yang diserahkan bersama prompt ini sebagai kontrak kanonik. Jangan mengubah enum, role, sheet, header, classification, upload visibility, atau action tanpa memperbarui PRD dan kontrak secara konsisten.

### GASLY_CONTRACT_JSON
```json
{
  "contract_version": "1.0.0",
  "kb_version": "2.1.0",
  "project": {
    "name": "DapurSaji",
    "surface_profile": "PUBLIC_SERVICE",
    "access_profile": "P3",
    "regulatory_domain": "NONE"
  },
  "architecture": {
    "tier": "TIER_1_DECOUPLED_WORKSPACE",
    "frontend_stack": "html-tailwind",
    "hosting_target": "cloudflare_pages",
    "auth_primary": "GAS_ADMIN_PASSPHRASE",
    "auth_google_enabled": false
  },
  "envelope_spec": {
    "status_values": ["success", "error"],
    "code_values": ["OK", "VALIDATION_ERROR", "NOT_FOUND", "FORBIDDEN", "CONFLICT", "LOCK_TIMEOUT", "RATE_LIMITED", "INTERNAL_ERROR"]
  },
  "entities": [
    {
      "sheet_name": "ORDERS",
      "id_prefix": "ORD",
      "data_classification": "SENSITIVE_PII",
      "concurrency_mode": "OPTIMISTIC_VERSION",
      "headers": ["order_id", "created_at", "updated_at", "customer_name", "customer_phone", "delivery_date", "delivery_time", "fulfillment_type", "delivery_address", "customer_note", "order_status", "subtotal_amount", "dp_amount", "payment_due_at", "tracking_token_hash", "idempotency_key", "proof_file_id", "proof_mime_type", "proof_uploaded_at", "deleted_at"],
      "drive_upload": {"enabled": true, "visibility": "private"}
    },
    {
      "sheet_name": "ORDER_ITEMS",
      "id_prefix": "ORI",
      "data_classification": "CONFIDENTIAL",
      "concurrency_mode": "APPEND_ONLY",
      "headers": ["item_id", "order_id", "package_id", "package_name_snapshot", "unit_price", "quantity", "line_subtotal", "created_at"],
      "drive_upload": {"enabled": false, "visibility": "none"}
    },
    {
      "sheet_name": "CATALOG",
      "id_prefix": "PKG",
      "data_classification": "PUBLIC",
      "concurrency_mode": "OPTIMISTIC_VERSION",
      "headers": ["package_id", "package_name", "category", "description", "menu_details", "price_amount", "minimum_quantity", "image_url", "is_active", "sort_order", "updated_at", "deleted_at"],
      "drive_upload": {"enabled": false, "visibility": "none"}
    }
  ],
  "actions": [
    {"name": "catalog.list", "min_role": "PUBLIC", "require_idem": false, "rate_limited": true, "public_lookup": false, "requires_high_entropy_token": false, "ui_bound": true},
    {"name": "order.create", "min_role": "PUBLIC", "require_idem": true, "rate_limited": true, "public_lookup": false, "requires_high_entropy_token": false, "ui_bound": true},
    {"name": "order.track", "min_role": "PUBLIC", "require_idem": false, "rate_limited": true, "public_lookup": true, "requires_high_entropy_token": true, "ui_bound": true},
    {"name": "file.ticket", "min_role": "PUBLIC_ORDER_OWNER", "require_idem": true, "rate_limited": true, "public_lookup": false, "requires_high_entropy_token": true, "ui_bound": true},
    {"name": "file.upload", "min_role": "PUBLIC_ORDER_OWNER", "require_idem": true, "rate_limited": true, "public_lookup": false, "requires_high_entropy_token": true, "ui_bound": true},
    {"name": "auth.login", "min_role": "PUBLIC", "require_idem": false, "rate_limited": true, "public_lookup": false, "requires_high_entropy_token": false, "ui_bound": true},
    {"name": "auth.logout", "min_role": "ADMIN", "require_idem": false, "rate_limited": false, "public_lookup": false, "requires_high_entropy_token": false, "ui_bound": true},
    {"name": "order.adminList", "min_role": "ADMIN", "require_idem": false, "rate_limited": true, "public_lookup": false, "requires_high_entropy_token": false, "ui_bound": true},
    {"name": "order.updateStatus", "min_role": "ADMIN", "require_idem": true, "rate_limited": true, "public_lookup": false, "requires_high_entropy_token": false, "ui_bound": true},
    {"name": "file.adminView", "min_role": "ADMIN", "require_idem": false, "rate_limited": true, "public_lookup": false, "requires_high_entropy_token": false, "ui_bound": true},
    {"name": "catalog.save", "min_role": "ADMIN", "require_idem": true, "rate_limited": true, "public_lookup": false, "requires_high_entropy_token": false, "ui_bound": true}
  ]
}
```
