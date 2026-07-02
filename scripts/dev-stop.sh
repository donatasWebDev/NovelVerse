#!/usr/bin/env bash
# NovelVerse — stop local dev services started by dev-start.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.dev-pids"

stop_one() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"

  if [[ ! -f "$pid_file" ]]; then
    echo "[$name] not running (no pid file)"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" 2>/dev/null; then
    echo "[$name] stopping pid $pid"
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
  else
    echo "[$name] pid $pid not active"
  fi

  rm -f "$pid_file"
}

echo "=== Stopping NovelVerse dev services ==="
stop_one "frontend"
stop_one "backend"
stop_one "gpu"
echo "Done."