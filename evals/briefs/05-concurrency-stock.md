# Brief 05 — Concurrent Stock Mutations

**Target skill:** gasly-prompt then gasly-pro.

**Prompt:**

Buatkan aplikasi kasir pengambilan barang gudang (mutasi stok keluar/masuk) yang dipakai oleh lima staf gudang secara bersamaan di jam sibuk.

**Expected checks:**
- Stock mutations use LockService and handle LOCK_TIMEOUT.
- Update/delete require updated_at and return CONFLICT for stale records.
- ID sequences are calculated per local day inside the lock.
- Flush happens before lock release in mutation flows.
- Optimistic UI does not show stock mutations as committed before server success.
