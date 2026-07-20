#!/usr/bin/env bash

set -euo pipefail

EXPECTED_REPO="/Users/bytedance/Claude/collab-editor/repo"
EXPECTED_BRANCH="demo/syncdraft-undo"
BASELINE_TAG="demo/syncdraft-undo-buggy-v1"
FRONTEND_PORT=3001
BACKEND_PORT=1234
FRONTEND_SESSION="syncdraft-demo-frontend"
BACKEND_SESSION="syncdraft-demo-backend"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel)"

if [[ "$REPO_ROOT" != "$EXPECTED_REPO" ]]; then
  echo "Refusing to reset unexpected repository: $REPO_ROOT" >&2
  exit 1
fi

CURRENT_BRANCH="$(git -C "$REPO_ROOT" branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
  echo "Refusing to reset branch '$CURRENT_BRANCH'; expected '$EXPECTED_BRANCH'." >&2
  exit 1
fi

BASELINE_COMMIT="$(git -C "$REPO_ROOT" rev-parse "$BASELINE_TAG^{commit}")"
CURRENT_COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"
ARCHIVE_STAMP="$(date +%Y%m%d-%H%M%S)"

if [[ "$CURRENT_COMMIT" != "$BASELINE_COMMIT" ]]; then
  ARCHIVE_TAG="demo-archive/syncdraft-undo-$ARCHIVE_STAMP"
  git -C "$REPO_ROOT" tag "$ARCHIVE_TAG" "$CURRENT_COMMIT"
  echo "Archived committed demo result as $ARCHIVE_TAG"
fi

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=all)" ]]; then
  git -C "$REPO_ROOT" stash push --include-untracked \
    --message "syncdraft-demo-before-reset-$ARCHIVE_STAMP"
  echo "Archived uncommitted demo result in git stash."
fi

listener_pids() {
  lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

listener_cwd() {
  lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'
}

stop_owned_listener() {
  local port="$1"
  local expected_cwd="$2"
  local pids
  pids="$(listener_pids "$port")"

  for pid in $pids; do
    local actual_cwd
    actual_cwd="$(listener_cwd "$pid")"
    if [[ "$actual_cwd" != "$expected_cwd" ]]; then
      echo "Port $port belongs to PID $pid in '$actual_cwd'; refusing to stop it." >&2
      exit 1
    fi
  done

  for pid in $pids; do
    kill "$pid"
  done

  for _ in {1..30}; do
    [[ -z "$(listener_pids "$port")" ]] && return 0
    sleep 0.2
  done

  echo "Listener on port $port did not stop cleanly." >&2
  exit 1
}

stop_owned_listener "$FRONTEND_PORT" "$REPO_ROOT/syncraft"
stop_owned_listener "$BACKEND_PORT" "$REPO_ROOT/server"

screen -S "$FRONTEND_SESSION" -X quit >/dev/null 2>&1 || true
screen -S "$BACKEND_SESSION" -X quit >/dev/null 2>&1 || true

git -C "$REPO_ROOT" reset --hard "$BASELINE_COMMIT"
git -C "$REPO_ROOT" clean -fd

screen -dmS "$BACKEND_SESSION" bash -lc \
  "cd '$REPO_ROOT/server' && exec node server.js > /tmp/syncdraft-demo-server.log 2>&1"

screen -dmS "$FRONTEND_SESSION" bash -lc \
  "cd '$REPO_ROOT/syncraft' && exec env PORT='$FRONTEND_PORT' BROWSER=none npm start > /tmp/syncdraft-demo-frontend.log 2>&1"

for _ in {1..120}; do
  if curl --fail --silent --output /dev/null \
       "http://localhost:$FRONTEND_PORT/demo" && \
     [[ -n "$(listener_pids "$BACKEND_PORT")" ]]; then
    echo "SyncDraft demo restored to $BASELINE_TAG"
    echo "Open http://localhost:$FRONTEND_PORT/demo"
    exit 0
  fi
  sleep 0.5
done

echo "Demo services did not become ready." >&2
echo "Frontend log: /tmp/syncdraft-demo-frontend.log" >&2
echo "Backend log: /tmp/syncdraft-demo-server.log" >&2
exit 1
