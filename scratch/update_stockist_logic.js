const fs = require('fs');
const path = 'd:\\MY WORK FLOW\\EMYRIS-OMS\\admin-script.js';

let content = fs.readFileSync(path, 'utf8');

const newRenderStockists = `function renderStockists(list = null) {
    const tbody = document.getElementById('stockistTableBody');
    if (!tbody) return;

    const data = list || allStockists;

    tbody.innerHTML = data.map(s => \`
        <tr>
            <td style="font-weight:600; color:#fff;">\${s.name}</td>
            <td style="font-size:0.75rem; font-weight:700; color:var(--primary);">\${s.partyType || 'STOCKIST'}</td>
            <td>\${s.city || '-'}</td>
            <td style="text-align:right; font-weight:700; color:\${s.outstandingBalance > 0 ? '#ef4444' : '#10b981'};">₹\${(s.outstandingBalance || 0).toLocaleString('en-IN')}</td>
            <td><span class="badge \${s.approved ? 'badge-approved' : 'badge-pending'}">\${s.approved ? 'APPROVED' : 'PENDING'}</span></td>
            <td style="text-align:right;">
                <button class="btn btn-ghost" style="padding:5px 10px; color:var(--primary); font-size: 0.7rem; font-weight: 800;" onclick="viewLedger('\${s._id}')">📊 LEDGER</button>
                <button class="btn btn-ghost" style="padding:5px 10px; font-size: 0.7rem; font-weight: 800;" onclick="openPartyModal('\${s._id}')">📝 EDIT</button>
                <button class="btn btn-ghost" style="padding:5px 10px; color:#ef4444;" onclick="deleteStockist('\${s._id}')">🗑️</button>
            </td>
        </tr>
    \`).join('');
}

function filterStockists(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
        renderStockists(allStockists);
        return;
    }
    const filtered = allStockists.filter(s => 
        s.name.toLowerCase().includes(q) || 
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.loginId && s.loginId.toLowerCase().includes(q))
    );
    renderStockists(filtered);
}

function clearStockistSearch() {
    document.getElementById('stockistSearch').value = '';
    renderStockists(allStockists);
}`;

// Use a more generic match for the old function to avoid encoding issues
const oldFuncRegex = /function renderStockists\(\) \{[\s\S]*?\}\n\}/;
content = content.replace(oldFuncRegex, newRenderStockists);

fs.writeFileSync(path, content, 'utf8');
console.log('Stockist functions updated.');
