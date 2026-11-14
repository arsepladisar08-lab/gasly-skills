<!-- KB_VERSION: 2.1.0 -->
# INTERACTION PRIMITIVES (STATE MACHINE, FORMS, MODALS, TOAST & A11Y)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat untuk semua jenis build yang memiliki interaksi UI, form, dialog, atau pemanggilan data.

## Daftar Isi
1. [Model State UI Wajib](#1-model-state-ui-wajib)
2. [Aturan Form, Validasi Dua Sisi & Pencegahan Double-Submit](#2-aturan-form-validasi-dua-sisi--pencegahan-double-submit)
3. [Modal, Drawer & Dialog Konfirmasi Destruktif](#3-modal-drawer--dialog-konfirmasi-destruktif)
4. [Sonner-Style Toast & Aturan Optimistic UI yang Aman](#4-sonner-style-toast--aturan-optimistic-ui-yang-aman)
5. [Aksesibilitas Keyboard, Fokus & Viewport](#5-aksesibilitas-keyboard-fokus--viewport)

---

<!-- DIGEST:START -->
## 1. Model State UI Wajib

Setiap komponen yang memuat atau memutasi data harus memiliki implementasi visual untuk seluruh jalur state berikut:
- `INITIAL → LOADING → SUCCESS`: Saat mengambil data awal, tampilkan *skeleton loader* yang ukurannya mengikuti bentuk tabel/kartu (bukan sekadar teks "Loading...").
- `INITIAL → LOADING → EMPTY`: Jika database kosong atau hasil filter pencarian `0` baris, tampilkan *Empty State* berisi penjelasan singkat dan tombol aksi langsung (contoh: `"+ Tambah Data Pertama"` atau `"Reset Filter"`).
- `INITIAL → LOADING → ERROR`: Jika panggilan server gagal, tampilkan pesan ramah pengguna beserta tombol **"Coba Lagi (Retry)"**.
- `SUCCESS → SAVING → SUCCESS`: Saat menyimpan form, kunci tombol submit (`disabled = true`), ubah label menjadi indikator proses (`"Menyimpan..."`), dan perbarui state hanya setelah konfirmasi sukses diterima.
- `SUCCESS → SAVING → ERROR → RECOVERY`: Jika penyimpanan gagal di server, tampilkan toast/pesan error spesifik, aktifkan kembali tombol submit, dan **pertahankan nilai yang sudah diketik user di dalam form** agar user tidak perlu mengetik ulang dari nol.
<!-- DIGEST:END -->

---

## 2. Aturan Form, Validasi Dua Sisi & Pencegahan Double-Submit

- **Label Nyata:** Setiap input, select, dan textarea harus memiliki elemen `<label for="...">` yang terlihat jelas. Placeholder hanya berfungsi sebagai contoh format, bukan pengganti label, karena placeholder hilang saat user mulai mengetik.
- **Validasi Client + Server:**
  - Validasi client memberikan umpan balik instan di bawah field yang salah (`aria-invalid="true"`, pesan spesifik seperti *"Nominal harus lebih besar dari 0"*).
  - Validasi server wajib menguji ulang seluruh field karena validasi client dapat dilewati.
- **Pencegahan Double-Submit:** Gunakan flag `isSubmitting` pada state form. Tolak eksekusi handler submit berikutnya selama request sebelumnya belum selesai.

---

## 3. Modal, Drawer & Dialog Konfirmasi Destruktif

- **Siklus Buka/Tutup Lengkap:** Setiap modal atau drawer yang didefinisikan di HTML harus memiliki fungsi pembuka (`openModal(id)`) dan penutup (`closeModal(id)`).
- **Empat Cara Menutup Modal:** User harus bisa menutup modal melalui: (1) tombol ikon `×` di sudut atas, (2) tombol `"Batal"`, (3) klik pada area *backdrop* gelap (kecuali sedang dalam state `SAVING`), dan (4) menekan tombol keyboard `Escape`.
- **Konfirmasi Aksi Destruktif:** Aksi hapus atau reset data tidak boleh langsung mengeksekusi server pada klik pertama, dan tidak boleh menggunakan `window.confirm()` bawaan browser (karena sering diblokir di dalam iframe sandboxed GAS/Canvas). Gunakan *Custom Confirmation Modal* yang menyebutkan nama/ID item yang akan dihapus.

---

## 4. Sonner-Style Toast & Aturan Optimistic UI yang Aman

- **Floating Toast:** Sediakan kontainer toast (`aria-live="polite"`) di pojok kanan bawah (desktop) atau tengah bawah (mobile) yang mendukung varian `success`, `error`, `warning`, dan `info`.
- **Batas Optimistic UI:**
  - *Optimistic update* (mengubah DOM sebelum respon server kembali) **hanya diizinkan** untuk aksi ringan non-finansial yang mudah di-*rollback* (seperti toggle bookmark atau perubahan status sederhana), dengan menyimpan salinan state lama untuk dikembalikan jika server gagal.
  - Untuk pembuatan record baru (yang membutuhkan Sequential ID dari server), perubahan saldo/stok, atau penghapusan permanen, **tunggu respon `status === 'success'` dari server** sebelum mengubah state utama.

---

## 5. Aksesibilitas Keyboard, Fokus & Viewport

- **Jangan Matikan Zoom Pengguna:** Tag meta viewport wajib menggunakan `width=device-width, initial-scale=1.0` **tanpa** `maximum-scale=1.0` dan **tanpa** `user-scalable=no`, agar mematuhi WCAG 1.4.4 (pengguna *low-vision* tetap dapat memperbesar layar).
- **Focus Ring & Manajemen Fokus:**
  - Pasang gaya `:focus-visible` yang jelas (`outline: 2px solid #6366F1; outline-offset: 2px`).
  - Saat modal dibuka, pindahkan fokus ke input pertama di dalam modal; saat ditutup, kembalikan fokus ke tombol pemicunya.