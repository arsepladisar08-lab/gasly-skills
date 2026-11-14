<!-- KB_VERSION: 2.1.0 -->
# GAS BACKEND SAFE ENGINE (DATA, CONCURRENCY, SECURITY & SCHEMA)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Selalu dimuat pada setiap pembuatan atau modifikasi kode backend (`setup.gs` dan `code.gs`).

## Daftar Isi
1. [Strategi Baca/Tulis Data, Anti-Null Date & Anti-Locale Bug](#1-strategi-bacatulis-data-anti-null-date--anti-locale-bug)
2. [Konkurensi, LockService, Flush & Penomoran ID Harian](#2-konkurensi-lockservice-flush--penomoran-id-harian)
3. [Kontrak Response Envelope & Taksonomi Kode Error](#3-kontrak-response-envelope--taksonomi-kode-error)
4. [Batas Keamanan GAS, Fungsi Private (`_`) & Mode Deploy](#4-batas-keamanan-gas-fungsi-private-_--mode-deploy)
5. [Evolusi Skema (`SCHEMA_VERSION`), Pemetaan Header & Seed Data](#5-evolusi-skema-schema_version-pemetaan-header--seed-data)

---

<!-- DIGEST:START -->
## 1. Strategi Baca/Tulis Data, Anti-Null Date & Anti-Locale Bug

1. **Mengapa Objek `Date` Wajib Diserialisasi (`Anti-Null Bug`):**
   Protokol serialisasi `google.script.run` di Google Apps Script tidak mendukung pengiriman objek `Date` native JavaScript. Jika fungsi server mengembalikan objek atau array yang masih mengandung instance `Date` (hasil `sheet.getValues()` pada sel tanggal), `google.script.run` gagal secara diam-diam dan mengirimkan `null` ke client.
   - **Aturan:** Gunakan fungsi sanitasi rekursif (`sanitizeForClient_()`) untuk mengubah setiap instance `Date` menjadi string ISO ber-offset (`yyyy-MM-dd'T'HH:mm:ssXXX`, contoh: `2026-11-13T09:30:00+07:00`) menggunakan `Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX")`. Samakan zona waktu Spreadsheet dengan zona waktu Script pada `setup.gs`.
2. **Mengapa Menyimpan Angka Mentah & Tanggal ISO (`Anti-Locale Bug`):**
   `getDisplayValues()` mengembalikan string sesuai *locale* Spreadsheet (misalnya `"1.250.000,50"` atau `"13/11/2026"`). Mem-parsing ulang string berformat locale di sisi client rawan menghasilkan `NaN` atau salah urutan tanggal.
   - **Aturan:** Gunakan `getValues()` untuk membaca tipe angka (`Number`) dan tanggal secara utuh, serialisasikan tanggal ke format ISO ber-offset di server, lalu lakukan pemformatan tampilan mata uang (`Intl.NumberFormat('id-ID')`) dan tanggal ramah baca (`Intl.DateTimeFormat('id-ID')`) di sisi client. Jangan sembunyikan nilai numerik yang rusak/kosong sebagai `"Rp 0"`; tampilkan `"-"` atau `"Data tidak valid"`.
3. **Batch Read, Batch Write & Larangan Self-Heal Liar:**
   - Baca seluruh range data satu kali per operasi (`sheet.getDataRange().getValues()`) dan tulis menggunakan `setValues(rows2D)`.
   - Fungsi baca (`readSheetObjects_`) **tidak boleh** memanggil `initialSetupDatabase()` secara otomatis ketika sheet belum ada (untuk mencegah *nested lock* dan mutasi tak sengaja pada jalur baca); kembalikan kode error `NOT_FOUND` dengan instruksi menjalankan `initialSetupDatabase()`.

---

## 2. Konkurensi, LockService, Flush & Penomoran ID Harian

1. **Aturan `LockService` dan `SpreadsheetApp.flush()`:**
   Dokumentasi resmi `Lock.releaseLock()` menyarankan pemanggilan `SpreadsheetApp.flush()` sebelum melepas lock agar perubahan tertunda langsung tertulis selagi akses eksklusif masih dipegang.
   - **Aturan:** Jangan memanggil `SpreadsheetApp.flush()` setelah setiap tulis di luar lock. Panggil `SpreadsheetApp.flush()` **di dalam blok `try` tepat sebelum `lock.releaseLock()` pada blok `finally`**, atau saat baris kode berikutnya harus segera membaca ulang perubahan tersebut.
2. **Penanganan Timeout Lock & Lost Update (`CONFLICT`):**
   - Gunakan `lock.tryLock(10000)`. Jika gagal mendapatkan lock, kembalikan kode error `LOCK_TIMEOUT`.
   - Pada operasi update/delete, periksa kecocokan `payload.updated_at` terhadap nilai `updated_at` di baris sheet; jika berbeda, kembalikan kode error `CONFLICT`.
3. **Pembuatan ID Berurutan Harian (`[PREFIX]-YYYYMMDD-0001`):**
   Jangan menghitung nomor urut dari `jumlah_baris + 1` atau indeks loop lintas tanggal. Di dalam `LockService.getScriptLock()`, format tanggal berjalan dengan `Utilities.formatDate(new Date(), tz, 'yyyyMMdd')`, pindai seluruh ID berawalan `[PREFIX]-YYYYMMDD-`, cari angka maksimum dari 4 digit terakhir (`maxSeq`), lalu gunakan `maxSeq + 1` (pola yang sama wajib dipakai pada pembuatan data seed dan mock).

---

## 3. Kontrak Response Envelope & Taksonomi Kode Error

Seluruh fungsi publik di `code.gs` yang dipanggil oleh `google.script.run` harus mengembalikan struktur kanonik berikut:
```json
{
  "status": "success | error",
  "data": {},
  "message": "Pesan ramah pengguna dalam Bahasa Indonesia",
  "code": "OK | VALIDATION_ERROR | NOT_FOUND | FORBIDDEN | CONFLICT | LOCK_TIMEOUT | INTERNAL_ERROR",
  "meta": { "schemaVersion": "1.0.0", "timestamp": "2026-11-13T09:00:00+07:00" }
}
```
- Jangan pernah mengirimkan `err.stack` atau `err.toString()` mentah ke client.

---

## 4. Batas Keamanan GAS, Fungsi Private (`_`) & Mode Deploy

1. **Eksposur Fungsi Top-Level & Guard Fungsi Admin Publik:**
   Di Google Apps Script, semua fungsi *top-level* tanpa akhiran underscore (`_`) dapat dipanggil dari Console DevTools browser melalui `google.script.run`.
   - **Fungsi Helper (`_`):** Seluruh fungsi internal (`sanitizeForClient_()`, `generateNextId_()`, `readSheetObjects_()`, `escapeFormula_()`, `assertAdminAccess_()`) harus diakhiri `_` agar tertutup dari client.
   - **Fungsi Setup, Purge & Diagnostik:** `initialSetupDatabase()`, `purgeSeedData()`, dan `runDiagnostics()` tetap publik (tanpa `_` pada `initialSetupDatabase` dan `runDiagnostics` agar muncul di dropdown toolbar "Run" GAS Editor). Karena publik, ketiganya wajib memiliki guard di sisi server:
     - `initialSetupDatabase()` dikunci dengan idempotensi `PropertiesService` dan mencatat `OWNER_EMAIL` saat pertama kali dijalankan pemilik.
     - `purgeSeedData(payload)` dan `runDiagnostics(payload)` wajib memanggil `assertAdminAccess_(payload)` di baris pertama. Jika tidak terotorisasi, kembalikan `FORBIDDEN` dan **jangan bocorkan struktur nama sheet/header** pada `runDiagnostics`.
2. **Mode Deploy & Jebakan `getActiveUser() == getEffectiveUser()`:**
   Perilaku identitas di GAS bergantung pada pengaturan deployment Web App:
   - **Mode 1 (`Execute as: Me` + `Who has access: Anyone`):** `Session.getActiveUser().getEmail()` kosong (`""`) untuk pengguna publik. Otorisasi admin dari UI wajib menggunakan verifikasi `ADMIN_PIN` (yang disimpan di `ScriptProperties` / sheet `CONFIG`) atau token sesi.
   - **Mode 2 (`Execute as: Me` + `Who has access: Anyone within [Organization]`):** Email pengguna Google Workspace terbaca andal. Pengecekan pemilik `getActiveUser().getEmail() === getEffectiveUser().getEmail()` valid pada mode ini, atau peran dapat dicek terhadap tabel role di sheet `CONFIG`.
   - **Mode 3 (`Execute as: User accessing the web app`):** Pada mode ini, `getActiveUser()` dan `getEffectiveUser()` **selalu bernilai sama** (keduanya adalah pengguna yang sedang membuka aplikasi!). Oleh karena itu, perbandingan `getActiveUser() == getEffectiveUser()` **tidak pernah boleh dipakai** pada mode ini karena akan selalu lolos untuk semua orang. Verifikasi pemilik/admin pada mode ini wajib membandingkan `Session.getActiveUser().getEmail()` terhadap `OWNER_EMAIL` yang disimpan di `ScriptProperties` atau daftar email admin di sheet `CONFIG`.
3. **Pencegahan Formula Injection (`escapeFormula_`) & Perilaku Baca-Balik:**
   - Terapkan `escapeFormula_()` **hanya pada field teks bebas** menurut skema (seperti `title`, `name`, `notes`, `address`). **Jangan pernah** menerapkannya pada field numerik (agar angka negatif seperti `-25000` tidak berubah menjadi string teks), tanggal ISO, atau enum terkontrol.
   - *Catatan Perilaku Apostrof Saat Dibaca Balik:* Ketika string yang diawali apostrof penangkal formula (mis. `'=SUM(A1:A2)`) ditulis ke sel melalui `setValues()`, Google Sheets memperlakukan apostrof pertama sebagai penanda format teks literal; saat dibaca kembali dengan `getValues()`, apostrof pengaman tersebut tidak ikut terbaca sebagai karakter ganda, melainkan mengembalikan teks `'=SUM(A1:A2)` tanpa mengeksekusi rumus. Karena itu, lakukan sanitasi `escapeFormula_()` tepat satu kali pada input teks dari user sebelum menulis ke sheet.
<!-- DIGEST:END -->

---

## 5. Evolusi Skema (`SCHEMA_VERSION`), Pemetaan Header & Seed Data

1. **Pemetaan Berdasarkan Nama Header:**
   Normalisasikan baris pertama (header) menjadi `snake_case` (`h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')`). Jangan menggunakan indeks kolom hardcoded saat melakukan update.
2. **Penanda `SCHEMA_VERSION` & Migrasi Idempoten:**
   Simpan `SCHEMA_VERSION` di `PropertiesService.getScriptProperties()`. Saat versi skema naik, tambahkan kolom baru yang belum ada di sebelah kanan header terakhir tanpa menghapus data lama.
3. **Penanda Seed Deterministik (`SEED-`) & `purgeSeedData()`:**
   Beri prefix `'SEED-'` dan kolom `is_seed = 'TRUE'` pada seluruh 15–20 data dummy historis agar dapat dibersihkan secara aman melalui `purgeSeedData()`.