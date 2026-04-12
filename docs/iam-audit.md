# Meal Planner IAM Audit

**Date:** 2026-04-11
**Auditor:** Jason + Claude
**Role under review:** `MealPlannerSave-role-c47ma2hi`

## Current State

All 7 Lambda functions share a single IAM execution role:

| Lambda | Uses S3? | S3 Operations | Env Vars |
|--------|----------|---------------|----------|
| MealPlannerSave | Yes | GetObject, PutObject | ANTHROPIC_API_KEY |
| meal-planner-groups | Yes | GetObject, PutObject | (none) |
| meal-planner-plan | Yes | GetObject only | ANTHROPIC_API_KEY |
| meal-planner-alexa | Yes | GetObject, PutObject | ALEXA_USERNAME |
| meal-planner-nutrition | **No** | (none) | USDA_API_KEY, ANTHROPIC_API_KEY |
| meal-planner-kroger | **No** | (none) | KROGER_CLIENT_ID, KROGER_CLIENT_SECRET |
| meal-planner-share | **No** | (none) | POSTMARK_API_KEY, FROM_EMAIL |

### Current Policies on Role

**Inline: `meal-planner-s3-access`**
```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
  "Resource": [
    "arn:aws:s3:::jaetill-meal-planner",
    "arn:aws:s3:::jaetill-meal-planner/*"
  ]
}
```

**Managed: `AWSLambdaBasicExecutionRole-acdb24f8-...`**
```json
[
  { "Action": "logs:CreateLogGroup", "Resource": "arn:aws:logs:us-east-2:214599503944:*" },
  { "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
    "Resource": "arn:aws:logs:us-east-2:214599503944:log-group:/aws/lambda/MealPlannerSave:*" }
]
```

## Findings

### F1: Unused S3 permissions (Medium)
`s3:DeleteObject` and `s3:ListBucket` are granted but **no Lambda code uses them**.
These expand the blast radius if a function is compromised.

### F2: Broken CloudWatch logging for 6 of 7 functions (High)
The managed logs policy only allows writes to `/aws/lambda/MealPlannerSave`.
The other 6 functions (`meal-planner-groups`, `meal-planner-nutrition`, etc.)
cannot create log streams or put log events to their own log groups.

### F3: Over-privileged functions (Medium)
Three functions (nutrition, kroger, share) make zero AWS SDK calls but inherit
full S3 read/write access via the shared role.

### F4: Single shared role (Low)
All 7 functions share one role. Best practice is per-function roles so a
compromise of one function doesn't grant access to resources only needed by others.
For a personal app this is low-risk, but worth noting.

## Remediation

### R1: Remove unused S3 actions
Remove `s3:DeleteObject` and `s3:ListBucket` from the inline policy. No code
uses these.

**Before:** `["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]`
**After:** `["s3:GetObject", "s3:PutObject"]`

### R2: Fix CloudWatch logging
Update the managed policy to include all 7 Lambda log groups. Replace the single
log group resource with:
```
arn:aws:logs:us-east-2:214599503944:log-group:/aws/lambda/MealPlannerSave:*
arn:aws:logs:us-east-2:214599503944:log-group:/aws/lambda/meal-planner-groups:*
arn:aws:logs:us-east-2:214599503944:log-group:/aws/lambda/meal-planner-nutrition:*
arn:aws:logs:us-east-2:214599503944:log-group:/aws/lambda/meal-planner-kroger:*
arn:aws:logs:us-east-2:214599503944:log-group:/aws/lambda/meal-planner-alexa:*
arn:aws:logs:us-east-2:214599503944:log-group:/aws/lambda/meal-planner-share:*
arn:aws:logs:us-east-2:214599503944:log-group:/aws/lambda/meal-planner-plan:*
```

### R3: Split into two roles (stretch)
Create a second role (`meal-planner-noaws-role`) with only CloudWatch logs
permissions for the three functions that don't touch S3 (nutrition, kroger, share).
This follows least-privilege without the overhead of 7 separate roles.

## Changes Applied

| # | Change | Status |
|---|--------|--------|
| R1 | Remove s3:DeleteObject and s3:ListBucket from Lambda role | Done |
| R2 | Add all Lambda log groups to CloudWatch policy (v2) | Done |
| R3 | Create `meal-planner-noaws-role` for nutrition/kroger/share | Done |
| — | Add new role to `jaetill-dev-lambda` PassRole list (v3) | Done |
| — | Fix typo: removed duplicate PassRole entry with wrong account ID | Done |
| — | Update CLAUDE.md (project + global) with new role structure | Done |
