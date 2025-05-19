# Shared variables for RooCode Ubuntu Azure resources

. "$PSScriptRoot/Get-PublicIP.ps1"

# Variables you might want to change
$resourceGroup = "RooCodeUbuntuRG"
$location = "centralindia"
$vmSize = "Standard_D4s_v3"

# The github account and branch you want to use (Change this only if you are working on updates to the automation scripts)
$githubUser = "StevenTCramer"
$githubBranch = "Cramer/2025-05-13/windows-evals"


# Shared variables for RooCode Ubuntu Azure resources that you should not need to change
$vmName = "RooCodeVM"
$publicIpName = "RooCodePublicIp"
$vnetName = "RooCodeVNet"
$nsgName = "RooCodeNSG"
$nicName = "RooCodeNIC"