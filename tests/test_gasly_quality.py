#!/usr/bin/env python3
"""Focused tests for the bounded GASLY quality scanner."""
import tempfile
import unittest
from pathlib import Path
from tools.check_gasly_quality import scan

class TestGaslyQualityScanner(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
    def tearDown(self):
        self.temp.cleanup()
    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    def test_action_registry_cross_check(self):
        self.write("gas/router.gs", """function getActionRegistry_() {
 return { 'items.list': { handler: list_ }, 'items.create': { handler: create_ } };
}
""")
        self.write("web/app.js", "callGasAction('items.list', {});\ncallApi('items.delete', {});\nconst sample = \"callApi('items.fake')\";\n// callApi('items.ghost');\n")
        findings, _, has_registry = scan(self.root)
        self.assertTrue(has_registry)
        self.assertEqual([(x[0], x[4].split("'")[1]) for x in findings], [("GQ-01", "items.delete")])
    def test_dialog_and_drive_public_are_reported(self):
        self.write("web/app.ts", "window.confirm('Delete?');\n")
        self.write("gas/drive.gs", "function share_(){ file.setSharing(DriveApp.Access.ANYONE_WITH_LINK); }\n")
        findings, _, _ = scan(self.root)
        self.assertEqual({x[0] for x in findings}, {"GQ-02", "GQ-04"})
        self.assertEqual(next(x for x in findings if x[0] == "GQ-04")[1], "REVIEW")
    def test_weak_random_only_in_named_security_function(self):
        self.write("gas/auth.gs", "function issueSessionToken_(){ return String(Math.random()); }\nfunction renderSample_(){ return Math.random(); }\n")
        findings, _, _ = scan(self.root)
        self.assertEqual([x[0] for x in findings], ["GQ-05"])
    def test_high_confidence_secret_signature(self):
        self.write("web/.env.local", "NEXT_PUBLIC_GEMINI_API_KEY=AIza" + ("A" * 36) + "\n")
        findings, _, _ = scan(self.root)
        self.assertEqual([x[0] for x in findings], ["GQ-03"])
    def test_comments_and_string_examples_do_not_trigger_code_rules(self):
        self.write("gas/auth.gs", "function issueSessionToken_(){ /* Math.random() */ return \"safe\"; }\n")
        self.write("web/app.js", "// window.confirm('sample')\nconst note = \"window.alert() is discouraged\";\n")
        findings, _, _ = scan(self.root)
        self.assertEqual(findings, [])
    def test_dynamic_action_and_dependency_output_are_ignored(self):
        self.write("gas/router.gs", "function getActionRegistry_(){ return { 'items.list': {} }; }\n")
        self.write("web/app.js", "callGasAction(actionFromConfig, {});\n")
        self.write("node_modules/example/index.js", "window.confirm('ignored');\n")
        findings, count, has_registry = scan(self.root)
        self.assertEqual(findings, [])
        self.assertEqual(count, 2)
        self.assertTrue(has_registry)

if __name__ == "__main__":
    unittest.main()
