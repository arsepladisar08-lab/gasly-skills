# PRD-Final.md
**Produk:** DapurSaji — Katalog Katering & Pemesanan Online  
**Versi:** 1.0.0  
**Status:** Final untuk handoff implementasi, dengan TBD bisnis yang ditandai  
**KB_VERSION:** 2.1.0  
**Mode:** Quick Mode — Mode Referensi Mandiri

---

## Bab 1. Ringkasan Produk

DapurSaji adalah website publik untuk menampilkan katalog paket katering dan nasi kotak, menerima pemesanan online, menerima unggahan bukti transfer DP, serta menyediakan pelacakan status pesanan tanpa akun pelanggan. Admin memperoleh panel privat untuk melihat pesanan dan memperbarui status.

Tujuan MVP adalah membuat alur pemesanan lebih terstruktur dan mudah diakses melalui ponsel, tanpa mengarang testimoni, jumlah pelanggan, rating, atau klaim bisnis.

**Pain-to-Glory:** calon pembeli dapat melihat paket dan mengirim detail pesanan melalui satu alur; admin dapat memproses pesanan dari satu panel; pembeli dapat memantau status menggunakan token rahasia tanpa login.

## Bab 2. Latar Belakang dan Masalah

### 2.1 Masalah
- Informasi paket dan harga perlu disajikan dengan jelas dalam satu katalog.
- Pemesanan perlu mengumpulkan data pelanggan, tanggal, waktu, alamat, pilihan paket, jumlah, dan catatan.
- Bukti transfer DP perlu tersimpan terpusat tanpa dapat diakses publik.
- Pembeli memerlukan cara mengecek status tanpa membuat akun.
- Admin memerlukan akses terautentikasi untuk mengelola dan memperbarui pesanan.

### 2.2 Dampak yang dituju
- Informasi paket lebih mudah ditemukan.
- Data pesanan masuk ke Google Sheets dengan struktur konsisten.
- Bukti transfer tersimpan di Google Drive privat.
- Status pesanan dapat diperbarui admin dan dilihat pembeli melalui token acak.

## Bab 3. Tujuan, Indikator Keberhasilan, dan Non-Goals

### 3.1 Tujuan
1. Menyediakan katalog paket yang dapat dikelola admin.
2. Menerima pemesanan online dari perangkat desktop dan mobile.
3. Menyimpan data pesanan ke Google Sheets.
4. Menyimpan bukti transfer DP ke Google Drive dengan akses privat.
5. Menyediakan pelacakan status publik yang tahan enumerasi.
6. Menyediakan panel admin dengan autentikasi passphrase.

### 3.2 Indikator penerimaan MVP
- Pesanan valid tercatat satu kali di Google Sheets.
- Pembeli memperoleh kode pesanan dan token pelacakan setelah pesanan berhasil dibuat.
- Lookup hanya mengembalikan ringkasan pesanan yang sesuai dengan token valid.
- Lima kegagalan lookup dalam jendela 15 menit memicu rate limit sesuai kebijakan backend.
- Bukti transfer tidak memiliki izin `Anyone with the link`.
- Perubahan status oleh admin tercatat dan terlihat pada lookup publik.
- Website dapat diakses melalui domain hosting komersial yang sesuai.

Tidak ditetapkan target jumlah pelanggan, omzet, konversi, atau penghematan waktu karena baseline belum diberikan.

### 3.3 Non-Goals MVP
- Login atau akun pelanggan.
- Payment gateway dan verifikasi pembayaran otomatis.
- WhatsApp API, SMS OTP, atau email OTP sebagai autentikasi.
- Multi-cabang, multi-tenant, aplikasi native, dan program loyalitas.
- Inventori bahan baku dan perhitungan HPP.
- Testimoni, rating, jumlah pelanggan, logo klien, atau statistik yang belum memiliki bukti.
- Otomatisasi refund atau kebijakan pembatalan yang belum ditetapkan pemilik.

## Bab 4. Target Pengguna dan Peran

| Peran | Kebutuhan | Hak akses |
|---|---|---|
| Pengunjung / calon pembeli | Melihat paket, menu, cara pesan, FAQ | Membaca katalog dan informasi publik |
| Pembeli | Membuat pesanan, mengunggah bukti DP, mengecek status | Membuat pesanan; lookup hanya dengan tracking token |
| Admin DapurSaji | Memproses pesanan, memeriksa bukti transfer, mengubah status, mengelola katalog | Login dan akses seluruh fungsi admin |
| Pemilik usaha | Mengawasi operasional dan konfigurasi | Hak admin; konfigurasi rahasia di Script Properties |

Tidak ada peran pelanggan terdaftar.

## Bab 5. Ruang Lingkup Fungsional

Prioritas: **Wajib**, **Penting**, atau **Fase 2**. Setiap kebutuhan memiliki ID unik dan kriteria penerimaan.

### 5.1 Katalog publik
- **CAT-1 — Wajib:** Sistem menampilkan daftar paket aktif dengan nama, deskripsi, foto, harga yang telah diisi pemilik, dan informasi minimum pemesanan bila tersedia.  
  **Penerimaan:** hanya paket aktif tampil; harga kosong tidak diganti angka rekaan dan ditampilkan sebagai “Hubungi admin” atau disembunyikan sesuai konfigurasi.
- **CAT-2 — Wajib:** Pengunjung dapat membuka detail paket dan daftar menu/varian.  
  **Penerimaan:** detail sesuai data CATALOG; tidak ada data contoh yang disamarkan sebagai harga final.
- **CAT-3 — Penting:** Admin dapat membuat, mengubah, mengaktifkan, dan menonaktifkan paket.  
  **Penerimaan:** perubahan tersimpan dan katalog publik menampilkan versi terbaru.
- **CAT-4 — Penting:** Media ilustrasi eksternal dapat digunakan sebagai placeholder.  
  **Penerimaan:** media diberi label “Ilustrasi menu”/“Foto referensi”; tidak diklaim sebagai foto asli DapurSaji.

### 5.2 Pemesanan online
- **ORD-1 — Wajib:** Pembeli dapat mengisi nama, nomor WhatsApp/telepon, tanggal dan waktu kebutuhan, alamat/lokasi pengiriman atau opsi ambil sendiri, paket, jumlah, dan catatan.  
  **Penerimaan:** field wajib divalidasi di frontend dan backend; tanggal tidak boleh berada di masa lalu menurut zona waktu Asia/Jakarta.
- **ORD-2 — Wajib:** Sistem menghitung subtotal dari harga paket yang tersimpan di server, bukan mempercayai total dari browser.  
  **Penerimaan:** harga dan subtotal dihitung ulang di backend; paket nonaktif tidak dapat dipesan.
- **ORD-3 — Wajib:** Sistem membuat nomor pesanan unik format `ORD-YYYYMMDD-XXXX` dengan pencarian `maxSeq + 1` di dalam ScriptLock.  
  **Penerimaan:** tidak ada duplikasi nomor pada pesanan bersamaan.
- **ORD-4 — Wajib:** Sistem menerbitkan `tracking_token` acak berentropi tinggi untuk setiap pesanan.  
  **Penerimaan:** token dibuat dengan `Utilities.getUuid()`, disimpan secara aman sebagai hash/HMAC, diberikan kepada pembeli satu kali saat pembuatan berhasil, dan tidak dapat ditebak dari nomor pesanan.
- **ORD-5 — Wajib:** Sistem menggunakan idempotency key untuk mencegah pesanan ganda akibat retry.  
  **Penerimaan:** pengulangan request dengan key yang sama mengembalikan hasil pesanan awal, bukan membuat baris baru.
- **ORD-6 — Penting:** Pembeli menerima ringkasan instruksi transfer DP.  
  **Penerimaan:** nominal DP, rekening, dan tenggat hanya tampil jika telah dikonfigurasi pemilik; tidak ada rekening atau persentase DP rekaan.

### 5.3 Unggah bukti transfer
- **UPL-1 — Wajib:** Pembeli dapat mengunggah foto bukti transfer untuk pesanan yang dibuat.  
  **Penerimaan:** backend mengeluarkan tiket upload sekali pakai yang terikat ke pesanan dan nonce; tiket kedaluwarsa dan tidak dapat dipakai ulang.
- **UPL-2 — Wajib:** File disimpan di Google Drive dengan `DriveApp.Access.PRIVATE`.  
  **Penerimaan:** file tidak dapat diakses melalui tautan publik; ID file hanya dapat diakses admin melalui endpoint terotorisasi.
- **UPL-3 — Wajib:** Frontend memeriksa `uploadRes.status === 'success' && uploadRes.code === 'OK'` sebelum menampilkan unggahan berhasil.  
  **Penerimaan:** kegagalan upload mempertahankan data form dan menampilkan opsi retry.
- **UPL-4 — Wajib:** Validasi MIME dan magic bytes dilakukan di backend; batas ukuran file MVP maksimal sekitar 1 MB.  
  **Penerimaan:** file non-gambar, file yang MIME dan magic bytes-nya tidak cocok, atau file terlalu besar ditolak.
- **UPL-5 — Penting:** Preview gambar ditampilkan sebelum upload.  
  **Penerimaan:** preview lokal tidak berarti file telah tersimpan.

### 5.4 Pelacakan pesanan publik
- **TRK-1 — Wajib:** Pembeli dapat memasukkan nomor pesanan dan tracking token untuk melihat status.  
  **Penerimaan:** lookup membutuhkan token acak yang benar; nomor pesanan saja tidak cukup.
- **TRK-2 — Wajib:** Endpoint lookup menerapkan rate limit melalui CacheService.  
  **Penerimaan:** maksimal 5 kegagalan lookup per jendela 15 menit per kunci rate-limit yang tersedia; respons gagal tidak mengungkap apakah nomor pesanan tertentu terdaftar.
- **TRK-3 — Wajib:** Data publik hanya menampilkan ringkasan aman.  
  **Penerimaan:** tidak menampilkan alamat lengkap, nomor telepon lengkap, catatan privat, token, atau URL Drive.
- **TRK-4 — Wajib:** Status yang tampil berasal dari status terakhir di database.  
  **Penerimaan:** status dan waktu pembaruan diperbarui setelah refresh/lookup.

### 5.5 Panel admin
- **ADM-1 — Wajib:** Admin login menggunakan passphrase minimal 12 karakter.  
  **Penerimaan:** tidak ada kredensial default; hash salted iterated SHA-256 dan `AUTH_PEPPER` disimpan di Script Properties.
- **ADM-2 — Wajib:** Sistem menerbitkan session token bertanda tangan HMAC-SHA256.  
  **Penerimaan:** token diverifikasi di server; sesi kedaluwarsa; token tidak disimpan di localStorage.
- **ADM-3 — Wajib:** Admin dapat melihat, mencari, dan memfilter pesanan.  
  **Penerimaan:** hanya sesi admin valid yang dapat memanggil endpoint admin.
- **ADM-4 — Wajib:** Admin dapat memperbarui status pesanan.  
  **Penerimaan:** update menggunakan `expected_updated_at`; konflik mengembalikan `CONFLICT`; perubahan status dan waktu tercatat.
- **ADM-5 — Wajib:** Admin dapat memeriksa bukti transfer melalui backend yang terotorisasi.  
  **Penerimaan:** Drive file tetap privat; endpoint memeriksa sesi admin sebelum mengirim konten file.
- **ADM-6 — Penting:** Admin dapat mengelola katalog paket.  
  **Penerimaan:** aksi CRUD memerlukan sesi admin dan validasi backend.

Status MVP yang disarankan: `MENUNGGU_DP`, `DP_DITERIMA`, `DIPROSES`, `SIAP_DIANTAR`, `SELESAI`, `DIBATALKAN`. Pemilik perlu menyetujui daftar dan aturan transisinya sebelum produksi.

## Bab 6. Alur Pengguna End-to-End

### 6.1 Pembeli
1. Membuka website DapurSaji.
2. Menjelajahi katalog dan detail paket.
3. Memilih paket dan mengisi detail pesanan.
4. Mengirim pesanan.
5. Backend memvalidasi harga, membuat nomor pesanan, dan menerbitkan tracking token.
6. Website menampilkan ringkasan pesanan, token/link pelacakan, dan instruksi DP yang telah dikonfigurasi.
7. Pembeli mengunggah bukti transfer melalui tiket upload.
8. Backend memvalidasi file dan menyimpannya di Drive privat.
9. Pembeli membuka halaman cek status dan memasukkan nomor pesanan serta token.
10. Pembeli melihat status dan ringkasan aman.

### 6.2 Admin
1. Admin membuka `/admin`.
2. Admin memasukkan passphrase.
3. Backend memvalidasi kredensial dan menerbitkan session token.
4. Admin melihat daftar pesanan.
5. Admin membuka detail dan memeriksa bukti transfer melalui endpoint privat.
6. Admin memperbarui status dengan optimistic version check.
7. Pembeli dapat melihat status baru melalui halaman pelacakan.

## Bab 7. Informasi, Navigasi, dan Screen Inventory

### 7.1 Screen Inventory

| ID | Rute / layar | Pengguna | Tujuan | Komponen utama |
|---|---|---|---|---|
| SCR-01 | `/` Beranda | Publik | Memperkenalkan layanan dan mengarahkan ke katalog | Navbar, hero, capability strip, CTA |
| SCR-02 | `/#paket` Katalog | Publik | Menampilkan paket aktif | Grid kartu paket, filter kategori bila tersedia |
| SCR-03 | `/#detail` Detail paket | Publik | Menampilkan menu, harga, ketentuan | Foto ilustrasi, rincian paket, CTA pesan |
| SCR-04 | `/pesan` Form pemesanan | Pembeli | Mengirim detail pesanan | Form pelanggan, tanggal, alamat, paket, jumlah, catatan |
| SCR-05 | `/pesanan/berhasil` Konfirmasi | Pembeli | Menampilkan nomor dan token pelacakan | Ringkasan, token sekali tampil, upload DP |
| SCR-06 | `/cek-pesanan` Pelacakan | Pembeli | Memeriksa status | Input nomor pesanan dan token, status timeline |
| SCR-07 | `/admin` Login | Admin | Autentikasi admin | Passphrase form |
| SCR-08 | `/admin/pesanan` Daftar pesanan | Admin | Operasional pesanan | Tabel, pencarian, filter status, refresh |
| SCR-09 | `/admin/pesanan/:id` Detail pesanan | Admin | Memeriksa dan mengubah pesanan | Data pelanggan, bukti privat, status editor |
| SCR-10 | `/admin/katalog` Katalog admin | Admin | Mengelola paket | Form CRUD paket |
| SCR-11 | `/privacy` Privasi | Publik | Menjelaskan data dan penyimpanan | Kebijakan privasi yang disetujui pemilik |

Rute dapat diimplementasikan sebagai view berbasis hash/path pada static frontend. Rute `/privacy` wajib tersedia sebelum konfigurasi Google Sign-In; untuk MVP `auth.google` dinonaktifkan.

### 7.2 Navigasi publik
Beranda, Paket, Cara Pesan, Cek Pesanan, FAQ, dan Kontak. Tautan dan CTA harus berfungsi; jangan tampilkan elemen navigasi tanpa tujuan.

### 7.3 Navigasi admin
Ringkasan Pesanan, Semua Pesanan, Katalog, dan Keluar. Hindari KPI atau grafik tanpa data sumber nyata.

## Bab 8. Data, Privasi, dan Integrasi

### 8.1 Arsitektur
- Frontend statis HTML + Tailwind di Cloudflare Pages.
- Backend Google Apps Script Web App pada satu URL `/exec`.
- Komunikasi menggunakan HTTP POST, `Content-Type: text/plain;charset=utf-8`, `redirect: "follow"`.
- Database operasional Google Sheets.
- Berkas bukti transfer di Google Drive.
- Semua respons mengikuti envelope kanonik: `status`, `data`, `message`, `code`, `meta`.

### 8.2 Sheet database MVP

| Sheet | Klasifikasi | Tujuan | Upload Drive |
|---|---|---|---|
| `ORDERS` | `SENSITIVE_PII` | Data pelanggan, pesanan, status, token hash, referensi bukti | Enabled, `private` |
| `ORDER_ITEMS` | `CONFIDENTIAL` | Snapshot paket, kuantitas, harga, subtotal per pesanan | Disabled, `none` |
| `CATALOG` | `PUBLIC` | Paket, deskripsi, harga, status aktif, media | Disabled, `none` |

Semua kolom menggunakan `snake_case`. Migrasi bersifat non-destruktif dan wajib memeriksa kolom ekuivalen sebelum menambahkan kolom.

### 8.3 Klasifikasi privasi
- `ORDERS`: `SENSITIVE_PII` karena memuat nama, nomor kontak, alamat, detail transaksi, tracking token hash, dan referensi file bukti.
- `ORDER_ITEMS`: `CONFIDENTIAL` karena terhubung dengan transaksi pelanggan.
- `CATALOG`: `PUBLIC` karena memang ditujukan untuk publik.
- Bukti transfer merupakan informasi keuangan pelanggan: Drive wajib `visibility: private` (`DriveApp.Access.PRIVATE`). Jangan pernah menggunakan `ANYONE_WITH_LINK`.
- URL atau ID file Drive tidak boleh dikirim ke endpoint publik.

### 8.4 Retensi dan penghapusan
Lama retensi pesanan, bukti transfer, dan prosedur penghapusan belum ditentukan. Admin tidak boleh menghapus bukti transaksi secara otomatis sebelum kebijakan disetujui pemilik.

### 8.5 Integritas dan keamanan data
- `escapeFormula_()` hanya untuk field teks bebas yang ditentukan schema.
- Baca data menggunakan `getValues()`; serialisasi Date menjadi ISO ber-offset sebelum dikirim ke frontend.
- Batch read/write; gunakan `LockService` dan `SpreadsheetApp.flush()` sebelum melepas lock.
- Mutasi status menggunakan optimistic version (`expected_updated_at`).
- Gunakan idempotency key pada pembuatan pesanan dan upload.
- Lookup publik menggunakan token UUID berentropi tinggi dan rate limit.
- Jangan mengirim stack trace atau detail internal ke client.

## Bab 9. Arah Desain dan Konten

### 9.1 Design Direction
- Preset: `warm-friendly`.
- Tema: Light.
- Dials: `DESIGN_VARIANCE=5`, `MOTION_INTENSITY=5`, `VISUAL_DENSITY=4`.
- Karakter: hangat, menggugah selera, bersih, ramah keluarga, mudah digunakan.
- Palet awal: cream/off-white, hijau daun sebagai aksen, terracotta/oranye hangat untuk CTA sekunder. Warna final wajib diuji kontras WCAG AA.
- Foto makanan berformat landscape/portrait konsisten; crop fokus pada makanan, bukan watermark.
- Tipografi mudah dibaca; angka harga menggunakan tabular numerals.
- Motion ringan; hormati `prefers-reduced-motion`.

### 9.2 Konten yang diperbolehkan
- Nama dan deskripsi paket yang disetujui pemilik.
- Foto dummy yang diberi label ilustrasi/referensi.
- Video stok suasana dapur yang diberi label visual ilustratif, bukan dapur DapurSaji.
- Kapabilitas aplikasi yang benar-benar tersedia: katalog, formulir, penyimpanan pesanan, unggah bukti privat, dan pelacakan.

### 9.3 Konten yang dilarang
- Testimoni fiktif, rating palsu, badge verified, jumlah pelanggan, angka pesanan, logo klien, klaim ROI, atau klaim “terpercaya oleh ribuan pelanggan”.
- Menggunakan media stok seolah-olah dokumentasi usaha.
- Mengarang harga, rekening, persentase DP, biaya kirim, minimum order, jam operasional, atau kebijakan pembatalan.

## Bab 10. Deployment, Operasional, dan Batasan

### 10.1 Hosting
Cloudflare Pages Free direkomendasikan untuk frontend komersial. Paket gratisnya diizinkan untuk penggunaan komersial menurut `facts.md` (verifikasi 2026-11-25), dengan batas build dan Fair Use yang perlu dipantau. Vercel Hobby tidak boleh digunakan untuk website komersial; Vercel Pro adalah alternatif berbayar. Netlify, Firebase Hosting, dan Sevalla dapat menjadi alternatif sesuai batas kuota dan ketentuan masing-masing.

### 10.2 Batas backend
- GAS runtime maksimal 6 menit per eksekusi.
- Maksimal 30 concurrent executions per akun pengguna; seluruh pengunjung berbagi kuota akun pemilik pada deployment `Execute as: Me`.
- CacheService bersifat best-effort, bukan penyimpanan permanen.
- GAS `/exec` merespons POST melalui redirect HTTP 302 dan tidak mendukung preflight OPTIONS. Adapter frontend harus diuji pada domain hosting target sebelum produksi.
- Desain tidak boleh mengandalkan IP klien karena GAS tidak menyediakan IP klien pada konteks ini.

### 10.3 Observabilitas dan backup
- Log server mencatat action, waktu, hasil, dan correlation ID tanpa mencatat passphrase, token mentah, nomor kontak lengkap, alamat lengkap, atau konten bukti.
- Pemilik menentukan jadwal backup Google Sheets dan folder Drive.
- Sediakan prosedur pemulihan dan uji restore sebelum operasional penuh.

### 10.4 Deployment gate
- Uji request POST lintas-origin dari domain Cloudflare Pages ke GAS `/exec`.
- Uji seluruh alur upload dan pembacaan file admin.
- Uji akses Drive menggunakan akun non-admin untuk memastikan file tertutup.
- Uji mode produksi tanpa demo credentials dan tanpa editor URL `/exec`.

## Bab 11. Acceptance Criteria dan Quality Gates

| ID | Skenario | Kriteria lulus |
|---|---|---|
| QA-01 | Inisialisasi database | Membuat 3 sheet sesuai schema; seed berbasis Array of Objects dan `buildRowFromObject_()` |
| QA-02 | Migrasi schema | Tidak membuat kolom duplikat jika kolom ekuivalen sudah ada |
| QA-03 | Katalog | Hanya paket aktif tampil; harga kosong tidak difabrikasi |
| QA-04 | Pembuatan pesanan | Validasi server, ID harian maxSeq+1, idempotensi, token acak |
| QA-05 | Lookup publik | Token wajib, verifikasi waktu konstan, rate limit, respons anti-enumerasi |
| QA-06 | Privasi Drive | File bukti tetap `DriveApp.Access.PRIVATE`; tidak ada public link |
| QA-07 | Upload | Ticket sekali pakai, MIME + magic bytes, ukuran maksimum, status envelope diperiksa frontend |
| QA-08 | Admin auth | Passphrase >=12 karakter, hash salted iterated SHA-256, HMAC session |
| QA-09 | Status update | `expected_updated_at` diperiksa; konflik menghasilkan `CONFLICT` |
| QA-10 | Formula injection | Hanya teks bebas yang di-escape; angka dan tanggal tetap bertipe |
| QA-11 | UI state | INITIAL, LOADING, EMPTY, ERROR, SAVING, RECOVERY tersedia |
| QA-12 | Aksesibilitas | Kontras WCAG AA >=4.5:1 untuk teks normal; target sentuh >=40x40px; label dan focus-visible |
| QA-13 | Demo isolation | Tombol demo dan editor URL runtime hanya tampil pada simulation mode |
| QA-14 | Build validation | `python3 tools/check_contrast.py` lulus |
| QA-15 | Output validation | `python3 tools/verify_output.py` lulus |
| QA-16 | Hosting | Frontend komersial terpasang pada Cloudflare Pages atau alternatif berlisensi sesuai |

## Bab 12. Pertanyaan Terbuka / TBD

Hal-hal berikut harus diisi atau disetujui pemilik sebelum produksi. Ini bukan alasan untuk mengarang nilai.

1. **Paket dan harga:** nama paket, isi menu, harga, foto asli, minimum pemesanan, dan opsi custom.
2. **Kebijakan pemesanan:** batas minimal hari pemesanan, jam operasional, kapasitas harian, area pengiriman, biaya kirim, opsi ambil sendiri.
3. **DP dan rekening:** nominal atau persentase DP, rekening/QRIS, tenggat pembayaran, dan cara admin memverifikasi transfer.
4. **Status pesanan:** persetujuan daftar status dan transisi yang diizinkan.
5. **Pembatalan/refund:** aturan dan tenggat; belum ditampilkan sebelum disetujui.
6. **Kontak usaha:** nomor WhatsApp publik, alamat/area layanan, akun media sosial, dan email bila ada.
7. **Admin:** nama/email admin yang berwenang; pembuatan passphrase dilakukan pemilik secara aman.
8. **Retensi data:** berapa lama pesanan dan bukti transfer disimpan serta kapan dihapus.
9. **Media:** persetujuan sumber media stok dan penggantian dengan foto/video asli.
10. **Domain:** domain khusus atau subdomain Pages.
11. **Privasi:** identitas pengelola data dan isi final kebijakan privasi.
12. **Zona waktu operasional:** asumsi awal Asia/Jakarta; konfirmasi pemilik.

## Bab 13. Risiko, Dependensi, dan Handoff

### 13.1 Risiko dan mitigasi
- **Kuota GAS / lonjakan pesanan:** gunakan batch read/write, cache hanya untuk katalog publik, batasi payload, dan pantau kuota.
- **CORS/redirect GAS:** lakukan proof-of-compatibility dari domain produksi; jangan menganggap request berhasil sebelum envelope sukses terbaca.
- **Bukti transfer bocor:** Drive private, endpoint admin terotorisasi, jangan kirim URL file ke publik.
- **Token pelacakan hilang:** token ditampilkan satu kali; sediakan instruksi agar pembeli menyimpan link/token. Mekanisme penerbitan ulang perlu kebijakan verifikasi manual.
- **Konten dummy menyesatkan:** label ilustrasi dan ganti media sebelum mengklaim sebagai dokumentasi asli.
- **Data bisnis belum lengkap:** harga dan kebijakan tetap TBD sampai pemilik menyetujui.

### 13.2 Dependensi
- Akun Google pemilik untuk Apps Script, Sheets, dan Drive.
- Domain frontend Cloudflare Pages.
- URL deployment GAS `/exec`.
- Data paket, harga, rekening, kebijakan DP, dan kontak yang disetujui.
- Sumber foto/video dengan hak penggunaan yang sesuai.

### 13.3 Handoff
- `PRD-Final.md` adalah sumber kebutuhan produk.
- `MASTER-INSTRUCTIONAL-PROMPT.md` adalah instruksi implementasi teknis.
- `GASLY_CONTRACT.json` adalah kontrak machine-readable.
- Ketiga artefak harus tetap konsisten. Implementasi dibagi ke `gasly-data` (backend GAS) dan `gasly-ui` (frontend eksternal).
