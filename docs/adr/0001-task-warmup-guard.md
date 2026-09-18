<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# ADR 0001: Step-0 Task Warmup Guard

Date: 2026-09-19
Status: Accepted

## Context

Free-tier Task guard fails first 2 calls per block (env-specific).

## Decision

Run 2x Task(general) no-op warmup-ok in isolated block before RECON, ignore result.

## Consequences

- +2 spawns overhead
- Improved reliability for subsequent Task fan-out

## Alternatives

- Single warmup: insufficient, first-call failures persist.
- Custom-agent warmup: rejected.
- Retry-loop: rejected.
