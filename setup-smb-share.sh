#!/bin/bash
# Sets up an SMB (Samba) share of /var/www/hybrid-stack so it can be mapped
# as a network drive from Windows 11.
#
# Review before running. Run as root: bash setup-smb-share.sh
#
# Design decisions (see subscription_billing_context.md / chat for context):
#   - Shares ONLY /var/www/hybrid-stack — NOT the whole /var/www (which also
#     holds captive-portal-secrets, a 700-permission secrets directory for a
#     different project; sharing it was explicitly declined).
#   - Read-write, for dev convenience (editing code from Windows).
#   - Access is restricted to specific IPs/prefixes via Samba's own
#     `hosts allow`/`hosts deny` (enforced by smbd itself at the protocol
#     level, independent of any OS firewall).
#   - Deliberately does NOT touch ufw/iptables. This server currently has NO
#     firewall active at all (ufw inactive, iptables INPUT policy ACCEPT) and
#     several other services are already listening on 0.0.0.0 (AdGuardHome
#     on 53/3000, an extra nginx vhost on 8080/8081, Next.js directly on
#     3001) that were never audited for this task. Flipping ufw on now,
#     without first working out allow-rules for every one of those, risks
#     locking out SSH or breaking the live site. That's a separate, bigger
#     decision — this script only adds the new SMB ports (139/445, via
#     Samba's own access control) without touching anything else.
#   - Files are written back as www-data:www-data (Samba's "force user/group"
#     — matches the project's existing ownership, no chmod/ACL changes to
#     the project tree needed).
#   - ⚠️ backend/.env (DB password, mail credentials, etc.) lives inside this
#     folder and will be readable/writable by anyone who authenticates to
#     the share — that's why access is IP-allowlisted below.
set -euo pipefail

PROJECT_DIR="/var/www/hybrid-stack"
SMB_USER="smbuser"
SHARE_NAME="hybrid-stack"
ALLOWLIST_FILE="/etc/samba/allowed_hosts.conf"
SMB_CONF="/etc/samba/smb.conf"

echo "Installing samba..."
apt-get install -y samba >/dev/null

echo "Creating dedicated SMB-only user '$SMB_USER' (no shell login)..."
if id "$SMB_USER" &>/dev/null; then
  echo "  already exists — skipping."
else
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SMB_USER"
fi

echo "Writing IP/prefix allowlist to $ALLOWLIST_FILE ..."
cat > "$ALLOWLIST_FILE" <<'EOF'
# One IP or CIDR prefix per line. Lines starting with # are ignored.
# After editing this file, re-run: bash /var/www/hybrid-stack/update-smb-allowlist.sh
103.157.0.0/16
10.55.55.42
172.99.99.2
EOF

echo "Backing up existing smb.conf (if any) to ${SMB_CONF}.bak ..."
[ -f "$SMB_CONF" ] && cp "$SMB_CONF" "${SMB_CONF}.bak"

# hosts_line is regenerated from $ALLOWLIST_FILE by update-smb-allowlist.sh
# below — this initial write just seeds it the first time.
HOSTS_LINE=$(grep -vE '^\s*#|^\s*$' "$ALLOWLIST_FILE" | tr '\n' ' ')

cat > "$SMB_CONF" <<EOF
[global]
   workgroup = WORKGROUP
   server string = Hybrid Stack Dev Share
   security = user
   map to guest = never
   server min protocol = SMB3
   smb encrypt = required
   log file = /var/log/samba/log.%m
   max log size = 1000

[$SHARE_NAME]
   path = $PROJECT_DIR
   browseable = yes
   read only = no
   guest ok = no
   valid users = $SMB_USER
   force user = www-data
   force group = www-data
   create mask = 0664
   directory mask = 0775
   hosts allow = $HOSTS_LINE
   hosts deny = 0.0.0.0/0
EOF

echo "Validating smb.conf syntax..."
testparm -s "$SMB_CONF" >/dev/null

echo ""
echo "Set the SMB login password for '$SMB_USER' now (used from Windows, separate from any Unix password):"
smbpasswd -a "$SMB_USER"

echo "Enabling + restarting smbd/nmbd..."
systemctl enable --now smbd nmbd >/dev/null
systemctl restart smbd nmbd

cat <<MSG

Done. From Windows 11, map the network drive:
  \\\\103.157.253.197\\$SHARE_NAME
  Username: $SMB_USER
  Password: (what you just set)

Only these IPs/prefixes can connect (edit $ALLOWLIST_FILE then re-run
update-smb-allowlist.sh to change this list yourself, anytime):
$(cat "$ALLOWLIST_FILE" | grep -vE '^\s*#|^\s*$')

To remove everything this script did:
  systemctl disable --now smbd nmbd
  userdel $SMB_USER
  rm $SMB_CONF $ALLOWLIST_FILE
  mv ${SMB_CONF}.bak $SMB_CONF   # if you want the pre-existing config back
MSG
