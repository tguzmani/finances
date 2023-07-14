If ($args.Length -ne 2) {
  Write-Error "ERROR: Insufficent arguments"
  Write-Output "USAGE: .\Rename.ps1 [new entity name] [old entity name]"
  Exit
}

$NewEntityName=$args[0]
$OldEntityName=$args[1]

Get-ChildItem -Path "src\modules\$NewEntityName" | Rename-Item -NewName {$_.name -replace $OldEntityName, $NewEntityName}