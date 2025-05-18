#!/usr/bin/env bash
# setup-benchmarks.sh
# System-wide setup for Roo Benchmarks on Ubuntu 24 Server, configures .bashrc to fetch first_login.sh

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# Define roocodeuser's home directory
ROOCODEUSER_HOME=$(getent passwd "roocodeuser" | cut -d: -f6)
if [ -z "$ROOCODEUSER_HOME" ]; then
  echo "Error: Could not determine home directory for roocodeuser"
  exit 1
fi

# --- GUI and Browser Setup ---

echo "Installing XFCE desktop environment, XRDP, and curl..."
apt-get update
apt-get install -y xfce4 xfce4-goodies xrdp curl

echo "Enabling XRDP service..."
systemctl enable xrdp
systemctl start xrdp
if systemctl is-active --quiet xrdp; then
  echo "XRDP service is running"
else
  echo "Error: XRDP service failed to start"
  exit 1
fi

echo "Configuring XFCE session for roocodeuser"
echo xfce4-session > "$ROOCODEUSER_HOME/.xsession"
chown roocodeuser:roocodeuser "$ROOCODEUSER_HOME/.xsession"
chmod 644 "$ROOCODEUSER_HOME/.xsession"

echo "Installing Brave browser..."
curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/brave-browser-archive-keyring.gpg] https://brave-browser-apt-release.s3.brave.com/ stable main" | tee /etc/apt/sources.list.d/brave-browser-release.list
apt-get update
apt-get install -y brave-browser

# --- End GUI and Browser Setup ---

# Update the System
echo "Updating system packages..."
apt update && apt upgrade -y

# Install Dependencies (minimal, for system-wide tools and first_login.sh)
echo "Installing dependencies..."
apt install -y curl git build-essential libssl-dev zlib1g-dev xvfb gnupg2 apt-transport-https micro wget

# Configure .bashrc to fetch and run first_login.sh on first login
echo "Configuring .bashrc to fetch first_login.sh on first login..."
if ! grep -q 'first_login.sh' "$ROOCODEUSER_HOME/.bashrc"; then
  cat >> "$ROOCODEUSER_HOME/.bashrc" << 'EOF'
# Fetch and run first_login.sh on first login
if [ ! -f "$HOME/.first_login_done" ]; then
  echo "Downloading first login setup..."
  FIRST_LOGIN_URL="https://raw.githubusercontent.com/StevenTCramer/Roo-Code/refs/heads/Cramer/2025-05-13/windows-evals/evals/scripts/first_login.sh"
  curl -fsSL "$FIRST_LOGIN_URL" -o "$HOME/first_login.sh" > "$HOME/first_login_curl.log" 2>&1 || {
    echo "Error: Failed to download first_login.sh. See $HOME/first_login_curl.log"
    cat "$HOME/first_login_curl.log"
    exit 1
  }
  chmod 755 "$HOME/first_login.sh"
  echo "Running first login setup..."
  bash "$HOME/first_login.sh" || {
    echo "Error: First login setup failed. Check $HOME/first_login.log"
    exit 1
  }
  touch "$HOME/.first_login_done"
fi
EOF
fi
chown roocodeuser:roocodeuser "$ROOCODEUSER_HOME/.bashrc"

echo "System-wide setup complete. Log in as roocodeuser to trigger first_login.sh."