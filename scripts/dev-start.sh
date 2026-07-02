#!/usr/bin/env bash
# NovelVerse — start frontend + backend for local dev (optionally gpuServer)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.dev-pids"
LOG_DIR="$ROOT/.dev-logs"
WITH_GPU=false

for arg in "$@"; do
  case "$arg" in
    --with-gpu) WITH_GPU=true ;;
    -h|--help)
      echo "Usage: ./scripts/dev-start.sh [--with-gpu]"
      echo "  Starts backend (5000) + frontend (5173). GPU server (6001) is optional."
      exit 0
      ;;
  esac
done

mkdir -p "$PID_DIR" "$LOG_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' is required but not installed."
    exit 1
  fi
}

require_cmd node
require_cmd npm

if [[ ! -f "$ROOT/backend/.env" ]]; then
  echo "Error: backend/.env missing. Copy backend/.env.example and fill in values."
  exit 1
fi

if [[ ! -f "$ROOT/frontend/.env.local" ]]; then
  echo "Warning: frontend/.env.local missing — using defaults (localhost:5000)."
fi

start_service() {
  local name="$1"
  local dir="$2"
  local cmd="$3"
  local pid_file="$PID_DIR/$name.pid"
  local log_file="$LOG_DIR/$name.log"

  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "[$name] already running (pid $(cat "$pid_file"))"
    return
  fi

  echo "[$name] starting..."
  (cd "$dir" && eval "$cmd") >"$log_file" 2>&1 &
  echo $! >"$pid_file"
  echo "[$name] pid $(cat "$pid_file") — log: $log_file"
}

echo "=== NovelVerse Dev Startup ==="

if [[ ! -d "$ROOT/backend/node_modules" ]]; then
  echo "[backend] installing dependencies..."
  (cd "$ROOT/backend" && npm install)
fi

if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  echo "[frontend] installing dependencies..."
  (cd "$ROOT/frontend" && npm install)
fi

start_service "backend" "$ROOT/backend" "npm run dev"
start_service "frontend" "$ROOT/frontend" "npm run dev"

if $WITH_GPU; then
  if [[ ! -d "$ROOT/gpuServer/venv" ]]; then
    echo "[gpu] Warning: gpuServer/venv not found — skip or create venv first."
  else
    start_service "gpu" "$ROOT/gpuServer" "source venv/bin/activate && python server.py"
  fi
fi

echo ""
echo "Waiting for services..."
sleep 3

if bash "$ROOT/scripts/dev-healthcheck.sh"; then
  echo ""
  echo "=== Dev environment ready ==="
  echo "  Frontend:  http://localhost:5173"
  echo "  Backend:   http://localhost:5000"
  echo "  Health:    http://localhost:5000/health"
  echo ""
  echo "Stop with: ./scripts/dev-stop.sh"
  echo "Logs:      $LOG_DIR/"
else
  echo ""
  echo "Health check failed — services may still be starting."
  echo "Re-run: ./scripts/dev-healthcheck.sh"
  echo "Logs:   $LOG_DIR/"
  exit 1
fi