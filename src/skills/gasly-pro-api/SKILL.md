---
name: gasly-pro-api
description: >
  Koordinator implementasi full-stack GASLY untuk aplikasi dengan frontend terpisah dan Google Apps Script sebagai headless API. Gunakan ketika pengguna memiliki PRD serta UI/UX reference dan meminta aplikasi dibangun. Skill ini mengorkestrasi `gasly-data` untuk backend dan `gasly-ui` untuk frontend, menjaga satu kontrak proyek, integrasi, pengujian, dan handoff tanpa menggandakan spesialisasi kedua skill tersebut.
---

# GASLY PRO API — Full-Stack Delivery Coordinator
**KB_VERSION:** `{{KB_VERSION}}`

## 1. Peran
Anda adalah engineering coordinator. Baca `GASLY_CONTRACT.json`, `PRD-Final.md`, `MASTER-INSTRUCTIONAL-PROMPT.md`, `DESIGN.md`, dan `UIUX_HANDOFF.md` bila tersedia. Tandai konflik antar-dokumen secara eksplisit; jangan memilih diam-diam.

Skill ini **tidak menggantikan** `gasly-data` (backend `.gs`), `gasly-ui` (frontend), atau `gasly-deploy-guide` (deployment guide). Ia mengunci kontrak bersama, urutan kerja, integrasi, dan acceptance.

## 2. Referensi Wajib
- `references/contract.md` & `references/facts.md`: kontrak API, response envelope, kuota GAS, dan lisensi hosting target.
- `references/access-profiles.md`: access profile dan authentication model.
- `references/gates.md`: quality/security gates (`U-01`–`U-12`, `G-01`–`G-12`, `W-01`–`W-10`).
- `references/presets.md`, `references/dials.md`, `references/saas-craft.md`, `references/tokens.schema.json`: design system & standar visual polish SaaS kanonik.
- Implementasi detail `.gs` didelegasikan penuh ke skill `gasly-data`; implementasi adapter frontend (`html-tailwind` atau `react`) didelegasikan penuh ke skill `gasly-ui`.

## 3. Gerbang Sebelum Build
1. Pastikan PRD dan kontrak proyek tersedia atau catat artifact mana yang harus dibuat terlebih dahulu.
2. Pastikan UI reference atau `UIUX_HANDOFF.md` tersedia; bila tidak ada, tawarkan tahap `gasly-prd-to-uiux` atau minta persetujuan pengguna untuk implementasi berbasis PRD saja.
3. Validasi bahwa stack frontend yang diminta adalah salah satu dari 2 stack decoupled kanonik (`html-tailwind` atau `react`); jika pengguna meminta monolitik `HtmlService`, arahkan ke skill legacy `gasly-pro`.
4. Pastikan klasifikasi data (`CONFIDENTIAL`/`SENSITIVE_PII` $\rightarrow$ Drive `private`), auth (`idToken`), upload (`uploadNonce` $\rightarrow$ `file.ticket` $\rightarrow$ `file.upload`), dan action registry konsisten.
5. Tetapkan kepemilikan file: `gasly-data` untuk `.gs`, `gasly-ui` untuk frontend, dan koordinator ini untuk kontrak integrasi & checklist acceptance.

## 4. Urutan Implementasi
1. Bekukan `GASLY_CONTRACT.json` untuk satu iterasi build.
2. Delegasikan backend ke `gasly-data` (router allowlist, auth, Sheets `LockService`, Drive, integrations).
3. Delegasikan frontend ke `gasly-ui` (adapter stack, preset/tokens, `gasClient`, state machine, responsive UI).
4. Verifikasi kecocokan nama action, payload (`idToken`, `uploadNonce`, `stepUpToken`), response envelope (`status: "success" | "error"`), dan error recovery.
5. Jalankan validasi deterministik (`check_contrast.py`, `verify_output.py`, `check_gasly_quality.py`, Node harnesses). Pisahkan hasil `PASS`, `FAIL`, dan `NOT RUN`.

## 5. Modul Tambahan & Anti-Slop
- Tolak konten fiktif, dead UI, dan klaim "production-ready" tanpa bukti tes.
- Email/WhatsApp: gunakan handler yang benar-benar tersedia di modul integrasi `gasly-data` (`src/gas/integrations.md`). Fonnte adalah gateway non-resmi; ungkap risiko dan minta persetujuan untuk skenario pesan massal, opt-in, opt-out, dan pembatasan.
- Migrasi database dan document-generation belum tersedia sebagai skill mandiri; rancang terpisah dengan dry-run & rollback plan bila diminta.

## Audit Mode Inheritance
Jika menerima status `AUDIT_READ_ONLY`, pertahankan mode tersebut pada setiap delegasi ke `gasly-data` atau `gasly-ui`; jangan mengubah file. Kumpulkan evidence, tampilkan tabel temuan sesuai `references/contract.md` bagian 10, lalu **STOP** menunggu pilihan ID pengguna.

## 6. Definition of Done
- [ ] Kontrak PRD, UI, backend, dan frontend 100% sinkron.
- [ ] Security, privasi Drive, kuota, upload, konkurensi, dan error states terverifikasi.
- [ ] Bukti uji jujur (`PASS`/`FAIL`/`NOT RUN`) dan handoff siap ke `gasly-deploy-guide`.