# Brief 03 — Multi-Role and Deployment

**Target skill:** gasly-pro, raw-idea path.

**Prompt:**

Tolong langsung buatkan aplikasi persetujuan reimburse biaya operasional karyawan. Ada role Staf (input pengajuan) dan Manajer Keuangan (approve/reject dan hapus data simulasi). Deploy menggunakan mode Execute as: User accessing the web app.

**Expected checks:**
- First response requests one Mini-Spec confirmation before code because role authorization and money are involved.
- Server-side authorization is specified for every read and write.
- USER_ACCESSING checks active email against manually configured OWNER_EMAIL or a server-side role ACL.
- No authorization is inferred from an undefined/empty payload.
- No default admin PIN is generated.
- Single-tenant boilerplate is not misrepresented as row-scoped multi-role access.
