# ADR-0026: Agentic Implementer — Modes, Scope Caps, and Escalation

- **Status:** Accepted
- **Date:** 2026-05-31
- **Deciders:** Jason
- **Tags:** ai-workflows, implementer, ci-cd, scope-caps, escalation

> **Format:** MADR 4.x (bundled sub-decisions). See `template.md`.

## Context and Problem Statement

ADR-0011 (AI Workflows) establishes a 12-subagent architecture and the principle
of AI shipping authority for scoped work. One of those subagents is the
`implementer` — a CI-resident agent that reads GitHub issues and produces commits,
branches, and PRs without human involvement in the implementation loop itself.

The question: what are the exact boundaries under which the implementer may act
autonomously, how does it receive work, and what does the escalation path look like
when it cannot converge?

This is a bundled ADR because the dispatch model, scope caps, and iteration limit
are co-dependent: widening scope without tightening iteration limits would allow the
agent to diverge indefinitely; narrowing the iteration limit without explicit escalation
would silently drop work; and the dispatch model determines which triggering events
flow into which operational mode.

## Decision Drivers

- **AI-autonomy default** (ADR-0011). The implementer must not block the pipeline
  waiting for human confirmation on work that fits within defined scope.
- **Scope discipline.** Unbounded autonomous changes to a codebase are unsafe
  regardless of quality gates. A hard cap makes the failure mode bounded and
  predictable.
- **Convergence guarantee.** Fix iteration must terminate — the agent cannot spin
  indefinitely re-attempting a failing review gate.
- **Fleet uniformity.** The promoter dispatches the implementer by workflow name
  across all repos; the dispatch interface must be uniform (ADR-0020).
- **Never touches IaC.** Terraform changes carry infrastructure risk that exceeds
  the implementer's autonomous authority (ADR-0007).

## Considered Options

Three sub-decisions:

- **Sub-decision 1 — Dispatch modes:** which events invoke the implementer and what
  each mode does
- **Sub-decision 2 — Scope caps:** how large a single implementer run may be
- **Sub-decision 3 — Iteration limit and escalation:** when fix iteration terminates
  and what happens next

## Decision Outcome

We adopt the bundle:

- Sub-decision 1 → **Three dispatch modes** (A: initial implementation; B: fix
  iteration; C: cleanup-sweep)
- Sub-decision 2 → **50 LOC / 3 files / 1 component hard cap**
- Sub-decision 3 → **Max 3 fix-iteration attempts, then human escalation**

The bundle is internally consistent because each mode has its own scope-cap
enforcement path, and the iteration limit applies to Mode B only (Mode A is a
single attempt by definition).

## Consequences

### Positive

- **Bounded blast radius.** The 50 LOC / 3 files / 1 component cap ensures no
  single implementer run can refactor large surface areas unreviewed.
- **Convergence guarantee.** The 3-iteration limit prevents indefinite churn on
  issues the agent cannot resolve without architectural input.
- **Uniform fleet interface.** `workflow_dispatch` with `issue_number` / `mode` /
  `bundle_issues` inputs lets the fleet promoter drive every repo identically.
- **Deferred work drains automatically.** Mode C (cleanup-sweep) lets the promoter
  reclaim spare-capacity cycles for small deferred nits without manual scheduling.
- **Separation of concerns.** IaC changes are excluded by both workflow guards
  (`!contains(labels, 'scope:iac')`) and agent prompt — the IaC implementer handles
  those separately.

### Negative

- **Scope cap is enforced in the agent prompt, not the workflow.** A prompt
  regression could allow an over-scoped run before it is caught in review. Mitigated
  by: code-reviewer and security-reviewer gate every PR the implementer opens.
- **Mode B triggered by issue_comment (not formal PR review).** GitHub Actions does
  not fire `pull_request_review` for bot-posted review comments, so the workflow
  polls issue comments for `VERDICT: BLOCK`. This is fragile if the reviewer
  changes its comment format. Mitigated by: reviewer agents post consistently
  structured comments per ADR-0005.
- **Daily activation cap is TODO.** Workflow-level enforcement of a daily cap is not
  yet implemented; only the agent prompt carries the intent. Mitigated by: mode
  concurrency group cancellation limits per-issue parallelism.

### Neutral

- The thin-caller refactor (ADR-0034) moved the implementation to the platform
  reusable workflow, so changes to implementer behavior are made once there. This
  ADR documents the architectural decisions that govern the reusable; ADR-0034
  documents the thin-caller shape itself.
- Mode C was introduced with ADR-0020 (fleet dispatch). The cleanup-sweep concept
  is operationally defined there; this ADR records its place in the three-mode model.

## Pros and Cons of the Options

### Sub-decision 1: Dispatch modes

| Option | Trade-off |
|---|---|
| **Single mode (label-triggered only)** | Simpler; no fix iteration; human must re-label after each review failure. |
| **Two modes (A + B)** | Covers the main loop: implement, review, fix. No spare-capacity cleanup. |
| **Three modes (A + B + C)** (chosen) | Adds cleanup-sweep for deferred nits; promoter can drain the backlog automatically. |

### Sub-decision 2: Scope caps

| Option | Trade-off |
|---|---|
| **No cap** | Maximum flexibility; unbounded risk; no convergence signal for the reviewer. |
| **100 LOC / 5 files** | Allows small features; still fits in a single PR review pass. |
| **50 LOC / 3 files / 1 component** (chosen) | Conservative; matches bug-fix and single-feature scope; forces complex work to be split into issues or escalated. |

### Sub-decision 3: Iteration limit

| Option | Trade-off |
|---|---|
| **1 attempt (no fix iteration)** | Simplest; every failure escalates immediately; human reviews every rejection. |
| **3 attempts then escalate** (chosen) | Balances autonomy with convergence; 3 passes covers the common case of style + logic + edge-case feedback. |
| **Unlimited attempts** | Maximally autonomous; can diverge indefinitely on genuinely intractable issues. |

## Implementation notes

- Workflow: `.github/workflows/claude-implementer.yml` (thin caller per ADR-0034)
- Platform reusable: `jaetill/agentic-dev-environment/.github/workflows/claude-implementer-reusable.yml`
- Agent prompt: `.claude/agents/implementer.md` (delivered via platform plugin per ADR-0015)
- IaC exclusion guard: `!contains(github.event.issue.labels.*.name, 'scope:iac')` in job `if` condition
- Escalation comment posted via `gh pr comment` when 3 iterations are exhausted
- Mode C activation: `workflow_dispatch` input `mode: cleanup-sweep`; `bundle_issues` input carries ADR-0029 adjacent-nit bundle

## Links

- ADR-0011 — AI Workflows (parent; establishes 12-subagent architecture and autonomy principle)
- ADR-0020 — Fleet dispatch and Mode C cleanup-sweep *(pending)*
- ADR-0029 — Adjacent-nit bundling (bundle_issues input) *(pending)*
- ADR-0030 — Trim local trigger to human-only `ready-for-implementer`
- ADR-0034 — Thin reusable caller (workflow shape; implementer logic lives in platform repo) *(pending)*
- ADR-0007 — IaC (governs the terraform exclusion)
- ADR-0005 — Quality gates (reviewer comment structure that Mode B depends on)
