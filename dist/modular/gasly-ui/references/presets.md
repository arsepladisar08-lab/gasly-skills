<!-- KB_VERSION: 2.1.0 -->
# DESIGN PRESETS SELECTION & APPLICATION GUIDE (`design/presets.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-prompt` dan `gasly-ui`.

## Daftar Isi
1. [Aturan Pemilihan Preset (AURA Bukan Default Otomatis)](#1-aturan-pemilihan-preset-aura-bukan-default-otomatis)
2. [Profil Keempat Preset Resmi](#2-profil-keempat-preset-resmi)
3. [Matriks Pemetaan Jenis Produk ke Preset & Dials](#3-matriks-pemetaan-jenis-produk-ke-preset--dials)
4. [Cara Mengonsumsi Token JSON & Variabel CSS](#4-cara-mengonsumsi-token-json--variabel-css)

---

## 1. Aturan Pemilihan Preset (AURA Bukan Default Otomatis)

`aura` adalah salah satu dari empat preset di dalam sistem desain Gasly dan **tidak pernah menjadi default otomatis**. Tahap perencana (`gasly-prompt`) wajib menganalisis domain bisnis, lingkungan kerja pengguna (apakah di ruangan terang/lapangan atau di depan monitor gelap), serta kepadatan data sebelum menetapkan preset.

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