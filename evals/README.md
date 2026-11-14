# GASLY SKILLS EVALUATION SUITE (`evals/README.md`)
**Target Versi KB:** `2.1.0`  
**Target Versi Skill:** `2.2.0`  
**Status Hasil Evaluasi Saat Ini:** `NOT RUN` (Belum ada hasil rekaman eksekusi model; jalankan di Gemini, Claude, dan ChatGPT menggunakan rubrik di bawah).

---

## 1. Delapan Brief Uji Standar (5 Legacy/Core + 3 Headless/Adapter Baru)

### Brief 1 — CRUD Sederhana (`gasly-prompt` $\rightarrow$ `gasly-data` / `gasly-pro`)
> **Prompt Uji:** "Buatkan aplikasi pencatat inventaris buku perpustakaan pribadi sederhana (judul buku, kategori, harga beli, status dipinjam/tersedia) dengan Google Apps Script dan Google Sheets."
- **Fokus Verifikasi:**
  - `gasly-prompt` menghasilkan 1 pertanyaan klarifikasi, blok Master Prompt berpagar 4 backtick, `KB_VERSION: 2.1.0`, dan 2 Gasly Idea.
  - Penomoran ID `SEED-YYYYMMDD-XXXX` dihitung per tanggal (`maxSeq + 1`), dan pemformatan mata uang tidak menyembunyikan nilai kosong/rusak sebagai `"Rp 0"`.

### Brief 2 — Landing Page Tanpa Data Bukti (Uji Ketahanan Anti-Fabrikasi `U-03`)
> **Prompt Uji:** "Buatkan landing page untuk menawarkan jasa konsultan pajak UMKM bernama 'PajakRapi' yang punya form pendaftaran konsultasi langsung masuk ke Google Sheets. Saya belum punya testimoni, belum punya data jumlah klien, dan harga paket belum ditentukan."
- **Fokus Verifikasi:**
  - `0` klaim jumlah pelanggan (`"10.000+ UMKM"`), `0` testimoni/foto karangan, `0` klaim bebas biaya server mutlak, dan `0` harga tetap `$19/$49/$99`.
  - Otomatis memilih preset `editorial-light` (bukan `aura`) dan mengganti bukti sosial dengan **Role-Based Use Cases** atau slot `{{...}}`.

### Brief 3 — Dashboard Multi-Role & Mini-Spec Gate
> **Prompt Uji:** "Tolong langsung buatkan kode aplikasi persetujuan reimburse biaya operasional karyawan. Ada role Staf (input pengajuan) dan Manajer Keuangan (approve/reject dan hapus data simulasi)."
- **Fokus Verifikasi:**
  - Karena dikirim sebagai ide mentah yang menyentuh uang dan role/izin, skill eksekutor wajib menampilkan **Mini-Spec** terlebih dahulu dan meminta 1 konfirmasi sebelum menulis kode penuh.

### Brief 4 — Input Kamera/Gambar & Mode Iterasi Skema (`SCHEMA_VERSION`)
> **Prompt Uji Tahap A:** "Buatkan aplikasi laporan inspeksi kebersihan ruangan dengan fitur ambil foto bukti dari HP, nilai skor kebersihan (0-100), dan catatan temuan."  
> **Prompt Uji Tahap B (Iterasi):** "Tambahkan kolom `lokasi_lantai` pada form, tabel, dan database Sheet."
- **Fokus Verifikasi:**
  - Tahap B menaikkan `SCHEMA_VERSION` dengan migrasi penambahan kolom non-destruktif dan mengingatkan langkah **Deploy > Manage deployments > Edit > New version**.

### Brief 5 — Konkurensi Tinggi & Stok Gudang (`LockService` + `CONFLICT` + `flush`)
> **Prompt Uji:** "Buatkan aplikasi mutasi stok barang gudang keluar/masuk yang dipakai oleh 5 staf gudang secara bersamaan di jam sibuk."
- **Fokus Verifikasi:**
  - Menggunakan `LockService.getScriptLock().tryLock(10000)` (`LOCK_TIMEOUT`), memeriksa `updated_at` (`CONFLICT`), memeriksa kunci idempotensi `idem`, dan memanggil `SpreadsheetApp.flush()` sebelum `lock.releaseLock()`.

---

### Brief 6 [BARU] — Headless `P3` Public + Admin, Upload Foto Drive & Stack `astro` (`editorial-light`)
> **Prompt Uji:** "Rancang dan bangun aplikasi direktori & pendaftaran vendor katering lokal menggunakan stack Astro dan preset editorial-light (Access Profile P3). Pengunjung publik bisa melihat daftar vendor dan mendaftarkan katering baru beserta unggahan 1 foto menu andalan ke Google Drive. Admin login dengan passphrase untuk menyetujui atau mengarsipkan vendor."
- **Fokus Verifikasi:**
  - **Arsitektur:** Frontend Astro mengambil daftar vendor publik pada saat *build-time* (`GET` `?action=items.list&v=1`) dan mengirim pendaftaran baru dari browser melalui `POST` `Content-Type: text/plain;charset=utf-8` ke `/exec`.
  - **Upload Drive (`G-09`):** Pengunjung publik mengambil tiket sekali pakai via `file.ticket` (dibatasi rate-limit di `CacheService`), mengompres foto di browser (`~1 MB`) dengan 5 state (`idle`, `compressing`, `uploading`, `error`, `done`), dan server memverifikasi allowlist MIME + *magic bytes* biner sebelum menyimpan ke `ROOT/<entity>/<yyyy-mm>` serta menulis `file_id` + `file_url` ke Sheet dalam satu operasi ber-lock.
  - **Penampilan Gambar (`W-08`):** Menggunakan helper tunggal `driveImageUrl(fileId, width)` dengan rantai fallback thumbnail ke `lh3.googleusercontent.com`.

### Brief 7 [BARU] — Headless `P4` Internal-Only, Stack `nextjs`+`shadcn` & Preset `dense-dashboard`
> **Prompt Uji:** "Bangun aplikasi internal audit kas kecil (petty cash) dengan Next.js App Router + shadcn/ui dan preset dense-dashboard (Access Profile P4 internal-only). Seluruh pembacaan dan penulisan wajib login dengan passphrase admin (atau Google ID Token allowlist)."
- **Fokus Verifikasi:**
  - **Otorisasi & Sesi (`U-01`, `U-02`):** Passphrase minimal 12 karakter disimpan sebagai *salted iterated hash* di `ScriptProperties`; `auth.login` mengeluarkan token `HMAC-SHA256` (TTL 2 jam, verifikasi constant-time, lockout 15 menit setelah 5 gagal login).
  - **Penyimpanan Token Frontend:** Disimpan di memori sebagai default utama (`sessionStorage` opsional dengan penjelasan bahwa cookie `HttpOnly` tidak tersedia lintas origin).
  - **Desain & Dials:** Menggunakan token `dense-dashboard` (`VISUAL_DENSITY` tinggi `8–9`, `.tabular-nums`, lulus kontras WCAG AA).

### Brief 8 [BARU] — Adapter `html-tailwind` (`warm-friendly`) & Fallback Stack Pewaris (`flutter`)
> **Prompt Uji Tahap A:** "Buatkan aplikasi papan pengumuman & laporan warga RT menggunakan html-tailwind dan preset warm-friendly yang terhubung ke URL /exec Apps Script."  
> **Prompt Uji Tahap B:** "Bagaimana jika frontend yang sama ingin dibangun menggunakan Flutter?"
- **Fokus Verifikasi:**
  - Tahap A (`html-tailwind`): Menyatakan secara eksplisit bahwa *Tailwind Play CDN* hanya untuk prototipe dan menyediakan konfigurasi build CSS terkompilasi (`dist/styles.css`) untuk produksi.
  - Tahap B (`flutter`): Menetapkan `STACK_MODE: INHERIT`, mewarisi kontrak JSON `text/plain` `/exec`, mengambil nilai hex dari `warm-friendly.tokens.json`, menggunakan rantai URL `driveImageUrl`, dan mematuhi seluruh gerbang `UNIVERSAL`.

---

## 2. Rubrik Penilaian Kuantitatif (Skor Lulus Minimum: 95 / 100)

| No | Kriteria Evaluasi | Bobot | Syarat Lulus Penuh |
| :-: | :--- | :---: | :--- |
| 1 | **Kepatuhan Arsitektur `/exec` & `text/plain`** | **20** | Hanya 1 konfigurasi URL `/exec` di frontend; `POST` memakai `text/plain;charset=utf-8` dengan `{ action, v:1, auth, idem, payload }`; `doPost`/`doGet` selalu mengembalikan envelope JSON. |
| 2 | **Otentikasi, Profil Akses & Rate Limit** | **20** | Penegakan `P1`/`P3`/`P4` di registry; hash passphrase ber-salt & iterasi di `ScriptProperties`; token `HMAC-SHA256` + constant-time compare; throttle 5 gagal -> kunci 15 menit. |
| 3 | **Integritas Sheets & Upload Drive Atomik** | **20** | `LockService` + cek `updated_at` + `flush()` sebelum `releaseLock()`; tiket `file.ticket` + cek *magic bytes* pada `file.upload` + simpan `file_id` & `file_url` atomik; tampil via `driveImageUrl`. |
| 4 | **Tiga Lapisan Desain & Kontras WCAG AA** | **15** | Pemilihan preset sesuai konteks (`aura` bukan default otomatis); penerapan 3 dials; seluruh pasangan warna lulus `python tools/check_contrast.py`. |
| 5 | **Anti-Fabrikasi (`U-03`) & Kejujuran Verifikasi** | **15** | `0` klaim bisnis/testimoni/harga karangan; mencantumkan `NOT RUN` dan item `<<PIN_VERSION>>`. |
| 6 | **Kelengkapan Kode & Aksesibilitas Web** | **10** | `0` elipsis/TODO; 5 state `ImageUploader`; `<label for>`, `:focus-visible`, modal tanpa `window.confirm()`, `.tabular-nums`. |