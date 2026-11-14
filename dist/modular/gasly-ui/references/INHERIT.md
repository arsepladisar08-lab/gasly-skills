<!-- KB_VERSION: 2.1.0 -->
# TOKEN & GATE INHERITANCE FOR 15 ADDITIONAL STACKS (`stacks/INHERIT.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-prompt` dan `gasly-ui` ketika pengguna meminta salah satu dari 15 stack pewaris (*inheriting stacks*).

## Daftar Isi
1. [Daftar 15 Stack Pewaris Resmi](#1-daftar-15-stack-pewaris-resmi)
2. [Kontrak yang Diwarisi oleh Seluruh 15 Stack](#2-kontrak-yang-diwarisi-oleh-seluruh-15-stack)
3. [Matriks Adaptasi Teknis per Kelompok Stack](#3-matriks-adaptasi-teknis-per-kelompok-stack)

---

## 1. Daftar 15 Stack Pewaris Resmi

Kelima belas stack berikut tidak memiliki file boilerplate adapter khusus pada tahap ini, tetapi **didukung melalui mode pewarisan (`STACK_MODE: INHERIT`)** dengan mewarisi kontrak protokol `/exec`, token desain JSON/CSS, karakter 3 dials, serta gerbang kualitas:

1. `angular`
2. `avalonia`
3. `flutter`
4. `javafx`
5. `jetpack-compose`
6. `laravel`
7. `react-native`
8. `svelte`
9. `swiftui`
10. `threejs`
11. `uno`
12. `uwp`
13. `vue`
14. `winui`
15. `wpf`

---

## 2. Kontrak yang Diwarisi oleh Seluruh 15 Stack

Ketika membangun pada salah satu dari 15 stack di atas, agen wajib menerapkan 4 kontrak inti berikut tanpa pengecualian:

1. **Kontrak Komunikasi (`references/contract.md`):**
   - Hanya menggunakan satu konfigurasi URL Web App publik (`.../exec`).
   - Mengirim permintaan `POST` dengan `Content-Type: text/plain;charset=utf-8`, mengikuti pengalihan `HTTP 302` (`followRedirects = true`), membungkus payload `{ action, v: 1, auth, idem, payload }`, dan hanya melakukan retry pada aksi yang memiliki kunci `idem` atau aksi baca.
2. **Kontrak Gambar Drive (`driveImageUrl`):**
   - Mengambil gambar menggunakan `https://drive.google.com/thumbnail?id=<fileId>&sz=w<width>` dengan fallback otomatis ke `https://lh3.googleusercontent.com/d/<fileId>=w<width>`.
   - Mengompres foto di sisi client ke sekitar `<= 1 MB` sebelum mengirim base64 ke `file.upload` dengan 5 state (`idle`, `compressing`, `uploading`, `error`, `done`).
3. **Kontrak Token Desain & Preset (`references/presets/<preset>.tokens.json`):**
   - Mengambil nilai hex dari `modes.light` dan `modes.dark` pada file JSON preset yang dipilih (`aura`, `editorial-light`, `dense-dashboard`, `warm-friendly`) sehingga seluruh pasangan teks dan latar tetap lulus kontras **WCAG AA (>= 4,5:1)**.
4. **Kontrak Gerbang Kualitas (`references/gates.md`):**
   - Seluruh 15 stack wajib mematuhi seluruh gerbang **`UNIVERSAL` (`U-01` s/d `U-09`)**.
   - Stack berbasis web (`angular`, `laravel`, `svelte`, `threejs`, `vue`) wajib mematuhi seluruh gerbang **`WEB-ONLY` (`W-01` s/d `W-08`)**.

---

## 3. Matriks Adaptasi Teknis per Kelompok Stack

| Kelompok Stack | Anggota Stack | Cara Konsumsi Token Desain | Aturan HTTP Client ke `/exec` & Penyimpanan Token |
| :--- | :--- | :--- | :--- |
| **Web Frameworks & 3D Web** | `angular`, `laravel`, `svelte`, `threejs`, `vue` | Impor langsung `references/css/<preset>.css` (`var(--bg-base)`, dll.). Untuk `threejs`, gunakan UI overlay HTML/CSS di atas `<canvas>` untuk form/tabel dan ambil warna scene dari JSON token. | Gunakan `fetch` dengan `Content-Type: text/plain;charset=utf-8` dan `redirect: "follow"`.(Pada `laravel`, pemanggilan dari PHP `Http::withOptions(['allow_redirects' => true])` juga didukung untuk bacaan server). Simpan token di memori state aplikasi. |
| **Mobile & Cross-Platform Native** | `flutter`, `react-native`, `jetpack-compose`, `swiftui` | Petakan `modes.light` dan `modes.dark` dari `<preset>.tokens.json` ke objek tema native (`ThemeData`, `StyleSheet`, `MaterialTheme`, `Color`). | Pastikan HTTP client (`http`/`dio`, `OkHttp`, `URLSession`) mengikuti redirect `302` pada request `POST` (atau tangani redirect manual bila library mengubah `POST` menjadi `GET` saat `302`). Simpan session token di memori (atau Keychain/EncryptedSharedPreferences bila sesi perlu dipertahankan). |
| **Desktop .NET & JVM** | `avalonia`, `uno`, `uwp`, `winui`, `wpf`, `javafx` | Petakan nilai hex dari `<preset>.tokens.json` ke `ResourceDictionary` XAML (`SolidColorBrush`) atau stylesheet CSS JavaFX. | Pada `.NET HttpClient` / Java `HttpClient`, aktifkan pengikutan redirect dan kirim body JSON sebagai `StringContent(json, Encoding.UTF8, "text/plain")`. Simpan session token di variabel memori proses aplikasi. |