enum IPService {
    ident_me
    httpbin_org
    ipecho_net
    ifconfig_me
    checkip_amazon
    ipinfo_io
    icanhazip_com
    myexternalip_com
    ipify_org
}

function Get-IPFromService {
  param (
      [string] $ServiceKey,
      [string] $ServiceUrl
  )

  switch ($ServiceKey) {
      'httpbin_org' { return (Invoke-RestMethod -Uri $ServiceUrl).origin }
      'checkip_amazon' { return (Invoke-RestMethod -Uri $ServiceUrl).Trim() }
      'ipify_org' { return (Invoke-WebRequest -Uri $ServiceUrl).Content }
      default { return Invoke-RestMethod -Uri $ServiceUrl }
  }
}

function Get-PublicIP {
    [CmdletBinding()]
    param (
        [IPService] $ServiceName
    )

    $IpServices = @{
        [IPService]::ident_me      = 'https://v4.ident.me'
        [IPService]::httpbin_org   = 'https://httpbin.org/ip'
        [IPService]::ipecho_net    = 'https://ipecho.net/plain'
        [IPService]::ifconfig_me   = 'https://ifconfig.me/ip'
        [IPService]::checkip_amazon= 'https://checkip.amazonaws.com'
        [IPService]::ipinfo_io     = 'https://ipinfo.io/ip'
        [IPService]::icanhazip_com = 'https://icanhazip.com'
        [IPService]::myexternalip_com = 'https://myexternalip.com/raw'
        [IPService]::ipify_org     = 'https://api.ipify.org/'
    }

    if ($ServiceName) {
        if ($IpServices.ContainsKey($ServiceName)) {
            try {
                return Get-IPFromService -ServiceKey $ServiceName -ServiceUrl $IpServices[$ServiceName]
            } catch {
                Write-Output "Failed to retrieve IP from $ServiceName. Trying next service..."
            }
        } else {
            Write-Output "Service name $ServiceName not found. Trying default service..."
        }
    }

    foreach ($service in $IpServices.GetEnumerator()) {
        try {
            $ip = Get-IPFromService -ServiceKey $service.Key -ServiceUrl $service.Value
            if ($ip) { return $ip }
        } catch {
            Write-Output "Failed to retrieve IP from $($service.Key). Trying next service..."
        }
    }

    Write-Output "Failed to retrieve public IP from all services."
    return $null
}

# Usage
# Get-PublicIP
# Get-PublicIP -ServiceName ipify_org
# Get-PublicIP -ServiceName bogus
# Get-PublicIP -ServiceName myexternalip_com
# Get-PublicIP -ServiceName icanhazip_com
# Get-PublicIP -ServiceName ipinfo_io
# Get-PublicIP -ServiceName checkip_amazon
# Get-PublicIP -ServiceName ifconfig_me
# Get-PublicIP -ServiceName ipecho_net
# Get-PublicIP -ServiceName httpbin_org

# $new_ip = Get-PublicIP
# Write-Output "Public IP Address: NEW=$($new_ip)"
