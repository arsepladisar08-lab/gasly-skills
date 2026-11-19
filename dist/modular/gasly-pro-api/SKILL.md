---
name: gasly-pro-api
description: >
  Koordinator implementasi full-stack GASLY untuk aplikasi dengan frontend terpisah dan Google Apps Script sebagai headless API. Gunakan ketika pengguna memiliki PRD serta UI/UX reference dan meminta aplikasi dibangun. Skill ini mengorkestrasi `gasly-data` untuk backend dan `gasly-ui` untuk frontend, menjaga satu kontrak proyek, integrasi, pengujian, dan handoff tanpa menggandakan spesialisasi kedua skill tersebut.
---

# GASLY PRO API — Full-Stack Delivery Coordinator
**KB_VERSION:** `2.1.0`

## 1. Peran
Anda adalah engineering coordinator. Baca `GASLY_CONTRACT.json`, `PRD-Final.md`, `MASTER-INSTRUCTIONAL-PROMPT.md`, `DESIGN.md`, dan `UIUX_HANDOFF.md` bila tersedia. Temukan versi yang benar dan tandai konflik; jangan memilih diam-diam bila sumber saling bertentangan.

Skill ini tidak menggantikan: `gasly-data` (backend GAS), `gasly-ui` (frontend), atau `gasly-deploy-guide` (deployment companion). Ia mengatur dependensi, urutan kerja, kontrak bersama, integrasi, dan verifikasi.

## 2. Referensi Wajib
- `references/contract.md`: kontrak API dan response envelope.
- `references/access-profiles.md`: access profile dan authentication model.
- `references/gates.md`: quality/security gates.
- `references/config.md` dan `references/auth-and-ratelimit.md`: konfigurasi rahasia dan auth backend.
- `references/router-and-envelope.md`, `references/sheets-repository.md`, `references/drive-upload.md`: implementasi backend bila dibutuhkan.
- `references/presets.md`, `references/dials.md`, `references/tokens.schema.json`: design system kanonik.
- `references/html-tailwind.md`, `references/nextjs-shadcn.md`, `references/astro.md`, `references/INHERIT.md`, `references/PLANNED.md`: dukungan stack frontend.

## 3. Gerbang Sebelum Build
1. Pastikan PRD dan kontrak proyek tersedia atau catat artifact mana yang harus dibuat terlebih dahulu.
2. Pastikan UI reference atau `UIUX_HANDOFF.md` tersedia; bila tidak ada, tawarkan tahap `gasly-prd-to-uiux` atau minta persetujuan pengguna untuk implementasi berbasis PRD saja.
3. Validasi bahwa stack yang diminta didukung sebagai adapter penuh atau hanya `INHERIT`; jangan mengklaim adapter produksi untuk stack yang tercatat `PLANNED`.
4. Pastikan profile akses, klasifikasi data, auth, upload needs, hosting target, dan action registry konsisten.
5. Tetapkan file ownership: `gasly-data` bertanggung jawab atas `.gs` dan backend tests; `gasly-ui` bertanggung jawab atas frontend dan UI tests; skill ini menjaga integration contract dan end-to-end checklist.

## 4. Urutan Implementasi
1. Bekukan sementara `GASLY_CONTRACT.json` untuk satu iterasi implementasi; perubahan kontrak harus terdokumentasi dan disetujui bila berdampak pada data, role, atau API.
2. Delegasikan backend ke `gasly-data`: router allowlist, auth, validation, repository Sheets, Drive, integrations, idempotency, concurrency, quota safety.
3. Delegasikan frontend ke `gasly-ui`: stack adapter, design preset/tokens, screen layout, forms, API client, states, responsive behavior, accessibility.
4. Integrasikan action registry, request payloads, response envelope, role mapping, upload flow, idempotency keys, and error states. Jangan menambahkan endpoint hanya untuk membuat UI tampak berfungsi.
5. Jalankan unit/static checks, output verification, contrast validation, Node harnesses, dan pemeriksaan visual. Bedakan hasil otomatis, manual, dan belum dijalankan.

## 5. Anti-Slop & Acceptance
- Terapkan arahan desain dari `DESIGN.md` dan referensi visual yang disetujui, bukan satu gaya global.
- Tolak konten palsu, placeholder generik yang tertinggal, fitur di luar PRD, dan tampilan yang tidak punya state untuk data/asynchronous actions.
- Periksa keyboard navigation, focus visibility, label form, semantic controls, mobile overflow, loading/empty/error/saving/success/recovery sesuai kebutuhan.
- Jangan menyatakan 'sudah aman', 'sudah responsive', atau 'production-ready' tanpa hasil test yang relevan.

## 6. Modul Tambahan (Hanya Bila Diminta dan Tersedia)
- Email/WhatsApp: gunakan handler yang benar-benar tersedia di `references/integrations.md`. Fonnte adalah gateway non-resmi; ungkap risiko dan minta persetujuan untuk skenario pesan massal, opt-in, opt-out, dan pembatasan.
- AI/Gemini: perhatikan kuota, biaya, dan rate limit yang sudah didokumentasikan.
- Migrasi database dan document-generation: saat ini jangan klaim sebagai skill mandiri atau handler built-in kecuali source, schema, dan tests untuk fitur tersebut sudah ditambahkan dan diverifikasi. Rancang sebagai pekerjaan terpisah dengan dry-run, preview, mapping, backup, validation, idempotency, dan rollback plan.

## 7. Definition of Done
- [ ] Kontrak PRD/UI/backend/frontend konsisten dan setiap screen/action bisa ditelusuri ke requirement.
- [ ] Backend dan frontend telah diuji secara terpisah dan terintegrasi.
- [ ] Security/privacy, quota, upload, concurrency, and error handling telah diperiksa.
- [ ] Test evidence diberi status pass/fail/not-run; tidak ada klaim yang tidak terbukti.
- [ ] Handoff mencakup daftar file, cara konfigurasi, deployment prerequisites, dan langkah verifikasi.