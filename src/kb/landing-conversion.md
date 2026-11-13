<!-- KB_VERSION: 2.3.0 -->
# LANDING PAGE CONVERSION BLUEPRINT (DE-FABRICATED)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat secara kondisional ketika membangun Landing Page, Marketing Site, atau halaman depan produk komersial.

## Daftar Isi
1. [Aturan Kejujuran Klaim & Slot Data Bukti](#1-aturan-kejujuran-klaim--slot-data-bukti)
2. [Anatomi 9-Section Baseline (Adaptif sesuai Funnel)](#2-anatomi-9-section-baseline-adaptif-sesuai-funnel)
3. [Integrasi Form Lead / Waitlist ke Google Sheets](#3-integrasi-form-lead--waitlist-ke-google-sheets)

---

<!-- DIGEST:START -->
## 1. Aturan Kejujuran Klaim & Slot Data Bukti

Landing page yang kredibel menjual kejelasan solusi dan hasil kerja (*outcome*), bukan angka karangan.
- **Larangan Fabrikasi:** Jangan pernah mengarang jumlah pengguna, logo perusahaan klien, nama/foto pemberi testimoni, badge *verified*, persentase peningkatan ROI/efisiensi, klaim biaya/kuota akun (seperti klaim mutlak bebas biaya server), kebijakan *refund* atau *free trial*, maupun integrasi pihak ketiga (seperti WhatsApp/Payment Gateway) yang tidak disebutkan di dalam brief pengguna.
- **Aturan Slot & Render Kondisional:**
  - Jika pengguna **menyediakan** data bukti/harga di dalam brief: tampilkan data tersebut secara akurat.
  - Jika pengguna **tidak menyediakan** data bukti/harga: gunakan slot penanda yang eksplisit (contoh: `{{JUMLAH_PENGGUNA_AKTIF}}`, `{{HARGA_PAKET_PRO}}`) **atau** ganti section tersebut dengan alternatif berbasis kapabilitas kode nyata seperti dijelaskan pada bagian anatomi di bawah.

---

## 2. Anatomi 9-Section Baseline (Adaptif sesuai Funnel)

Gunakan 9 section berikut sebagai kerangka dasar yang dapat digabung atau disesuaikan dengan tujuan konversi:

1. **Top Floating Navigation:**
   - Navbar semi-transparan (`sticky top-4 z-50`) berisi identitas brand, tautan navigasi ke section halaman (menggunakan *smooth scroll* yang berfungsi), dan tombol CTA utama.
2. **Hero Section (Outcome-First Hook):**
   - **Context Badge:** Kategori solusi atau fokus nilai utama sesuai brief.
   - **Headline (H1):** Menjual transformasi nyata dari masalah lama menuju hasil baru (*Pain-to-Glory*), bukan sekadar nama teknis.
   - **Sub-headline (Maks 2–3 baris):** Menjelaskan *apa solusinya, bagaimana cara kerjanya, dan untuk siapa*.
   - **Dual CTA:** CTA Primer (mengarahkan ke form registrasi/aplikasi/simulasi) + CTA Sekunder (melompat ke simulasi interaktif atau cara kerja).
   - **Capability Strip (Pengganti Klaim Pelanggan Fiktif):** Jika tidak ada `{{BUKTI_PELANGGAN_DARI_PENGGUNA}}`, tampilkan 3–4 kapabilitas yang dapat dibuktikan langsung dari kode aplikasi yang dibangun (contoh: *"Penyimpanan Terstruktur di Google Sheets • Tampilan Responsif Desktop & Mobile • Pencarian & Filter Data Instan"*).
3. **Interactive Product Showcase:**
   - Pratinjau antarmuka interaktif (misalnya kalkulator simulasi, pratinjau filter data hidup, atau demo mini alur kerja) yang bisa diklik langsung oleh pengunjung di halaman tersebut.
4. **Bento-Grid Features (3–5 Kartu Asimetris):**
   - Menampilkan keunggulan utama dengan ilustrasi struktur UI mini di dalam tiap kartu, bukan sekadar deretan ikon statis.
5. **Workflow Comparison (Cara Lama vs Cara Baru):**
   - Tabel atau kartu berdampingan yang membandingkan tahapan kerja manual lama yang rawan salah dengan tahapan baru yang terstruktur melalui aplikasi ini (tanpa mengarang angka klaim jam/persentase bila belum diukur).
6. **Proof / Role-Based Use Cases (Kondisional):**
   - Jika `{{DATA_TESTIMONI_PENGGUNA}}` tersedia: tampilkan kartu testimoni asli.
   - Jika tidak tersedia: tampilkan **"Skenario Penggunaan Nyata Berdasarkan Peran (Role-Based Use Cases)"** — jelaskan bagaimana 3 peran berbeda (mis. Pemilik Usaha, Admin Operasional, dan Staf Lapangan) menggunakan sistem ini sehari-hari.
7. **Pricing / Paket Implementasi (Kondisional):**
   - Jika `{{DATA_HARGA_PENGGUNA}}` tersedia: tampilkan matriks harga lengkap dengan toggle periode bila ada.
   - Jika tidak tersedia: tampilkan perbandingan cakupan modul/fitur dengan label harga berpenanda jelas (`{{HARGA_STARTER}}`, `{{HARGA_PRO}}`) atau arahkan ke form konsultasi/pendaftaran tanpa memaksakan angka contoh `$19 / $49 / $99`.
8. **Accordion FAQ (Menjawab Keraguan Nyata):**
   - 4–6 item akordeon interaktif (buka/tutup berfungsi) yang menjawab pertanyaan relevan dengan arsitektur aplikasi sebenarnya (struktur penyimpanan di Google Sheets, cara akses dari browser HP, pengaturan izin akses, dan langkah inisialisasi).
9. **Final Conversion CTA & Lead Capture:**
   - Penutup kontras tinggi yang terhubung langsung ke form pendaftaran/kontak/mulai pakai yang menyimpan data ke Google Sheets.
<!-- DIGEST:END -->

---

## 3. Integrasi Form Lead / Waitlist ke Google Sheets

Setiap Landing Page yang dibuat melalui Gasly bukan sekadar brosur statis, melainkan aplikasi web hidup:
- Sediakan minimal 1 alur konversi fungsional (misalnya **Form Pendaftaran / Request Demo / Pesan Sekarang / Kalkulator Estimasi**) yang terhubung end-to-end ke sheet `LEADS` atau `INQUIRIES` di `code.gs` dan `setup.gs`.