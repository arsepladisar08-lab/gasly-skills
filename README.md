# GASLY Skills

GASLY is a compact skill set for planning and implementing Google Apps Script web applications backed by Google Sheets. Source-of-truth files live under `src/`; generated distribution packages live under `dist/`.

## Build and test

Requires Python 3.10+ and Node.js 22+ for the execution harness.

```bash
python build_skills.py
python -m unittest discover -s tests -v
node tests/harness.js
```

The compiler builds into a temporary staging directory, validates all outputs, writes `dist/manifest.json` with product/skill/KB versions and SHA-256 hashes for each generated package file, then swaps the validated output into `dist/`. If validation fails before publication, the prior `dist/` remains intact.

## Choose a distribution format

### Modular — `dist/modular/`

Use when the host supports a skill folder with referenced Markdown files. Keep each skill's `SKILL.md` together with its complete `references/` subfolder. Do not upload the entry file alone; it relies on the adjacent references.

### Flat — `dist/flat/`

Use when the host accepts a single Markdown skill file and its context allowance can accommodate the complete inline knowledge base. Each package's `SKILL.md` contains its instruction body and included material.

### Flat Lite — `dist/flat-lite/`

Use when a single file is required but the full boilerplate reference would exceed the target's available context budget. Flat Lite has a separate routing table and explicitly excludes `references/boilerplates.md`; it is not equivalent to the full Flat or Modular package for implementation details contained only in that reference.

The host's current import mechanism and context limits determine which package is appropriate. Check the host's current documentation before choosing a platform-specific upload path.

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
