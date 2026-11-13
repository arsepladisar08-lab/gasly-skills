# Brief 04 — Camera Input and Schema Iteration

**Target skill:** gasly-pro in two turns in the same conversation.

**Prompt A:**

Buatkan aplikasi laporan inspeksi kebersihan ruangan dengan fitur ambil foto bukti dari HP, nilai skor kebersihan (0–100), dan catatan temuan.

**Prompt B:**

Tambahkan kolom lokasi_lantai pada form, tabel, dan database Sheet.

**Expected checks:**
- Camera input has an image capture attribute and file-picker fallback.
- Drive image URLs use safe loading behavior and an error fallback.
- Iteration lists changed and unchanged files.
- Schema migration is additive and idempotent.
- SCHEMA_VERSION is updated when schema changes.
- GAS deployment reminder is included for code changes.
