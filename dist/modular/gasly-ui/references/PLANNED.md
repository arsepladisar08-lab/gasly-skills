<!-- KB_VERSION: 2.1.0 -->
# PLANNED FEATURES & NEXT-STAGE ROADMAP (`stacks/PLANNED.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-prompt`, `gasly-data`, dan `gasly-ui` ketika pengguna menanyakan fitur atau adapter yang dijadwalkan untuk tahap pengembangan berikutnya.

## Daftar Isi
1. [Status Item `PLANNED` (Dokumentasi Saja — Jangan Diimplementasikan Sebagai Fitur Matang)](#1-status-item-planned-dokumentasi-saja--jangan-diimplementasikan-sebagai-fitur-matang)
2. [Access Profile `P2` (`public-with-accounts` via Supabase Auth)](#2-access-profile-p2-public-with-accounts-via-supabase-auth)
3. [Adapter Penuh Tahap Berikutnya (`react-vite+shadcn` & `nuxtjs+nuxt-ui`)](#3-adapter-penuh-tahap-berikutnya-react-viteshadcn--nuxtjsnuxt-ui)
4. [Ekspor Token Otomatis untuk Stack Native & Desktop](#4-ekspor-token-otomatis-untuk-stack-native--desktop)

---

## 1. Status Item `PLANNED` (Dokumentasi Saja — Jangan Diimplementasikan Sebagai Fitur Matang)

Item yang tercantum di dalam dokumen ini berstatus **`PLANNED` (Direncanakan untuk Tahap Berikutnya)**.
- Agen tidak boleh mengklaim bahwa fitur-fitur di bawah ini sudah tersedia sebagai boilerplate siap pakai di repositori saat ini.
- Apabila pengguna meminta salah satu item di bawah ini, jelaskan statusnya secara transparan dan tawarkan jalur alternatif yang sudah didukung penuh pada tahap ini.

---

## 2. Access Profile `P2` (`public-with-accounts` via Supabase Auth)

- **Tujuan:** Mengizinkan ribuan pengguna publik mendaftar mandiri, melakukan reset kata sandi, dan hanya membaca/mengubah baris data milik mereka sendiri (*row-level ownership*).
- **Mengapa Ditunda ke Tahap Berikutnya:** Google Apps Script dan Google Sheets tidak dirancang sebagai penyedia identitas publik berskala besar (kuota pengiriman email harian terbatas dan latensi Sheet meningkat pada tabel pengguna besar). Rencana tahap berikutnya adalah mengintegrasikan **Supabase Auth** sebagai penyedia identitas eksternal sementara data bisnis tetap disimpan di Google Sheets/Drive.
- **Alternatif Saat Ini:**
  - Gunakan **`P3` (`public-plus-admin`)** jika pengunjung publik hanya perlu mengirim formulir/unggah bukti (dengan tiket sekali pakai `file.ticket`) dan melacak status menggunakan kode referensi unik, sementara persetujuan dilakukan oleh Admin.
  - Gunakan **`P4` (`internal-only`)** dengan login Google ID Token (`auth.google` + sheet `ALLOWLIST`) jika seluruh pengguna adalah anggota tim atau mitra yang emailnya sudah terdaftar.

---

## 3. Adapter Penuh Tahap Berikutnya (`react-vite+shadcn` & `nuxtjs+nuxt-ui`)

1. **`react` (Vite) + `shadcn/ui` (`PLANNED`):**
   - Direncanakan sebagai adapter penuh SPA murni untuk dashboard internal tanpa kebutuhan SSR/ISR.
   - *Solusi Saat Ini:* Gunakan adapter penuh **`nextjs` + `shadcn`** (dapat dijalankan dalam mode statis/CSR maupun SSR) atau **`html-tailwind`**. Jika pengguna tetap memilih Vite + React, gunakan aturan pewarisan di `references/INHERIT.md` bersama modul `gasClient.ts` dan `ImageUploader.tsx` dari `references/nextjs-shadcn.md`.
2. **`nuxtjs` + `nuxt-ui` (`PLANNED`):**
   - Direncanakan sebagai adapter penuh ekosistem Vue/Nuxt dengan dukungan pembacaan publik saat build/SSR.
   - *Solusi Saat Ini:* Gunakan adapter penuh **`astro`** atau **`nextjs` + `shadcn`**, atau bangun di atas Vue/Nuxt menggunakan mode pewarisan `STACK_MODE: INHERIT` (`references/INHERIT.md`).

---

## 4. Ekspor Token Otomatis untuk Stack Native & Desktop

- **Rencana Tahap Berikutnya:** Menambahkan skrip generator yang mengonversi `src/design/presets/*.tokens.json` secara otomatis menjadi file kode tema siap impor untuk SwiftUI (`Color+Gasly.swift`), Jetpack Compose (`Color.kt`), Flutter (`gasly_theme.dart`), dan .NET XAML (`GaslyColors.xaml`).
- **Solusi Saat Ini:** Agen yang membangun pada stack native/desktop dalam mode `INHERIT` membaca langsung nilai hex terverifikasi WCAG AA dari file `src/design/presets/<preset>.tokens.json`.