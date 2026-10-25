#!/usr/bin/env bash
# Sets up Comoonly on a fresh Oracle Cloud "Always Free" Ubuntu server, in one go:
# Node.js 24, the app (copied from your Mac, or fetched from GitHub), a service that keeps it running (and restarts it after a reboot),
# and Tailscale Funnel for a free, permanent https address. Safe to run again to update the app.
#
# Usage, on the server:   bash oracle-setup.sh   (or add a GitHub address to fetch the code from there)
# Before running it, copy the app and your .env (private keys) to ~/comoonly on the server.
set -euo pipefail

REPO="${1:-}" # optional: leave out when the code was copied straight to ~/comoonly from your Mac
APP="$HOME/comoonly"

echo "== 1/5  Basic tools and Node.js 24"
sudo apt-get update -y
sudo apt-get install -y git curl ca-certificates
if ! node --version 2>/dev/null | grep -q '^v2[4-9]'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version

echo "== 2/5  A little swap space, so building the website doesn't run out of memory on the small free server"
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "== 3/5  Get (or update) the app and build it"
if [ -d "$APP/.git" ]; then git -C "$APP" pull --ff-only
elif [ ! -f "$APP/package.json" ]; then git clone "${REPO:?No code in ~/comoonly: copy it there or give a GitHub address}" "$APP"; fi
if [ -f "$HOME/.env" ] && [ ! -f "$APP/.env" ]; then mv "$HOME/.env" "$APP/.env"; fi
[ -f "$APP/.env" ] || { echo "No .env found. Copy yours to the server first (see the guide), then run this again."; exit 1; }
cd "$APP"
npm ci --include=dev
npm run build

echo "== 4/5  Keep it running: a system service that starts on boot and restarts if it crashes"
sudo tee /etc/systemd/system/comoonly.service >/dev/null <<EOF
[Unit]
Description=Comoonly
After=network-online.target

[Service]
User=$USER
WorkingDirectory=$APP
Environment=PORT=3001
ExecStart=$(command -v npm) start
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable comoonly
sudo systemctl restart comoonly
for _ in $(seq 1 20); do curl -fsS http://localhost:3001/api/health >/dev/null 2>&1 && break; sleep 1; done
if curl -fsS http://localhost:3001/api/health >/dev/null 2>&1; then
  echo "  The app is running."
else
  echo "  The app didn't start. Its last log lines (send these to Claude):"
  sudo journalctl -u comoonly -n 30 --no-pager
  exit 1
fi

echo "== 5/5  Free public https address with Tailscale Funnel"
command -v tailscale >/dev/null || curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up   # first time: open the link it prints and sign in with the same account as on your Mac
sudo tailscale funnel --bg 3001
echo
echo "Done. Your public address is the https://… line above. Admin: add /admin/ to it."
echo "Useful later:  sudo systemctl status comoonly   |   journalctl -u comoonly -f   (live logs)"
