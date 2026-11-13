<!-- KB_VERSION: 2.1.0 -->
# AURA DESIGN SYSTEM (VISUAL, TYPOGRAPHY, CONTRAST & MOTION)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat untuk semua jenis build (Web App, Dashboard, maupun Landing Page).

## Daftar Isi
1. [Palet Warna Semantik & Rasio Kontras WCAG AA](#1-palet-warna-semantik--rasio-kontras-wcag-aa)
2. [Skala Tipografi & Angka Tabular](#2-skala-tipografi--angka-tabular)
3. [Grid 4px/8px, Kepadatan Responsif & Radius](#3-grid-4px8px-kepadatan-responsif--radius)
4. [Batas Penggunaan Glassmorphism, Motion & Aksesibilitas](#4-batas-penggunaan-glassmorphism-motion--aksesibilitas)

---

<!-- DIGEST:START -->
## 1. Palet Warna Semantik & Rasio Kontras WCAG AA

Setiap kombinasi teks dan latar wajib memenuhi rasio kontras minimum **WCAG AA (4,5:1 untuk teks normal, 3:1 untuk teks besar/komponen UI)** di seluruh permukaan (*base*, *elevated card*, maupun *interactive hover*).

### A. Dark Mode (Modern SaaS Default)
- **Base Background:** `#09090B` (Zinc-950) atau `#030712` (Gray-950). Hindari hitam murni `#000000` karena menimbulkan *halation* pada layar OLED.
- **Elevated Surface / Card:** `#18181B` (Zinc-900) dengan hairline border `1px solid rgba(255, 255, 255, 0.08)`.
- **Interactive / Hover Surface:** `#27272A` (Zinc-800).
- **Text Hierarchy (Rasio Kontras terhadap `#18181B`):**
  - **Primary Text:** `#F4F4F5` (Zinc-100, rasio `16,1:1`) — untuk judul, nilai KPI, dan isi tabel utama.
  - **Secondary / Body Text:** `#A1A1AA` (Zinc-400, rasio `6,9:1` di atas `#18181B` dan `5,9:1` di atas `#27272A`) — untuk teks body dan label form.
  - **Helper / Caption Text:** `#8A8A93` (rasio `5,2:1` di atas `#18181B` dan `4,5:1` di atas `#27272A`) — batas aman terendah untuk teks bantuan/keterangan kecil di Dark Mode.
  - **Disabled / Decorative Only:** `#71717A` (Zinc-500, rasio `3,7:1` di atas `#18181B`) — **gagal standar 4,5:1**, sehingga khusus untuk elemen `disabled`, garis dekoratif, atau teks non-esensial.

### B. Light Mode (Clean B2B SaaS)
- **Base Background:** `#F8FAFC` (Slate-50) atau `#FAFAFA` (Zinc-50).
- **Elevated Surface / Card:** `#FFFFFF` dengan border `1px solid #E2E8F0` dan `box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04)`.
- **Interactive / Hover Surface:** `#F1F5F9` (Slate-100).
- **Text Hierarchy (Rasio Kontras terhadap `#FFFFFF` dan `#F1F5F9`):**
  - **Primary Text:** `#0F172A` (Slate-900, rasio `17,9:1` di atas `#FFFFFF`) — untuk judul, nilai metrik, dan data utama.
  - **Secondary / Body Text:** `#475569` (Slate-600, rasio `7,5:1` di atas `#FFFFFF` dan `6,8:1` di atas `#F1F5F9`) — untuk teks body utama.
  - **Helper / Caption Text:** `#526071` (rasio `6,0:1` di atas `#FFFFFF` dan `5,4:1` di atas `#F1F5F9`) — lulus standar WCAG AA di seluruh surface Light Mode. *(Catatan: `#64748B` memiliki rasio `4,76:1` di atas `#FFFFFF`, tetapi turun menjadi `4,34:1` [gagal AA] saat berada di atas surface `#F1F5F9`, sehingga jangan gunakan `#64748B` di atas latar abu-abu muda).*
  - **Disabled / Decorative Only:** `#94A3B8` (Slate-400, rasio `2,6:1` di atas `#FFFFFF`) — khusus elemen `disabled` atau dekoratif.

### C. Aksen & Warna Status (Aturan Kontras Teks Tombol)
- **Primary Brand (Indigo/Violet):**
  - Gunakan `#4F46E5` (Indigo-600, rasio `6,3:1` dengan teks putih `#FFFFFF`) sebagai latar tombol primer berteks putih.
  - Gunakan `#6366F1` (Indigo-500, rasio `4,47:1` dengan putih) hanya untuk border aktif, *focus ring*, ikon, atau aksen pada Dark Mode.
- **Semantic Accents (Wajib Teks Gelap `#09090B` bila dijadikan latar tombol penuh):**
  - **Positive / Growth (Emerald):** `#10B981`.
  - **Info / Tech (Cyan):** `#06B6D4`.
  - **Warning / Attention (Amber):** `#F59E0B`.
  - **Danger / Destructive (Rose):** `#E11D48` (rasio `4,7:1` dengan teks putih `#FFFFFF`) atau `#F43F5E` (dengan teks gelap/badge transparan).
- Gunakan maksimal 1 warna aksen utama ditambah warna status semantik agar hierarki fokus tidak pecah.

---

## 2. Skala Tipografi & Angka Tabular

Selaras dengan kontrak desain `GaslyPro`, gunakan skala tipografi berikut secara konsisten:

- **Display (Hero Headline):** `48px–64px`, `font-weight: 800`, `letter-spacing: -0.04em` (tulis di CSS eksplisit karena kelas `.tracking-tight` Tailwind hanya `-0.025em`), `line-height: 1.1`.
- **H1 (Page / Dashboard Title):** `32px–40px`, `font-weight: 700`, `letter-spacing: -0.025em`, `line-height: 1.2`.
- **H2 (Section / Card Title):** `20px–24px`, `font-weight: 600`, `letter-spacing: -0.015em`, `line-height: 1.3`.
- **Body Text:** `14px–16px`, `font-weight: 400`, warna *Secondary* (`#A1A1AA` Dark / `#475569` Light), `line-height: 1.6`.
- **Label / Table Header:** `12px`, `font-weight: 600`, `letter-spacing: 0.04em`.
- **Tabular Figures (`font-variant-numeric: tabular-nums`):**
  Semua KPI, nominal uang, persentase, kuota, dan kolom angka tabel harus menggunakan `font-variant-numeric: tabular-nums` (kelas `.tabular-nums`) agar digit sejajar secara vertikal. Gunakan `font-mono` hanya untuk kode transaksi/ID (`TRX-20261113-0001`), bukan memaksakannya pada seluruh angka mata uang bila font utama sudah mendukung `tabular-nums`.
<!-- DIGEST:END -->

---

## 3. Grid 4px/8px, Kepadatan Responsif & Radius

- **Ritme Spasi:** Gunakan kelipatan `4px` dan `8px` (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`).
- **Kepadatan Responsif (Responsive Density):**
  - **Desktop (`>=1024px`):** Padding kartu `20px–24px`, jarak antar-grid `16px–24px`, tinggi baris tabel `44px–52px` (*Comfortable*) atau `36px` (*Compact*).
  - **Tablet & Mobile (`<768px`):** Padding kartu `16px`, jarak antar-grid `12px`, tinggi minimum area sentuh tombol/input `40px–44px`.
- **Corner Radii:**
  - Badge / Pill: `6px` (`rounded-md`) atau `9999px` (`rounded-full`).
  - Input / Button: `8px` (`rounded-lg`).
  - Card / Modal / Tabel: `12px` (`rounded-xl`).
  - Focal Bento / Hero Container: `16px–24px` (`rounded-2xl` / `rounded-3xl`).

---

## 4. Batas Penggunaan Glassmorphism, Motion & Aksesibilitas

- **Strategi CSS & Dependensi:**
  Definisikan CSS Custom Properties (`:root` untuk Light Mode dan `.dark` untuk Dark Mode) di dalam `<style>` sebagai sumber kebenaran token warna.
- **Batas Glassmorphism:**
  Efek `backdrop-filter: blur(12px)` hanya digunakan pada *Sticky Navbar*, *Topbar*, atau *Modal Header*—jangan terapkan pada baris tabel atau kartu berulang.
- **Purposeful Motion & Reduced Motion:**
  - Durasi transisi mikro berkisar `150ms–220ms` dengan kurva `cubic-bezier(0.16, 1, 0.3, 1)`.
  - Sertakan aturan `@media (prefers-reduced-motion: reduce)` untuk mematikan animasi bagi pengguna yang sensitif terhadap gerakan:
    ```css
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
    ```