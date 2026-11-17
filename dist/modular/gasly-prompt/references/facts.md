# Gasly Verified Technical & Commercial Facts (`facts.md`)

- **Last Verified Date:** `2026-11-16`
- **Rule:** Seluruh angka kuota, batas waktu runtime, dan ketentuan lisensi komersial pada rekomendasi arsitektur wajib mengacu pada dokumen ini.

## 1. Kuota & Batas Runtime Google Apps Script (GAS)
- **Batas Waktu Eksekusi (`Script Runtime`):** Maksimal **6 menit / eksekusi**.
- **Eksekusi Simultan (`Concurrent Executions`):** Maksimal **30 eksekusi simultan per akun pengguna**.
  - *Implikasi Arsitektur:* Karena Web App di-deploy dengan `Execute as: Me`, seluruh trafik pengunjung berbagi kuota akun pemilik tersebut.
- **Kuota Email Harian (`MailApp` / `GmailApp`):**
  - Akun Konsumen (`@gmail.com`): **100 penerima / hari**.
  - Akun Google Workspace: **1.500 penerima / hari**.
  - *Aturan Gasly:* Dilarang menjadikan Gmail OTP sebagai jalur autentikasi utama aplikasi publik/SaaS. Gunakan **Google Sign-In (GSI)** sebagai jalur utama (0 kuota email), dan Gmail hanya untuk cadangan/notifikasi internal dengan pengecekan `MailApp.getRemainingDailyQuota()`.
- **Batas `CacheService`:** Maksimal **100 KB per key**, TTL maksimal **6 jam (21.600 detik)**, bersifat *best-effort* (bukan penyimpanan permanen).
- **Batas `PropertiesService`:** Maksimal **9 KB per nilai (key-value)** dan **500 KB total per store**. Berfungsi sebagai *project-scoped secret store*, bukan mesin enkripsi umum.
- **Perilaku HTTP `/exec`:** Selalu membalas `POST` dengan **HTTP 302 Redirect** ke `script.googleusercontent.com` dan tidak mendukung preflight `OPTIONS` maupun pembacaan alamat IP klien.

## 2. Ketentuan Lisensi Komersial Hosting Frontend
| Layanan Hosting | Status Lisensi Komersial (Tier Gratis) | Posisi Resmi di Tangga Arsitektur Gasly |
| :--- | :--- | :--- |
| **Cloudflare Pages** | **Diizinkan** untuk penggunaan komersial (batas 500 build/bulan pada Free plan) | **Default Tier 1 & Tier 2** untuk produksi komersial hemat biaya |
| **Vercel (Hobby Plan)** | **Dilarang untuk komersial** (*Personal / Non-Commercial Only*). Penggunaan komersial wajib **Vercel Pro ($20/bulan)** | Gunakan Hobby hanya untuk Dev/Preview; gunakan **Vercel Pro** untuk SaaS komersial berbasis Next.js SSR |
| **GitHub Pages** | **Dilarang untuk bisnis online, e-commerce, atau SaaS komersial** (sesuai GitHub Terms of Service) | Hanya untuk **Dokumentasi, Portofolio, atau Demo Prototipe Non-Komersial** |