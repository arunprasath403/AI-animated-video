# One-time setup on Windows. Run in PowerShell from this folder:
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1
$ErrorActionPreference = "Continue"
function Have($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function WingetInstall($id, $name) {
  Write-Host "Installing $name ..." -ForegroundColor Cyan
  winget install --id $id -e --accept-source-agreements --accept-package-agreements
}

if (-not (Have node))   { WingetInstall "OpenJS.NodeJS.LTS" "Node.js 22 LTS" }
if (-not (Have ffmpeg)) { WingetInstall "Gyan.FFmpeg" "FFmpeg" }
$hasPy = $false
if (Have py) { py -3.12 -c "print(1)" 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { $hasPy = $true } }
if (-not $hasPy) { WingetInstall "Python.Python.3.12" "Python 3.12 (for the voice)" }

# pick up PATH changes from the installers
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# the voice model (Kokoro) runs in Python
$py = (& py -3.12 -c "import sys; print(sys.executable)").Trim()
Write-Host "Installing voice packages into $py ..." -ForegroundColor Cyan
& $py -m pip install --upgrade pip
& $py -m pip install kokoro-onnx soundfile
$env:HYPERFRAMES_PYTHON = $py

Write-Host "Installing project packages ..." -ForegroundColor Cyan
npm install

Write-Host "Downloading the render browser (Chrome headless shell) ..." -ForegroundColor Cyan
npx --no-install hyperframes browser ensure

Write-Host "Warming up the voice model (downloads Kokoro once) ..." -ForegroundColor Cyan
npx --no-install hyperframes tts "Setup complete." -v am_michael -o "$env:TEMP\c2v-test.wav"

node bin/c2v.mjs doctor
Write-Host "`nDone. Try:  .\c2v make plans\aws-vs-azure.json" -ForegroundColor Green
