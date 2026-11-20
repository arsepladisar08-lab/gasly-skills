#!/usr/bin/env python3
"""Validate local Markdown links and heading anchors in key source documents."""
import re
import unittest
from collections import defaultdict
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
DOCS = [
    ROOT / "README.md",
    ROOT / "CATALOG.md",
    ROOT / "VERIFY.md",
    ROOT / "CONTRIBUTING.md",
    ROOT / "SECURITY.md",
    ROOT / "src/core/contract.md",
    *sorted((ROOT / "src/skills").glob("*/SKILL.md")),
]
LINK = re.compile(r"(?<!)\[[^\]]*\]\(([^)]+)\)")
HEADING = re.compile(r"^#{1,6}\s+(.+?)\s*#*\s*$")



def without_fenced_code(markdown):
    """Exclude fenced code examples while preserving ordinary Markdown lines."""
    visible = []
    fence_char = None
    fence_size = 0
    for line in markdown.splitlines():
        stripped = line.lstrip()
        opening = re.match(r"(\x60{3,}|~{3,})", stripped)
        if fence_char is None and opening:
            fence_char = opening.group(1)[0]
            fence_size = len(opening.group(1))
            continue
        if fence_char is not None:
            closing = re.match(r"(\x60+|~+)\s*$", stripped)
            if closing and closing.group(1)[0] == fence_char and len(closing.group(1)) >= fence_size:
                fence_char = None
                fence_size = 0
            continue
        visible.append(line)
    return "\n".join(visible)

def heading_anchors(markdown):
    counts = defaultdict(int)
    anchors = set()
    for line in without_fenced_code(markdown).splitlines():
        match = HEADING.match(line)
        if not match:
            continue
        title = re.sub(r"!?\[([^\]]+)\]\([^)]*\)", r"\1", match.group(1))
        title = title.replace(chr(96), "")
        slug = re.sub(r"[^\w -]", "", title.lower(), flags=re.UNICODE)
        slug = re.sub(r" ", "-", slug.strip())
        count = counts[slug]
        counts[slug] += 1
        anchors.add(slug if count == 0 else f"{slug}-{count}")
    return anchors


class TestMarkdownLinks(unittest.TestCase):
    def test_key_markdown_files_exist(self):
        missing = [str(path.relative_to(ROOT)) for path in DOCS if not path.is_file()]
        self.assertEqual(missing, [], f"Missing canonical docs: {missing}")

    def test_local_markdown_targets_and_anchors_resolve(self):
        errors = []
        for source in DOCS:
            content = without_fenced_code(source.read_text(encoding="utf-8"))
            for match in LINK.finditer(content):
                raw = match.group(1).strip()
                if not raw or raw.startswith(("http://", "https://", "mailto:", "tel:", "data:")):
                    continue
                destination = raw.split()[0].strip("<>")
                parsed = urlsplit(destination)
                path_part = unquote(parsed.path)
                fragment = unquote(parsed.fragment)
                target = (source.parent / path_part).resolve() if path_part else source
                if target.is_dir():
                    target = target / "README.md"
                if not target.is_file():
                    errors.append(f"{source.relative_to(ROOT)}: missing target {raw}")
                    continue
                if fragment and target.suffix.lower() == ".md":
                    anchors = heading_anchors(target.read_text(encoding="utf-8"))
                    normalized = fragment.lower().replace(" ", "-")
                    if normalized not in anchors:
                        errors.append(f"{source.relative_to(ROOT)}: missing anchor {raw}")
        self.assertEqual(errors, [], "\n".join(errors))


if __name__ == "__main__":
    unittest.main()
