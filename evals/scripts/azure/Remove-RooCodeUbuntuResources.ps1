# Variables (matching the deployment script)
. "$PSScriptRoot/RooCodeUbuntuVars.ps1"

# Confirmation prompt to avoid accidental deletion
$confirmation = Read-Host "Are you sure you want to delete all resources in Resource Group '$resourceGroup'? (Type 'yes' to confirm)"
if ($confirmation -ne "yes") {
    Write-Output "Deletion aborted. Exiting script."
    exit
}

# Delete the VM
Write-Output "Deleting VM: $vmName..."
az vm delete `
  --resource-group $resourceGroup `
  --name $vmName `
  --yes

# Delete the NIC
Write-Output "Deleting NIC: $nicName..."
az network nic delete `
  --resource-group $resourceGroup `
  --name $nicName

# Delete the Public IP
Write-Output "Deleting Public IP: $publicIpName..."
az network public-ip delete `
  --resource-group $resourceGroup `
  --name $publicIpName

# Delete the NSG
Write-Output "Deleting NSG: $nsgName..."
az network nsg delete `
  --resource-group $resourceGroup `
  --name $nsgName

# Delete the VNet
Write-Output "Deleting VNet: $vnetName..."
az network vnet delete `
  --resource-group $resourceGroup `
  --name $vnetName

# Delete the Resource Group (this will delete any remaining resources)
Write-Output "Deleting Resource Group: $resourceGroup..."
az group delete `
  --name $resourceGroup `
  --yes `
  --no-wait

Write-Output "Cleanup completed successfully!"