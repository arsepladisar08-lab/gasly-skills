<!-- KB_VERSION: 2.1.0 -->
# SAAS VISUAL CRAFT & $49/MONTH PRODUCT POLISH (`design/saas-craft.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-prd`, `gasly-prd-to-uiux`, `gasly-pro-api`, dan `gasly-ui`.

## Daftar Isi
1. [Prinsip Visual Kelas SaaS Komersial](#1-prinsip-visual-kelas-saas-komersial)
2. [Pola Tata Letak per `SURFACE_PROFILE` (Larangan Form Menumpuk)](#2-pola-tata-letak-per-surface_profile-larangan-form-menumpuk)
3. [Bento KPI Summary Strip Berbasis Data Nyata](#3-bento-kpi-summary-strip-berbasis-data-nyata)
4. [Ikonografi Inline SVG Presisi (Nol Emoji di UI Chrome)](#4-ikonografi-inline-svg-presisi-nol-emoji-di-ui-chrome)
5. [Data Table Toolbar, Refined Status Pills & Mobile Card View](#5-data-table-toolbar-refined-status-pills--mobile-card-view)
6. [Micro-Surface, Skeleton Realistis, Empty State & Sonner Toast](#6-micro-surface-skeleton-realistis-empty-state--sonner-toast)
7. [Checklist Self-Audit Estetika $49/Bulan](#7-checklist-self-audit-estetika-49bulan)

---

## 1. Prinsip Visual Kelas SaaS Komersial

Lulus kontras WCAG AA (`4,5:1`) adalah **syarat minimum**, bukan standar akhir. Untuk menghasilkan antarmuka yang terasa setara dengan aplikasi SaaS modern ($49/bulan seperti Linear, Stripe Dashboard, Cal.com, atau Notion):
1. **Keheningan Visual (*Visual Restraint*):** Gunakan warna aksen utama (`var(--accent-solid)`) hanya pada 1 CTA primer per layar, indikator tab aktif, dan *focus ring*. Hindari mewarnai setiap kartu dengan warna pelangi atau gradien mencolok.
2. **Hierarki Tipografi & Spasi 8px:** Pisahkan dengan tegas antara `Display/H1` (`font-weight: 700–800`, `tracking-tight`), judul kartu (`15px–16px`, `font-weight: 600`), body (`14px`, `var(--text-secondary)`), dan label metadata (`12px`, `var(--text-helper)`). Seluruh angka wajib memakai `.tabular-nums`.
3. **Kedalaman Halus (*Subtle Elevation*):**
   - Di **Light Mode:** Permukaan kartu `var(--bg-surface)` di atas kanvas `var(--bg-base)` memakai hairline border `1px solid var(--border-subtle)` + bayangan tipis `box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 12px rgba(15, 23, 42, 0.03)`.
   - Di **Dark Mode:** Hindari shadow gelap tebal; gunakan pembedaan luminansi permukaan (`--bg-base` $\rightarrow$ `--bg-surface` $\rightarrow$ `--bg-interactive`) dan hairline border `1px solid var(--border-subtle)`.

---

## 2. Pola Tata Letak per `SURFACE_PROFILE` (Larangan Form Menumpuk)

### A. `INTERNAL_APP` & `SAAS_PLATFORM` (`/app` Workspace)
- **App Shell 2-Bagian:**
  - **Sidebar Kiri (`240px` di layar `>=1024px`, tersembunyi ke Off-Canvas Drawer di `<1024px`):** Berisi identitas brand minimal di atas, menu navigasi modul nyata di tengah, serta footer informatif (status koneksi `/exec` atau `Preview Mode`, versi skema, dan tombol Keluar Sesi).
  - **Sticky Topbar (`height: 56px`):** Judul tampilan aktif di kiri; tombol *Refresh*, *Theme Toggle* (Light/Dark), dan tombol CTA Primer (`+ Tambah ...`) di kanan.
- **Aturan Anti-CRUD Polos (Slide-Over Drawer / Modal Form):**
  - **Jangan menumpuk form input panjang terbuka di atas tabel utama.** Letakkan form tambah/edit data di dalam **Slide-Over Drawer sisi kanan (`max-w-md` / `max-w-lg`)** atau **Centered Modal** yang dipicu oleh tombol `+ Tambah ...`. Dengan begitu, begitu pengguna masuk, mereka langsung melihat **KPI Summary Strip + Toolbar Filter + Data Table** di paruh atas layar (*above the fold*).

### B. `PUBLIC_SERVICE` & `MARKETPLACE` (Halaman Publik)
- **Floating / Sticky Navbar:** Tinggi `64px`, `backdrop-filter: blur(10px)` (hanya di navbar & modal sesuai `Gate W-04`), identitas brand, tautan section fungsional, tombol **Cek Status**, dan tombol **Login Admin** yang tidak mendominasi CTA pembeli.
- **Split Hero atau Bento Showcase (`Gate W-10`):**
  - Gunakan layout 2 kolom di desktop (kiri: badge konteks + headline transformatif + sub-headline + 2 CTA + capability strip nyata; kanan: kartu visual rasio terkunci `aspect-[16/10] rounded-2xl overflow-hidden` berisi foto/video placeholder dari `MEDIA_PLACEHOLDERS` lengkap dengan fallback SVG `onerror`).
  - Jika menaruh teks di atas gambar/video, wajib pasang *gradient scrim* gelap (`linear-gradient(to top, rgba(9,9,11,0.82), rgba(9,9,11,0.18))`) agar kontras teks tetap `>= 4,5:1`.

---

## 3. Bento KPI Summary Strip Berbasis Data Nyata

Tampilkan **3–4 kartu KPI** di bagian atas workspace dalam grid `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`:
- Setiap angka **wajib dihitung langsung (*computed live*) dari array state data** (dilarang keras menaruh angka persentase pertumbuhan fiktif seperti `"+24.5% bulan ini"` bila tidak ada perhitungan historis nyata sesuai `Gate U-03`).
- Anatomi 1 Kartu KPI:
  1. Baris atas: Label singkat (`12px`, `font-semibold`, `var(--text-helper)`) + wadah ikon SVG `32×32px` berlatar `var(--bg-interactive)` (`rounded-lg`).
  2. Baris tengah: Angka utama besar (`text-2xl font-bold tracking-tight tabular-nums`).
  3. Baris bawah: Konteks nyata dari data (mis. `"4 dari 16 berstatus PENDING"` atau micro progress bar lebar `pct%` yang dihitung dari data aktif).

---

## 4. Ikonografi Presisi (Nol Emoji di UI Chrome — `lucide-react` & Iconify)

- **Larangan Keras:** Jangan gunakan emoji Unicode (`📦`, `💰`, `🗑️`, `🔍`, `✅`, `⚠️`) sebagai ikon navigasi sidebar, tombol aksi, kartu KPI, atau notifikasi toast.
- **Aturan Pemilihan per Stack:**
  1. **Stack `react` (Vite):** Gunakan paket **`lucide-react`** (ter-bundle lokal saat build, 0 request jaringan runtime).
  2. **Stack `html-tailwind` (dan opsional `gasly-pro`):** Diizinkan menggunakan **Iconify Web Component** (`<script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js" defer></script>`) dengan tag `<iconify-icon icon="lucide:<nama>" width="18" height="18" aria-hidden="true"></iconify-icon>` agar mewarisi `currentColor` di Light/Dark mode dan menghemat token.
     - **Dilarang** memakai `<img src="https://api.iconify.design/...">` untuk ikon UI interaktif karena tidak mewarisi `currentColor` saat *Theme Toggle*.
     - **Kunci 1 Keluarga Ikon:** Gunakan konsisten 1 set per proyek (default: **`lucide:*`**; alternatif: `tabler:*` atau `solar:*-linear`). Jangan mencampur gaya tipis & tebal di layar yang sama.
     - **Kunci Dimensi (Zero CLS):** Selalu sertakan `width` & `height` eksplisit (mis. `16`, `18`, `20`) serta `aria-hidden="true"` bila mendampingi label teks.
     - **Gunakan Nama Ikon Terverifikasi:** Prioritaskan nama ikon `lucide` standar (`plus`, `search`, `refresh-cw`, `trash-2`, `pencil`, `check-circle-2`, `alert-circle`, `shield-check`, `upload`, `download`, `x`, `menu`, `sun`, `moon`, `log-out`, `package`, `users`, `calendar`, `clock`, `file-text`, `external-link`, `utensils`, `truck`, `wallet`, `filter`, `chevron-down`).
     - **Kontrol Kritikal:** Tombol tutup modal (`&times;` / inline SVG) tetap harus terlihat meskipun jaringan ke `api.iconify.design` terputus.
  3. **Pengecualian Mutlak (`Gate I-01`):** `api.iconify.design` / `code.iconify.design` **dilarang keras** digunakan di dalam `install-guide.html` (`gasly-deploy-guide` wajib 100% offline).

---

## 5. Data Table Toolbar, Refined Status Pills & Mobile Card View

1. **Unified Table Toolbar:**
   Letakkan dalam satu kontainer kartu bersama tabelnya (`border-b` tipis):
   - Kiri: Input pencarian real-time berikon kaca pembesar + deretan **Filter Pill** (mis. `Semua`, `PENDING`, `ACTIVE`, `COMPLETED`) dengan hitungan jumlah baris per status.
   - Kanan: Dropdown urutkan (*Terbaru / Nominal Tertinggi*) + penghitung hasil (`"Menampilkan 12 dari 16 data"`).
2. **Refined Status Pill (Bukan Kotak Warna Solid Kasar):**
   - Bentuk: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border`.
   - Gunakan dot indikator `6px` + latar lembut ber-border halus yang menjaga kontras teks `>= 4,5:1` di Light maupun Dark Mode.
3. **Dual Responsive Rendering (`Desktop Table` + `Mobile Card View`):**
   - **Layar `>= 768px` (`hidden md:block`):** Tabel dengan header lengket (*sticky*), teks rata kiri, kode ID `font-mono text-xs`, nominal rata kanan `.tabular-nums font-semibold`, dan tombol aksi rapi di kolom kanan.
   - **Layar `< 768px` (`md:hidden space-y-3`):** Render setiap baris sebagai kartu ringkas bertumpuk (*stacked card*): Baris 1 (Judul + Status Pill), Baris 2 (ID monospace + Kategori + Tanggal), Baris 3 (Nominal besar `.tabular-nums` + tombol aksi minimum `40×40px`).

---

## 6. Micro-Surface, Skeleton Realistis, Empty State & Sonner Toast

- **Realistic Skeleton Loader:** Saat `LOADING`, render 4 kartu skeleton KPI dan 5 baris skeleton tabel dengan tinggi yang sama persis dengan konten asli (`animate-pulse`, mematuhi `prefers-reduced-motion`).
- **Illustrated Empty State:** Ketika data kosong atau pencarian menghasilkan `0` baris, tampilkan kontainer terpusat (`py-12`) berisi lingkaran ikon SVG `48×48px`, judul tegas, penjelasan 1 baris, dan 1 tombol aksi langsung (`"+ Buat Data Pertama"` atau `"Reset Filter"`).
- **Sonner-Style Stacked Toast:**
  - Tempatkan di kanan-atas (atau kanan-bawah desktop) dengan lebar `max-w-sm`, kartu ber-border halus (`var(--bg-surface)` + strip aksen kiri `4px` sesuai varian `success`/`error`/`warning`/`info` + ikon SVG status + tombol tutup `×`), sehingga tidak menabrak badge `Preview Mode` di kiri-bawah.

---

## 7. Checklist Self-Audit Estetika $49/Bulan

Sebelum menyelesaikan kode frontend (`gasly-ui` / `gasly-pro`), pastikan seluruh 8 poin berikut terpenuhi:
- [ ] Nol emoji mentah dipakai sebagai ikon navigasi, tombol, KPI, atau toast (seluruhnya inline SVG konsisten).
- [ ] Pada `INTERNAL_APP` / Dashboard, form tambah/edit berada di Slide-Over Drawer atau Modal—bukan menumpuk terbuka di atas tabel.
- [ ] Tersedia 3–4 kartu Bento KPI di atas tabel yang dihitung *live* dari state data dengan `.tabular-nums`.
- [ ] Tabel dilengkapi Search + Filter Pills + Status Pills lembut + Mobile Stacked Card View (`< 768px`).
- [ ] Skeleton loader meniru bentuk kartu KPI & tabel asli, dan Empty State memiliki ikon SVG + tombol CTA.
- [ ] Toast bergaya Sonner terstruktur dengan ikon SVG dan tombol tutup.
- [ ] Seluruh foto/video dummy pada halaman publik memakai `MEDIA_PLACEHOLDERS` (`Gate W-10`) dengan rasio aspek terkunci dan fallback SVG.
- [ ] Seluruh interaksi memiliki state `:hover`, `:active`, dan `:focus-visible` yang kontras serta halus (`150ms–200ms`).