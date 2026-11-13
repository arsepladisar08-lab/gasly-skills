# GASLY SKILLS EVALUATION SUITE (`evals/`)
**Target Versi KB:** `2.1.0`  
**Platform Uji Wajib:** Gemini (Skills Mode / Web), Claude (Projects / Skills + Artifacts), dan ChatGPT (Custom GPT / Canvas).

---

## 1. Lima Brief Uji Standar (Fixed Test Prompts)

Jalankan kelima skenario di bawah ini secara berurutan pada setiap platform:

### Brief 1 — CRUD Sederhana (Uji Jalur 3 Fast-Track vs Stackable Dasar)
> **Prompt Uji:** "Buatkan aplikasi pencatat inventaris buku perpustakaan pribadi sederhana (judul buku, kategori, harga beli, status dipinjam/tersedia) dengan Google Apps Script dan Google Sheets."
- **Fokus Verifikasi:**
  - Pada `gasly-prompt`: Menghasilkan 1 pertanyaan klarifikasi, blok Master Prompt dengan pagar 4 backtick, `KB_VERSION: 2.1.0`, dan 2 Gasly Idea.
  - Pada `gasly-pro`: Paritas fungsi `getBootstrapData`, `saveItem`, `deleteItem`, `purgeSeedData` antara `code.gs` dan `handleMockAction_`, penomoran ID `SEED-YYYYMMDD-XXXX` per-hari, serta `formatCurrency` yang tidak menampilkan `"Rp 0"` untuk nilai kosong.

### Brief 2 — Landing Page Tanpa Data Bukti (Uji Ketahanan Anti-Fabrikasi)
> **Prompt Uji:** "Buatkan landing page untuk menawarkan jasa konsultan pajak UMKM bernama 'PajakRapi' yang punya form pendaftaran konsultasi langsung masuk ke Google Sheets. Saya belum punya testimoni, belum punya data jumlah klien, dan harga paket belum ditentukan."
- **Fokus Verifikasi:**
  - **Harga Mati (Zero Fabrication):** Output dilarang keras memunculkan klaim seperti `"10.000+ UMKM"`, `"+140% efisiensi"`, nama/foto testimoni karangan, klaim `"Tanpa Biaya Server Tambahan"`, atau harga tetap `$19/$49/$99`.
  - Section bukti sosial wajib otomatis beralih ke **Role-Based Use Cases** atau slot `{{...}}`, dan section harga memakai slot `{{HARGA_PAKET}}`.
  - Form pendaftaran konsultasi tetap terhubung end-to-end ke `code.gs` dan `setup.gs` dengan `escapeFormula_()` hanya pada field teks bebas.

### Brief 3 — Dashboard Multi-Role & Mode Deploy (Uji Keamanan & Jalur 3 Gate)
> **Prompt Uji (Langsung ke `gasly-pro` tanpa Master Prompt):** "Tolong langsung buatkan kode aplikasi persetujuan reimburse biaya operasional karyawan. Ada role Staf (input pengajuan) dan Manajer Keuangan (approve/reject dan hapus data simulasi). Deploy menggunakan mode Execute as: User accessing the web app."
- **Fokus Verifikasi:**
  - Karena dikirim sebagai ide mentah yang menyentuh **role/izin dan uang**, `gasly-pro` **wajib menolak langsung menulis kode** pada respons pertama, melainkan menampilkan **Mini-Spec** (Sheet+header, role, state utama, asumsi aktif, mode deploy) dan meminta 1 konfirmasi.
  - Setelah dikonfirmasi: di `code.gs`, `DEPLOY_MODE` diset ke `'USER_ACCESSING'`, dan `assertAdminAccess_()` **tidak menggunakan** `getActiveUser() == getEffectiveUser()`, melainkan membandingkan email aktif terhadap `OWNER_EMAIL` / tabel role `CONFIG` / `ADMIN_PIN`.

### Brief 4 — Aplikasi dengan Input Kamera/Gambar & Revisi Skema (Uji Mode Iterasi)
> **Prompt Uji Tahap A (Build):** "Buatkan aplikasi laporan inspeksi kebersihan ruangan dengan fitur ambil foto bukti dari HP, nilai skor kebersihan (0-100), dan catatan temuan."  
> **Prompt Uji Tahap B (Iterasi di Chat yang Sama):** "Tambahkan kolom `lokasi_lantai` pada form, tabel, dan database Sheet."
- **Fokus Verifikasi:**
  - Tahap A: Input kamera menggunakan `<input type="file" accept="image/*" capture="environment">` dengan fallback file picker, URL gambar Drive memakai `referrerpolicy="no-referrer" loading="lazy"` + fallback error.
  - Tahap B (Mode Iterasi): `gasly-pro` mencantumkan daftar **File Berubah vs Tidak Berubah**, menaikkan `SCHEMA_VERSION` (mis. ke `'1.1.0'`) dengan migrasi penambahan kolom `lokasi_lantai` yang idempoten di `setup.gs`, menggunakan *patch ber-anchor unik* bila `index.html` > 350 baris, serta menulis pengingat **Deploy > Manage deployments > New version**.

### Brief 5 — Konkurensi Tinggi & Stok/Saldo (Uji Lock, Flush & Conflict)
> **Prompt Uji:** "Buatkan aplikasi kasir pengambilan barang gudang (mutasi stok keluar/masuk) yang dipakai oleh 5 staf gudang secara bersamaan di jam sibuk."
- **Fokus Verifikasi:**
  - Mutasi stok berada di dalam `LockService.getScriptLock().tryLock(10000)` dengan penanganan kode `LOCK_TIMEOUT`.
  - Pengecekan `updated_at` aktif mengembalikan kode `CONFLICT` bila baris yang sama baru saja diubah staf lain.
  - `SpreadsheetApp.flush()` dipanggil di dalam `try` tepat sebelum `lock.releaseLock()` pada `finally`.

---

## 2. Rubrik Penilaian Kuantitatif (Skor Lulus Minimum: 95 / 100)

Gunakan tabel skor ini untuk mengevaluasi output pada masing-masing model (Gemini, Claude, ChatGPT):

| No | Kriteria Audit | Bobot | Syarat Lulus Penuh (100% Bobot) |
| :-: | :--- | :---: | :--- |
| 1 | **Anti-Fabrikasi Klaim Bisnis** | **20** | `0` klaim pelanggan/testimoni/logo/ROI/harga karangan pada Brief 2. (Gagal = skor kriteria ini `0`). |
| 2 | **Paritas Kontrak RPC & Sandbox** | **20** | Nama fungsi publik di `code.gs` == `handleMockAction_` di `index.html`; state memori default (`try/catch localStorage`); badge kiri-bawah + tombol Reset; toast kanan-atas. |
| 3 | **Keamanan GAS & Guard Admin** | **15** | Semua helper berakhiran `_`; `purgeSeedData` & `runDiagnostics` dilindungi `assertAdminAccess_`; tidak ada `getActiveUser() == getEffectiveUser()` pada `USER_ACCESSING`; `escapeFormula_` hanya pada teks bebas. |
| 4 | **Integritas Waktu, Lock & Flush** | **15** | Format waktu ISO ber-offset (`"yyyy-MM-dd'T'HH:mm:ssXXX"`) sama di server & mock; ID dihitung `maxSeq + 1` per tanggal di dalam lock; `flush()` sebelum `releaseLock()`. |
| 5 | **Kelengkapan File & Mode Iterasi** | **15** | `0` placeholder/TODO; pagar 4 backtick utuh; Jalur 3 berhenti meminta konfirmasi Mini-Spec pada Brief 3; Mode Iterasi pada Brief 4B menaikkan `SCHEMA_VERSION`. |
| 6 | **Kontras WCAG AA & Aksesibilitas** | **15** | Teks body `#A1A1AA` (Dark) / `#475569` (Light); helper `#8A8A93` / `#526071` (bukan `#64748B` di atas `#F1F5F9`); tombol putih `#4F46E5`; viewport tanpa `user-scalable=no`. |
| | **TOTAL SKOR** | **100** | **Ambang Lulus Rilis: >= 95 Poin di ketiga LLM (Gemini, Claude, ChatGPT)** |

---

## 3. Protokol Uji Pemuatan Lampiran pada Platform Target

Sebelum memilih varian distribusi (`dist/modular/`, `dist/flat/`, atau `dist/flat-lite/`):
1. Unggah varian **`dist/modular/`** ke fitur Skills di Gemini, Claude, dan ChatGPT.
2. Jalankan **Brief 1** dan **Brief 2**, lalu periksa apakah model mematuhi detail spesifik yang hanya ada di `references/` (seperti nama fungsi `mountSandboxPreviewBanner()` dan struktur `DB_SCHEMAS` di `boilerplates.md`).
3. Jika sebuah platform terbukti tidak memuat file di dalam subfolder `references/` secara otomatis saat skill dipanggil, gunakan hasil kompilasi **`dist/flat/`** (atau **`dist/flat-lite/`** bila platform membatasi panjang karakter instruksi).