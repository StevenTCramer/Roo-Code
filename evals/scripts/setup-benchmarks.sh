#!/usr/bin/env bash
# setup-benchmarks.sh
# Automated setup for Roo Benchmarks on Ubuntu 24 Server for roocodeuser

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
sudo apt-get update
sudo apt-get install -y xfce4 xfce4-goodies xrdp curl

echo "Enabling XRDP service..."
sudo systemctl enable xrdp
sudo systemctl start xrdp
if systemctl is-active --quiet xrdp; then
  echo "XRDP service is running"
else
  echo "Error: XRDP service failed to start"
  exit 1
fi

echo "Configuring XFCE session for roocodeuser"
echo xfce4-session > "$ROOCODEUSER_HOME/.xsession"
sudo chown roocodeuser:roocodeuser "$ROOCODEUSER_HOME/.xsession"
sudo chmod 644 "$ROOCODEUSER_HOME/.xsession"

echo "Installing Brave browser..."
sudo curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/brave-browser-archive-keyring.gpg] https://brave-browser-apt-release.s3.brave.com/ stable main" | sudo tee /etc/apt/sources.list.d/brave-browser-release.list
sudo apt-get update
sudo apt-get install -y brave-browser

# --- End GUI and Browser Setup ---

# Update the System
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Dependencies
echo "Installing dependencies..."
sudo apt install -y curl git build-essential libssl-dev zlib1g-dev xvfb gnupg2 apt-transport-https micro wget

# Install asdf v0.16.7 for roocodeuser
echo "Setting up asdf v0.16.7 for roocodeuser..."
mkdir -p "$ROOCODEUSER_HOME/bin"
ASDF_TAR="$ROOCODEUSER_HOME/bin/asdf.tar.gz"
ARCH="$(uname -m)"
if [ "$ARCH" = "x86_64" ]; then
  curl -L https://github.com/asdf-vm/asdf/releases/download/v0.16.7/asdf-v0.16.7-linux-amd64.tar.gz -o "$ASDF_TAR"
else
  curl -L https://github.com/asdf-vm/asdf/releases/download/v0.16.7/asdf-v0.16.7-linux-arm64.tar.gz -o "$ASDF_TAR"
fi
tar -xzf "$ASDF_TAR" -C "$ROOCODEUSER_HOME/bin"
rm "$ASDF_TAR"
sudo chown -R roocodeuser:roocodeuser "$ROOCODEUSER_HOME/bin"

# Set up environment variables for asdf in roocodeuser's .bashrc
echo "Configuring asdf environment for roocodeuser..."
if ! grep -q 'ASDF_DATA_DIR' "$ROOCODEUSER_HOME/.bashrc"; then
  echo "export ASDF_DATA_DIR=\"$ROOCODEUSER_HOME/.asdf\"" >> "$ROOCODEUSER_HOME/.bashrc"
  echo "export PATH=\"$ROOCODEUSER_HOME/.asdf/shims:$ROOCODEUSER_HOME/bin:\$PATH\"" >> "$ROOCODEUSER_HOME/.bashrc"
fi
sudo chown roocodeuser:roocodeuser "$ROOCODEUSER_HOME/.bashrc"

# Run asdf commands as roocodeuser
echo "Verifying asdf installation for roocodeuser..."
sudo -u roocodeuser bash -c "$ROOCODEUSER_HOME/bin/asdf --version"

# Install Node.js 20.18.1 for roocodeuser
echo "Installing Node.js 20.18.1 via asdf for roocodeuser..."
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc && $ROOCODEUSER_HOME/bin/asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git || true"
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc && $ROOCODEUSER_HOME/bin/asdf install nodejs 20.18.1"
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc && $ROOCODEUSER_HOME/bin/asdf global nodejs 20.18.1"

# Verify Node.js
echo "Node.js version for roocodeuser:"
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc && node --version"
echo "npm version for roocodeuser:"
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc && npm --version"

# Install pnpm 10.11.0 for roocodeuser
echo "Installing pnpm 10.11.0 via asdf for roocodeuser..."
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc && $ROOCODEUSER_HOME/bin/asdf plugin add pnpm https://github.com/jonathanmorley/asdf-pnpm.git || true"
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc && $ROOCODEUSER_HOME/bin/asdf install pnpm 10.11.0"
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc && $ROOCODEUSER_HOME/bin/asdf global pnpm 10.11.0"

# pnpm setup
echo "Running pnpm setup for roocodeuser..."
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc && pnpm setup"
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc"

# Verify pnpm
echo "pnpm version for roocodeuser:"
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc && pnpm --version"

# Install Visual Studio Code (VS Code)
echo "Installing Visual Studio Code..."
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
rm packages.microsoft.gpg
sudo apt update
sudo apt install -y code

# Verify VS Code
echo "VS Code version:"
code --version | head -n 1

# Clone Roo Benchmarks repository for roocodeuser
echo "Cloning Roo Benchmarks repository for roocodeuser..."
if [ ! -d "$ROOCODEUSER_HOME/Roo-Code" ]; then
  sudo -u roocodeuser git clone https://github.com/StevenTCramer/Roo-Code.git "$ROOCODEUSER_HOME/Roo-Code"
fi
sudo chown -R roocodeuser:roocodeuser "$ROOCODEUSER_HOME/Roo-Code"

# Install dependencies
echo "Installing project dependencies with pnpm for roocodeuser..."
cd "$ROOCODEUSER_HOME/Roo-Code/evals/scripts"
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc && pnpm install"

# Run the benchmarks setup
echo "Running benchmarks setup for roocodeuser (may require user interaction)..."
sudo -u roocodeuser bash -c "source $ROOCODEUSER_HOME/.bashrc && cd $ROOCODEUSER_HOME/Roo-Code/evals/scripts && pnpm run setup"

echo "Setup complete. Log in as roocodeuser to use the environment."
