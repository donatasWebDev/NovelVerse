#!/usr/bin/env bash
# NovelVerse Phase 1 smoke test — run after dev-start.sh
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:5000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
PASS=0
FAIL=0

step() {
  local name="$1"
  shift
  printf "  %-28s " "$name"
  if "$@"; then
    echo "OK"
    PASS=$((PASS + 1))
  else
    echo "FAIL"
    FAIL=$((FAIL + 1))
  fi
}

check_health() {
  curl -sf "$BACKEND_URL/health" | grep -q '"status"'
}

check_books() {
  curl -sf "$BACKEND_URL/api/lib/get/books?page=1" | grep -q '"books"'
}

check_bad_login() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_URL/api/user/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"smoke-test@invalid.local","password":"wrong"}')
  [[ "$code" == "400" || "$code" == "404" ]]
}

check_frontend() {
  curl -sf -o /dev/null "$FRONTEND_URL"
}

check_auth_required() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/user/")
  [[ "$code" == "401" ]]
}

echo "=== NovelVerse Phase 1 Smoke Test ==="
echo ""

step "Health endpoint" check_health
step "Browse books (public API)" check_books
step "Login rejects bad creds" check_bad_login
step "Frontend serves app" check_frontend
step "Auth route requires token" check_auth_required

echo ""
echo "Result: $PASS passed, $FAIL failed"
echo ""
echo "Manual: login in browser, browse library, test /play (needs GPU+S3)"

[[ "$FAIL" -eq 0 ]]