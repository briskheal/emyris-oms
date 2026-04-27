$file = "server.js"
$content = Get-Content $file -Raw -Encoding UTF8

# Fix the broken schema - find the broken section and restore it
$broken  = "        totalValue: Number`n    }],`n`n `n// 8. Payments"
$brokenR = "        totalValue: Number`r`n    }],`r`n`r`n `r`n// 8. Payments"
$fixed   = "        totalValue: Number`n    }],`n    subTotal: Number,`n    gstAmount: Number,`n    status: { type: String, enum: ['active','pending','approved','rejected'], default: 'active' },`n    createdAt: { type: Date, default: Date.now }`n});`n`n// 8. Payments"
$fixedR  = "        totalValue: Number`r`n    }],`r`n    subTotal: Number,`r`n    gstAmount: Number,`r`n    status: { type: String, enum: ['active','pending','approved','rejected'], default: 'active' },`r`n    createdAt: { type: Date, default: Date.now }`r`n});`r`n`r`n// 8. Payments"

if ($content.Contains($broken)) {
    $content = $content.Replace($broken, $fixed)
    Write-Host "Fixed LF version"
} elseif ($content.Contains($brokenR)) {
    $content = $content.Replace($brokenR, $fixedR)
    Write-Host "Fixed CRLF version"
} else {
    # Try a broader search
    $idx = $content.IndexOf("        totalValue: Number")
    if ($idx -ge 0) {
        # Find the closing }], after it
        $end = $content.IndexOf("}],", $idx)
        Write-Host "Found totalValue at $idx, }], at $end"
        Write-Host "Context: '$($content.Substring($end, [Math]::Min(200, $content.Length-$end)))'"
    }
}

[System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.Encoding]::UTF8)
Write-Host "Done. Size: $($content.Length)"
