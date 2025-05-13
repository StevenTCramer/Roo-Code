$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

try {
    # Install nvm-windows
    if (-not (Get-Command nvm -ErrorAction SilentlyContinue)) {
        Write-Host "Installing nvm-windows..."
        winget install CoreyButler.NVMforWindows --silent --accept-package-agreements
        # Prepend NVM_HOME to PATH so nvm is available in this session
        $nvmHome = [System.Environment]::GetEnvironmentVariable('NVM_HOME', 'User')
        if ($nvmHome -and ($env:PATH -notlike "*$nvmHome*")) {
            $env:PATH = "$nvmHome;$env:PATH"
        }
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
    pnpm run setup
}
catch {
    Write-Error "An error occurred: $_"
    exit 1
}
finally {
    Pop-Location
}