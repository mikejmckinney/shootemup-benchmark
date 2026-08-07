<!--
Sync Impact Report
- Version change: unversioned template -> 1.0.0
- Modified principles:
  - PRINCIPLE_1_NAME -> I. Correctness Is Observable
  - PRINCIPLE_2_NAME -> II. Test-First Engineering (NON-NEGOTIABLE)
  - PRINCIPLE_3_NAME -> III. Security Is a Boundary Contract
  - PRINCIPLE_4_NAME -> IV. Accessibility Is a Release Requirement
  - PRINCIPLE_5_NAME -> V. Deployment Must Be Verified
  - Added VI. Evidence Is a Deliverable
- Added sections: Non-Negotiable Constraints; Workflow & Quality Gates.
- Removed sections: None.
- Follow-up TODOs: TODO(RATIFICATION_DATE): the original adoption date is not recorded.
-->

# Neon Barrage Constitution

## Core Principles

### I. Correctness Is Observable
Every behavior required by `BENCHMARK_TASK.md` MUST have an explicit acceptance
criterion and a reproducible verification method before it is considered complete.
Implementations MUST preserve the same validation and state transitions across normal
and test-adapter paths. Input, gameplay, collision, score, persistence, loading,
empty, and error behavior MUST be tested at the boundary where each behavior matters.
A feature with no reproducible check is incomplete. Rationale: observable behavior
prevents visual plausibility or local-only success from being mistaken for correctness.

### II. Test-First Engineering (NON-NEGOTIABLE)
Tests MUST be written before implementation for new behavior whenever the test harness
supports it, and the first run MUST demonstrate the missing behavior or failing
regression. Implementation MUST then make the test pass, followed by refactoring.
Every defect fix MUST add a regression test. The test surface MUST cover meaningful
gameplay and data behavior, including integration paths for database validation and
leaderboard persistence. If a test cannot be written first, the responsible agent
MUST record the concrete harness limitation and define the verification check before
implementing the behavior.

### III. Security Is a Boundary Contract
All untrusted input MUST be validated at client, server, and database boundaries, with
database constraints and policies treated as authoritative. Every table in an exposed
schema MUST use row-level security and permit only the minimum public operations.
Service-role credentials and other secrets MUST never reach browser code, committed
artifacts, logs, or client-visible errors. Dependencies MUST be pinned with a
lockfile, migrations MUST reproduce schema and policy state, and security-sensitive
failures MUST fail closed without disclosing protected data. Rationale: a client-side
check alone cannot protect a public persistence boundary.

### IV. Accessibility Is a Release Requirement
All game controls MUST support keyboard operation and touch operation on narrow/mobile
viewports. Interactive controls MUST have accessible names, visible focus, usable
contrast, and status feedback that does not depend on the canvas alone. Audio MUST
begin only after user interaction and MUST have a visible mute control. Animation and
feedback MUST provide a usable reduced-motion or non-animated path where motion could
impair use. Representative desktop and mobile accessibility checks MUST pass before
release. Rationale: accessibility is part of functional correctness, not a cosmetic
post-processing step.

### V. Deployment Must Be Verified
A successful local build MUST NOT be treated as a successful delivery. Each release
MUST be checked at its production URL for a successful HTTP response, application
load, start, gameplay, game-over, restart, and leaderboard path. Verification MUST
include persistence after reload and a real Supabase insert/read round trip through
the public client path. The deployed configuration, schema, migrations, and secret
boundaries MUST be checked against the release artifacts. Any failed or unrun
production check blocks a completion claim.

### VI. Evidence Is a Deliverable
Every acceptance claim MUST map to evidence in the repository or final handoff:
the command or procedure, result, relevant artifact or URL, and verification context
MUST be recorded. Evidence MUST distinguish automated, manual, local, and production
checks. `benchmark-result.json` MUST contain exactly the fields required by
`BENCHMARK_TASK.md`, MUST contain no secret credentials, and MUST report completion
only after deployment and leaderboard round-trip verification pass. Missing, stale,
failed, or inferred evidence MUST be labeled as such and blocks a claim of complete.

## Non-Negotiable Constraints

- `BENCHMARK_TASK.md` is the product acceptance contract. Its requirements MUST be
  traceable to source, tests, configuration, documentation, or verification evidence.
- Source code, tests, migrations, documentation, and lockfiles MUST remain in the
  candidate directory; a deployed site MUST NOT be the only surviving artifact.
- Stable test selectors and the production test adapter are public contracts. The
  adapter MUST use the same game-over and score-submission UI as normal gameplay and
  MUST NOT write directly to Supabase or bypass validation.
- The responsible agent MUST work as the sole agent and MUST NOT delegate work. When
  a non-critical choice is ambiguous, it MUST choose the smallest reversible option
  that preserves the acceptance contract and record the assumption. It MUST mark
  unknown historical facts as TODOs rather than inventing them or waiting for human
  approval.

## Workflow & Quality Gates

- Before implementation, the responsible agent MUST convert each requirement into an
  acceptance matrix covering normal, edge, failure, security, accessibility, and
  deployment cases, then define the associated tests or checks.
- During implementation, the responsible agent MUST use the smallest change that
  satisfies the acceptance matrix, preserve stable interfaces, and review every new
  dependency and permission for necessity.
- Before handoff, the responsible agent MUST run applicable automated tests,
  linting, type checking, build validation, migration or schema checks, accessibility
  checks, production smoke checks, and the real leaderboard round trip.
- At each quality gate, the responsible agent MUST map requirements to artifacts and
  evidence. Unresolved failures, skipped checks, and unsupported claims MUST block a
  `complete` status and be reported with an exact remediation or limitation.

## Governance

This constitution governs engineering decisions for `BENCHMARK_TASK.md`. It is
authoritative for quality, security, accessibility, delivery, and evidence rules;
the benchmark task remains authoritative for product acceptance details.

An amendment MUST state its scope and rationale, include a Sync Impact Report at the
top of this file, update the version and amendment date, and pass the validation
rules below. The responsible agent MAY make a necessary governance decision without
waiting for human input, but MUST record assumptions and MUST NOT fabricate evidence.

Versioning follows semantic versioning. A MAJOR increment is required for a removed
or redefined principle that breaks existing governance. A MINOR increment is required
for a new principle, section, or materially expanded obligation. A PATCH increment is
required for clarification, wording, typo, or other non-semantic refinement.

Compliance MUST be reviewed when requirements are specified, before implementation
is considered finished, before production deployment, and during final handoff. The
review MUST confirm that every principle has a concrete check and that every claimed
result has evidence. Security, accessibility, production verification, and evidence
requirements are release-blocking; a waiver MUST NOT silently convert a failed or
unrun check into a pass.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2026-08-06
