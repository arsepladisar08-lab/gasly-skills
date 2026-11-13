const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const markdown = fs.readFileSync(path.join(root, "src/kb/boilerplates.md"), "utf8");
const tick = String.fromCharCode(96);
const fence = tick.repeat(3);

function extractBlock(heading) {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, "missing section " + heading);
  const open = markdown.indexOf(fence + "javascript", start);
  assert.notEqual(open, -1, "missing JavaScript fence " + heading);
  const bodyStart = markdown.indexOf("\n", open) + 1;
  const bodyEnd = markdown.indexOf(fence, bodyStart);
  assert.notEqual(bodyEnd, -1, "unclosed JavaScript fence " + heading);
  return markdown.slice(bodyStart, bodyEnd);
}

const serverCode = extractBlock("## 3. Boilerplate " + tick + "code.gs" + tick);
const clientCode = extractBlock("## 4. Boilerplate " + tick + "index.html" + tick);
const state = { active: "", effective: "owner@example.test", now: "2026-11-13T02:00:00.000Z" };
const propsData = {};
const cacheData = new Map();

class FakeSheet {
  constructor(rows = []) { this.rows = rows.map(row => row.slice()); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((n, row) => Math.max(n, row.length), 0); }
  getDataRange() { return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  getRange(r, c, nr, nc) {
    const self = this;
    return {
      getValues() {
        const out = [];
        for (let y = 0; y < nr; y++) {
          const row = [];
          for (let x = 0; x < nc; x++) row.push((self.rows[r - 1 + y] || [])[c - 1 + x] ?? "");
          out.push(row);
        }
        return out;
      },
      getDisplayValues() { return this.getValues().map(row => row.map(value => String(value ?? ""))); },
      setValues(values) {
        for (let y = 0; y < values.length; y++) {
          const rowIndex = r - 1 + y;
          if (!self.rows[rowIndex]) self.rows[rowIndex] = [];
          for (let x = 0; x < values[y].length; x++) self.rows[rowIndex][c - 1 + x] = values[y][x];
        }
      }
    };
  }
  deleteRows(start, count) { this.rows.splice(start - 1, count); }
}
const sheets = {
  ITEMS: new FakeSheet([
    ["id", "created_at", "updated_at", "title", "category", "amount", "status", "is_seed"],
    ["TRX-20261113-0001", "2026-11-13T08:00:00+07:00", "2026-11-13T09:00:00+07:00", "Demo item", "Operasional", 100, "ACTIVE", "FALSE"]
  ]),
  CONFIG: new FakeSheet([["config_key", "config_value", "updated_at"]])
};
const spreadsheet = {
  getSheetByName(name) { if (this.throwOnRead) throw new Error("private schema details"); return sheets[name] || null; },
  insertSheet(name) { sheets[name] = new FakeSheet([]); return sheets[name]; },
  getSpreadsheetTimeZone() { return "Asia/Jakarta"; },
  setSpreadsheetTimeZone() {},
  getId() { return "fake-sheet"; },
  throwOnRead: false
};
const NativeDate = Date;
class FixedDate extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [state.now])); }
  static now() { return new NativeDate(state.now).getTime(); }
}
function formatDate(date, pattern) {
  const local = new NativeDate(new NativeDate(date).getTime() + 7 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, "0");
  const y = local.getUTCFullYear(), m = pad(local.getUTCMonth() + 1), d = pad(local.getUTCDate());
  if (pattern === "yyyyMMdd") return String(y) + m + d;
  return String(y) + "-" + m + "-" + d + "T" + pad(local.getUTCHours()) + ":" + pad(local.getUTCMinutes()) + ":" + pad(local.getUTCSeconds()) + "+07:00";
}
const properties = {
  getProperty(key) { return Object.prototype.hasOwnProperty.call(propsData, key) ? propsData[key] : null; },
  setProperty(key, value) { propsData[key] = String(value); return this; },
  deleteProperty(key) { delete propsData[key]; return this; }
};
const cache = {
  get(key) { return cacheData.has(key) ? cacheData.get(key) : null; },
  put(key, value) { cacheData.set(key, String(value)); },
  remove(key) { cacheData.delete(key); }
};
const serverContext = {
  Date: FixedDate,
  Session: {
    getActiveUser: () => ({ getEmail: () => state.active }),
    getEffectiveUser: () => ({ getEmail: () => state.effective }),
    getScriptTimeZone: () => "Asia/Jakarta"
  },
  PropertiesService: { getScriptProperties: () => properties },
  CacheService: { getScriptCache: () => cache },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, flush() {} },
  Utilities: { formatDate },
  console, JSON, Math, Number, String, Object, Array, isFinite, parseInt
};
vm.createContext(serverContext);
vm.runInContext(serverCode, serverContext, { filename: "boilerplates-code.gs.js" });

function expectCode(result, code, label) {
  assert.equal(result && result.code, code, label + " got " + JSON.stringify(result));
}

// (a) Anonymous no-argument calls cannot use the former undefined-payload bypass.
propsData.OWNER_EMAIL = "owner@example.test";
state.active = "";
state.effective = "owner@example.test";
expectCode(serverContext.purgeSeedData(undefined), "FORBIDDEN", "anonymous purge without payload");
expectCode(serverContext.runDiagnostics(undefined), "FORBIDDEN", "anonymous diagnostics without payload");

// (b) No admin PIN/owner identity means configuration-incomplete FORBIDDEN.
const noPin = serverContext.assertAdminAccess_({});
expectCode(noPin.response, "FORBIDDEN", "missing admin PIN");
assert.match(noPin.response.message, /Konfigurasi admin belum selesai/i);

// Explicit editor identity and USER_ACCESSING owner identity remain authorized.
state.active = "owner@example.test";
state.effective = "owner@example.test";
assert.equal(serverContext.assertAdminAccess_(undefined).allowed, true, "editor owner identity");
serverContext.DEPLOY_MODE = "USER_ACCESSING";
state.active = "owner@example.test";
state.effective = "owner@example.test";
assert.equal(serverContext.assertAdminAccess_(undefined).allowed, true, "USER_ACCESSING owner");
state.active = "staff@example.test";
expectCode(serverContext.assertAdminAccess_(undefined).response, "FORBIDDEN", "USER_ACCESSING non-owner");
serverContext.DEPLOY_MODE = "EXECUTE_AS_ME";
state.active = "";
state.effective = "owner@example.test";

// A PIN cannot be the only control when deployment is configured as Anyone.
serverContext.DEPLOY_ACCESS = "ANYONE";
propsData.ADMIN_PIN = "non-default-admin-pin";
expectCode(serverContext.assertAdminAccess_({ adminPin: "non-default-admin-pin" }).response, "FORBIDDEN", "Anyone PIN-only configuration");
serverContext.DEPLOY_ACCESS = "RESTRICTED";

// Cache-based PIN throttling: five failures lock subsequent attempts.
for (let i = 0; i < 5; i++) serverContext.assertAdminAccess_({ adminPin: "wrong-pin" });
expectCode(serverContext.assertAdminAccess_({ adminPin: "non-default-admin-pin" }).response, "FORBIDDEN", "PIN lockout");
delete propsData.ADMIN_PIN;
cacheData.clear();

// (c) update/delete require updated_at.
const missingUpdate = serverContext.saveItem({ id: "TRX-20261113-0001", title: "Changed title", category: "Operasional", amount: 120, status: "ACTIVE" });
expectCode(missingUpdate, "VALIDATION_ERROR", "server update without updated_at");
const missingDelete = serverContext.deleteItem({ id: "TRX-20261113-0001" });
expectCode(missingDelete, "VALIDATION_ERROR", "server delete without updated_at");

// (d) stale updated_at conflicts; current updated_at is accepted.
const staleUpdate = serverContext.saveItem({ id: "TRX-20261113-0001", title: "Changed title", category: "Operasional", amount: 120, status: "ACTIVE", updated_at: "2026-11-12T09:00:00+07:00" });
expectCode(staleUpdate, "CONFLICT", "server stale update");
const validUpdate = serverContext.saveItem({ id: "TRX-20261113-0001", title: "Changed title", category: "Operasional", amount: 120, status: "ACTIVE", updated_at: "2026-11-13T09:00:00+07:00" });
expectCode(validUpdate, "OK", "server matching update");

// (e) daily ID sequence resets in the next local date.
const ids = new FakeSheet([["id"], ["TRX-20261113-0005"]]);
state.now = "2026-11-13T02:00:00.000Z";
assert.equal(serverContext.generateNextId_(ids, "TRX"), "TRX-20261113-0006");
state.now = "2026-11-13T18:00:00.000Z";
assert.equal(serverContext.generateNextId_(ids, "TRX"), "TRX-20261114-0001");

// runDiagnostics reports canonical INTERNAL_ERROR instead of leaking caught details.
state.active = "owner@example.test";
state.effective = "owner@example.test";
spreadsheet.throwOnRead = true;
const diagnosticFailure = serverContext.runDiagnostics(undefined);
expectCode(diagnosticFailure, "INTERNAL_ERROR", "structured diagnostics catch");
assert.equal(diagnosticFailure.message, "Diagnostik gagal dijalankan.");
spreadsheet.throwOnRead = false;
state.active = "";

// Run the client mock block in a sandboxed browser-like context.
const mockWindow = {};
const mockContext = {
  window: mockWindow,
  document: { getElementById: () => null, createElement: () => ({ setAttribute() {}, style: {}, appendChild() {} }), body: { appendChild() {} } },
  Date: FixedDate, Intl, console, setTimeout: callback => callback(), clearTimeout() {}
};
vm.createContext(mockContext);
vm.runInContext(clientCode, mockContext, { filename: "boilerplates-index.html.js" });
function mockCall(action, payload) {
  let answer;
  mockContext.handleMockAction_(action, payload, value => { answer = value; }, value => { answer = value; });
  return answer;
}

// (c) and (g): mock validation codes match server.
const mockMissingUpdate = mockCall("saveItem", { id: "not-found", title: "Valid title", amount: 10 });
expectCode(mockMissingUpdate, "VALIDATION_ERROR", "mock update without updated_at");
const mockMissingDelete = mockCall("deleteItem", { id: "not-found" });
expectCode(mockMissingDelete, "VALIDATION_ERROR", "mock delete without updated_at");
expectCode(mockCall("purgeSeedData", undefined), "FORBIDDEN", "mock purge without auth");
expectCode(mockCall("runDiagnostics", undefined), "FORBIDDEN", "mock diagnostics without auth");
assert.equal(mockWindow.configurePreviewAdmin("Preview-Only-Long-PIN"), true, "explicit preview admin configuration");
expectCode(mockCall("runDiagnostics", { adminPin: "Preview-Only-Long-PIN" }), "OK", "mock diagnostics with simulated auth");

// (f) Server and preview produce identical +07:00 timestamp strings under CI timezone.
state.now = "2026-11-13T02:03:04.000Z";
assert.equal(serverContext.formatIsoOffset_(new FixedDate()), mockContext.formatLocalIso_(new FixedDate()), "server/mock timezone");

// (g) Action-name contract and tested error codes.
const serverFns = [...serverCode.matchAll(/^function\s+([A-Za-z0-9_]+)\s*\(/gm)].map(m => m[1]);
const excluded = new Set(["doGet", "include", "initialSetupDatabase", "runDiagnostics"]);
const expected = serverFns.filter(n => !n.endsWith("_") && !excluded.has(n)).sort();
const actual = [...clientCode.matchAll(/actionName\s*===\s*['"]([A-Za-z0-9_]+)['"]/g)].map(m => m[1]).filter(n => n !== "runDiagnostics").sort();
assert.deepEqual(actual, expected, "server/mock public action names");
assert.equal(missingUpdate.code, mockMissingUpdate.code);
assert.equal(missingDelete.code, mockMissingDelete.code);
console.log("PASS: Node GAS stub harness (admin bypass, PIN config/throttle, updated_at, conflict, daily IDs, timezone, diagnostics, RPC/error parity)");
