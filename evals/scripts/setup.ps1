$ErrorActionPreference = "Stop"

# Install nvm-windows
if (-not (Get-Command nvm -ErrorAction SilentlyContinue)) {
    Write-Host "Installing nvm-windows..."
    winget install CoreyButler.NVMforWindows --silent --accept-package-agreements
}

# Ensure Node.js 20.18.1 via nvm
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or (node --version) -ne "v20.18.1") {
    Write-Host "Installing Node.js 20.18.1 via nvm..."
    nvm install 20.18.1
    nvm use 20.18.1
}

# Verify Node.js version
if ((node --version) -ne "v20.18.1") {
    Write-Error "Node.js version 20.18.1 is required. Current version: $(node --version)"
    exit 1
}

# Install pnpm
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "Installing pnpm..."
    npm install -g pnpm
}

# Run TypeScript setup from evals/scripts/
Write-Host "Running setup script..."
cd scripts
pnpm run setup