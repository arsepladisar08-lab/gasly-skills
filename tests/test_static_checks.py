from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class TestRepositoryQuality(unittest.TestCase):
    def test_saas_craft_design_doc_integrated(self) -> None:
        saas_craft = read("src/design/saas-craft.md")
        self.assertIn("<!-- KB_VERSION:", saas_craft)
        self.assertIn("Nol Emoji", saas_craft)
        self.assertIn("Slide-Over Drawer", saas_craft)
        self.assertIn("Mobile Card View", saas_craft)
        self.assertIn("references/saas-craft.md", read("src/skills/gasly-ui/SKILL.md"))
        self.assertIn("saas-craft.md", read("build_skills.py"))
    def test_setup_app_environment_toolbar_entrypoint(self) -> None:
        config = read("src/gas/config.md")
        for token in (
            "function setupAppEnvironment(fromClient)",
            "if (fromClient !== undefined)",
            "initialSetupDatabase();",
            "setupAdminCredentials();",
            "READY_TO_DEPLOY",
            "function onOpen()",
            "function setupAdminCredentialsFromUi(fromClient)",
        ):
            self.assertIn(token, config, f"Missing expected setupAppEnvironment token: {token}")
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
        harness_gas = ROOT / "tests" / "harness_gas.js"
        self.assertTrue(harness_gas.is_file())
        self.assertIn("node:assert/strict", harness_gas.read_text(encoding="utf-8"))
        harness_install = ROOT / "tests" / "harness_install.js"
        self.assertTrue(harness_install.is_file())
        self.assertIn("node:assert/strict", harness_install.read_text(encoding="utf-8"))

    def test_setup_admin_credentials_without_plaintext_in_code(self) -> None:
        config = read("src/gas/config.md")
        self.assertIn("ADMIN_PASSPHRASE_INIT", config)
        self.assertIn("ADMIN_PIN_INIT", config)
        self.assertIn("function setupAdminCredentials()", config)
        self.assertIn("props.deleteProperty('ADMIN_PASSPHRASE_INIT')", config)
        self.assertIn("props.deleteProperty('ADMIN_PIN_INIT')", config)

    def test_all_registry_handlers_and_step_up_enforced(self) -> None:
        router = read("src/gas/router-and-envelope.md")
        handlers = set(re.findall(r"handler:\s*([A-Za-z0-9_]+)", router))
        self.assertGreaterEqual(len(handlers), 18)

        gas_files = [
            "src/gas/config.md",
            "src/gas/router-and-envelope.md",
            "src/gas/auth-and-ratelimit.md",
            "src/gas/sheets-repository.md",
            "src/gas/drive-upload.md",
            "src/gas/webhook-receiver.md",
            "src/gas/integrations.md",
        ]
        combined_gas = "\n".join(read(p) for p in gas_files)
        defined_funcs = set(re.findall(r"^function\s+([A-Za-z0-9_]+)\s*\(", combined_gas, re.MULTILINE))
        self.assertEqual(handlers - defined_funcs, set())

        for action_name in ("items.delete", "admin.purgeSeed", "file.delete", "auth.setCredentials"):
            self.assertIn(
                f"verifyAndConsumeStepUp_(req, '{action_name}')",
                combined_gas,
                f"Missing verifyAndConsumeStepUp_ enforcement for {action_name}",
            )

    def test_verify_output_fixtures(self) -> None:
        import subprocess
        import sys

        good_run = subprocess.run(
            [
                sys.executable,
                str(ROOT / "tools" / "verify_output.py"),
                "--contract",
                str(ROOT / "tests" / "fixtures" / "good_contract.json"),
                "--backend",
                str(ROOT / "tests" / "fixtures" / "good_backend.gs"),
                "--frontend",
                str(ROOT / "tests" / "fixtures" / "good_frontend.html"),
            ],
            capture_output=True,
            text=True,
        )
        self.assertEqual(good_run.returncode, 0, good_run.stdout + good_run.stderr)

        bad_run = subprocess.run(
            [
                sys.executable,
                str(ROOT / "tools" / "verify_output.py"),
                "--contract",
                str(ROOT / "tests" / "fixtures" / "good_contract.json"),
                "--backend",
                str(ROOT / "tests" / "fixtures" / "good_backend.gs"),
                "--frontend",
                str(ROOT / "tests" / "fixtures" / "bad_frontend.html"),
            ],
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(bad_run.returncode, 0)
        self.assertIn("GATE-ENVELOPE-DRIFT", bad_run.stdout)
        self.assertIn("GATE-WEB-MODAL", bad_run.stdout)

    def test_verify_output_install_guide_fixtures(self) -> None:
        import subprocess
        import sys

        good_guide = subprocess.run(
            [
                sys.executable,
                str(ROOT / "tools" / "verify_output.py"),
                "--install-guide",
                str(ROOT / "tests" / "fixtures" / "install_guide_good.html"),
            ],
            capture_output=True,
            text=True,
        )
        self.assertEqual(good_guide.returncode, 0, good_guide.stdout + good_guide.stderr)

        bad_guide = subprocess.run(
            [
                sys.executable,
                str(ROOT / "tools" / "verify_output.py"),
                "--install-guide",
                str(ROOT / "tests" / "fixtures" / "install_guide_bad.html"),
            ],
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(bad_guide.returncode, 0)
        self.assertIn("GATE-I-01", bad_guide.stdout)
        self.assertIn("GATE-I-02", bad_guide.stdout)
        self.assertIn("GATE-I-03", bad_guide.stdout)
    def test_no_duplicate_configure_admin_pin_in_config(self) -> None:
        config = read("src/gas/config.md")
        matches = re.findall(r"function\s+configureAdminPin_\s*\(", config)
        self.assertEqual(len(matches), 1, f"Expected 1 configureAdminPin_ definition, found {len(matches)}")

    def test_minimal_stacks_contract_and_media_gate(self) -> None:
        stack_files = sorted(p.name for p in (ROOT / "src" / "stacks").glob("*.md"))
        self.assertEqual(stack_files, ["html-tailwind.md", "react-vite.md"])

        for fname in stack_files:
            text = read(f"src/stacks/{fname}")
            self.assertIn("uploadNonce", text, f"{fname} must pass uploadNonce to file.ticket")
            self.assertIn("idToken", text, f"{fname} must use camelCase idToken for auth.google")
            self.assertIn("auth.verifyPin", text, f"{fname} must enforce step-up PIN via auth.verifyPin")
            self.assertIn("MEDIA_PLACEHOLDERS", text, f"{fname} must expose Gate W-10 MEDIA_PLACEHOLDERS")
            self.assertNotIn("source.unsplash.com", text, f"{fname} must never use deprecated source.unsplash.com")

        schema = read("schemas/gasly-contract.schema.json")
        for host in ("cloudflare_pages", "netlify", "firebase_hosting", "sevalla", "vercel_pro"):
            self.assertIn(f'"{host}"', schema, f"Missing hosting_target {host} in schema")


if __name__ == "__main__":
    unittest.main()