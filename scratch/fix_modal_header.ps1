$file = "admin.html"
$content = Get-Content $file -Raw -Encoding UTF8

$target = '<div id="return-module-badge" style="font-size:0.55rem;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-bottom:3px;">CREDIT NOTE</div>
                    <div id="return-modal-title" style="font-size:0.95rem;font-weight:700;color:#e2e8f0;letter-spacing:-0.02em;">Sale Return — Credit Note</div>'

$replacement = '<div id="return-module-badge" style="font-size:0.52rem;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:var(--accent);margin-bottom:2px;opacity:0.9;">CREDIT NOTE</div>
                    <div id="return-modal-title" style="font-size:1.05rem;font-weight:800;color:#f8fafc;letter-spacing:-0.03em;">Sale Return — Credit Note</div>'

if ($content.Contains($target)) {
    $content = $content.Replace($target, $replacement)
    Write-Host "Fixed modal title and badge."
} else {
    Write-Host "Target not found. Trying flexible match..."
    $content = $content -replace '<div id="return-module-badge".*?</div>\s*<div id="return-modal-title".*?</div>', $replacement
}

[System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.Encoding]::UTF8)
Write-Host "Done."
