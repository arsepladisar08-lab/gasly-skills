# Panduan Instalasi GASLY Skills per Platform AI LLM (`INSTALL.md`)

Gunakan tabel di bawah ini untuk memilih paket `dist/` yang paling tepat sesuai platform AI yang Anda pakai.

## Matriks Cepat Pemilihan Paket

| Platform AI | Metode Pemasangan | Paket dari `dist/` | Cara Memicu |
| :--- | :--- | :--- | :--- |
| **Claude Web / Desktop App** | Upload Custom Skill (`.zip`) | `dist/claude-zips/<skill>.zip` | Otomatis atau sebut nama skill |
| **Claude Code (CLI / IDE)** | Salin folder ke `.claude/skills/` | `dist/modular/<skill>/` | Otomatis atau `/gasly-prd` |
| **Gemini Web / Mobile App** | **Gemini Skills** (`Customize > Skills`) | `dist/web-bundles/` (`.md` saja, **bukan** `.zip`) | Ketik `/nama-skill` di chat |
| **Gemini CLI** | Salin folder skill ke workspace | `dist/modular/<skill>/` | Otomatis / referensikan `SKILL.md` |
| **ChatGPT Web / Desktop / Mobile** | **ChatGPT Projects** atau **Skills** | `dist/web-bundles/gasly-all-in-one/` (Free) atau per-skill (Plus/Pro) | Chat di Project atau `@nama-skill` |
| **ChatGPT Custom GPT** *(Business/Enterprise/Edu)* | GPT Builder Knowledge | `dist/web-bundles/gasly-all-in-one/` (4 file `.md`) | Buka Custom GPT langsung |

> **Prasyarat Build:** Jalankan `python build_skills.py` terlebih dahulu untuk menghasilkan `dist/claude-zips/`, `dist/web-bundles/`, dan `dist/modular/`.

---

## 1. Claude (Claude.ai Web, Aplikasi Desktop, & Claude Code)

### A. Claude.ai Web & Aplikasi Claude Desktop *(Rekomendasi Utama)*
Claude Web/Desktop menerima file `.zip` dengan struktur root folder `<nama-skill>/SKILL.md`. Compiler sudah menyiapkannya otomatis di `dist/claude-zips/`.
1. Buka **Claude.ai** atau **Claude Desktop App**.
2. Masuk ke **Settings > Capabilities > Skills** (atau **Customize > Skills**).
3. Klik **Upload skill**, lalu unggah file `.zip` dari `dist/claude-zips/` (disarankan minimal: `gasly-start.zip`, `gasly-prd.zip`, `gasly-prd-to-uiux.zip`, `gasly-data.zip`, `gasly-ui.zip`, `gasly-deploy-guide.zip`).
4. Pastikan *toggle* masing-masing skill aktif (**ON**).
5. Mulai chat: *"Pakai GASLY, saya ingin membangun aplikasi pencatatan kas kecil berbasis Google Sheets."*

*(Alternatif bila akun menggunakan **Claude Projects**: tempel isi `dist/web-bundles/gasly-start/SKILL.md` ke **Project Instructions**, lalu unggah 4 file dari `dist/web-bundles/gasly-all-in-one/` ke **Project Knowledge**).*

### B. Claude Code (CLI / Agentic IDE)
```bash
# Pemasangan global (tersedia di semua repositori)
mkdir -p ~/.claude/skills
cp -r dist/modular/gasly-{start,prd,prd-to-uiux,pro-api,data,ui,deploy-guide} ~/.claude/skills/

# Atau khusus proyek saat ini
mkdir -p .claude/skills
cp -r dist/modular/gasly-{start,prd,prd-to-uiux,pro-api,data,ui,deploy-guide} .claude/skills/
```

---

## 2. Google Gemini (Gemini Web, Aplikasi Mobile, & Gemini CLI)

> **Catatan Penting:** Google Gemini menggunakan fitur **Gemini Skills** (`Customize > Skills` di `gemini.google.com`, sinkron otomatis ke aplikasi Android/iOS). Gemini Skills mendukung lampiran file hingga 100 MB, tetapi **menolak format `.zip` dan `.ts`**. Karena itu gunakan file `.md` dari `dist/web-bundles/`.

### A. Gemini Web & Aplikasi Gemini Mobile (Android / iOS)
1. Buka [gemini.google.com](https://gemini.google.com) melalui browser.
2. Di sidebar kiri, buka **Customize > Skills** $\rightarrow$ klik **Create Skill**.
3. **Opsi 1 — Satu Skill Terpadu (`gasly-studio`, paling praktis):**
   - **Name:** `gasly-studio`
   - **Instructions:** Salin seluruh isi `dist/web-bundles/gasly-start/SKILL.md`.
   - **Attachments:** Unggah ke-4 file `.md` dari `dist/web-bundles/gasly-all-in-one/` (atau tautkan dari Google Drive Anda).
4. **Opsi 2 — Per Skill Spesialis (`gasly-prd`, `gasly-data`, `gasly-ui`, dst.):**
   - Buat Skill terpisah untuk tiap tahap; tempel `dist/web-bundles/<skill>/SKILL.md` ke **Instructions** dan unggah `dist/web-bundles/<skill>/<skill>-knowledge.md` ke **Attachments**.
5. Klik **Save**.
6. **Cara Pakai (Web & HP):** Di chat baru mana pun, ketik `/gasly-studio` (atau `/gasly-prd`) diikuti brief aplikasi Anda.

*(Pengguna Google Workspace yang masih memakai **Gems**: buka **Gem Manager > New Gem**, tempel `SKILL.md` ke Instructions, lalu unggah 4 file dari `dist/web-bundles/gasly-all-in-one/`).*

### B. Gemini CLI
Salin folder dari `dist/modular/` ke direktori skill/context proyek Anda, lalu arahkan sesi ke `dist/modular/gasly-start/SKILL.md` atau `llms.txt`.

---

## 3. ChatGPT (ChatGPT Web, Aplikasi Desktop, & Mobile)

### A. ChatGPT Projects *(Rekomendasi Utama — Tersedia di Free, Plus, Pro)*
ChatGPT Projects membatasi jumlah lampiran file per Project: **5 file (Free)**, **25 file (Go/Plus)**, **40 file (Pro/Business/Enterprise)**.
1. Buka **ChatGPT** (Web atau Aplikasi Desktop) $\rightarrow$ klik **Projects > New Project** $\rightarrow$ beri nama **`GASLY App Studio`**.
2. Klik **Project Instructions**, lalu tempel isi `dist/web-bundles/gasly-start/SKILL.md` ditambah 1 baris panduan:
   > *"Gunakan file knowledge GASLY yang terlampir sesuai tahap (PRD, UIUX, Backend GAS, Frontend, atau Deploy Guide). Jawab ringkas, to-the-point, dan patuhi seluruh Hard Gates."*
3. Klik **Add files**:
   - **Paket ChatGPT Free (maks. 5 file):** Unggah tepat **4 file** dari `dist/web-bundles/gasly-all-in-one/`.
   - **Paket ChatGPT Plus / Pro (25–40 file):** Unggah `SKILL.md` dan `*-knowledge.md` dari `dist/web-bundles/` untuk setiap skill yang diinginkan.
4. Mulai percakapan di dalam Project (otomatis tersinkronisasi ke Web, Desktop, dan Aplikasi Mobile ChatGPT).

### B. ChatGPT Skills *(Web / Desktop / Codex CLI)*
1. Jika akun Anda memiliki fitur **Skills**, unggah folder skill dari `dist/modular/<skill>/` melalui **ChatGPT Web** (lebih stabil dan otomatis sinkron ke Desktop App).
2. Panggil skill di chat dengan mengetik `@gasly-prd`, `@gasly-data`, atau `@gasly-ui`.

### C. Custom GPT *(Khusus Akun Business / Enterprise / Edu)*
1. Buka **Explore GPTs > Create** $\rightarrow$ tab **Configure**.
2. Tempel `dist/web-bundles/gasly-start/SKILL.md` ke kolom **Instructions**.
3. Di bagian **Knowledge**, unggah ke-4 file `.md` dari `dist/web-bundles/gasly-all-in-one/`.
4. Aktifkan **Code Interpreter & Data Analysis** bila ingin GPT memvalidasi JSON kontrak secara lokal.