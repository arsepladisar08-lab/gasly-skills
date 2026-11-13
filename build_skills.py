#!/usr/bin/env python3
"""Deterministic GASLY skill compiler with staged, atomic distribution publishing."""
from __future__ import annotations
import argparse, hashlib, json, re, shutil, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC_KB = ROOT / "src" / "kb"
SRC_SKILLS = ROOT / "src" / "skills"
DIST = ROOT / "dist"
PRODUCT_VERSION = "0.2.1"
MAX_SKILL_BODY_LINES = 500
FLAT_WARN_CHARS = 48000
FLAT_MAX_CHARS = 95000
KB_ORDER = ["aura-design.md", "interaction-primitives.md", "app-ux.md",
            "landing-conversion.md", "gas-backend.md", "boilerplates.md"]
FLAT_LITE_ORDER = [name for name in KB_ORDER if name != "boilerplates.md"]
SKILLS = ["gasly-prompt", "gasly-pro"]
LIFECYCLE = {"doGet", "include", "initialSetupDatabase", "runDiagnostics"}
TICK = chr(96)
FENCE = TICK * 3
VERSION_RE = re.compile(r"<!--\s*KB_VERSION:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*-->")
DIGEST_RE = re.compile(r"<!--\s*DIGEST:START\s*-->(.*?)<!--\s*DIGEST:END\s*-->", re.S)


def read_version(text, name):
    match = VERSION_RE.search(text)
    if not match:
        raise ValueError("KB_VERSION missing: " + name)
    return match.group(1)


def read_skill_version(text, name):
    for line in text.splitlines():
        if line.startswith("**SKILL_VERSION:**"):
            return line.split(":", 1)[1].strip().strip(TICK).strip()
    raise ValueError("SKILL_VERSION missing: " + name)


def title_of(text, fallback):
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return fallback


def slug(text):
    text = re.sub(r"[^\w\s-]", "", text.strip().lower())
    return re.sub(r"\s+", "-", text).strip("-")


def demote(block):
    result, inside = [], False
    for line in block.splitlines():
        if line.lstrip().startswith(FENCE):
            inside = not inside
            result.append(line)
        elif not inside and re.match(r"^#{2,5}\s+", line):
            result.append("#" + line)
        else:
            result.append(line)
    return "\n".join(result)


def make_digest(kbs, version):
    sections, toc = [], []
    for index, name in enumerate(KB_ORDER, 1):
        title = title_of(kbs[name], name)
        heading = str(index) + ". " + title
        toc.append(str(index) + ". [" + title + "](#" + slug(heading) + ")")
        chunks = DIGEST_RE.findall(kbs[name])
        if not chunks:
            raise ValueError("DIGEST markers missing: " + name)
        content = "\n\n".join(chunk.strip() for chunk in chunks)
        sections.append("## " + heading + "\n*(Sumber: " + TICK + name + TICK + ")*\n\n" + content)
    title = "7. Checklist Keputusan Spesifikasi"
    toc.append("7. [" + title + "](#" + slug(title) + ")")
    checklist = """## 7. Checklist Keputusan Spesifikasi
- [ ] Versi KB tercantum di dalam Master Prompt.
- [ ] Mode deployment dan identitas admin ditetapkan; operasi admin tidak memiliki bypass tanpa argumen.
- [ ] Nama kolom snake_case, tipe data mentah, penomoran per hari, dan penanda SEED- + SCHEMA_VERSION.
- [ ] Mutasi sensitif memakai LockService, updated_at wajib, dan SpreadsheetApp.flush() sebelum releaseLock().
- [ ] Tidak ada klaim pelanggan, testimoni, logo, biaya, atau harga yang dikarang.
- [ ] Kontras teks normal memenuhi WCAG AA (>= 4.5:1) dan viewport tidak mematikan zoom."""
    header = ("<!-- KB_VERSION: " + version + " -->\n# GASLY ARCHITECT SPECIFICATION DIGEST & CHECKLIST\n"
              "**KB_VERSION:** " + TICK + version + TICK + "  \n"
              "*Dikompilasi otomatis dari src/kb/*.md; jangan diedit manual.*\n\n"
              "## Daftar Isi\n" + "\n".join(toc) + "\n\n---\n\n")
    return header + "\n\n---\n\n".join(sections) + "\n\n---\n\n" + checklist + "\n"


def replace_routing(body, table):
    pattern = re.compile(r"## 2\. PEMUATAN REFERENSI \(ROUTING TABLE\).*?(?=\n## 3\.)", re.S)
    if not pattern.search(body):
        raise ValueError("Routing table section 2 missing")
    return pattern.sub(table.rstrip() + "\n\n", body, count=1)


def make_routing(kind, refs, excluded=None):
    lines = ["## 2. PEMUATAN REFERENSI (ROUTING TABLE)", ""]
    if kind == "lite":
        lines += ["**Mode distribusi: Flat Lite. Referensi berikut sengaja dikecualikan:**"]
        for name in excluded or []:
            lines.append("- references/" + name + " — dikecualikan; isi referensi tidak tersedia di paket ini.")
        lines += ["", "Untuk topik yang memerlukan referensi yang dikecualikan, nyatakan keterbatasannya dan minta konteks sumber atau gunakan paket Modular/Flat penuh.", ""]
    else:
        lines += ["Baca referensi sesuai kondisi berikut:", "",
                  "| File Referensi | Kondisi Muat | Kapan Digunakan |", "|---|---|---|"]
        for name in refs:
            if name == "spec-digest.md":
                condition, when = "Selalu Dimuat", "Ringkasan spesifikasi bersama dan checklist."
            elif name in ("aura-design.md", "interaction-primitives.md", "gas-backend.md", "boilerplates.md"):
                condition, when = "Selalu Dimuat", "Saat tugas menyentuh UI, backend, atau implementasi."
            elif name == "app-ux.md":
                condition, when = "Kondisional (App/Dashboard)", "Dashboard, portal, atau internal tool."
            else:
                condition, when = "Kondisional (Landing Page)", "Landing page dan situs pemasaran."
            lines.append("| references/" + name + " | " + condition + " | " + when + " |")
        lines += ["", "Fallback: bila referensi tidak tersedia, nyatakan Mode Referensi Mandiri dan jangan mengklaim telah membacanya.", ""]
    return "\n".join(lines)


def check_rpc(md):
    server_heading = "## 3. Boilerplate " + TICK + "code.gs" + TICK
    client_heading = "## 4. Boilerplate " + TICK + "index.html" + TICK
    server_pattern = re.escape(server_heading) + r".*?\n" + FENCE + r"javascript\n(.*?)" + FENCE
    client_pattern = re.escape(client_heading) + r".*?\n" + FENCE + r"javascript\n(.*?)" + FENCE
    server = re.search(server_pattern, md, re.S)
    client = re.search(client_pattern, md, re.S)
    if not server or not client:
        raise ValueError("code.gs/index.html code fences missing")
    functions = re.findall(r"^function\s+([A-Za-z0-9_]+)\s*\(", server.group(1), re.M)
    public = {name for name in functions if not name.endswith("_") and name not in LIFECYCLE}
    mock = set(re.findall(r"actionName\s*===\s*['\"]([A-Za-z0-9_]+)['\"]", client.group(1)))
    # runDiagnostics is a separately guarded lifecycle/admin endpoint, not a CRUD action.
    mock.discard("runDiagnostics")
    if not public or public != mock:
        raise ValueError("RPC action-name mismatch: server-only=" + str(sorted(public-mock)) + " mock-only=" + str(sorted(mock-public)))


def write_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.replace("\r\n", "\n").replace("\r", "\n"), encoding="utf-8", newline="\n")


def check_lines(name, text):
    count = len(text.splitlines())
    if count > MAX_SKILL_BODY_LINES:
        raise ValueError(name + " exceeds line budget: " + str(count))


def check_flat(name, text):
    size, lines = len(text), len(text.splitlines())
    if size > FLAT_MAX_CHARS:
        raise ValueError(name + " exceeds hard size limit: " + str(size))
    print("[" + ("WARN" if size > FLAT_WARN_CHARS else "OK") + "] " + name + ": " + str(lines) + " lines, " + format(size, ",") + " chars")


def build(stage, allow_missing):
    kbs = {}
    for name in KB_ORDER:
        path = SRC_KB / name
        if not path.exists():
            raise FileNotFoundError("Required KB missing: " + str(path))
        kbs[name] = path.read_text(encoding="utf-8")
    versions = {read_version(text, name) for name, text in kbs.items()}
    if len(versions) != 1:
        raise ValueError("KB_VERSION mismatch: " + str(sorted(versions)))
    version = versions.pop()
    check_rpc(kbs["boilerplates.md"])
    digest = make_digest(kbs, version)
    manifest = {"product": "GASLY Skills", "product_version": PRODUCT_VERSION,
                "kb_version": version, "skills": {}, "generated_files": {}}

    for name in SKILLS:
        source = SRC_SKILLS / name / "SKILL.md"
        if not source.exists() and allow_missing:
            continue
        raw = source.read_text(encoding="utf-8")
        sv = read_skill_version(raw, str(source))
        compiled = raw.replace("{{KB_VERSION}}", version)
        check_lines(name, compiled)
        manifest["skills"][name] = {"skill_version": sv, "kb_version": version}
        if name == "gasly-pro":
            modular = replace_routing(compiled, make_routing("full", KB_ORDER))
            moddir = stage / "modular" / name
            write_text(moddir / "SKILL.md", modular)
            for ref in KB_ORDER:
                write_text(moddir / "references" / ref, kbs[ref])
            full = modular + "\n\n---\n\n# LAMPIRAN REFERENSI INLINE (FLAT MODE)\n\n" + "\n\n---\n\n".join(kbs[x] for x in KB_ORDER)
            write_text(stage / "flat" / name / "SKILL.md", full)
            check_flat("flat/" + name, full)
            lite_skill = replace_routing(compiled, make_routing("lite", FLAT_LITE_ORDER, ["boilerplates.md"]))
            lite = lite_skill + "\n\n---\n\n# LAMPIRAN REFERENSI INLINE (FLAT-LITE MODE)\n\n" + "\n\n---\n\n".join(kbs[x] for x in FLAT_LITE_ORDER)
            write_text(stage / "flat-lite" / name / "SKILL.md", lite)
            check_flat("flat-lite/" + name, lite)
        else:
            modular = replace_routing(compiled, make_routing("full", ["spec-digest.md"]))
            write_text(stage / "modular" / name / "SKILL.md", modular)
            write_text(stage / "modular" / name / "references" / "spec-digest.md", digest)
            flat = modular + "\n\n---\n\n# LAMPIRAN REFERENSI INLINE (FLAT MODE)\n\n" + digest
            write_text(stage / "flat" / name / "SKILL.md", flat)
            check_flat("flat/" + name, flat)

    for path in sorted(p for p in stage.rglob("*") if p.is_file()):
        rel = "dist/" + path.relative_to(stage).as_posix()
        manifest["generated_files"][rel] = hashlib.sha256(path.read_bytes()).hexdigest()
    write_text(stage / "manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    return manifest


def publish(stage):
    backup = DIST.with_name("dist.previous")
    if backup.exists():
        shutil.rmtree(backup)
    moved = False
    try:
        if DIST.exists():
            DIST.replace(backup)
            moved = True
        stage.replace(DIST)
    except Exception:
        if moved and backup.exists() and not DIST.exists():
            backup.replace(DIST)
        raise
    else:
        if backup.exists():
            shutil.rmtree(backup)


def main():
    parser = argparse.ArgumentParser(description="GASLY Skills Compiler")
    parser.add_argument("--allow-missing", action="store_true")
    args = parser.parse_args()
    stage = Path(tempfile.mkdtemp(prefix=".dist-staging-", dir=ROOT))
    try:
        manifest = build(stage, args.allow_missing)
        publish(stage)
        print("[OK] product=" + PRODUCT_VERSION + " kb=" + manifest["kb_version"] +
              " generated=" + str(len(manifest["generated_files"])))
        return 0
    except Exception as exc:
        print("[ERROR] Build failed; existing dist preserved: " + str(exc), file=sys.stderr)
        return 1
    finally:
        if stage.exists():
            shutil.rmtree(stage, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
