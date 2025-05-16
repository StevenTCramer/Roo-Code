# Running Roo Benchmarks

This guide provides instructions to set up the Roo Benchmarks repository on a clean Ubuntu 25 Server, using `asdf` v0.16.7 to manage Node.js 20.18.1 and `pnpm` 10.11.0. It compiles TypeScript (`setup.ts`) to JavaScript for execution using the project's local `typescript` dependency.

## Prerequisites
- Clean Ubuntu 25 Server installation.
- Non-root user with `sudo` privileges.
- Internet access for downloading packages.

## Installation Steps

### 1. Update the System
Update and upgrade system packages:
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Dependencies
Install tools required for `asdf` and Node.js:
```bash
sudo apt install -y curl git build-essential libssl-dev zlib1g-dev
```

### 3. Install `asdf`
Create a `bin` directory in your home folder for the `asdf` binary:
```bash
mkdir -p ~/bin
```

Download the `asdf` v0.16.7 binary archive for your system’s architecture (use `uname -m` to check; typically `x86_64` for Ubuntu 25 Server):
```bash
if [ "$(uname -m)" = "x86_64" ]; then
  curl -L https://github.com/asdf-vm/asdf/releases/download/v0.16.7/asdf-v0.16.7-linux-amd64.tar.gz -o ~/bin/asdf.tar.gz
else
  curl -L https://github.com/asdf-vm/asdf/releases/download/v0.16.7/asdf-v0.16.7-linux-arm64.tar.gz -o ~/bin/asdf.tar.gz
fi
tar -xzf ~/bin/asdf.tar.gz -C ~/bin
rm ~/bin/asdf.tar.gz
```

Set the `ASDF_DATA_DIR` environment variable and add `asdf` shims and binary to your `PATH`:
```bash
echo 'export ASDF_DATA_DIR="$HOME/.asdf"' >> ~/.bashrc
echo 'export PATH="$ASDF_DATA_DIR/shims:$HOME/bin:$PATH"' >> ~/.bashrc
echo '. "$ASDF_DATA_DIR/asdf.sh"' >> ~/.bashrc
source ~/.bashrc
```

Verify:
```bash
asdf --version  # Outputs v0.16.7
```

### 4. Install Node.js 20.18.1
Add the Node.js plugin and install version 20.18.1:
```bash
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
asdf install nodejs 20.18.1
asdf set -u nodejs 20.18.1
```

Verify:
```bash
node --version  # Outputs v20.18.1
npm --version   # Outputs the bundled version (e.g., 10.2.4 or newer)
```

### 5. Install `pnpm`
Add the `pnpm` plugin and install version 10.11.0:
```bash
asdf plugin add pnpm https://github.com/jonathanmorley/asdf-pnpm.git
asdf install pnpm 10.11.0
asdf set -u pnpm 10.11.0
```

Set up `pnpm` to configure its binary path and update the shell:
```bash
pnpm setup
source ~/.bashrc
```

Verify:
```bash
pnpm --version  # Outputs 10.11.0
```

### 6. Set Up the Roo Benchmarks Repository
Clone the Roo Benchmarks repository (use your GitHub username for private repositories or SSH if required):
```bash
git clone https://github.com/StevenTCramer/Roo-Code.git
cd Roo-Code/evals/scripts
```

Install dependencies:
```bash
pnpm install
```

Run the benchmarks setup:
```bash
pnpm run setup
```

Follow the `setup` on-screen instructions.