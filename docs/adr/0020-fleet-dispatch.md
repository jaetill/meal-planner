# ADR-0020: Fleet Dispatch — Uniform Promoter Interface, Mode C Cleanup-Sweep, Triage-Bot Retirement

- **Status:** Accepted
- **Date:** 2026-05-22
- **Deciders:** Jason
- **Tags:** ai-workflows, implementer, ci-cd, fleet, orchestration

> **Format:** This ADR follows [MADR 4.x](https://adr.github.io/madr/) with three documented extensions: (1) **Neutral consequences** as a third bucket alongside Positive/Negative; (2) **Implementation notes** as a separate section before Links; (3) **Bundled sub-decisions** when multiple related decisions are tightly coupled (each sub-decision gets its own Considered Options and Pros and Cons sections).

## Context and Problem Statement

The platform runs an implementer agent in every project repo (ADR-0026). Prior to this ADR, each repo's `claude-implementer.yml` was triggered only by local label events (`ready-for-implementer` applied by a human or by the triage-bot scanning that same repo). A separate `claude-triage-bot.yml` workflow scanned logs and filed issues locally.

The question: how should a fleet-level promoter — an external orchestrator that manages work across all repos — dispatch the implementer uniformly, handle spare-capacity cleanup work, and avoid double-triggering when it applies the dispatch label itself?

This is a bundled ADR because three decisions are tightly coupled: (1) the promoter's dispatch interface determines whether a uniform fleet is even possible; (2) the cleanup-sweep mode only makes sense if the promoter can address a specific batch of nit issues in a spare-capacity signal; and (3) the bot-guard requirement exists precisely because the promoter dispatch and the label-event trigger would otherwise both fire on the same issue.

## Decision Drivers

- **Fleet uniformity.** The promoter must be able to dispatch the implementer in any repo using a single, stable interface — ideally one `gh workflow run` invocation that works identically everywhere.
- **Spare-capacity drain.** Deferred nit issues accumulate in every repo. The promoter needs a mode to batch them up and hand them off without re-implementing a full Mode A flow.
- **No double-trigger.** When the promoter applies `ready-for-implementer` as part of a dispatch sequence, the label-event trigger and the `workflow_dispatch` trigger must not both fire the same job against the same issue.
- **Security (ADR-0030 alignment).** Bot-applied labels must not autonomously trigger the implementer; only human-applied or explicit `workflow_dispatch` inputs are trusted.
- **Triage-bot duplication.** The local triage-bot workflow and the fleet promoter now both have responsibility for discovering and routing work. Maintaining both creates drift and ambiguity about which is authoritative.

## Considered Options

Three sub-decisions:

- **Sub-decision 1 — Promoter dispatch interface:** how the fleet promoter triggers the implementer per repo
- **Sub-decision 2 — Spare-capacity mode:** how deferred nit work drains when the promoter has idle capacity
- **Sub-decision 3 — Triage-bot disposition:** whether to keep the local triage-bot workflow alongside fleet dispatch

## Decision Outcome

We adopt the bundle:

- Sub-decision 1 → **`workflow_dispatch` with `issue_number` / `mode` / `bundle_issues` inputs**, plus a `sender.type != 'Bot'` guard on the label-triggered path
- Sub-decision 2 → **Mode C: cleanup-sweep** — promoter sets `mode: cleanup-sweep`; implementer drains same-file deferred nit issues in one pass (per ADR-0029 adjacency rules)
- Sub-decision 3 → **Retire `claude-triage-bot.yml`** — fleet-wide triage is the promoter's responsibility; the local workflow is redundant and creates ambiguity

The bundle is internally consistent because: the uniform `workflow_dispatch` interface is what enables the promoter to exist; Mode C is what makes spare-capacity dispatch valuable; and retiring the triage-bot removes the only other agent that could duplicate dispatch signals.

## Consequences

### Positive

- **Uniform fleet interface.** Any repo with `claude-implementer.yml` in the standard form is reachable from the promoter via a single `gh workflow run` call — no per-repo dispatch customization needed.
- **Spare-capacity cycles produce value.** Mode C lets the promoter turn idle time into merged nit fixes rather than leaving deferred issues to accumulate indefinitely.
- **Double-trigger eliminated.** The `sender.type != 'Bot'` guard means the promoter can apply `ready-for-implementer` and the label-event job will not fire; only the `workflow_dispatch` path runs.
- **Single authoritative triage point.** The fleet promoter owns discovery and routing. Repos don't maintain their own triage agents that might diverge from the fleet's classification.

### Negative

- **Local Sentry/log triage is no longer automated per-repo.** A log spike in this repo doesn't auto-file issues via the local triage-bot; it must reach the promoter's triage scan to get filed. Latency may increase slightly for issues that would have been caught by a repo-local daily scan.
- **Mode C correctness depends on the promoter's adjacency selection.** If the promoter selects a non-adjacent nit (file mismatch), the implementer is instructed to drop it rather than close it — the promoter must correctly apply ADR-0029 rules to avoid wasted dispatch.
- **`sender.type != 'Bot'` guard is a heuristic.** GitHub-App bots present as `Bot` sender type; human accounts and the promoter's `workflow_dispatch` do not. A future integration using a human-owned token would bypass the guard.

### Neutral

- The `claude-triage-bot.yml` workflow deletion removes 91 lines of YAML from this repo. The triage capability itself still exists — it's in the platform promoter, not here.
- The three dispatch modes (A: initial, B: fix-iteration, C: cleanup-sweep) are fully defined in ADR-0026. This ADR is the origin point for Mode C and the fleet interface; ADR-0026 documents their place in the overall implementer model.
- The `bundle_issues` input (Mode C's payload) follows the adjacency rules in ADR-0029, filed separately.

## Pros and Cons of the Options

### Sub-decision 1: Promoter dispatch interface

| Option | Trade-off |
|---|---|
| **Label-only (status quo)** | No code change; promoter must apply `ready-for-implementer` via API — but then the label-event trigger and any promoter-driven path both fire, causing double-runs. |
| **`workflow_dispatch` with structured inputs + bot guard** (chosen) | Promoter calls `gh workflow run`; bot guard prevents label-event from also firing. Clean separation of concerns. |
| **Separate `claude-fleet-implementer.yml` per repo** | Avoids double-trigger without a guard; but every repo needs a second workflow, doubling the maintenance surface and adding per-repo deviation risk. |

### Sub-decision 2: Spare-capacity mode

| Option | Trade-off |
|---|---|
| **No spare-capacity mode; promoter just dispatches Mode A for nits** | Simplest; each nit gets a full Mode A run, but deferred nits were deferred precisely because they didn't justify their own PR cycle. |
| **Mode C: cleanup-sweep with `bundle_issues`** (chosen) | Promoter batches adjacent nits into one pass; fewer PRs, faster drain. Requires adjacency discipline (ADR-0029) to avoid incoherent bundles. |
| **Promoter batches issues into a single Mode A run with a combined prompt** | Maximum efficiency; but a combined-issue prompt is fragile — a blocker on one nit can stall all of them. Per-issue separation in Mode C is safer. |

### Sub-decision 3: Triage-bot disposition

| Option | Trade-off |
|---|---|
| **Keep triage-bot alongside fleet dispatch** | Redundant scanning; two dispatch sources; ambiguous authority when both file the same issue. |
| **Keep triage-bot but disable its dispatch capability** | Preserves local log-scanning; but a disabled-dispatch triage-bot is just a log scanner — not worth a dedicated workflow. |
| **Retire triage-bot; fleet promoter owns triage** (chosen) | Single authority; no duplication; fleet promoter's triage scope spans all repos, so per-repo triage is subsumed. |

## Implementation notes

- Workflow: `.github/workflows/claude-implementer.yml` — `workflow_dispatch` inputs `issue_number`, `mode`, `bundle_issues` added; `sender.type != 'Bot'` guard on the label-event initial job
- `claude-triage-bot.yml` deleted in the same PR (project-repo side)
- Platform reusable: `jaetill/agentic-dev-environment/.github/workflows/claude-implementer-reusable.yml` — the actual Mode C branch and bot-guard logic live here (ADR-0034 thin-caller pattern); this repo's `claude-implementer.yml` is a thin forwarder
- Fleet promoter companion: platform PR `jaetill/agentic-dev-environment#33`
- Mode C adjacency selection: the promoter pre-selects nits per ADR-0029 before dispatching; the implementer receives them in `bundle_issues` and confirms or drops each based on actual file overlap

## Links

- ADR-0026 — Agentic Implementer (modes A/B/C model, scope caps, iteration limits; Mode C operationally defined here)
- ADR-0029 — Adjacent-nit bundling (`bundle_issues` input; adjacency rules the promoter must follow for Mode C)
- ADR-0030 — Trim implementer trigger to human-only `ready-for-implementer` (same `sender.type != 'Bot'` guard; aligns with this ADR's bot-guard decision)
- ADR-0034 — Thin reusable caller (implementer logic lives in platform repo; project `claude-implementer.yml` is a thin forwarder)
- ADR-0011 — AI Workflows (12-subagent architecture; triage-bot originally one of the 12)
