<!--
=====================================================================
INSTRUKSI UNTUK AI — BACA BAGIAN INI TERLEBIH DAHULU
=====================================================================
Anda adalah asisten penyusun PRD (Product Requirements Document)
dalam ekosistem GASLY.

INPUT yang akan Anda terima bersama template ini:
- Ide produk, brief singkat, atau hasil diskusi / notulen rapat (MoM)
  antara pengembang dan klien (teks bebas, transkrip, atau catatan).

TUGAS Anda:
1. Baca seluruh input/diskusi dengan teliti.
2. Isi SEMUA placeholder {{...}} pada template di bawah berdasarkan
   informasi nyata dari input.
3. Ikuti panduan pengisian dalam komentar <!-- --> di setiap bab.
   Komentar instruksi TIDAK boleh muncul di dokumen final.

ATURAN PENTING:
- JANGAN mengarang informasi bisnis (jumlah pengguna, testimoni,
  harga, kebijakan). Jika tidak disebutkan, masukkan ke Bab 12 (TBD).
- Asumsi teknis yang wajar diletakkan di Bab 5 dan ditandai jelas
  sebagai "[Asumsi Pengembang]".
- Gunakan Bahasa Indonesia yang formal, ringkas, to-the-point, dan
  mudah dipahami klien non-teknis.
- Setiap kebutuhan fungsional wajib punya ID unik format PREFIX-N
  (contoh: AUTH-1, TRX-2, RPT-1). Prefix 3–4 huruf kapital.
- Prioritas hanya boleh: **Wajib** (MVP), **Penting** (MVP jika
  sempat / sangat diharapkan), atau **Fase 2** (di luar MVP).
- Fitur yang disepakati "nanti saja" masuk ke Bab 11, bukan Bab 6.
- Entitas dengan data sensitif (pajak, medis, identitas KTP/KK,
  keuangan) WAJIB diklasifikasikan CONFIDENTIAL / SENSITIVE_PII
  dengan upload Google Drive wajib "Private" (Gate U-10).
- Versi pertama dari MoM/ide adalah v0.1 (DRAFT SEMENTARA). Naikkan
  menjadi v1.0 (FINAL) setelah poin kritis di Bab 12 disepakati.
- OUTPUT: dokumen Markdown bersih tanpa komentar <!-- --> apa pun.
=====================================================================
-->

# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## {{NAMA_PRODUK}}

**STATUS: {{STATUS_DOKUMEN}}** <!-- DRAFT SEMENTARA (v0.1) | FINAL (v1.0) -->

| | |
| --- | --- |
| **Nama Produk** | {{NAMA_PRODUK_LENGKAP}} |
| **Versi Dokumen** | {{VERSI}} <!-- v0.1 untuk draft awal, v1.0 untuk final --> |
| **Disusun oleh** | {{NAMA_PENGEMBANG}} (Pengembang) |
| **Untuk** | {{NAMA_KLIEN}} (Klien) |
| **Tanggal** | {{TANGGAL_DOKUMEN}} |
| **Profil Layanan & Akses** | {{SURFACE_PROFILE}} • {{ACCESS_PROFILE}} <!-- contoh: INTERNAL_APP • P4 --> |
| **Dokumen Terkait** | {{DOKUMEN_TERKAIT}} <!-- contoh: Notulen Rapat (MoM) – tanggal; GASLY_CONTRACT.json --> |

---

# 1. Ringkasan Produk (Overview)

<!-- 2 paragraf ringkas.
Paragraf 1: kondisi bisnis saat ini (proses manual, alat lama, pain point).
Paragraf 2: solusi yang dibangun — jenis sistem, modul inti, dan tujuan besarnya. -->

{{RINGKASAN_PRODUK}}

# 2. Tujuan & Sasaran (Goals)

<!-- 3–5 bullet. Fokus pada outcome bisnis yang terukur, bukan daftar fitur.
Contoh: "Memusatkan...", "Mengurangi kesalahan pencatatan...", "Mempercepat...". -->

- {{TUJUAN_1}}
- {{TUJUAN_2}}
- {{TUJUAN_3}}

# 3. Pengguna, Peran & Hak Akses (Users & Roles)

<!-- Satu bullet per peran: **Nama Peran :** ringkasan tugas utama.
Tambahkan matriks hak akses singkat bila terdapat lebih dari 1 peran. -->

- **{{PERAN_1}} :** {{DESKRIPSI_PERAN_1}}
- **{{PERAN_2}} :** {{DESKRIPSI_PERAN_2}}

### 3.1 Matriks Kewenangan Ringkas

| **Modul / Aksi** | **{{PERAN_1}}** | **{{PERAN_2}}** |
| --- | :---: | :---: |
| {{AKSI_1}} | {{IZIN_1A}} | {{IZIN_1B}} |
| {{AKSI_2}} | {{IZIN_2A}} | {{IZIN_2B}} |

# 4. Ruang Lingkup (Scope)

## 4.1 Termasuk (MVP)

<!-- Bullet ringkas per kelompok fitur yang MASUK MVP (detail ada di Bab 6). -->

- {{LINGKUP_MVP_1}}
- {{LINGKUP_MVP_2}}

## 4.2 Di Luar Lingkup Awal / Fase Lanjutan

<!-- Sebutkan singkat fitur yang ditunda dan rujuk ke Bab 11.
Jika tidak ada, tulis "Belum ada fitur yang ditunda pada tahap ini." -->

{{LINGKUP_DILUAR_MVP}}

# 5. Asumsi & Batasan (Assumptions & Constraints)

<!-- Pilihan arsitektur (mis. Google Sheets + Drive + GAS /exec, hosting Cloudflare Pages),
batas kuota GAS, proses manual yang disengaja, ketergantungan pihak ketiga, dan risiko biaya.
Tandai asumsi pengembang secara eksplisit dengan [Asumsi Pengembang]. -->

- {{ASUMSI_1}}
- {{ASUMSI_2}}

# 6. Kebutuhan Fungsional (Functional Requirements)

<!-- Kelompokkan per aktor & modul menjadi sub-bab 6.1, 6.2, dst.
Pola penamaan: "Aktor — Nama Modul" (contoh: "Admin — Manajemen Transaksi").
Tulis sebagai kalimat kemampuan ("Admin dapat...", "Sistem menampilkan...").
Gunakan format tabel PERSIS di bawah ini. -->

## 6.1 {{NAMA_MODUL_1}}

| **ID** | **Kebutuhan Fungsional** | **Kriteria Penerimaan (Acceptance)** | **Prioritas** |
| --- | --- | --- | --- |
| **{{PREFIX}}-1** | {{DESKRIPSI_KEBUTUHAN}} | {{KRITERIA_TERIMA}} | **Wajib** |
| **{{PREFIX}}-2** | {{DESKRIPSI_KEBUTUHAN}} | {{KRITERIA_TERIMA}} | **Penting** |

# 7. Alur Pengguna Utama & Inventaris Halaman

## 7.1 Daftar Halaman / Layar (Screen Inventory)

<!-- Jembatan langsung ke tahap desain (gasly-prd-to-uiux).
Cantumkan semua layar yang dibutuhkan oleh kebutuhan fungsional di Bab 6. -->

| **Layar / Rute** | **Peran Akses** | **Tujuan Utama & Ref. ID** |
| --- | --- | --- |
| **{{NAMA_LAYAR_1}}** | {{PERAN_LAYAR_1}} | {{TUJUAN_LAYAR_1}} ({{PREFIX}}-1) |
| **{{NAMA_LAYAR_2}}** | {{PERAN_LAYAR_2}} | {{TUJUAN_LAYAR_2}} ({{PREFIX}}-2) |

## 7.2 Alur: {{NAMA_ALUR_1}}

<!-- Buat 3–5 alur terpenting (7.2, 7.3, dst.): minimal alur utama (happy path)
dan alur pengecualian (penolakan, pembatalan, gagal upload, atau konflik data).
Sertakan perubahan status sistem dalam tanda kutip (contoh: "Menunggu Verifikasi"). -->

1. {{LANGKAH_1}}
2. {{LANGKAH_2}}

# 8. Model Data & Klasifikasi Privasi (High-Level)

<!-- Semua nama field wajib snake_case.
Field milik fitur Fase Lanjutan ditulis dalam [kurung siku].
Klasifikasi privasi: PUBLIC | INTERNAL | CONFIDENTIAL | SENSITIVE_PII.
Aturan keras (Gate U-10): CONFIDENTIAL / SENSITIVE_PII wajib Drive "Private". -->

| **Entitas (Sheet)** | **Field Utama (`snake_case`)** | **Klasifikasi & Upload Drive** | **Keterangan** |
| --- | --- | --- | --- |
| **{{ENTITAS_1}}** | {{FIELD_UTAMA}} | {{KLASIFIKASI_1}} • Drive: {{DRIVE_1}} | {{KETERANGAN_1}} |

**Catatan:** Field dalam `[tanda kurung siku]` merupakan bagian dari fitur usulan/Fase Lanjutan (Bab 11).

# 9. Kebutuhan Non-Fungsional, Arah Visual & Laporan

<!-- Gunakan pola "**Aspek :** penjelasan". Sertakan arah visual (preset/karakter & mode
terang/gelap) serta kebutuhan ekspor/laporan bila dibahas. -->

- **Responsivitas & Perangkat :** {{ASPEK_RESPONSIF}}
- **Keamanan & Privasi Data :** {{ASPEK_KEAMANAN}}
- **Arah Visual & Keterbacaan :** {{ARAH_VISUAL}} <!-- contoh: Preset dense-dashboard (terang), angka tabular, kontras WCAG AA -->
- **Kebutuhan Laporan / Ekspor :** {{KEBUTUHAN_LAPORAN}}

# 10. Integrasi Pihak Ketiga

<!-- Cantumkan semua layanan eksternal yang disebut dalam diskusi.
Layanan fase lanjutan tetap dicantumkan dengan label "Fase Lanjutan".
Jika menggunakan WhatsApp non-resmi (mis. Fonnte), tulis risiko, izin penerima, & batas laju.
Jika tidak ada integrasi, tulis satu kalimat bahwa sistem berdiri sendiri. -->

| **Layanan** | **Fungsi** | **Catatan & Risiko** |
| --- | --- | --- |
| **{{LAYANAN_1}}** | {{FUNGSI_1}} | {{CATATAN_1}} |

# 11. Fitur Usulan / Fase Lanjutan

<!-- Fitur yang dibahas namun ditunda dari MVP.
Jika tidak ada, tulis "Belum ada usulan fase lanjutan." -->

- **{{FITUR_USULAN_1}}.** {{PENJELASAN_FITUR_1}}

# 12. Pertanyaan Terbuka / TBD

<!-- SANGAT PENTING: seluruh hal yang belum diputuskan klien masuk ke sini
(nama brand, harga, kebijakan pembatalan, timeline, daftar email admin, dll.). -->

- {{PERTANYAAN_1}}
- {{PERTANYAAN_2}}

# 13. Glosarium

<!-- Istilah domain bisnis klien atau istilah teknis yang dipakai di dokumen. -->

- **{{ISTILAH_1}} :** {{DEFINISI_1}}

---

*Status dokumen: {{STATUS_DOKUMEN}}. Dokumen ini dapat diperbarui hingga seluruh poin pada Bab 12 (TBD) disepakati bersama klien.*