# ADR-0030: Trim Implementer Trigger to Human-Applied `ready-for-implementer`

- **Status:** Accepted
- **Date:** 2026-05-31
- **Deciders:** Jason
- **Tags:** security, ai-workflows, implementer, ci-cd, injection

> **Format:** This ADR follows [MADR 4.x](https://adr.github.io/madr/) with three documented extensions: (1) **Neutral consequences** as a third bucket alongside Positive/Negative; (2) **Implementation notes** as a separate section before Links; (3) **Bundled sub-decisions** when multiple related decisions are tightly coupled (each sub-decision gets its own Considered Options and Pros and Cons sections).

## Context and Problem Statement

The `claude-implementer.yml` workflow ran the implementer agent with `--permission-mode bypassPermissions` and full code-write tools (`Bash`, `Write`, `Edit`) whenever certain labels were applied to an issue. Among those labels was `source:sentry`, which `auto-label-sentry-issues.yml` would apply automatically to every issue opened by `sentry[bot]`.

Sentry issue bodies contain verbatim application exception messages. An attacker who controls what the app logs — via crafted HTTP inputs, URL parameters, or form fields that appear in exception messages — can embed agent instructions in the body. If the implementer fires on `source:sentry` without human review, the attack chain is: *crafted request → exception message with injected instructions → Sentry creates GitHub issue → `source:sentry` auto-applied → implementer fires → agent executes attacker instructions with full repo write access*.

The question is: how do we ensure the implementer only acts on work that a human has reviewed and approved for implementation?

## Decision Drivers

- **Prompt injection risk.** Issue bodies from external integrations (Sentry, bots) may contain attacker-controlled text. A `bypassPermissions` agent that reads full issue bodies without human review is a high-severity attack surface.
- **Human-in-the-loop for external-origin issues.** ADR-0026 gives the implementer autonomous shipping authority within scope caps — but that authority is predicated on the work item originating from a human decision, not a machine-generated event.
- **Minimal friction for legitimate work.** The mitigation must not require humans to re-apply labels to issues they themselves create.
- **No silent drops.** Sentry issues that warrant implementation should still reach the implementer; the path must exist but must require explicit human action.

## Considered Options

- **Option A:** Keep Sentry auto-trigger; sanitize issue body before passing to agent (strip free-text, extract only structured error ID + file:line)
- **Option B:** Remove `source:sentry` and `severity:critical` auto-triggers; require human-applied `ready-for-implementer` from a non-Bot sender
- **Option C:** Exclude `Bash` from `--allowed-tools` for the Sentry-triggered path, reducing blast radius without blocking the trigger

## Decision Outcome

Chosen option: **Option B**, because it eliminates the injection path entirely by requiring explicit human review before the implementer fires. Body sanitization (Option A) would require maintaining a parser that stays in sync with Sentry's issue format, and any parser gap reintroduces the vulnerability. Tool restriction (Option C) reduces blast radius but leaves the agent reading attacker-controlled text with remaining tools.

The `severity:critical` label is also removed from the auto-trigger list; machine-detected urgency is now handled by the fleet's urgent-dispatch-poll (ADR-0020) rather than a label-triggered local path.

## Consequences

### Positive

- **Injection path eliminated.** No automated process can trigger the implementer on a Sentry issue body without a human applying `ready-for-implementer`.
- **Blast radius bounded at the trigger, not at the tool level.** The agent retains full capability for issues humans have approved; we don't weaken the agent to compensate for a flawed trigger.
- **Consistent with ADR-0026's intent.** The implementer's autonomous authority was always meant to apply to human-reviewed work items, not to machine-generated event streams.

### Negative

- **Sentry → implementation path requires human steps.** A Sentry issue that maps to a clear code fix cannot be auto-implemented end-to-end without a human applying `ready-for-implementer`. This is the intended trade-off.
- **`severity:critical` no longer auto-dispatches locally.** Urgent machine-detected work must go through the fleet promoter's urgent-dispatch-poll instead of a local label trigger. Latency increases slightly for urgent automated dispatch.

### Neutral

- The `source:sentry` label continues to exist and is applied by the incident-responder and its smoke tests; it just no longer triggers the implementer. The label retains its meaning for routing and filtering.
- The `auto-label-sentry-issues.yml` workflow referenced in the original security finding was never deployed to this repo; the vulnerability existed in the `claude-implementer.yml` trigger condition itself.

## Pros and Cons of the Options

### Option A: Keep auto-trigger; sanitize issue body

- ✅ Pro: Fully automated path from Sentry alert to implementation.
- ✅ Pro: Human doesn't need to triage every Sentry issue.
- ❌ Con: Parser must faithfully extract structured data while rejecting free-text. Any parser gap reintroduces injection.
- ❌ Con: Sentry's issue body format is not a formal contract; format changes can silently break sanitization.

### Option B: Remove Sentry auto-triggers; require human `ready-for-implementer` (chosen)

- ✅ Pro: Attack chain is broken at the trigger level; no attacker-controlled text reaches the agent without human review.
- ✅ Pro: Simple to verify: the trigger condition is a single `if:` expression with no parsing logic.
- ❌ Con: Sentry issues require a human step before the implementer acts. Acceptable cost given the severity of the alternative.

### Option C: Restrict `--allowed-tools` for Sentry-triggered path

- ✅ Pro: Reduces blast radius without blocking the automated path.
- ❌ Con: A restricted-tools agent still reads the injected body and can respond to instructions within the tools it has (e.g. posting comments, reading secrets via `Bash`).
- ❌ Con: Requires a separate job with different tool sets, complicating the workflow.

## Implementation notes

- Change implemented in commit `fe4be76` ("chore: trim local implementer trigger to human ready-for-implementer only"), which removed `source:sentry` and `severity:critical` from the `initial` job's `if:` condition and added a `sender.type != 'Bot'` guard.
- The workflow was subsequently replaced by a thin reusable caller (ADR-0034); the equivalent filtering now lives in the platform reusable at `jaetill/agentic-dev-environment/.github/workflows/claude-implementer-reusable.yml`.
- The `sender.type != 'Bot'` guard ensures that even if a future automated process applies `ready-for-implementer`, the implementer will not fire without a human actor.
- Affected workflow: `.github/workflows/claude-implementer.yml`

## Links

- ADR-0026 — Agentic Implementer (dispatch modes, scope caps, escalation); this ADR narrows the Mode A trigger.
- ADR-0020 — Fleet dispatch; urgent-dispatch-poll handles machine-detected urgent work that this ADR removes from the local trigger.
- ADR-0034 — Thin reusable caller; the filtering documented here now lives in the platform reusable.
- [GitHub issue #16](https://github.com/jaetill/meal-planner/issues/16) — original security finding.
