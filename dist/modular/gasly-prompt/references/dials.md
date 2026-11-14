<!-- KB_VERSION: 2.1.0 -->
# CHARACTER DIALS & ANTI-GENERIC UI RULES (`design/dials.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat oleh `gasly-prompt` dan `gasly-ui`.

## Daftar Isi
1. [Tiga Dials Karakter Desain (Skala 1–10)](#1-tiga-dials-karakter-desain-skala-110)
2. [Tabel Terjemahan Dials ke Implementasi CSS/Layout](#2-tabel-terjemahan-dials-ke-implementasi-csslayout)
3. [Aturan Anti-Generic AI UI (Anti-Slop Guardrails)](#3-aturan-anti-generic-ai-ui-anti-slop-guardrails)

---

## 1. Tiga Dials Karakter Desain (Skala 1–10)

Selain memilih satu **Preset Visual**, tahap perencanaan (`gasly-prompt`) wajib menetapkan nilai bulat `1` sampai `10` untuk tiga parameter karakter berikut:

1. **`DESIGN_VARIANCE` (`1–10`) — Asimetri & Eksplorasi Komposisi:**
   - Mengatur seberapa seragam atau asimetris struktur tata letak (*grid*), proporsi kartu, dan kontras ukuran tipografi.
2. **`MOTION_INTENSITY` (`1–10`) — Koreografi Transisi & Umpan Balik:**
   - Mengatur tingkat kehalusan transisi state, kemunculan modal/toast, dan respons mikro saat interaksi. Seluruh nilai wajib tetap mematuhi `@media (prefers-reduced-motion: reduce)`.
3. **`VISUAL_DENSITY` (`1–10`) — Kepadatan Informasi per Layar:**
   - Mengatur jarak spasi (*padding/gap*), tinggi baris tabel, dan jumlah metrik yang ditampilkan tanpa perlu menggulir (*scrolling*).

---

## 2. Tabel Terjemahan Dials ke Implementasi CSS/Layout

| Dial | Rentang Rendah (`1–3`) | Rentang Menengah (`4–7`) | Rentang Tinggi (`8–10`) |
| :--- | :--- | :--- | :--- |
| **`DESIGN_VARIANCE`** | Grid simetris ketat (`12-col` / `3-col` seragam), tinggi kartu identik, fokus murni pada keterbacaan tabel dan form standar. | Kombinasi kartu ringkasan utama dengan lebar berbeda (`col-span-8` + `col-span-4`), satu focal section beraksen di per tampilan. | Tata letak Bento asimetris atau komposisi editorial berlapis, kontras mencolok antara judul `Display` dan teks pendukung. |
| **`MOTION_INTENSITY`** | Transisi instan (`0ms–80ms`), hanya perubahan warna hover dan indikator spinner fungsional tanpa animasi masuk/keluar. | Transisi mikro terukur (`150ms–220ms` `cubic-bezier(0.16, 1, 0.3, 1)`), skeleton shimmer halus, dan animasi slide-in pada toast/drawer. | Transisi berlapis (`staggered reveal` ringan `40ms` antar kartu utama), umpan balik skala mikro pada tombol aktif (`scale(0.98)`), tetap tanpa memblokir input pengguna. |
| **`VISUAL_DENSITY`** | Ruang kosong (*whitespace*) lega: padding kartu `24px–32px`, gap `24px`, tinggi baris tabel `52px`, cocok untuk landing page atau tampilan eksekutif. | Kepadatan seimbang: padding kartu `20px`, gap `16px`, tinggi baris tabel `44px`, cocok untuk aplikasi operasional umum. | Kepadatan tinggi (*compact backoffice*): padding kartu `12px–16px`, gap `8px–12px`, tinggi baris tabel `34px–36px`, border sel tegas, font body `13px–14px` dengan `.tabular-nums`. |

> **Batas Keamanan Target Sentuh (`U-06`):** Bahkan ketika `VISUAL_DENSITY` bernilai `8–10`, pada layar mobile (`<768px`) area sentuh tombol, checkbox, dan kontrol aksi wajib tetap minimal `40px × 40px`.

---

## 3. Aturan Anti-Generic AI UI (Anti-Slop Guardrails)

Untuk mencegah tampilan aplikasi terlihat seperti hasil cetakan template AI generik yang seragam:
1. **Jangan Memasang Elemen Dekoratif Tanpa Fungsi:**
   - Dilarang menampilkan grafik palsu yang angkanya di-*hardcode* di HTML dan tidak dihitung dari data Sheet yang sebenarnya.
   - Dilarang menampilkan lonceng notifikasi, pemilih bahasa, atau lencana *"Pro Plan"* jika aplikasi tidak memiliki fitur tersebut di backend.
2. **Hindari Banjir Gradien & Glow:**
   - Maksimal **satu** elemen utama pada layar (seperti tombol CTA primer atau satu kartu sorotan di Hero) yang boleh menggunakan aksen kontras penuh. Jangan mewarnai setiap kartu KPI dengan gradien pelangi berbeda.
3. **Hirarki Data Nyata di Atas Ornamen:**
   - Pada aplikasi bisnis dan operasional, tabel data, filter pencarian, status sinkronisasi, dan tombol aksi utama harus langsung terlihat di paruh atas layar (*above the fold*) tanpa tertutup banner sambutan yang memakan setengah layar.
4. **Opsi Pemeriksaan CI Anti-Slop (Dokumentasi Opsional):**
   - Repositori dapat menambahkan langkah pemeriksaan statis opsional di CI yang mendeteksi pola terlarang pada hasil generasi (seperti `window.confirm(`, klaim `"10,000+ UMKM"`, atau `user-scalable=no`). Lihat dokumentasi workflow pada Fase 6.