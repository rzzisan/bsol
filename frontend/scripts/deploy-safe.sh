#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/hybrid-stack/frontend"
SUPERVISOR_PROGRAM="hybrid-stack-frontend"
LIVE_URL="https://bsol.zyrotechbd.com/dashboard"
API_HEALTH_URL="https://bsol.zyrotechbd.com/api/health"

if [[ ! -d "$APP_DIR" ]]; then
  echo "[ERROR] Frontend directory not found: $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

echo "[1/10] Cleaning previous .next build artifacts"
rm -rf .next
mkdir -p .next

if id -u www-data >/dev/null 2>&1; then
  echo "[2/10] Ensuring build output ownership is www-data"
  chown -R www-data:www-data .next

  echo "[3/10] Building frontend as www-data"
  sudo -u www-data npm run build
else
  echo "[2/10] www-data user not found; building with current user"
  npm run build
fi

  echo "[4/7] Stopping supervisor program: $SUPERVISOR_PROGRAM"
  supervisorctl stop "$SUPERVISOR_PROGRAM" || true

  echo "[5/8] Ensuring port 3001 is free (no stale next process)"
  stale_pids="$(ss -ltnp '( sport = :3001 )' 2>/dev/null | awk 'NR>1 {print $NF}' | sed -E 's/.*pid=([0-9]+).*/\1/' | sort -u | tr '\n' ' ')"
  if [[ -n "$stale_pids" ]]; then
    echo "[INFO] Terminating stale PIDs on :3001 => ${stale_pids}"
    kill -TERM ${stale_pids} || true

    stale_pids_after_term="$(ss -ltnp '( sport = :3001 )' 2>/dev/null | awk 'NR>1 {print $NF}' | sed -E 's/.*pid=([0-9]+).*/\1/' | sort -u | tr '\n' ' ')"
    if [[ -n "$stale_pids_after_term" ]]; then
      echo "[WARN] Force killing stubborn PIDs on :3001 => ${stale_pids_after_term}"
      kill -KILL ${stale_pids_after_term} || true
    fi
  fi

  echo "[6/8] Starting supervisor program: $SUPERVISOR_PROGRAM"
  supervisorctl start "$SUPERVISOR_PROGRAM"

  echo "[7/8] Verifying supervisor runtime status"
supervisorctl status "$SUPERVISOR_PROGRAM"

  echo "[8/10] Live smoke checks"
curl -fsS "$LIVE_URL" >/dev/null
curl -fsS "$API_HEALTH_URL" >/dev/null

  echo "[9/10] Verifying active CSS chunk responds 200"
css_path="$(curl -fsS "$LIVE_URL" | tr '"' '\n' | grep -E '^/_next/static/chunks/.*\.css$' | head -n 1)"
if [[ -z "$css_path" ]]; then
  echo "[ERROR] Could not detect CSS chunk path from live HTML"
  exit 1
fi

status_code="$(curl -s -o /dev/null -w '%{http_code}' "https://bsol.zyrotechbd.com${css_path}")"
if [[ "$status_code" != "200" ]]; then
  echo "[ERROR] CSS chunk health check failed: ${css_path} returned ${status_code}"
  exit 1
fi

echo "[10/10] Deploy integrity checks passed"
echo "[OK] Safe deploy completed. Active CSS chunk: ${css_path}"
