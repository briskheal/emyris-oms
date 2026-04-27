$file = "admin-script.js"
$content = Get-Content $file -Raw -Encoding UTF8

# The orphaned closeReturnModal body is at:
# "    document.getElementById('returnModal').classList.add('hidden');\r\n    currentEditingNoteId = null;\r\n}\r\n\r\nlet returnRowCounter"
# We need to prepend the full block before it.

$marker = "    document.getElementById('returnModal').classList.add('hidden');"

$newCode = @'
// --- MULTI-ITEM RETURN LOGIC ---
let returnItems = [];

// Config map for all 6 return/note module types
const RETURN_MODULE_CONFIG = {
    'Salable Return':   { badge:'CREDIT NOTE (CN)',  title:'Sale Return \u2014 Credit Note',              noteType:'CN', submitLabel:'\u2713 POST RETURN & GENERATE CN',  tabs:['Salable Return','Exp/Brk/Damg CN','Price Diff CN'],   tabLabels:['Sale Return','Exp/Brk/Damg CN','Price Diff CN'] },
    'Exp/Brk/Damg CN':  { badge:'CREDIT NOTE (CN)',  title:'Exp / Broken / Damaged \u2014 Credit Note',   noteType:'CN', submitLabel:'\u2713 POST & GENERATE CN',          tabs:['Salable Return','Exp/Brk/Damg CN','Price Diff CN'],   tabLabels:['Sale Return','Exp/Brk/Damg CN','Price Diff CN'] },
    'Price Diff CN':    { badge:'CREDIT NOTE (CN)',  title:'Price Difference \u2014 Credit Note',          noteType:'CN', submitLabel:'\u2713 POST & GENERATE CN',          tabs:['Salable Return','Exp/Brk/Damg CN','Price Diff CN'],   tabLabels:['Sale Return','Exp/Brk/Damg CN','Price Diff CN'] },
    'Purchase Return':  { badge:'DEBIT NOTE (DN)',   title:'Purchase Return \u2014 Debit Note',            noteType:'DN', submitLabel:'\u2713 POST RETURN & GENERATE DN',  tabs:['Purchase Return','Price Diff DN','Brk/Dmg/Loss DN'],  tabLabels:['Purchase Return','Price Diff DN','Brk/Dmg/Loss DN'] },
    'Price Diff DN':    { badge:'DEBIT NOTE (DN)',   title:'Price Difference \u2014 Debit Note',           noteType:'DN', submitLabel:'\u2713 POST & GENERATE DN',          tabs:['Purchase Return','Price Diff DN','Brk/Dmg/Loss DN'],  tabLabels:['Purchase Return','Price Diff DN','Brk/Dmg/Loss DN'] },
    'Brk/Dmg/Loss DN': { badge:'DEBIT NOTE (DN)',   title:'Breakage / Damage / Loss \u2014 Debit Note',   noteType:'DN', submitLabel:'\u2713 POST & GENERATE DN',          tabs:['Purchase Return','Price Diff DN','Brk/Dmg/Loss DN'],  tabLabels:['Purchase Return','Price Diff DN','Brk/Dmg/Loss DN'] }
};

function openReturnModal(reason, editData = null) {
    const cfg = RETURN_MODULE_CONFIG[reason] || RETURN_MODULE_CONFIG['Salable Return'];
    currentEditingNoteId = editData ? editData._id : null;

    // Badge, title, note type, submit button
    document.getElementById('return-module-badge').innerText  = cfg.badge;
    document.getElementById('return-modal-title').innerText   = editData ? ('\u270f\ufe0f Edit: ' + editData.noteNo) : cfg.title;
    document.getElementById('return-note-type').value         = cfg.noteType;
    document.getElementById('return-reason').value            = reason;
    document.getElementById('return-submit-btn').innerHTML    = cfg.submitLabel;

    // CN = indigo, DN = red gradient
    const btn = document.getElementById('return-submit-btn');
    btn.style.background = cfg.noteType === 'CN'
        ? 'linear-gradient(135deg,#6366f1,#818cf8)'
        : 'linear-gradient(135deg,#ef4444,#f87171)';

    // Build 3-tab switcher
    const tabsEl = document.getElementById('return-action-tabs');
    tabsEl.innerHTML = cfg.tabs.map((t, i) => {
        const active = t === reason;
        const accentColor = cfg.noteType === 'CN' ? '#6366f1' : '#ef4444';
        return `<button type="button" onclick="switchReturnTab('${t}')"
            style="padding:5px 13px;border-radius:6px;font-size:0.63rem;font-weight:700;
                   letter-spacing:0.05em;border:1px solid ${active ? accentColor : 'transparent'};
                   cursor:pointer;transition:all 0.2s;
                   background:${active ? 'rgba(' + (cfg.noteType==='CN'?'99,102,241':'239,68,68') + ',0.22)' : 'transparent'};
                   color:${active ? '#fff' : '#64748b'};"
        >${cfg.tabLabels[i]}</button>`;
    }).join('');

    // Party dropdown
    const sel = document.getElementById('return-party');
    sel.innerHTML = '<option value="">\u2014 Select Party \u2014</option>' +
        allStockists.map(s => `<option value="${s._id}">${s.name} (${s.partyType || 'STOCKIST'})</option>`).join('');

    document.getElementById('returnForm').reset();
    document.getElementById('return-items-body').innerHTML = '';
    returnItems = [];

    if (editData && editData.items && editData.items.length > 0) {
        document.getElementById('return-party').value    = editData.party?._id || editData.party;
        updateNotePartyDetails(editData.party?._id || editData.party, 'return-party-info');
        document.getElementById('return-inv-no').value   = editData.refInvoiceNo  || '';
        document.getElementById('return-inv-date').value = editData.refInvoiceDate || '';
        editData.items.forEach(item => {
            const rowId = addReturnRow();
            const row   = document.getElementById(`return-row-${rowId}`);
            if (row) row.querySelector('.return-prod-select').value = item.productId;
            document.getElementById(`return-hsn-${rowId}`).value   = item.hsn      || '';
            document.getElementById(`return-batch-${rowId}`).value = item.batchNo  || '';
            // Populate MM/YY selects from stored expDate (MM/YY)
            if (item.expDate) {
                const parts = item.expDate.split('/');
                const mm = (parts[0] || '').padStart(2,'0');
                const yy = parts[1] || '';
                const fullYear = yy.length === 2 ? '20' + yy : yy;
                const mSel = document.getElementById(`return-exp-mm-${rowId}`);
                const ySel = document.getElementById(`return-exp-yy-${rowId}`);
                if (mSel) mSel.value = mm;
                if (ySel) ySel.value = fullYear;
            }
            document.getElementById(`return-qty-${rowId}`).value     = item.qty;
            document.getElementById(`return-price-${rowId}`).value   = item.price;
            document.getElementById(`return-gst-pct-${rowId}`).value = item.gstPercent;
        });
    } else {
        addReturnRow();
    }
    calculateReturnTotals();
    document.getElementById('returnModal').classList.remove('hidden');
}

function switchReturnTab(reason) {
    // Switch tabs while preserving party/invoice header
    const party   = document.getElementById('return-party').value;
    const invNo   = document.getElementById('return-inv-no').value;
    const invDate = document.getElementById('return-inv-date').value;
    openReturnModal(reason);
    if (party)   { document.getElementById('return-party').value   = party; updateNotePartyDetails(party, 'return-party-info'); }
    if (invNo)   document.getElementById('return-inv-no').value    = invNo;
    if (invDate) document.getElementById('return-inv-date').value  = invDate;
}

function closeReturnModal() {

'@

$insertIdx = $content.IndexOf($marker)
if ($insertIdx -lt 0) {
    Write-Error "Marker not found!"; exit 1
}

# Find the start of the line (go back to find the newline before it)
$lineStart = $content.LastIndexOf("`n", $insertIdx) + 1

$content = $content.Substring(0, $lineStart) + $newCode + $content.Substring($lineStart)

[System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.Encoding]::UTF8)
Write-Host "Injected successfully. New file length: $($content.Length)"
