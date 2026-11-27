---
name: gasly-prd-to-uiux
description: >
  Menerjemahkan PRD dan/atau referensi gambar menjadi prompt wireframe/UIUX untuk Google Stitch atau Figma AI. Mendukung mode PRD-to-UIUX, Image-First Visual Analysis, dan PRD-plus-Image; menghasilkan design rationale, prompt per layar, DESIGN.md, serta UIUX handoff yang dapat dipakai saat implementasi GASLY.
---

# GASLY PRD TO UIUX — Visual Design & Handoff Architect
**KB_VERSION:** `{{KB_VERSION}}`

## Mode Audit (Read-Only)

Untuk audit visual/UX yang datang dengan status `AUDIT_READ_ONLY`, analisis artifact yang tersedia tanpa membuat atau menulis ulang `DESIGN.md`, prompt, handoff, maupun preview. Laporkan evidence dan temuan sesuai `references/contract.md` bagian 10, lalu **STOP** menunggu ID yang dipilih.

## 1. Tujuan dan Mode
Skill ini menerjemahkan kebutuhan produk menjadi arahan desain yang dapat dieksekusi. Jangan mengklaim mengoperasikan Stitch/Figma secara langsung kecuali integrasi yang sesuai benar-benar tersedia.

- **Mode A — PRD to UIUX:** membaca `PRD-Final.md`, mengidentifikasi surface, pengguna, alur, halaman, data, dan state; menghasilkan prompt desain.
- **Mode B — Image-First Visual Analysis:** menganalisis screenshot/referensi visual sebelum menulis prompt; dokumentasikan ciri yang terlihat dan hal yang belum diketahui.
- **Mode C — PRD + Image to UIUX (disarankan bila keduanya tersedia):** gunakan PRD sebagai sumber kebutuhan dan gambar sebagai sumber visual; jangan menebak fitur hanya dari gambar.

## 2. Referensi Wajib
| Referensi | Tujuan |
|---|---|
| `references/presets.md` | Memilih preset desain yang tersedia dan alasannya |
| `references/dials.md` | Mengkalibrasi DESIGN_VARIANCE, MOTION_INTENSITY, VISUAL_DENSITY |
| `references/tokens.schema.json` | Menjaga struktur token tetap kompatibel |
| `references/visual-analysis.md` | Checklist audit gambar dan missing information |
| `references/saas-craft.md` | Standar visual craft SaaS $49/bulan (App Shell, Bento KPI, ikon SVG, mobile card view) |

Gunakan preset kanonik `editorial-light`, `dense-dashboard`, `warm-friendly`, atau `aura` sesuai `presets.md`; jangan membuat palet pastel atau Soft Neo-Brutalist menjadi default universal. Gaya khusus deployment guide tetap menjadi keputusan milik `gasly-deploy-guide`, bukan aturan bagi semua aplikasi.

## 3. Alur Kerja
1. **Inventaris input:** identifikasi PRD, screenshot, batas platform, bahasa, target device, dan output yang diminta. Jika file penting hilang, nyatakan dampaknya; jangan mengarang isinya.
2. **Audit kebutuhan:** ekstrak daftar halaman, user journey, komponen, data yang ditampilkan, aksi, role, validation, dan state (initial/loading/empty/error/saving/success/recovery bila relevan).
3. **Analisis visual (jika gambar tersedia):** catat layout, hierarchy, grid, spacing, typography, palette, radius, elevation, iconography, imagery, density, responsive behavior, dan design personality. Pisahkan temuan visual dari inferensi.
4. **Pilih arah desain:** usulkan satu arah utama dan satu alternatif hanya bila membantu keputusan. Gunakan preset serta dials yang tersedia; jelaskan trade-off dengan bahasa sederhana.
5. **Buat prompt:** satu prompt global dan prompt per layar/screen, lengkap dengan viewport desktop/mobile, hierarchy, komponen, konten realistis dari PRD, interaksi, aksesibilitas, dan states.
6. **Sinkronisasi:** setelah user membawa hasil Stitch/Figma, bandingkan terhadap PRD dan design decision. Catat perubahan/pengecualian yang disetujui, jangan mengubah kebutuhan produk secara diam-diam.

## 4. Kontrak Output
Output minimum:
- `Prompt-Desain.md`: prompt global dan prompt per layar siap ditempel ke Google Stitch/Figma AI.
- `DESIGN.md`: art direction, design principles, selected preset, dials, type scale, spacing, component behavior, responsive rules, and accessibility constraints.
- `UIUX_HANDOFF.md`: peta screen-to-requirement, component inventory, interactions, data requirements, states, responsive notes, open questions, and acceptance checklist.

Output opsional: artifact HTML `Pratinjau-Gaya.html` yang membandingkan arah visual untuk membantu pengguna non-teknis. Gunakan template repository `templates/pratinjau-gaya.html` sebagai titik awal, isi seluruh placeholder dari PRD/arah visual yang dipilih, hapus placeholder yang tidak digunakan, dan pastikan artifact tetap self-contained. Isi harus berasal dari PRD; interaksi demo harus diberi label simulasi.

## 5. Token Contract
- Gunakan `references/tokens.schema.json` dan file preset JSON sebagai sumber kanonik untuk token yang sudah ada di repository.
- Jangan menjadikan `tokens.css` buatan bebas sebagai sumber kebenaran kedua. Bila implementasi membutuhkan CSS variables, hasilkan sebagai ekspor yang diturunkan dari token/preset kanonik dan dokumentasikan pemetaan token.
- Jangan mengklaim seluruh warna otomatis lulus WCAG AA hanya berdasarkan penilaian visual. Jalankan `tools/check_contrast.py` atau validator yang sesuai untuk pasangan foreground/background dan status states.
- Stitch/Figma adalah referensi layout/visual. Perubahan nilai token harus dicatat dalam `DESIGN.md` dan disinkronkan ke sumber kanonik sebelum implementasi.

## 6. Anti-Slop Berbasis Konteks
- Hindari layout, komponen, dan copy generik yang tidak punya dasar di PRD.
- Jangan melarang gradient, glass, ilustrasi, animasi, atau pola layout secara mutlak bila gaya yang disetujui memang memerlukannya; ukurannya harus konsisten dengan art direction, aksesibilitas, performa, dan konteks produk.
- Jangan membuat logo klien, testimoni, angka penggunaan, rating, maupun klaim bisnis fiktif. Foto/video suasana atau katalog contoh dari stock publik (Unsplash, Pexels, Pixabay, Coverr/Mixkit) diperbolehkan sesuai `Gate W-10` selama diberi label placeholder yang jelas dan tidak disamarkan sebagai bukti pelanggan nyata.
- Gunakan konten konkret yang tersedia di PRD. Untuk konten yang belum diketahui, gunakan label data contoh yang jelas atau minta input.

## 7. Definition of Done
- [ ] Semua screen dan alur utama traceable ke PRD.
- [ ] Referensi visual dibedakan antara observasi dan asumsi.
- [ ] Prompt per screen menyebut hierarchy, komponen, interaksi, state, mobile/desktop, dan aksesibilitas yang relevan.
- [ ] Design tokens merujuk sumber kanonik repository.
- [ ] `DESIGN.md` dan `UIUX_HANDOFF.md` konsisten dengan prompt desain.
- [ ] Tidak ada fitur atau klaim fiktif.