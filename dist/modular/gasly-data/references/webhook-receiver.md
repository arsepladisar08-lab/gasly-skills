<!-- KB_VERSION: 2.1.0 -->
# EXTERNAL PAYMENT WEBHOOK RECEIVER (`gas/webhook-receiver.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat secara kondisional oleh `gasly-data` ketika aplikasi menerima notifikasi status pembayaran/webhook eksternal.

## Daftar Isi
1. [Arsitektur Proxy Serverless ke Apps Script](#1-arsitektur-proxy-serverless-ke-apps-script)
2. [Boilerplate `webhook.gs` (Verifikasi Shared Secret Waktu Konstan & Update Status)](#2-boilerplate-webhookgs-verifikasi-shared-secret-waktu-konstan--update-status)

---

## 1. Arsitektur Proxy Serverless ke Apps Script

Penyedia pembayaran (seperti Midtrans, Xendit, atau Stripe) umumnya mengirim tanda tangan webhook di dalam HTTP Header (`X-Callback-Token` / `Stripe-Signature`) dan menolak pengalihan `HTTP 302` milik Google Apps Script.
- **Pola Arsitektur:** Gunakan satu fungsi serverless tipis (mis. Cloudflare Worker, Vercel Function, atau Netlify Function) yang menerima webhook asli, memverifikasi signature penyedia pembayaran menggunakan header HTTP, lalu meneruskan payload ke URL `/exec` Apps Script melalui `POST` (`text/plain;charset=utf-8` dengan `redirect: "follow"`) sambil menyertakan `sharedSecret` di dalam body JSON.

---

## 2. Boilerplate `webhook.gs` (Verifikasi Shared Secret Waktu Konstan & Update Status)

```javascript
// FILE: webhook.gs
// Runtime: Google Apps Script V8

/**
 * Handler: webhook.receive
 * Expects payload: { sharedSecret, entityId, newStatus, providerEventId }
 */
function handleWebhookReceive_(req) {
  var p = req.payload || {};
  var incomingSecret = String(p.sharedSecret || '');
  var expectedSecret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SHARED_SECRET') || '';

  if (!expectedSecret || !incomingSecret || !constantTimeEqual_(incomingSecret, expectedSecret)) {
    return createResponse_('error', null, 'Otorisasi webhook tidak sah.', 'FORBIDDEN');
  }

  var entityId = String(p.entityId || '').trim();
  var newStatus = String(p.newStatus || '').trim().toUpperCase();
  if (!entityId || ALLOWED_STATUSES.indexOf(newStatus) === -1) {
    return createResponse_('error', null, 'Parameter entityId atau newStatus pada webhook tidak valid.', 'VALIDATION_ERROR');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk.', 'LOCK_TIMEOUT');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('ITEMS');
    if (!sheet || sheet.getLastRow() <= 1) {
      return createResponse_('error', null, 'Tabel ITEMS tidak ditemukan.', 'NOT_FOUND');
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var idIdx = headers.indexOf('id');
    var statusIdx = headers.indexOf('status');
    var updatedIdx = headers.indexOf('updated_at');

    var targetRowNumber = -1;
    var existingRow = null;
    for (var r = 0; r < allData.length; r++) {
      if (String(allData[r][idIdx]) === entityId) {
        targetRowNumber = r + 2;
        existingRow = allData[r];
        break;
      }
    }

    if (targetRowNumber === -1) {
      return createResponse_('error', null, 'Transaksi dengan ID ' + entityId + ' tidak ditemukan.', 'NOT_FOUND');
    }

    var nowIso = formatIsoOffset_(new Date());
    if (statusIdx >= 0) existingRow[statusIdx] = newStatus;
    if (updatedIdx >= 0) existingRow[updatedIdx] = nowIso;

    sheet.getRange(targetRowNumber, 1, 1, lastCol).setValues([existingRow]);
    SpreadsheetApp.flush();

    return createResponse_(
      'success',
      { id: entityId, status: newStatus, updatedAt: nowIso },
      'Status transaksi berhasil diperbarui melalui webhook.',
      'OK'
    );
  } finally {
    lock.releaseLock();
  }
}
```