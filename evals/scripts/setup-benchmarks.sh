#!/usr/bin/env bash
# setup-benchmarks.sh
# System-wide setup for Roo Benchmarks on Ubuntu 24 Server, prepares first_login.sh for roocodeuser

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

# Install Visual Studio Code (VS Code)
echo "Installing Visual Studio Code..."
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
echo "deb [arch=amd64] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list
rm packages.microsoft.gpg
apt update
apt install -y code

# Verify VS Code
echo "VS Code version:"
code --version | head -n 1

# Create first_login.sh for roocodeuser
echo "Creating first_login.sh for roocodeuser..."
cat > "$ROOCODEUSER_HOME/first_login.sh" << 'EOF'
#!/usr/bin/env bash
# first_login.sh
# User-specific setup for Roo Benchmarks on Ubuntu 24 Server for roocodeuser

set -euo pipefail

# Log output to file
exec > >(tee -a "$HOME/first_login.log") 2>&1

echo "Starting first login setup for roocodeuser..."

# Install asdf v0.16.7
echo "Setting up asdf v0.16.7..."
mkdir -p "$HOME/bin" "$HOME/.asdf/tmp" "$HOME/.asdf/cache" "$HOME/.asdf/shims"
ASDF_TAR="$HOME/bin/asdf.tar.gz"
ARCH="$(uname -m)"
if [ "$ARCH" = "x86_64" ]; then
  curl -L https://github.com/asdf-vm/asdf/releases/download/v0.16.7/asdf-v0.16.7-linux-amd64.tar.gz -o "$ASDF_TAR" || {
    echo "Error: Failed to download asdf tarball"
    exit 1
  }
else
  curl -L https://github.com/asdf-vm/asdf/releases/download/v0.16.7/asdf-v0.16.7-linux-arm64.tar.gz -o "$ASDF_TAR" || {
    echo "Error: Failed to download asdf tarball"
    exit 1
  }
fi
tar -xzf "$ASDF_TAR" -C "$HOME/bin" || {
  echo "Error: Failed to extract asdf tarball"
  exit 1
}
rm "$ASDF_TAR"

# Set up environment variables for asdf in .bashrc
echo "Configuring asdf environment..."
if ! grep -q 'ASDF_DATA_DIR' "$HOME/.bashrc"; then
  echo "export ASDF_DATA_DIR=\"$HOME/.asdf\"" >> "$HOME/.bashrc"
  echo "export PATH=\"$HOME/.asdf/shims:$HOME/bin:\$PATH\"" >> "$HOME/.bashrc"
fi

# Source .bashrc for this session
source "$HOME/.bashrc"

# Verify asdf installation
echo "Verifying asdf installation..."
asdf --version > "$HOME/asdf-verify.log" 2>&1 || {
  echo "Error: asdf verification failed. See $HOME/asdf-verify.log"
  cat "$HOME/asdf-verify.log"
  exit 1
}

# Install Node.js 20.18.1
echo "Installing Node.js 20.18.1 via asdf..."
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git || true > "$HOME/asdf-nodejs-plugin.log" 2>&1 || {
  echo "Error: Failed to add nodejs plugin. See $HOME/asdf-nodejs-plugin.log"
  cat "$HOME/asdf-nodejs-plugin.log"
  exit 1
}
asdf install nodejs 20.18.1 > "$HOME/asdf-nodejs-install.log" 2>&1 || {
  echo "Error: Failed to install Node.js 20.18.1. See $HOME/asdf-nodejs-install.log"
  cat "$HOME/asdf-nodejs-install.log"
  exit 1
}
asdf set -u nodejs 20.18.1 > "$HOME/asdf-nodejs-global.log" 2>&1 || {
  echo "Error: Failed to set Node.js global version. See $HOME/asdf-nodejs-global.log"
  cat "$HOME/asdf-nodejs-global.log"
  exit 1
}
asdf reshim nodejs > "$HOME/asdf-nodejs-reshim.log" 2>&1 || {
  echo "Error: Failed to reshim Node.js. See $HOME/asdf-nodejs-reshim.log"
  cat "$HOME/asdf-nodejs-reshim.log"
  exit 1
}

# Verify Node.js
echo "Node.js version:"
node --version > "$HOME/node-verify.log" 2>&1 || {
  echo "Error: Node.js verification failed. See $HOME/node-verify.log"
  cat "$HOME/node-verify.log"
  exit 1
}
echo "npm version:"
npm --version > "$HOME/npm-verify.log" 2>&1 || {
  echo "Error: npm verification failed. See $HOME/npm-verify.log"
  cat "$HOME/npm-verify.log"
  exit 1
}

# Install pnpm 10.11.0
echo "Installing pnpm 10.11.0 via asdf..."
asdf plugin add pnpm https://github.com/jonathanmorley/asdf-pnpm.git || true > "$HOME/asdf-pnpm-plugin.log" 2>&1 || {
  echo "Error: Failed to add pnpm plugin. See $HOME/asdf-pnpm-plugin.log"
  cat "$HOME/asdf-pnpm-plugin.log"
  exit 1
}
asdf install pnpm 10.11.0 > "$HOME/asdf-pnpm-install.log" 2>&1 || {
  echo "Error: Failed to install pnpm 10.11.0. See $HOME/asdf-pnpm-install.log"
  cat "$HOME/asdf-pnpm-install.log"
  exit 1
}
asdf set -u pnpm 10.11.0 > "$HOME/asdf-pnpm-global.log" 2>&1 || {
  echo "Error: Failed to set pnpm global version. See $HOME/asdf-pnpm-global.log"
  cat "$HOME/asdf-pnpm-global.log"
  exit 1
}
asdf reshim pnpm > "$HOME/asdf-pnpm-reshim.log" 2>&1 || {
  echo "Error: Failed to reshim pnpm. See $HOME/asdf-pnpm-reshim.log"
  cat "$HOME/asdf-pnpm-reshim.log"
  exit 1
}

# pnpm setup
echo "Running pnpm setup..."
pnpm setup > "$HOME/pnpm-setup.log" 2>&1 || {
  echo "Error: pnpm setup failed. See $HOME/pnpm-setup.log"
  cat "$HOME/pnpm-setup.log"
  exit 1
}

# Verify pnpm
echo "pnpm version:"
pnpm --version > "$HOME/pnpm-verify.log" 2>&1 || {
  echo "Error: pnpm verification failed. See $HOME/pnpm-verify.log"
  cat "$HOME/pnpm-verify.log"
  exit 1
}

# Clone Roo Benchmarks repository
echo "Cloning Roo Benchmarks repository..."
if [ ! -d "$HOME/Roo-Code" ]; then
  git clone https://github.com/StevenTCramer/Roo-Code.git "$HOME/Roo-Code" > "$HOME/git-clone.log" 2>&1 || {
    echo "Error: Failed to clone Roo-Code. See $HOME/git-clone.log"
    cat "$HOME/git-clone.log"
    exit 1
  }
fi

# Install dependencies
echo "Installing project dependencies with pnpm..."
cd "$HOME/Roo-Code/evals/scripts"
pnpm install > "$HOME/pnpm-install.log" 2>&1 || {
  echo "Error: pnpm install failed. See $HOME/pnpm-install.log"
  cat "$HOME/pnpm-install.log"
  exit 1
}

# Run the benchmarks setup
echo "Running benchmarks setup..."
pnpm run setup > "$HOME/pnpm-setup-run.log" 2>&1 || {
  echo "Error: pnpm run setup failed. See $HOME/pnpm-setup-run.log"
  cat "$HOME/pnpm-setup-run.log"
  exit 1
}

echo "First login setup complete."
touch "$HOME/.first_login_done"
EOF

# Set permissions for first_login.sh
chown roocodeuser:roocodeuser "$ROOCODEUSER_HOME/first_login.sh"
chmod 755 "$ROOCODEUSER_HOME/first_login.sh"

# Configure .bashrc to run first_login.sh on first login
echo "Configuring .bashrc to run first_login.sh on first login..."
if ! grep -q 'first_login.sh' "$ROOCODEUSER_HOME/.bashrc"; then
  cat >> "$ROOCODEUSER_HOME/.bashrc" << 'EOF'
# Run first_login.sh on first login
if [ -f "$HOME/first_login.sh" ] && [ ! -f "$HOME/.first_login_done" ]; then
  echo "Running first login setup..."
  bash "$HOME/first_login.sh"
fi
EOF
fi
chown roocodeuser:roocodeuser "$ROOCODEUSER_HOME/.bashrc"

echo "System-wide setup complete. Log in as roocodeuser to trigger first_login.sh."