#!/usr/bin/env python3
"""
GASLY DETERMINISTIC OUTPUT & REGRESSION VERIFIER
Menguji kepatuhan kode hasil generasi (Backend .gs, Frontend UI, dan Contract JSON)
terhadap 6 kegagalan nyata dari benchmark Gudang, Klinik, dan PajakRapi.

Cara pakai:
  python3 tools/verify_output.py --contract gasly.project.json --backend setup.gs code.gs --frontend page.tsx
"""

import argparse
import json
import re
import sys
from pathlib import Path


def read_combined(paths: list[str]) -> str:
    content = []
    for p in paths:
        path_obj = Path(p)
        if not path_obj.exists():
            print(f"[FATAL] File tidak ditemukan: {p}")
            sys.exit(2)
        content.append(path_obj.read_text(encoding="utf-8"))
    return "\n".join(content)


def check_unreplaced_placeholders(all_text: str, failures: list[str]) -> None:
    if "{{KB_VERSION}}" in all_text:
        failures.append(
            "GATE-KB-VERSION: Ditemukan placeholder mentah '{{KB_VERSION}}' yang belum diisi versi rilis."
        )


def check_sensitive_drive_privacy(contract: dict, backend_text: str, failures: list[str]) -> None:
    """
    Tes #1 (Kasus PajakRapi): Entitas sensitif dilarang keras memakai visibility 'public'
    atau DriveApp.Access.ANYONE_WITH_LINK.
    """
    sensitive_entities = []
    for ent in contract.get("entities", []):
        if ent.get("data_classification") in ("CONFIDENTIAL", "SENSITIVE_PII"):
            sensitive_entities.append(ent["sheet_name"])
            drive_cfg = ent.get("drive_upload", {})
            if drive_cfg.get("enabled") and drive_cfg.get("visibility") != "private":
                failures.append(
                    f"GATE-SENSITIVE-DATA: Entitas sensitif '{ent['sheet_name']}' memiliki "
                    f"drive_upload.visibility='{drive_cfg.get('visibility')}' (Wajib 'private')."
                )

    for sheet_name in sensitive_entities:
        # Cek apakah di setup.gs / code.gs entitas ini diset defaultVisibility: 'public'
        pattern = rf"{re.escape(sheet_name)}\s*:\s*\{{[^}}]*defaultVisibility\s*:\s*['\"]public['\"]"
        if re.search(pattern, backend_text, re.DOTALL):
            failures.append(
                f"GATE-SENSITIVE-DATA: Backend menyetel defaultVisibility: 'public' pada entitas sensitif '{sheet_name}'."
            )


def check_public_lookup_anti_enum(contract: dict, backend_text: str, failures: list[str]) -> None:
    """
    Tes #2 (Kasus PajakRapi submissions.track): Endpoint lookup publik wajib memakai
    token berentropi tinggi (bukan sekadar 4 digit WA) dan wajib memiliki rate limit CacheService.
    """
    for act in contract.get("actions", []):
        if act.get("public_lookup"):
            name = act["name"]
            if not act.get("rate_limited") or not act.get("requires_high_entropy_token"):
                failures.append(
                    f"GATE-ANTI-ENUM: Action lookup publik '{name}' di kontrak belum mengaktifkan "
                    "rate_limited=true dan requires_high_entropy_token=true."
                )
            # Pastikan tidak hanya mengandalkan 4 digit terakhir WA tanpa tracking_token
            if "whatsapp_last4" in backend_text and "tracking_token" not in backend_text:
                failures.append(
                    f"GATE-ANTI-ENUM: Action '{name}' di backend masih mengandalkan 'whatsapp_last4' "
                    "tanpa 'tracking_token' berentropi tinggi."
                )


def check_upload_result_verification(frontend_text: str, failures: list[str]) -> None:
    """
    Tes #3 (Kasus Regresi @gasly-pro PajakRapi): Setiap panggilan 'file.upload' di frontend
    WAJIB memeriksa status/code hasil upload sebelum menampilkan banner sukses.
    """
    upload_calls = list(re.finditer(r"callGasAction[^;]*?['\"]file\.upload['\"].*?\);", frontend_text, re.DOTALL))
    for match in upload_calls:
        stmt = match.group(0)
        start_pos = match.start()
        preceding = frontend_text[max(0, start_pos - 60) : start_pos + len(stmt)]
        # Jika dipanggil sebagai `await callGasAction('file.upload', ...)` tanpa disimpan ke variabel
        if not re.search(r"(const|let|var)\s+\w+\s*=\s*await\s+callGasAction", preceding):
            failures.append(
                "GATE-UPLOAD-INTEGRITY: Panggilan 'file.upload' di frontend tidak disimpan ke variabel "
                "dan tidak diperiksa status keberhasilannya sebelum menampilkan pesan sukses (Regresi Tahap Pro)."
            )


def check_spec_to_ui_bindings(contract: dict, frontend_text: str, failures: list[str]) -> None:
    """
    Tes #4 (Kasus Gudang auth.google): Setiap action yang ui_bound=true atau auth_google_enabled=true
    wajib memiliki titik panggil nyata di kode frontend.
    """
    if contract.get("architecture", {}).get("auth_google_enabled"):
        if "auth.google" not in frontend_text:
            failures.append(
                "GATE-SPEC-UI-SYNC: Kontrak mengaktifkan 'auth_google_enabled: true', tetapi frontend "
                "tidak memanggil action 'auth.google' (Tombol Google Sign-In hilang di UI)."
            )

    for act in contract.get("actions", []):
        if act.get("ui_bound"):
            act_name = act["name"]
            if act_name not in frontend_text:
                failures.append(
                    f"GATE-SPEC-UI-SYNC: Action '{act_name}' ditandai ui_bound=true pada kontrak, "
                    "tetapi tidak pernah dipanggil di kode frontend."
                )


def check_seed_and_envelope_consistency(
    contract: dict, backend_text: str, frontend_text: str, failures: list[str]
) -> None:
    """
    Tes #5 (Kasus Gudang vs PajakRapi):
    - Envelope status wajib ('success' | 'error') sesuai Gate U-04, dilarang memakai 'ok' atau 'OK'.
    - Seed data dilarang menggunakan array posisi 2D mentah pada setValues.
    """
    status_values = contract.get("envelope_spec", {}).get("status_values")
    if status_values is not None and status_values != ["success", "error"]:
        failures.append(
            f"GATE-ENVELOPE-DRIFT (U-04): envelope_spec.status_values bernilai {status_values} "
            "(Wajib ['success', 'error'])."
        )

    if re.search(r"createResponse_\(\s*['\"](?:OK|ok)['\"]", backend_text):
        failures.append(
            "GATE-ENVELOPE-DRIFT (U-04): Backend menggunakan status 'OK'/'ok' pada createResponse_ "
            "(Standar kontrak mewajibkan status: 'success' | 'error' dan code: 'OK')."
         )

    combined = backend_text + "\n" + frontend_text
    if re.search(
        r"""(?:\.status\s*===\s*['"](?:ok|OK)['"]|['"]?status['"]?\s*:\s*['"](?:ok|OK)['"])""",
        combined,
    ):
        failures.append(
            "GATE-ENVELOPE-DRIFT (U-04): Ditemukan penggunaan status 'ok'/'OK' pada kode "
            "(Standar kontrak mewajibkan status: 'success' | 'error')."
        )

    # Cek apakah seedItems masih menggunakan array literal 2D [['SEED-...', ...]]
    if re.search(r"var\s+seed\w+\s*=\s*\[\s*\[", backend_text):
        failures.append(
            "GATE-SCHEMA-SEED: Fungsi seed di setup.gs masih menggunakan Array Posisi 2D '[[...]]' "
            "yang rawan crash saat jumlah kolom bertambah. Gunakan Array of Objects '[{...}]'."
        )

def check_anti_slop_and_web_gates(frontend_text: str, failures: list[str]) -> None:
    """
    Tes #6 (Anti-Slop & Web Gates sesuai VERIFY.md Seksi 3 dan core/gates.md):
    - Gate W-01: Larangan window.confirm( atau window.alert(
    - Gate W-05: Larangan user-scalable=no atau maximum-scale=1.0 pada viewport
    - Gate W-08: Larangan URL Drive lama drive.google.com/uc?export=view
    - Gate U-03: Larangan klaim fabrikasi hardcoded
    """
    if re.search(r"\bwindow\.(?:confirm|alert)\s*\(", frontend_text):
        failures.append(
            "GATE-WEB-MODAL (W-01): Ditemukan pemanggilan window.confirm() atau window.alert(). "
            "Gunakan modal konfirmasi atau toast kustom yang aksesibel."
        )

    if re.search(r"user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?\b", frontend_text, re.IGNORECASE):
        failures.append(
            "GATE-WEB-VIEWPORT (W-05): Meta viewport mematikan zoom pengguna (user-scalable=no / maximum-scale=1.0)."
        )

    if "drive.google.com/uc?export=view" in frontend_text:
        failures.append(
            "GATE-DRIVE-IMAGE (W-08): Ditemukan URL 'drive.google.com/uc?export=view'. "
            "Gunakan helper tunggal driveImageUrl(fileId, width)."
        )

    if re.search(r"10[.,]000\+\s*UMKM|Tanpa Biaya Server Tambahan|99\.99%\s*uptime", frontend_text, re.IGNORECASE):
        failures.append(
            "GATE-ANTI-FABRICATION (U-03): Ditemukan klaim bisnis/uptime fabrikasi yang di-hardcode di frontend."
        )

def main() -> int:
    parser = argparse.ArgumentParser(description="Gasly Deterministic Output Verifier")
    parser.add_argument("--contract", required=True, help="Path ke gasly.project.json")
    parser.add_argument("--backend", nargs="+", required=True, help="Path ke file .gs backend")
    parser.add_argument("--frontend", nargs="+", required=True, help="Path ke file frontend")
    args = parser.parse_args()

    contract = json.loads(Path(args.contract).read_text(encoding="utf-8"))
    backend_text = read_combined(args.backend)
    frontend_text = read_combined(args.frontend)
    all_text = backend_text + "\n" + frontend_text

    failures: list[str] = []

    check_unreplaced_placeholders(all_text, failures)
    check_sensitive_drive_privacy(contract, backend_text, failures)
    check_public_lookup_anti_enum(contract, backend_text, failures)
    check_upload_result_verification(frontend_text, failures)
    check_spec_to_ui_bindings(contract, frontend_text, failures)
    check_seed_and_envelope_consistency(contract, backend_text, frontend_text, failures)
    check_anti_slop_and_web_gates(frontend_text, failures)

    print("=" * 72)
    print(f"GASLY DETERMINISTIC VERIFICATION — PROJECT: {contract.get('project', {}).get('name')}")
    print("=" * 72)

    if failures:
        for idx, fail in enumerate(failures, 1):
            print(f"[FAIL #{idx}] {fail}")
        print("=" * 72)
        print(f"STATUS AKHIR: FAILED ({len(failures)} pelanggaran gerbang keras ditemukan).")
        return 1

    print("[PASS] Seluruh 6 gerbang deterministik lulus pemeriksaan.")
    print("STATUS AKHIR: TESTED (Siap lanjut ke verifikasi runtime GAS).")
    return 0


if __name__ == "__main__":
    sys.exit(main())