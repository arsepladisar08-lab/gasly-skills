<!-- KB_VERSION: 2.1.0 -->
# SAAS MONETIZATION, P2-LITE BOUNDARIES & TIER PROMOTION MATRIX (`core/monetization-and-tiers.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-prd`, `gasly-data`, dan `gasly-ui` ketika merancang atau membangun produk SaaS komersial, langganan berbayar, atau peningkatan arsitektur (`Tier 1` s/d `Tier 3`).

## Daftar Isi
1. [Skema Monetisasi SaaS (`PLANS` & `SUBSCRIPTIONS`) Tanpa Fabrikasi (`Gate U-03`)](#1-skema-monetisasi-saas-plans--subscriptions-tanpa-fabrikasi-gate-u-03)
2. [Batas `P2-lite` di GAS vs `P2` Penuh dengan Supabase Auth](#2-batas-p2-lite-di-gas-vs-p2-penuh-dengan-supabase-auth)
3. [Aturan Lisensi Hosting & Ambang Naik Tier Berbasis `facts.md`](#3-aturan-lisensi-hosting--ambang-naik-tier-berbasis-factsmd)
4. [Syarat Halaman Legal (`/privacy`) & Kepatuhan Payment Gateway](#4-syarat-halaman-legal-privacy--kepatuhan-payment-gateway)

---

## 1. Skema Monetisasi SaaS (`PLANS` & `SUBSCRIPTIONS`) Tanpa Fabrikasi (`Gate U-03`)

Aplikasi SaaS yang siap dimonetisasi tidak ditentukan oleh badge kosmetik, melainkan oleh skema paket dan penegakan batas kuota (*entitlement check*) di sisi server:
1. **Kepatuhan De-Fabrikasi (`Gate U-03`):**
   - Jika pengguna menyertakan harga paket di dalam brief, gunakan nominal tersebut (dalam `Number` murni, mata uang `IDR` atau sesuai brief).
   - Jika pengguna belum menentukan nominal harga, gunakan penanda slot eksplisit (`{{HARGA_STARTER}}`, `{{HARGA_PRO}}`) pada tampilan publik dan dilarang mengarang klaim jumlah pelanggan atau testimoni palsu.
2. **Skema Tabel Standar Monetisasi:**
   - `PLANS` (`dataClassification: 'PUBLIC'`):
     `id | plan_code | name | price_amount | billing_period | max_quota | features_json | status | updated_at | is_seed`
   - `SUBSCRIPTIONS` (`dataClassification: 'CONFIDENTIAL'`):
     `id | user_email | plan_code | status | period_start | period_end | external_invoice_id | provider_event_id | created_at | updated_at | is_seed`
3. **Penegakan Kuota & Status Langganan di Server (`Gate U-02`):**
   - Sebelum mengizinkan aksi berkuota atau fitur berbayar, handler di `gasly-data` wajib memeriksa status baris aktif di `SUBSCRIPTIONS` (`status === 'ACTIVE'` dan `period_end > now`) berdasarkan identitas `req.session.sub`, bukan berdasarkan flag dari browser.

---

## 2. Batas `P2-lite` di GAS vs `P2` Penuh dengan Supabase Auth

Mengacu pada `stacks/PLANNED.md` dan kuota di `core/facts.md`, Google Apps Script dan Google Sheets bukan penyedia identitas (*Identity Provider*) publik berskala besar:
1. **Mode `P2-lite` pada GAS (`Tier 1` & `Tier 2`):**
   - **Jalur Utama (0 Kuota Email):** Gunakan **Google Sign-In (`auth.google`)** sebagai gerbang masuk dan pendaftaran mandiri (`P2_LITE_AUTO_PROVISION = 'TRUE'`, dibatasi *rate-limit* pendaftaran di `CacheService`), karena Google telah memverifikasi kepemilikan email pengguna tanpa perlu mengirim email OTP dari GAS.
   - **Kredensial Manual (`USERS`):** Akun di sheet `USERS` (`dataClassification: 'SENSITIVE_PII'`) dapat mengatur atau memperbarui passphrase ($\ge 12$ karakter) dan PIN step-up (6 digit) melalui `auth.setCredentials` setelah terautentikasi, lalu masuk menggunakan `auth.login`.
   - **Batas Kuota Email (`facts.md`):** Kuota `MailApp` hanya **100 penerima/hari** (akun konsumen `@gmail.com`) atau **1.500 penerima/hari** (Google Workspace). Jangan mengaktifkan fitur registrasi/reset password via email publik tanpa pembatas kuota `MailApp.getRemainingDailyQuota()`.
2. **Mode `P2` Penuh pada `Tier 3` (`TIER_3_HYBRID_SAAS`):**
   - Apabila aplikasi membutuhkan pendaftaran mandiri email + password publik berskala besar, alur verifikasi/reset email otomatis tanpa terhambat kuota 100 email/hari `MailApp`, serta isolasi baris multi-tenant yang ketat, naikkan arsitektur ke **`TIER_3_HYBRID_SAAS`** menggunakan **Supabase Auth + PostgreSQL RLS**.

---

## 3. Aturan Lisensi Hosting & Ambang Naik Tier Berbasis `facts.md`

### A. Kepatuhan Lisensi Hosting (`core/facts.md`)
- **Cloudflare Pages (Free):** Diizinkan untuk penggunaan komersial (batas 500 build/bulan) $\rightarrow$ **Default utama untuk produksi komersial hemat biaya (`Tier 1` & `Tier 2`)**.
- **Vercel Hobby (Free) & GitHub Pages (Free):** Hanya untuk penggunaan **dev, preview, personal, atau demo prototipe non-komersial** (dilarang untuk menjalankan bisnis online, e-commerce, atau SaaS komersial).
- **Vercel Pro ($20/bulan):** Wajib digunakan apabila produk komersial/SaaS memerlukan deployment di Vercel (misalnya Next.js SSR atau Vercel Functions).

### B. Ambang Naik Tier (*Tier Promotion Thresholds* — Berdasarkan `core/facts.md`)
Rekomendasikan kenaikan tier arsitektur secara deterministik ketika salah satu batas fakta teknis di `facts.md` berikut terpenuhi:

| Dari $\rightarrow$ Ke | Pemicu Teknis & Kuota Resmi (`core/facts.md`) | Solusi Arsitektur pada Tier Target |
| :--- | :--- | :--- |
| **`Tier 0` $\rightarrow$ `Tier 1`**<br>(`TIER_1_DECOUPLED_WORKSPACE`) | Aplikasi membutuhkan domain kustom di luar iframe `HtmlService` GAS dan pemuatan aset statis cepat melalui CDN. | Deploy frontend di **Cloudflare Pages** (komersial gratis) atau **GitHub Pages** (khusus demo non-komersial), terhubung ke satu URL GAS `/exec`. |
| **`Tier 1` $\rightarrow$ `Tier 2`**<br>(`TIER_2_EDGE_GATEWAY`) | 1) Menerima webhook pihak ketiga (karena `/exec` GAS selalu membalas `POST` dengan **HTTP 302 Redirect** ke `script.googleusercontent.com` dan tidak mendukung preflight `OPTIONS`).<br>2) Membutuhkan pembacaan IP klien untuk *rate-limit* (objek `e` di GAS tidak menyediakan IP klien secara andal). | Tambahkan fungsi serverless/proxy tipis di Edge (Cloudflare Worker atau Vercel Function pada paket yang sesuai) untuk memverifikasi signature webhook dan meneruskan ke `/exec` dengan `WEBHOOK_SHARED_SECRET` + `providerEventId`. |
| **`Tier 2` $\rightarrow$ `Tier 3`**<br>(`TIER_3_HYBRID_SAAS`) | 1) Trafik mendekati batas **30 eksekusi simultan per akun** (`Execute as: Me`).<br>2) Waktu proses mendekati batas **6 menit / eksekusi**.<br>3) Pengiriman email melampaui **100 penerima/hari** (konsumen) atau **1.500 penerima/hari** (Workspace).<br>4) Kebutuhan cache/state melampaui batas `CacheService` (**100 KB per key**, **TTL maks. 6 jam / 21.600 detik**, bersifat *best-effort*) atau `PropertiesService` (**9 KB per nilai**, **500 KB total**). | Gunakan **Hybrid Database**: **Supabase (PostgreSQL + Auth + RLS)** sebagai *System of Record* transaksi berkecepatan tinggi, sementara GAS + Google Sheets bertindak sebagai mesin pelaporan backoffice (*Outbox sync*) serta automasi Google Drive dan Gmail. |

---

## 4. Syarat Halaman Legal (`/privacy`) & Kepatuhan Payment Gateway

1. **Publikasi Google OAuth Consent Screen (`auth.google`):**
   - Google mewajibkan ketersediaan halaman **Kebijakan Privasi (`/privacy`)** yang dapat diakses publik pada domain terverifikasi sebelum status OAuth Consent Screen dapat dipublikasikan ke mode produksi (*In Production*). Halaman Syarat Layanan (`/terms`) bersifat opsional pada formulir Google OAuth, namun disarankan untuk produk berbayar.
2. **Integrasi Payment Gateway (Midtrans / Xendit / Duitku):**
   - Pastikan halaman publik menampilkan deskripsi layanan/paket yang jelas, harga dalam mata uang yang dipersyaratkan penyedia (umumnya **IDR / Rupiah** untuk gateway domestik Indonesia), kontak layanan pelanggan yang aktif, serta ketentuan pembatalan/pengembalian dana (*refund policy*) sesuai persyaratan verifikasi masing-masing gateway.