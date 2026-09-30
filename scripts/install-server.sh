#!/usr/bin/env bash
# Installs a Robis server on a fresh Ubuntu/Debian VPS with one command:
#
#   curl -fsSL https://raw.githubusercontent.com/tatogart/RoBi19/main/scripts/install-server.sh | sudo bash
#
# It installs Node.js and Caddy (automatic HTTPS), runs Robis as a service
# that restarts itself, and checks GitHub every 10 minutes for updates.
# Run it again at any time to repair or reconfigure the server.
#
# Optional settings (otherwise it asks):
#   ROBIS_DOMAIN=robis.example.com   your domain (default: <ip>.sslip.io, works without buying one)
#   ROBIS_ADMIN_CODE=ABCD-1234-WXYZ  secret code that makes an account admin (⚙ → Enter Admin Code)
set -euo pipefail

REPO="${ROBIS_REPO:-https://github.com/tatogart/RoBi19.git}"
BRANCH="${ROBIS_BRANCH:-main}"
DIR=/opt/robis
DATA=/var/lib/robis
ENV_FILE=/etc/robis.env

[ "$(id -u)" = 0 ] || { echo "Please run as root: sudo bash install-server.sh"; exit 1; }
command -v apt-get >/dev/null || { echo "This script supports Ubuntu and Debian."; exit 1; }

# Run a command as the robis user (with its own home, for git and npm).
as_robis() { runuser -u robis -- env HOME="$DATA" "$@"; }
say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ask() { # ask VAR "question" default
  local var=$1 question=$2 def=$3 val=''
  if [ -z "${!var:-}" ]; then
    if [ -r /dev/tty ]; then read -rp "$question" val </dev/tty || true; fi
    printf -v "$var" '%s' "${val:-$def}"
  fi
}

say "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

IP="$(curl -fsS4 --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"
OLD_CODE="$( [ -f "$ENV_FILE" ] && sed -n 's/^ROBIS_ADMIN_CODE=//p' "$ENV_FILE" || true)"
OLD_DOMAIN="$( [ -f "$ENV_FILE" ] && sed -n 's/^ROBIS_DOMAIN=//p' "$ENV_FILE" || true)"
# (head closing the pipe early would stop the script under pipefail, hence || true)
RANDOM_RAW="$( (tr -dc 'A-HJ-NP-Z2-9' </dev/urandom | head -c 12) || true)"
RANDOM_CODE="${RANDOM_RAW:0:4}-${RANDOM_RAW:4:4}-${RANDOM_RAW:8:4}"
DEFAULT_DOMAIN="${OLD_DOMAIN:-${IP//./-}.sslip.io}"
ask ROBIS_DOMAIN "Domain for Robis [${DEFAULT_DOMAIN}]: " "$DEFAULT_DOMAIN"
ask ROBIS_ADMIN_CODE "Secret admin code [${OLD_CODE:-random}]: " "${OLD_CODE:-$RANDOM_CODE}"

if ! node -v 2>/dev/null | grep -Eq '^v(2[2-9]|[3-9][0-9])'; then
  say "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

if ! command -v caddy >/dev/null; then
  say "Installing Caddy (HTTPS)"
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

say "Downloading Robis"
id robis >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --create-home --shell /usr/sbin/nologin robis
mkdir -p "$DATA"
chown robis:robis "$DATA"
if [ -d "$DIR/.git" ]; then
  chown -R robis:robis "$DIR"
  as_robis git -C "$DIR" fetch -q origin "$BRANCH"
  as_robis git -C "$DIR" reset -q --hard "origin/$BRANCH"
else
  mkdir -p "$DIR"
  chown robis:robis "$DIR"
  as_robis git clone -q --branch "$BRANCH" "$REPO" "$DIR"
fi
(cd "$DIR" && as_robis npm ci --omit=dev --no-audit --no-fund)

say "Configuring the service"
cat >"$ENV_FILE" <<EOF
PORT=3000
ROBIS_DATA=$DATA
ROBIS_DOMAIN=$ROBIS_DOMAIN
ROBIS_ADMIN_CODE=$ROBIS_ADMIN_CODE
EOF
chmod 600 "$ENV_FILE"

cat >/etc/systemd/system/robis.service <<EOF
[Unit]
Description=Robis game server
After=network-online.target
Wants=network-online.target

[Service]
User=robis
WorkingDirectory=$DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/env node server/index.js
Restart=always
RestartSec=3
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/robis-update.service <<EOF
[Unit]
Description=Update Robis from GitHub

[Service]
Type=oneshot
Environment=ROBIS_BRANCH=$BRANCH
ExecStart=/bin/bash $DIR/scripts/update-server.sh
EOF

cat >/etc/systemd/system/robis-update.timer <<EOF
[Unit]
Description=Check GitHub for Robis updates every 10 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=10min

[Install]
WantedBy=timers.target
EOF

cat >/etc/caddy/Caddyfile <<EOF
$ROBIS_DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}
EOF

if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

systemctl daemon-reload
systemctl enable --now robis.service robis-update.timer >/dev/null
systemctl restart robis.service
systemctl reload caddy 2>/dev/null || systemctl restart caddy

say "Waiting for Robis to start"
for _ in $(seq 1 30); do
  curl -fs http://127.0.0.1:3000/api/stats >/dev/null && break
  sleep 1
done
curl -fs http://127.0.0.1:3000/api/stats >/dev/null || { echo "Robis did not start. See: journalctl -u robis -n 50"; exit 1; }

cat <<EOF

  ✅ Robis is running!

  Website:     https://$ROBIS_DOMAIN
  Admin code:  $ROBIS_ADMIN_CODE   (sign up, then ⚙ → Enter Admin Code)

  • Updates install themselves (checked every 10 minutes).
  • HTTPS can take a minute on the first visit while the certificate is issued.
  • Data lives in $DATA. Logs: journalctl -u robis -f
  • Settings: $ENV_FILE, then: systemctl restart robis

EOF
