#!/usr/bin/env python3
"""Bounded, dependency-free checks for generated GASLY application repositories."""
from __future__ import annotations
import argparse
import re
import sys
from pathlib import Path

EXTENSIONS = {".gs", ".js", ".jsx", ".ts", ".tsx", ".html"}
SKIP = {".git", "node_modules", "dist", "build", ".next", ".astro", "coverage", "vendor", ".venv", "venv"}
ACTION_CALL = re.compile(r"""(?:\b(?:callApi|callGasAction|gasRequest|gasPost)\s*\(\s*(['"])([a-z][\w]*\.[A-Za-z][\w]*)\1|\b(?:gasClient|GASLY_API)\s*\.\s*request\s*\(\s*(['"])([a-z][\w]*\.[A-Za-z][\w]*)\3)""")
REGISTRY = re.compile(r"(?:function\s+getActionRegistry_\s*\([^)]*\)\s*\{|(?:var|let|const)\s+ACTION_REGISTRY_\s*=)")
REGISTRY_KEY = re.compile(r"""['"]([a-z][\w]*\.[A-Za-z][\w]*)['"]\s*:\s*\{""")
DIALOG = re.compile(r"\bwindow\s*\.\s*(alert|confirm|prompt)\s*\(")
DRIVE_PUBLIC = re.compile(r"\bDriveApp\s*\.\s*Access\s*\.\s*(ANYONE_WITH_LINK|ANYONE)\b")
WEAK_RANDOM = re.compile(r"\bMath\s*\.\s*random\s*\(")
SENSITIVE_FUNCTION = re.compile(r"\bfunction\s+([A-Za-z_$][\w$]*(?:token|session|secret|nonce|credential|api.?key)[\w$]*)\s*\([^)]*\)\s*\{", re.I)
SECRETS = [
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{30,}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
    ("Stripe live secret", re.compile(r"\bsk_live_[0-9A-Za-z]{20,}\b")),
    ("PEM private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
]

def source_files(root):
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in EXTENSIONS and not any(p in SKIP for p in path.relative_to(root).parts):
            yield path

def registry_block(content):
    match = REGISTRY.search(content)
    if not match:
        return None
    start = content.find("{", match.start())
    depth, quote, escaped = 0, None, False
    line_comment = block_comment = False
    for i in range(start, len(content)):
        ch = content[i]
        nxt = content[i + 1] if i + 1 < len(content) else ""
        if line_comment:
            if ch == "\n": line_comment = False
            continue
        if block_comment:
            if ch == "*" and nxt == "/": block_comment = False
            continue
        if quote:
            if escaped: escaped = False
            elif ch == "\\": escaped = True
            elif ch == quote: quote = None
            continue
        if ch == "/" and nxt == "/": line_comment = True; continue
        if ch == "/" and nxt == "*": block_comment = True; continue
        if ch in {"'", '"'}: quote = ch
        elif ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0: return content[start:i + 1]
    return None

def function_body(content, start):
    depth, quote, escaped = 0, None, False
    for i in range(start, len(content)):
        ch = content[i]
        if quote:
            if escaped: escaped = False
            elif ch == "\\": escaped = True
            elif ch == quote: quote = None
            continue
        if ch in {"'", '"'}: quote = ch
        elif ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0: return content[start:i + 1]
    return content[start:]

def scan(root):
    files = list(source_files(root))
    registries = set()
    for path in files:
        if path.suffix.lower() == ".gs":
            block = registry_block(path.read_text(encoding="utf-8", errors="replace"))
            if block: registries.update(REGISTRY_KEY.findall(block))
    has_registry = bool(registries)
    findings = []
    frontends = [p for p in files if p.suffix.lower() != ".gs"]
    for path in frontends:
        text = path.read_text(encoding="utf-8", errors="replace")
        if has_registry:
            for m in ACTION_CALL.finditer(text):
                action = m.group(2) or m.group(4)
                if action and action not in registries:
                    findings.append(("GQ-01", "HIGH", path, text.count("\n", 0, m.start()) + 1,
                                     f"Frontend action '{action}' tidak ditemukan pada registry backend."))
        for m in DIALOG.finditer(text):
            findings.append(("GQ-02", "MEDIUM", path, text.count("\n", 0, m.start()) + 1,
                             f"window.{m.group(1)}() terdeteksi pada frontend."))
        for label, pattern in SECRETS:
            for m in pattern.finditer(text):
                findings.append(("GQ-03", "HIGH", path, text.count("\n", 0, m.start()) + 1,
                                 f"Signature {label} berpotensi tertanam; verifikasi dan rotasi bila nyata."))
    for path in files:
        if path.suffix.lower() != ".gs": continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for m in DRIVE_PUBLIC.finditer(text):
            findings.append(("GQ-04", "REVIEW", path, text.count("\n", 0, m.start()) + 1,
                             f"DriveApp.Access.{m.group(1)} ditemukan; konfirmasi klasifikasi dan kebutuhan berbagi."))
        for m in SENSITIVE_FUNCTION.finditer(text):
            start = text.find("{", m.start())
            body = function_body(text, start)
            weak = WEAK_RANDOM.search(body)
            if weak:
                findings.append(("GQ-05", "HIGH", path, text.count("\n", 0, start + weak.start()) + 1,
                                 f"Math.random() ditemukan dalam fungsi keamanan '{m.group(1)}'."))
    findings.sort(key=lambda x: (x[2].as_posix(), x[3], x[0]))
    return findings, len(files), has_registry

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", type=Path)
    args = parser.parse_args(argv)
    root = args.project_root.expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: direktori proyek tidak ditemukan: {root}", file=sys.stderr)
        return 2
    findings, count, has_registry = scan(root)
    print(f"GASLY Targeted Scanner v1 — {root}")
    print(f"Source files inspected: {count}")
    if not has_registry:
        print("INFO: action registry tidak ditemukan; pemeriksaan GQ-01 dilewati.")
    if not findings:
        print("No recognized findings.")
        return 0
    print("\nID     PRIORITY  LOCATION                         FINDING")
    for id_, priority, path, line, message in findings:
        print(f"{id_:<6} {priority:<8} {str(path.relative_to(root)) + ':' + str(line):<32} {message}")
    print(f"\nFindings: {len(findings)}")
    return 1

if __name__ == "__main__":
    raise SystemExit(main())
