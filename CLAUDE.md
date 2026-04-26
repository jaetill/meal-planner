# Meal Planner — Claude Context

## What this app is
A personal meal planning PWA. Recipes, weekly meal plans, grocery lists with
Kroger pricing, nutrition tracking, and an Alexa skill for hands-free cook mode.
Hosted at **https://meals.jaetill.com**.

## Tech stack
- **Frontend**: Vite + Tailwind SPA. Two HTML entry points: `index.html` (app)
  and `callback.html` (OAuth redirect target). Auth via Cognito Hosted UI
  (OAuth Authorization Code + PKCE), hand-rolled in `src/js/auth.js` — no
  `aws-amplify` dependency.
- **Backend**: API Gateway REST API → Lambda (Node.js 20). No shared runtime
  dependencies — Lambdas use only AWS SDK and Node built-ins.
- **Storage**: S3 bucket `jaetill-meal-planner` (private, served via CloudFront).
- **Auth**: Cognito user pool `us-east-2_xneeJzaDJ`, web client
  `2g8kng7thvouq1ami8cm336gbb`, managed-login branding `fc0030b0-27fe-4c33-b492-e165435e73cf`.
  API Gateway has a single Cognito authorizer (`o0c2k9`) on authenticated routes.
- **Authz**: Group `meal-planner-users` required. Frontend `app.js` redirects
  non-members to portal; Lambdas (`save`, `groups`, `plan`, `share`) return
  403 if claim missing.

## AWS resources
| Resource | Value |
|---|---|
| S3 bucket | `jaetill-meal-planner` |
| CloudFront distribution | `E301SUJKLJO7A7` → `meals.jaetill.com` |
| API Gateway | `e2h43o5aje` (prod stage) |
| Cognito user pool | `us-east-2_xneeJzaDJ` |
| Lambda execution role (S3) | `MealPlannerSave-role-c47ma2hi` — save, groups, plan, alexa |
| Lambda execution role (no S3) | `meal-planner-noaws-role` — nutrition, kroger, share |
| GitHub deploy role | `meal-planner-github-deploy` (OIDC) |
| Region | `us-east-2` |

## API Gateway routes (`e2h43o5aje/prod`)
All POST routes require the Cognito authorizer. Claims available in Lambda as
`event.requestContext.authorizer.claims['cognito:username']`.

| Route | Lambda | Auth | Purpose |
|---|---|---|---|
| POST /save | MealPlannerSave | Cognito | Write recipes.json, meal-plans.json, staples.json |
| POST /import | MealPlannerSave | Cognito | Import recipe from URL (Schema.org + Claude fallback) |
| POST /cook | MealPlannerSave | Cognito | Read/write cook session |
| GET /groups | meal-planner-groups | Cognito | List user's groups |
| POST /groups | meal-planner-groups | Cognito | Create group, invite, join, share recipe, etc. |
| GET /nutrition | meal-planner-nutrition | None | USDA + Claude nutrition lookup |
| GET /locations | meal-planner-kroger | None | Kroger store search by ZIP |
| GET /products | meal-planner-kroger | None | Kroger product/price search |
| POST /share | meal-planner-share | Cognito | Email recipe as Schema.org JSON via Postmark |
| POST /plan | meal-planner-plan | Cognito | AI-assisted meal plan generation and refinement |

## Lambda files (`lambda/`)
Each file is zipped and deployed independently by `deploy.yml`.

| File | Function name | Secrets / env vars |
|---|---|---|
| `save.js` | `MealPlannerSave` | SM: `meal-planner/secrets` (`ANTHROPIC_API_KEY`) |
| `groups.js` | `meal-planner-groups` | — |
| `nutrition.js` | `meal-planner-nutrition` | SM: `meal-planner/secrets` (`ANTHROPIC_API_KEY`, `USDA_API_KEY`) |
| `kroger.js` | `meal-planner-kroger` | SM: `meal-planner/secrets` (`KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`) |
| `alexa.js` | `meal-planner-alexa` | env: `ALEXA_USERNAME` (= Cognito username, currently `jaetill`) |
| `share.js` | `meal-planner-share` | SM: `meal-planner/secrets` (`POSTMARK_API_KEY`); env: `FROM_EMAIL` |
| `plan.js` | `meal-planner-plan` | SM: `meal-planner/secrets` (`ANTHROPIC_API_KEY`) |

**Secrets Manager:** All API keys are in `meal-planner/secrets` (us-east-2).
Secrets are cached in Lambda module scope — fetched once per cold start (~50-100ms),
reused across warm invocations.

## S3 data layout
```
groups/{groupId}/recipes.json        — recipe list for a group
groups/{groupId}/meal-plans.json     — meal plan for a group
groups/{groupId}/staples.json        — staples list for a group
groups/{groupId}/info.json           — group metadata (name, members, invite codes)
users/{userId}/groups.json           — list of groups a user belongs to
incoming/{userId}/index.json         — incoming cross-account recipe shares
codes/{code}.json                    — invite code → groupId mapping
cook-sessions/{userId}.json          — active cook session (read by Alexa skill)
photos/{recipeId}                    — recipe photo (uploaded during URL import)
```

## Frontend data flow
- **Reads**: `fetch('https://meals.jaetill.com/{s3-key}')` — always CloudFront,
  never direct S3 (bucket is private). Use `cache: 'no-cache'` on all fetches.
- **Writes**: POST to Lambda via API Gateway with Cognito JWT in `Authorization`
  header (obtained from `Auth.currentSession().getIdToken().getJwtToken()`).
- **Active group**: stored in `localStorage('activeGroupId')`. All reads/writes
  are scoped to `groups/{activeGroupId}/`.
- All S3 writes set `CacheControl: 'no-cache, no-store, must-revalidate'`.

## Frontend source (`src/js/`)
```
auth.js                    — PKCE flow, token storage, JWT decode (mp.* localStorage keys)
callback.js                — OAuth redirect handler (paired with /callback.html)
app.js                     — init, nav tabs, auth + group gate (redirects to portal if not in meal-planner-users)
config.js                  — API_BASE, Cognito Hosted UI config
data/index.js              — all data access (load/save/share), URL constants
data/nutrition.js          — nutrition fetch + per-serving calc
data/kroger.js             — Kroger store/product fetching
components/
  renderRecipes.js         — recipe list + search + incoming shares banner
  renderRecipeView.js      — recipe detail, share sheet (username + email tabs)
  renderRecipeForm.js      — recipe create/edit form
  renderCookMode.js        — fullscreen step-by-step cook UI; polls S3 every 5s
                             to sync with Alexa; wake lock; timer badges
  renderMealPlan.js        — weekly meal plan grid + recipe picker
  renderGroceryList.js     — ingredient aggregation, Kroger pricing, staples
  renderGroupSettings.js   — group switcher, invite codes, member list
ui/elements.js             — btn(), field() helpers
ui/toast.js                — toast notifications
```

## Alexa skill ("my cooking assistant")
- Invocation name: **"my cooking assistant"** (changed from "meal planner" to
  avoid conflict with a published skill of the same name)
- Reads `cook-sessions/{ALEXA_USERNAME}.json` from S3 directly via AWS SDK
- Session is written when user taps **Cook** in the app (`renderCookMode` →
  `startCookSession` → POST /cook)
- **Flow**: tap Cook in app first, then open Alexa skill
- Timers fire for the step being *completed* (on WhatsNext), not the incoming step
- App polls /cook every 5s while cook mode is open to sync Alexa-driven advances

## Deployment
- `deploy.yml` runs on push to `master`
- S3 sync: HTML with `no-cache`, assets with `max-age=31536000, immutable`
- **Never use `--delete`** on S3 sync — bucket holds both app files and user data
- CloudFront invalidation: `/index.html` and `/login.html` only
- Each Lambda zipped and deployed individually; adding a new Lambda requires
  both a deploy step in `deploy.yml` AND adding it to `meal-planner-github-deploy`
  role's inline `deploy` policy

## Groups & multi-tenancy
- Every user has one or more groups. All recipe/plan/staple data is group-scoped.
- First login auto-creates a "My Kitchen" group and migrates any pre-groups flat
  data (`recipes.json`, `meal-plans.json` at bucket root).
- Cross-account recipe sharing: sender writes to `incoming/{targetUsername}/`;
  recipient sees a banner and can accept (copies recipe into their group) or dismiss.

## Key gotchas
- Kroger and nutrition routes have **no Cognito auth** — they're public GET endpoints
  (no user data involved)
- `nutrition.js` has no S3 access; `kroger.js` has no S3 access
- `save.js` handles three routes via path detection (`/save`, `/import`, `/cook`)
- Recipe `directions` are stored as `[{ text, duration }]` objects (duration in
  seconds, parsed from text). Some imported recipes have HTML entities in step text
  — `save.js` decodes these when writing cook sessions
- `ALEXA_USERNAME` must exactly match the Cognito username (`jaetill`)
