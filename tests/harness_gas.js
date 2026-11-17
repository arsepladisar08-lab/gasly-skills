const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const GAS_MD_FILES = [
  'config.md',
  'router-and-envelope.md',
  'auth-and-ratelimit.md',
  'sheets-repository.md',
  'drive-upload.md',
  'webhook-receiver.md',
  'integrations.md'
];

function extractJsFromMarkdown(mdPath) {
  const raw = fs.readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
  const startMarker = '```javascript\n';
  const startIdx = raw.indexOf(startMarker);
  assert.ok(startIdx !== -1, `No javascript code block in ${mdPath}`);
  const codeStart = startIdx + startMarker.length;
  const rest = raw.slice(codeStart);
  const endMatch = rest.match(/\n```|\n---\n|\n## /);
  return endMatch ? rest.slice(0, endMatch.index) : rest;
}

function createGasContext(overrides = {}) {
  const propsStore = new Map();
  const cacheStore = new Map();
  const sheetsStore = new Map();
  const driveFiles = new Map();
  const sentEmails = [];
  let remainingMailQuota = 100;
  let fetchHandler = () => ({ code: 200, text: '{}' });

  function makeSheet(name) {
    const rows = [];
    return {
      name,
      rows,
      getLastRow: () => rows.length,
      getLastColumn: () => (rows[0] ? rows[0].length : 0),
      setFrozenRows: () => {},
      deleteRow: (rIdx1) => {
        rows.splice(rIdx1 - 1, 1);
      },
      getDataRange: function () {
        return this.getRange(1, 1, Math.max(1, rows.length), Math.max(1, this.getLastColumn()));
      },
      getRange: (r1, c1, numRows = 1, numCols = 1) => ({
        getValues: () => {
          const out = [];
          for (let r = 0; r < numRows; r++) {
            const srcRow = rows[r1 - 1 + r] || [];
            const rowArr = [];
            for (let c = 0; c < numCols; c++) {
              rowArr.push(srcRow[c1 - 1 + c] !== undefined ? srcRow[c1 - 1 + c] : '');
            }
            out.push(rowArr);
          }
          return out;
        },
        getDisplayValues: function () {
          return this.getValues().map((r) => r.map((v) => String(v ?? '')));
        },
        setValues: (vals2d) => {
          for (let r = 0; r < vals2d.length; r++) {
            const targetR = r1 - 1 + r;
            if (!rows[targetR]) rows[targetR] = [];
            for (let c = 0; c < vals2d[r].length; c++) {
              rows[targetR][c1 - 1 + c] = vals2d[r][c];
            }
          }
          return {
            setFontWeight: () => ({ setBackground: () => {} })
          };
        },
        setValue: function (v) {
          return this.setValues([[v]]);
        }
      })
    };
  }

  function toSignedByteArray(buf) {
    const arr = [];
    for (const b of buf) {
      arr.push(b > 127 ? b - 256 : b);
    }
    return arr;
  }

  function fromSignedByteArray(arr) {
    return Buffer.from(arr.map((b) => b & 0xff));
  }

  const context = {
    console,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    RegExp,
    Error,
    parseInt,
    isNaN,
    isFinite,
    encodeURIComponent,
    __test: {
      propsStore,
      cacheStore,
      sheetsStore,
      driveFiles,
      sentEmails,
      setMailQuota: (q) => {
        remainingMailQuota = q;
      },
      setFetchHandler: (fn) => {
        fetchHandler = fn;
      }
    },
    Session: {
      getScriptTimeZone: () => 'Asia/Jakarta'
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => true,
        releaseLock: () => {}
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (propsStore.has(k) ? propsStore.get(k) : null),
        setProperty: (k, v) => {
          propsStore.set(String(k), String(v));
        },
        setProperties: (obj) => {
          Object.keys(obj).forEach((k) => propsStore.set(k, String(obj[k])));
        },
        deleteProperty: (k) => {
          propsStore.delete(String(k));
        }
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cacheStore.has(k) ? cacheStore.get(k) : null),
        put: (k, v) => {
          cacheStore.set(String(k), String(v));
        },
        remove: (k) => {
          cacheStore.delete(String(k));
        },
        getAll: (keys) => {
          const res = {};
          keys.forEach((k) => {
            if (cacheStore.has(k)) res[k] = cacheStore.get(k);
          });
          return res;
        },
        putAll: (batch) => {
          Object.keys(batch).forEach((k) => cacheStore.set(k, String(batch[k])));
        }
      })
    },
    SpreadsheetApp: {
      flush: () => {},
      getActiveSpreadsheet: () => ({
        getId: () => 'SS_TEST_123456',
        getSpreadsheetTimeZone: () => 'Asia/Jakarta',
        setSpreadsheetTimeZone: () => {},
        getSheetByName: (name) => sheetsStore.get(name) || null,
        insertSheet: (name) => {
          const s = makeSheet(name);
          sheetsStore.set(name, s);
          return s;
        }
      })
    },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE', ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
      Permission: { NONE: 'NONE', VIEW: 'VIEW' },
      createFolder: (name) => ({
        getId: () => 'FOLDER_' + name
      }),
      getFolderById: () => ({
        getFoldersByName: () => ({ hasNext: () => false }),
        createFolder: () => ({
          getFoldersByName: () => ({ hasNext: () => false }),
          createFolder: () => ({
            createFile: (blob) => {
              const id = 'FILE_' + crypto.randomUUID().slice(0, 8);
              const fileObj = {
                id,
                name: blob.getName(),
                trashed: false,
                sharingAccess: null,
                getId: () => id,
                setSharing: (acc) => {
                  fileObj.sharingAccess = acc;
                },
                setTrashed: (t) => {
                  fileObj.trashed = Boolean(t);
                }
              };
              driveFiles.set(id, fileObj);
              return fileObj;
            }
          })
        })
      }),
      getFileById: (id) => {
        const f = driveFiles.get(id);
        if (!f) throw new Error('File not found: ' + id);
        return f;
      }
    },
    MailApp: {
      getRemainingDailyQuota: () => remainingMailQuota,
      sendEmail: (opts) => {
        remainingMailQuota -= 1;
        sentEmails.push(opts);
      }
    },
    UrlFetchApp: {
      fetch: (url, opts) => {
        const out = fetchHandler(url, opts);
        return {
          getResponseCode: () => out.code,
          getContentText: () => out.text
        };
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (txt) => ({
        setMimeType: () => ({ getContent: () => txt })
      })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      sleep: () => {},
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, _tz, fmt) => {
        const dt = d instanceof Date ? d : new Date(d);
        const pad = (n) => String(n).padStart(2, '0');
        const y = dt.getFullYear();
        const m = pad(dt.getMonth() + 1);
        const day = pad(dt.getDate());
        if (fmt === 'yyyyMMdd') return `${y}${m}${day}`;
        if (fmt === 'yyyy-MM') return `${y}-${m}`;
        return `${y}-${m}-${day}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}+07:00`;
      },
      newBlob: (input, mimeType, name) => {
        const buf = Array.isArray(input)
          ? fromSignedByteArray(input)
          : Buffer.from(String(input), 'utf8');
        return {
          getBytes: () => toSignedByteArray(buf),
          getDataAsString: () => buf.toString('utf8'),
          getName: () => name || 'blob'
        };
      },
      computeDigest: (_algo, input) => {
        const buf = Array.isArray(input)
          ? fromSignedByteArray(input)
          : Buffer.from(String(input), 'utf8');
        return toSignedByteArray(crypto.createHash('sha256').update(buf).digest());
      },
      computeHmacSha256Signature: (dataBytes, keyBytes) => {
        const dBuf = fromSignedByteArray(dataBytes);
        const kBuf = fromSignedByteArray(keyBytes);
        return toSignedByteArray(crypto.createHmac('sha256', kBuf).update(dBuf).digest());
      },
      base64EncodeWebSafe: (bytes) => {
        const buf = fromSignedByteArray(bytes);
        return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      },
      base64DecodeWebSafe: (str) => {
        const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
        return toSignedByteArray(Buffer.from(b64, 'base64'));
      },
      base64Decode: (str) => toSignedByteArray(Buffer.from(String(str), 'base64'))
    },
    ...overrides
  };

  vm.createContext(context);
  for (const fname of GAS_MD_FILES) {
    const code = extractJsFromMarkdown(path.join(ROOT, 'src', 'gas', fname));
    vm.runInContext(code, context, { filename: fname });
  }
  return context;
}

const ctx = createGasContext();
ctx.initialSetupDatabase();
ctx.configureAdminPassphrase_('AdminPassphrase#2026!');
ctx.configureAdminPin_('123456');

// Helper untuk dispatch POST
function callPost(action, payload = {}, auth = null, idem = null) {
  const reqKey = idem || 'idem-' + crypto.randomUUID();
  return ctx.dispatchRequest_('POST', {
    action,
    v: 1,
    auth,
    idem: reqKey,
    payload
  });
}

// 1. Webhook: dedup providerEventId, secret salah -> FORBIDDEN, status invalid -> VALIDATION_ERROR
ctx.__test.propsStore.set('WEBHOOK_SHARED_SECRET', 'wh_secret_123');
const itemsSheet = ctx.__test.sheetsStore.get('ITEMS');
const firstItemId = itemsSheet.rows[1][0];

const whBadSecret = callPost('webhook.receive', {
  sharedSecret: 'wrong',
  entityId: firstItemId,
  newStatus: 'COMPLETED',
  providerEventId: 'evt_001'
});
assert.equal(whBadSecret.status, 'error');
assert.equal(whBadSecret.code, 'FORBIDDEN');

const whBadStatus = callPost('webhook.receive', {
  sharedSecret: 'wh_secret_123',
  entityId: firstItemId,
  newStatus: 'HACKED_STATUS',
  providerEventId: 'evt_002'
});
assert.equal(whBadStatus.status, 'error');
assert.equal(whBadStatus.code, 'VALIDATION_ERROR');

const whFirst = callPost(
  'webhook.receive',
  {
    sharedSecret: 'wh_secret_123',
    entityId: firstItemId,
    newStatus: 'COMPLETED',
    providerEventId: 'evt_dedup_99'
  },
  null,
  'idem-wh-1'
);
assert.equal(whFirst.status, 'success');
assert.equal(whFirst.meta.idempotentReplay, undefined);

// Ubah manual status di sheet untuk membuktikan panggilan kedua dengan providerEventId sama tidak menulis ulang
const statusIdx = itemsSheet.rows[0].indexOf('status');
itemsSheet.rows[1][statusIdx] = 'PENDING';
const whSecond = callPost(
  'webhook.receive',
  {
    sharedSecret: 'wh_secret_123',
    entityId: firstItemId,
    newStatus: 'COMPLETED',
    providerEventId: 'evt_dedup_99'
  },
  null,
  'idem-wh-2'
);
assert.equal(whSecond.status, 'success');
assert.equal(whSecond.meta.idempotentReplay, true);
assert.equal(itemsSheet.rows[1][statusIdx], 'PENDING');

// 2 & 3 & 6. Multi-user USERS: tambah user baru, cek penyembunyian kolom hash, setCredentials, login benar/salah/lockout
const usersSheet = ctx.__test.sheetsStore.get('USERS');
const pepper = ctx.__test.propsStore.get('AUTH_PEPPER');
const initSalt = ctx.generateRandomSecret_(16);
const initHash = ctx.computeIteratedHash_('StafPassphrase#2026', initSalt, pepper, 2000);
const userHeaders = usersSheet.rows[0];
usersSheet.rows.push(
  ctx.buildRowFromObject_(userHeaders, {
    id: 'USR-20261117-0001',
    email: 'staf@example.com',
    name: 'Staf Satu',
    role: 'STAFF',
    status: 'ACTIVE',
    password_salt: initSalt,
    password_hash: initHash,
    pin_salt: '',
    pin_hash: '',
    created_at: '2026-11-17T08:00:00+07:00',
    updated_at: '2026-11-17T08:00:00+07:00'
  })
);

// Kasus 3: Kolom hash USERS tidak muncul di readSheetObjects_ default maupun items.list
const defaultUsersRead = ctx.readSheetObjects_('USERS');
assert.equal(defaultUsersRead.ok, true);
assert.equal(defaultUsersRead.records.length, 1);
assert.equal('password_hash' in defaultUsersRead.records[0], false);
assert.equal('password_salt' in defaultUsersRead.records[0], false);
assert.equal('pin_hash' in defaultUsersRead.records[0], false);
assert.equal('pin_salt' in defaultUsersRead.records[0], false);

const itemsListRes = callPost('items.list', {});
assert.equal(itemsListRes.status, 'success');
assert.equal('upload_nonce' in itemsListRes.data.items[0], false);

// Kasus 2: Login multi-user benar, salah, dan terkunci setelah 5 kali
const stafLoginOk = callPost('auth.login', {
  email: 'staf@example.com',
  passphrase: 'StafPassphrase#2026'
});
assert.equal(stafLoginOk.status, 'success');
assert.equal(stafLoginOk.data.role, 'STAFF');
const stafToken = stafLoginOk.data.token;

for (let i = 0; i < 5; i++) {
  const bad = callPost('auth.login', {
    email: 'lockme@example.com',
    passphrase: 'WrongPassphrase123!'
  });
  assert.equal(bad.code, 'FORBIDDEN');
}
const lockedRes = callPost('auth.login', {
  email: 'lockme@example.com',
  passphrase: 'WrongPassphrase123!'
});
assert.equal(lockedRes.code, 'FORBIDDEN');
assert.ok(lockedRes.meta.retryAfterSeconds >= 900);

// Kasus 6: setCredentials non-ADMIN mengubah orang lain -> FORBIDDEN; tanpa currentPassphrase -> FORBIDDEN
const setOtherForbidden = callPost(
  'auth.setCredentials',
  { email: 'other@example.com', newPin: '654321' },
  stafToken
);
assert.equal(setOtherForbidden.code, 'FORBIDDEN');

const setSelfNoCurrent = callPost(
  'auth.setCredentials',
  { newPin: '654321' },
  stafToken
);
assert.equal(setSelfNoCurrent.code, 'FORBIDDEN');

// Alur lengkap: pengguna baru set PIN pertama kali (dengan currentPassphrase) -> berhasil
const setFirstPinOk = callPost(
  'auth.setCredentials',
  { currentPassphrase: 'StafPassphrase#2026', newPin: '654321' },
  stafToken
);
assert.equal(setFirstPinOk.status, 'success');

// Mengganti PIN yang sudah ada tanpa stepUpToken -> FORBIDDEN
const rotatePinWithoutStepUp = callPost(
  'auth.setCredentials',
  { currentPassphrase: 'StafPassphrase#2026', newPin: '112233' },
  stafToken
);
assert.equal(rotatePinWithoutStepUp.code, 'FORBIDDEN');

// Kasus 4 & 5: verifyPin targetAction di luar allowlist ditolak; token sekali pakai & terikat action; 3x salah mencabut sesi
const badTargetAction = callPost(
  'auth.verifyPin',
  { pin: '654321', targetAction: 'items.list' },
  stafToken
);
assert.equal(badTargetAction.code, 'VALIDATION_ERROR');

const pinForDelete = callPost(
  'auth.verifyPin',
  { pin: '654321', targetAction: 'items.delete' },
  stafToken
);
assert.equal(pinForDelete.status, 'success');
assert.ok(pinForDelete.data.stepUpToken);

// Token untuk 'items.delete' dipakai di 'file.delete' -> FORBIDDEN (dan tidak menghanguskan token untuk items.delete)
const wrongScopeUse = callPost(
  'file.delete',
  { entity: 'ITEMS', entityId: firstItemId, stepUpToken: pinForDelete.data.stepUpToken },
  stafToken
);
assert.equal(wrongScopeUse.code, 'FORBIDDEN');

// 3 kali salah PIN mencabut sesi aktif (revoked:<jti>)
for (let i = 0; i < 3; i++) {
  const wrongPin = callPost(
    'auth.verifyPin',
    { pin: '000000', targetAction: 'items.delete' },
    stafToken
  );
  assert.equal(wrongPin.code, 'FORBIDDEN');
}
const afterRevoke = callPost('file.replace', { entity: 'ITEMS', entityId: firstItemId }, stafToken);
assert.equal(afterRevoke.code, 'FORBIDDEN');

// Kasus 7 & 8: Admin login -> upload file -> file.replace (file lama masuk Trash) -> file.delete & items.delete dengan stepUpToken
const adminLogin = callPost('auth.login', {
  account: 'admin',
  passphrase: 'AdminPassphrase#2026!'
});
assert.equal(adminLogin.status, 'success');
const adminToken = adminLogin.data.token;

// Buat JPEG minimal dengan magic bytes 0xFF, 0xD8, 0xFF (16 bytes)
const validJpegB64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48
]).toString('base64');

const upload1 = callPost(
  'file.upload',
  {
    entity: 'ITEMS',
    entityId: firstItemId,
    fileName: 'bukti1.jpg',
    mimeType: 'image/jpeg',
    base64: validJpegB64
  },
  adminToken
);
assert.equal(upload1.status, 'success');
const firstFileId = upload1.data.fileId;
assert.equal(ctx.__test.driveFiles.get(firstFileId).trashed, false);

// Kasus 8: file.replace memindahkan file lama ke Trash setelah file baru sukses
const replaceRes = callPost(
  'file.replace',
  {
    entity: 'ITEMS',
    entityId: firstItemId,
    fileName: 'bukti2.jpg',
    mimeType: 'image/jpeg',
    base64: validJpegB64
  },
  adminToken
);
assert.equal(replaceRes.status, 'success');
const secondFileId = replaceRes.data.fileId;
assert.notEqual(secondFileId, firstFileId);
assert.equal(ctx.__test.driveFiles.get(firstFileId).trashed, true);
assert.equal(ctx.__test.driveFiles.get(secondFileId).trashed, false);

// Kasus 7: file.delete dan items.delete tanpa stepUpToken -> FORBIDDEN; dengan stepUpToken -> berhasil
const fileDelNoToken = callPost(
  'file.delete',
  { entity: 'ITEMS', entityId: firstItemId },
  adminToken
);
assert.equal(fileDelNoToken.code, 'FORBIDDEN');

const adminPinFileDel = callPost(
  'auth.verifyPin',
  { pin: '123456', targetAction: 'file.delete' },
  adminToken
);
assert.equal(adminPinFileDel.status, 'success');

const fileDelOk = callPost(
  'file.delete',
  {
    entity: 'ITEMS',
    entityId: firstItemId,
    stepUpToken: adminPinFileDel.data.stepUpToken
  },
  adminToken
);
assert.equal(fileDelOk.status, 'success');
assert.equal(ctx.__test.driveFiles.get(secondFileId).trashed, true);

// Token step-up sekali pakai: dipakai ulang gagal
const fileDelReplayToken = callPost(
  'file.delete',
  {
    entity: 'ITEMS',
    entityId: firstItemId,
    stepUpToken: adminPinFileDel.data.stepUpToken
  },
  adminToken
);
assert.equal(fileDelReplayToken.code, 'FORBIDDEN');

const itemDelNoToken = callPost('items.delete', { id: firstItemId }, adminToken);
assert.equal(itemDelNoToken.code, 'FORBIDDEN');

const adminPinItemDel = callPost(
  'auth.verifyPin',
  { pin: '123456', targetAction: 'items.delete' },
  adminToken
);
const itemDelOk = callPost(
  'items.delete',
  { id: firstItemId, stepUpToken: adminPinItemDel.data.stepUpToken },
  adminToken
);
assert.equal(itemDelOk.status, 'success');

// Kasus 9: mail.send ditolak saat sisa kuota <= 5; ai.generate ditolak saat kuota harian habis & API key tidak bocor
ctx.__test.setMailQuota(5);
const mailBlocked = callPost(
  'mail.send',
  { to: 'pelanggan@example.com', subject: 'Invoice', htmlBody: '<p>Halo</p>' },
  adminToken
);
assert.equal(mailBlocked.status, 'error');
assert.equal(mailBlocked.code, 'RATE_LIMITED');

ctx.__test.setMailQuota(20);
const mailOk = callPost(
  'mail.send',
  { to: 'pelanggan@example.com', subject: 'Invoice', htmlBody: '<p>Halo</p>' },
  adminToken
);
assert.equal(mailOk.status, 'success');

const secretApiKey = 'AIzaSySECRET_DO_NOT_LEAK_999';
ctx.__test.propsStore.set('GEMINI_API_KEY', secretApiKey);
ctx.__test.propsStore.set('AI_DAILY_LIMIT_PER_USER', '1');
ctx.__test.setFetchHandler(() => ({
  code: 200,
  text: JSON.stringify({
    candidates: [{ content: { parts: [{ text: '{"summary":"ok"}' }] } }]
  })
}));

const aiFirst = callPost('ai.generate', { prompt: 'Ringkas transaksi hari ini' }, adminToken);
assert.equal(aiFirst.status, 'success');
assert.equal(JSON.stringify(aiFirst).includes(secretApiKey), false);

const aiSecond = callPost('ai.generate', { prompt: 'Ringkas lagi' }, adminToken);
assert.equal(aiSecond.status, 'error');
assert.equal(aiSecond.code, 'RATE_LIMITED');
assert.equal(JSON.stringify(aiSecond).includes(secretApiKey), false);

// Kasus 10: Circuit breaker terbuka setelah 3 kegagalan 5xx beruntun
let externalCalls = 0;
ctx.__test.setFetchHandler(() => {
  externalCalls += 1;
  return { code: 503, text: 'Service Unavailable' };
});
for (let c = 0; c < 3; c++) {
  const r = ctx.fetchExternalWithBreaker_('test_svc', 'https://example.com/api', {}, 0);
  assert.equal(r.ok, false);
}
assert.equal(externalCalls, 3);
const cbShortCircuit = ctx.fetchExternalWithBreaker_('test_svc', 'https://example.com/api', {}, 0);
assert.equal(cbShortCircuit.ok, false);
assert.ok(cbShortCircuit.errorMessage.includes('circuit open'));
assert.equal(externalCalls, 3); // Tidak memanggil UrlFetchApp.fetch saat circuit terbuka

// Kasus 11 (Batch 2 Tugas D & E): plans.list, payment.createCheckout (server price lookup), webhook SUBSCRIPTIONS activation, subscription.get, & assertEntitlement_
const plansListRes = callPost('plans.list', {});
assert.equal(plansListRes.status, 'success');
assert.equal(plansListRes.data.plans.length, 2);

// Login user kedua untuk menguji alur langganan dari belum punya langganan -> checkout -> webhook aktif -> assertEntitlement_
const buyerSalt = ctx.generateRandomSecret_(16);
const buyerHash = ctx.computeIteratedHash_('BuyerPassphrase#2026', buyerSalt, pepper, 2000);
usersSheet.rows.push(
  ctx.buildRowFromObject_(userHeaders, {
    id: 'USR-20261117-0002',
    email: 'buyer@example.com',
    name: 'Buyer SaaS',
    role: 'STAFF',
    status: 'ACTIVE',
    password_salt: buyerSalt,
    password_hash: buyerHash,
    pin_salt: '',
    pin_hash: '',
    created_at: '2026-11-17T08:00:00+07:00',
    updated_at: '2026-11-17T08:00:00+07:00'
  })
);
const buyerLogin = callPost('auth.login', {
  email: 'buyer@example.com',
  passphrase: 'BuyerPassphrase#2026'
});
assert.equal(buyerLogin.status, 'success');
const buyerToken = buyerLogin.data.token;
const buyerSession = ctx.verifySessionToken_(buyerToken).session;

// Sebelum langganan aktif, assertEntitlement_ menolak dengan FORBIDDEN
const entBefore = ctx.assertEntitlement_({ session: buyerSession }, 0);
assert.equal(entBefore.allowed, false);
assert.equal(entBefore.errorResponse.code, 'FORBIDDEN');

// Klien mencoba memalsukan price_amount: 1 saat checkout STARTER (harga resmi di PLANS: 149000)
const checkoutRes = callPost(
  'payment.createCheckout',
  { planCode: 'STARTER', price_amount: 1, amount: 1 },
  buyerToken
);
assert.equal(checkoutRes.status, 'success');
assert.equal(checkoutRes.data.amount, 149000); // Wajib harga dari PLANS di server, bukan 1 dari klien
assert.equal(checkoutRes.data.status, 'PENDING');
const invoiceId = checkoutRes.data.externalInvoiceId;

// Masih PENDING -> assertEntitlement_ tetap menolak
assert.equal(ctx.assertEntitlement_({ session: buyerSession }, 0).allowed, false);

// Aktivasi SUBSCRIPTIONS melalui webhook.receive menggunakan externalInvoiceId
const whActivateSub = callPost(
  'webhook.receive',
  {
    sharedSecret: 'wh_secret_123',
    entityId: invoiceId,
    newStatus: 'ACTIVE',
    providerEventId: 'evt_sub_paid_001'
  },
  null,
  'idem-wh-sub-1'
);
assert.equal(whActivateSub.status, 'success');
assert.equal(whActivateSub.data.status, 'ACTIVE');
assert.ok(whActivateSub.data.periodStart);
assert.ok(whActivateSub.data.periodEnd);

// Panggil subscription.get -> status ACTIVE
const subGetRes = callPost('subscription.get', {}, buyerToken);
assert.equal(subGetRes.status, 'success');
assert.equal(subGetRes.data.subscription.status, 'ACTIVE');
assert.equal(subGetRes.data.subscription.plan_code, 'STARTER');

// assertEntitlement_ dengan pemakaian di bawah kuota (10 < 50) -> allowed: true
const entOk = ctx.assertEntitlement_({ session: buyerSession }, 10);
assert.equal(entOk.allowed, true);
assert.equal(entOk.maxQuota, 50);

// assertEntitlement_ saat pemakaian mencapai batas kuota (50 >= 50) -> allowed: false (FORBIDDEN)
const entQuotaExceeded = ctx.assertEntitlement_({ session: buyerSession }, 50);
assert.equal(entQuotaExceeded.allowed, false);
assert.equal(entQuotaExceeded.errorResponse.code, 'FORBIDDEN');

// Kasus 12 (Tugas 1): setupAdminCredentials() membaca ADMIN_PASSPHRASE_INIT & ADMIN_PIN_INIT,
// menyimpan hash, tidak membocorkan plaintext, dan selalu menghapus properti sementara (baik sukses maupun gagal).
ctx.__test.propsStore.delete('ADMIN_PASSPHRASE_HASH');
ctx.__test.propsStore.delete('ADMIN_PIN_HASH');
ctx.__test.propsStore.set('ADMIN_PASSPHRASE_INIT', 'InitPassphrase#2026Valid');
ctx.__test.propsStore.set('ADMIN_PIN_INIT', '654321');

const setupAdminOk = ctx.setupAdminCredentials();
assert.equal(setupAdminOk.status, 'success');
assert.equal(setupAdminOk.code, 'OK');
assert.equal(ctx.__test.propsStore.has('ADMIN_PASSPHRASE_INIT'), false, 'ADMIN_PASSPHRASE_INIT must be deleted after success');
assert.equal(ctx.__test.propsStore.has('ADMIN_PIN_INIT'), false, 'ADMIN_PIN_INIT must be deleted after success');
assert.ok(ctx.__test.propsStore.get('ADMIN_PASSPHRASE_HASH'), 'ADMIN_PASSPHRASE_HASH must be stored');
assert.ok(ctx.__test.propsStore.get('ADMIN_PIN_HASH'), 'ADMIN_PIN_HASH must be stored');
assert.equal(JSON.stringify(setupAdminOk).includes('InitPassphrase#2026Valid'), false, 'Response must not leak passphrase');
assert.equal(JSON.stringify(setupAdminOk).includes('654321'), false, 'Response must not leak PIN');

// Gagal karena passphrase < 12 karakter -> melempar error DAN properti sementara tetap dihapus
ctx.__test.propsStore.set('ADMIN_PASSPHRASE_INIT', 'short');
ctx.__test.propsStore.set('ADMIN_PIN_INIT', '123456');
assert.throws(() => ctx.setupAdminCredentials(), /at least 12 characters/);
assert.equal(ctx.__test.propsStore.has('ADMIN_PASSPHRASE_INIT'), false, 'ADMIN_PASSPHRASE_INIT must be deleted on passphrase failure');
assert.equal(ctx.__test.propsStore.has('ADMIN_PIN_INIT'), false, 'ADMIN_PIN_INIT must be deleted on passphrase failure');

// Gagal karena PIN bukan 6 digit angka -> melempar error DAN properti sementara tetap dihapus
ctx.__test.propsStore.set('ADMIN_PASSPHRASE_INIT', 'ValidPassphrase#2026Again');
ctx.__test.propsStore.set('ADMIN_PIN_INIT', '12ab');
assert.throws(() => ctx.setupAdminCredentials(), /exactly 6 digits/);
assert.equal(ctx.__test.propsStore.has('ADMIN_PASSPHRASE_INIT'), false, 'ADMIN_PASSPHRASE_INIT must be deleted on PIN failure');
assert.equal(ctx.__test.propsStore.has('ADMIN_PIN_INIT'), false, 'ADMIN_PIN_INIT must be deleted on PIN failure');

console.log(
  'PASS: Node Headless GAS harness_gas.js (webhook dedup, USERS auth/lockout, hidden hashes, verifyPin/revoke, stepUp single-use/scope, setCredentials, setupAdminCredentials, file.replace/delete, mail quota, AI quota, circuit breaker, PLANS/SUBSCRIPTIONS checkout & entitlement)'
);