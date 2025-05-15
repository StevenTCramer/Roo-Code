#!/bin/bash

set -e

# Install asdf if not present
if [ ! -d "$HOME/.asdf" ]; then
  echo "Installing asdf..."
  git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.14.0
fi

# Source asdf for this shell session
. "$HOME/.asdf/asdf.sh"

# Add nodejs plugin if not present
if ! asdf plugin-list | grep -q "nodejs"; then
  echo "Adding asdf nodejs plugin..."
  asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
fi

# Import Node.js release team's OpenPGP keys (required for asdf-nodejs)
bash ~/.asdf/plugins/nodejs/bin/import-release-team-keyring

# Install Node.js 20.18.1 if not already installed
if ! asdf list nodejs | grep -q "20.18.1"; then
  echo "Installing Node.js 20.18.1 via asdf..."
  asdf install nodejs 20.18.1
fi

# Set Node.js 20.18.1 as global
asdf global nodejs 20.18.1

# Ensure npm is available
if ! command -v npm &>/dev/null; then
  echo "Error: npm not found after installing Node.js with asdf."
  exit 1
fi

# Install ts-node and typescript globally
npm install -g ts-node typescript

# Run setup.ts using ts-node
echo "Running setup.ts with ts-node..."
ts-node setup.ts