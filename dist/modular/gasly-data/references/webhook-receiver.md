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

  var providerEventId = String(p.providerEventId || '').trim();
  var cache = CacheService.getScriptCache();
  var dedupKey = providerEventId ? 'idem:webhook:' + providerEventId.slice(0, 120) : '';

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk.', 'LOCK_TIMEOUT');
  }

  try {
    if (dedupKey) {
      var cachedRaw = cache.get(dedupKey);
      if (cachedRaw) {
        var cachedRes = JSON.parse(cachedRaw);
        cachedRes.meta = cachedRes.meta || {};
        cachedRes.meta.idempotentReplay = true;
        return cachedRes;
      }
    }

    var ss = getAppSpreadsheet_(false);
    var isSubscriptionTarget =
      String(p.targetEntity || '').trim().toUpperCase() === 'SUBSCRIPTIONS' ||
      entityId.indexOf('SUB-') === 0 ||
      entityId.indexOf('INV-') === 0;

    if (isSubscriptionTarget) {
      var subsSheet = ss.getSheetByName('SUBSCRIPTIONS');
      if (!subsSheet || subsSheet.getLastRow() <= 1) {
        return createResponse_('error', null, 'Tabel SUBSCRIPTIONS tidak ditemukan.', 'NOT_FOUND');
      }
      var subLastRow = subsSheet.getLastRow();
      var subLastCol = subsSheet.getLastColumn();
      var subData = subsSheet.getRange(2, 1, subLastRow - 1, subLastCol).getValues();
      var subHeaders = subsSheet.getRange(1, 1, 1, subLastCol).getValues()[0].map(normalizeHeader_);
      var subIdIdx = subHeaders.indexOf('id');
      var invIdIdx = subHeaders.indexOf('external_invoice_id');
      var subStatusIdx = subHeaders.indexOf('status');
      var pStartIdx = subHeaders.indexOf('period_start');
      var pEndIdx = subHeaders.indexOf('period_end');
      var evIdIdx = subHeaders.indexOf('provider_event_id');
      var subUpdIdx = subHeaders.indexOf('updated_at');

      var subRowNum = -1;
      var subRow = null;
      for (var s = 0; s < subData.length; s++) {
        var rId = subIdIdx >= 0 ? String(subData[s][subIdIdx]) : '';
        var rInv = invIdIdx >= 0 ? String(subData[s][invIdIdx]) : '';
        if (rId === entityId || rInv === entityId) {
          subRowNum = s + 2;
          subRow = subData[s];
          break;
        }
      }
      if (subRowNum === -1) {
        return createResponse_('error', null, 'Langganan dengan ID/Invoice ' + entityId + ' tidak ditemukan.', 'NOT_FOUND');
      }

      var nowObj = new Date();
      var nowSubIso = formatIsoOffset_(nowObj);
      var effectiveSubStatus = newStatus === 'COMPLETED' ? 'ACTIVE' : newStatus;
      if (subStatusIdx >= 0) subRow[subStatusIdx] = effectiveSubStatus;
      if (evIdIdx >= 0 && providerEventId) subRow[evIdIdx] = escapeFormula_(providerEventId);
      if (subUpdIdx >= 0) subRow[subUpdIdx] = nowSubIso;

      var periodStartIso = pStartIdx >= 0 ? String(subRow[pStartIdx] || '') : '';
      var periodEndIso = pEndIdx >= 0 ? String(subRow[pEndIdx] || '') : '';
      if (effectiveSubStatus === 'ACTIVE') {
        periodStartIso = nowSubIso;
        periodEndIso = formatIsoOffset_(new Date(nowObj.getTime() + 30 * 86400000));
        if (pStartIdx >= 0) subRow[pStartIdx] = periodStartIso;
        if (pEndIdx >= 0) subRow[pEndIdx] = periodEndIso;
      }

      subsSheet.getRange(subRowNum, 1, 1, subLastCol).setValues([subRow]);
      SpreadsheetApp.flush();

      var subRes = createResponse_(
        'success',
        {
          id: subIdIdx >= 0 ? subRow[subIdIdx] : entityId,
          externalInvoiceId: invIdIdx >= 0 ? subRow[invIdIdx] : '',
          status: effectiveSubStatus,
          periodStart: periodStartIso,
          periodEnd: periodEndIso,
          updatedAt: nowSubIso
        },
        'Status langganan berhasil diperbarui melalui webhook.',
        'OK'
      );
      if (dedupKey) {
        cache.put(dedupKey, JSON.stringify(subRes), 21600);
      }
      return subRes;
    }

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

    var response = createResponse_(
      'success',
      { id: entityId, status: newStatus, updatedAt: nowIso },
      'Status transaksi berhasil diperbarui melalui webhook.',
      'OK'
    );
    if (dedupKey) {
      cache.put(dedupKey, JSON.stringify(response), 21600);
    }
    return response;
  } finally {
    lock.releaseLock();
  }
}