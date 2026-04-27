const fs = require('fs');

let html = fs.readFileSync('admin.html', 'utf8');

// Replace the productModal HTML
const modalRegex = /<!-- MODAL \(Product Add\/Edit\) -->[\s\S]*?(?=<!-- MODAL \(Party Create\/Edit\) -->)/;

const newModalHTML = `<!-- MODAL (Product Add/Edit) -->
    <div id="productModal" class="hidden" style="position: fixed; inset: 0; background: rgba(0,0,0,0.92); backdrop-filter: blur(16px); display: flex; align-items: center; justify-content: center; z-index: 2000;">
        <div class="glass-card" style="width: 1050px; max-height: 95vh; overflow-y: auto; margin: 0; padding: 0; border-top: 4px solid var(--primary); display: flex; flex-direction: column;">
            <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
                <div>
                    <div style="font-size:0.55rem;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:var(--primary);margin-bottom:4px;opacity:0.9;">INVENTORY MASTER</div>
                    <div style="font-size:1.2rem;font-weight:800;color:#f8fafc;letter-spacing:-0.03em;">📦 Manage Product Record</div>
                </div>
                <button type="button" class="btn btn-ghost" onclick="closeProductModal()" style="padding:6px 14px;font-size:0.75rem;opacity:0.8;">✕ Close</button>
            </div>
            <form id="productForm" onsubmit="saveProduct(event)" style="display: flex; flex-direction: column; flex: 1;">
                <input type="hidden" id="prod-id">
                
                <div style="padding: 2rem; display: flex; flex-direction: column; gap: 2rem;">
                    
                    <!-- SECTION 1: CORE DETAILS -->
                    <div>
                        <h4 style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;"><span style="color: var(--primary);">●</span> Core Identifiers</h4>
                        <div style="background: rgba(15,23,42,0.3); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); display: grid; gap: 1.25rem;">
                            <div style="display: grid; grid-template-columns: 2fr 1.5fr 1fr; gap: 1.25rem;">
                                <div class="form-group" style="margin:0;"><label style="margin-bottom:0.4rem;">Product Name</label><input type="text" id="prod-name" required></div>
                                <div class="form-group" style="margin:0;"><label style="margin-bottom:0.4rem;">Manufacturer</label><input type="text" id="prod-manufacturer" placeholder="Mfg Company"></div>
                                <div class="form-group" style="margin:0;"><label style="margin-bottom:0.4rem;">HSN Code</label><input type="text" id="prod-hsn" list="hsn-list"></div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.25rem;">
                                <div class="form-group" style="margin:0;"><label style="margin-bottom:0.4rem;">Category</label><input type="text" id="prod-cat" list="category-list"></div>
                                <div class="form-group" style="margin:0;"><label style="margin-bottom:0.4rem;">Product Group</label><input type="text" id="prod-group" list="group-list"></div>
                                <div class="form-group" style="margin:0;"><label style="margin-bottom:0.4rem;">Packing</label><input type="text" id="prod-packing" placeholder="10x10" required></div>
                            </div>
                        </div>
                    </div>

                    <!-- SECTION 2: PRICING & BATCHES -->
                    <div style="display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem;">
                        <!-- Defaults Panel -->
                        <div style="background: rgba(15,23,42,0.3); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
                            <h4 style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1rem;">Default Pricing & Scheme</h4>
                            <div style="display: grid; gap: 1.25rem;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                                    <div class="form-group" style="margin:0;"><label style="margin-bottom:0.4rem;">MRP</label><input type="number" id="prod-mrp" step="0.01" required></div>
                                    <div class="form-group" style="margin:0;"><label style="margin-bottom:0.4rem;">GST %</label><input type="number" id="prod-gst" list="gst-rate-list" value="12"></div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                                    <div class="form-group" style="margin:0;"><label style="margin-bottom:0.4rem;">PTR</label><input type="number" id="prod-ptr" step="0.01"></div>
                                    <div class="form-group" style="margin:0;"><label style="margin-bottom:0.4rem;">PTS</label><input type="number" id="prod-pts" step="0.01"></div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 1.25rem; margin-top: 0.25rem;">
                                    <div class="form-group" style="margin:0;"><label style="margin-bottom:0.4rem;">Bonus Buy (X)</label><input type="number" id="prod-buy" placeholder="10"></div>
                                    <div class="form-group" style="margin:0;"><label style="margin-bottom:0.4rem;">Free (Y)</label><input type="number" id="prod-get" placeholder="1"></div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Batch Engine -->
                        <div style="background: rgba(99, 102, 241, 0.05); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(99,102,241,0.15); display: flex; flex-direction: column;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <h4 style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary);">Batch Inventory Engine</h4>
                                <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); background: rgba(0,0,0,0.3); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">Total Qty: <span id="prod-total-qty-display" style="color: var(--accent); font-size: 1rem; margin-left: 5px; font-weight: 900;">0</span></div>
                                <input type="hidden" id="prod-qty" value="0">
                            </div>
                            
                            <!-- Batch Table -->
                            <div style="flex: 1; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; overflow: hidden; background: rgba(0,0,0,0.2);">
                                <table style="width: 100%; font-size: 0.75rem; border-collapse: collapse;">
                                    <thead style="background: rgba(255,255,255,0.05);">
                                        <tr>
                                            <th style="padding: 10px 12px; text-align: left; color: var(--text-muted); border-bottom: 1px solid rgba(255,255,255,0.1);">Batch No</th>
                                            <th style="padding: 10px 12px; text-align: center; color: var(--text-muted); border-bottom: 1px solid rgba(255,255,255,0.1);">Exp (MM/YY)</th>
                                            <th style="padding: 10px 12px; text-align: right; color: var(--text-muted); border-bottom: 1px solid rgba(255,255,255,0.1);">MRP</th>
                                            <th style="padding: 10px 12px; text-align: right; color: var(--text-muted); border-bottom: 1px solid rgba(255,255,255,0.1);">PTS</th>
                                            <th style="padding: 10px 12px; text-align: right; color: var(--text-muted); border-bottom: 1px solid rgba(255,255,255,0.1);">PTR</th>
                                            <th style="padding: 10px 12px; text-align: center; color: var(--text-muted); border-bottom: 1px solid rgba(255,255,255,0.1);">Qty</th>
                                            <th style="padding: 10px 12px; text-align: center; color: var(--text-muted); border-bottom: 1px solid rgba(255,255,255,0.1);">Act</th>
                                        </tr>
                                    </thead>
                                    <tbody id="prod-batch-tbody">
                                        <!-- Batches will be rendered here -->
                                    </tbody>
                                    <tfoot style="background: rgba(255,255,255,0.02); border-top: 1px solid rgba(255,255,255,0.1);">
                                        <tr>
                                            <td style="padding: 8px;"><input type="text" id="new-batch-no" placeholder="B.No" style="padding: 6px 8px; font-size: 0.75rem; background: rgba(0,0,0,0.5);"></td>
                                            <td style="padding: 8px;"><input type="text" id="new-batch-exp" placeholder="MM/YY" style="padding: 6px 8px; font-size: 0.75rem; text-align: center; background: rgba(0,0,0,0.5);"></td>
                                            <td style="padding: 8px;"><input type="number" id="new-batch-mrp" step="0.01" placeholder="MRP" style="padding: 6px 8px; font-size: 0.75rem; text-align: right; background: rgba(0,0,0,0.5);"></td>
                                            <td style="padding: 8px;"><input type="number" id="new-batch-pts" step="0.01" placeholder="PTS" style="padding: 6px 8px; font-size: 0.75rem; text-align: right; background: rgba(0,0,0,0.5);"></td>
                                            <td style="padding: 8px;"><input type="number" id="new-batch-ptr" step="0.01" placeholder="PTR" style="padding: 6px 8px; font-size: 0.75rem; text-align: right; background: rgba(0,0,0,0.5);"></td>
                                            <td style="padding: 8px;"><input type="number" id="new-batch-qty" placeholder="Qty" style="padding: 6px 8px; font-size: 0.75rem; text-align: center; background: rgba(0,0,0,0.5);"></td>
                                            <td style="padding: 8px; text-align: center;"><button type="button" onclick="addProductBatch()" class="btn btn-primary" style="padding: 6px 12px; font-size: 0.7rem; border-radius: 6px;">+ ADD</button></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="padding: 1.5rem 2rem; background: rgba(255,255,255,0.02); border-top: 1px solid var(--glass-border); display: flex; justify-content: flex-end; gap: 1rem; margin-top: auto;">
                    <button type="button" class="btn btn-ghost" onclick="closeProductModal()" style="border-radius: 12px; font-size: 0.8rem; font-weight: 700;">CANCEL</button>
                    <button type="submit" class="btn btn-primary" style="padding-left: 2.5rem; padding-right: 2.5rem; border-radius: 12px; font-size: 0.8rem;">SAVE PRODUCT</button>
                </div>
            </form>
        </div>
    </div>

`;

html = html.replace(modalRegex, newModalHTML);
fs.writeFileSync('admin.html', html);
console.log("HTML Patched!");

let script = fs.readFileSync('admin-script.js', 'utf8');

const batchEngineCode = `
let currentProductBatches = [];

function renderProductBatches() {
    const tbody = document.getElementById('prod-batch-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let totalQty = 0;
    
    if (currentProductBatches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 1.5rem; color: rgba(255,255,255,0.3); font-style: italic;">No batches added yet.</td></tr>';
    } else {
        currentProductBatches.forEach((b, i) => {
            totalQty += Number(b.qtyAvailable || 0);
            tbody.innerHTML += \`
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: 0.2s;">
                    <td style="padding: 8px 12px; font-weight: 700; color: #fff;">\${b.batchNo}</td>
                    <td style="padding: 8px 12px; text-align: center;">\${b.expDate || '-'}</td>
                    <td style="padding: 8px 12px; text-align: right;">₹\${Number(b.mrp||0).toFixed(2)}</td>
                    <td style="padding: 8px 12px; text-align: right;">₹\${Number(b.pts||0).toFixed(2)}</td>
                    <td style="padding: 8px 12px; text-align: right;">₹\${Number(b.ptr||0).toFixed(2)}</td>
                    <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: var(--accent); background: rgba(16, 185, 129, 0.05);">\${b.qtyAvailable}</td>
                    <td style="padding: 8px 12px; text-align: center;"><button type="button" class="btn btn-ghost" style="padding: 4px 8px; border-radius: 6px; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);" onclick="removeProductBatch(\${i})">✕</button></td>
                </tr>
            \`;
        });
    }
    
    document.getElementById('prod-total-qty-display').textContent = totalQty;
    document.getElementById('prod-qty').value = totalQty;
}

function addProductBatch() {
    const bNo = document.getElementById('new-batch-no').value;
    if (!bNo) return alert('Batch Number is required');
    
    const bExp = document.getElementById('new-batch-exp').value;
    const bMrp = document.getElementById('new-batch-mrp').value;
    const bPts = document.getElementById('new-batch-pts').value;
    const bPtr = document.getElementById('new-batch-ptr').value;
    const bQty = document.getElementById('new-batch-qty').value;
    
    currentProductBatches.push({
        batchNo: bNo.toUpperCase(),
        expDate: bExp,
        mrp: Number(bMrp || document.getElementById('prod-mrp').value || 0),
        pts: Number(bPts || document.getElementById('prod-pts').value || 0),
        ptr: Number(bPtr || document.getElementById('prod-ptr').value || 0),
        qtyAvailable: Number(bQty || 0)
    });
    
    document.getElementById('new-batch-no').value = '';
    document.getElementById('new-batch-exp').value = '';
    document.getElementById('new-batch-mrp').value = '';
    document.getElementById('new-batch-pts').value = '';
    document.getElementById('new-batch-ptr').value = '';
    document.getElementById('new-batch-qty').value = '';
    
    renderProductBatches();
}

function removeProductBatch(i) {
    currentProductBatches.splice(i, 1);
    renderProductBatches();
}
`;

// Inject the batch engine code at the top, below global vars
script = script.replace('let allProducts = [];', 'let allProducts = [];\n' + batchEngineCode);

// Update openProductModal
script = script.replace(/function openProductModal\(\) {[\s\S]*?}/, \`function openProductModal() {
    document.getElementById('productForm').reset();
    document.getElementById('prod-id').value = '';
    currentProductBatches = [];
    renderProductBatches();
    document.getElementById('productModal').classList.remove('hidden');
}\`);

// Update editProduct
script = script.replace(/function editProduct\(id\) {[\s\S]*?document\.getElementById\('productModal'\)\.classList\.remove\('hidden'\);\n}/, \`function editProduct(id) {
    const p = allProducts.find(x => x._id === id);
    if (!p) return;
    document.getElementById('prod-id').value = p._id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-manufacturer').value = p.manufacturer || '';
    document.getElementById('prod-hsn').value = p.hsn || '';
    document.getElementById('prod-cat').value = p.category;
    document.getElementById('prod-group').value = p.group || '';
    document.getElementById('prod-packing').value = p.packing || '';
    document.getElementById('prod-mrp').value = p.mrp;
    document.getElementById('prod-gst').value = p.gstPercent;
    document.getElementById('prod-ptr').value = p.ptr;
    document.getElementById('prod-pts').value = p.pts;
    document.getElementById('prod-qty').value = p.qtyAvailable;
    document.getElementById('prod-buy').value = p.bonusScheme ? p.bonusScheme.buy : 0;
    document.getElementById('prod-get').value = p.bonusScheme ? p.bonusScheme.get : 0;
    
    currentProductBatches = p.batches || [];
    renderProductBatches();
    
    document.getElementById('productModal').classList.remove('hidden');
}\`);

// Update saveProduct to include batches
script = script.replace(/qtyAvailable: Number\(document\.getElementById\('prod-qty'\)\.value\),/, "qtyAvailable: Number(document.getElementById('prod-qty').value),\n        batches: currentProductBatches,");

fs.writeFileSync('admin-script.js', script);
console.log("Script Patched!");
