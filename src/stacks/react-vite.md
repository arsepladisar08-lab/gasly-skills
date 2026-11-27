<!-- KB_VERSION: 2.1.0 -->
# STACK ADAPTER: REACT (VITE + TYPESCRIPT + TAILWIND) (`stacks/react-vite.md`)
**KB_VERSION:** `2.1.0`  
**Kondisi Muat:** Dimuat oleh `gasly-ui` ketika stack yang dipilih adalah `react`.

## Daftar Isi
1. [Struktur Proyek, Konvensi `VITE_GAS_EXEC_URL` & Target Hosting](#1-struktur-proyek-konvensi-vite_gas_exec_url--target-hosting)
2. [Kode Lengkap `src/lib/gasClient.ts` (Transport `text/plain`, `auth.google`, Step-Up PIN & Isolasi Demo)](#2-kode-lengkap-srclibgasclientts-transport-textplain-authgoogle-step-up-pin--isolasi-demo)
3. [Kode Lengkap `src/lib/driveImage.ts` & `src/lib/mediaPlaceholders.ts` (`Gate W-08` & `W-10`)](#3-kode-lengkap-srclibdriveimagets--srclibmediaplaceholdersts-gate-w-08--w-10)
4. [Kode Lengkap `src/components/ImageUploader.tsx` (Kompresi ~1 MB, `uploadNonce` & State `RECOVERY`)](#4-kode-lengkap-srccomponentsimageuploadertsx-kompresi-1-mb-uploadnonce--state-recovery)
5. [Kode Lengkap `src/components/StepUpPinModal.tsx` (Modal Konfirmasi & PIN 6 Digit)](#5-kode-lengkap-srccomponentsstepuppinmodaltsx-modal-konfirmasi--pin-6-digit)
6. [Kode Lengkap `src/App.tsx` (Workspace End-to-End & Paritas Kontrak)](#6-kode-lengkap-srcapptsx-workspace-end-to-end--paritas-kontrak)

---

## 1. Struktur Proyek, Konvensi `VITE_GAS_EXEC_URL` & Target Hosting

```text
react-gasly-app/
├── .env                                # VITE_GAS_EXEC_URL=https://script.google.com/macros/s/<ID>/exec
├── index.html                          # Viewport aksesibel (tanpa user-scalable=no)
├── package.json                        # Menggunakan <<PIN_VERSION>> untuk vite, react, tailwindcss
└── src/
    ├── index.css                       # Mengimpor preset CSS (mis. dense-dashboard.css / warm-friendly.css) + Tailwind
    ├── lib/
    │   ├── gasClient.ts                # Klien HTTP text/plain POST, retry idempoten, memori token & auth.google
    │   ├── driveImage.ts               # Helper driveImageUrl (public) vs tautan aman file_url (private)
    │   └── mediaPlaceholders.ts        # Registry foto/video dummy (Unsplash/Pexels/Pixabay) + fallback SVG
    ├── components/
    │   ├── ImageUploader.tsx           # Kompresi <canvas> ~1 MB, file.ticket ber-uploadNonce & state RECOVERY
    │   └── StepUpPinModal.tsx          # Modal kustom 6-digit PIN (auth.verifyPin -> stepUpToken)
    └── App.tsx                         # Aplikasi SPA utama terhubung end-to-end ke /exec
```

### Konfigurasi Environment & Build per Hosting Target
- **Environment Variable (`.env`):**
  - `VITE_GAS_EXEC_URL=https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec`
  - `VITE_GOOGLE_CLIENT_ID=` *(opsional, wajib diisi jika `auth_google_enabled: true`)*
- **Build Output Statis (SPA):** Perintah build `npm run build`, direktori output `dist/`.
  - **Cloudflare Pages (`cloudflare_pages` — Default Komersial Gratis):** Build command `npm run build`, output `dist`. SPA routing otomatis via fallback `index.html`.
  - **Sevalla (`sevalla` — Komersial Gratis s/d kuota):** Pilih Static Site, build command `npm run build`, publish directory `dist`, atur fallback `index.html`.
  - **Netlify (`netlify` — Komersial, kuota kredit):** Build `npm run build`, publish `dist`, tambahkan `public/_redirects` berisi `/* /index.html 200`.
  - **Firebase Hosting (`firebase_hosting` — Komersial Spark/Blaze):** Setel `"public": "dist"` dan rewrite `** -> /index.html` di `firebase.json`.
  - **Vercel (`vercel_pro` untuk komersial / `vercel_hobby_noncommercial` untuk personal):** Framework Preset `Vite`, output `dist`.
  - **GitHub Pages (`github_pages_demo` — Demo Non-Komersial Saja):** Setel `base` di `vite.config.ts` sesuai nama repositori.

---

## 2. Kode Lengkap `src/lib/gasClient.ts` (Transport `text/plain`, `auth.google`, Step-Up PIN & Isolasi Demo)

```typescript
// FILE: src/lib/gasClient.ts
export type GasCode =
  | 'OK'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'LOCK_TIMEOUT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface GasEnvelope<T = unknown> {
  status: 'success' | 'error';
  data: T | null;
  message: string;
  code: GasCode;
  meta: {
    schemaVersion?: string;
    timestamp: string;
    idempotentReplay?: boolean;
    retryAfterSeconds?: number;
  };
}

export interface SessionInfo {
  token: string;
  sub: string;
  role: string;
  expiresAt?: string;
}

const SESSION_STORAGE_KEY = 'GASLY_REACT_SESSION_TOKEN';
let memorySessionToken: string | null = null;

export function getExecUrl(): string {
  return String(import.meta.env.VITE_GAS_EXEC_URL || '').trim();
}

export function getGoogleClientId(): string {
  return String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
}

/**
 * Gate W-09: Demo controls and runtime URL switcher are ONLY allowed when
 * no production /exec URL is configured in build environment variables.
 */
export function isSimulationMode(): boolean {
  const url = getExecUrl();
  return !url || url.includes('REPLACE_WITH_DEPLOYMENT_ID');
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

export function setSessionToken(token: string | null, persistInTab = false): void {
  memorySessionToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token && persistInTab) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      } else {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Abaikan jika sandbox memblokir sessionStorage; memori tetap aktif
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
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface GasRequestOptions {
  idempotent?: boolean;
  idemKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Single HTTP client for Google Apps Script /exec.
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
      message: 'VITE_GAS_EXEC_URL belum dikonfigurasi pada file .env.',
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

export async function loginWithPassphrase(
  account: string,
  passphrase: string,
  persistInTab = false
): Promise<GasEnvelope<SessionInfo>> {
  const res = await gasRequest<SessionInfo>(
    'auth.login',
    { account: account || 'admin', passphrase },
    { idempotent: false, maxRetries: 0 }
  );
  if (res.status === 'success' && res.code === 'OK' && res.data?.token) {
    setSessionToken(res.data.token, persistInTab);
  }
  return res;
}

/**
 * Matches backend handleAuthGoogle_ contract: payload key MUST be `idToken` (camelCase).
 */
export async function loginWithGoogleIdToken(
  idToken: string,
  persistInTab = false
): Promise<GasEnvelope<SessionInfo>> {
  const res = await gasRequest<SessionInfo>(
    'auth.google',
    { idToken },
    { idempotent: false, maxRetries: 0 }
  );
  if (res.status === 'success' && res.code === 'OK' && res.data?.token) {
    setSessionToken(res.data.token, persistInTab);
  }
  return res;
}

export async function verifyStepUpPin(
  pin: string,
  targetAction: 'items.delete' | 'admin.purgeSeed' | 'file.delete' | 'auth.setCredentials'
): Promise<GasEnvelope<{ stepUpToken: string; targetAction: string; expiresInSeconds: number }>> {
  return gasRequest(
    'auth.verifyPin',
    { pin, targetAction },
    { idempotent: false, maxRetries: 0 }
  );
}

export async function logoutSession(): Promise<void> {
  try {
    await gasRequest('auth.logout', {}, { idempotent: false, maxRetries: 0 });
  } finally {
    clearSessionToken();
  }
}
```

---

## 3. Kode Lengkap `src/lib/driveImage.ts` & `src/lib/mediaPlaceholders.ts` (`Gate W-08` & `W-10`)

```typescript
// FILE: src/lib/driveImage.ts
/**
 * Single helper for PUBLIC Google Drive images (Gate W-08).
 * For CONFIDENTIAL / SENSITIVE_PII entities (visibility: 'private'), DO NOT render
 * public thumbnails—render a safe external link to `file_url` instead (Gate U-10).
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

/**
 * Gate U-07: Never hide null/undefined/NaN values as "Rp 0".
 */
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

```typescript
// FILE: src/lib/mediaPlaceholders.ts
/**
 * Gate W-10: Centralized external stock media placeholders (Unsplash, Pexels, Pixabay, Coverr/Mixkit).
 * - Never use deprecated `source.unsplash.com`.
 * - Never hotlink expiring AI signed URLs (e.g., Magnific AI outputs should be saved to public/assets/).
 * - Never disguise stock portraits as real customer testimonials (Gate U-03).
 */
export interface PlaceholderMediaAsset {
  type: 'image' | 'video';
  url: string;
  poster?: string;
  alt: string;
  source: string;
  isPlaceholder: true;
}

export const MEDIA_PLACEHOLDERS: Record<string, PlaceholderMediaAsset> = {
  heroCover: {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    alt: 'Ilustrasi ruang kerja operasional (gambar contoh)',
    source: 'Unsplash (Placeholder)',
    isPlaceholder: true
  },
  catalogSample: {
    type: 'image',
    url: 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800',
    alt: 'Ilustrasi kolaborasi tim (gambar contoh)',
    source: 'Pexels (Placeholder)',
    isPlaceholder: true
  },
  ambientShowcaseVideo: {
    type: 'video',
    url: 'https://videos.pexels.com/video-files/3129671/3129671-sd_640_360_30fps.mp4',
    poster: 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1200',
    alt: 'Video latar ilustratif (video contoh)',
    source: 'Pexels Videos (Placeholder)',
    isPlaceholder: true
  }
};

export function createSvgFallbackDataUri(label = 'Gambar Contoh'): string {
  const safe = String(label).replace(/[<>&"']/g, '').slice(0, 48);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
    <rect width="100%" height="100%" fill="#E2E8F0"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      font-family="sans-serif" font-size="22" fill="#475569">${safe}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function shouldAutoplayVideo(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

---

## 4. Kode Lengkap `src/components/ImageUploader.tsx` (Kompresi ~1 MB, `uploadNonce` & State `RECOVERY`)

```tsx
// FILE: src/components/ImageUploader.tsx
import React, { useState } from 'react';
import { gasRequest, getSessionToken } from '../lib/gasClient';

export type UploadStatus = 'idle' | 'compressing' | 'uploading' | 'error' | 'done';

interface ImageUploaderProps {
  entity: string;
  entityId: string;
  /** Wajib diisi pada alur upload publik (P3) dari respons items.create */
  uploadNonce?: string | null;
  onUploaded?: (result: { fileId: string; fileUrl: string; visibility: string }) => void;
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
      el.onerror = () => reject(new Error('Gagal membaca gambar untuk kompresi.'));
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

    return { fileName: file.name, mimeType: outMime, base64 };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ImageUploader({ entity, entityId, uploadNonce, onUploaded }: ImageUploaderProps) {
  const [state, setState] = useState<UploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Pilih foto bukti (otomatis dikompres ~1 MB).');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function executeUpload(file: File) {
    setState('compressing');
    setStatusMessage('Mengompres ukuran foto...');

    try {
      const compressed = await compressFileToBase64(file);
      setState('uploading');
      setStatusMessage('Mengunggah foto ke Google Drive...');

      let ticket: string | null = null;
      if (!getSessionToken()) {
        if (!uploadNonce) {
          setState('error');
          setStatusMessage('Token uploadNonce record tidak tersedia untuk unggahan publik.');
          return;
        }
        const ticketRes = await gasRequest<{ ticket: string }>(
          'file.ticket',
          { entity, entityId, uploadNonce },
          { idempotent: false, maxRetries: 0 }
        );
        if (ticketRes.status !== 'success' || ticketRes.code !== 'OK' || !ticketRes.data?.ticket) {
          setState('error');
          setStatusMessage(ticketRes.message || 'Gagal memperoleh tiket unggah.');
          return;
        }
        ticket = ticketRes.data.ticket;
      }

      // Gate W-09: Simpan respons ke variabel dan verifikasi status + code secara ketat
      const uploadRes = await gasRequest<{ fileId: string; fileUrl: string; visibility: string }>(
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

      if (uploadRes.status !== 'success' || uploadRes.code !== 'OK' || !uploadRes.data) {
        setState('error');
        setStatusMessage(uploadRes.message || 'Gagal mengunggah foto ke Google Drive.');
        return;
      }

      setState('done');
      setStatusMessage('Foto berhasil diunggah dan ditautkan ke record.');
      onUploaded?.(uploadRes.data);
    } catch (err) {
      setState('error');
      setStatusMessage(err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses foto.');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file) {
      void executeUpload(file);
    }
  }

  return (
    <div className="space-y-2" aria-busy={state === 'compressing' || state === 'uploading'}>
      <label
        htmlFor={`uploader-${entityId}`}
        style={{ color: 'var(--text-secondary)' }}
        className="block text-xs font-semibold"
      >
        Unggah Foto Bukti (JPEG/PNG/WebP)
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
        style={{ color: state === 'error' ? 'var(--danger-solid)' : 'var(--text-helper)' }}
        className="text-xs"
      >
        [{state.toUpperCase()}] {statusMessage}
      </p>
      {state === 'error' && selectedFile && (
        <button
          type="button"
          onClick={() => void executeUpload(selectedFile)}
          style={{
            backgroundColor: 'var(--accent-solid)',
            color: 'var(--accent-text-on-solid)'
          }}
          className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold"
        >
          Unggah Ulang Foto Saja (Tanpa Duplikasi Data)
        </button>
      )}
    </div>
  );
}
```

---

## 5. Kode Lengkap `src/components/StepUpPinModal.tsx` (Modal Konfirmasi & PIN 6 Digit)

```tsx
// FILE: src/components/StepUpPinModal.tsx
import React, { useEffect, useState } from 'react';
import { verifyStepUpPin } from '../lib/gasClient';

interface StepUpPinModalProps {
  open: boolean;
  title: string;
  description: string;
  targetAction: 'items.delete' | 'admin.purgeSeed' | 'file.delete' | 'auth.setCredentials';
  confirmLabel?: string;
  onCancel: () => void;
  onVerified: (stepUpToken: string) => Promise<void>;
}

export function StepUpPinModal({
  open,
  title,
  description,
  targetAction,
  confirmLabel = 'Verifikasi & Lanjutkan',
  onCancel,
  onVerified
}: StepUpPinModalProps) {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isBusy) onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isBusy, onCancel]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy) return;
    if (!/^\d{6}$/.test(pin.trim())) {
      setErrorMsg('Masukkan tepat 6 digit angka PIN.');
      return;
    }

    setIsBusy(true);
    setErrorMsg(null);
    const pinRes = await verifyStepUpPin(pin.trim(), targetAction);
    if (pinRes.status !== 'success' || pinRes.code !== 'OK' || !pinRes.data?.stepUpToken) {
      setIsBusy(false);
      setErrorMsg(pinRes.message || 'Verifikasi PIN gagal.');
      return;
    }

    try {
      await onVerified(pinRes.data.stepUpToken);
      setPin('');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stepup-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onCancel();
      }}
    >
      <div
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        className="w-full max-w-md rounded-xl border p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="stepup-modal-title" className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Tutup dialog konfirmasi"
            disabled={isBusy}
            onClick={onCancel}
            className="min-w-[40px] min-h-[40px] text-lg"
          >
            &times;
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
          {description}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="stepup-pin-input"
              style={{ color: 'var(--text-secondary)' }}
              className="block text-xs font-semibold mb-1"
            >
              PIN Step-Up Admin (6 Digit Angka) *
            </label>
            <input
              id="stepup-pin-input"
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{
                backgroundColor: 'var(--bg-base)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-subtle)'
              }}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm font-mono tracking-widest"
            />
          </div>

          {errorMsg && (
            <p role="alert" style={{ color: 'var(--danger-solid)' }} className="text-xs font-medium">
              {errorMsg}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={onCancel}
              style={{ backgroundColor: 'var(--bg-interactive)', color: 'var(--text-primary)' }}
              className="min-h-[42px] px-4 py-2 rounded-lg text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isBusy}
              style={{ backgroundColor: 'var(--danger-solid)', color: 'var(--danger-text-on-solid)' }}
              className="min-h-[42px] px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {isBusy ? 'Memverifikasi...' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## 6. Kode Lengkap `src/App.tsx` (Workspace End-to-End & Paritas Kontrak)

```tsx
// FILE: src/App.tsx
import React, { useEffect, useState } from 'react';
import {
  gasRequest,
  getSessionToken,
  isSimulationMode,
  loginWithPassphrase,
  logoutSession
} from './lib/gasClient';
import { driveImageUrl, driveImageFallbackUrl, formatCurrencyIdr } from './lib/driveImage';
import { MEDIA_PLACEHOLDERS, createSvgFallbackDataUri } from './lib/mediaPlaceholders';
import { ImageUploader } from './components/ImageUploader';
import { StepUpPinModal } from './components/StepUpPinModal';

interface ItemRecord {
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

const ENTITY_IS_PRIVATE = true; // Sesuaikan dengan data_classification di GASLY_CONTRACT_JSON (Gate U-10)

export default function App() {
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Operasional');
  const [amount, setAmount] = useState('');

  // Menyimpan uploadNonce hasil items.create untuk alur upload publik (P3)
  const [pendingUpload, setPendingUpload] = useState<{ entityId: string; uploadNonce: string } | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => Boolean(getSessionToken()));
  const [passphrase, setPassphrase] = useState('');
  const [persistTab, setPersistTab] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ItemRecord | null>(null);

  async function loadItems() {
    setIsLoading(true);
    setErrorMsg(null);
    const res = await gasRequest<{ items: ItemRecord[] }>('items.list', {});
    setIsLoading(false);
    if (res.status === 'success' && res.code === 'OK' && res.data?.items) {
      setItems(res.data.items);
    } else {
      setErrorMsg(res.message || 'Gagal memuat daftar data.');
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    setNoticeMsg(null);

    const res = await gasRequest<{ item: ItemRecord; uploadNonce?: string }>('items.create', {
      title,
      category,
      amount: Number(amount),
      status: 'ACTIVE'
    });

    setIsSaving(false);
    if (res.status === 'success' && res.code === 'OK' && res.data?.item) {
      setTitle('');
      setAmount('');
      setNoticeMsg(`Data ${res.data.item.id} berhasil disimpan.`);
      if (res.data.uploadNonce) {
        setPendingUpload({ entityId: res.data.item.id, uploadNonce: res.data.uploadNonce });
      }
      await loadItems();
    } else {
      // Pertahankan ketikan form saat gagal (Gate U-08 RECOVERY)
      setErrorMsg(res.message || 'Gagal menyimpan data.');
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const res = await loginWithPassphrase('admin', passphrase, persistTab);
    if (res.status === 'success' && res.code === 'OK') {
      setPassphrase('');
      setIsLoggedIn(true);
      setNoticeMsg('Login berhasil.');
      await loadItems();
    } else {
      setErrorMsg(res.message || 'Login gagal.');
    }
  }

  async function handleDeleteWithStepUp(stepUpToken: string) {
    if (!deleteTarget) return;
    const res = await gasRequest('items.delete', {
      id: deleteTarget.id,
      expected_updated_at: deleteTarget.updated_at,
      stepUpToken
    });
    setDeleteTarget(null);
    if (res.status === 'success' && res.code === 'OK') {
      setNoticeMsg(`Data ${deleteTarget.id} berhasil diarsipkan.`);
      await loadItems();
    } else {
      setErrorMsg(res.message || 'Gagal mengarsipkan data.');
    }
  }

  return (
    <div
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
      className="min-h-screen"
    >
      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header + Visual Cover Placeholder (Gate W-10) */}
        <header
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          className="rounded-xl border overflow-hidden"
        >
          <div className="h-36 w-full relative overflow-hidden">
            <img
              src={MEDIA_PLACEHOLDERS.heroCover.url}
              alt={MEDIA_PLACEHOLDERS.heroCover.alt}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = createSvgFallbackDataUri('Ilustrasi Operasional');
              }}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Portal Operasional Gasly (React)</h1>
              <p style={{ color: 'var(--text-helper)' }} className="text-xs">
                {isSimulationMode()
                  ? 'Mode Konfigurasi Lokal (VITE_GAS_EXEC_URL belum diisi)'
                  : 'Terhubung ke Google Apps Script Headless API (/exec)'}
              </p>
            </div>

            {!isLoggedIn ? (
              <form onSubmit={handleLogin} className="flex flex-wrap items-end gap-2">
                <div>
                  <label
                    htmlFor="login-passphrase"
                    style={{ color: 'var(--text-secondary)' }}
                    className="block text-xs font-semibold mb-1"
                  >
                    Passphrase Admin (Min. 12 Karakter)
                  </label>
                  <input
                    id="login-passphrase"
                    type="password"
                    required
                    minLength={12}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-base)',
                      color: 'var(--text-primary)',
                      borderColor: 'var(--border-subtle)'
                    }}
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
                onClick={async () => {
                  await logoutSession();
                  setIsLoggedIn(false);
                  setNoticeMsg('Sesi berhasil diakhiri.');
                }}
                style={{ backgroundColor: 'var(--bg-interactive)', color: 'var(--text-primary)' }}
                className="min-h-[42px] px-4 py-2 rounded-lg text-sm font-medium"
              >
                Keluar Sesi
              </button>
            )}
          </div>
        </header>

        {errorMsg && (
          <div
            role="alert"
            style={{ backgroundColor: 'var(--danger-solid)', color: 'var(--danger-text-on-solid)' }}
            className="p-4 rounded-xl flex items-center justify-between gap-4 text-sm"
          >
            <span>{errorMsg}</span>
            <button type="button" onClick={() => void loadItems()} className="min-h-[40px] px-3 py-1 rounded bg-black/20 text-xs font-semibold">
              Coba Lagi
            </button>
          </div>
        )}

        {noticeMsg && (
          <div
            role="status"
            aria-live="polite"
            style={{ backgroundColor: 'var(--success-solid)', color: 'var(--success-text-on-solid)' }}
            className="p-3 rounded-xl text-sm font-medium"
          >
            {noticeMsg}
          </div>
        )}

        {/* Form Tambah Transaksi */}
        <form
          onSubmit={handleCreate}
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          className="p-5 rounded-xl border grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label htmlFor="f-title" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
              Judul Transaksi *
            </label>
            <input
              id="f-title"
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
            <label htmlFor="f-cat" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
              Kategori
            </label>
            <select
              id="f-cat"
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
            <label htmlFor="f-amt" style={{ color: 'var(--text-secondary)' }} className="block text-xs font-semibold mb-1">
              Nominal (Rp) *
            </label>
            <input
              id="f-amt"
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
            {isSaving ? 'Menyimpan...' : 'Simpan Transaksi'}
          </button>
        </form>

        {/* Panel Unggah Bukti Pasca-Create (Mengirim uploadNonce yang valid) */}
        {pendingUpload && (
          <section
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-focus)' }}
            className="p-4 rounded-xl border space-y-2"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Lampirkan Foto Bukti untuk {pendingUpload.entityId}</h2>
              <button
                type="button"
                onClick={() => setPendingUpload(null)}
                className="min-h-[40px] px-3 text-xs underline"
              >
                Lewati
              </button>
            </div>
            <ImageUploader
              entity="ITEMS"
              entityId={pendingUpload.entityId}
              uploadNonce={pendingUpload.uploadNonce}
              onUploaded={async () => {
                setPendingUpload(null);
                await loadItems();
              }}
            />
          </section>
        )}

        {/* Tabel Data */}
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
              Belum ada data tercatat. Gunakan formulir di atas untuk membuat transaksi pertama.
            </p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ color: 'var(--text-helper)', borderColor: 'var(--border-subtle)' }} className="border-b text-xs uppercase">
                  <th className="py-2 px-2">ID</th>
                  <th className="py-2 px-2">Judul</th>
                  <th className="py-2 px-2 text-right">Nominal</th>
                  <th className="py-2 px-2">Lampiran</th>
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
                      {it.file_id && ENTITY_IS_PRIVATE ? (
                        <a
                          href={it.file_url || `https://drive.google.com/file/d/${encodeURIComponent(it.file_id)}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--border-focus)' }}
                          className="text-xs font-semibold underline"
                        >
                          Buka Dokumen Privat (Drive)
                        </a>
                      ) : it.file_id ? (
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
                          alt={`Lampiran ${it.title}`}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <span style={{ color: 'var(--text-helper)' }} className="text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {isLoggedIn && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(it)}
                          style={{ backgroundColor: 'var(--danger-solid)', color: 'var(--danger-text-on-solid)' }}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold"
                        >
                          Arsipkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      <StepUpPinModal
        open={Boolean(deleteTarget)}
        title="Konfirmasi Pengarsipan"
        description={
          deleteTarget
            ? `Masukkan PIN 6 digit untuk mengarsipkan transaksi "${deleteTarget.title}" (${deleteTarget.id}).`
            : ''
        }
        targetAction="items.delete"
        confirmLabel="Ya, Arsipkan"
        onCancel={() => setDeleteTarget(null)}
        onVerified={handleDeleteWithStepUp}
      />
    </div>
  );
}