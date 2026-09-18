<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# CONTEXT.md (placeholder)

Repo overview, stack, key dirs, and conventions. Fill in before multi-file builds.

- Root: /home/rajat/Documents/Default Project
- Stack: (TODO — static site: index.html, app.js, styles.css, sw.js?)
- Key dirs: core/, tools/, icons/, vendor/, .opencode/agents/, docs/
- Conventions: small diffs; orchestrator-only Task fan-out; disjoint file ownership; builder no-commit until evaluator PASS; max 2 fix rounds; Step-0 warmup: 2x Task(general) no-op warmup-ok in isolated block before RECON; swallow free-tier first-call failures.
- Required: docs/agents/issue-tracker.md (verdict log), docs/adr/ (decisions).
- Known gaps: prototype skill not installed; no git repo (do NOT git init without user approval); free-tier Task guard fails first 2 calls/block (env-specific, see docs/adr/0001-task-warmup-guard.md).
