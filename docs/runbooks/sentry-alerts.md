# Runbook: Sentry → incident-responder wiring

How prod alerts reach the `incident-responder` agent. One-time setup per
project; once wired, alerts route automatically.

## Architecture

```
Sentry alert rule fires
  → Sentry's native GitHub integration creates an issue in the repo
    with labels `incident:p0,source:sentry`
      → GitHub `issues.opened` event with label `incident:p0`
        → .github/workflows/claude-incident-responder.yml
          → incident-responder agent triages the issue,
            edits in a triage block, posts a postmortem skeleton
```

No custom Lambda, no PAT, no repository_dispatch. Sentry's native GitHub
integration does the heavy lifting; both sides use their built-in features
as designed.

## One-time setup

### 1. Install Sentry's GitHub integration (if not already installed)

In Sentry:

- Settings → Integrations → search "GitHub" → **Install**
- Follow the OAuth flow; grant Sentry access to the `jaetill/game-night-pwa`
  repository (you can scope to specific repos)

The integration's GitHub App needs `Issues: write` and `Contents: read`
on the repo — Sentry handles the install automatically.

### 2. Ensure the labels exist

The workflow's `workflow_dispatch` smoke test creates them automatically
on first run, but you can pre-create them via:

```bash
gh label create incident:p0 --color B60205 --description "Synchronous incident — incident-responder agent paged"
gh label create source:sentry --color 1D76DB --description "Issue created by a Sentry alert"
```

### 3. Configure alert rules in Sentry

For each Sentry alert rule that should page the agent:

- Alerts → select the rule → Actions
- Add: **Create a GitHub Issue**
  - **Repo**: `jaetill/game-night-pwa`
  - **Labels** (comma-separated): `incident:p0,source:sentry`
  - **Assignee**: optional; leave blank or set to yourself

Recommended starting set:
- **P0**: `event.level == fatal AND count > 5 in 5min` (sustained fatals)
- **P0**: `error rate > 50% in 5min` (deploy went bad)

Anything below P0 — issue digest emails are fine; don't dump them all into
GitHub as `incident:p0` or you'll desensitize yourself to the label.

## Smoke testing

The workflow has a `workflow_dispatch` trigger for testing without Sentry:

```bash
gh workflow run claude-incident-responder.yml
```

This opens a synthetic issue with labels `incident:p0,source:sentry,smoke-test`,
triggers the agent (which recognizes the `smoke-test` label and short-
circuits), and then closes the issue.

To test the real-incident path, open an issue manually with the
`incident:p0` label and a Sentry-shaped body. The agent will read it,
add a triage block, and post a postmortem skeleton.

## Failure modes

- **No issue gets created when an alert fires** → check Sentry's
  Settings → Integrations → GitHub → "View installation" — the integration
  may have been suspended (GitHub App tokens can expire after long
  inactivity).
- **Issue created but agent doesn't run** → verify the label is exactly
  `incident:p0` (case-sensitive); check the workflow's run history for the
  `issues.opened` event.
- **Agent runs on every new issue regardless of label** → the `if:`
  condition in the workflow is misconfigured; check
  `contains(github.event.issue.labels.*.name, 'incident:p0')`.

## What the agent does NOT do

- Execute mitigation actions (no AWS CLI in the workflow)
- Close the incident issue (the human owns the close)
- Remove the `incident:p0` label

If mitigation is automated elsewhere, the agent surfaces the recommended
action and the human (or a separate automation) executes it.

## Cross-app reuse

Same recipe for meal-planner, jaetill-portal, etc.:
1. Install Sentry's GitHub integration on the repo (probably already
   shared via the org install).
2. Copy `.github/workflows/claude-incident-responder.yml` to the new repo.
3. Configure each Sentry project's alert rules to "Create a GitHub Issue"
   in the corresponding repo with the same label set.

## Migration history

The original design called for Sentry → `repository_dispatch` via a
custom webhook with a PAT. Abandoned because Sentry's Internal Integration
webhook system doesn't support the custom headers / body templates that
GitHub's `/dispatches` endpoint requires. If you find PATs named
`sentry-dispatch-*` in 1Password or unused Internal Integrations in
Sentry, they're vestigial — safe to delete.
