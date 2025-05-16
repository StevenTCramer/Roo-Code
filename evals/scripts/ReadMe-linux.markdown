# Running Roo Benchmarks

This guide provides instructions to set up the Roo Benchmarks repository on a clean Ubuntu 25 Server, using the latest `asdf` to manage Node.js 20.18.1 and the latest `pnpm` as the package manager. It compiles TypeScript (`setup.ts`) to JavaScript for execution using the project's local `typescript` dependency.

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
Clone the latest `asdf` version by fetching the latest release tag:
```bash
git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch $(curl -s https://api.github.com/repos/asdf-vm/asdf/releases/latest | grep tag_name | cut -d '"' -f 4)
echo -e '\n. $HOME/.asdf/asdf.sh' >> ~/.bashrc
echo -e '\n. $HOME/.asdf/completions/asdf.bash' >> ~/.bashrc
source ~/.bashrc
```

Verify:
```bash
asdf --version  # Outputs the latest version (e.g., v0.16.7 or newer)
```

### 4. Install Node.js 20.18.1
Add the Node.js plugin and install version 20.18.1:
```bash
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
asdf install nodejs 20.18.1
asdf global nodejs 20.18.1
```

Verify:
```bash
node --version  # Outputs v20.18.1
npm --version   # Outputs the bundled version (e.g., 10.2.4 or newer)
```

### 5. Install `pnpm`
Install the latest `pnpm` globally using `npm`:
```bash
npm install -g pnpm@latest
```

Set up `pnpm` and update the shell:
```bash
pnpm setup
source ~/.bashrc
```

Verify:
```bash
pnpm --version  # Outputs the latest version (e.g., 10.11.0 or newer)
```

### 6. Set Up the Roo Benchmarks Repository
Clone the Roo Benchmarks repository (use your GitHub username for private repositories or SSH if required):
```bash
git clone https://github.com/RooVetGit/Roo-Code.git
cd Roo-Code/evals/scripts
```

Install dependencies:
```bash
pnpm install
```

Run the benchmarks setup:
```bash
pnpm setup
```

Follow the `setup` on-screen instructions.