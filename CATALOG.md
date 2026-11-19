# Katalog Skill & Pemilih Paket GASLY

Gunakan katalog ini untuk memilih skill kanonik dan memahami batas tanggung jawab tiap bagian. Alur bertahap adalah rekomendasi, bukan kewajiban bila pengguna sudah memiliki artifact tahap sebelumnya.

## 1. Workflow Utama

| Tahap / Kebutuhan | Skill | Input utama | Output / tanggung jawab |
|---|---|---|---|
| Titik masuk dan deteksi kebutuhan | `gasly-start` | Pesan pengguna dan file yang tersedia | Rute skill dan handoff; bukan runtime orchestration otomatis |
| Ide menjadi spesifikasi produk | `gasly-prd` | Brief/ide atau PRD yang belum lengkap | `PRD-Final.md`, `MASTER-INSTRUCTIONAL-PROMPT.md`, `GASLY_CONTRACT.json` |
| PRD/referensi gambar menjadi desain | `gasly-prd-to-uiux` | PRD, screenshot, atau keduanya | `Prompt-Desain.md`, `DESIGN.md`, `UIUX_HANDOFF.md`, preview opsional |
| Implementasi full-stack | `gasly-pro-api` | PRD + kontrak + UI handoff (bila ada) | Koordinasi integrasi dan end-to-end acceptance |
| Backend GAS | `gasly-data` | Kontrak dan action registry | Backend `.gs`, auth, Sheets, Drive, integrations |
| Frontend | `gasly-ui` | Kontrak + handoff visual | Frontend sesuai adapter stack yang didukung |
| Instalasi/deployment | `gasly-deploy-guide` | Kontrak dan daftar file hasil build | Artifact HTML panduan setup/deploy mandiri |
| Aplikasi monolitik legacy | `gasly-pro` | Permintaan eksplisit `HtmlService` | `HtmlService` + `google.script.run`; legacy only |

## 2. Batas Tanggung Jawab

- `gasly-pro-api` **tidak menggantikan** `gasly-data` atau `gasly-ui`. Backend dan frontend tetap dikelola spesialis masing-masing agar aturan keamanan dan kontrak API tidak diduplikasi.
- `gasly-prd-to-uiux` menghasilkan prompt dan handoff untuk Google Stitch/Figma AI; skill tidak mengklaim mengoperasikan atau mengedit Stitch/Figma langsung tanpa integrasi.
- Integrasi Email/WhatsApp/AI harus merujuk handler yang ada di `src/gas/integrations.md`. Fonnte adalah gateway WhatsApp non-resmi; jelaskan risiko, consent, opt-out, dan rate limit.
- Migrasi database dan document-generation belum dipublikasikan sebagai skill/handler mandiri. Jangan menyebutnya tersedia hingga source, schema, dan tes implementasinya ditambahkan.
- Skill file adalah instruksi. Router tidak menjamin bahwa LLM dapat memanggil skill lain otomatis; ikuti kemampuan runtime dan lakukan handoff manual bila diperlukan.

## 3. Paket Distribusi

### Modular (`dist/modular/`) — paket utama

- `gasly-start/`: router dan core contracts.
- `gasly-prd/`: core contracts, design docs, dan `spec-digest.md`.
- `gasly-prd-to-uiux/`: core contracts, design tokens/presets/CSS, visual-analysis reference, dan template pratinjau.
- `gasly-pro-api/`: core contracts, GAS references, design docs, dan stack adapters.
- `gasly-data/`: core contracts dan GAS implementation references.
- `gasly-ui/`: core contracts, design system, CSS exports, dan stack adapters.
- `gasly-deploy-guide/`: core contracts, config, install steps, dan HTML guide template.
- `gasly-pro/`: legacy HtmlService references.

### Flat (`dist/flat/`) dan Flat-Lite (`dist/flat-lite/`)

- `dist/flat/gasly-prd/`: PRD skill dengan spec digest inline.
- `dist/flat/gasly-pro/`: legacy skill dengan knowledge base inline.
- `dist/flat-lite/gasly-pro/`: legacy skill tanpa boilerplates untuk batas konteks lebih kecil.

### Alias kompatibilitas

- `gasly-prompt` → `gasly-prd`.
- `gasly-install` → `gasly-deploy-guide`.

Alias hanya menjaga konfigurasi lama; semua pembaruan baru dilakukan pada skill kanonik.

## 4. Validasi

```bash
python build_skills.py
python tools/check_contrast.py
python -m unittest discover -s tests -v
TZ=Asia/Jakarta node tests/harness.js
TZ=Asia/Jakarta node tests/harness_gas.js
TZ=Asia/Jakarta node tests/harness_install.js
```

Runtime GAS tetap perlu diverifikasi terpisah sesuai checklist `VERIFY.md`.
