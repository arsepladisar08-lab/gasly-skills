# GASLY Skills

GASLY is a compact skill set for planning and implementing Google Apps Script web applications backed by Google Sheets. Source-of-truth files live under `src/`; generated distribution packages live under `dist/`.

## Build and test

Requires Python 3.10+ and Node.js 22+ for the execution harness.

```bash
python build_skills.py
python -m unittest discover -s tests -v
node tests/harness.js
```

The compiler builds into a temporary staging directory, validates all outputs, writes `dist/manifest.json` with product/skill/KB versions and SHA-256 hashes for each generated package file, then atomically exchanges the validated output with `dist/` on Linux. Other platforms use a backup-and-rollback directory swap. If validation or publication fails, the prior `dist/` is preserved.

## Choose a distribution format

### Modular — `dist/modular/`

Use when the host supports a skill folder with referenced Markdown files. Keep each skill's `SKILL.md` together with its complete `references/` subfolder. Do not upload the entry file alone; it relies on the adjacent references.

### Flat — `dist/flat/`

Use when the host accepts a single Markdown skill file and its context allowance can accommodate the complete inline knowledge base. Each package's `SKILL.md` contains its instruction body and included material.

### Flat Lite — `dist/flat-lite/`

Use when a single file is required but the full boilerplate reference would exceed the target's available context budget. Flat Lite has a separate routing table and explicitly excludes `references/boilerplates.md`; it is not equivalent to the full Flat or Modular package for implementation details contained only in that reference.

The host's current import mechanism and context limits determine which package is appropriate. Check the host's current documentation before choosing a platform-specific upload path.

## Install by platform

Use the folder for exactly one skill (either `gasly-pro` or `gasly-prompt`). Do not upload the whole repository as a skill.

### ChatGPT Skills

1. Open **Skills** in the ChatGPT sidebar.
2. Select **Create → Upload from your computer**.
3. Upload the skill package from `dist/modular/<skill-name>/` with its `SKILL.md` and complete `references/` folder.
4. Review the uploaded skill and workspace availability settings before use.

ChatGPT Skills are available only to eligible Business, Enterprise, Healthcare, and Edu users, subject to workspace settings and rollout. See [Skills in ChatGPT](https://help.openai.com/en/articles/20001066-skills-in-chatgpt).

### Claude.ai

1. Enable **Code execution** and **Skills** where required by your account/workspace.
2. Package one complete folder from `dist/modular/<skill-name>/` as a ZIP. Keep `SKILL.md` at the skill folder root and include its `references/` subfolder.
3. In Claude, open **Customize → Skills**, choose **Create skill → Upload a skill**, and upload the ZIP.
4. Enable the skill after upload. Workspace sharing/provisioning is controlled separately.

See [Use skills in Claude](https://support.claude.com/en/articles/12512180-use-skills-in-claude).

### Claude Code

Copy a complete modular skill folder into one of these locations:

- Personal: `~/.claude/skills/gasly-pro/` or `~/.claude/skills/gasly-prompt/`
- Project-local: `.claude/skills/gasly-pro/` or `.claude/skills/gasly-prompt/`

Keep `SKILL.md` in the selected skill folder root and keep `references/` alongside it. See the [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview).

### Gemini Apps (web)

1. Open [gemini.google.com](https://gemini.google.com).
2. Open **Customize → Skills → Create → Upload**.
3. Select the skill folder under `dist/modular/<skill-name>/`, or ZIP its contents so that `SKILL.md` is in the ZIP's main folder (not nested an extra directory down).
4. Include the adjacent `references/` folder in the same upload, review the skill, then create it.

Gemini Apps accepts a `SKILL.md` file, a folder, or a ZIP containing `SKILL.md` in its main folder. Scripts that require internet access are not supported, and reference files must be uploaded with the skill. See [Create and manage skills for Gemini Apps](https://support.google.com/gemini/answer/17094296?hl=en).

### When to use Flat or Flat Lite

Use `dist/flat/<skill-name>/SKILL.md` only when a target accepts a single Markdown file but does not preserve supporting folders. Use `dist/flat-lite/gasly-pro/SKILL.md` only for GASLY Pro on a constrained single-file target: it explicitly excludes the boilerplate reference, so it is not functionally equivalent to Modular or full Flat. The flat packages are generated artifacts, not the preferred canonical upload when references are supported.

## Versions and manifest

Each skill has its own `SKILL_VERSION`, independent of the shared `KB_VERSION`. The product version and each generated file's SHA-256 are recorded in `dist/manifest.json`. The manifest does not include a hash of itself.

## Evaluation evidence

Fixed prompts are stored in `evals/briefs/`. Record each real platform/model run using `evals/results/TEMPLATE.md`. A score or rubric is not evidence of a passing LLM evaluation; a result must include the platform, model, date, score, and inspectable evidence.

CI executes the compiler, static regression checks, and the Node GAS-stub harness. These are non-LLM checks and do not establish LLM quality, production Google Apps Script behavior, or penetration-test status.

## Security boundary

The included CRUD boilerplate is a **single-tenant baseline**. It has no per-record `owner_id`/`tenant_id` model and does not filter reads per role. It is suitable only where every user admitted to the deployment may read the same records. Restrict the web app audience, or implement server-side authentication, read-scoped authorization, and write guards before broader exposure. An `Anyone` deployment is not safe by default.

Set `OWNER_EMAIL` manually in Apps Script Script Properties after verifying the owner. `ADMIN_PIN` is optional and must also be configured manually; the boilerplate does not read it from the `CONFIG` sheet. Do not use a PIN as the only control for a deployment exposed to Anyone.

## License

This repository is distributed under the MIT License. See [LICENSE](LICENSE).
