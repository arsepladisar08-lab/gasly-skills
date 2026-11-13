#!/usr/bin/env python3
"""
Gasly Universal Skills Compiler (build_skills.py)
Mengompilasi satu sumber kebenaran (src/kb/ & src/skills/) menjadi:
  1. dist/modular/gasly-prompt/   (SKILL.md + references/spec-digest.md)
  2. dist/modular/gasly-pro/      (SKILL.md + references/*.md)
  3. dist/flat/gasly-prompt/      (SKILL.md + spec-digest inline)
  4. dist/flat/gasly-pro/         (SKILL.md + seluruh KB inline)
  5. dist/flat-lite/gasly-pro/    (SKILL.md + KB tanpa boilerplates.md untuk platform berbatas karakter ketat)

Fitur Validasi:
  - Konsistensi KB_VERSION di seluruh file src/kb/*.md
  - Kontrak Paritas RPC antara fungsi publik code.gs dan handleMockAction_ di boilerplates.md
  - Batas baris badan SKILL.md (< 500 baris) dan pelaporan ukuran (baris & karakter) varian Flat
  - Penurunan level heading (## -> ###) dan pembuatan anchor eksplisit pada spec-digest.md
"""

import argparse
import re
import shutil
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
SRC_KB_DIR = ROOT_DIR / "src" / "kb"
SRC_SKILLS_DIR = ROOT_DIR / "src" / "skills"
DIST_MODULAR_DIR = ROOT_DIR / "dist" / "modular"
DIST_FLAT_DIR = ROOT_DIR / "dist" / "flat"
DIST_FLAT_LITE_DIR = ROOT_DIR / "dist" / "flat-lite"

MAX_SKILL_BODY_LINES = 500
FLAT_WARN_CHARS = 48000
FLAT_MAX_CHARS = 95000

KB_ORDER = [
    "aura-design.md",
    "interaction-primitives.md",
    "app-ux.md",
    "landing-conversion.md",
    "gas-backend.md",
    "boilerplates.md",
]

LIFECYCLE_FUNCTIONS = {"doGet", "include", "initialSetupDatabase", "runDiagnostics"}

VERSION_PATTERN = re.compile(r"<!--\s*KB_VERSION:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*-->")
DIGEST_PATTERN = re.compile(
    r"<!--\s*DIGEST:START\s*-->(.*?)<!--\s*DIGEST:END\s*-->",
    re.DOTALL,
)


def extract_version(content: str, filename: str) -> str:
    match = VERSION_PATTERN.search(content)
    if not match:
        raise ValueError(f"[ERROR] Header <!-- KB_VERSION: x.y.z --> tidak ditemukan di {filename}")
    return match.group(1)


def extract_title(content: str, fallback: str) -> str:
    for line in content.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return fallback


def slugify_heading(text: str) -> str:
    cleaned = text.strip().lower()
    cleaned = re.sub(r"[^\w\s-]", "", cleaned)
    cleaned = re.sub(r"[\s]+", "-", cleaned)
    return cleaned.strip("-")


def demote_inner_headings(markdown_block: str) -> str:
    """Menurunkan level heading di dalam blok digest (## -> ###, ### -> ####) di luar code fence."""
    out_lines = []
    in_code_block = False
    for line in markdown_block.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            out_lines.append(line)
            continue
        if not in_code_block and re.match(r"^#{2,5}\s+", line):
            out_lines.append("#" + line)
        else:
            out_lines.append(line)
    return "\n".join(out_lines)


def build_spec_digest(kb_contents: dict[str, str], kb_version: str) -> str:
    sections = []
    toc_lines = []

    for idx, fname in enumerate(KB_ORDER, start=1):
        raw = kb_contents[fname]
        title = extract_title(raw, fname)
        heading_text = f"{idx}. {title}"
        anchor = slugify_heading(heading_text)
        toc_lines.append(f"{idx}. [{title}](#{anchor})")

        matches = DIGEST_PATTERN.findall(raw)
        if not matches:
            raise ValueError(f"[ERROR] Blok <!-- DIGEST:START --> tidak ditemukan di {fname}")

        demoted_chunks = [demote_inner_headings(m.strip()) for m in matches]
        joined_digest = "\n\n".join(demoted_chunks)
        sections.append(f"## {heading_text}\n*(Sumber: `{fname}`)*\n\n{joined_digest}")

    checklist_heading = "7. Checklist Keputusan Spesifikasi"
    checklist_anchor = slugify_heading(checklist_heading)
    toc_lines.append(f"7. [Checklist Keputusan Spesifikasi](#{checklist_anchor})")

    checklist = f"""## {checklist_heading}
- [ ] **Versi KB Tercantum:** Header `KB_VERSION` ditulis eksplisit di dalam Master Prompt.
- [ ] **Mode Deploy & Identitas:** Kombinasi `Execute as` dan `Who has access` ditetapkan sesuai kebutuhan role/permission; verifikasi admin tidak menyalahgunakan `getActiveUser() == getEffectiveUser()` pada mode `USER_ACCESSING`.
- [ ] **Skema & Seed Idempoten:** Semua nama kolom menggunakan `snake_case`, tipe data mentah (Number & ISO Date ber-offset), penomoran urut per-hari, serta penanda `SEED-` + `SCHEMA_VERSION`.
- [ ] **Kontrak Konkurensi:** Setiap pembuatan ID harian atau mutasi data sensitif ditandai membutuhkan `LockService` + pengecekan `updated_at` (`CONFLICT`) + `SpreadsheetApp.flush()` sebelum `releaseLock()`.
- [ ] **De-Fabrikasi Bukti Bisnis:** Tidak ada angka klaim pelanggan, testimoni, logo, klaim bebas biaya server, atau harga tetap yang dikarang sendiri; semuanya memakai data pengguna atau slot `{{...}}`.
- [ ] **Kepatuhan Kontras & Aksesibilitas:** Teks body memakai token Primary/Secondary (`>= 4.5:1`), helper memakai `#8A8A93` (Dark) / `#526071` (Light), tombol putih memakai `#4F46E5`, dan viewport tidak mematikan zoom."""

    header = f"""<!-- KB_VERSION: {kb_version} -->
# GASLY ARCHITECT SPECIFICATION DIGEST & CHECKLIST
**KB_VERSION:** `{kb_version}`  
*File ini dikompilasi otomatis oleh `build_skills.py` dari sumber tunggal `src/kb/*.md`. Jangan diedit secara manual.*

## Daftar Isi
{chr(10).join(toc_lines)}

---

"""
    return header + "\n\n---\n\n".join(sections) + "\n\n---\n\n" + checklist + "\n"


def verify_boilerplate_rpc_contract(boilerplate_md: str) -> None:
    """
    Memastikan seluruh fungsi endpoint publik di bagian 3 (code.gs) identik dengan
    daftar actionName yang ditangani oleh handleMockAction_ di bagian 4 (index.html).
    """
    sec3_match = re.search(
        r"## 3\. Boilerplate `code\.gs`.*?\n```javascript\n(.*?)```",
        boilerplate_md,
        re.DOTALL,
    )
    sec4_match = re.search(
        r"## 4\. Boilerplate `index\.html`.*?\n```javascript\n(.*?)```",
        boilerplate_md,
        re.DOTALL,
    )
    if not sec3_match or not sec4_match:
        raise ValueError("[ERROR] Gagal menemukan blok kode code.gs atau index.html di boilerplates.md")

    code_gs = sec3_match.group(1)
    index_html = sec4_match.group(1)

    # Ambil seluruh deklarasi fungsi top-level (di awal baris) pada code.gs
    all_server_funcs = re.findall(r"^function\s+([A-Za-z0-9_]+)\s*\(", code_gs, re.MULTILINE)
    public_rpc_funcs = {
        fn
        for fn in all_server_funcs
        if not fn.endswith("_") and fn not in LIFECYCLE_FUNCTIONS
    }

    # Ambil seluruh cabang actionName === '...' di dalam index.html
    mock_actions = set(re.findall(r"actionName\s*===\s*['\"]([A-Za-z0-9_]+)['\"]", index_html))

    if not public_rpc_funcs:
        raise ValueError("[ERROR] Tidak ditemukan fungsi publik RPC di boilerplate code.gs")

    if public_rpc_funcs != mock_actions:
        only_server = sorted(public_rpc_funcs - mock_actions)
        only_mock = sorted(mock_actions - public_rpc_funcs)
        raise ValueError(
            f"[ERROR] Kontrak RPC boilerplates.md tidak sinkron!\n"
            f"  Hanya di Server (code.gs): {only_server}\n"
            f"  Hanya di Mock (index.html): {only_mock}"
        )

    print(f"[OK] Kontrak RPC boilerplates.md sinkron 100%: {sorted(public_rpc_funcs)}")


def verify_line_budget(skill_name: str, content: str) -> int:
    line_count = len(content.splitlines())
    if line_count > MAX_SKILL_BODY_LINES:
        raise ValueError(
            f"[ERROR] {skill_name}/SKILL.md memiliki {line_count} baris "
            f"(melebihi batas maksimum {MAX_SKILL_BODY_LINES} baris)!"
        )
    return line_count


def validate_and_report_flat_size(variant_label: str, content: str) -> None:
    lines = len(content.splitlines())
    chars = len(content)
    if chars > FLAT_MAX_CHARS:
        raise ValueError(
            f"[ERROR] Varian {variant_label} berukuran {chars} karakter ({lines} baris), "
            f"melebihi batas keras {FLAT_MAX_CHARS} karakter!"
        )
    status = "WARN (Mendekati batas platform kecil, gunakan flat-lite bila perlu)" if chars > FLAT_WARN_CHARS else "OK"
    print(f"[{status}] Ukuran {variant_label}: {lines} baris, {chars:,} karakter")


def main() -> int:
    parser = argparse.ArgumentParser(description="Gasly Universal Skills Compiler")
    parser.add_argument(
        "--allow-missing",
        action="store_true",
        help="Izinkan build berjalan meskipun template src/skills/*/SKILL.md belum lengkap.",
    )
    args = parser.parse_args()

    if not SRC_KB_DIR.exists():
        print(f"[ERROR] Folder sumber KB tidak ditemukan: {SRC_KB_DIR}", file=sys.stderr)
        return 1

    kb_contents: dict[str, str] = {}
    detected_versions: set[str] = set()

    for fname in KB_ORDER:
        fpath = SRC_KB_DIR / fname
        if not fpath.exists():
            print(f"[ERROR] File KB wajib tidak ditemukan: {fpath}", file=sys.stderr)
            return 1
        text = fpath.read_text(encoding="utf-8")
        ver = extract_version(text, fname)
        detected_versions.add(ver)
        kb_contents[fname] = text

    if len(detected_versions) != 1:
        print(f"[ERROR] Inkonsistensi KB_VERSION antar file: {detected_versions}", file=sys.stderr)
        return 1

    kb_version = detected_versions.pop()
    print(f"[OK] Seluruh {len(KB_ORDER)} file KB terverifikasi pada KB_VERSION: {kb_version}")

    # Uji kontrak fungsi publik code.gs vs handleMockAction_ di boilerplates.md
    verify_boilerplate_rpc_contract(kb_contents["boilerplates.md"])

    # Bersihkan folder dist lama
    if (ROOT_DIR / "dist").exists():
        shutil.rmtree(ROOT_DIR / "dist")

    spec_digest_content = build_spec_digest(kb_contents, kb_version)

    for skill_slug in ["gasly-prompt", "gasly-pro"]:
        src_skill_file = SRC_SKILLS_DIR / skill_slug / "SKILL.md"
        if not src_skill_file.exists():
            if args.allow_missing:
                print(f"[WARN] {src_skill_file} belum ada (--allow-missing aktif). Melewati {skill_slug}.")
                continue
            print(
                f"[ERROR] Template wajib tidak ditemukan: {src_skill_file} "
                f"(gunakan --allow-missing jika baru menguji KB).",
                file=sys.stderr,
            )
            return 1

        raw_skill = src_skill_file.read_text(encoding="utf-8")
        compiled_skill = raw_skill.replace("{{KB_VERSION}}", kb_version)
        line_count = verify_line_budget(skill_slug, compiled_skill)

        # 1. Output Modular
        mod_dir = DIST_MODULAR_DIR / skill_slug
        mod_ref_dir = mod_dir / "references"
        mod_ref_dir.mkdir(parents=True, exist_ok=True)
        (mod_dir / "SKILL.md").write_text(compiled_skill, encoding="utf-8")

        if skill_slug == "gasly-prompt":
            (mod_ref_dir / "spec-digest.md").write_text(spec_digest_content, encoding="utf-8")
            flat_content = (
                compiled_skill
                + "\n\n---\n\n# LAMPIRAN REFERENSI INLINE (FLAT MODE)\n\n"
                + spec_digest_content
            )
            flat_dir = DIST_FLAT_DIR / skill_slug
            flat_dir.mkdir(parents=True, exist_ok=True)
            (flat_dir / "SKILL.md").write_text(flat_content, encoding="utf-8")
            validate_and_report_flat_size(f"flat/{skill_slug}", flat_content)
        else:
            inline_all = []
            inline_lite = []
            for fname in KB_ORDER:
                (mod_ref_dir / fname).write_text(kb_contents[fname], encoding="utf-8")
                inline_all.append(kb_contents[fname])
                if fname != "boilerplates.md":
                    inline_lite.append(kb_contents[fname])

            # 2. Output Flat Penuh (Semua KB Inline)
            flat_full_content = (
                compiled_skill
                + "\n\n---\n\n# LAMPIRAN REFERENSI INLINE (FLAT MODE)\n\n"
                + "\n\n---\n\n".join(inline_all)
            )
            flat_dir = DIST_FLAT_DIR / skill_slug
            flat_dir.mkdir(parents=True, exist_ok=True)
            (flat_dir / "SKILL.md").write_text(flat_full_content, encoding="utf-8")
            validate_and_report_flat_size(f"flat/{skill_slug}", flat_full_content)

            # 3. Output Flat-Lite (Tanpa boilerplates.md untuk menghemat ~350 baris)
            flat_lite_content = (
                compiled_skill
                + "\n\n---\n\n# LAMPIRAN REFERENSI INLINE (FLAT-LITE MODE — TANPA BOILERPLATES)\n\n"
                + "\n\n---\n\n".join(inline_lite)
            )
            flat_lite_dir = DIST_FLAT_LITE_DIR / skill_slug
            flat_lite_dir.mkdir(parents=True, exist_ok=True)
            (flat_lite_dir / "SKILL.md").write_text(flat_lite_content, encoding="utf-8")
            validate_and_report_flat_size(f"flat-lite/{skill_slug}", flat_lite_content)

        print(f"[OK] Modular {skill_slug}/SKILL.md terverifikasi: {line_count}/{MAX_SKILL_BODY_LINES} baris")

    return 0


if __name__ == "__main__":
    sys.exit(main())