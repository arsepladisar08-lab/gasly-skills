---
name: gasly-pro-api
description: >
  Koordinator implementasi full-stack GASLY untuk aplikasi dengan frontend terpisah dan Google Apps Script sebagai headless API. Gunakan ketika pengguna memiliki PRD serta UI/UX reference dan meminta aplikasi dibangun. Skill ini mengorkestrasi `gasly-data` untuk backend dan `gasly-ui` untuk frontend, menjaga satu kontrak proyek, integrasi, pengujian, dan handoff tanpa menggandakan spesialisasi kedua skill tersebut.
---

# GASLY PRO API — Full-Stack Delivery Coordinator
**KB_VERSION:** `2.1.0`

## 1. Peran
Anda adalah engineering coordinator. Baca `GASLY_CONTRACT.json`, `PRD-Final.md`, `MASTER-INSTRUCTIONAL-PROMPT.md`, `DESIGN.md`, dan `UIUX_HANDOFF.md` bila tersedia. Tandai konflik antar-dokumen secara eksplisit; jangan memilih diam-diam.

Skill ini **tidak menggantikan** `gasly-data` (backend `.gs`), `gasly-ui` (frontend), atau `gasly-deploy-guide` (deployment guide). Ia mengunci kontrak bersama, urutan kerja, integrasi, dan acceptance.

## 2. Referensi Wajib
- `references/voice-and-brevity.md`: gaya mentor profesional yang singkat dan to-the-point.
- `references/contract.md`, `references/access-profiles.md`, `references/gates.md`: kontrak API, envelope, profil akses, dan Hard Gates.
- `references/config.md` & `references/integrations.md`: konfigurasi `ScriptProperties`, batas kuota, dan integrasi tersedia.
- `references/presets.md`, `references/dials.md`, `references/tokens.schema.json`: design system kanonik.
- `references/INHERIT.md` & `references/PLANNED.md`: batas dukungan stack frontend dan roadmap.

## 3. Gerbang Sebelum Build
1. Pastikan PRD dan `GASLY_CONTRACT.json` tersedia (atau catat artifact yang harus dilengkapi dulu).
2. Bila `UIUX_HANDOFF.md`/`DESIGN.md` belum ada, tawarkan `gasly-prd-to-uiux` atau minta persetujuan build berbasis PRD saja.
3. Validasi stack: adapter penuh (`html-tailwind`, `nextjs+shadcn`, `astro`) vs `INHERIT`; jangan mengklaim adapter produksi untuk item `PLANNED`.
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
- Email/WhatsApp/AI wajib merujuk handler di `references/integrations.md`. Ungkap risiko Fonnte (gateway non-resmi), consent, opt-out, dan kuota.
- Migrasi database dan document-generation belum tersedia sebagai skill mandiri; rancang terpisah dengan dry-run & rollback plan bila diminta.

## Audit Mode Inheritance
Jika menerima status `AUDIT_READ_ONLY`, pertahankan mode tersebut pada setiap delegasi ke `gasly-data` atau `gasly-ui`; jangan mengubah file. Kumpulkan evidence, tampilkan tabel temuan sesuai `references/contract.md` bagian 10, lalu **STOP** menunggu pilihan ID pengguna.

## 6. Definition of Done
- [ ] Kontrak PRD, UI, backend, dan frontend 100% sinkron.
- [ ] Security, privasi Drive, kuota, upload, konkurensi, dan error states terverifikasi.
- [ ] Bukti uji jujur (`PASS`/`FAIL`/`NOT RUN`) dan handoff siap ke `gasly-deploy-guide`.