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
#
# Requires OPENROUTER_API_KEY in ~/.hermes/.env (present on the Mac mini;
# NOT set on the MacBook as of 2026-08-08). Never pass keys on the command
# line and never commit this file with a key in it.
set -euo pipefail

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

PROMPT_FILE="${1:?usage: hermes-dispatch.sh <prompt-file.md> [model ...]}"
shift

# Preference order from docs/reviews/prompts/README.md; override by listing
# model ids as extra arguments. Verify ids against --list-free first.
MODELS=("$@")
if [[ ${#MODELS[@]} -eq 0 ]]; then
  MODELS=(
    "nvidia/llama-3.3-nemotron-super-49b-v1:free"
    "nvidia/llama-3.1-nemotron-ultra-253b-v1:free"
  )
fi

PROMPT="$(cat "$PROMPT_FILE")"
RESUME_PROMPT="A previous session ran out mid-task. Resume the same work: read docs/reviews/PROGRESS.md on the current branch and continue from the first item that is not green. The original task prompt follows.

$PROMPT"

LOG_DIR="${HERMES_DISPATCH_LOGS:-$HOME/.hermes/logs/dispatch}"
mkdir -p "$LOG_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
SESSION_ID=""

for MODEL in "${MODELS[@]}"; do
  LOG="$LOG_DIR/$STAMP-$(basename "$PROMPT_FILE" .md)-${MODEL//[^a-zA-Z0-9._-]/_}.log"
  echo "==> dispatching $(basename "$PROMPT_FILE") to $MODEL (log: $LOG)"

  if [[ -n "$SESSION_ID" ]]; then
    ARGS=(--resume "$SESSION_ID" -z "$RESUME_PROMPT")
  else
    ARGS=(-z "$PROMPT")
  fi

  if hermes "${ARGS[@]}" -m "$MODEL" --provider openrouter \
      --pass-session-id --yolo 2>&1 | tee "$LOG"; then
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
