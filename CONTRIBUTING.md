# Contributing to GASLY Skills

Thank you for considering a contribution. GASLY Skills is maintained as an open-source skill set for planning and implementing Google Apps Script web applications backed by Google Sheets.

## Before opening an issue

- Search existing issues and pull requests for duplicate reports.
- Include a minimal reproducible example for bugs where possible.
- Never include API keys, OAuth tokens, passwords, real customer data, or private spreadsheet contents.
- For suspected security vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development setup

Requirements:

- Python 3.10 or newer
- Node.js 22 or newer

Run the complete local validation suite:

```bash
python build_skills.py
python -m unittest discover -s tests -v
node tests/harness.js
```

The build compiles the source skills and knowledge base under `src/` into `dist/`. The generated manifest records package versions and SHA-256 hashes.

## Where to make changes

- `src/skills/<skill-name>/SKILL.md`: canonical instructions for a skill.
- `src/kb/`: shared reference knowledge used by the skills.
- `build_skills.py`: distribution compiler.
- `tests/`: static regression checks and the Node-based Google Apps Script stub harness.
- `evals/briefs/`: fixed evaluation prompts.
- `evals/results/`: evidence records for actual model/platform evaluations.
- `dist/`: generated packages. Do not hand-edit generated files.

When changing `src/` or the compiler, run the build and all tests, then include the regenerated `dist/` output in the same pull request. Review the generated diff to ensure it contains only intended changes.

## Pull request checklist

- [ ] Explain the user problem and the intended behavior.
- [ ] Keep the change focused; avoid unrelated refactors.
- [ ] Update source files under `src/` rather than editing generated files directly.
- [ ] Regenerate `dist/` when applicable.
- [ ] Run the Python static checks and Node harness.
- [ ] Update documentation when behavior, setup, security boundaries, or package structure changes.
- [ ] Do not claim a live Google Apps Script test, real Google Sheets behavior, penetration test, or LLM evaluation unless you have recorded reproducible evidence.
- [ ] Confirm that no credentials, personal data, or confidential project files are included.

## Skill and knowledge-base versions

Keep each skill's `SKILL_VERSION` separate from the shared `KB_VERSION`. Follow the versioning conventions already present in the source and generated manifest. A change to shared knowledge may require rebuilding both skills.

## Evaluation evidence

Static tests and the Node stub harness are useful regression checks, but they are not substitutes for testing in a real Apps Script deployment or evaluating model behavior. Record real platform/model runs using [evals/results/TEMPLATE.md](evals/results/TEMPLATE.md).

## License

By submitting a contribution, you agree that your contribution is provided under the repository's [MIT License](LICENSE).
