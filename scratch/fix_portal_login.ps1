$file = "pdcn-portal.html"
$content = Get-Content $file -Raw -Encoding UTF8

$broken = "    try {`n`n        if (!data.success)"
$fixed  = "    try {`n        const res  = await fetch(`${API}/api/stockist/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ loginId: user, password: pass }) });`n        const data = await res.json();`n        if (!data.success)"

if ($content.Contains($broken)) {
    $content = $content.Replace($broken, $fixed)
    Write-Host "Fixed LF version"
} else {
    Write-Host "Marker not found. Manually rewriting the login function..."
    $start = $content.IndexOf("async function doLogin()")
    $end = $content.IndexOf("async function loadEligibility()")
    if ($start -ge 0 -and $end -gt $start) {
        $newFunc = @'
async function doLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if (!user || !pass) return showErr('login-err','Enter credentials.');
    try {
        const res  = await fetch(`${API}/api/stockist/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ loginId: user, password: pass }) });
        const data = await res.json();
        if (!data.success) return showErr('login-err', data.message || 'Login failed');
        sessionParty = data.user;
        document.getElementById('loginSection').style.display   = 'none';
        document.getElementById('claimSection').style.display   = 'block';
        document.getElementById('party-name-display').innerText = sessionParty.name || sessionParty.email;
        await loadEligibility();
        await loadHistory();
    } catch(e) { showErr('login-err','Server error. Try again.'); }
}

'@
        $content = $content.Substring(0, $start) + $newFunc + $content.Substring($end)
    }
}

[System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.Encoding]::UTF8)
Write-Host "Done."
