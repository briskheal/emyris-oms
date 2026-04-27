$file = "server.js"
$content = Get-Content $file -Raw -Encoding UTF8

# Find the broken payment endpoint (we removed its declaration accidentally) and restore + add PDCN block
$broken = "    try {`r`n        const payments = await Payment.find().populate('party').sort({ date: -1 });"
$brokenU = "    try {`n        const payments = await Payment.find().populate('party').sort({ date: -1 });"

$pdcnAndPayment = @'

// --- PRICE DIFF CN (PDCN) INTELLIGENCE APIs ---

// GET: Fetch per-product billed qty and already-claimed qty for a party
// Used for real-time eligibility validation in the PDCN form
app.get('/api/admin/pdcn/eligibility/:partyId', async (req, res) => {
    try {
        const { partyId } = req.params;

        // Aggregate all invoiced items for this party
        const invoices = await Invoice.find({ stockist: partyId, status: { $in: ['invoiced','approved'] } })
            .select('items');

        const billedMap = {}; // productId -> { name, totalBilledQty, invoices: [{invoiceNo, qty, price, batch}] }
        for (const inv of invoices) {
            for (const item of (inv.items || [])) {
                const pid = String(item.productId || item._id || '');
                if (!pid) continue;
                if (!billedMap[pid]) {
                    billedMap[pid] = { name: item.name, totalBilledQty: 0, invoices: [] };
                }
                billedMap[pid].totalBilledQty += (item.qty || 0);
                billedMap[pid].invoices.push({ qty: item.qty, price: item.priceUsed || item.price, batch: item.batch });
            }
        }

        // Aggregate already-claimed PDCN qty for this party
        const claimedNotes = await FinancialNote.find({ party: partyId, reason: 'Price Diff CN' })
            .select('items status');
        const claimedMap = {}; // productId -> totalClaimedQty (approved + pending)
        for (const note of claimedNotes) {
            if (note.status === 'rejected') continue; // rejected claims don't count
            for (const item of (note.items || [])) {
                const pid = String(item.productId || '');
                if (!pid) continue;
                claimedMap[pid] = (claimedMap[pid] || 0) + (item.qty || 0);
            }
        }

        // Build response with eligible qty
        const eligibility = {};
        for (const [pid, data] of Object.entries(billedMap)) {
            const claimed = claimedMap[pid] || 0;
            eligibility[pid] = {
                name: data.name,
                totalBilledQty:  data.totalBilledQty,
                totalClaimedQty: claimed,
                eligibleQty:     Math.max(0, data.totalBilledQty - claimed),
            };
        }

        res.json({ success: true, eligibility });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST: Stockist self-service PDCN claim submission
// Accessible via /pdcn-portal endpoint (stockist logs in with their credentials)
app.post('/api/stockist/pdcn-claim', async (req, res) => {
    try {
        const { stockistId, items, refInvoiceNo, refInvoiceDate } = req.body;
        if (!stockistId || !items || !items.length) return res.status(400).json({ success: false, error: 'Party and items are required.' });

        const partyObj = await Stockist.findById(stockistId);
        if (!partyObj) return res.status(404).json({ success: false, error: 'Party not found.' });

        // Eligibility check per item
        const invoices = await Invoice.find({ stockist: stockistId, status: { $in: ['invoiced','approved'] } });
        const billedMap = {};
        for (const inv of invoices) {
            for (const item of (inv.items || [])) {
                const pid = String(item.productId || '');
                if (!pid) continue;
                billedMap[pid] = (billedMap[pid] || 0) + (item.qty || 0);
            }
        }
        const claimedNotes = await FinancialNote.find({ party: stockistId, reason: 'Price Diff CN', status: { $ne: 'rejected' } });
        const claimedMap = {};
        for (const note of claimedNotes) {
            for (const item of (note.items || [])) {
                const pid = String(item.productId || '');
                claimedMap[pid] = (claimedMap[pid] || 0) + (item.qty || 0);
            }
        }

        for (const item of items) {
            const pid = String(item.productId);
            const billed  = billedMap[pid] || 0;
            const claimed = claimedMap[pid] || 0;
            const eligible = Math.max(0, billed - claimed);
            if (item.qty > eligible) {
                return res.status(400).json({
                    success: false,
                    error: `Product "${item.name}": You have claimed ${claimed} of ${billed} billed units. Only ${eligible} units are eligible for PDCN. Cannot claim ${item.qty}.`
                });
            }
        }

        const count = await FinancialNote.countDocuments({ reason: 'Price Diff CN' });
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
        const noteNo  = `PD-CN-${dateStr}-${(count+1).toString().padStart(4,'0')}`;

        const subTotal  = items.reduce((s, i) => s + (i.qty * i.priceDiff), 0);
        const gstAmount = items.reduce((s, i) => s + (i.qty * i.priceDiff * (i.gstPercent||0) / 100), 0);
        const amount    = Math.round(subTotal + gstAmount);

        const claim = new FinancialNote({
            noteNo, noteType: 'CN', party: stockistId,
            partyName: partyObj.name,
            amount, subTotal, gstAmount,
            reason: 'Price Diff CN',
            status: 'pending',  // Needs admin approval
            description: `PDCN self-claim against Inv: ${refInvoiceNo || 'N/A'}`,
            refInvoiceNo, refInvoiceDate,
            items: items.map(i => ({
                productId: i.productId, name: i.name,
                qty: i.qty, price: i.priceDiff,
                gstPercent: i.gstPercent || 0,
                totalValue: i.qty * i.priceDiff * (1 + (i.gstPercent||0)/100),
                batchNo: i.batchNo, expDate: i.expDate, hsn: i.hsn
            }))
        });
        await claim.save();

        res.json({ success: true, noteNo, message: 'Your PDCN claim has been submitted for admin approval.' });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST: Admin approve/reject PDCN claim
app.post('/api/admin/pdcn-claim/:id/review', async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'approve' or 'reject'
        const note = await FinancialNote.findById(id);
        if (!note || note.reason !== 'Price Diff CN') return res.status(404).json({ success: false });

        if (action === 'approve') {
            note.status = 'approved';
            await note.save();
            // Apply ledger impact (no inventory)
            const adj = -note.amount; // CN reduces outstanding
            await Stockist.findByIdAndUpdate(note.party, { $inc: { outstandingBalance: adj } });
            res.json({ success: true, message: 'PDCN Claim approved. CN issued to party ledger.' });
        } else {
            note.status = 'rejected';
            await note.save();
            res.json({ success: true, message: 'PDCN Claim rejected.' });
        }
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Serve PDCN Self-Service Portal
app.get('/pdcn-portal', (req, res) => {
    res.sendFile(path.join(__dirname, 'pdcn-portal.html'));
});

// --- PAYMENTS & LEDGER MODULE ---

app.get('/api/admin/payments', async (req, res) => {
'@

# Insert before the payments section
$oldPayment = "    try {`r`n        const payments = await Payment.find().populate('party').sort({ date: -1 });"
$newPayment = $pdcnAndPayment + "    try {`r`n        const payments = await Payment.find().populate('party').sort({ date: -1 });"

if ($content.Contains($oldPayment)) {
    $content = $content.Replace($oldPayment, $newPayment)
    Write-Host "Replaced using CRLF"
} else {
    $oldPaymentU = "    try {`n        const payments = await Payment.find().populate('party').sort({ date: -1 });"
    $newPaymentU = ($pdcnAndPayment -replace "`r`n","`n") + "    try {`n        const payments = await Payment.find().populate('party').sort({ date: -1 });"
    $content = $content.Replace($oldPaymentU, $newPaymentU)
    Write-Host "Replaced using LF"
}

[System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.Encoding]::UTF8)
Write-Host "server.js updated. Size: $($content.Length)"
