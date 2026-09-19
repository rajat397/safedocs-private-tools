<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# ADR 0002: Jittered Specialist Retry Policy

Date: 2026-09-19
Status: Accepted

## Context

Free-tier Task guard fails first 2 calls per block for specialist agents (env-specific). Need a retry policy that handles transient failures without overwhelming the system.

## Decision

Implement Full Jitter retry for specialist agents:
- Base delay: 100ms
- Cap delay: 5s
- Max attempts: 3
- Trigger only on free-tier guard string match

## Consequences

- Reduced cascade failures under free-tier limits
- Bounded latency impact (max ~5.1s per failing call)
- Prevents thundering herd via Full Jitter distribution

## Alternatives

- Exponential backoff without jitter: rejected (thundering herd risk)
- Fixed delay: rejected (no adaptation to load)
- Unlimited retries: rejected (unbounded latency)
- Higher base delay: rejected (unnecessary latency for quick recoveries)