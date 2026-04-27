$file = "server.js"
$content = Get-Content $file -Raw -Encoding UTF8

$broken = "        totalValue: Number`n    }],`n`n`n// 8. Payments"
$fixed  = "        totalValue: Number`n    }],`n    subTotal:   Number,`n    gstAmount:  Number,`n    status: { type: String, enum: ['active','pending','approved','rejected'], default: 'active' },`n    createdAt: { type: Date, default: Date.now }`n});`n`n// 8. Payments"

if ($content.Contains($broken)) {
    $content = $content.Replace($broken, $fixed)
    Write-Host "Fixed"
} else {
    # Find and show what's around line 374
    $lines = $content -split "`n"
    Write-Host "Lines 372-378:"
    for ($i = 371; $i -lt [Math]::Min(378,$lines.Count); $i++) {
        Write-Host "$($i+1): $($lines[$i])"
    }
}

[System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.Encoding]::UTF8)
Write-Host "Done. Size: $($content.Length)"
