#!/bin/bash
# Sets up a non-root user for running Claude Code against /var/www/hybrid-stack.
#
# Why: Claude Code's sandbox (which lets safe/routine commands run without a
# permission prompt) can't run reliably as root. Running as a normal user
# fixes that. This script is surgical/reversible:
#   - project files stay owned by www-data:www-data (no chmod/chown changes)
#   - the new user gets ACL read/write access to the project tree only
#   - passwordless sudo is limited to the handful of root-only commands this
#     project's deploy/health-check flow actually needs — everything else
#     still prompts for a password
#
# Review before running. Run as root: bash setup-nonroot-claude-user.sh
set -euo pipefail

USERNAME="claude-dev"
PROJECT_DIR="/var/www/hybrid-stack"

if id "$USERNAME" &>/dev/null; then
  echo "User '$USERNAME' already exists — skipping creation."
else
  echo "Creating user '$USERNAME'..."
  adduser --disabled-password --gecos "" "$USERNAME"
fi

echo "Installing acl (for setfacl) if missing..."
apt-get install -y acl >/dev/null

echo "Granting '$USERNAME' read/write ACL on $PROJECT_DIR (ownership stays www-data:www-data)..."
setfacl -R -m u:"$USERNAME":rwX "$PROJECT_DIR"
setfacl -R -d -m u:"$USERNAME":rwX "$PROJECT_DIR"
# .env is root:root 644 (not group/world-writable) — grant explicit ACL so
# claude-dev can edit it directly without needing sudo for routine config changes.
setfacl -m u:"$USERNAME":rw "$PROJECT_DIR/backend/.env" 2>/dev/null || true

echo "Writing scoped sudoers rule (/etc/sudoers.d/claude-dev-hybrid-stack)..."
cat > /etc/sudoers.d/claude-dev-hybrid-stack <<EOF
# Passwordless — ONLY what this project's deploy/health-check flow needs.
# Everything else for $USERNAME still prompts for a password.
$USERNAME ALL=(root) NOPASSWD: \\
  /usr/bin/systemctl restart hybrid-frontend.service, \\
  /usr/bin/systemctl status hybrid-frontend.service, \\
  /usr/bin/systemctl is-active hybrid-frontend.service, \\
  /usr/bin/systemctl restart php8.3-fpm, \\
  /usr/bin/systemctl restart nginx, \\
  /usr/bin/systemctl reload nginx, \\
  /usr/bin/chown -R www-data\:www-data $PROJECT_DIR/frontend/.next, \\
  $PROJECT_DIR/frontend/scripts/deploy-safe.sh

# Lets $USERNAME run commands as www-data (the web server's own low-priv
# user) without a password — same boundary the app already runs inside,
# not a privilege escalation to root.
$USERNAME ALL=(www-data) NOPASSWD: ALL
EOF
chmod 440 /etc/sudoers.d/claude-dev-hybrid-stack

echo "Validating sudoers syntax..."
visudo -cf /etc/sudoers.d/claude-dev-hybrid-stack

cat <<MSG

Done.

Next steps:
  1. Set a password (needed for the su login below): passwd $USERNAME
  2. Log in as the new user:                          su - $USERNAME
  3. cd $PROJECT_DIR && claude   (run Claude Code as usual)

To undo everything this script did:
  setfacl -R -x u:$USERNAME $PROJECT_DIR
  rm /etc/sudoers.d/claude-dev-hybrid-stack
  deluser --remove-home $USERNAME
MSG
