from __future__ import annotations
import hashlib
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY_DEFAULT = "123" + "456"

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def has_legacy(text: str) -> bool:
    return LEGACY_DEFAULT in text

class StaticRegressionTests(unittest.TestCase):
    def test_no_legacy_credential_in_repository_text(self):
        for path in ROOT.rglob("*"):
            if not path.is_file() or ".git" in path.parts or "__pycache__" in path.parts:
                continue
            try:
                content = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            self.assertFalse(has_legacy(content), str(path.relative_to(ROOT)))

    def test_old_default_fixture_is_detected(self):
        fixture = "props.setProperty('ADMIN_PIN', '" + LEGACY_DEFAULT + "');"
        self.assertTrue(has_legacy(fixture))

    def test_independent_skill_and_kb_versions(self):
        for name in ("gasly-pro", "gasly-prompt"):
            lines = read("src/skills/" + name + "/SKILL.md").splitlines()
            skill = next(line for line in lines if line.startswith("**SKILL_VERSION:**")).split()[-1].strip(chr(96))
            kb = next(line for line in lines if line.startswith("**KB_VERSION:**")).split()[-1].strip(chr(96))
            self.assertNotEqual(skill, kb)
            manifest = json.loads(read("dist/manifest.json"))
            self.assertEqual(manifest["skills"][name]["skill_version"], "0.2.1")
            self.assertEqual(manifest["skills"][name]["kb_version"], "2.3.0")

    def test_no_unproven_full_parity_claim(self):
        for name in ("gasly-pro", "gasly-prompt"):
            content = read("src/skills/" + name + "/SKILL.md").lower()
            self.assertNotRegex(content, r"(paritas|parity).{0,80}100%")

    def test_setup_never_sets_pin_or_owner_from_caller(self):
        content = read("src/kb/boilerplates.md").split("## 3. Boilerplate", 1)[0]
        self.assertNotIn("props.setProperty('ADMIN_PIN'", content)
        self.assertNotIn("props.setProperty('OWNER_EMAIL'", content)
        self.assertNotIn("Session.getEffectiveUser().getEmail()", content)

    def test_flat_lite_has_separate_routing_and_exclusion(self):
        content = read("dist/flat-lite/gasly-pro/SKILL.md")
        routing = content.split("## 2. PEMUATAN REFERENSI (ROUTING TABLE)", 1)[1].split("## 3.", 1)[0]
        self.assertIn("references/boilerplates.md", routing)
        self.assertIn("dikecualikan", routing)
        self.assertNotIn("## 2. Boilerplate `setup.gs`", content)
        self.assertNotIn("## 3. Boilerplate `code.gs`", content)
        self.assertNotIn("## 4. Boilerplate `index.html`", content)

    def test_manifest_sha256_matches_every_generated_file(self):
        manifest = json.loads(read("dist/manifest.json"))
        generated = manifest["generated_files"]
        self.assertEqual(len(generated), 12)
        for rel, expected in generated.items():
            target = ROOT / rel
            self.assertTrue(target.exists(), rel)
            self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(), expected, rel)
        self.assertNotIn("dist/manifest.json", generated)
        self.assertNotIn("compatibility", json.dumps(manifest).lower())
        self.assertEqual(manifest["product_version"], "0.2.1")
        self.assertEqual(manifest["kb_version"], "2.3.0")

    def test_staged_publish_replaces_distribution_directory(self):
        import importlib.util
        import tempfile
        from unittest.mock import patch

        spec = importlib.util.spec_from_file_location("gasly_build", ROOT / "build_skills.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            dist = base / "dist"
            stage = base / ".dist-staging"
            dist.mkdir()
            stage.mkdir()
            (dist / "old.txt").write_text("old", encoding="utf-8")
            (stage / "new.txt").write_text("new", encoding="utf-8")
            with patch.object(module, "DIST", dist):
                module.publish(stage)
            self.assertTrue((dist / "new.txt").exists())
            self.assertFalse((dist / "old.txt").exists())
            self.assertFalse(stage.exists())

    def test_flat_lite_is_smaller_than_full_flat(self):
        self.assertLess(len(read("dist/flat-lite/gasly-pro/SKILL.md")), len(read("dist/flat/gasly-pro/SKILL.md")))

    def test_security_and_single_tenant_documents(self):
        backend = read("src/kb/gas-backend.md")
        self.assertIn("belum diverifikasi", backend)
        self.assertIn("single-tenant", backend)
        self.assertIn("read-scoped", backend)
        self.assertIn("Anyone", backend)
        self.assertIn("CacheService", backend)
        boilerplate = read("src/kb/boilerplates.md")
        self.assertIn("var DEPLOY_ACCESS = 'ANYONE';", boilerplate)
        self.assertIn("adminLockUntil", boilerplate)
        self.assertIn("MAX_PURGE_ROWS_PER_RUN = 500", boilerplate)

if __name__ == "__main__":
    unittest.main()
