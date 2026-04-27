$file = "admin-script.js"
$content = Get-Content $file -Raw -Encoding UTF8

$broken = "await generateStandardPDF({`r`n`r`n            subTitle:"
$brokenU = "await generateStandardPDF({`n`n            subTitle:"

$titleLogic = @'
        const reasonTitles = {
            'Salable Return':   'CREDIT NOTE (SALES RETURN)',
            'Exp/Brk/Damg CN':  'CREDIT NOTE (EXP/BRK/DAMG)',
            'Price Diff CN':    'CREDIT NOTE (PRICE DIFFERENCE)',
            'Purchase Return':  'DEBIT NOTE (PURCHASE RETURN)',
            'Price Diff DN':    'DEBIT NOTE (PRICE DIFFERENCE)',
            'Brk/Dmg/Loss DN':  'DEBIT NOTE (BRK/DMG/LOSS)'
        };
        const pdfTitle = reasonTitles[note.reason] || (isCN ? "CREDIT NOTE" : "DEBIT NOTE");

        await generateStandardPDF({
            title: pdfTitle,
'@

if ($content.Contains($broken)) {
    $content = $content.Replace($broken, $titleLogic)
    Write-Host "Fixed PDF title logic."
} elseif ($content.Contains($brokenU)) {
    $content = $content.Replace($brokenU, ($titleLogic -replace "`r`n","`n"))
    Write-Host "Fixed PDF title logic (LF)."
} else {
    Write-Host "Marker not found. Manually fixing downloadNotePDF..."
    $idx = $content.IndexOf("async function downloadNotePDF(id) {")
    if ($idx -ge 0) {
        # Find the await generateStandardPDF
        $genIdx = $content.IndexOf("await generateStandardPDF({", $idx)
        if ($genIdx -gt $idx) {
            # Find the first line after it that starts with title:
            $titleStart = $content.IndexOf("title:", $genIdx)
            $subTitleStart = $content.IndexOf("subTitle:", $genIdx)
            
            $newPart = @'
        const reasonTitles = {
            'Salable Return':   'CREDIT NOTE (SALES RETURN)',
            'Exp/Brk/Damg CN':  'CREDIT NOTE (EXP/BRK/DAMG)',
            'Price Diff CN':    'CREDIT NOTE (PRICE DIFFERENCE)',
            'Purchase Return':  'DEBIT NOTE (PURCHASE RETURN)',
            'Price Diff DN':    'DEBIT NOTE (PRICE DIFFERENCE)',
            'Brk/Dmg/Loss DN':  'DEBIT NOTE (BRK/DMG/LOSS)'
        };
        const pdfTitle = reasonTitles[note.reason] || (isCN ? "CREDIT NOTE" : "DEBIT NOTE");

        await generateStandardPDF({
            title: pdfTitle,
'@
            # Replace from genIdx to subTitleStart
            $content = $content.Substring(0, $genIdx) + $newPart + "            " + $content.Substring($subTitleStart)
        }
    }
}

[System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.Encoding]::UTF8)
Write-Host "Done."
