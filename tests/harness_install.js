#!/usr/bin/env node
/**
 * Node VM Execution Harness for Gasly Install Guide & Admin Credential Setup
 * (tests/harness_install.js)
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function extractScriptFromHtml(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const matches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(matches.length > 0, `No <script> block found in ${filePath}`);
  return matches.map((m) => m[1]).join('\n');
}

function extractJsBlocksFromMarkdown(mdPath) {
  const raw = fs.readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
  const startMarker = '```javascript\n';
  const startIdx = raw.indexOf(startMarker);
  assert.ok(startIdx !== -1, `No javascript code block in ${mdPath}`);
  const codeStart = startIdx + startMarker.length;
  const rest = raw.slice(codeStart);
  const endMatch = rest.match(/\n```|\n---\n|\n## /);
  return endMatch ? rest.slice(0, endMatch.index) : rest;
}

// ================= 1. TEST GaslyGuide IN guide-template.html =================
(function testGuideTemplateVm() {
  const guidePath = path.join(ROOT, 'src', 'install', 'guide-template.html');
  const scriptCode = extractScriptFromHtml(guidePath);

  const sandbox = {
    crypto: crypto.webcrypto,
    URL: URL,
    Uint8Array: Uint8Array
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(scriptCode, sandbox, { filename: 'guide-template.js' });

  const guide = sandbox.GaslyGuide;
  assert.ok(guide, 'GaslyGuide global object must be exposed');
  assert.equal(typeof guide.fillPlaceholders, 'function');
  assert.equal(typeof guide.validateConfig, 'function');
  assert.equal(typeof guide.generateSecret, 'function');

  // 1A. Complete placeholder substitution
  const tpl = 'Sheet={{SPREADSHEET_ID}} | Exec={{GAS_EXEC_URL}} | Client={{GOOGLE_CLIENT_ID}} | Domain={{PAGES_DOMAIN}}';
  const filled = guide.fillPlaceholders(tpl, {
    SPREADSHEET_ID: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    GAS_EXEC_URL: 'https://script.google.com/macros/s/AKfycbx12345/exec',
    GOOGLE_CLIENT_ID: '998877-xyz.apps.googleusercontent.com',
    PAGES_DOMAIN: 'https://gudang.contoh.id'
  });
  assert.equal(
    filled,
    'Sheet=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms | Exec=https://script.google.com/macros/s/AKfycbx12345/exec | Client=998877-xyz.apps.googleusercontent.com | Domain=https://gudang.contoh.id'
  );

  // 1B. Rejection of dangerous characters (< > " ' and whitespace)
  for (const badVal of ['<script>', 'abc"def', "abc'def", 'has space', 'line\nbreak']) {
    assert.throws(
      () => guide.fillPlaceholders('{{SPREADSHEET_ID}}', { SPREADSHEET_ID: badVal }),
      /Forbidden characters/
    );
    const valRes = guide.validateConfig({ GAS_EXEC_URL: `https://script.google.com/macros/s/${badVal}/exec` });
    assert.equal(valRes.valid, false, `validateConfig should reject: ${badVal}`);
  }

  // 1C. URL Validator: standard & Google Workspace domain-scoped /exec URLs
  const stdUrl = guide.validateConfig({
    GAS_EXEC_URL: 'https://script.google.com/macros/s/AKfycbz9876543210/exec'
  });
  assert.equal(stdUrl.valid, true, 'Standard /macros/s/.../exec URL must be accepted');

  const workspaceUrl = guide.validateConfig({
    GAS_EXEC_URL: 'https://script.google.com/macros/a/perusahaan.co.id/s/AKfycbz9876543210/exec'
  });
  assert.equal(workspaceUrl.valid, true, 'Workspace /macros/a/<domain>/s/.../exec URL must be accepted');

  for (const invalidUrl of [
    'http://script.google.com/macros/s/AKfycb/exec',
    'https://evil.example.com/macros/s/AKfycb/exec',
    'https://script.google.com/macros/s/AKfycb/dev',
    'https://script.google.com/home/projects/123'
  ]) {
    const res = guide.validateConfig({ GAS_EXEC_URL: invalidUrl });
    assert.equal(res.valid, false, `Invalid URL must be rejected: ${invalidUrl}`);
  }

  // 1D. Secret generator length and charset
  const secret32 = guide.generateSecret(32);
  assert.equal(secret32.length, 32);
  assert.match(secret32, /^[A-Za-z0-9\-_]{32}$/);

  const secret48 = guide.generateSecret(48);
  assert.equal(secret48.length, 48);
  assert.match(secret48, /^[A-Za-z0-9\-_]{48}$/);

  assert.throws(() => guide.generateSecret(8), /between 16 and 128/);
})();

// ================= 2. TEST setupAdminCredentials() IN src/gas/config.md =================
(function testSetupAdminCredentialsVm() {
  const configCode = extractJsBlocksFromMarkdown(path.join(ROOT, 'src', 'gas', 'config.md'));
  const authCode = extractJsBlocksFromMarkdown(path.join(ROOT, 'src', 'gas', 'auth-and-ratelimit.md'));

  const store = {};
  const propsStub = {
    getProperty(k) {
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setProperty(k, v) {
      store[k] = String(v);
    },
    setProperties(obj) {
      Object.keys(obj).forEach((k) => {
        store[k] = String(obj[k]);
      });
    },
    deleteProperty(k) {
      delete store[k];
    }
  };

  const gasSandbox = {
    PropertiesService: {
      getScriptProperties: () => propsStub
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      getUuid: () => crypto.randomUUID(),
      newBlob: (str) => ({
        getBytes: () => Array.from(Buffer.from(String(str), 'utf8')),
        getDataAsString: () => String(str)
      }),
      computeDigest: (_algo, bytes) => Array.from(crypto.createHash('sha256').update(Buffer.from(bytes)).digest()),
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64url')
    }
  };

  vm.createContext(gasSandbox);
  vm.runInContext(authCode + '\n' + configCode, gasSandbox, { filename: 'gas_config_auth.js' });

  assert.equal(typeof gasSandbox.setupAdminCredentials, 'function', 'setupAdminCredentials must be a public function');

  // 2A. Happy path: valid passphrase (>=12) and valid 6-digit PIN -> hashes saved, temp props deleted
  store.ADMIN_PASSPHRASE_INIT = 'CorrectHorseBatteryStaple99';
  store.ADMIN_PIN_INIT = '654321';

  const okRes = gasSandbox.setupAdminCredentials();
  assert.equal(okRes.status, 'success');
  assert.equal(store.ADMIN_PASSPHRASE_INIT, undefined, 'ADMIN_PASSPHRASE_INIT must be deleted after success');
  assert.equal(store.ADMIN_PIN_INIT, undefined, 'ADMIN_PIN_INIT must be deleted after success');
  assert.ok(store.ADMIN_PASSPHRASE_HASH && store.ADMIN_PASSPHRASE_HASH.length > 16, 'Passphrase hash must be stored');
  assert.ok(store.ADMIN_PIN_HASH && store.ADMIN_PIN_HASH.length > 16, 'PIN hash must be stored');
  assert.ok(!JSON.stringify(okRes).includes('CorrectHorseBatteryStaple99'), 'Response must never leak plaintext passphrase');
  assert.ok(!JSON.stringify(okRes).includes('654321'), 'Response must never leak plaintext PIN');

  // 2B. Failure path 1: passphrase < 12 chars -> throws error AND still deletes temp properties
  store.ADMIN_PASSPHRASE_INIT = 'short123';
  store.ADMIN_PIN_INIT = '123456';
  assert.throws(() => gasSandbox.setupAdminCredentials(), /at least 12 characters/);
  assert.equal(store.ADMIN_PASSPHRASE_INIT, undefined, 'ADMIN_PASSPHRASE_INIT must be deleted even on failure');
  assert.equal(store.ADMIN_PIN_INIT, undefined, 'ADMIN_PIN_INIT must be deleted even on failure');

  // 2C. Failure path 2: PIN not 6 digits -> throws error AND still deletes temp properties
  store.ADMIN_PASSPHRASE_INIT = 'AnotherValidPassphrase12345';
  store.ADMIN_PIN_INIT = '12ab';
  assert.throws(() => gasSandbox.setupAdminCredentials(), /exactly 6 digits/);
  assert.equal(store.ADMIN_PASSPHRASE_INIT, undefined, 'ADMIN_PASSPHRASE_INIT must be deleted when PIN fails');
  assert.equal(store.ADMIN_PIN_INIT, undefined, 'ADMIN_PIN_INIT must be deleted when PIN fails');
})();

console.log('[OK] harness_install.js: All GaslyGuide and setupAdminCredentials VM tests passed.');