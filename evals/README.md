# Roo Benchmark (Evals) Setup

This repository contains the setup scripts for the Roo Benchmark (Evals) project, which requires specific runtimes (Node.js 20.18.1, Python 3.13.2, Go 1.24.2, Rust 1.85.1, Java openjdk-17, .NET 8.0.401) and tools (`pnpm`, GitHub CLI, `uv`). The setup is cross-platform, supporting Windows, macOS, and Linux.

## Prerequisites

- **Windows**: Windows 10 (build 1809 or later) or Windows 11.
- **macOS**: macOS 10.15 (Catalina) or later.
- **Linux**: Ubuntu 20.04 or compatible distribution (other distributions may require adjusted package manager commands).
- **Internet Access**: Required for downloading runtimes, tools, and cloning the repository.
- **Git**: Required for repository cloning (installed automatically on macOS/Linux if missing).
- **OpenRouter API Key**: Obtain from [OpenRouter](https://openrouter.ai) (starts with `sk-or-v1-`).

## Setup Instructions

### Clone the Repository

1. Open a terminal (macOS/Linux) or PowerShell (Windows).
2. Clone the repository:
    ```bash
    git clone https://github.com/RooVetGit/Roo-Code.git
    ```
3. Navigate to the `evals/` directory:
    ```bash
    cd Roo-Code/evals
    ```

### Windows

1. In PowerShell, run the setup script:
    ```powershell
    .\scripts\setup.ps1
    ```
2. Follow prompts:
    - Select runtimes to install.
    - Enter your OpenRouter API key.
    - Choose whether to build the Roo Code extension or start the web app.

The script installs NVM for Windows (via `winget`), Node.js 20.18.1, `pnpm`, and runs the main setup.

### macOS/Linux

1. In a terminal, make the script executable:
    ```bash
    chmod +x scripts/setup.sh
    ```
2. Run the setup script:
    ```bash
    ./scripts/setup.sh
    ```
3. Follow prompts:
    - Select runtimes to install.
    - Enter your OpenRouter API key.
    - Choose whether to build the Roo Code extension or start the web app.

The script installs NVM, Node.js 20.18.1, `pnpm`, and runs the main setup. PowerShell Core is installed automatically if needed.

## What the Setup Does

- Installs Node.js 20.18.1 using NVM (macOS/Linux) or NVM for Windows (Windows).
- Installs PowerShell Core (macOS/Linux, if missing).
- Installs package managers (`winget` for Windows, Homebrew for macOS, `apt` for Linux).
- Installs runtimes and tools:
    - Windows: Uses `winget` for Python, Go, Rust, Java, .NET, `pnpm`, GitHub CLI; `pip` for `uv`.
    - macOS/Linux: Uses `asdf` for Python, Go, Rust, Java, .NET, `pnpm`, GitHub CLI, `uv`.
- Configures Visual Studio Code with required extensions.
- Sets up the `.env` file with your OpenRouter API key.
- Syncs the database and optionally starts the web app.
- Optionally builds the Roo Code VS Code extension.

## Notes

- **Node.js Version**: The evals require Node.js 20.18.1, automatically installed by the scripts using NVM (macOS/Linux) or\*NVM for Windows (Windows).
- **NVM Usage**: Use `nvm list` and `nvm use 20.18.1` (macOS/Linux) or `nvm list` and `nvm use 20.18.1` (Windows) to manage Node.js versions manually.
- **Linux Distributions**: The script assumes Ubuntu. For other distributions (e.g., CentOS, Arch), you may need to modify `setup.sh` or `setup.ts` for package manager commands.
- **Troubleshooting**: If `winget` fails to find exact versions, it falls back to the latest. Check `runtimes.json` (Windows) or `.tool-versions` (macOS/Linux) for installed versions.

For issues, open a GitHub issue in the `RooVetGit/Roo-Code` repository.
