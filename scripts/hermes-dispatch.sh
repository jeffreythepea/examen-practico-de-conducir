#!/usr/bin/env bash
# Dispatch a bounded review prompt to a free OpenRouter model via the Hermes
# CLI, rotating to the next model in the list when the current one rate-limits
# or errors out. Recreates the supervisor->Hermes handoff method: one-shot
# `hermes -z` runs, checkpoint commits per the policy in
# docs/reviews/prompts/README.md, resume-on-fallback via the Hermes session id.
#
# Usage:
#   scripts/hermes-dispatch.sh docs/reviews/prompts/A-trivial-batch.md [model ...]
#   scripts/hermes-dispatch.sh --list-free        # show current :free models
#   scripts/hermes-dispatch.sh --usage-today      # requests-per-model today vs. the
#                                                  # OpenRouter free-tier daily cap
#
# Requires OPENROUTER_API_KEY in ~/.hermes/.env (present on the Mac mini;
# NOT set on the MacBook as of 2026-08-08). Never pass keys on the command
# line and never commit this file with a key in it.
#
# OpenRouter throttles :free models by REQUEST COUNT, not tokens: 20 req/min, and
# either 50 or 1000 req/day per model depending on whether the account has ever
# bought >=$10 in credits (check with `curl -s https://openrouter.ai/api/v1/auth/key
# -H "Authorization: Bearer $OPENROUTER_API_KEY"` -> is_free_tier). Every dispatch
# attempt below writes a --usage-file report and appends it to USAGE_LOG so
# --usage-today can sum today's request count per model against that cap.
set -euo pipefail

LOG_DIR="${HERMES_DISPATCH_LOGS:-$HOME/.hermes/logs/dispatch}"
USAGE_LOG="$LOG_DIR/usage.jsonl"
mkdir -p "$LOG_DIR"

if [[ "${1:-}" == "--list-free" ]]; then
  # Public catalog endpoint; no API key required.
  curl -s https://openrouter.ai/api/v1/models |
    python3 -c '
import json, sys
for m in json.load(sys.stdin)["data"]:
    p = m.get("pricing", {})
    if float(p.get("prompt", 1)) == 0 and float(p.get("completion", 1)) == 0:
        print(m["id"])
'
  exit 0
fi

if [[ "${1:-}" == "--usage-today" ]]; then
  DAILY_CAP="${2:-1000}"
  python3 -c '
import json, sys
from datetime import datetime, timezone

usage_log, cap = sys.argv[1], int(sys.argv[2])
today = datetime.now(timezone.utc).date()
totals = {}
try:
    with open(usage_log) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            ts = rec.get("dispatched_at", "")
            if not ts.startswith(str(today)):
                continue
            model = rec.get("model", "unknown")
            totals[model] = totals.get(model, 0) + int(rec.get("api_calls", 0))
except FileNotFoundError:
    pass

if not totals:
    print(f"No dispatch usage recorded today ({today}).")
    sys.exit(0)

print(f"Requests today ({today}) vs. daily cap {cap}/model:")
for model, calls in sorted(totals.items(), key=lambda kv: -kv[1]):
    flag = "  <-- near cap" if calls >= cap * 0.9 else ""
    print(f"  {calls:>5} / {cap}  {model}{flag}")
' "$USAGE_LOG" "$DAILY_CAP"
  exit 0
fi

PROMPT_FILE="${1:?usage: hermes-dispatch.sh <prompt-file.md> [model ...]}"
shift

# Preference order from docs/reviews/prompts/README.md; override by listing
# model ids as extra arguments. Verify ids against --list-free first.
MODELS=("$@")
if [[ ${#MODELS[@]} -eq 0 ]]; then
  MODELS=(
    "nvidia/nemotron-3-super-120b-a12b:free"
    "nvidia/nemotron-3-ultra-550b-a55b:free"
    "openai/gpt-oss-20b:free"
    "google/gemma-4-31b-it:free"
    "cohere/north-mini-code:free"
  )
fi

# Hermes runs with cwd already inside a real clone of the target repo (this
# worktree), fully set up (npm install already done). Prompt files' "Setup"
# section is written for a session starting from nothing and says to `git
# clone` + `cd` into the repo — models have literally followed that inside an
# already-cloned worktree, creating a nested duplicate clone and working
# there instead of here (observed with two different models on 2026-08-08).
# This preamble overrides that.
LOCATION_PREAMBLE="You are already inside a git clone of this repository at $(pwd), already on branch $(git branch --show-current), with npm install already done and the suite green. Do NOT run 'git clone' or 'cd' into a subdirectory of the same name — ignore any clone/cd instructions in the Setup section below; you are already in the correct location. If the target branch mentioned below doesn't match your current branch, check it out (git checkout -b <name> if it doesn't exist) instead of cloning. Then proceed directly into the numbered items."

PROMPT="$(cat "$PROMPT_FILE")"
PROMPT="$LOCATION_PREAMBLE

$PROMPT"
RESUME_PROMPT="A previous session ran out mid-task. Resume the same work: read docs/reviews/PROGRESS.md on the current branch and continue from the first item that is not green. The original task prompt follows.

$PROMPT"

STAMP="$(date +%Y%m%d-%H%M%S)"
SESSION_ID=""

for MODEL in "${MODELS[@]}"; do
  BASENAME="$STAMP-$(basename "$PROMPT_FILE" .md)-${MODEL//[^a-zA-Z0-9._-]/_}"
  LOG="$LOG_DIR/$BASENAME.log"
  USAGE_FILE="$LOG_DIR/$BASENAME.usage.json"
  echo "==> dispatching $(basename "$PROMPT_FILE") to $MODEL (log: $LOG)"

  if [[ -n "$SESSION_ID" ]]; then
    ARGS=(--resume "$SESSION_ID" -z "$RESUME_PROMPT")
  else
    ARGS=(-z "$PROMPT")
  fi

  hermes "${ARGS[@]}" -m "$MODEL" --provider openrouter \
      --usage-file "$USAGE_FILE" --pass-session-id --yolo 2>&1 | tee "$LOG" || true

  # Hermes can exit 0 even when the underlying model call failed (the one-shot
  # session "completes" with an error result) — trust the usage file's `failed`
  # field, not the shell exit code, to decide whether to fall back.
  RUN_OK=1
  if [[ -f "$USAGE_FILE" ]]; then
    FAILED="$(python3 -c '
import json, sys
with open(sys.argv[1]) as f:
    rec = json.load(f)
print("1" if rec.get("failed") else "0")
' "$USAGE_FILE")"
    [[ "$FAILED" == "1" ]] && RUN_OK=0

    # Record this attempt's request count regardless of outcome, so --usage-today
    # stays accurate even after a rate-limit failure (model can be null on failure).
    python3 -c '
import json, sys
from datetime import datetime, timezone

usage_file, usage_log, fallback_model = sys.argv[1], sys.argv[2], sys.argv[3]
with open(usage_file) as f:
    rec = json.load(f)
rec["dispatched_at"] = datetime.now(timezone.utc).isoformat()
rec["model"] = rec.get("model") or fallback_model
with open(usage_log, "a") as f:
    f.write(json.dumps(rec) + "\n")
' "$USAGE_FILE" "$USAGE_LOG" "$MODEL"
  else
    RUN_OK=0
  fi

  if [[ "$RUN_OK" == "1" ]]; then
    echo "==> $MODEL finished. Review the work branch before merging."
    exit 0
  fi

  # Carry the session forward so the next model resumes instead of restarting.
  FOUND="$(grep -oE 'session[_ -]?id[:= ]+[A-Za-z0-9._-]+' "$LOG" | tail -1 | grep -oE '[A-Za-z0-9._-]+$' || true)"
  [[ -n "$FOUND" ]] && SESSION_ID="$FOUND"
  echo "==> $MODEL failed or rate-limited; falling back." >&2
done

echo "==> all models exhausted for $(basename "$PROMPT_FILE"); rerun later or add models." >&2
exit 1
