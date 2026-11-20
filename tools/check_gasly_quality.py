#!/usr/bin/env python3
"""Bounded, dependency-free checks for generated GASLY application repositories."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

EXTENSIONS = {".gs", ".js", ".jsx", ".ts", ".tsx", ".html"}
SKIP = {".git", "node_modules", "dist", "build", ".next", ".astro", "coverage", "vendor", ".venv", "venv"}

ACTION_CALL_START = re.compile(
    r"(?:\b(?:callApi|callGasAction|gasRequest|gasPost)\s*\(|"
    r"\b(?:gasClient|GASLY_API)\s*\.\s*request\s*\()\s*"
)
ACTION_LITERAL = re.compile(r"""\s*(['"])([a-z][\w]*\.[A-Za-z][\w]*)\1""")
REGISTRY = re.compile(
    r"(?:function\s+getActionRegistry_\s*\([^)]*\)\s*\{|(?:var|let|const)\s+ACTION_REGISTRY_\s*=)"
)
REGISTRY_KEY = re.compile(r"""['"]([a-z][\w]*\.[A-Za-z][\w]*)['"]\s*:\s*\{""")
DIALOG = re.compile(r"\bwindow\s*\.\s*(alert|confirm|prompt)\s*\(")
DRIVE_PUBLIC = re.compile(r"\bDriveApp\s*\.\s*Access\s*\.\s*(ANYONE_WITH_LINK|ANYONE)\b")
WEAK_RANDOM = re.compile(r"\bMath\s*\.\s*random\s*\(")
SENSITIVE_FUNCTION = re.compile(
    r"\bfunction\s+([A-Za-z_$][\w$]*(?:token|session|secret|nonce|credential|api.?key)[\w$]*)\s*\([^)]*\)\s*\{",
    re.IGNORECASE,
)
SECRETS = [
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{30,}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
    ("Stripe live secret", re.compile(r"\bsk_live_[0-9A-Za-z]{20,}\b")),
    ("PEM private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
]


def source_files(root: Path):
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in EXTENSIONS:
            if not any(part in SKIP for part in path.relative_to(root).parts):
                yield path


def mask_non_code(content: str, mask_strings: bool = False) -> str:
    """Blank comments (and optionally quoted literals) while preserving line offsets."""
    chars = list(content)
    i = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False

    while i < len(content):
        ch = content[i]
        nxt = content[i + 1] if i + 1 < len(content) else ""

        if line_comment:
            if ch == "\n":
                line_comment = False
            elif ch != "\r":
                chars[i] = " "
            i += 1
            continue

        if block_comment:
            if ch not in "\r\n":
                chars[i] = " "
            if ch == "*" and nxt == "/":
                chars[i + 1] = " "
                i += 2
                block_comment = False
                continue
            i += 1
            continue

        if quote:
            if mask_strings and ch not in "\r\n":
                chars[i] = " "
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
            i += 1
            continue

        if ch == "/" and nxt == "/":
            chars[i] = chars[i + 1] = " "
            i += 2
            line_comment = True
            continue
        if ch == "/" and nxt == "*":
            chars[i] = chars[i + 1] = " "
            i += 2
            block_comment = True
            continue
        if ch in {"'", '"', chr(96)}:
            quote = ch
            if mask_strings and ch not in "\r\n":
                chars[i] = " "
        i += 1

    return "".join(chars)


def extract_registry_bounds(code: str):
    match = REGISTRY.search(code)
    if not match:
        return None
    start = code.find("{", match.start())
    depth = 0
    for index in range(start, len(code)):
        if code[index] == "{":
            depth += 1
        elif code[index] == "}":
            depth -= 1
            if depth == 0:
                return start, index + 1
    return None


def extract_function_body(code: str, opening_brace: int):
    depth = 0
    for index in range(opening_brace, len(code)):
        if code[index] == "{":
            depth += 1
        elif code[index] == "}":
            depth -= 1
            if depth == 0:
                return code[opening_brace : index + 1]
    return code[opening_brace:]


def scan(root: Path):
    files = list(source_files(root))
    registries = set()

    for path in files:
        if path.suffix.lower() != ".gs":
            continue
        raw = path.read_text(encoding="utf-8", errors="replace")
        structure = mask_non_code(raw, mask_strings=True)
        bounds = extract_registry_bounds(structure)
        if bounds:
            start, end = bounds
            registry_source = mask_non_code(raw[start:end], mask_strings=False)
            registries.update(REGISTRY_KEY.findall(registry_source))

    has_registry = bool(registries)
    findings = []
    frontends = [path for path in files if path.suffix.lower() != ".gs"]

    for path in frontends:
        raw = path.read_text(encoding="utf-8", errors="replace")
        code = mask_non_code(raw, mask_strings=True)
        with_strings = mask_non_code(raw, mask_strings=False)

        if has_registry:
            for match in ACTION_CALL_START.finditer(code):
                literal = ACTION_LITERAL.match(raw, match.end())
                if literal:
                    action = literal.group(2)
                    if action not in registries:
                        findings.append(("GQ-01", "HIGH", path, raw.count("\n", 0, match.start()) + 1,
                                         f"Frontend action '{action}' tidak ditemukan pada registry backend."))

        for match in DIALOG.finditer(code):
            findings.append(("GQ-02", "MEDIUM", path, raw.count("\n", 0, match.start()) + 1,
                             f"window.{match.group(1)}() terdeteksi pada frontend."))

        for label, pattern in SECRETS:
            for match in pattern.finditer(with_strings):
                findings.append(("GQ-03", "HIGH", path, raw.count("\n", 0, match.start()) + 1,
                                 f"Signature {label} berpotensi tertanam; verifikasi dan rotasi bila nyata."))

    for path in files:
        if path.suffix.lower() != ".gs":
            continue
        raw = path.read_text(encoding="utf-8", errors="replace")
        code = mask_non_code(raw, mask_strings=True)

        for match in DRIVE_PUBLIC.finditer(code):
            findings.append(("GQ-04", "REVIEW", path, raw.count("\n", 0, match.start()) + 1,
                             f"DriveApp.Access.{match.group(1)} ditemukan; konfirmasi klasifikasi dan kebutuhan berbagi."))

        for match in SENSITIVE_FUNCTION.finditer(code):
            opening = code.find("{", match.start())
            body = extract_function_body(code, opening)
            weak = WEAK_RANDOM.search(body)
            if weak:
                findings.append(("GQ-05", "HIGH", path, raw.count("\n", 0, opening + weak.start()) + 1,
                                 f"Math.random() ditemukan dalam fungsi keamanan '{match.group(1)}'."))

    findings.sort(key=lambda item: (item[2].as_posix(), item[3], item[0]))
    return findings, len(files), has_registry


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", type=Path, help="Root direktori proyek GASLY yang akan diperiksa.")
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
    for rule_id, priority, path, line, message in findings:
        location = f"{path.relative_to(root)}:{line}"
        print(f"{rule_id:<6} {priority:<8} {location:<32} {message}")
    print(f"\nFindings: {len(findings)}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
