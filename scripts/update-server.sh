#!/usr/bin/env bash
# Updates a Robis server installed by install-server.sh: pulls the latest
# code from GitHub and restarts only when something changed. Runs every 10
# minutes from robis-update.timer; open pages reload themselves afterwards.
set -euo pipefail
DIR=/opt/robis
DATA=/var/lib/robis
BRANCH="${ROBIS_BRANCH:-main}"
as_robis() { runuser -u robis -- env HOME="$DATA" "$@"; }

cd "$DIR"
as_robis git fetch -q origin "$BRANCH"
[ "$(as_robis git rev-parse HEAD)" = "$(as_robis git rev-parse "origin/$BRANCH")" ] && exit 0
old_lock="$(as_robis git rev-parse HEAD:package-lock.json)"
as_robis git reset -q --hard "origin/$BRANCH"
if [ "$old_lock" != "$(as_robis git rev-parse HEAD:package-lock.json)" ]; then
  as_robis npm ci --omit=dev --no-audit --no-fund
fi
systemctl restart robis
echo "Robis updated to $(as_robis git rev-parse --short HEAD)"
