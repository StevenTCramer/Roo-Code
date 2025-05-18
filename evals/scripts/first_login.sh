#!/usr/bin/env bash
# first_login.sh
# User-specific setup for Roo Benchmarks on Ubuntu 24 Server for roocodeuser

set -euo pipefail

# Create flag file to ensure single execution
touch "$HOME/.first_login_done"

# Log output to file
exec > >(tee -a "$HOME/first_login.log") 2>&1

echo "Starting first login setup for roocodeuser..."

# Install Visual Studio Code (VS Code)
echo "Installing Visual Studio Code..."
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > "$HOME/packages.microsoft.gpg"
sudo install -o root -g root -m 644 "$HOME/packages.microsoft.gpg" /etc/apt/trusted.gpg.d/
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
rm "$HOME/packages.microsoft.gpg"
sudo apt update
sudo apt install -y code > "$HOME/vscode-install.log" 2>&1 || {
  echo "Error: VS Code installation failed. See $HOME/vscode-install.log"
  cat "$HOME/vscode-install.log"
  exit 1
}

# Verify VS Code
echo "VS Code version:"
bash -l -c "code --version" | head -n 1 > "$HOME/vscode-verify.log" 2>&1 || {
  echo "Error: VS Code verification failed. See $HOME/vscode-verify.log"
  cat "$HOME/vscode-verify.log"
  exit 1
}

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
chmod +x "$HOME/bin/asdf" || {
  echo "Error: Failed to make asdf executable"
  exit 1
}

# Debug asdf executable
echo "Listing asdf executable..."
ls -l "$HOME/bin/asdf" > "$HOME/asdf-executable-debug.log" 2>&1 || {
  echo "Error: Failed to list asdf executable"
  exit 1
}

# Verify asdf executable exists
if [ ! -x "$HOME/bin/asdf" ]; then
  echo "Error: asdf executable not found at $HOME/bin/asdf"
  exit 1
}

# Set up environment variables for asdf
echo "Configuring asdf environment..."
if ! grep -q 'ASDF_DATA_DIR' "$HOME/.bashrc"; then
  echo "export ASDF_DATA_DIR=\"$HOME/.asdf\"" >> "$HOME/.bashrc"
  echo "export PATH=\"$HOME/.asdf/shims:$HOME/bin:\$PATH\"" >> "$HOME/.bashrc"
fi

# Explicitly set PATH for this session
export PATH="$HOME/.asdf/shims:$HOME/bin:$PATH"
hash -r  # Clear command cache
echo "Current PATH: $PATH" > "$HOME/asdf-env-debug.log"
bash -l -c "which asdf" >> "$HOME/asdf-env-debug.log" 2>&1

# Verify asdf installation
echo "Verifying asdf installation..."
bash -l -c "$HOME/bin/asdf --version" > "$HOME/asdf-verify.log" 2>&1 || {
  echo "Error: asdf verification failed. See $HOME/asdf-verify.log and $HOME/asdf-env-debug.log"
  cat "$HOME/asdf-verify.log"
  cat "$HOME/asdf-env-debug.log"
  exit 1
}

# Install Node.js 20.18.1
echo "Installing Node.js 20.18.1 via asdf..."
bash -l -c "$HOME/bin/asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git || true" > "$HOME/asdf-nodejs-plugin.log" 2>&1 || {
  echo "Error: Failed to add nodejs plugin. See $HOME/asdf-nodejs-plugin.log"
  cat "$HOME/asdf-nodejs-plugin.log"
  exit 1
}
bash -l -c "$HOME/bin/asdf install nodejs 20.18.1" > "$HOME/asdf-nodejs-install.log" 2>&1 || {
  echo "Error: Failed to install Node.js 20.18.1. See $HOME/asdf-nodejs-install.log"
  cat "$HOME/asdf-nodejs-install.log"
  exit 1
}
bash -l -c "$HOME/bin/asdf set -u nodejs 20.18.1" > "$HOME/asdf-nodejs-global.log" 2>&1 || {
  echo "Error: Failed to set Node.js global version. See $HOME/asdf-nodejs-global.log"
  cat "$HOME/asdf-nodejs-global.log"
  exit 1
}
bash -l -c "$HOME/bin/asdf reshim nodejs" > "$HOME/asdf-nodejs-reshim.log" 2>&1 || {
  echo "Error: Failed to reshim Node.js. See $HOME/asdf-nodejs-reshim.log"
  cat "$HOME/asdf-nodejs-reshim.log"
  exit 1
}

# Verify Node.js
echo "Node.js version:"
bash -l -c "node --version" > "$HOME/node-verify.log" 2>&1 || {
  echo "Error: Node.js verification failed. See $HOME/node-verify.log"
  cat "$HOME/node-verify.log"
  exit 1
}
echo "npm version:"
bash -l -c "npm --version" > "$HOME/npm-verify.log" 2>&1 || {
  echo "Error: npm verification failed. See $HOME/npm-verify.log"
  cat "$HOME/npm-verify.log"
  exit 1
}

# Install pnpm 10.11.0
echo "Installing pnpm 10.11.0 via asdf..."
bash -l -c "$HOME/bin/asdf plugin add pnpm https://github.com/jonathanmorley/asdf-pnpm.git || true" > "$HOME/asdf-pnpm-plugin.log" 2>&1 || {
  echo "Error: Failed to add pnpm plugin. See $HOME/asdf-pnpm-plugin.log"
  cat "$HOME/asdf-pnpm-plugin.log"
  exit 1
}
bash -l -c "$HOME/bin/asdf install pnpm 10.11.0" > "$HOME/asdf-pnpm-install.log" 2>&1 || {
  echo "Error: Failed to install pnpm 10.11.0. See $HOME/asdf-pnpm-install.log"
  cat "$HOME/asdf-pnpm-install.log"
  exit 1
}
bash -l -c "$HOME/bin/asdf set -u pnpm 10.11.0" > "$HOME/asdf-pnpm-global.log" 2>&1 || {
  echo "Error: Failed to set pnpm global version. See $HOME/asdf-pnpm-global.log"
  cat "$HOME/asdf-pnpm-global.log"
  exit 1
}
bash -l -c "$HOME/bin/asdf reshim pnpm" > "$HOME/asdf-pnpm-reshim.log" 2>&1 || {
  echo "Error: Failed to reshim pnpm. See $HOME/asdf-pnpm-reshim.log"
  cat "$HOME/asdf-pnpm-reshim.log"
  exit 1
}

# pnpm setup
echo "Running pnpm setup..."
bash -l -c "pnpm setup" > "$HOME/pnpm-setup.log" 2>&1 || {
  echo "Error: pnpm setup failed. See $HOME/pnpm-setup.log"
  cat "$HOME/pnpm-setup.log"
  exit 1
}

# Verify pnpm
echo "pnpm version:"
bash -l -c "pnpm --version" > "$HOME/pnpm-verify.log" 2>&1 || {
  echo "Error: pnpm verification failed. See $HOME/pnpm-verify.log"
  cat "$HOME/pnpm-verify.log"
  exit 1
}

# Clone Roo Benchmarks repository
echo "Cloning Roo Benchmarks repository..."
if [ ! -d "$HOME/Roo-Code" ]; then
  bash -l -c "git clone https://github.com/StevenTCramer/Roo-Code.git $HOME/Roo-Code" > "$HOME/git-clone.log" 2>&1 || {
    echo "Error: Failed to clone Roo-Code. See $HOME/git-clone.log"
    cat "$HOME/git-clone.log"
    exit 1
  }
fi

# Install dependencies
echo "Installing project dependencies with pnpm..."
cd "$HOME/Roo-Code/evals/scripts"
bash -l -c "pnpm install" > "$HOME/pnpm-install.log" 2>&1 || {
  echo "Error: pnpm install failed. See $HOME/pnpm-install.log"
  cat "$HOME/pnpm-install.log"
  exit 1
}

# Run the benchmarks setup
echo "Running benchmarks setup..."
bash -l -c "pnpm run setup" > "$HOME/pnpm-setup-run.log" 2>&1 || {
  echo "Error: pnpm run setup failed. See $HOME/pnpm-setup-run.log"
  cat "$HOME/pnpm-setup-run.log"
  exit 1
}

echo "First login setup complete."