$ErrorActionPreference = "Stop"

$csvPath = "validation-corpus\metadata\processed-originals-archive-plan.csv"
$processedDir = "validation-corpus\raw\processed-originals"

if (-Not (Test-Path $csvPath)) {
    Write-Error "Archival plan CSV not found at $csvPath"
    exit 1
}

if (-Not (Test-Path $processedDir)) {
    New-Item -ItemType Directory -Force -Path $processedDir | Out-Null
}

$plan = Import-Csv $csvPath

$successCount = 0
$failCount = 0

foreach ($row in $plan) {
    if ($row.Action -eq "ARCHIVE_ORIGINAL") {
        $sourcePath = $row.OriginalPath
        $targetPath = $row.RecommendedArchivePath
        
        $sourcePath = $sourcePath -replace "/", "\"

        if (Test-Path $sourcePath) {
            Move-Item -Path $sourcePath -Destination $targetPath -Force
            Write-Host "Archived: $sourcePath -> $targetPath" -ForegroundColor Green
            $successCount++
        } else {
            # Try finding the file by name in the inbox recursively
            $fileName = Split-Path $sourcePath -Leaf
            $found = Get-ChildItem -Path "validation-corpus\inbox" -Recurse -Filter $fileName | Select-Object -First 1
            if ($found) {
                Move-Item -Path $found.FullName -Destination $targetPath -Force
                Write-Host "Archived (found recursively): $($found.FullName) -> $targetPath" -ForegroundColor Green
                $successCount++
            } else {
                # Check if it's already in processed-originals
                if (Test-Path $targetPath) {
                    Write-Host "Already archived: $targetPath" -ForegroundColor Green
                    $successCount++
                } else {
                    Write-Host "Warning: File not found: $sourcePath" -ForegroundColor Yellow
                    $failCount++
                }
            }
        }
    }
}

Write-Host "`nArchival Execution Complete." -ForegroundColor Cyan
Write-Host "Successfully archived: $successCount"
if ($failCount -gt 0) {
    Write-Host "Failed to archive: $failCount" -ForegroundColor Red
}
