"""Reparse recipe steps for all groups using Claude.

Reads each group's recipes.json from S3, splits over-stuffed steps into
single-action steps, re-runs duration detection on the new steps, and
writes the updated recipes.json back to S3.

Rules Claude follows:
  - Split on distinct sequential phases (time, temperature, technique changes)
  - Keep single-action steps together even if they list multiple ingredients
  - Preserve original wording; only split, never rewrite

Usage:
    python tools/reparse_steps.py [--dry-run] [--group-id GROUP_ID]

Options:
    --dry-run      Print changes without writing to S3
    --group-id ID  Process only the specified group (default: all groups)

Requires:
    pip install boto3
    ANTHROPIC_API_KEY env var set
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import boto3

BUCKET        = 'jaetill-meal-planner'
REGION        = 'us-east-2'
OWNER_USER    = 'jaetill'
MODEL         = 'claude-haiku-4-5-20251001'
MAX_TOKENS    = 2048
RATE_LIMIT_S  = 0.5  # seconds between Claude calls

s3 = boto3.client('s3', region_name=REGION)


# ── Duration parsing (mirrors save.js) ────────────────────

def parse_duration_from_text(text):
    """Returns (min_seconds, max_seconds) or (None, None)."""
    if not text:
        return None, None

    def to_sec(n, unit):
        u = unit.lower()
        if 'hour' in u or u == 'hr':
            return int(n) * 3600
        if 'min' in u:
            return int(n) * 60
        return int(n)

    range_pat = re.compile(
        r'(\d+)\s*(?:[-\u2013]|to)\s*(\d+)\s*(minute|min|hour|hr|second|sec)s?', re.I)
    m = range_pat.search(text)
    if m:
        return to_sec(m.group(1), m.group(3)), to_sec(m.group(2), m.group(3))

    hourmin = re.search(r'(\d+)\s*(?:hour|hr)s?\s*(?:and\s*)?(\d+)\s*(?:minute|min)s?', text, re.I)
    if hourmin:
        return int(hourmin.group(1)) * 3600 + int(hourmin.group(2)) * 60, None

    hour = re.search(r'\b(?:for|about)\s+(\d+)\s*(?:hour|hr)s?|(\d+)\s*(?:hour|hr)s?', text, re.I)
    if hour:
        return int(hour.group(1) or hour.group(2)) * 3600, None

    minute = re.search(r'\b(?:for|about)\s+(\d+)\s*(?:minute|min)s?|(\d+)\s*(?:minute|min)s?', text, re.I)
    if minute:
        return int(minute.group(1) or minute.group(2)) * 60, None

    sec = re.search(r'\b(?:for|about)\s+(\d+)\s*(?:second|sec)s?|(\d+)\s*(?:second|sec)s?', text, re.I)
    if sec:
        return int(sec.group(1) or sec.group(2)), None

    return None, None


def step_from_text(text):
    text = text.strip()
    mn, mx = parse_duration_from_text(text)
    step = {'text': text, 'duration': mn}
    if mx:
        step['durationMax'] = mx
    return step


# ── Claude call ────────────────────────────────────────────

def call_claude(texts):
    """Send step texts to Claude for splitting. Returns list of strings."""
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        raise RuntimeError('ANTHROPIC_API_KEY env var not set')

    prompt = f"""Split these recipe directions into clean steps.

Rules:
- Split a step when it describes distinct sequential phases separated by time, temperature change, or technique (e.g. "Cook for 5 minutes, then add butter and cook for 3 more minutes" → two steps).
- Keep a step together when it lists multiple ingredients or items within a single action (e.g. "Add flour, sugar, salt, and baking powder to the bowl" stays as one step).
- Keep a step together when it describes a single continuous action (e.g. "Stir occasionally and check for doneness" stays as one step).
- Preserve original wording exactly — only split, never rewrite or summarize.
- Return ONLY a JSON array of strings, no explanation.

Directions:
{json.dumps(texts)}"""

    payload = json.dumps({
        'model':      MODEL,
        'max_tokens': MAX_TOKENS,
        'messages':   [{'role': 'user', 'content': prompt}],
    }).encode()

    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=payload,
        headers={
            'Content-Type':      'application/json',
            'x-api-key':         api_key,
            'anthropic-version': '2023-06-01',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read())

    raw = body['content'][0]['text']
    match = re.search(r'\[[\s\S]*\]', raw)
    if not match:
        return None
    return json.loads(match.group(0))


# ── S3 helpers ─────────────────────────────────────────────

def s3_get(key):
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    return json.loads(obj['Body'].read())


def s3_put(key, data):
    s3.put_object(
        Bucket=BUCKET, Key=key,
        Body=json.dumps(data),
        ContentType='application/json',
        CacheControl='no-cache, no-store, must-revalidate',
    )


# ── Core logic ─────────────────────────────────────────────

def reparse_recipe(recipe, dry_run=False):
    """Split and re-duration steps for one recipe. Returns (changed, new_directions)."""
    old_steps = recipe.get('directions', [])
    if not old_steps:
        return False, old_steps

    texts = [s if isinstance(s, str) else s.get('text', '') for s in old_steps]
    texts = [t for t in texts if t.strip()]

    try:
        split = call_claude(texts)
    except Exception as e:
        print(f'    Claude error: {e}', file=sys.stderr)
        return False, old_steps

    if not split or not isinstance(split, list):
        return False, old_steps

    new_steps = [step_from_text(str(t)) for t in split if str(t).strip()]

    changed = len(new_steps) != len(old_steps) or any(
        n['text'] != (o if isinstance(o, str) else o.get('text', ''))
        for n, o in zip(new_steps, old_steps)
    )
    return changed, new_steps


def process_group(group_id, dry_run=False):
    key = f'groups/{group_id}/recipes.json'
    try:
        recipes = s3_get(key)
    except Exception as e:
        print(f'  Cannot read {key}: {e}', file=sys.stderr)
        return

    total     = len(recipes)
    changed_n = 0

    for i, recipe in enumerate(recipes):
        name = recipe.get('name', f'Recipe {i}')
        print(f'  [{i+1}/{total}] {name}')

        changed, new_dirs = reparse_recipe(recipe, dry_run)
        if changed:
            changed_n += 1
            old_count = len(recipe.get('directions', []))
            print(f'    {old_count} -> {len(new_dirs)} steps')
            if not dry_run:
                recipe['directions'] = new_dirs

        time.sleep(RATE_LIMIT_S)

    if not dry_run and changed_n:
        s3_put(key, recipes)
        print(f'  Saved {key} ({changed_n}/{total} recipes changed)')
    elif dry_run:
        print(f'  Dry run: {changed_n}/{total} recipes would change')
    else:
        print(f'  No changes ({total} recipes)')


def main():
    parser = argparse.ArgumentParser(description='Reparse recipe steps using Claude')
    parser.add_argument('--dry-run',  action='store_true', help='Print changes without writing to S3')
    parser.add_argument('--group-id', help='Process only this group ID')
    args = parser.parse_args()

    if args.group_id:
        group_ids = [args.group_id]
    else:
        try:
            user_data = s3_get(f'users/{OWNER_USER}/groups.json')
            group_ids = [g['groupId'] for g in user_data]
        except Exception as e:
            print(f'Cannot read user groups: {e}', file=sys.stderr)
            sys.exit(1)

    print(f'Processing {len(group_ids)} group(s){"  [DRY RUN]" if args.dry_run else ""}')
    for gid in group_ids:
        print(f'\nGroup {gid}')
        process_group(gid, dry_run=args.dry_run)

    print('\nDone.')


if __name__ == '__main__':
    main()
