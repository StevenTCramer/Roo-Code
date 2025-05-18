#!/usr/bin/env bash
# setup-benchmarks.sh
# Automated setup for Roo Benchmarks on Ubuntu 25 Server

set -euo pipefail

# 1. Update the System
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Dependencies
echo "Installing dependencies..."
sudo apt install -y curl git build-essential libssl-dev zlib1g-dev xvfb gnupg2 apt-transport-https micro wget

# 3. Install asdf v0.16.7
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

# 4. Set up environment variables for asdf
echo "Configuring asdf environment..."
if ! grep -q 'ASDF_DATA_DIR' "$HOME/.bashrc"; then
  echo 'export ASDF_DATA_DIR="$HOME/.asdf"' >> "$HOME/.bashrc"
  echo 'export PATH="$ASDF_DATA_DIR/shims:$HOME/bin:$PATH"' >> "$HOME/.bashrc"
fi
export ASDF_DATA_DIR="$HOME/.asdf"
export PATH="$ASDF_DATA_DIR/shims:$HOME/bin:$PATH"

# 5. Verify asdf
echo "Verifying asdf installation..."
asdf --version

# 6. Install Node.js 20.18.1
echo "Installing Node.js 20.18.1 via asdf..."
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git || true
asdf install nodejs 20.18.1
asdf set -u nodejs 20.18.1

# 7. Verify Node.js
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# 8. Install pnpm 10.11.0
echo "Installing pnpm 10.11.0 via asdf..."
asdf plugin add pnpm https://github.com/jonathanmorley/asdf-pnpm.git || true
asdf install pnpm 10.11.0
asdf set -u pnpm 10.11.0

# 9. pnpm setup
echo "Running pnpm setup..."
pnpm setup
source "$HOME/.bashrc"

# 10. Verify pnpm
echo "pnpm version: $(pnpm --version)"

# 11. Install Visual Studio Code (VS Code)
echo "Installing Visual Studio Code..."
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
rm packages.microsoft.gpg
sudo apt update
sudo apt install -y code

# 12. Verify VS Code
echo "VS Code version: $(code --version | head -n 1)"

# 13. Configure Xvfb
echo "Starting Xvfb virtual display..."
Xvfb :99 -screen 0 1280x720x24 &
export DISPLAY=:99
sleep 2
ps aux | grep Xvfb | grep -v grep

# 14. Clone Roo Benchmarks repository
echo "Cloning Roo Benchmarks repository..."
if [ ! -d "Roo-Code" ]; then
  git clone https://github.com/StevenTCramer/Roo-Code.git
fi
cd Roo-Code/evals/scripts

# 15. Install dependencies
echo "Installing project dependencies with pnpm..."
pnpm install

# 16. Run the benchmarks setup
echo "Running benchmarks setup (may require user interaction)..."
pnpm run setup

echo "Setup complete. Follow any on-screen instructions to finish."