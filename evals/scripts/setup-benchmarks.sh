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

# Install Dependencies (minimal, matching ReadMe-linux.markdown)
echo "Installing dependencies..."
apt install -y curl git build-essential libssl-dev zlib1g-dev xvfb gnupg2 apt-transport-https micro wget

# Install asdf v0.16.7 for roocodeuser
echo "Setting up asdf v0.16.7 for roocodeuser..."
mkdir -p "$ROOCODEUSER_HOME/bin" "$ROOCODEUSER_HOME/.asdf/tmp" "$ROOCODEUSER_HOME/.asdf/cache"
chown -R roocodeuser:roocodeuser "$ROOCODEUSER_HOME/bin" "$ROOCODEUSER_HOME/.asdf"
ASDF_TAR="$ROOCODEUSER_HOME/bin/asdf.tar.gz"
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
tar -xzf "$ASDF_TAR" -C "$ROOCODEUSER_HOME/bin" || {
  echo "Error: Failed to extract asdf tarball"
  exit 1
}
rm "$ASDF_TAR"
chown -R roocodeuser:roocodeuser "$ROOCODEUSER_HOME/bin"

# Set up environment variables for asdf in roocodeuser's .bashrc
echo "Configuring asdf environment for roocodeuser..."
if ! grep -q 'ASDF_DATA_DIR' "$ROOCODEUSER_HOME/.bashrc"; then
  echo "export ASDF_DATA_DIR=\"$ROOCODEUSER_HOME/.asdf\"" >> "$ROOCODEUSER_HOME/.bashrc"
  echo "export PATH=\"$ROOCODEUSER_HOME/.asdf/shims:$ROOCODEUSER_HOME/bin:\$PATH\"" >> "$ROOCODEUSER_HOME/.bashrc"
  echo ". $ROOCODEUSER_HOME/bin/asdf.sh" >> "$ROOCODEUSER_HOME/.bashrc"
fi
chown roocodeuser:roocodeuser "$ROOCODEUSER_HOME/.bashrc"

# Verify asdf installation
echo "Verifying asdf installation for roocodeuser..."
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && $ROOCODEUSER_HOME/bin/asdf --version" > "$ROOCODEUSER_HOME/asdf-verify.log" 2>&1 || {
  echo "Error: asdf verification failed. See $ROOCODEUSER_HOME/asdf-verify.log"
  cat "$ROOCODEUSER_HOME/asdf-verify.log"
  exit 1
}

# Install Node.js 20.18.1 for roocodeuser
echo "Installing Node.js 20.18.1 via asdf for roocodeuser..."
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && $ROOCODEUSER_HOME/bin/asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git || true" > "$ROOCODEUSER_HOME/asdf-nodejs-plugin.log" 2>&1 || {
  echo "Error: Failed to add nodejs plugin. See $ROOCODEUSER_HOME/asdf-nodejs-plugin.log"
  cat "$ROOCODEUSER_HOME/asdf-nodejs-plugin.log"
  exit 1
}
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && $ROOCODEUSER_HOME/bin/asdf install nodejs 20.18.1" > "$ROOCODEUSER_HOME/asdf-nodejs-install.log" 2>&1 || {
  echo "Error: Failed to install Node.js 20.18.1. See $ROOCODEUSER_HOME/asdf-nodejs-install.log"
  cat "$ROOCODEUSER_HOME/asdf-nodejs-install.log"
  exit 1
}
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && $ROOCODEUSER_HOME/bin/asdf global nodejs 20.18.1" > "$ROOCODEUSER_HOME/asdf-nodejs-global.log" 2>&1 || {
  echo "Error: Failed to set Node.js global version. See $ROOCODEUSER_HOME/asdf-nodejs-global.log"
  cat "$ROOCODEUSER_HOME/asdf-nodejs-global.log"
  exit 1
}

# Verify Node.js
echo "Node.js version for roocodeuser:"
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && node --version" || {
  echo "Error: Node.js verification failed"
  exit 1
}
echo "npm version for roocodeuser:"
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && npm --version" || {
  echo "Error: npm verification failed"
  exit 1
}

# Install pnpm 10.11.0 for roocodeuser
echo "Installing pnpm 10.11.0 via asdf for roocodeuser..."
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && $ROOCODEUSER_HOME/bin/asdf plugin add pnpm https://github.com/jonathanmorley/asdf-pnpm.git || true" > "$ROOCODEUSER_HOME/asdf-pnpm-plugin.log" 2>&1 || {
  echo "Error: Failed to add pnpm plugin. See $ROOCODEUSER_HOME/asdf-pnpm-plugin.log"
  cat "$ROOCODEUSER_HOME/asdf-pnpm-plugin.log"
  exit 1
}
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && $ROOCODEUSER_HOME/bin/asdf install pnpm 10.11.0" > "$ROOCODEUSER_HOME/asdf-pnpm-install.log" 2>&1 || {
  echo "Error: Failed to install pnpm 10.11.0. See $ROOCODEUSER_HOME/asdf-pnpm-install.log"
  cat "$ROOCODEUSER_HOME/asdf-pnpm-install.log"
  exit 1
}
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && $ROOCODEUSER_HOME/bin/asdf global pnpm 10.11.0" > "$ROOCODEUSER_HOME/asdf-pnpm-global.log" 2>&1 || {
  echo "Error: Failed to set pnpm global version. See $ROOCODEUSER_HOME/asdf-pnpm-global.log"
  cat "$ROOCODEUSER_HOME/asdf-pnpm-global.log"
  exit 1
}

# pnpm setup
echo "Running pnpm setup for roocodeuser..."
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && pnpm setup" > "$ROOCODEUSER_HOME/pnpm-setup.log" 2>&1 || {
  echo "Error: pnpm setup failed. See $ROOCODEUSER_HOME/pnpm-setup.log"
  cat "$ROOCODEUSER_HOME/pnpm-setup.log"
  exit 1
}

# Verify pnpm
echo "pnpm version for roocodeuser:"
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && pnpm --version" || {
  echo "Error: pnpm verification failed"
  exit 1
}

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

# Clone Roo Benchmarks repository for roocodeuser
echo "Cloning Roo Benchmarks repository for roocodeuser..."
if [ ! -d "$ROOCODEUSER_HOME/Roo-Code" ]; then
  su - roocodeuser -c "git clone https://github.com/StevenTCramer/Roo-Code.git $ROOCODEUSER_HOME/Roo-Code" > "$ROOCODEUSER_HOME/git-clone.log" 2>&1 || {
    echo "Error: Failed to clone Roo-Code. See $ROOCODEUSER_HOME/git-clone.log"
    cat "$ROOCODEUSER_HOME/git-clone.log"
    exit 1
  }
fi
chown -R roocodeuser:roocodeuser "$ROOCODEUSER_HOME/Roo-Code"

# Install dependencies
echo "Installing project dependencies with pnpm for roocodeuser..."
cd "$ROOCODEUSER_HOME/Roo-Code/evals/scripts"
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && pnpm install" > "$ROOCODEUSER_HOME/pnpm-install.log" 2>&1 || {
  echo "Error: pnpm install failed. See $ROOCODEUSER_HOME/pnpm-install.log"
  cat "$ROOCODEUSER_HOME/pnpm-install.log"
  exit 1
}

# Run the benchmarks setup
echo "Running benchmarks setup for roocodeuser..."
su - roocodeuser -c ". $ROOCODEUSER_HOME/bin/asdf.sh && cd $ROOCODEUSER_HOME/Roo-Code/evals/scripts && pnpm run setup" > "$ROOCODEUSER_HOME/pnpm-setup-run.log" 2>&1 || {
  echo "Error: pnpm run setup failed. See $ROOCODEUSER_HOME/pnpm-setup-run.log"
  cat "$ROOCODEUSER_HOME/pnpm-setup-run.log"
  exit 1
}

echo "Setup complete. Log in as roocodeuser to use the environment."