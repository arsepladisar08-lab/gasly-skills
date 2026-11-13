<!-- KB_VERSION: 2.2.0 -->
# SAAS APP ARCHITECTURE & TABLE UX
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat secara kondisional ketika membangun Web App, SaaS Dashboard, Portal Multi-Role, atau Internal Tool (tidak dimuat untuk Landing Page murni).

## Daftar Isi
1. [Arsitektur App Shell & Navigasi Responsif](#1-arsitektur-app-shell--navigasi-responsif)
2. [Komponen Kontekstual Opsional (Jangan Buat Dead UI)](#2-komponen-kontekstual-opsional-jangan-buat-dead-ui)
3. [Desain Data Table, Filter, Sort & Strategi Mobile](#3-desain-data-table-filter-sort--strategi-mobile)
4. [Strategi Soft-Delete & Undo](#4-strategi-soft-delete--undo)

---

<!-- DIGEST:START -->
## 1. Arsitektur App Shell & Navigasi Responsif

- **Sidebar Desktop & Drawer Mobile:**
  - Pada layar `>=1024px`, tampilkan sidebar navigasi di sisi kiri berisi daftar tampilan/modul yang benar-benar ada di dalam aplikasi.
  - Pada layar `<1024px`, sembunyikan sidebar tetap dan sediakan tombol menu di topbar yang membuka *Off-Canvas Mobile Drawer* dengan *backdrop* gelap.
- **Contextual Topbar:**
  Memuat judul halaman aktif, filter cepat rentang waktu (bila data memiliki dimensi waktu: *Hari Ini, 7 Hari, 30 Hari, Semua*), tombol *Refresh Data*, tombol *Theme Toggle* (Dark/Light), serta pemicu pencarian cepat.

---

## 2. Komponen Kontekstual Opsional (Jangan Buat Dead UI)

Jangan menempelkan ornamen SaaS yang tidak memiliki fungsi nyata di aplikasi pengguna:
- **Badge Paket (mis. "$49 Pro Plan"), Switcher Workspace/Cabang, atau Ikon Lonceng Notifikasi:** Hanya boleh ditampilkan apabila brief memang meminta fitur multi-cabang, manajemen langganan, atau sistem pusat notifikasi. Untuk *internal tool* biasa, ganti area footer sidebar dengan informasi berguna seperti **Status Koneksi Database**, **Versi Skema (`SCHEMA_VERSION`)**, atau tombol **Bersihkan Data Simulasi (`Purge Seed`)**.
- **Command Menu (`⌘K` / `Ctrl+K`):** Jika disertakan, setiap item di dalam daftar `⌘K` wajib terhubung ke fungsi nyata (berpindah tab, membuka modal tambah data, mengganti tema, atau memfilter pencarian).
<!-- DIGEST:END -->

---

## 3. Desain Data Table, Filter, Sort & Strategi Mobile

- **Perataan Kolom:**
  - Teks dan kategori: rata kiri (`text-left`).
  - Tanggal dan badge status: rata kiri atau tengah secara konsisten.
  - Nominal uang, kuantitas, dan persentase: **rata kanan (`text-right tabular-nums`)** agar desimal dan ribuan sejajar.
- **Interaksi Tabel yang Hidup:**
  - Bar pencarian teks, dropdown filter status/kategori, dan filter rentang tanggal harus memfilter array state data secara reaktif, lalu merender ulang tabel beserta kartu ringkasan KPI di atasnya.
- **Strategi Tabel di Layar Mobile:**
  Bungkus tabel dengan kontainer `overflow-x: auto` yang memiliki kolom aksi tetap jelas, atau sediakan tampilan kartu bertumpuk (*stacked card view*) untuk layar sempit agar pengguna HP tidak perlu menggeser layar terlalu jauh untuk menekan tombol Edit/Hapus.

---

## 4. Strategi Soft-Delete & Undo

- Di Google Sheets, operasi `sheet.deleteRow(rowIndex)` menggeser seluruh indeks baris di bawahnya dan berisiko menghapus baris yang salah bila ada dua pengguna yang menghapus data secara bersamaan.
- **Utamakan Soft-Delete:** Gunakan perubahan kolom `status = 'ARCHIVED'` (atau pengisian kolom `deleted_at`) sebagai mekanisme hapus default. Selain aman dari pergeseran indeks baris, pola ini memungkinkan fitur **"Urungkan (Undo)"** pada toast berjalan secara nyata dengan mengembalikan status baris tersebut.

## 5. Catatan Batas Akses Baca Berdasarkan Role

Dashboard multi-role harus menetapkan matriks permission server-side untuk setiap sheet, baris, dan field. Jangan mengirim seluruh data ke browser lalu hanya menyembunyikan kolom/menu di UI. Bila boilerplate single-tenant digunakan tanpa model kepemilikan record, batasi deployment pada audience tepercaya atau tambahkan read-scoped guard sebelum dipublikasikan.
