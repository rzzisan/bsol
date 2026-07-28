#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/hybrid-stack/frontend"
SYSTEMD_SERVICE="hybrid-frontend.service"
LIVE_URL="https://bsol.zyrotechbd.com/dashboard"
API_HEALTH_URL="https://bsol.zyrotechbd.com/api/health"

if [[ ! -d "$APP_DIR" ]]; then
  echo "[ERROR] Frontend directory not found: $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

echo "[1/8] Cleaning previous .next build artifacts"
rm -rf .next
mkdir -p .next

if id -u www-data >/dev/null 2>&1; then
  echo "[2/8] Ensuring build output ownership is www-data"
  chown -R www-data:www-data .next

  echo "[3/8] Building frontend as www-data"
  sudo -u www-data npm run build
else
  echo "[2/8] www-data user not found; building with current user"
  npm run build
fi

echo "[4/8] Restarting systemd service: $SYSTEMD_SERVICE"
systemctl restart "$SYSTEMD_SERVICE"

echo "[5/8] Verifying systemd runtime status"
if ! systemctl is-active --quiet "$SYSTEMD_SERVICE"; then
  echo "[ERROR] $SYSTEMD_SERVICE failed to become active after restart"
  systemctl status "$SYSTEMD_SERVICE" --no-pager -l || true
  exit 1
fi
systemctl status "$SYSTEMD_SERVICE" --no-pager -l

echo "[6/8] Live smoke checks (waiting for Next.js to finish booting)"
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "$LIVE_URL" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo "[ERROR] $LIVE_URL did not become ready in time"
  systemctl status "$SYSTEMD_SERVICE" --no-pager -l || true
  exit 1
fi
curl -fsS "$API_HEALTH_URL" >/dev/null

echo "[7/8] Verifying active CSS chunk responds 200"
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

echo "[8/8] Deploy integrity checks passed"
echo "[OK] Safe deploy completed. Active CSS chunk: ${css_path}"
