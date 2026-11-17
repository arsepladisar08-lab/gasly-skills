<!-- KB_VERSION: 2.1.0 -->
# STACK ADAPTER: ASTRO (`stacks/astro.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-ui` ketika stack yang dipilih adalah `astro`.

## Daftar Isi
1. [Struktur Proyek & Konvensi `PUBLIC_GAS_EXEC_URL`](#1-struktur-proyek--konvensi-public_gas_exec_url)
2. [Strategi Build-Time Public Reads & Browser Island Writes](#2-strategi-build-time-public-reads--browser-island-writes)
3. [Kode Lengkap `src/lib/gasClient.ts` & `src/lib/driveImage.ts`](#3-kode-lengkap-srclibgasclientts--srclibdriveimagets)
4. [Kode Lengkap `src/pages/index.astro` (Build-Time Read + Interactive Island)](#4-kode-lengkap-srcpagesindexastro-build-time-read--interactive-island)

---

## 1. Struktur Proyek & Konvensi `PUBLIC_GAS_EXEC_URL`

```text
astro-gasly-app/
├── .env                                # PUBLIC_GAS_EXEC_URL=https://script.google.com/macros/s/<ID>/exec
├── astro.config.mjs
├── package.json                        # Menggunakan <<PIN_VERSION>> untuk astro dan @astrojs/tailwind
└── src/
    ├── styles/
    │   └── preset.css                  # Salinan CSS variabel preset (mis. editorial-light.css / warm-friendly.css)
    ├── lib/
    │   ├── gasClient.ts                # Klien HTTP text/plain POST/GET, retry idempoten, & memori token
    │   └── driveImage.ts               # Helper tunggal driveImageUrl(fileId, width) + fallback
    └── pages/
        └── index.astro                 # Frontmatter build-time GET + client-side interactive script
```

- **Satu Konfigurasi Lingkungan:** Di `.env`, tetapkan:
  `PUBLIC_GAS_EXEC_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec`
- Variabel berawalan `PUBLIC_` di Astro dapat diakses baik di dalam *frontmatter server/build* (`import.meta.env.PUBLIC_GAS_EXEC_URL`) maupun di dalam skrip interaktif sisi browser.

---

## 2. Strategi Build-Time Public Reads & Browser Island Writes

1. **Baca Publik Saat Build (`src/pages/index.astro` frontmatter):**
   - Saat `astro build` dijalankan, bagian frontmatter (`---`) mengambil data publik (`action=items.list&v=1`) dari URL `/exec` menggunakan `redirect: "follow"` dan merender HTML awal yang cepat serta ramah SEO.
2. **Pembaruan Langsung & Mutasi dari Browser:**
   - Aksi tulis (`items.create`, `file.ticket`, `file.upload`, `items.delete`) dan login admin (`auth.login` dengan token sesi di memori atau `sessionStorage` opsional) dieksekusi langsung dari browser ke URL `/exec` menggunakan `Content-Type: text/plain;charset=utf-8`.

---

## 3. Kode Lengkap `src/lib/gasClient.ts` & `src/lib/driveImage.ts`

```typescript
// FILE: src/lib/gasClient.ts
export interface GasEnvelope<T = unknown> {
  status: 'success' | 'error';
  data: T | null;
  message: string;
  code:
    | 'OK'
    | 'VALIDATION_ERROR'
    | 'NOT_FOUND'
    | 'FORBIDDEN'
    | 'CONFLICT'
    | 'LOCK_TIMEOUT'
    | 'INTERNAL_ERROR';
  meta: {
    schemaVersion?: string;
    timestamp: string;
    idempotentReplay?: boolean;
    retryAfterSeconds?: number;
  };
}

const SESSION_KEY = 'GASLY_ASTRO_SESSION_TOKEN';
let inMemoryToken: string | null = null;

export function getExecUrl(): string {
  return import.meta.env.PUBLIC_GAS_EXEC_URL || '';
}

export function getSessionToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window !== 'undefined') {
    try {
      return window.sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

export function setSessionToken(token: string | null, persistInTab = false): void {
  inMemoryToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token && persistInTab) {
        window.sessionStorage.setItem(SESSION_KEY, token);
      } else {
        window.sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {}
  }
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function gasPost<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  options: { idempotent?: boolean; idemKey?: string; timeoutMs?: number; maxRetries?: number } = {}
): Promise<GasEnvelope<T>> {
  const execUrl = getExecUrl();
  if (!execUrl || execUrl.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
    return {
      status: 'error',
      data: null,
      message: 'PUBLIC_GAS_EXEC_URL belum dikonfigurasi pada file .env.',
      code: 'VALIDATION_ERROR',
      meta: { timestamp: new Date().toISOString() }
    };
  }

  const isRead = action.endsWith('.list') || action.endsWith('.get');
  const isIdempotent = options.idempotent ?? !isRead;
  const idemKey = options.idemKey || (isIdempotent ? generateUuid() : null);
  const canRetry = isRead || Boolean(idemKey);
  const maxRetries = canRetry ? (options.maxRetries ?? 2) : 0;
  const timeoutMs = options.timeoutMs ?? 20000;

  const body = JSON.stringify({
    action,
    v: 1,
    auth: getSessionToken(),
    idem: idemKey,
    payload
  });

  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(execUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body,
        signal: controller.signal
      });
      const text = await res.text();
      const env = JSON.parse(text) as GasEnvelope<T>;

      if (env.code === 'FORBIDDEN' && !action.startsWith('auth.')) {
        setSessionToken(null, false);
      }
      if (env.code === 'LOCK_TIMEOUT' && attempt < maxRetries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
        continue;
      }
      return env;
    } catch (err) {
      if (attempt < maxRetries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
        continue;
      }
      return {
        status: 'error',
        data: null,
        message: err instanceof Error && err.name === 'AbortError'
          ? 'Permintaan melewati batas waktu tunggu (timeout).'
          : 'Gagal menghubungi endpoint Google Apps Script (/exec).',
        code: 'INTERNAL_ERROR',
        meta: { timestamp: new Date().toISOString() }
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function fetchBuildTimePublic<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<GasEnvelope<T>> {
  const execUrl = getExecUrl();
  if (!execUrl || execUrl.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
    return {
      status: 'error',
      data: null,
      message: 'PUBLIC_GAS_EXEC_URL belum dikonfigurasi.',
      code: 'VALIDATION_ERROR',
      meta: { timestamp: new Date().toISOString() }
    };
  }
  const url = new URL(execUrl);
  url.searchParams.set('action', action);
  url.searchParams.set('v', '1');
  if (Object.keys(payload).length > 0) {
    url.searchParams.set('payload', JSON.stringify(payload));
  }
  try {
    const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    return (await res.json()) as GasEnvelope<T>;
  } catch {
    return {
      status: 'error',
      data: null,
      message: 'Data build-time belum tersedia; akan dimuat ulang di browser.',
      code: 'INTERNAL_ERROR',
      meta: { timestamp: new Date().toISOString() }
    };
  }
}
```

```typescript
// FILE: src/lib/driveImage.ts
export function driveImageUrl(fileId: string | null | undefined, width = 800): string {
  const cleanId = String(fileId || '').trim();
  if (!cleanId) return '';
  const w = Math.max(64, Math.min(2400, Math.floor(width)));
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(cleanId)}&sz=w${w}`;
}

export function driveImageFallbackUrl(fileId: string | null | undefined, width = 800): string {
  const cleanId = String(fileId || '').trim();
  if (!cleanId) return '';
  const w = Math.max(64, Math.min(2400, Math.floor(width)));
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(cleanId)}=w${w}`;
}

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function formatIdr(val: unknown): string {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') return '-';
  const n = Number(val);
  return Number.isFinite(n) ? idr.format(n) : 'Data tidak valid';
}
```

---

## 4. Kode Lengkap `src/pages/index.astro` (Build-Time Read + Interactive Island)

```astro
---
// FILE: src/pages/index.astro
import '../styles/preset.css';
import { fetchBuildTimePublic } from '../lib/gasClient';
import { driveImageUrl, driveImageFallbackUrl, formatIdr } from '../lib/driveImage';

interface ItemRow {
  id: string;
  title: string;
  category: string;
  amount: number;
  file_id?: string;
}

const buildEnv = await fetchBuildTimePublic<{ items: ItemRow[] }>('items.list');
const initialItems = buildEnv.status === 'success' && buildEnv.data?.items ? buildEnv.data.items : [];
---

<!DOCTYPE html>
<html lang="id" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Katalog & Formulir Layanan — Gasly Astro</title>
  </head>
  <body style="background-color: var(--bg-base); color: var(--text-primary); font-family: var(--font-sans);" class="min-h-screen">
    <main class="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      <header class="space-y-2">
        <h1 style="font-family: var(--font-display);" class="text-3xl md:text-4xl font-bold tracking-tight">
          Katalog &amp; Pengajuan Layanan
        </h1>
        <p style="color: var(--text-secondary);" class="text-sm">
          Data katalog dimuat saat build-time dan pengajuan baru dikirim langsung ke Google Sheets &amp; Drive (/exec).
        </p>
      </header>

      <!-- Daftar Item Hasil Build-Time -->
      <section class="grid grid-cols-1 md:grid-cols-3 gap-4" id="catalog-grid">
        {initialItems.length === 0 ? (
          <p style="color: var(--text-helper);" class="text-sm md:col-span-3">
            Belum ada item katalog yang ditampilkan.
          </p>
        ) : (
          initialItems.map((item) => (
            <article
              style="background-color: var(--bg-surface); border: 1px solid var(--border-subtle);"
              class="p-4 rounded-xl space-y-3"
            >
              {item.file_id && (
                <img
                  src={driveImageUrl(item.file_id, 480)}
                  data-fallback={driveImageFallbackUrl(item.file_id, 480)}
                  onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.dataset.fallback;}"
                  referrerpolicy="no-referrer"
                  loading="lazy"
                  alt={item.title}
                  class="w-full h-40 object-cover rounded-lg"
                />
              )}
              <div class="flex items-center justify-between text-xs" style="color: var(--text-helper);">
                <span>{item.category}</span>
                <span class="font-mono">{item.id}</span>
              </div>
              <h2 class="text-base font-semibold">{item.title}</h2>
              <p class="text-sm font-bold tabular-nums">{formatIdr(item.amount)}</p>
            </article>
          ))
        )}
      </section>

      <!-- Client Island: Form Pengajuan + Kompresi Upload Foto -->
      <section
        style="background-color: var(--bg-surface); border: 1px solid var(--border-subtle);"
        class="p-6 rounded-xl space-y-4"
      >
        <h2 class="text-lg font-bold">Kirim Pengajuan Baru + Foto Bukti</h2>
        <form id="astro-submit-form" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="f-title" style="color: var(--text-secondary);" class="block text-xs font-semibold mb-1">
              Judul Pengajuan *
            </label>
            <input
              id="f-title"
              name="title"
              type="text"
              required
              minlength="3"
              maxlength="120"
              style="background-color: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle);"
              class="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm"
            />
          </div>
          <div>
            <label for="f-amount" style="color: var(--text-secondary);" class="block text-xs font-semibold mb-1">
              Nominal Estimasi (Rp) *
            </label>
            <input
              id="f-amount"
              name="amount"
              type="number"
              required
              min="0"
              style="background-color: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle);"
              class="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm tabular-nums"
            />
          </div>
          <div>
            <label for="f-photo" style="color: var(--text-secondary);" class="block text-xs font-semibold mb-1">
              Foto Lampiran (JPEG/PNG/WebP)
            </label>
            <input
              id="f-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style="background-color: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle);"
              class="w-full min-h-[42px] px-2 py-1.5 rounded-lg text-xs"
            />
            <p id="f-upload-state" aria-live="polite" style="color: var(--text-helper);" class="text-xs mt-1">
              [IDLE] Siap mengunggah
            </p>
          </div>
          <div class="md:col-span-3 flex justify-end">
            <button
              id="f-submit-btn"
              type="submit"
              style="background-color: var(--accent-solid); color: var(--accent-text-on-solid);"
              class="min-h-[44px] px-5 py-2 rounded-lg text-sm font-semibold"
            >
              Kirim Pengajuan
            </button>
          </div>
        </form>
      </section>
    </main>

    <script>
      import { gasPost, getSessionToken } from '../lib/gasClient';

      const form = document.getElementById('astro-submit-form') as HTMLFormElement | null;
      const btn = document.getElementById('f-submit-btn') as HTMLButtonElement | null;
      const stateEl = document.getElementById('f-upload-state');
      let busy = false;

      async function compressPhoto(file: File): Promise<{ fileName: string; mimeType: string; base64: string }> {
        const url = URL.createObjectURL(file);
        try {
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = () => rej(new Error('Gagal memuat gambar'));
            i.src = url;
          });
          const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
          const mime = file.type === 'image/png' ? 'image/webp' : file.type;
          const dataUrl = c.toDataURL(mime, 0.78);
          return { fileName: file.name, mimeType: mime, base64: dataUrl.split(',')[1] || '' };
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (busy || !btn || !stateEl) return;
        busy = true;
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';

        try {
          const fd = new FormData(form);
          const createEnv = await gasPost<{ item: { id: string } }>('items.create', {
            title: String(fd.get('title') || ''),
            category: 'Operasional',
            amount: Number(fd.get('amount') || 0),
            status: 'PENDING'
          });

          if (createEnv.status !== 'success' || !createEnv.data?.item) {
            stateEl.textContent = `[ERROR] ${createEnv.message}`;
            return;
          }

          const photoInput = document.getElementById('f-photo') as HTMLInputElement | null;
          const file = photoInput?.files?.[0];
          if (file) {
            stateEl.textContent = '[COMPRESSING] Mengompres foto...';
            const comp = await compressPhoto(file);
            stateEl.textContent = '[UPLOADING] Mengunggah foto ke Google Drive...';

            let ticket: string | null = null;
            if (!getSessionToken()) {
              const tEnv = await gasPost<{ ticket: string }>('file.ticket', {}, { idempotent: false });
              if (tEnv.status !== 'success' || !tEnv.data?.ticket) {
                stateEl.textContent = `[ERROR] ${tEnv.message}`;
                return;
              }
              ticket = tEnv.data.ticket;
            }

            const upEnv = await gasPost('file.upload', {
              entity: 'ITEMS',
              entityId: createEnv.data.item.id,
              fileName: comp.fileName,
              mimeType: comp.mimeType,
              base64: comp.base64,
              ticket
            });

            if (upEnv.status !== 'success') {
              stateEl.textContent = `[ERROR] ${upEnv.message}`;
              return;
            }
          }

          stateEl.textContent = '[DONE] Pengajuan dan foto berhasil disimpan.';
          form.reset();
        } finally {
          busy = false;
          btn.disabled = false;
          btn.textContent = 'Kirim Pengajuan';
        }
      });
    </script>
  </body>
</html>
```