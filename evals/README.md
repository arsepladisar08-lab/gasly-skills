# GASLY Skills Evaluation Suite

This directory separates fixed test prompts from actual evaluation evidence.

## Fixed briefs

Run the exact prompts in evals/briefs/ against each target platform/model combination. Preserve the prompt and capture the complete output.

- 01-crud-simple.md
- 02-landing-no-proof.md
- 03-multi-role-deployment.md
- 04-camera-and-schema-iteration.md
- 05-concurrency-stock.md

## Scoring rubric (100 points)

| Criterion | Weight | Evidence |
|---|---:|---|
| Business-claim integrity | 20 | No invented testimonials, customer counts, logos, ROI or unsupported pricing |
| RPC and preview behavior | 20 | Required action names and tested validation/error behavior |
| GAS security | 15 | No credential default, no missing-payload bypass, admin endpoints guarded |
| Time and concurrency | 15 | Offset timestamp format, daily IDs, lock/flush and stale-update conflict |
| Complete delivery and iteration | 15 | Complete files, Mini-Spec gate for sensitive raw ideas, idempotent schema migration |
| WCAG AA and accessibility | 15 | Contrast evidence, keyboard behavior, viewport zoom retained |

A score threshold alone does not mark a brief as passed. Record actual results in evals/results/ with platform, model, date, score, and inspectable evidence. Do not claim an LLM evaluation passed until such a result exists.

## Non-LLM checks

CI executes the compiler, Python static regression tests, and tests/harness.js. These verify deterministic build artifacts, source invariants, and selected server/mock behavior under Apps Script stubs. They do not measure LLM output quality.

## Recording evidence

Copy evals/results/TEMPLATE.md for each completed brief and model/platform run. Preserve transcripts, generated code, screenshots, and manual verification notes as linked evidence.
