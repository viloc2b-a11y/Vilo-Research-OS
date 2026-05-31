$ErrorActionPreference = "Stop"

$trackedFiles = git ls-files validation-corpus/inbox/ validation-corpus/raw/

if ($trackedFiles) {
    Write-Host "CRITICAL SAFETY VIOLATION DETECTED!" -ForegroundColor Red
    Write-Host "The following raw/confidential documents are currently tracked by Git:" -ForegroundColor Red
    Write-Host "----------------------------------------------------------------------"
    $trackedFiles | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
    Write-Host "----------------------------------------------------------------------"
    Write-Host "ACTION REQUIRED: You must immediately untrack these files using:" -ForegroundColor Red
    Write-Host "git rm --cached -r validation-corpus/inbox/ validation-corpus/raw/" -ForegroundColor Red
    Write-Host "Raw clinical documents must NEVER be committed to version control." -ForegroundColor Red
    exit 1
} else {
    Write-Host "SAFETY CHECK PASSED." -ForegroundColor Green
    Write-Host "No files from validation-corpus/inbox/ or validation-corpus/raw/ are tracked by Git." -ForegroundColor Green
    exit 0
}
