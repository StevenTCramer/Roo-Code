#!/usr/bin/env bash
# first_login.sh
# User-specific setup for Roo Benchmarks on Ubuntu 24 Server for roocodeuser

set -euo pipefail

# Create flag file to ensure single execution
touch "$HOME/.first_login_done"

echo "Starting first login setup for roocodeuser..."

# Echo initial PATH
echo "Initial PATH: $PATH"

# Test PATH modification
export PATH="/tmp:$PATH"
echo "Test PATH: $PATH"

# Set PATH for script
export PATH="/usr/bin:$HOME/bin:$HOME/.asdf/shims:$PATH"
hash -r
echo "Script PATH: $PATH"

# Install Visual Studio Code (VS Code)
echo "Installing Visual Studio Code..."
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > "$HOME/packages.microsoft.gpg"
sudo install -o root -g root -m 644 "$HOME/packages.microsoft.gpg" /etc/apt/trusted.gpg.d/
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
rm "$HOME/packages.microsoft.gpg"
sudo apt update
sudo apt install -y code || {
  echo "Error: VS Code installation failed"
  exit 1;
}

# Verify VS Code
echo "VS Code version:"
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; which code; code --version" || {
  echo "Error: VS Code verification failed"
  exit 1;
}

# Install asdf v0.16.7
echo "Setting up asdf v0.16.7..."
mkdir -p "$HOME/bin" "$HOME/.asdf/tmp" "$HOME/.asdf/cache" "$HOME/.asdf/shims"
ASDF_TAR="$HOME/bin/asdf.tar.gz"
ARCH="$(uname -m)"
if [ "$ARCH" = "x86_64" ]; then
  curl -L https://github.com/asdf-vm/asdf/releases/download/v0.16.7/asdf-v0.16.7-linux-amd64.tar.gz -o "$ASDF_TAR" || {
    echo "Error: Failed to download asdf tarball"
    exit 1;
  }
else
  curl -L https://github.com/asdf-vm/asdf/releases/download/v0.16.7/asdf-v0.16.7-linux-arm64.tar.gz -o "$ASDF_TAR" || {
    echo "Error: Failed to download asdf tarball"
    exit 1;
  }
fi
tar -xzf "$ASDF_TAR" -C "$HOME/bin" || {
  echo "Error: Failed to extract asdf tarball"
  exit 1;
}
rm "$ASDF_TAR"
chmod +x "$HOME/bin/asdf" || {
  echo "Error: Failed to make asdf executable"
  exit 1;
}

# Debug asdf executable
echo "Listing asdf executable..."
ls -l "$HOME/bin/asdf" || {
  echo "Error: Failed to list asdf executable"
  exit 1;
}

# Verify asdf executable exists
if [ ! -x "$HOME/bin/asdf" ]; then
  echo "Error: asdf executable not found at $HOME/bin/asdf"
  exit 1
fi

# Set up environment variables for asdf
echo "Configuring asdf environment..."
if ! grep -q 'ASDF_DATA_DIR' "$HOME/.bashrc"; then
  echo "export ASDF_DATA_DIR=\"$HOME/.asdf\"" >> "$HOME/.bashrc"
  echo "export PATH=\"$HOME/.asdf/shims:$HOME/bin:/usr/bin:\$PATH\"" >> "$HOME/.bashrc"
fi

# Verify asdf installation
echo "Verifying asdf installation..."
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; which asdf; asdf --version" || {
  echo "Error: asdf verification failed"
  exit 1;
}

# Install Node.js 20.18.1
echo "Installing Node.js 20.18.1 via asdf..."
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git || true" || {
  echo "Error: Failed to add nodejs plugin"
  exit 1;
}
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; asdf install nodejs 20.18.1" || {
  echo "Error: Failed to install Node.js 20.18.1"
  exit 1;
}
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; asdf set -u nodejs 20.18.1" || {
  echo "Error: Failed to set Node.js global version"
  exit 1;
}
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; asdf reshim nodejs" || {
  echo "Error: Failed to reshim Node.js"
  exit 1;
}

# Verify Node.js
echo "Node.js version:"
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; node --version" || {
  echo "Error: Node.js verification failed"
  exit 1;
}
echo "npm version:"
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; npm --version" || {
  echo "Error: npm verification failed"
  exit 1;
}

# Install pnpm 10.11.0
echo "Installing pnpm 10.11.0 via asdf..."
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; asdf plugin add pnpm https://github.com/jonathanmorley/asdf-pnpm.git || true" || {
  echo "Error: Failed to add pnpm plugin"
  exit 1;
}
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; asdf install pnpm 10.11.0" || {
  echo "Error: Failed to install pnpm 10.11.0"
  exit 1;
}
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; asdf set -u pnpm 10.11.0" || {
  echo "Error: Failed to set pnpm global version"
  exit 1;
}
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; asdf reshim pnpm" || {
  echo "Error: Failed to reshim pnpm"
  exit 1;
}

# pnpm setup
echo "Running pnpm setup..."
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; pnpm setup" || {
  echo "Error: pnpm setup failed"
  exit 1;
}

# Verify pnpm
echo "pnpm version:"
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; pnpm --version" || {
  echo "Error: pnpm verification failed"
  exit 1;
}

# Clone Roo Benchmarks repository
echo "Cloning Roo Benchmarks repository..."
GITHUB_USER="${GITHUB_USER:-RooVetGit}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
if [ ! -d "$HOME/Roo-Code" ]; then
  bash -l -c "source \$HOME/.bashrc; export PATH=/usr/bin:\$HOME/bin:\$PATH; hash -r; git clone --branch \"\$GITHUB_BRANCH\" https://github.com/\$GITHUB_USER/Roo-Code.git \$HOME/Roo-Code" || {
    echo "Error: Failed to clone Roo-Code"
    exit 1;
  }
fi

# Install dependencies
echo "Installing project dependencies with pnpm..."
cd "$HOME/Roo-Code/evals/scripts"
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; pnpm install" || {
  echo "Error: pnpm install failed"
  exit 1;
}

# Run the benchmarks setup
echo "Running benchmarks setup..."
bash -l -c "source $HOME/.bashrc; export PATH=/usr/bin:$HOME/bin:$PATH; hash -r; pnpm run setup" || {
  echo "Error: pnpm run setup failed"
  exit 1;
}

echo "First login setup complete."