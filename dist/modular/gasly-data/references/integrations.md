<!-- KB_VERSION: 2.1.0 -->
# OUTBOUND INTEGRATIONS, MAIL QUOTA GUARD & OUTBOX QUEUE (`gas/integrations.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat secara kondisional oleh `gasly-data` ketika aplikasi membutuhkan pengiriman email (`MailApp`), WhatsApp Gateway (Fonnte), AI (Gemini), atau antrean tugas latar belakang (`JOBS_OUTBOX`).

## Daftar Isi
1. [Batas Runtime `UrlFetchApp`, Circuit Breaker & `JOBS_OUTBOX`](#1-batas-runtime-urlfetchapp-circuit-breaker--jobs_outbox)
2. [Aturan Kuota `MailApp` & Guard Pengiriman Email](#2-aturan-kuota-mailapp--guard-pengiriman-email)
3. [Boilerplate `integrations.gs` (Breaker, MailApp, Fonnte, Gemini & Outbox)](#3-boilerplate-integrationsgs-breaker-mailapp-fonnte-gemini--outbox)

---

## 1. Batas Runtime `UrlFetchApp`, Circuit Breaker & `JOBS_OUTBOX`

1. **Tidak Ada Opsi `timeout` pada `UrlFetchApp.fetch(url, params)`:**
   - Runtime Google Apps Script V8 tidak menyediakan parameter `timeout` yang dapat dikonfigurasi pada `UrlFetchApp.fetch()`. Batas waktu tunggu dikendalikan oleh infrastruktur Google (sekitar ~60 detik per permintaan HTTP, di dalam batas total eksekusi skrip **6 menit** sesuai `facts.md`).
   - Selalu sertakan `muteHttpExceptions: true` agar respons HTTP `4xx`/`5xx` tidak melempar *uncaught exception*.
2. **Circuit Breaker di `CacheService` & Retry Backoff:**
   - Karena Web App berbagi batas **30 eksekusi simultan** (`facts.md`), kegagalan beruntun pada API pihak ketiga tidak boleh terus menahan eksekusi.
   - Jika layanan eksternal gagal `5xx` atau jaringan sebanyak 3 kali berturut-turut, buka sirkuit di `CacheService` (`cb:open:<serviceName>`, TTL `120` detik) dan segera tolak panggilan berikutnya atau alihkan ke `JOBS_OUTBOX`.
3. **Antrean Latar Belakang (`JOBS_OUTBOX`):**
   - Untuk pengiriman notifikasi yang tidak perlu ditunggu secara sinkron oleh browser, catat tugas ke sheet `JOBS_OUTBOX` (`id`, `created_at`, `updated_at`, `job_type`, `payload_json`, `status`, `attempts`, `last_error`, `is_seed`) menggunakan `buildRowFromObject_` dan proses melalui *time-driven trigger* (`processJobsOutboxQueue_`).

---

## 2. Aturan Kuota `MailApp` & Guard Pengiriman Email

Sesuai `facts.md`, kuota `MailApp` adalah **100 penerima/hari** (akun `@gmail.com` konsumen) dan **1.500 penerima/hari** (akun Google Workspace):
- Dilarang menjadikan email OTP sebagai jalur login utama publik.
- Sebelum memanggil `MailApp.sendEmail()`, wajib memeriksa `MailApp.getRemainingDailyQuota()`. Sisakan cadangan minimal `5` kuota harian agar skrip tidak gagal di tengah transaksi.

---

## 3. Boilerplate `integrations.gs` (Breaker, MailApp, Fonnte, Gemini & Outbox)

```javascript
// FILE: integrations.gs
// Runtime: Google Apps Script V8

var TRANSIENT_HTTP_CODES_ = [429, 502, 503, 504];

/**
 * Wrapper UrlFetchApp dengan Circuit Breaker CacheService dan Retry Backoff.
 * Catatan Runtime: UrlFetchApp tidak memiliki parameter timeout kustom (~60 detik batas platform).
 */
function fetchExternalWithBreaker_(serviceName, url, fetchOptions, maxRetries) {
  var cache = CacheService.getScriptCache();
  var openKey = 'cb:open:' + serviceName;
  var failKey = 'cb:fail:' + serviceName;

  if (cache.get(openKey)) {
    return {
      ok: false,
      status: 503,
      bodyText: '',
      errorMessage: 'Layanan eksternal (' + serviceName + ') sedang jeda pemulihan (circuit open).'
    };
  }

  var retries = maxRetries !== undefined && maxRetries !== null && !isNaN(Number(maxRetries)) ? Math.min(2, Math.max(0, Number(maxRetries))) : 1;
  var opts = fetchOptions || {};
  opts.muteHttpExceptions = true;

  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      var res = UrlFetchApp.fetch(url, opts);
      var code = res.getResponseCode();
      var text = res.getContentText();

      if (code >= 200 && code < 300) {
        cache.remove(failKey);
        return { ok: true, status: code, bodyText: text, errorMessage: null };
      }

      if (TRANSIENT_HTTP_CODES_.indexOf(code) !== -1 && attempt < retries) {
        Utilities.sleep(400 * Math.pow(2, attempt));
        continue;
      }

      if (code >= 500) {
        var fails = Number(cache.get(failKey) || 0) + 1;
        cache.put(failKey, String(fails), 300);
        if (fails >= 3) {
          cache.put(openKey, '1', 120);
        }
      }

      return {
        ok: false,
        status: code,
        bodyText: text,
        errorMessage: 'Panggilan ' + serviceName + ' gagal dengan kode HTTP ' + code + '.'
      };
    } catch (err) {
      var netFails = Number(cache.get(failKey) || 0) + 1;
      cache.put(failKey, String(netFails), 300);
      if (netFails >= 3) {
        cache.put(openKey, '1', 120);
      }
      if (attempt < retries) {
        Utilities.sleep(400 * Math.pow(2, attempt));
        continue;
      }
      return {
        ok: false,
        status: 0,
        bodyText: '',
        errorMessage: 'Gagal menghubungi layanan eksternal ' + serviceName + '.'
      };
    }
  }
}

/**
 * Helper internal & Handler: mail.send (Dengan Quota Guard sesuai facts.md)
 */
function sendEmailWithQuotaGuard_(recipient, subject, htmlBody) {
  var cleanRecipient = String(recipient || '').trim();
  if (!cleanRecipient || cleanRecipient.indexOf('@') === -1) {
    return { sent: false, code: 'VALIDATION_ERROR', remainingQuota: 0, message: 'Alamat email tujuan tidak valid.' };
  }
  var remaining = MailApp.getRemainingDailyQuota();
  if (remaining <= 5) {
    return {
      sent: false,
      code: 'RATE_LIMITED',
      remainingQuota: remaining,
      message: 'Kuota email harian mendekati batas aman (' + remaining + ' tersisa). Pengiriman ditahan.'
    };
  }
  MailApp.sendEmail({
    to: cleanRecipient,
    subject: String(subject || 'Notifikasi Aplikasi').slice(0, 180),
    htmlBody: String(htmlBody || '')
  });
  return { sent: true, code: 'OK', remainingQuota: remaining - 1, message: 'Email berhasil dikirim.' };
}

function handleMailSend_(req) {
  var p = req.payload || {};
  var result = sendEmailWithQuotaGuard_(p.to, p.subject, p.htmlBody);
  if (!result.sent) {
    return createResponse_('error', { remainingQuota: result.remainingQuota }, result.message, result.code);
  }
  return createResponse_('success', { sent: true, remainingQuota: result.remainingQuota }, result.message, 'OK');
}

/**
 * Handler: notify.whatsapp (Fonnte Gateway via ScriptProperties + Fallback wa.me)
 */
function handleNotifyWhatsapp_(req) {
  var p = req.payload || {};
  var targetPhone = String(p.target || p.phone || '').replace(/[^0-9]/g, '');
  var messageText = String(p.message || '').trim();

  if (targetPhone.length < 9 || targetPhone.length > 16 || !messageText) {
    return createResponse_('error', null, 'Nomor tujuan dan isi pesan WhatsApp wajib diisi.', 'VALIDATION_ERROR');
  }

  var normalizedPhone = targetPhone.indexOf('0') === 0 ? '62' + targetPhone.slice(1) : targetPhone;
  var fallbackWaUrl = 'https://wa.me/' + normalizedPhone + '?text=' + encodeURIComponent(messageText);
  var fonnteToken = PropertiesService.getScriptProperties().getProperty('FONNTE_TOKEN') || '';

  if (!fonnteToken) {
    return createResponse_(
      'success',
      { deliveredVia: 'WA_ME_FALLBACK', waUrl: fallbackWaUrl },
      'FONNTE_TOKEN belum disetel; gunakan tautan langsung WhatsApp.',
      'OK'
    );
  }

  var res = fetchExternalWithBreaker_(
    'fonnte',
    'https://api.fonnte.com/send',
    {
      method: 'post',
      headers: { Authorization: fonnteToken },
      payload: { target: normalizedPhone, message: messageText }
    },
    1
  );

  if (!res.ok) {
    return createResponse_(
      'error',
      { fallbackWaUrl: fallbackWaUrl },
      res.errorMessage,
      'INTERNAL_ERROR'
    );
  }
  return createResponse_('success', { deliveredVia: 'FONNTE_API', target: normalizedPhone }, 'Notifikasi WhatsApp terkirim.', 'OK');
}

/**
 * Handler: ai.generate (Gemini Structured JSON Output dengan kuota harian per pengguna di CacheService)
 */
function handleAiGenerate_(req) {
  if (!req.session || !req.session.sub) {
    return createResponse_('error', null, 'Sesi login diperlukan untuk menggunakan fitur AI.', 'FORBIDDEN');
  }

  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('GEMINI_API_KEY') || '';
  if (!apiKey) {
    return createResponse_('error', null, 'GEMINI_API_KEY belum dikonfigurasi di ScriptProperties.', 'FORBIDDEN');
  }

  var p = req.payload || {};
  var promptText = String(p.prompt || '').trim();
  if (promptText.length < 3 || promptText.length > 4000) {
    return createResponse_('error', null, 'Prompt wajib diisi antara 3 hingga 4000 karakter.', 'VALIDATION_ERROR');
  }

  var tz = Session.getScriptTimeZone() || DEFAULT_TZ;
  var ymd = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  var userSub = String(req.session.sub).toLowerCase().slice(0, 80);
  var dailyLimit = Number(props.getProperty('AI_DAILY_LIMIT_PER_USER') || 20);
  var cache = CacheService.getScriptCache();
  var quotaKey = 'rl:ai:' + ymd + ':' + userSub;
  var usedCount = Number(cache.get(quotaKey) || 0);

  if (usedCount >= dailyLimit) {
    return createResponse_(
      'error',
      { dailyLimit: dailyLimit, usedCount: usedCount },
      'Kuota harian penggunaan AI Anda telah habis.',
      'RATE_LIMITED'
    );
  }

  var modelId = String(props.getProperty('GEMINI_MODEL_ID') || 'gemini-2.5-flash');
  var endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelId) + ':generateContent?key=' + encodeURIComponent(apiKey);
  var bodyObj = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  var res = fetchExternalWithBreaker_(
    'gemini',
    endpoint,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(bodyObj)
    },
    1
  );

  if (!res.ok) {
    return createResponse_('error', null, res.errorMessage, 'INTERNAL_ERROR');
  }

  cache.put(quotaKey, String(usedCount + 1), 21600);
  var parsedBody = JSON.parse(res.bodyText);
  var textOut = parsedBody &&
    parsedBody.candidates &&
    parsedBody.candidates[0] &&
    parsedBody.candidates[0].content &&
    parsedBody.candidates[0].content.parts &&
    parsedBody.candidates[0].content.parts[0]
    ? parsedBody.candidates[0].content.parts[0].text
    : '{}';

  return createResponse_(
    'success',
    { resultJson: textOut, remainingDailyQuota: Math.max(0, dailyLimit - (usedCount + 1)) },
    'Respons AI berhasil dibuat.',
    'OK'
  );
}

/**
 * Mencatat tugas eksternal ke sheet JOBS_OUTBOX di dalam LockService.
 */
function enqueueOutboxJob_(jobType, payloadObj) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, code: 'LOCK_TIMEOUT' };
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('JOBS_OUTBOX');
    if (!sheet) return { ok: false, code: 'NOT_FOUND' };
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var nowIso = formatIsoOffset_(new Date());
    var jobRecord = {
      id: generateNextId_(sheet, 'JOB'),
      created_at: nowIso,
      updated_at: nowIso,
      job_type: escapeFormula_(String(jobType || 'GENERIC')),
      payload_json: JSON.stringify(payloadObj || {}),
      status: 'PENDING',
      attempts: 0,
      last_error: '',
      is_seed: 'FALSE'
    };
    var rowValues = buildRowFromObject_(headers, jobRecord);
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, lastCol).setValues([rowValues]);
    SpreadsheetApp.flush();
    return { ok: true, jobId: jobRecord.id };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handler: payment.createCheckout
 * Looks up price_amount strictly from the server PLANS sheet (ignores any client-supplied price)
 * and creates a PENDING subscription invoice in SUBSCRIPTIONS.
 * TODO-VERIFY: Sesuaikan endpoint dan field payload gateway pembayaran (Midtrans / Xendit / Duitku) saat diuji di runtime GAS.
 */
function handlePaymentCreateCheckout_(req) {
  if (!req.session || !req.session.sub) {
    return createResponse_('error', null, 'Sesi login diperlukan untuk membuat checkout.', 'FORBIDDEN');
  }

  var p = req.payload || {};
  var planCode = String(p.planCode || p.plan_code || '').trim().toUpperCase();
  if (!planCode) {
    return createResponse_('error', null, 'planCode wajib disertakan.', 'VALIDATION_ERROR');
  }

  var plansRes = readSheetObjects_('PLANS');
  if (!plansRes.ok) return plansRes.errorResponse;

  var matchedPlan = null;
  for (var i = 0; i < plansRes.records.length; i++) {
    var pl = plansRes.records[i];
    if (
      String(pl.plan_code || '').trim().toUpperCase() === planCode &&
      String(pl.status || '').toUpperCase() === 'ACTIVE'
    ) {
      matchedPlan = pl;
      break;
    }
  }

  if (!matchedPlan) {
    return createResponse_('error', null, 'Paket langganan tidak ditemukan atau tidak aktif.', 'NOT_FOUND');
  }

  var serverPrice = Number(matchedPlan.price_amount);
  if (!isFinite(serverPrice) || serverPrice <= 0) {
    return createResponse_('error', null, 'Harga paket pada server belum valid.', 'INTERNAL_ERROR');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return createResponse_('error', null, 'Server sedang sibuk.', 'LOCK_TIMEOUT');
  }

  var newSubRecord = null;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var subsSheet = ss.getSheetByName('SUBSCRIPTIONS');
    if (!subsSheet) {
      return createResponse_('error', null, 'Tabel SUBSCRIPTIONS belum diinisialisasi.', 'NOT_FOUND');
    }

    var lastCol = subsSheet.getLastColumn();
    var headers = subsSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader_);
    var tz = Session.getScriptTimeZone() || DEFAULT_TZ;
    var now = new Date();
    var nowIso = formatIsoOffset_(now);
    var ymd = Utilities.formatDate(now, tz, 'yyyyMMdd');
    var subId = generateNextId_(subsSheet, 'SUB');
    var extInvoiceId = 'INV-' + ymd + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    var userEmail = String(req.session.sub).trim().toLowerCase();

    newSubRecord = {
      id: subId,
      user_email: escapeFormula_(userEmail),
      plan_code: escapeFormula_(planCode),
      status: 'PENDING',
      period_start: '',
      period_end: '',
      external_invoice_id: extInvoiceId,
      provider_event_id: '',
      created_at: nowIso,
      updated_at: nowIso,
      is_seed: 'FALSE'
    };

    var rowVals = buildRowFromObject_(headers, newSubRecord);
    subsSheet.getRange(subsSheet.getLastRow() + 1, 1, 1, lastCol).setValues([rowVals]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // TODO-VERIFY: Konfigurasi PAYMENT_GATEWAY_URL dan PAYMENT_GATEWAY_SECRET di ScriptProperties sesuai dokumentasi resmi gateway pilihan.
  var props = PropertiesService.getScriptProperties();
  var gatewayUrl = props.getProperty('PAYMENT_GATEWAY_URL') || '';
  var gatewaySecret = props.getProperty('PAYMENT_GATEWAY_SECRET') || '';
  var paymentUrl = '';

  if (gatewayUrl && gatewaySecret) {
    var gwRes = fetchExternalWithBreaker_(
      'payment_gateway',
      gatewayUrl,
      {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: gatewaySecret },
        payload: JSON.stringify({
          external_id: newSubRecord.external_invoice_id,
          subscription_id: newSubRecord.id,
          plan_code: planCode,
          amount: serverPrice,
          payer_email: newSubRecord.user_email
        })
      },
      1
    );
    if (!gwRes.ok) {
      return createResponse_('error', { subscriptionId: newSubRecord.id, externalInvoiceId: newSubRecord.external_invoice_id }, gwRes.errorMessage, 'INTERNAL_ERROR');
    }
    try {
      var parsedGw = JSON.parse(gwRes.bodyText || '{}');
      paymentUrl = String(parsedGw.payment_url || parsedGw.invoice_url || parsedGw.redirect_url || '');
    } catch (e) {}
  }

  return createResponse_(
    'success',
    {
      subscriptionId: newSubRecord.id,
      externalInvoiceId: newSubRecord.external_invoice_id,
      planCode: planCode,
      amount: serverPrice,
      billingPeriod: String(matchedPlan.billing_period || 'MONTHLY'),
      status: 'PENDING',
      paymentUrl: paymentUrl
    },
    'Invoice langganan berhasil dibuat dengan harga resmi server.',
    'OK'
  );
}