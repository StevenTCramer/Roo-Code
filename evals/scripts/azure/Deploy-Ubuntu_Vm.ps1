# Variables
$resourceGroup = "RooCodeBenchmarkRG"
$location = "centralindia"
$vmName = "RooCodeVM"
$vmSize = "Standard_D4s_v3"
$adminUser = "roocodeuser"
$adminPassword = Get-Secret -Name VmAdminPassword -AsPlainText  # Retrieve the password securely
$image = "Canonical:Ubuntu-24_04-lts:Ubuntu-pro:latest"  # Ubuntu 24.04 LTS Pro image
$publicIpName = Get-PublicIP  # Using your custom command to get the public IP name
$vnetName = "RooCodeVNet"
$subnetName = "RooCodeSubnet"
$nsgName = "RooCodeNSG"
$nicName = "RooCodeNIC"
$scriptUrl = "https://raw.githubusercontent.com/StevenTCramer/Roo-Code/refs/heads/Cramer/2025-05-13/windows-evals/evals/scripts/setup-benchmarks.sh"  # Updated script URL

# Create a resource group
az group create --name $resourceGroup --location $location

# Create a virtual network and subnet
az network vnet create `
  --resource-group $resourceGroup `
  --name $vnetName `
  --address-prefix 10.0.0.0/16 `
  --subnet-name $subnetName `
  --subnet-prefix 10.0.1.0/24

# Create a network security group (NSG)
az network nsg create `
  --resource-group $resourceGroup `
  --name $nsgName

# Create NSG rules to allow SSH (port 22) and RDP (port 3389)
az network nsg rule create `
  --resource-group $resourceGroup `
  --nsg-name $nsgName `
  --name AllowSSH `
  --priority 1000 `
  --protocol Tcp `
  --destination-port-range 22 `
  --access Allow `
  --direction Inbound

az network nsg rule create `
  --resource-group $resourceGroup `
  --nsg-name $nsgName `
  --name AllowRDP `
  --priority 1010 `
  --protocol Tcp `
  --destination-port-range 3389 `
  --access Allow `
  --direction Inbound

# Create a public IP address
az network public-ip create `
  --resource-group $resourceGroup `
  --name $publicIpName `
  --sku Standard `
  --allocation-method Static

# Create a network interface (NIC) and associate it with the subnet, NSG, and public IP
az network nic create `
  --resource-group $resourceGroup `
  --name $nicName `
  --vnet-name $vnetName `
  --subnet $subnetName `
  --network-security-group $nsgName `
  --public-ip-address $publicIpName

# Create the VM
az vm create `
  --resource-group $resourceGroup `
  --name $vmName `
  --size $vmSize `
  --image $image `
  --admin-username $adminUser `
  --admin-password $adminPassword `
  --nics $nicName `
  --location $location `
  --authentication-type password

# Install XFCE desktop environment, XRDP, Brave Browser, and download/execute the custom script
az vm extension set `
  --resource-group $resourceGroup `
  --vm-name $vmName `
  --name CustomScript `
  --publisher Microsoft.Azure.Extensions `
  --settings "{'commandToExecute': 'curl -fsSL $scriptUrl -o /tmp/setup-benchmarks.sh && chmod +x /tmp/setup-benchmarks.sh && /tmp/setup-benchmarks.sh'}"

# Open the VM ports for SSH and RDP
az vm open-port `
  --resource-group $resourceGroup `
  --name $vmName `
  --port 22 `
  --priority 1100

az vm open-port `
  --resource-group $resourceGroup `
  --name $vmName `
  --port 3389 `
  --priority 1110

# Get the public IP address of the VM
$publicIp = az network public-ip show `
  --resource-group $resourceGroup `
  --name $publicIpName `
  --query ipAddress `
  --output tsv

Write-Output "VM created successfully!"
Write-Output "SSH into the VM using: ssh $adminUser@$publicIp"
Write-Output "RDP into the VM using the IP: $publicIp with username $adminUser and password retrieved from Get-Secret"
