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

# The live build stays in .next until a new build has finished in
# BUILD_DIR (next.config.ts reads NEXT_BUILD_DIR). A failed build leaves the
# site untouched; failed checks after the swap restore the previous build.
BUILD_DIR=".next-build"
PREV_DIR=".next-prev"

rollback() {
  echo "[ROLLBACK] Restoring the previous build"
  if [[ -d "$PREV_DIR" ]]; then
    rm -rf .next
    mv "$PREV_DIR" .next
    systemctl restart "$SYSTEMD_SERVICE" || true
    echo "[ROLLBACK] Previous build restored and $SYSTEMD_SERVICE restarted"
  else
    echo "[ROLLBACK] No previous build to restore"
  fi
}

echo "[1/8] Preparing a fresh build folder ($BUILD_DIR)"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

build_ok=1
if id -u www-data >/dev/null 2>&1; then
  echo "[2/8] Ensuring build output ownership is www-data"
  chown -R www-data:www-data "$BUILD_DIR"

  echo "[3/8] Building frontend as www-data (live site keeps running)"
  sudo -u www-data env NEXT_BUILD_DIR="$BUILD_DIR" npm run build || build_ok=0
else
  echo "[2/8] www-data user not found; building with current user"
  NEXT_BUILD_DIR="$BUILD_DIR" npm run build || build_ok=0
fi

if [[ "$build_ok" -ne 1 ]]; then
  rm -rf "$BUILD_DIR"
  echo "[ERROR] Build failed. The live site was not touched."
  exit 1
fi

echo "[4/8] Swapping in the new build and restarting $SYSTEMD_SERVICE"
rm -rf "$PREV_DIR"
if [[ -d .next ]]; then
  mv .next "$PREV_DIR"
fi
mv "$BUILD_DIR" .next
systemctl restart "$SYSTEMD_SERVICE"

# From here on, any failed check puts the previous build back.
trap 'rollback' ERR

echo "[5/8] Verifying systemd runtime status"
if ! systemctl is-active --quiet "$SYSTEMD_SERVICE"; then
  echo "[ERROR] $SYSTEMD_SERVICE failed to become active after restart"
  systemctl status "$SYSTEMD_SERVICE" --no-pager -l || true
  rollback
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
  rollback
  exit 1
fi
curl -fsS "$API_HEALTH_URL" >/dev/null

echo "[7/8] Verifying active CSS chunk responds 200"
css_path="$(curl -fsS "$LIVE_URL" | tr '"' '\n' | grep -E '^/_next/static/chunks/.*\.css$' | head -n 1)"
if [[ -z "$css_path" ]]; then
  echo "[ERROR] Could not detect CSS chunk path from live HTML"
  rollback
  exit 1
fi

status_code="$(curl -s -o /dev/null -w '%{http_code}' "https://bsol.zyrotechbd.com${css_path}")"
if [[ "$status_code" != "200" ]]; then
  echo "[ERROR] CSS chunk health check failed: ${css_path} returned ${status_code}"
  rollback
  exit 1
fi

trap - ERR
echo "[8/8] Deploy integrity checks passed (previous build kept in $PREV_DIR for manual rollback)"
echo "[OK] Safe deploy completed. Active CSS chunk: ${css_path}"
