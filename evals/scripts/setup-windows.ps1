$ErrorActionPreference = "Stop"

# === Version Variables ===
$nodeVersion = "20.18.1"

function Expand-EnvironmentVariablesRecursively($unexpanded) {
    $previous = ''
    $expanded = $unexpanded
    while($previous -ne $expanded) {
        $previous = $expanded
        $expanded = [System.Environment]::ExpandEnvironmentVariables($previous)
    }
    return $expanded
}

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
        # Reload environment variables from User and Machine scopes to ensure nvm and node are available in this session
        $UserEnv = [System.Environment]::GetEnvironmentVariables("User")
        foreach ($key in $UserEnv.Keys) {
            ${env:$key} = Expand-EnvironmentVariablesRecursively $UserEnv[$key]
        }
        $MachineEnv = [System.Environment]::GetEnvironmentVariables("Machine")
        foreach ($key in $MachineEnv.Keys) {
            ${env:$key} = Expand-EnvironmentVariablesRecursively $MachineEnv[$key]
        }
    }

    # Ensure Node.js 20.18.1 via nvm
    if (-not (Get-Command node -ErrorAction SilentlyContinue) -or (node --version) -ne "v$nodeVersion") {
        Write-Host "Installing Node.js $nodeVersion via nvm..."
        nvm install $nodeVersion
        nvm use $nodeVersion
    }

    # Verify Node.js version
    if ((node --version) -ne "v$nodeVersion") {
        Write-Error "Node.js version $nodeVersion is required. Current version: $(node --version)"
        exit 1
    }

    # Install pnpm
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Host "Installing pnpm..."
        npm install -g pnpm
    }
    
    # Always install dependencies
    Write-Host "Installing dependencies with pnpm install..."
    pnpm install --filter evals-setup

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