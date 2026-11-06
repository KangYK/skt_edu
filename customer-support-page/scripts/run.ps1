param([ValidateSet('demo','live','setup','recover','test','backup')][string]$Mode='demo')
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$nodeCommand=Get-Command node -ErrorAction SilentlyContinue
if($nodeCommand){$portalNode=$nodeCommand.Source}else{
 $portalNode=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
 if(!(Test-Path -LiteralPath $portalNode)){throw 'Node.js 24 이상을 설치한 뒤 다시 실행해 주세요.'}
}
switch($Mode){
 'demo' { & $portalNode server/index.mjs --demo }
 'live' { & $portalNode --env-file-if-exists=.env server/index.mjs }
 'setup' { & $portalNode --env-file-if-exists=.env scripts/setup.mjs }
 'recover' { & $portalNode --env-file-if-exists=.env scripts/setup.mjs --recover }
 'test' { & $portalNode --test tests/portal.test.mjs }
 'backup' { & $portalNode --env-file-if-exists=.env scripts/backup.mjs }
}
exit $LASTEXITCODE
