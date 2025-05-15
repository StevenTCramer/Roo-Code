#!/bin/bash

set -e

# Install nvm
if [ ! -d "$HOME/.nvm" ]; then
  echo "Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
fi

# Source nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Ensure Node.js 20.18.1 via nvm
if ! command -v node &>/dev/null || [[ "$(node --version)" != "v20.18.1" ]]; then
  echo "Installing Node.js 20.18.1 via nvm..."
  nvm install 20.18.1
  nvm use 20.18.1
fi

# Verify Node.js version
if [[ "$(node --version)" != "v20.18.1" ]]; then
  echo "Error: Node.js version 20.18.1 required. Current: $(node --version)"
  exit 1
fi

# Install pnpm
if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
fi

# Run TypeScript setup from evals/scripts/
echo "Running setup script..."
cd scripts
pnpm run setup