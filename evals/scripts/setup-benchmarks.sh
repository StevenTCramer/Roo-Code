#!/usr/bin/env bash
# setup-benchmarks.sh
# Automated setup for Roo Benchmarks on Ubuntu 24 Server

set -euo pipefail

# Update the System
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Dependencies
echo "Installing dependencies..."
sudo apt install -y curl git build-essential libssl-dev zlib1g-dev xvfb gnupg2 apt-transport-https micro wget

# Install asdf v0.16.7
echo "Setting up asdf v0.16.7..."
mkdir -p "$HOME/bin"
ASDF_TAR="$HOME/bin/asdf.tar.gz"
ARCH="$(uname -m)"
if [ "$ARCH" = "x86_64" ]; then
  curl -L https://github.com/asdf-vm/asdf/releases/download/v0.16.7/asdf-v0.16.7-linux-amd64.tar.gz -o "$ASDF_TAR"
else
  curl -L https://github.com/asdf-vm/asdf/releases/download/v0.16.7/asdf-v0.16.7-linux-arm64.tar.gz -o "$ASDF_TAR"
fi
tar -xzf "$ASDF_TAR" -C "$HOME/bin"
rm "$ASDF_TAR"

# Set up environment variables for asdf
echo "Configuring asdf environment..."
if ! grep -q 'ASDF_DATA_DIR' "$HOME/.bashrc"; then
  echo 'export ASDF_DATA_DIR="$HOME/.asdf"' >> "$HOME/.bashrc"
  echo 'export PATH="$ASDF_DATA_DIR/shims:$HOME/bin:$PATH"' >> "$HOME/.bashrc"
fi
export ASDF_DATA_DIR="$HOME/.asdf"
export PATH="$ASDF_DATA_DIR/shims:$HOME/bin:$PATH"

# Verify asdf
echo "Verifying asdf installation..."
asdf --version

# Install Node.js 20.18.1
echo "Installing Node.js 20.18.1 via asdf..."
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git || true
asdf install nodejs 20.18.1
asdf set -u nodejs 20.18.1

# Verify Node.js
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install pnpm 10.11.0
echo "Installing pnpm 10.11.0 via asdf..."
asdf plugin add pnpm https://github.com/jonathanmorley/asdf-pnpm.git || true
asdf install pnpm 10.11.0
asdf set -u pnpm 10.11.0

# pnpm setup
echo "Running pnpm setup..."
pnpm setup
source "$HOME/.bashrc"

# Verify pnpm
echo "pnpm version: $(pnpm --version)"

# Install Visual Studio Code (VS Code)
echo "Installing Visual Studio Code..."
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
rm packages.microsoft.gpg
sudo apt update
sudo apt install -y code

# Verify VS Code
echo "VS Code version: $(code --version | head -n 1)"

# Clone Roo Benchmarks repository
echo "Cloning Roo Benchmarks repository..."
if [ ! -d "Roo-Code" ]; then
  git clone https://github.com/StevenTCramer/Roo-Code.git
fi
cd Roo-Code/evals/scripts

# Install dependencies
echo "Installing project dependencies with pnpm..."
pnpm install

# Run the benchmarks setup
echo "Running benchmarks setup (may require user interaction)..."
pnpm run setup

echo "Setup complete. Follow any on-screen instructions to finish."