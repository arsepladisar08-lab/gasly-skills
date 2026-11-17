<!-- KB_VERSION: 2.1.0 -->
# STACK ADAPTER: NEXT.JS (APP ROUTER) + SHADCN/UI (`stacks/nextjs-shadcn.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-ui` ketika stack yang dipilih adalah `nextjs` + `shadcn`.

## Daftar Isi
1. [Struktur Proyek & Konvensi `NEXT_PUBLIC_GAS_EXEC_URL`](#1-struktur-proyek--konvensi-next_public_gas_exec_url)
2. [Strategi Hybrid: Baca Publik Saat Build/ISR vs Tulis dari Browser](#2-strategi-hybrid-baca-publik-saat-buildisr-vs-tulis-dari-browser)
3. [Kode Lengkap `src/lib/gasClient.ts` & `src/lib/driveImage.ts`](#3-kode-lengkap-srclibgasclientts--srclibdriveimagets)
4. [Kode Lengkap `src/components/ImageUploader.tsx`](#4-kode-lengkap-srccomponentsimageuploadertsx)
5. [Kode Lengkap `src/app/page.tsx` (Server Component ISR) & `src/components/ItemsClientView.tsx`](#5-kode-lengkap-srcapppagetsx-server-component-isr--srccomponentsitemsclientviewtsx)

---

## 1. Struktur Proyek & Konvensi `NEXT_PUBLIC_GAS_EXEC_URL`

```text
nextjs-gasly-app/
├── .env.local                          # NEXT_PUBLIC_GAS_EXEC_URL=https://script.google.com/macros/s/<ID>/exec
├── package.json                        # Menggunakan <<PIN_VERSION>> untuk next, react, react-dom, tailwindcss
└── src/
    ├── app/
    │   ├── globals.css                 # Mengimpor CSS variabel preset (mis. dense-dashboard.css / aura.css)
    │   ├── layout.tsx
    │   └── page.tsx                    # Server Component: mengambil bacaan publik saat build / ISR revalidate
    ├── components/
    │   ├── ImageUploader.tsx           # Client Component: kompresi ~1 MB & 5 state aksesibel
    │   └── ItemsClientView.tsx         # Client Component: form mutasi, login admin, & konfirmasi hapus
    └── lib/
        ├── gasClient.ts                # Klien HTTP text/plain POST/GET, retry idempoten, & memori token
        └── driveImage.ts               # Helper tunggal driveImageUrl(fileId, width) + fallback
```

- **Satu Konfigurasi Lingkungan:** Buat `.env.local` dengan satu variabel publik:
  `NEXT_PUBLIC_GAS_EXEC_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec`
- **Dependensi `package.json`:** Gunakan penanda `<<PIN_VERSION>>` untuk `next`, `react`, `react-dom`, dan `tailwindcss` (dicatat di `VERIFY.md`).

---

## 2. Strategi Hybrid: Baca Publik Saat Build/ISR vs Tulis dari Browser

1. **Baca Publik pada Waktu Build / Revalidate (`P1` & `P3`):**
   - Server Component (`src/app/page.tsx`) memanggil `fetchPublicItemsServer()` menggunakan HTTP `GET` (`?action=items.list&v=1`) dengan `redirect: "follow"` dan `next: { revalidate: 60 }`.
   - Jika server Apps Script mengembalikan envelope `status !== "success"` (misalnya saat `LOCK_TIMEOUT`), Server Component tidak boleh melempar error yang merusak proses build statis, melainkan meneruskan state awal kosong + pesan peringatan agar Client Component dapat memuat ulang dari browser.
2. **Tulis & Aksi Terotentikasi dari Browser (`P3` & `P4`):**
   - Seluruh operasi mutasi (`items.create`, `items.update`, `items.delete`, `file.upload`) dan login (`auth.login`) dieksekusi langsung dari browser menggunakan `gasClient.ts` (`POST` `Content-Type: text/plain;charset=utf-8`).
   - Token sesi disimpan di variabel memori modul `gasClient.ts` (atau `sessionStorage` opsional; cookie `HttpOnly` tidak dimungkinkan karena perbedaan origin dengan `script.google.com`).

---

## 3. Kode Lengkap `src/lib/gasClient.ts` & `src/lib/driveImage.ts`

```typescript
// FILE: src/lib/gasClient.ts
export type GasEnvelope<T = unknown> = {
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
};

const SESSION_STORAGE_KEY = 'GASLY_NEXT_SESSION_TOKEN';
let memorySessionToken: string | null = null;

export function getExecUrl(): string {
  return process.env.NEXT_PUBLIC_GAS_EXEC_URL || '';
}

export function getSessionToken(): string | null {
  if (memorySessionToken) return memorySessionToken;
  if (typeof window !== 'undefined') {
    try {
      return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

export function setSessionToken(token: string | null, persistInSessionStorage = false): void {
  memorySessionToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token && persistInSessionStorage) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      } else {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage restriction in sandboxed contexts
    }
  }
}

export function clearSessionToken(): void {
  setSessionToken(null, false);
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface GasRequestOptions {
  idempotent?: boolean;
  idemKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Browser & Server compatible client for Google Apps Script /exec.
 * Sends POST with Content-Type: text/plain;charset=utf-8 to avoid CORS preflight.
 */
export async function gasRequest<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  options: GasRequestOptions = {}
): Promise<GasEnvelope<T>> {
  const execUrl = getExecUrl();
  if (!execUrl || execUrl.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
    return {
      status: 'error',
      data: null,
      message: 'NEXT_PUBLIC_GAS_EXEC_URL belum dikonfigurasi pada .env.local.',
      code: 'VALIDATION_ERROR',
      meta: { timestamp: new Date().toISOString() }
    };
  }

  const isRead = action.endsWith('.list') || action.endsWith('.get');
  const isIdempotent = options.idempotent ?? !isRead;
  const idemKey = options.idemKey || (isIdempotent ? generateIdempotencyKey() : null);
  const canRetry = isRead || Boolean(idemKey);
  const maxRetries = canRetry ? (options.maxRetries ?? 2) : 0;
  const timeoutMs = options.timeoutMs ?? 20000;

  const bodyString = JSON.stringify({
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
      const response = await fetch(execUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        redirect: 'follow',
        body: bodyString,
        signal: controller.signal
      });

      const rawText = await response.text();
      const envelope = JSON.parse(rawText) as GasEnvelope<T>;

      if (envelope.code === 'FORBIDDEN' && !action.startsWith('auth.')) {
        clearSessionToken();
      }

      if (envelope.code === 'LOCK_TIMEOUT' && attempt < maxRetries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
        continue;
      }

      return envelope;
    } catch (err) {
      if (attempt < maxRetries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
        continue;
      }
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        status: 'error',
        data: null,
        message: isAbort
          ? 'Permintaan ke server melewati batas waktu tunggu (timeout).'
          : 'Gagal terhubung ke endpoint Google Apps Script (/exec).',
        code: 'INTERNAL_ERROR',
        meta: { timestamp: new Date().toISOString() }
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Build-time / ISR public read helper for Next.js Server Components.
 */
export async function fetchPublicReadServer<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  revalidateSeconds = 60
): Promise<GasEnvelope<T>> {
  const execUrl = getExecUrl();
  if (!execUrl || execUrl.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
    return {
      status: 'error',
      data: null,
      message: 'NEXT_PUBLIC_GAS_EXEC_URL belum disetel.',
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
    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      next: { revalidate: revalidateSeconds }
    });
    const text = await res.text();
    return JSON.parse(text) as GasEnvelope<T>;
  } catch {
    return {
      status: 'error',
      data: null,
      message: 'Gagal memuat data awal pada saat build/revalidate.',
      code: 'INTERNAL_ERROR',
      meta: { timestamp: new Date().toISOString() }
    };
  }
}
```

```typescript
// FILE: src/lib/driveImage.ts
/**
 * Single helper for Google Drive image display URLs.
 * Primary: https://drive.google.com/thumbnail?id=<id>&sz=w<width>
 * Fallback: https://lh3.googleusercontent.com/d/<id>=w<width>
 */
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

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

export function formatCurrencyIdr(value: unknown): string {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return '-';
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 'Data tidak valid';
  }
  return idrFormatter.format(num);
}
```

---

## 4. Kode Lengkap `src/components/ImageUploader.tsx`

```tsx
// FILE: src/components/ImageUploader.tsx
'use client';

import React, { useState } from 'react';
import { gasRequest, getSessionToken } from '@/lib/gasClient';

export type UploadStatus = 'idle' | 'compressing' | 'uploading' | 'error' | 'done';

interface ImageUploaderProps {
  entity: string;
  entityId: string;
  onUploaded?: (result: { fileId: string; fileUrl: string }) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const TARGET_BYTES = 1024 * 1024;
const MAX_DIMENSION = 1600;

async function compressFileToBase64(file: File): Promise<{
  fileName: string;
  mimeType: string;
  base64: string;
}> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Format file harus JPEG, PNG, atau WebP.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal membaca gambar.'));
      el.src = objectUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Konteks canvas 2D tidak tersedia.');
    ctx.drawImage(img, 0, 0, width, height);

    const outMime = file.type === 'image/png' ? 'image/webp' : file.type;
    const qualities = [0.82, 0.68, 0.54, 0.42];
    let base64 = '';

    for (const q of qualities) {
      const dataUrl = canvas.toDataURL(outMime, q);
      base64 = dataUrl.split(',')[1] || '';
      if (Math.floor((base64.length * 3) / 4) <= TARGET_BYTES) {
        break;
      }
    }

    return {
      fileName: file.name,
      mimeType: outMime,
      base64
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ImageUploader({ entity, entityId, onUploaded }: ImageUploaderProps) {
  const [state, setState] = useState<UploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Pilih foto (maks. ~1 MB setelah kompresi).');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setState('compressing');
    setStatusMessage('Mengompres ukuran foto...');

    try {
      const compressed = await compressFileToBase64(file);
      setState('uploading');
      setStatusMessage('Mengunggah foto ke Google Drive...');

      let ticket: string | null = null;
      if (!getSessionToken()) {
        const ticketEnv = await gasRequest<{ ticket: string }>('file.ticket', {}, { idempotent: false });
        if (ticketEnv.status !== 'success' || !ticketEnv.data?.ticket) {
          setState('error');
          setStatusMessage(ticketEnv.message || 'Gagal memperoleh tiket unggah.');
          return;
        }
        ticket = ticketEnv.data.ticket;
      }

      const uploadEnv = await gasRequest<{ fileId: string; fileUrl: string }>(
        'file.upload',
        {
          entity,
          entityId,
          fileName: compressed.fileName,
          mimeType: compressed.mimeType,
          base64: compressed.base64,
          ticket
        },
        { idempotent: true }
      );

      if (uploadEnv.status !== 'success' || !uploadEnv.data) {
        setState('error');
        setStatusMessage(uploadEnv.message || 'Gagal mengunggah foto.');
        return;
      }

      setState('done');
      setStatusMessage('Foto berhasil disimpan ke Google Drive.');
      onUploaded?.(uploadEnv.data);
    } catch (err) {
      setState('error');
      setStatusMessage(err instanceof Error ? err.message : 'Gagal memproses foto.');
    }
  }

  return (
    <div className="space-y-1.5" aria-busy={state === 'compressing' || state === 'uploading'}>
      <label
        htmlFor={`uploader-${entityId}`}
        style={{ color: 'var(--text-secondary)' }}
        className="block text-xs font-semibold"
      >
        Unggah Foto Bukti
      </label>
      <input
        id={`uploader-${entityId}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={state === 'compressing' || state === 'uploading'}
        onChange={handleFileChange}
        style={{
          backgroundColor: 'var(--bg-base)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-subtle)'
        }}
        className="block w-full min-h-[42px] text-xs rounded-lg border px-2.5 py-1.5"
      />
      <p
        aria-live="polite"
        style={{
          color: state === 'error' ? 'var(--danger-solid)' : 'var(--text-helper)'
        }}
        className="text-xs"
      >
        [{state.toUpperCase()}] {statusMessage}
      </p>
    </div>
  );
}
```

---

## 5. Kode Lengkap `src/app/page.tsx` (Server Component ISR) & `src/components/ItemsClientView.tsx`

```tsx
// FILE: src/app/page.tsx
import React from 'react';
import { fetchPublicReadServer } from '@/lib/gasClient';
import { ItemsClientView, ItemRecord } from '@/components/ItemsClientView';

export default async function HomePage() {
  const initialEnvelope = await fetchPublicReadServer<{ items: ItemRecord[] }>('items.list', {}, 60);
  const initialItems = initialEnvelope.status === 'success' && initialEnvelope.data?.items
    ? initialEnvelope.data.items
    : [];

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6">
      <ItemsClientView
        initialItems={initialItems}
        initialError={initialEnvelope.status === 'error' ? initialEnvelope.message : null}
      />
    </main>
  );
}
```

```tsx
// FILE: src/components/ItemsClientView.tsx
'use client';

import React, { useState } from 'react';
import { gasRequest, setSessionToken, clearSessionToken } from '@/lib/gasClient';
import { driveImageUrl, driveImageFallbackUrl, formatCurrencyIdr } from '@/lib/driveImage';
import { ImageUploader } from '@/components/ImageUploader';

export interface ItemRecord {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  category: string;
  amount: number;
  status: string;
  file_id?: string;
  file_url?: string;
}

interface ItemsClientViewProps {
  initialItems: ItemRecord[];
  initialError: string | null;
}

export function ItemsClientView({ initialItems, initialError }: ItemsClientViewProps) {
  const [items, setItems] = useState<ItemRecord[]>(initialItems);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('Operasional');
  const [amount, setAmount] = useState<string>('');
  const [passphrase, setPassphrase] = useState<string>('');
  const [persistTab, setPersistTab] = useState<boolean>(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<ItemRecord | null>(null);

  async function refreshItems() {
    setIsLoading(true);
    setErrorMsg(null);
    const res = await gasRequest<{ items: ItemRecord[] }>('items.list', {});
    setIsLoading(false);
    if (res.status === 'success' && res.data?.items) {
      setItems(res.data.items);
    } else {
      setErrorMsg(res.message || 'Gagal memuat data.');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);

    const res = await gasRequest<{ item: ItemRecord }>('items.create', {
      title,
      category,
      amount: Number(amount),
      status: 'ACTIVE'
    });

    setIsSaving(false);
    if (res.status === 'success' && res.data?.item) {
      setTitle('');
      setAmount('');
      await refreshItems();
    } else {
      // Preserve form inputs on error (U-08 RECOVERY gate)
      setErrorMsg(res.message || 'Gagal menyimpan data.');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || isSaving) return;
    setIsSaving(true);
    const res = await gasRequest('items.delete', {
      id: deleteTarget.id,
      updated_at: deleteTarget.updated_at
    });
    setIsSaving(false);
    setDeleteTarget(null);
    if (res.status === 'success') {
      await refreshItems();
    } else {
      setErrorMsg(res.message || 'Gagal mengarsipkan data.');
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await gasRequest<{ token: string; role: string }>(
      'auth.login',
      { account: 'admin', passphrase },
      { idempotent: false, maxRetries: 0 }
    );
    if (res.status === 'success' && res.data?.token) {
      setSessionToken(res.data.token, persistTab);
      setPassphrase('');
      setIsAdminLoggedIn(true);
    } else {
      setErrorMsg(res.message || 'Login admin gagal.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Admin Auth Bar */}
      <section
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        className="p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Operasional</h1>
          <p style={{ color: 'var(--text-helper)' }} className="text-xs">
             pembacaan awal via ISR • penulisan langsung ke Apps Script (/exec)
          </p>
        </div>

        {!isAdminLoggedIn ? (
          <form onSubmit={handleAdminLogin} className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="admin-pass" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
                Passphrase Admin
              </label>
              <input
                id="admin-pass"
                type="password"
                required
                minLength={12}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                className="min-h-[42px] px-3 py-1.5 rounded-lg border text-sm"
              />
            </div>
            <label htmlFor="persist-tab" style={{ color: 'var(--text-helper)' }} className="flex items-center gap-1.5 text-xs py-2">
              <input
                id="persist-tab"
                type="checkbox"
                checked={persistTab}
                onChange={(e) => setPersistTab(e.target.checked)}
              />
              SessionStorage
            </label>
            <button
              type="submit"
              style={{ backgroundColor: 'var(--accent-solid)', color: 'var(--accent-text-on-solid)' }}
              className="min-h-[42px] px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Login Admin
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              clearSessionToken();
              setIsAdminLoggedIn(false);
            }}
            style={{ backgroundColor: 'var(--bg-interactive)', color: 'var(--text-primary)' }}
            className="min-h-[42px] px-4 py-2 rounded-lg text-sm font-medium"
          >
            Keluar Sesi Admin
          </button>
        )}
      </section>

      {errorMsg && (
        <div
          role="alert"
          style={{ backgroundColor: 'var(--danger-solid)', color: 'var(--danger-text-on-solid)' }}
          className="p-4 rounded-xl flex items-center justify-between gap-4 text-sm"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={refreshItems}
            className="min-h-[40px] px-3 py-1 rounded bg-black/20 font-semibold text-xs"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Create Form */}
      <form
        onSubmit={handleCreate}
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        className="p-5 rounded-xl border grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
      >
        <div>
          <label htmlFor="item-title" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
            Judul Transaksi *
          </label>
          <input
            id="item-title"
            type="text"
            required
            minLength={3}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
            className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm"
          />
        </div>
        <div>
          <label htmlFor="item-cat" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
            Kategori
          </label>
          <select
            id="item-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
            className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm"
          >
            <option value="Operasional">Operasional</option>
            <option value="Pemasaran">Pemasaran</option>
            <option value="Infrastruktur">Infrastruktur</option>
            <option value="Lisensi">Lisensi</option>
          </select>
        </div>
        <div>
          <label htmlFor="item-amt" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
            Nominal (Rp) *
          </label>
          <input
            id="item-amt"
            type="number"
            required
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
            className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm tabular-nums"
          />
        </div>
        <button
          type="submit"
          disabled={isSaving}
          style={{ backgroundColor: 'var(--accent-solid)', color: 'var(--accent-text-on-solid)' }}
          className="min-h-[42px] px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {isSaving ? 'Menyimpan...' : 'Tambah Data'}
        </button>
      </form>

      {/* Items Table */}
      <section
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        className="rounded-xl border overflow-x-auto p-4"
      >
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-10 rounded" style={{ backgroundColor: 'var(--bg-interactive)' }} />
            <div className="h-10 rounded" style={{ backgroundColor: 'var(--bg-interactive)' }} />
          </div>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--text-helper)' }} className="p-6 text-center text-sm">
            Belum ada data. Tambahkan transaksi pertama melalui formulir di atas.
          </p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ color: 'var(--text-helper)', borderColor: 'var(--border-subtle)' }} className="border-b text-xs uppercase">
                <th className="py-2 px-2">ID</th>
                <th className="py-2 px-2">Judul</th>
                <th className="py-2 px-2 text-right">Nominal</th>
                <th className="py-2 px-2">Foto Drive</th>
                <th className="py-2 px-2">Unggah Bukti</th>
                <th className="py-2 px-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} style={{ borderColor: 'var(--border-subtle)' }} className="border-b">
                  <td className="py-3 px-2 text-xs font-mono">{it.id}</td>
                  <td className="py-3 px-2 text-sm font-medium">{it.title}</td>
                  <td className="py-3 px-2 text-sm text-right tabular-nums font-semibold">
                    {formatCurrencyIdr(it.amount)}
                  </td>
                  <td className="py-3 px-2">
                    {it.file_id ? (
                      <img
                        src={driveImageUrl(it.file_id, 160)}
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.dataset.fallbackApplied !== 'true') {
                            target.dataset.fallbackApplied = 'true';
                            target.src = driveImageFallbackUrl(it.file_id, 160);
                          }
                        }}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        alt={`Bukti ${it.title}`}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <span style={{ color: 'var(--text-helper)' }} className="text-xs">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <ImageUploader entity="ITEMS" entityId={it.id} onUploaded={() => refreshItems()} />
                  </td>
                  <td className="py-3 px-2 text-right">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(it)}
                      style={{ backgroundColor: 'var(--danger-solid)', color: 'var(--danger-text-on-solid)' }}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold"
                    >
                      Arsipkan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Custom Confirmation Modal (W-01 Gate: never use window.confirm) */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-del-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            className="w-full max-w-md rounded-xl border p-6 space-y-4"
          >
            <h2 id="confirm-del-title" className="text-lg font-bold">Konfirmasi Pengarsipan</h2>
            <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
              Apakah Anda yakin ingin mengarsipkan transaksi <strong>{deleteTarget.title}</strong> ({deleteTarget.id})?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{ backgroundColor: 'var(--bg-interactive)', color: 'var(--text-primary)' }}
                className="min-h-[42px] px-4 py-2 rounded-lg text-sm"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmDelete}
                style={{ backgroundColor: 'var(--danger-solid)', color: 'var(--danger-text-on-solid)' }}
                className="min-h-[42px] px-4 py-2 rounded-lg text-sm font-semibold"
              >
                {isSaving ? 'Memproses...' : 'Ya, Arsipkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```