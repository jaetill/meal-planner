# ADR-0031: Instacart shopping-list handoff for delivery ordering

- **Status:** Accepted
- **Date:** 2026-09-18
- **Deciders:** Jason
- **Tags:** integrations, aws, api-gateway, grocery

> **Format:** MADR 4.x with the platform's three extensions (Neutral consequences, Implementation notes, bundled sub-decisions).

## Context and Problem Statement

The grocery list already supports walking a store (aisle-sorted, check-as-you-go). The missing step is delivery: once a user has checked off what they already have, one tap should turn the remainder into an order. The first user who wants this shops at Aldi, which has no public API; Aldi's online ordering runs through Instacart. How much of "list → delivered groceries" can we automate, and where should the integration live?

## Decision Drivers

- Minimize manual browse-select-purchase steps (the project's primary goal).
- Multi-user: a second household must work without Jason managing their credentials.
- The Instacart API key must never reach the browser.
- Keep the IaC footprint proportional to the feature — the REST API's per-route Terraform is ~8 resources.
- Don't add a second "checked" semantic to a list people use while pushing a cart.

## Considered Options

- Sub-decision 1: Ordering mechanism — Instacart Developer Platform (IDP) shopping-list link vs. scraping/automating aldi.us vs. waiting for a cart-write API.
- Sub-decision 2: Where the authenticated route lives — REST API (`e2h43o5aje`, existing Cognito authorizer) vs. HTTP API (`dmtezcygeb`) with a new Cognito JWT authorizer.
- Sub-decision 3: Pantry state — reuse the existing check vs. add a separate "have it" state.

## Decision Outcome

We chose the bundle:

- Sub-decision 1 → **IDP shopping-list link with `retailer_key` pre-selected.** IDP has no cart-write, checkout, or pricing endpoint; the ceiling is a pre-filled list the user finishes on instacart.com. That is still one tap from the plan to a reviewable cart, and it works for any Instacart retailer, not just Aldi.
- Sub-decision 2 → **HTTP API + Cognito JWT authorizer.** Same auth guarantee as the REST Cognito authorizer, ~4 Terraform resources instead of ~8, and it establishes the pattern for future authenticated routes.
- Sub-decision 3 → **Reuse the existing check.** A checked item means "I have it" whether it went into a physical cart or was already in the pantry. A virtual Instacart cart is *not* having it (you can still abandon it), so the handoff sends exactly the unchecked items.

The bundle is internally consistent because the handoff is stateless: no per-user Instacart credentials, no order tracking, so nothing needs to persist beyond the retailer choice in `localStorage`.

## Consequences

### Positive

- Delivery ordering works for Jason's household and the new user with zero per-user OAuth or stored tokens — each person checks out under their own Instacart login.
- Any Instacart retailer in the user's ZIP is selectable; Aldi is just the default use case.
- First JWT-authorized route on the HTTP API; future authenticated endpoints are cheap.

### Negative

- Not fully automatic: the user still reviews product matches and taps checkout on Instacart.
- No Instacart pricing data — the cost feature stays Kroger-only until another price source exists (receipt capture via Claude vision is the likely candidate).
- Production IDP keys require Instacart's review (docs cite 30–40 days from request to production access); until then the Lambda targets `connect.dev.instacart.tools`.
- Match quality depends on ingredient naming. `instacart-utils.js` normalizes units and strips parentheticals, but "2 cups diced yellow onion" style names will still mis-match until recipes carry cleaner ingredient names.

### Neutral

- `retailer_key` pre-selection is documented for recipe links; it is assumed to also apply to shopping-list links and must be verified with a real key.
- The saved retailer is per browser (like the Kroger store), not per group.

## Pros and Cons of the Options

### Sub-decision 1: Ordering mechanism

| Option | Pros | Cons |
|---|---|---|
| **IDP shopping-list link** (chosen) | Official, self-serve dev key, no per-user auth, any retailer | Stops at the cart; no prices; production key needs review |
| Automate aldi.us / scrape | Could in theory reach checkout | ToS violation, brittle, needs user credentials server-side — not portfolio-safe |
| Wait for cart-write API | Would be seamless | Nothing on the horizon from Aldi or Instacart |

### Sub-decision 2: Route placement

| Option | Pros | Cons |
|---|---|---|
| REST API + existing Cognito authorizer | Established convention in CLAUDE.md | ~8 Terraform resources per route (MOCK OPTIONS integration, method/integration responses, deployment) |
| **HTTP API + JWT authorizer** (chosen) | ~4 resources; CORS preflight is a plain route; claims validated at the gateway | Two auth conventions now coexist (raw token vs. `Bearer`); documented in CLAUDE.md |

### Sub-decision 3: Pantry state

| Option | Pros | Cons |
|---|---|---|
| **Reuse the check** (chosen) | Zero new UI; matches how people actually shop | "In cart" label reads slightly off for pantry items |
| Separate "have it" state | Cleaner labels | Second gesture to learn; more state to persist and explain |
| Persistent pantry inventory | Auto-excludes across weeks | Quantities go stale without discipline; large build |

## Implementation notes

- Lambda `lambda/instacart.js` (noaws role), pure helpers in `lambda/lib/instacart-utils.js` with tests in `tests/instacart-utils.test.js`.
- Terraform: `aws_apigatewayv2_authorizer.mp_http_cognito`, `POST|OPTIONS /instacart` routes, Lambda, log group, IAM list entries. Apply **before** merging — `deploy.yml` updates code on a function that must already exist.
- Secret: add `INSTACART_API_KEY` to `meal-planner/secrets`. Flip `INSTACART_HOST` to `connect.instacart.com` when the production key lands.
- Frontend: `src/js/data/instacart.js`, "Order for delivery" button + sheet in `renderGroceryList.js`.

## Links

- [Create shopping list page](https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page) — request/response contract.
- [Get nearby retailers](https://docs.instacart.com/developer_platform_api/api/retailers/get_nearby_retailers/) — `retailer_key` source.
- [Create a recipe page](https://docs.instacart.com/developer_platform_api/guide/tutorials/create_a_recipe_page) — `?retailer_key=` pre-selection.
- ADR-0007 — IaC conventions this follows.
