#!/bin/bash
# Re-applies /etc/samba/allowed_hosts.conf to smb.conf and reloads smbd.
# Run this any time after editing the allowlist file yourself:
#   1. nano /etc/samba/allowed_hosts.conf   (one IP or CIDR per line)
#   2. bash /var/www/hybrid-stack/update-smb-allowlist.sh
#
# Run as root.
set -euo pipefail

ALLOWLIST_FILE="/etc/samba/allowed_hosts.conf"
SMB_CONF="/etc/samba/smb.conf"

if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "Missing $ALLOWLIST_FILE — run setup-smb-share.sh first." >&2
  exit 1
fi

HOSTS_LINE=$(grep -vE '^\s*#|^\s*$' "$ALLOWLIST_FILE" | tr '\n' ' ')
if [ -z "$HOSTS_LINE" ]; then
  echo "Allowlist is empty — refusing to apply (that would lock everyone out)." >&2
  exit 1
fi

sed -i "s|^\(\s*hosts allow\s*=\s*\).*|\1$HOSTS_LINE|" "$SMB_CONF"

echo "Validating smb.conf syntax..."
testparm -s "$SMB_CONF" >/dev/null

echo "Reloading smbd..."
systemctl reload smbd

echo "Applied. Currently allowed:"
echo "$HOSTS_LINE" | tr ' ' '\n'
