#!/usr/bin/env python3
"""
Gasly Universal Skills Compiler (build_skills.py)
Builds source files from src/ into dist/ using an atomic staging directory swap:
  1. dist/modular/gasly-prompt/   (SKILL.md + references/)
  2. dist/modular/gasly-data/     (SKILL.md + references/)
  3. dist/modular/gasly-ui/       (SKILL.md + references/)
  4. dist/modular/gasly-pro/      (SKILL.md [LEGACY] + references/)
  5. dist/flat/gasly-prompt/      (Legacy flat package)
  6. dist/flat/gasly-pro/         (Legacy flat package)
  7. dist/flat-lite/gasly-pro/    (Legacy flat-lite package without boilerplates.md)
  8. dist/manifest.json           (SKILL_VERSION, KB_VERSION, and SHA-256 per file)
"""

import argparse
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
SRC_DIR = ROOT_DIR / "src"
SRC_KB_DIR = SRC_DIR / "kb"
SRC_CORE_DIR = SRC_DIR / "core"
SRC_DESIGN_DIR = SRC_DIR / "design"
SRC_GAS_DIR = SRC_DIR / "gas"
SRC_STACKS_DIR = SRC_DIR / "stacks"
SRC_SKILLS_DIR = SRC_DIR / "skills"

DIST_DIR = ROOT_DIR / "dist"
STAGING_DIR = ROOT_DIR / ".dist_staging"

SKILL_VERSION = "2.2.0"
MAX_SKILL_BODY_LINES = 500
MAX_DESCRIPTION_CHARS = 1000
FLAT_WARN_CHARS = 48000
FLAT_MAX_CHARS = 95000

ALL_SKILLS = ["gasly-prompt", "gasly-data", "gasly-ui", "gasly-pro"]
LEGACY_FLAT_SKILLS = ["gasly-prompt", "gasly-pro"]

KB_ORDER = [
    "aura-design.md",
    "interaction-primitives.md",
    "app-ux.md",
    "landing-conversion.md",
    "gas-backend.md",
    "boilerplates.md",
]

CORE_FILES = ["contract.md", "access-profiles.md", "gates.md"]
DESIGN_DOCS = ["dials.md", "presets.md"]
GAS_FILES = [
    "config.md",
    "router-and-envelope.md",
    "auth-and-ratelimit.md",
    "sheets-repository.md",
    "drive-upload.md",
    "webhook-receiver.md",
]
STACK_FILES = [
    "html-tailwind.md",
    "nextjs-shadcn.md",
    "astro.md",
    "INHERIT.md",
    "PLANNED.md",
]

LIFECYCLE_FUNCTIONS = {"doGet", "include", "initialSetupDatabase", "runDiagnostics"}

VERSION_PATTERN = re.compile(r"<!--\s*KB_VERSION:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*-->")
DIGEST_PATTERN = re.compile(
    r"<!--\s*DIGEST:START\s*-->(.*?)<!--\s*DIGEST:END\s*-->",
    re.DOTALL,
)
FRONTMATTER_PATTERN = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def extract_version(content: str, label: str) -> str:
    match = VERSION_PATTERN.search(content)
    if not match:
        raise ValueError(f"[ERROR] Header <!-- KB_VERSION: x.y.z --> not found in {label}")
    return match.group(1)


def parse_and_validate_frontmatter(skill_slug: str, content: str) -> dict[str, str]:
    match = FRONTMATTER_PATTERN.match(content)
    if not match:
        raise ValueError(f"[ERROR] {skill_slug}/SKILL.md is missing valid YAML frontmatter (--- ... ---)")

    fm_block = match.group(1)
    name_match = re.search(r"^name:\s*(.+)$", fm_block, re.MULTILINE)
    if not name_match:
        raise ValueError(f"[ERROR] {skill_slug}/SKILL.md frontmatter is missing 'name'")
    parsed_name = name_match.group(1).strip()
    if parsed_name != skill_slug:
        raise ValueError(
            f"[ERROR] {skill_slug}/SKILL.md frontmatter name '{parsed_name}' does not match directory '{skill_slug}'"
        )

    desc_lines: list[str] = []
    in_desc = False
    for line in fm_block.splitlines():
        if line.startswith("description:"):
            in_desc = True
            inline_part = line.split("description:", 1)[1].strip()
            if inline_part and inline_part not in (">", "|", ">-", "|-"):
                desc_lines.append(inline_part)
            continue
        if in_desc:
            if re.match(r"^[a-zA-Z0-9_-]+:", line):
                break
            desc_lines.append(line.strip())

    description = " ".join(part for part in desc_lines if part).strip()
    if not description:
        raise ValueError(f"[ERROR] {skill_slug}/SKILL.md has an empty description")
    if len(description) > MAX_DESCRIPTION_CHARS:
        raise ValueError(
            f"[ERROR] {skill_slug}/SKILL.md description is {len(description)} chars "
            f"(exceeds max {MAX_DESCRIPTION_CHARS} chars)"
        )
    return {"name": parsed_name, "description": description}


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
            raise ValueError(f"[ERROR] Block <!-- DIGEST:START --> not found in {fname}")

        demoted_chunks = [demote_inner_headings(m.strip()) for m in matches]
        joined_digest = "\n\n".join(demoted_chunks)
        sections.append(f"## {heading_text}\n*(Sumber: `{fname}`)*\n\n{joined_digest}")

    checklist_heading = "7. Checklist Keputusan Spesifikasi"
    checklist_anchor = slugify_heading(checklist_heading)
    toc_lines.append(f"7. [Checklist Keputusan Spesifikasi](#{checklist_anchor})")

    checklist = f"""## {checklist_heading}
- [ ] **Versi KB Tercantum:** Header `KB_VERSION` ditulis eksplisit di dalam Master Prompt.
- [ ] **Access Profile & Identitas:** Profil (`P1`, `P3`, `P4`; `P2` berstatus `PLANNED`) dan mekanisme sesi ditetapkan.
- [ ] **Skema & Seed Idempoten:** Semua nama kolom menggunakan `snake_case`, tipe data mentah (Number & ISO Date ber-offset), penomoran urut per-hari, serta penanda `SEED-` + `SCHEMA_VERSION`.
- [ ] **Kontrak Konkurensi:** Setiap pembuatan ID harian atau mutasi data sensitif ditandai membutuhkan `LockService` + pengecekan `updated_at` (`CONFLICT`) + `SpreadsheetApp.flush()` sebelum `releaseLock()`.
- [ ] **De-Fabrikasi Bukti Bisnis:** Tidak ada angka klaim pelanggan, testimoni, logo, klaim bebas biaya server, atau harga tetap yang dikarang sendiri; semuanya memakai data pengguna atau slot `{{...}}`.
- [ ] **Kepatuhan Kontras & Aksesibilitas:** Seluruh pasangan warna preset lulus WCAG AA (`>= 4.5:1`), dan viewport tidak mematikan zoom."""

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
        raise ValueError("[ERROR] Failed to locate code.gs or index.html code blocks in boilerplates.md")

    code_gs = sec3_match.group(1)
    index_html = sec4_match.group(1)

    all_server_funcs = re.findall(r"^function\s+([A-Za-z0-9_]+)\s*\(", code_gs, re.MULTILINE)
    public_rpc_funcs = {
        fn
        for fn in all_server_funcs
        if not fn.endswith("_") and fn not in LIFECYCLE_FUNCTIONS
    }
    mock_actions = set(re.findall(r"actionName\s*===\s*['\"]([A-Za-z0-9_]+)['\"]", index_html))

    if not public_rpc_funcs or public_rpc_funcs != mock_actions:
        raise ValueError(
            f"[ERROR] Legacy RPC contract mismatch in boilerplates.md: "
            f"server={sorted(public_rpc_funcs)}, mock={sorted(mock_actions)}"
        )


def verify_headless_registry_handlers(gas_contents: dict[str, str]) -> None:
    router_md = gas_contents["router-and-envelope.md"]
    handlers_referenced = set(re.findall(r"handler:\s*([A-Za-z0-9_]+)", router_md))
    if not handlers_referenced:
        raise ValueError("[ERROR] No action handlers found in router-and-envelope.md")

    all_defined_funcs: set[str] = set()
    for text in gas_contents.values():
        all_defined_funcs.update(re.findall(r"^function\s+([A-Za-z0-9_]+)\s*\(", text, re.MULTILINE))

    missing = handlers_referenced - all_defined_funcs
    if missing:
        raise ValueError(f"[ERROR] Action registry handlers missing in src/gas/*.md: {sorted(missing)}")


def verify_line_budget(skill_name: str, content: str) -> int:
    line_count = len(content.splitlines())
    if line_count > MAX_SKILL_BODY_LINES:
        raise ValueError(
            f"[ERROR] {skill_name}/SKILL.md has {line_count} lines "
            f"(exceeds max {MAX_SKILL_BODY_LINES} lines)"
        )
    return line_count


def strip_boilerplates_from_routing_table(skill_md: str) -> str:
    """Removes the references/boilerplates.md row for the flat-lite package."""
    out = []
    for line in skill_md.splitlines():
        if "`references/boilerplates.md`" in line:
            continue
        out.append(line)
    return "\n".join(out)


def validate_and_report_flat_size(variant_label: str, content: str, strict_warn: bool = False) -> None:
    lines = len(content.splitlines())
    chars = len(content)
    if chars > FLAT_MAX_CHARS:
        raise ValueError(
            f"[ERROR] {variant_label} is {chars} chars ({lines} lines), exceeding hard limit {FLAT_MAX_CHARS}"
        )
    if strict_warn and chars > FLAT_WARN_CHARS:
        raise ValueError(
            f"[ERROR] {variant_label} is {chars} chars, exceeding flat-lite limit {FLAT_WARN_CHARS}"
        )
    status = "WARN" if chars > FLAT_WARN_CHARS else "OK"
    print(f"[{status}] {variant_label}: {lines} lines, {chars:,} chars")


def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    h.update(filepath.read_bytes())
    return h.hexdigest()


def load_markdown_group(directory: Path, filenames: list[str], versions: set[str]) -> dict[str, str]:
    loaded: dict[str, str] = {}
    for fname in filenames:
        fpath = directory / fname
        if not fpath.exists():
            raise FileNotFoundError(f"[ERROR] Required source file missing: {fpath}")
        text = fpath.read_text(encoding="utf-8")
        versions.add(extract_version(text, f"{directory.name}/{fname}"))
        loaded[fname] = text
    return loaded


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Gasly Universal Skills Compiler")
    parser.add_argument(
        "--allow-missing",
        action="store_true",
        help="Allow build to succeed if some skill templates are not present yet.",
    )
    args = parser.parse_args(argv)

    try:
        detected_versions: set[str] = set()
        kb_contents = load_markdown_group(SRC_KB_DIR, KB_ORDER, detected_versions)
        core_contents = load_markdown_group(SRC_CORE_DIR, CORE_FILES, detected_versions)
        design_doc_contents = load_markdown_group(SRC_DESIGN_DIR, DESIGN_DOCS, detected_versions)
        gas_contents = load_markdown_group(SRC_GAS_DIR, GAS_FILES, detected_versions)
        stack_contents = load_markdown_group(SRC_STACKS_DIR, STACK_FILES, detected_versions)

        if len(detected_versions) != 1:
            raise ValueError(f"[ERROR] Inconsistent KB_VERSION across source files: {sorted(detected_versions)}")

        kb_version = detected_versions.pop()
        print(f"[OK] Source files verified at KB_VERSION={kb_version}, SKILL_VERSION={SKILL_VERSION}")

        verify_boilerplate_rpc_contract(kb_contents["boilerplates.md"])
        verify_headless_registry_handlers(gas_contents)

        # Prepare clean staging directory
        if STAGING_DIR.exists():
            shutil.rmtree(STAGING_DIR)
        STAGING_DIR.mkdir(parents=True, exist_ok=True)

        spec_digest_content = build_spec_digest(kb_contents, kb_version)

        for skill_slug in ALL_SKILLS:
            src_skill_file = SRC_SKILLS_DIR / skill_slug / "SKILL.md"
            if not src_skill_file.exists():
                if args.allow_missing:
                    print(f"[WARN] Skipping missing {src_skill_file}")
                    continue
                raise FileNotFoundError(f"[ERROR] Missing skill file: {src_skill_file}")

            raw_skill = src_skill_file.read_text(encoding="utf-8")
            compiled_skill = raw_skill.replace("{{KB_VERSION}}", kb_version)
            parse_and_validate_frontmatter(skill_slug, compiled_skill)
            line_count = verify_line_budget(skill_slug, compiled_skill)

            mod_dir = STAGING_DIR / "modular" / skill_slug
            mod_ref_dir = mod_dir / "references"
            mod_ref_dir.mkdir(parents=True, exist_ok=True)
            (mod_dir / "SKILL.md").write_text(compiled_skill, encoding="utf-8")

            # Populate modular references per skill routing contract
            if skill_slug == "gasly-prompt":
                for fname, text in core_contents.items():
                    (mod_ref_dir / fname).write_text(text, encoding="utf-8")
                for fname, text in design_doc_contents.items():
                    (mod_ref_dir / fname).write_text(text, encoding="utf-8")
                (mod_ref_dir / "spec-digest.md").write_text(spec_digest_content, encoding="utf-8")

            elif skill_slug == "gasly-data":
                for fname, text in core_contents.items():
                    (mod_ref_dir / fname).write_text(text, encoding="utf-8")
                for fname, text in gas_contents.items():
                    (mod_ref_dir / fname).write_text(text, encoding="utf-8")

            elif skill_slug == "gasly-ui":
                for fname, text in core_contents.items():
                    (mod_ref_dir / fname).write_text(text, encoding="utf-8")
                for fname, text in design_doc_contents.items():
                    (mod_ref_dir / fname).write_text(text, encoding="utf-8")
                shutil.copy2(SRC_DESIGN_DIR / "tokens.schema.json", mod_ref_dir / "tokens.schema.json")
                presets_dst = mod_ref_dir / "presets"
                css_dst = mod_ref_dir / "css"
                presets_dst.mkdir(parents=True, exist_ok=True)
                css_dst.mkdir(parents=True, exist_ok=True)
                for pf in sorted((SRC_DESIGN_DIR / "presets").glob("*.tokens.json")):
                    shutil.copy2(pf, presets_dst / pf.name)
                for cf in sorted((SRC_DESIGN_DIR / "css").glob("*.css")):
                    shutil.copy2(cf, css_dst / cf.name)
                for fname, text in stack_contents.items():
                    (mod_ref_dir / fname).write_text(text, encoding="utf-8")

            elif skill_slug == "gasly-pro":
                for fname, text in kb_contents.items():
                    (mod_ref_dir / fname).write_text(text, encoding="utf-8")

            # Build legacy flat and flat-lite packages ONLY for gasly-prompt and gasly-pro
            if skill_slug == "gasly-prompt":
                flat_dir = STAGING_DIR / "flat" / skill_slug
                flat_dir.mkdir(parents=True, exist_ok=True)
                flat_content = (
                    compiled_skill
                    + "\n\n---\n\n# LAMPIRAN REFERENSI INLINE (FLAT MODE)\n\n"
                    + spec_digest_content
                )
                (flat_dir / "SKILL.md").write_text(flat_content, encoding="utf-8")
                validate_and_report_flat_size(f"flat/{skill_slug}", flat_content)

            elif skill_slug == "gasly-pro":
                inline_all = [kb_contents[k] for k in KB_ORDER]
                inline_lite = [kb_contents[k] for k in KB_ORDER if k != "boilerplates.md"]

                flat_dir = STAGING_DIR / "flat" / skill_slug
                flat_dir.mkdir(parents=True, exist_ok=True)
                flat_full_content = (
                    compiled_skill
                    + "\n\n---\n\n# LAMPIRAN REFERENSI INLINE (FLAT MODE)\n\n"
                    + "\n\n---\n\n".join(inline_all)
                )
                (flat_dir / "SKILL.md").write_text(flat_full_content, encoding="utf-8")
                validate_and_report_flat_size(f"flat/{skill_slug}", flat_full_content)

                flat_lite_dir = STAGING_DIR / "flat-lite" / skill_slug
                flat_lite_dir.mkdir(parents=True, exist_ok=True)
                lite_skill_body = strip_boilerplates_from_routing_table(compiled_skill)
                flat_lite_content = (
                    lite_skill_body
                    + "\n\n---\n\n# LAMPIRAN REFERENSI INLINE (FLAT-LITE MODE — TANPA BOILERPLATES)\n\n"
                    + "\n\n---\n\n".join(inline_lite)
                )
                (flat_lite_dir / "SKILL.md").write_text(flat_lite_content, encoding="utf-8")
                validate_and_report_flat_size(f"flat-lite/{skill_slug}", flat_lite_content, strict_warn=True)

            print(f"[OK] Modular {skill_slug}/SKILL.md built ({line_count}/{MAX_SKILL_BODY_LINES} lines)")

        # Generate dist/manifest.json with SHA-256 hashes
        files_manifest: dict[str, dict[str, int | str]] = {}
        for fpath in sorted(STAGING_DIR.rglob("*")):
            if fpath.is_file():
                rel_path = fpath.relative_to(STAGING_DIR).as_posix()
                files_manifest[rel_path] = {
                    "sha256": compute_sha256(fpath),
                    "bytes": fpath.stat().st_size,
                }

        manifest_data = {
            "skillVersion": SKILL_VERSION,
            "kbVersion": kb_version,
            "skills": {
                "gasly-prompt": {"mode": "active", "packages": ["modular", "flat"]},
                "gasly-data": {"mode": "active", "packages": ["modular"]},
                "gasly-ui": {"mode": "active", "packages": ["modular"]},
                "gasly-pro": {"mode": "legacy", "packages": ["modular", "flat", "flat-lite"]},
            },
            "files": files_manifest,
        }
        (STAGING_DIR / "manifest.json").write_text(
            json.dumps(manifest_data, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )

        # Atomic swap of staging directory into dist/
        if DIST_DIR.exists():
            shutil.rmtree(DIST_DIR)
        STAGING_DIR.rename(DIST_DIR)
        print(f"[OK] Build complete. {len(files_manifest)} files recorded in dist/manifest.json")
        return 0

    except Exception as exc:
        if STAGING_DIR.exists():
            shutil.rmtree(STAGING_DIR, ignore_errors=True)
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())