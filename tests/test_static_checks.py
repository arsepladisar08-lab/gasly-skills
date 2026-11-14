from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class TestRepositoryQuality(unittest.TestCase):
    def test_readme_local_links_resolve(self) -> None:
        readme = read("README.md")
        links = re.findall(r"\[[^\]]+\]\(([^)]+)\)", readme)
        for target in links:
            if target.startswith(("https://", "http://", "#", "mailto:")):
                continue
            local = target.split("#", 1)[0]
            if local:
                self.assertTrue((ROOT / local).exists(), f"Broken README link: {target}")

    def test_governance_files_are_present(self) -> None:
        for path in (
            "LICENSE",
            "CONTRIBUTING.md",
            "SECURITY.md",
            "CODE_OF_CONDUCT.md",
            ".github/ISSUE_TEMPLATE/bug_report.yml",
            ".github/ISSUE_TEMPLATE/feature_request.yml",
        ):
            self.assertTrue((ROOT / path).is_file(), path)

    def test_text_line_endings_are_normalized(self) -> None:
        attrs = read(".gitattributes")
        self.assertIn("* text=auto eol=lf", attrs)

    def test_python_bytecode_is_ignored(self) -> None:
        ignore = read(".gitignore")
        self.assertIn("__pycache__/", ignore)
        self.assertIn("*.py[cod]", ignore)

    def test_schema_contains_private_upload_nonce(self) -> None:
        config = read("src/gas/config.md")
        self.assertIn("var SCHEMA_VERSION = '1.1.0';", config)
        self.assertIn("'upload_nonce'", config)

    def test_public_data_reads_hide_upload_nonce(self) -> None:
        sheets = read("src/gas/sheets-repository.md")
        self.assertIn("headers[c] !== 'upload_nonce'", sheets)
        self.assertIn("key !== 'upload_nonce'", sheets)
        self.assertIn("uploadNonce: uploadNonce", sheets)

    def test_upload_ticket_is_bound_to_record_and_nonce(self) -> None:
        drive = read("src/gas/drive-upload.md")
        for token in (
            "p.uploadNonce",
            "ticketScope.entity",
            "ticketScope.entityId",
            "ticketScope.uploadNonce",
            "cache.remove('ticket:' + ticket)",
            "nowMs - createdAtMs > 900000",
        ):
            self.assertIn(token, drive)

    def test_public_upload_cannot_overwrite_attachment(self) -> None:
        drive = read("src/gas/drive-upload.md")
        self.assertIn("if (hasExistingFile && !canManageExisting)", drive)
        self.assertIn("role === 'ADMIN' || role === 'STAFF'", drive)

    def test_legacy_admin_pin_has_no_default_and_requires_strong_secret(self) -> None:
        boilerplate = read("src/kb/boilerplates.md")
        self.assertNotIn("props.setProperty('ADMIN_PIN', '123456')", boilerplate)
        self.assertIn("String(expectedPin).trim().length >= 16", boilerplate)
        self.assertIn("pin.trim().length < 16", boilerplate)

    def test_google_id_token_issuer_is_checked(self) -> None:
        auth = read("src/gas/auth-and-ratelimit.md")
        self.assertIn("tokenInfo.iss", auth)
        self.assertIn("https://accounts.google.com", auth)
        self.assertIn("accounts.google.com", auth)

    def test_node_runtime_harness_is_present(self) -> None:
        harness = ROOT / "tests" / "harness.js"
        self.assertTrue(harness.is_file())
        self.assertIn("node:assert/strict", harness.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
