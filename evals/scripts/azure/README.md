# Azure Resource Automation Scripts

This directory contains PowerShell scripts to automate the deployment and removal of Azure resources for RooCode Ubuntu benchmarking environments.

## Prerequisites

- **Azure Account**: You must have an active Azure subscription.
- **Azure CLI**: Install the [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) and ensure you are logged in (`az login`).
- **PowerShell**: Scripts are designed for PowerShell 7+.
- **Secret for VM Admin Password**: You must have a secret named `VmAdminPassword` available to PowerShell's `Get-Secret` command.
    - You can set this up using the SecretManagement module, e.g.:
        ```powershell
        Set-Secret -Name VmAdminPassword -Secret "YourSecurePasswordHere"
        ```
- **Sufficient Azure permissions** to create and delete resource groups, VMs, networking, and related resources.

## Scripts

- **Deploy-RooCodeUbuntuResources.ps1**  
  Deploys a resource group, virtual network, network security group, public IP, NIC, and an Ubuntu VM configured for RooCode benchmarking. Installs required software and sets up the environment.

- **Remove-RooCodeUbuntuResources.ps1**  
  Removes all resources created by the deployment script, including the resource group.

- **Get-PublicIP.ps1**  
  Helper script providing the `Get-PublicIP` function, used by the deployment/removal scripts to generate unique public IP resource names.

## Usage

1. **Set your VM admin password secret** (if not already set):

    ```powershell
    Set-Secret -Name VmAdminPassword -Secret "YourSecurePasswordHere"
    ```

2. **Deploy resources**:

    ```powershell
    pwsh ./Deploy-RooCodeUbuntuResources.ps1
    ```

3. **Remove resources**:
    ```powershell
    pwsh ./Remove-RooCodeUbuntuResources.ps1
    ```

## Notes

- The scripts will create a resource group named `RooCodeUbuntuRG` by default.
- You may need to adjust variables (location, VM size, usernames, etc.) at the top of the deployment script to fit your requirements.
- The deployment script sources `Get-PublicIP.ps1` to ensure the `Get-PublicIP` function is available for all users.
- Ensure you have the necessary permissions and quotas in your Azure subscription.
