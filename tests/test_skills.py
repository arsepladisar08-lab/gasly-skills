#!/usr/bin/env python3
"""
Unit Test Suite for Gasly Skills Pack (tests/test_skills.py)
Run with: python -m unittest discover -s tests -v
"""

import hashlib
import json
import re
import unittest
from pathlib import Path

import build_skills
from tools import check_contrast

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "dist"
SRC_DESIGN_DIR = ROOT_DIR / "src" / "design"


class TestGaslySkillPack(unittest.TestCase):
    def test_10_audit_contract_scope_and_handoff(self) -> None:
        contract = (ROOT_DIR / "src" / "core" / "contract.md").read_text(encoding="utf-8")
        trust = contract.split("## 9. Batas Kepercayaan Input Eksternal", 1)[1].split("## 10.", 1)[0]
        audit = contract.split("## 10. Mode Audit (Read-Only)", 1)[1]
        self.assertLessEqual(len(trust.splitlines()), 10, "Trust Boundary must stay within 10 lines")
        self.assertLessEqual(len(audit.splitlines()), 25, "Audit contract must stay within 25 lines")
        self.assertIn("**STOP**", audit)
        for slug in ("gasly-start", "gasly-pro-api", "gasly-data", "gasly-ui", "gasly-prd-to-uiux"):
            skill = (ROOT_DIR / "src" / "skills" / slug / "SKILL.md").read_text(encoding="utf-8")
            self.assertIn("AUDIT_READ_ONLY", skill, f"{slug} must preserve read-only audit status")
            self.assertIn("STOP", skill, f"{slug} must stop before editing")

    def test_11_validate_workflow_write_permissions_are_isolated(self) -> None:
        workflow = (ROOT_DIR / ".github" / "workflows" / "validate.yml").read_text(encoding="utf-8")
        self.assertIn("permissions:\n  contents: read", workflow)
        self.assertIn("validate:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read", workflow)
        self.assertIn("publish-dist:", workflow)
        self.assertIn("needs: validate", workflow)
        self.assertIn("contents: write", workflow)
        self.assertNotIn("Publish regenerated dist packages (push only)", workflow.split("  publish-dist:", 1)[0])

    def test_12_scanner_v1_is_bounded(self) -> None:
        scanner = (ROOT_DIR / "tools" / "check_gasly_quality.py").read_text(encoding="utf-8")
        for rule_id in ("GQ-01", "GQ-02", "GQ-03", "GQ-04", "GQ-05"):
            self.assertIn(rule_id, scanner)
        self.assertNotIn("GQ-06", scanner)

    @classmethod
    def setUpClass(cls) -> None:
        exit_code = build_skills.main([])
        if exit_code != 0:
            raise RuntimeError("build_skills.py failed during test setup")

    def test_01_manifest_and_sha256_integrity(self) -> None:
        manifest_path = DIST_DIR / "manifest.json"
        self.assertTrue(manifest_path.exists(), "dist/manifest.json must exist")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

        self.assertEqual(manifest["skillVersion"], build_skills.SKILL_VERSION)
        self.assertIn("kbVersion", manifest)
        self.assertIn("files", manifest)

        for rel_path, meta in manifest["files"].items():
            target = DIST_DIR / rel_path
            self.assertTrue(target.exists(), f"Manifest file missing on disk: {rel_path}")
            digest = hashlib.sha256(target.read_bytes()).hexdigest()
            self.assertEqual(digest, meta["sha256"], f"SHA-256 mismatch for {rel_path}")
            self.assertEqual(target.stat().st_size, meta["bytes"], f"Byte size mismatch for {rel_path}")

    def test_02_frontmatter_and_description_limits(self) -> None:
        for slug in build_skills.ALL_SKILLS:
            skill_path = DIST_DIR / "modular" / slug / "SKILL.md"
            self.assertTrue(skill_path.exists(), f"Missing modular SKILL.md for {slug}")
            content = skill_path.read_text(encoding="utf-8")

            fm = build_skills.parse_and_validate_frontmatter(slug, content)
            self.assertEqual(fm["name"], slug)
            self.assertLessEqual(
                len(fm["description"]),
                1000,
                f"{slug} description exceeds 1000 chars ({len(fm['description'])})",
            )
            self.assertGreaterEqual(len(fm["description"]), 100)

            lines = len(content.splitlines())
            self.assertLessEqual(lines, build_skills.MAX_SKILL_BODY_LINES)
            self.assertNotIn("{{KB_VERSION}}", content, "Unreplaced {{KB_VERSION}} placeholder found")

    def test_03_cross_reference_integrity(self) -> None:
        presets = ["aura", "editorial-light", "dense-dashboard", "warm-friendly"]
        ref_pattern = re.compile(r"`(references/[A-Za-z0-9_./<>-]+)`")

        for slug in build_skills.ALL_SKILLS:
            skill_dir = DIST_DIR / "modular" / slug
            content = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
            matches = set(ref_pattern.findall(content))
            self.assertTrue(matches, f"No references/... paths found in {slug}/SKILL.md")

            for ref_rel in matches:
                if "<preset>" in ref_rel:
                    for p in presets:
                        expanded = ref_rel.replace("<preset>", p)
                        self.assertTrue(
                            (skill_dir / expanded).exists(),
                            f"Broken expanded reference {expanded} in {slug}/SKILL.md",
                        )
                else:
                    self.assertTrue(
                        (skill_dir / ref_rel).exists(),
                        f"Broken reference {ref_rel} in {slug}/SKILL.md",
                    )

        # Verify flat-lite gasly-pro does not reference excluded boilerplates.md
        flat_lite_pro = (DIST_DIR / "flat-lite" / "gasly-pro" / "SKILL.md").read_text(encoding="utf-8")
        self.assertNotIn("references/boilerplates.md", flat_lite_pro)

    def test_04_design_token_schema_and_presets(self) -> None:
        schema_path = SRC_DESIGN_DIR / "tokens.schema.json"
        self.assertTrue(schema_path.exists())
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        expected_presets = set(schema["properties"]["id"]["enum"])
        required_top_keys = set(schema["required"])
        required_mode_keys = set(schema["$defs"]["colorMode"]["required"])
        hex_re = re.compile(schema["$defs"]["hexColor"]["pattern"])

        found_presets = set()
        for pf in (SRC_DESIGN_DIR / "presets").glob("*.tokens.json"):
            data = json.loads(pf.read_text(encoding="utf-8"))
            self.assertEqual(set(data.keys()), required_top_keys, f"Top-level key mismatch in {pf.name}")
            found_presets.add(data["id"])
            self.assertIn(data["defaultMode"], ("light", "dark"))

            for dial_name in ("DESIGN_VARIANCE", "MOTION_INTENSITY", "VISUAL_DENSITY"):
                val = data["recommendedDials"][dial_name]
                self.assertIsInstance(val, int)
                self.assertGreaterEqual(val, 1)
                self.assertLessEqual(val, 10)

            for mode in ("light", "dark"):
                palette = data["modes"][mode]
                self.assertEqual(set(palette.keys()), required_mode_keys)
                for token_k, hex_v in palette.items():
                    self.assertRegex(hex_v, hex_re, f"Invalid hex {hex_v} for {token_k} in {pf.name}:{mode}")

            css_export = SRC_DESIGN_DIR / "css" / f"{data['id']}.css"
            self.assertTrue(css_export.exists(), f"Missing CSS export for preset {data['id']}")

        self.assertEqual(found_presets, expected_presets)

    def test_05_wcag_aa_contrast_verification(self) -> None:
        for pf in sorted((SRC_DESIGN_DIR / "presets").glob("*.tokens.json")):
            errs = check_contrast.check_preset_file(pf)
            self.assertEqual(errs, [], f"WCAG AA contrast failure in {pf.name}: {errs}")

    def test_06_legacy_flat_isolation_and_size_limits(self) -> None:
        # New skills must ONLY be built in dist/modular/
        self.assertFalse((DIST_DIR / "flat" / "gasly-data").exists())
        self.assertFalse((DIST_DIR / "flat" / "gasly-ui").exists())
        self.assertFalse((DIST_DIR / "flat" / "gasly-deploy-guide").exists())
        self.assertFalse((DIST_DIR / "flat" / "gasly-start").exists())
        self.assertFalse((DIST_DIR / "flat" / "gasly-prd-to-uiux").exists())
        self.assertFalse((DIST_DIR / "flat" / "gasly-pro-api").exists())

        manifest = json.loads((DIST_DIR / "manifest.json").read_text(encoding="utf-8"))
        for alias in ("gasly-prompt", "gasly-install"):
            self.assertEqual(manifest["skills"][alias]["mode"], "deprecated-alias")
            self.assertTrue((DIST_DIR / "modular" / alias / "SKILL.md").exists())

        flat_lite_text = (DIST_DIR / "flat-lite" / "gasly-pro" / "SKILL.md").read_text(encoding="utf-8")
        self.assertLessEqual(len(flat_lite_text), build_skills.FLAT_WARN_CHARS)

        for slug in build_skills.LEGACY_FLAT_SKILLS:
            flat_text = (DIST_DIR / "flat" / slug / "SKILL.md").read_text(encoding="utf-8")
            self.assertLessEqual(len(flat_text), build_skills.FLAT_MAX_CHARS)

    def test_08_alias_metadata_and_flat_compatibility_newline(self) -> None:
        for alias in ("gasly-prompt", "gasly-install"):
            alias_path = DIST_DIR / "modular" / alias / "SKILL.md"
            self.assertTrue(alias_path.is_file(), f"Missing deprecated alias: {alias}")
            content = alias_path.read_text(encoding="utf-8")
            description_lines = []
            in_description = False
            for line in content.splitlines():
                if line.startswith("description:"):
                    in_description = True
                    continue
                if in_description:
                    if line.startswith("  "):
                        description_lines.append(line.strip())
                    else:
                        break
            description = " ".join(description_lines)
            self.assertGreaterEqual(
                len(description),
                100,
                f"{alias} description must be at least 100 characters",
            )

        flat_alias = (DIST_DIR / "flat" / "gasly-prompt" / "SKILL.md").read_text(encoding="utf-8")
        self.assertTrue(flat_alias.endswith("\n"), "Flat alias text must end with a real newline")
        self.assertNotIn(chr(92) + "n", flat_alias, "Flat alias must not contain a literal escaped newline")

    def test_09_issue_template_lists_all_canonical_skills(self) -> None:
        issue_template = (ROOT_DIR / ".github" / "ISSUE_TEMPLATE" / "bug_report.yml").read_text(encoding="utf-8")
        for slug in (
            "gasly-start",
            "gasly-prd",
            "gasly-prd-to-uiux",
            "gasly-pro-api",
            "gasly-data",
            "gasly-ui",
            "gasly-deploy-guide",
            "gasly-pro",
        ):
            self.assertRegex(issue_template, rf"(?m)^\s+- {re.escape(slug)}$")

    def test_07_style_preview_template_is_self_contained(self) -> None:
        preview = DIST_DIR / "modular" / "gasly-prd-to-uiux" / "templates" / "pratinjau-gaya.html"
        self.assertTrue(preview.is_file(), "Style preview template must be included in the modular package")
        content = preview.read_text(encoding="utf-8")
        self.assertIn('<meta name="viewport"', content)
        self.assertIn("data-choice", content)
        self.assertIn("textContent", content)
        self.assertNotIn("innerHTML", content)
        self.assertNotIn("<script src=", content)
        self.assertNotIn("TODO", content)

if __name__ == "__main__":
    unittest.main()
