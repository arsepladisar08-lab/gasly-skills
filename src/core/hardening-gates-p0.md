# GERBANG PENGERASAN INTI (P0 HARDENING GATES)

Seluruh output spesifikasi (`gasly-prompt`), backend (`gasly-data`), dan frontend (`gasly-ui` / `gasly-legacy`) WAJIB mematuhi 7 aturan tidak bisa ditawar berikut:

1. **GATE P0-01 — Proteksi Mutlak Dokumen Sensitif (`SENSITIVE-DATA`):**
   - Setiap entitas yang memuat dokumen pajak (NPWP, SPT, SP2DK, omzet), rekam/rujukan medis, kartu identitas (KTP/KK), atau bukti keuangan internal WAJIB diklasifikasikan sebagai `CONFIDENTIAL` atau `SENSITIVE_PII`.
   - File Google Drive untuk entitas tersebut WAJIB menggunakan `defaultVisibility: 'private'` (`DriveApp.Access.PRIVATE, DriveApp.Permission.NONE`). Dilarang keras memakai `ANYONE_WITH_LINK` dengan alasan apa pun.

2. **GATE P0-02 — Anti-Enumerasi Endpoint Publik (`ANTI-ENUM`):**
   - Setiap action pelacakan status publik tanpa login (seperti `submissions.track` atau `queue.lookupPublic`) DILARANG hanya mengandalkan ID urut harian (`SUB-YYYYMMDD-0001`) + 4 digit nomor telepon.
   - Wajib menerbitkan kolom `tracking_token` acak berentropi tinggi (minimal 16 karakter kriptografis / UUIDv4) saat pencatatan, dan mewajibkan *rate-limit* `CacheService` per token serta global.

3. **GATE P0-03 — Integritas Transaksi Upload (`UPLOAD-INTEGRITY` & `NO-STAGE-REGRESSION`):**
   - Pada form dengan unggahan file (`file.ticket` -> `file.upload`), frontend WAJIB menyimpan respons `file.upload` ke variabel dan memverifikasi `uploadRes.status === 'success' && uploadRes.code === 'OK'` sebelum menampilkan layar sukses.
   - Tahap pemaketan ulang (seperti bundling ke satu file `index.html` untuk Canvas) DILARANG memangkas pemeriksaan error upload atau menghilangkan tombol `RECOVERY`.

4. **GATE P0-04 — Konkurensi Delta vs Optimistic Version (`DELTA-CONCURRENCY`):**
   - Untuk operasi mutasi berbasis tambah/kurang (*delta*) seperti mutasi stok masuk/keluar (`IN`/`OUT`) yang sudah diserialkan di dalam `LockService`, server CUKUP memvalidasi kecukupan saldo akhir (`stockAfter >= 0`) di dalam lock tanpa memblokir transaksi dengan error `CONFLICT` akibat perubahan `updated_at` oleh staf lain di detik yang sama.
   - Pemeriksaan `expected_updated_at` (`CONFLICT`) hanya diterapkan pada operasi timpa nilai mutlak (*overwrite*) seperti `item.update`, opname `ADJUST`, atau keputusan persetujuan.

5. **GATE P0-05 — Sinkronisasi Skema, Seed Berbasis Objek, & Cegah Kolom Duplikat (`SCHEMA-SEED-OBJECT`):**
   - Di dalam `setup.gs`, seluruh data simulasi awal (`seedInitialData`) WAJIB didefinisikan sebagai *Array of Objects* (`[{ id: '...', ... }]`) dan dikonversi ke baris spreadsheet menggunakan helper `serializeRecordToRow_(schema, obj)`. Dilarang keras menulis array posisi 2D manual (`[['SEED-...', ...]]`).
   - Saat menerima permintaan penambahan kolom baru dari pengguna, wajib memeriksa `DB_SCHEMAS` terlebih dahulu: jika sudah ada kolom dengan fungsi ekuivalen (misal meminta `lokasi_rak` padahal sudah ada `storage_rack`), gunakan/perluas kolom yang sudah ada tanpa membuat kolom duplikat.

6. **GATE P0-06 — Sinkronisasi Kontrak ke UI & Isolasi Demo (`SPEC-UI-SYNC` & `DEMO-ISOLATION`):**
   - Setiap fitur otentikasi atau action yang berstatus `ENABLED` di spesifikasi/backend (seperti `auth.google`) WAJIB memiliki komponen pemicu nyata di UI frontend.
   - Kredensial demo (`Isi Demo`) dan pengubah URL `/exec` runtime hanya boleh dirender apabila `isSimulationMode() === true` (ketika variabel URL produksi kosong) dan WAJIB dinonaktifkan secara otomatis saat URL produksi aktif.

7. **GATE P0-07 — Slot Regulasi & Disclaimer (`REGULATORY-SLOT`):**
   - Setiap kalkulator atau fitur yang menampilkan perhitungan pajak, medis, atau hukum wajib menampilkan dasar peraturan resmi, tanggal verifikasi aturan terakhir, dan *disclaimer* eksplisit bahwa hasil bersifat estimasi indikatif.