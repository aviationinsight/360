param(
    [Parameter(Mandatory=$true)][string]$Stage,
    [Parameter(Mandatory=$true)][string]$Payload,
    [Parameter(Mandatory=$true)][string]$Launcher,
    [Parameter(Mandatory=$true)][string]$Output
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
# Stream files into the archive instead of buffering Chromium into RAM.
[System.IO.Compression.ZipFile]::CreateFromDirectory($Stage, $Payload, [System.IO.Compression.CompressionLevel]::Fastest, $false)
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework 4.x C# compiler is required on the build computer.' }
& $compiler /nologo /target:exe /platform:x64 /optimize+ "/out:$Output" /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "/win32manifest:$PSScriptRoot\Launcher.manifest" "/resource:$Payload,payload.zip" $Launcher
if ($LASTEXITCODE -ne 0) { throw "EXE compiler failed: $LASTEXITCODE" }
