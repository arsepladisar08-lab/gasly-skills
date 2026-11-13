# GASLY Skills Catalog

**Project:** GASLY Skills  
**Current product version:** 0.2.1  
**Shared knowledge base version:** 2.3.0  
**License:** MIT  
**Canonical branch:** `SOWAN`

GASLY is a pair of complementary agent skills for the product lifecycle of Google Apps Script web applications built with HtmlService and Google Sheets.

## Skills

### GASLY Prompt — product planning and specification

**Package name:** `gasly-prompt`  
**Version:** 0.2.1

Use this skill when a user has an application idea and needs product discovery, workflow definition, spreadsheet data modeling, AURA UI/UX direction, or a structured **MASTER INSTRUCTIONAL PROMPT** before implementation.

Typical work:
- Convert an idea into a clear product scope and requirements.
- Define user roles, workflows, validation rules, and edge cases.
- Plan Google Sheets structure and data relationships.
- Specify interface behavior, responsive states, and conversion considerations.
- Produce an implementation-ready specification for GASLY Pro.

Source: [src/skills/gasly-prompt/SKILL.md](src/skills/gasly-prompt/SKILL.md)  
Ready-to-use modular package: [dist/modular/gasly-prompt/](dist/modular/gasly-prompt/)

### GASLY Pro — implementation and engineering

**Package name:** `gasly-pro`  
**Version:** 0.2.1

Use this skill when a user asks to implement or revise a Google Apps Script web application using HtmlService and Google Sheets, especially after a specification has been prepared.

Typical work:
- Implement end-to-end Apps Script web applications.
- Build dashboards, internal tools, operational systems, and landing pages.
- Connect browser UI to server-side Apps Script functions.
- Apply data validation, concurrency checks, access guards, and deployment considerations.
- Apply AURA design and interaction conventions.

Source: [src/skills/gasly-pro/SKILL.md](src/skills/gasly-pro/SKILL.md)  
Ready-to-use modular package: [dist/modular/gasly-pro/](dist/modular/gasly-pro/)

## Recommended workflow

1. Start with **GASLY Prompt** when the request is still an idea or needs a specification.
2. Review and confirm the generated MASTER INSTRUCTIONAL PROMPT.
3. Continue with **GASLY Pro** to implement or revise the application.
4. Run the available tests and validate the result in the actual Apps Script environment before production use.

The skills are complementary, not interchangeable: Prompt focuses on planning and specification; Pro focuses on code implementation.

## Distribution formats

The compiler produces three formats:

| Format | Location | Intended use |
|---|---|---|
| Modular | `dist/modular/<skill-name>/` | Preferred when the host supports a skill folder and referenced files |
| Flat | `dist/flat/<skill-name>/SKILL.md` | Single Markdown file with the full included reference material |
| Flat Lite | `dist/flat-lite/gasly-pro/SKILL.md` | Constrained single-file Pro package; omits the boilerplate reference |

For modular packages, keep `SKILL.md` together with the complete adjacent `references/` directory. Do not upload the entry file by itself.

See [README.md](README.md) for platform-specific installation notes and current host documentation.

## Repository map

- `src/skills/`: canonical skill instructions.
- `src/kb/`: shared knowledge base.
- `build_skills.py`: distribution compiler.
- `dist/`: generated skill packages and `manifest.json`.
- `tests/`: automated regression checks and execution harness.
- `evals/briefs/`: repeatable evaluation prompts.
- `evals/results/`: evidence records for actual evaluations.

## Versions and verification

The manifest at [dist/manifest.json](dist/manifest.json) lists product/skill/KB versions and SHA-256 hashes for generated files.

CI checks the build, Python static tests, and the Node Google Apps Script stub harness. These checks do not prove live Google Apps Script behavior, production Google Sheets behavior, LLM quality, or penetration-test status. Consult [evals/README.md](evals/README.md) and recorded result files for evaluation evidence.

## For AI assistants and agents

When consuming GASLY from this repository:

1. Read this catalog to select the correct skill.
2. Fetch the selected `dist/modular/<skill-name>/SKILL.md`.
3. Fetch **all** Markdown files linked or listed in that skill's `references/` folder.
4. Preserve the distinction between source instructions and generated distributions.
5. Do not claim that GASLY is installed or automatically available to a model merely because this repository is public.
6. Respect the security boundaries and do not invent test evidence.

Start here:
- [GASLY Prompt entry point](dist/modular/gasly-prompt/SKILL.md)
- [GASLY Pro entry point](dist/modular/gasly-pro/SKILL.md)
- [Distribution manifest](dist/manifest.json)
