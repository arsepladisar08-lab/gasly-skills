
# DapurSaji — Backend Verification

**Runtime:** Google Apps Script V8  
**GASLY KB:** 2.1.0  
**Contract:** 1.0.0  
**Access Profile:** P3  
**Architecture:** TIER_1_DECOUPLED_WORKSPACE  
**Frontend:** HTML + Tailwind  
**Hosting:** Cloudflare Pages

## 1. Status

NOT RUN — kode belum dieksekusi di runtime Google Apps Script.

Perintah pemeriksaan lokal:

```bash
python3 tools/verify_output.py
```

Pemeriksaan sintaks lokal tambahan dapat dilakukan menggunakan parser JavaScript yang kompatibel dengan ECMAScript V8.

## 2. File proyek

| File | Fungsi |
|---|---|
| setup.gs | Inisialisasi database, schema, seed, secret, kredensial admin |
| code.gs | HTTP router, authentication, rate limiting, Sheets, Drive |
| VERIFY.md | Checklist dan prosedur verifikasi |

## 3. Hard Gates

| Gate | Persyaratan | Implementasi |
|---|---|---|
| U-01 | Tidak ada secret frontend | ScriptProperties |
| U-02 | Otorisasi server-side | Central Action Registry |
| U-04 | Canonical envelope | createResponse_ |
| U-07 | Number dan ISO offset | sanitizeForClient_ |
| U-10 | Bukti transfer private | DriveApp.Access.PRIVATE |
| G-01 | GAS V8 dan CSPRNG | Utilities.getUuid |
| G-02 | Timezone sinkron | setSpreadsheetTimeZone |
| G-03 | Lock dan flush | LockService |
| G-04 | ID harian maxSeq + 1 | generateNextId_ |
| G-05 | Batch I/O | getValues/setValues |
| G-06 | Soft-delete | deleted_at |
| G-07 | Formula injection | escapeFormula_ |
| G-08 | Internal helper underscore | Diterapkan |
| G-09 | Validasi upload | MIME, magic bytes, ukuran, rollback |
| G-10 | Anti-enumeration | tracking_token_hash, constantTimeEqual_ |
| G-12 | Object-based seed | buildRowFromObject_ |

## 4. Pemeriksaan database

Setelah menjalankan setupAppEnvironment():

- [ ] Sheet ORDERS tersedia.
- [ ] Sheet ORDER_ITEMS tersedia.
- [ ] Sheet CATALOG tersedia.
- [ ] Semua header kontrak tersedia.
- [ ] Kolom upload_nonce tersedia pada ORDERS.
- [ ] Terdapat tepat 16 paket seed ketika katalog masih kosong.
- [ ] Spreadsheet timezone sama dengan Script timezone.
- [ ] AUTH_HMAC_SECRET tersedia.
- [ ] AUTH_PEPPER tersedia.
- [ ] ADMIN_PASSPHRASE_HASH tersedia.
- [ ] ADMIN_PIN_HASH tersedia.
- [ ] DRIVE_ROOT_FOLDER_ID tersedia.
- [ ] ACCESS_PROFILE bernilai P3.

## 5. Pemeriksaan kredensial

1. Buka Apps Script Project Settings.
2. Tambahkan Script Properties:
   - ADMIN_PASSPHRASE_INIT
   - ADMIN_PIN_INIT
3. Isi passphrase minimal 12 karakter.
4. Isi PIN tepat 6 digit.
5. Jalankan setupAdminCredentials().
6. Pastikan kedua properti sementara terhapus.
7. Pastikan hash passphrase dan PIN tersedia.
8. Pastikan tidak ada plaintext kredensial di Sheet atau source code.

## 6. Pemeriksaan API

Format POST:

```json
{
  "action": "catalog.list",
  "v": 1,
  "auth": null,
  "idem": null,
  "payload": {}
}
```

Gunakan Content-Type:

```text
text/plain;charset=utf-8
```

### Action Registry Manifest

| Action | Role | Method | Idempotency |
|---|---|---|---|
| catalog.list | PUBLIC | GET/POST | Tidak |
| order.create | PUBLIC | POST | Wajib |
| order.track | PUBLIC | POST | Tidak |
| file.ticket | PUBLIC | POST | Wajib |
| file.upload | PUBLIC | POST | Wajib |
| auth.login | PUBLIC | POST | Tidak |
| auth.logout | ADMIN | POST | Tidak |
| order.adminList | ADMIN | POST | Tidak |
| order.updateStatus | ADMIN | POST | Wajib |
| file.adminView | ADMIN | POST | Tidak |
| catalog.save | ADMIN | POST | Wajib |

## 7. Pengujian keamanan upload

- [ ] Upload hanya menerima ORDERS.
- [ ] file.ticket memerlukan entity.
- [ ] file.ticket memerlukan entityId.
- [ ] file.ticket memerlukan uploadNonce.
- [ ] Nonce harus cocok dengan record.
- [ ] Record harus berumur maksimal 15 menit.
- [ ] Tiket berlaku 5 menit.
- [ ] Tiket terikat pada satu pesanan.
- [ ] Tiket dikonsumsi satu kali.
- [ ] MIME harus JPEG, PNG, atau WebP.
- [ ] Magic bytes harus cocok.
- [ ] Ukuran file maksimal 5 MB.
- [ ] File disimpan di ROOT/ORDERS/yyyy-MM.
- [ ] File menggunakan DriveApp.Access.PRIVATE.
- [ ] File menggunakan DriveApp.Permission.NONE.
- [ ] Kegagalan penulisan Sheet memicu rollback file Drive.
- [ ] Upload publik tidak dapat mengganti bukti transfer sebelumnya.

## 8. Pengujian anti-enumeration

- [ ] Order.create menerbitkan tracking token.
- [ ] Sheet menyimpan tracking_token_hash.
- [ ] Token asli hanya dikembalikan pada respons create.
- [ ] Order.track memerlukan order_id dan tracking_token.
- [ ] Perbandingan menggunakan constantTimeEqual_.
- [ ] Lima kegagalan pelacakan memicu pembatasan per tiket.
- [ ] Batas global pelacakan 30 permintaan per menit.
- [ ] Tracking token tidak diekspos melalui order.adminList.

## 9. Pengujian concurrency dan idempotency

- [ ] Dua pembuatan pesanan bersamaan.
- [ ] Dua perubahan status dengan expected_updated_at yang sama.
- [ ] Perubahan kedua harus menerima CONFLICT.
- [ ] Penggunaan idempotency key berulang.
- [ ] Pengujian file upload dengan retry jaringan.
- [ ] Pengujian lock timeout.
- [ ] Pengujian pemulihan ketika penulisan Sheet gagal.

**Catatan penting:** CacheService bersifat best-effort dan bukan penyimpanan transaksi atomik. Implementasi saat ini menyimpan respons idempotensi melalui dispatcher setelah handler selesai. Pemeriksaan ulang idempotensi di dalam lock dan penyimpanan respons sukses sebelum lock dilepas masih harus diselesaikan sebelum menyatakan G-03 dan mekanisme idempotensi sepenuhnya lulus.

## 10. Deployment

1. Jalankan setupAppEnvironment().
2. Pastikan status READY_TO_DEPLOY.
3. Buka Deploy > New deployment.
4. Pilih Web app.
5. Execute as: Me.
6. Who has access: Anyone.
7. Simpan URL /exec untuk frontend Cloudflare Pages.

Pembaruan berikutnya:

Deploy > Manage deployments > Edit > New version > Deploy.

Jangan membuat deployment baru untuk pembaruan rutin karena URL /exec harus tetap sama.

## 11. Batasan implementasi yang harus diselesaikan sebelum produksi

1. Idempotency double-check di dalam lock belum lengkap.
2. CacheService rate limit merupakan best-effort, bukan proteksi brute-force atomik.
3. Login menggunakan passphrase admin; Google authentication tidak diaktifkan.
4. Validasi tanggal pengiriman perlu diperketat dengan aturan kalender dan zona waktu bisnis.
5. Perlu pengujian integrasi aktual terhadap izin Drive dan rollback.
6. Perlu pengujian konkurensi multi-request pada deployment Web App.
7. Penggunaan SHA-256 iteratif 2.000 putaran bukan pengganti KDF memory-hard seperti Argon2id.

**Keputusan:** Belum dinyatakan production-ready sampai pemeriksaan yang belum lulus diselesaikan dan diverifikasi pada runtime target.
