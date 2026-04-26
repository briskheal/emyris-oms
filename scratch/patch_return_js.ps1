$file = "admin-script.js"
$content = Get-Content $file -Raw -Encoding UTF8

# ── Define the new JS block ────────────────────────────────────────────────────
$newBlock = @'
// --- MULTI-ITEM RETURN LOGIC ---
let returnItems = [];

// Module config: reason -> { badge, title, noteType, submitLabel, tabs }
const RETURN_MODULE_CONFIG = {
    'Salable Return':    { badge:'CREDIT NOTE (CN)', title:'Sale Return — Credit Note',           noteType:'CN', submitLabel:'✓ POST RETURN & GENERATE CN',    tabs:['Salable Return','Exp/Brk/Damg CN','Price Diff CN'],    tabLabels:['Sale Return CN','Exp/Brk/Damg CN','Price Diff CN'] },
    'Exp/Brk/Damg CN':  { badge:'CREDIT NOTE (CN)', title:'Exp / Broken / Damaged — Credit Note', noteType:'CN', submitLabel:'✓ POST & GENERATE CN',             tabs:['Salable Return','Exp/Brk/Damg CN','Price Diff CN'],    tabLabels:['Sale Return CN','Exp/Brk/Damg CN','Price Diff CN'] },
    'Price Diff CN':     { badge:'CREDIT NOTE (CN)', title:'Price Difference — Credit Note',       noteType:'CN', submitLabel:'✓ POST & GENERATE CN',             tabs:['Salable Return','Exp/Brk/Damg CN','Price Diff CN'],    tabLabels:['Sale Return CN','Exp/Brk/Damg CN','Price Diff CN'] },
    'Purchase Return':   { badge:'DEBIT NOTE (DN)',  title:'Purchase Return — Debit Note',         noteType:'DN', submitLabel:'✓ POST RETURN & GENERATE DN',    tabs:['Purchase Return','Price Diff DN','Brk/Dmg/Loss DN'],  tabLabels:['Purchase Return DN','Price Diff DN','Brk/Dmg/Loss DN'] },
    'Price Diff DN':     { badge:'DEBIT NOTE (DN)',  title:'Price Difference — Debit Note',        noteType:'DN', submitLabel:'✓ POST & GENERATE DN',             tabs:['Purchase Return','Price Diff DN','Brk/Dmg/Loss DN'],  tabLabels:['Purchase Return DN','Price Diff DN','Brk/Dmg/Loss DN'] },
    'Brk/Dmg/Loss DN':  { badge:'DEBIT NOTE (DN)',  title:'Breakage / Damage / Loss — Debit Note',noteType:'DN', submitLabel:'✓ POST & GENERATE DN',             tabs:['Purchase Return','Price Diff DN','Brk/Dmg/Loss DN'],  tabLabels:['Purchase Return DN','Price Diff DN','Brk/Dmg/Loss DN'] }
};

function openReturnModal(reason, editData = null) {
    const cfg = RETURN_MODULE_CONFIG[reason] || RETURN_MODULE_CONFIG['Salable Return'];
    currentEditingNoteId = editData ? editData._id : null;

    // Set badge, title, note type, submit label
    document.getElementById('return-module-badge').innerText = cfg.badge;
    document.getElementById('return-modal-title').innerText  = editData ? `✏️ Edit: ${editData.noteNo}` : cfg.title;
    document.getElementById('return-note-type').value  = cfg.noteType;
    document.getElementById('return-reason').value     = reason;
    document.getElementById('return-submit-btn').innerHTML = cfg.submitLabel;
    
    // CN = indigo gradient, DN = red gradient
    const submitBtn = document.getElementById('return-submit-btn');
    submitBtn.style.background = cfg.noteType === 'CN'
        ? 'linear-gradient(135deg,#6366f1,#818cf8)'
        : 'linear-gradient(135deg,#ef4444,#f87171)';

    // Build 3-tab switcher
    const tabsEl = document.getElementById('return-action-tabs');
    tabsEl.innerHTML = cfg.tabs.map((t, i) => `
        <button type="button" onclick="switchReturnTab('${t}')"
            id="rtab-${t.replace(/[^a-zA-Z]/g,'')}"
            style="padding:5px 12px; border-radius:6px; font-size:0.63rem; font-weight:700;
                   letter-spacing:0.05em; border:none; cursor:pointer; transition:all 0.2s;
                   background:${t===reason ? (cfg.noteType==='CN'?'rgba(99,102,241,0.25)':'rgba(239,68,68,0.25)') : 'transparent'};
                   color:${t===reason ? '#fff' : '#64748b'};
                   border:1px solid ${t===reason ? (cfg.noteType==='CN'?'rgba(99,102,241,0.5)':'rgba(239,68,68,0.4)') : 'transparent'};"
        >${cfg.tabLabels[i]}</button>
    `).join('');

    // Party dropdown
    const sel = document.getElementById('return-party');
    sel.innerHTML = '<option value="">— Select Party —</option>' +
        allStockists.map(s => `<option value="${s._id}">${s.name} (${s.partyType||'STOCKIST'})</option>`).join('');

    document.getElementById('returnForm').reset();
    document.getElementById('return-items-body').innerHTML = '';
    returnItems = [];

    if (editData && editData.items && editData.items.length > 0) {
        document.getElementById('return-party').value = editData.party?._id || editData.party;
        updateNotePartyDetails(editData.party?._id || editData.party, 'return-party-info');
        document.getElementById('return-inv-no').value   = editData.refInvoiceNo  || '';
        document.getElementById('return-inv-date').value = editData.refInvoiceDate || '';
        editData.items.forEach(item => {
            const rowId = addReturnRow();
            const row   = document.getElementById(`return-row-${rowId}`);
            row.querySelector('.return-prod-select').value          = item.productId;
            document.getElementById(`return-hsn-${rowId}`).value   = item.hsn      || '';
            document.getElementById(`return-batch-${rowId}`).value = item.batchNo  || '';
            // Split expDate MM/YY into month/year selects
            const [expMM='', expYY=''] = (item.expDate || '/').split('/');
            const mSel = document.getElementById(`return-exp-mm-${rowId}`);
            const ySel = document.getElementById(`return-exp-yy-${rowId}`);
            if (mSel) mSel.value = expMM.padStart(2,'0');
            if (ySel) ySel.value = '20' + (expYY.length === 2 ? expYY : expYY.slice(-2));
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
    // Re-open same modal with new reason, preserve party + invoice header
    const party    = document.getElementById('return-party').value;
    const invNo    = document.getElementById('return-inv-no').value;
    const invDate  = document.getElementById('return-inv-date').value;
    openReturnModal(reason);
    // Restore header fields
    if (party)   { document.getElementById('return-party').value    = party;   updateNotePartyDetails(party,'return-party-info'); }
    if (invNo)   document.getElementById('return-inv-no').value    = invNo;
    if (invDate) document.getElementById('return-inv-date').value  = invDate;
}

'@

# ── Define the new addReturnRow ────────────────────────────────────────────────
$newAddReturnRow = @'
let returnRowCounter = 0;
function addReturnRow() {
    const id  = Date.now() + '-' + (returnRowCounter++);
    const row = document.createElement('tr');
    row.id    = `return-row-${id}`;
    row.style.cssText = 'border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.15s;';
    row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.025)';
    row.onmouseout  = () => row.style.background = 'transparent';

    // Month options 01-12
    const months = Array.from({length:12},(_,i)=>{const m=String(i+1).padStart(2,'0'); return `<option value="${m}">${m}</option>`;}).join('');
    // Year options current year to +5
    const curYear = new Date().getFullYear();
    const years   = Array.from({length:8},(_,i)=>{const y=curYear+i; return `<option value="${y}">${y}</option>`;}).join('');

    const cellStyle = 'padding:4px 5px;';
    const inputBase = 'width:100%;box-sizing:border-box;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.07);border-radius:5px;color:#e2e8f0;font-size:0.72rem;padding:4px 6px;transition:border-color 0.2s;';
    const selBase   = inputBase + 'cursor:pointer;';

    row.innerHTML = `
        <td style="${cellStyle}padding-left:8px;">
            <select class="return-prod-select" onchange="updateReturnRowData('${id}',this.value)" required
                style="${selBase}font-size:0.71rem;">
                <option value="">— Product —</option>
                ${allProducts.map(p=>`<option value="${p._id}">${p.name} (${p.packing})</option>`).join('')}
            </select>
        </td>
        <td style="${cellStyle}">
            <input type="text" id="return-hsn-${id}" readonly
                style="${inputBase}background:transparent;border-color:transparent;color:#64748b;font-size:0.68rem;text-align:center;">
        </td>
        <td style="${cellStyle}">
            <input type="text" id="return-batch-${id}" placeholder="Batch No"
                style="${inputBase}">
        </td>
        <td style="${cellStyle}">
            <select id="return-exp-mm-${id}" onchange="calculateReturnTotals()" style="${selBase}text-align:center;">
                <option value="">MM</option>${months}
            </select>
        </td>
        <td style="${cellStyle}">
            <select id="return-exp-yy-${id}" onchange="calculateReturnTotals()" style="${selBase}text-align:center;">
                <option value="">YY</option>${years}
            </select>
        </td>
        <td style="${cellStyle}">
            <input type="number" id="return-qty-${id}" oninput="calculateReturnTotals()" min="1" required
                style="${inputBase}width:52px;text-align:center;">
        </td>
        <td style="${cellStyle}">
            <input type="number" id="return-price-${id}" oninput="calculateReturnTotals()" step="0.01" min="0" required
                style="${inputBase}width:88px;text-align:right;font-family:monospace;">
        </td>
        <td style="${cellStyle}">
            <input type="number" id="return-gst-pct-${id}" oninput="calculateReturnTotals()" step="0.5" min="0" required
                style="${inputBase}width:46px;text-align:center;color:#fff;font-weight:700;">
        </td>
        <td style="${cellStyle}padding-right:8px;text-align:right;font-weight:800;color:#e2e8f0;font-family:monospace;font-size:0.72rem;" id="return-row-total-${id}">₹0.00</td>
        <td style="padding:4px 6px;text-align:center;">
            <button type="button" onclick="removeReturnRow('${id}')"
                style="background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:0.8rem;opacity:0.6;padding:2px 5px;border-radius:4px;transition:opacity 0.2s;"
                onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">✕</button>
        </td>
    `;
    document.getElementById('return-items-body').appendChild(row);
    returnItems.push(id);
    return id;
}

'@

# ── Replacements ───────────────────────────────────────────────────────────────
# 1. Replace the blank space where openReturnModal was
$oldSection = "// --- MULTI-ITEM RETURN LOGIC ---`r`nlet returnItems = [];`r`n`r`n`r`n`r`n`r`nfunction closeReturnModal() {"
$newSection  = $newBlock + "`r`nfunction closeReturnModal() {"
$content = $content.Replace($oldSection, $newSection)

# Try Unix line endings too
$oldSectionU = "// --- MULTI-ITEM RETURN LOGIC ---`nlet returnItems = [];`n`n`n`n`nfunction closeReturnModal() {"
$newSectionU = ($newBlock -replace "`r`n","`n") + "`nfunction closeReturnModal() {"
$content = $content.Replace($oldSectionU, $newSectionU)

# 2. Replace old addReturnRow
$oldARR = 'let returnRowCounter = 0;
function addReturnRow() {
    const id = Date.now() + ''-'' + (returnRowCounter++);
    const row = document.createElement(''tr'');
    row.id = `return-row-${id}`;
    row.innerHTML = `'

# Use index-based replacement for addReturnRow
$arrStart = $content.IndexOf('let returnRowCounter = 0;')
$arrEnd   = $content.IndexOf('function removeReturnRow(')
if ($arrStart -ge 0 -and $arrEnd -gt $arrStart) {
    $content = $content.Substring(0,$arrStart) + $newAddReturnRow + $content.Substring($arrEnd)
    Write-Host "addReturnRow replaced at $arrStart-$arrEnd"
} else {
    Write-Host "WARN: addReturnRow boundaries not found arr=$arrStart remove=$arrEnd"
}

[System.IO.File]::WriteAllText((Resolve-Path $file), $content, [System.Text.Encoding]::UTF8)
Write-Host "admin-script.js updated successfully."
