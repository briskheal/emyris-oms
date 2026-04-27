$file = "server.js"
$content = Get-Content $file -Raw -Encoding UTF8

$broken = "app.get('/api/admin/payments', async (req, res) => {    try {"
$restoredAndNew = @'
app.get('/pdcn-portal', (req, res) => {
    res.sendFile(path.join(__dirname, 'pdcn-portal.html'));
});

// GET: Fetch notes for a specific stockist (for portal history)
app.get('/api/stockist/notes', async (req, res) => {
    try {
        const { partyId, reason } = req.query;
        const filter = { party: partyId };
        if (reason) filter.reason = reason;
        const notes = await FinancialNote.find(filter).sort({ createdAt: -1 });
        res.json(notes);
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- PAYMENTS & LEDGER MODULE ---

app.get('/api/admin/payments', async (req, res) => {
    try {
'@

if ($content.Contains($broken)) {
    $content = $content.Replace($broken, $restoredAndNew)
    Write-Host "Restored and added endpoint."
} else {
    Write-Host "Marker not found. Checking surroundings..."
    # Fallback to a broader search
    $m = "app.post('/api/admin/pdcn-claim/:id/review'"
    $idx = $content.IndexOf($m)
    if ($idx -ge 0) {
        Write-Host "Found pdcn review at $idx"
    }
}

[System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.Encoding]::UTF8)
Write-Host "Done."
