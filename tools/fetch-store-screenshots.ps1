# Requires Python 3 and Pillow. Refresh official metadata before building local WebP previews.
$ErrorActionPreference = 'Stop'
$taskTools = $PSScriptRoot
Push-Location -LiteralPath (Split-Path -Parent $taskTools)
try {
    & python (Join-Path $taskTools 'refresh-store-screenshots.py')
    if ($LASTEXITCODE -ne 0) { throw 'Screenshot refresh failed; existing site markup was preserved.' }
    & python (Join-Path $taskTools 'update-screenshot-markup.py')
    if ($LASTEXITCODE -ne 0) { throw 'Screenshot markup update failed.' }
} finally {
    Pop-Location
}
