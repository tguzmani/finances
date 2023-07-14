# If ($args.Length -ne 2) {
#   Write-Error "ERROR: Insufficent arguments"
#   Write-Output "USAGE: .\Rename.ps1 [new entity name] [old entity name]"
#   Exit
# }

$NewSingular=$args[0]
$NewSingularCapitalized=(Get-Culture).TextInfo.ToTitleCase($NewSingular)
$NewPlural=$args[1]
$NewPluralCapitalized=(Get-Culture).TextInfo.ToTitleCase($NewPlural)


$OldSingular=$args[2]
$OldSingularCapitalized=(Get-Culture).TextInfo.ToTitleCase($OldSingular)
$OldPlural=$args[3]
$OldPluralCapitalized=(Get-Culture).TextInfo.ToTitleCase($OldPlural)

function Replace-Content {
  $Directory="src\modules\$NewPlural"

  Get-ChildItem -Path $Directory | ForEach-Object {
    
    (Get-Content $_.FullName) -creplace $OldPluralCapitalized, $NewPluralCapitalized `
      -creplace $OldPlural, $NewPlural `
      -creplace $OldSingularCapitalized, $NewSingularCapitalized `
      -creplace $OldSingular, $NewSingular  | Set-Content $_.FullName
  }
}

Replace-Content 

