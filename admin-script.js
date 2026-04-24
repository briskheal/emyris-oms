// EMYRIS OMS - Admin Logic
const API_BASE = '/api';
let allProducts = [];
let allStockists = [];
let allOrders = [];

// --- INITIALIZATION ---
window.onload = async () => {
    if (sessionStorage.getItem('admin_logged') !== 'true') {
        document.getElementById('adminLoginOverlay').classList.remove('hidden');
        return; // Wait for login
    }
    
    await refreshDashboard();
    await loadProducts();
    await loadStockists();
    await loadMasters();
    await loadSettings();
};

async function handleAdminLogin(e) {
    e.preventDefault();
    const adminId = document.getElementById('admin-id-input').value;
    const password = document.getElementById('admin-pass-input').value;

    try {
        const res = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId, password })
        });
        const result = await res.json();
        if (result.success) {
            sessionStorage.setItem('admin_logged', 'true');
            window.location.reload();
        } else {
            alert("Invalid Credentials");
        }
    } catch (e) { alert("Auth Error"); }
}

// --- NAVIGATION ---
function switchTab(tabId, el) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');

    document.querySelectorAll('.content > div').forEach(div => div.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
}

// --- DASHBOARD ---
async function refreshDashboard() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        updateStats();
    } catch (e) { console.error("Dashboard refresh fail"); }
}

function updateStats() {
    document.getElementById('stat-products').innerText = allProducts.length;
    document.getElementById('stat-pending').innerText = allStockists.filter(s => !s.approved).length;
    document.getElementById('stat-orders').innerText = allOrders.length;
    
    const rev = allOrders.reduce((acc, curr) => acc + (curr.subTotal || 0), 0);
    document.getElementById('stat-revenue').innerText = rev.toLocaleString('en-IN');
}

// --- PRODUCT MASTER ---
async function loadProducts() {
    try {
        const res = await fetch(`${API_BASE}/products`);
        allProducts = await res.json();
        renderProducts();
        updateStats();
        updateDatalists();
    } catch (e) { console.error("Load products fail"); }
}

function updateDatalists() {
    const cats = new Set(["TABLETS", "SYRUPS", "INJECTIONS", "CAPSULES", "SACHETS"]);
    const hsns = new Set();
    const gsts = new Set([12, 18, 5, 28]);

    // Add from existing products
    allProducts.forEach(p => {
        if (p.category) cats.add(p.category.toUpperCase());
        if (p.hsn) hsns.add(p.hsn);
        if (p.gstPercent) gsts.add(p.gstPercent);
    });

    // Add from masters (if loaded)
    if (window.masters) {
        if (window.masters.categories) window.masters.categories.forEach(c => cats.add(c.name.toUpperCase()));
        if (window.masters.hsns) window.masters.hsns.forEach(h => hsns.add(h.code));
        if (window.masters.gst) window.masters.gst.forEach(g => gsts.add(g.rate));
    }

    const catList = document.getElementById('category-list');
    const hsnList = document.getElementById('hsn-list');
    const gstInput = document.getElementById('prod-gst');

    if (catList) {
        catList.innerHTML = Array.from(cats).map(c => `<option value="${c}"></option>`).join('');
    }
    if (hsnList) {
        hsnList.innerHTML = Array.from(hsns).map(h => `<option value="${h}"></option>`).join('');
    }
}

function renderProducts() {
    const tbody = document.getElementById('productTableBody');
    tbody.innerHTML = allProducts.map(p => `
        <tr>
            <td style="font-weight: 700;">${p.name}</td>
            <td style="font-family: monospace;">${p.hsn || '-'}</td>
            <td>₹${p.mrp}</td>
            <td style="color:var(--accent); font-weight:700;">₹${p.ptr}</td>
            <td>₹${p.pts}</td>
            <td>${p.gstPercent}%</td>
            <td>${p.qtyAvailable}</td>
            <td><span class="badge ${p.active ? 'badge-approved' : 'badge-pending'}">${p.active ? 'Active' : 'Inactive'}</span></td>
            <td style="white-space: nowrap;">
                <button class="btn btn-ghost" style="padding: 5px 10px;" onclick="editProduct('${p._id}')" title="Edit">✏️</button>
                <button class="btn btn-ghost" style="padding: 5px 10px; color: #ef4444; border-color: rgba(239, 68, 68, 0.2);" onclick="deleteProduct('${p._id}')" title="Delete">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function openProductModal() {
    document.getElementById('productForm').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('productModal').classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('productModal').classList.add('hidden');
}

async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const data = {
        name: document.getElementById('prod-name').value,
        hsn: document.getElementById('prod-hsn').value,
        category: document.getElementById('prod-cat').value,
        mrp: Number(document.getElementById('prod-mrp').value),
        gstPercent: Number(document.getElementById('prod-gst').value),
        ptr: Number(document.getElementById('prod-ptr').value),
        pts: Number(document.getElementById('prod-pts').value),
        qtyAvailable: Number(document.getElementById('prod-qty').value),
        bonusScheme: {
            buy: Number(document.getElementById('prod-buy').value),
            get: Number(document.getElementById('prod-get').value)
        }
    };

    try {
        const url = id ? `${API_BASE}/admin/products/${id}` : `${API_BASE}/admin/products`;
        const res = await fetch(url, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert("Product saved successfully!");
            closeProductModal();
            loadProducts();
        } else {
            alert("Failed to save: " + (result.error || result.message || "Unknown error"));
        }
    } catch (e) { 
        console.error("Save error:", e);
        alert("Failed to save product. Check console for details."); 
    }
}

async function deleteProduct(id) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
        const res = await fetch(`${API_BASE}/admin/products/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            alert("Product deleted successfully!");
            loadProducts();
        } else {
            alert("Delete failed: " + (result.message || "Unknown error"));
        }
    } catch (e) { alert("Failed to delete product."); }
}

function editProduct(id) {
    const p = allProducts.find(x => x._id === id);
    if (!p) return;
    document.getElementById('prod-id').value = p._id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-hsn').value = p.hsn || '';
    document.getElementById('prod-cat').value = p.category;
    document.getElementById('prod-mrp').value = p.mrp;
    document.getElementById('prod-gst').value = p.gstPercent;
    document.getElementById('prod-ptr').value = p.ptr;
    document.getElementById('prod-pts').value = p.pts;
    document.getElementById('prod-qty').value = p.qtyAvailable;
    document.getElementById('prod-buy').value = p.bonusScheme ? p.bonusScheme.buy : 0;
    document.getElementById('prod-get').value = p.bonusScheme ? p.bonusScheme.get : 0;
    document.getElementById('productModal').classList.remove('hidden');
}

// --- BULK PRODUCT UPLOAD ---
function downloadProductTemplate() {
    const headers = [
        ["Product Name*", "HSN Code", "Category", "MRP", "PTR", "PTS", "GST %", "Qty Available", "Bonus Buy", "Bonus Get"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "Emyris_Product_Template.xlsx");
}

async function handleProductBulkUpload(input) {
    const file = input.files[0];
    if (!file) return;

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (!jsonData.length) throw new Error("File is empty.");

        const products = jsonData.map(row => ({
            name: row["Product Name*"],
            hsn: row["HSN Code"],
            category: row["Category"],
            mrp: row["MRP"],
            ptr: row["PTR"],
            pts: row["PTS"],
            gstPercent: row["GST %"],
            qtyAvailable: row["Qty Available"],
            buy: row["Bonus Buy"],
            get: row["Bonus Get"]
        }));

        const res = await fetch(`${API_BASE}/admin/products/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products })
        });

        const result = await res.json();
        if (result.success) {
            alert(`Bulk upload complete! Success: ${result.results.success}, Failed: ${result.results.failed}`);
            loadProducts();
        }
    } catch (e) { alert("Bulk upload failed: " + e.message); }
    input.value = '';
}

// --- MASTERS & SETTINGS ---
window.masters = { categories: [], hsns: [], gst: [] };

async function loadMasters() {
    try {
        const [cats, hsns, gst] = await Promise.all([
            fetch(`${API_BASE}/admin/categories`).then(r => r.json()),
            fetch(`${API_BASE}/admin/hsns`).then(r => r.json()),
            fetch(`${API_BASE}/admin/gst`).then(r => r.json())
        ]);
        window.masters = { categories: cats, hsns: hsns, gst: gst };
        renderMasterLists();
        updateDatalists();
    } catch (e) { console.error("Load masters fail"); }
}

function renderMasterLists() {
    const render = (id, list, key, type) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = list.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:rgba(255,255,255,0.05); border-radius:8px; margin-bottom:5px; font-size:0.85rem;">
                <span>${item[key]}</span>
                <button style="background:none; border:none; color:#ef4444; cursor:pointer;" onclick="deleteMaster('${type}', '${item._id}')">✕</button>
            </div>
        `).join('');
    };
    render('master-cat-list', window.masters.categories, 'name', 'categories');
    render('master-hsn-list', window.masters.hsns, 'code', 'hsns');
    render('master-gst-list', window.masters.gst, 'rate', 'gst');
}

async function addMaster(type) {
    let val = "";
    let body = {};
    if (type === 'categories') {
        val = document.getElementById('new-cat-name').value;
        body = { name: val };
    } else if (type === 'hsns') {
        val = document.getElementById('new-hsn-code').value;
        body = { code: val };
    } else if (type === 'gst') {
        val = document.getElementById('new-gst-rate').value;
        body = { rate: Number(val) };
    }

    if (!val) return alert("Please enter a value");
    try {
        const res = await fetch(`${API_BASE}/admin/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            document.getElementById(`new-${type.slice(0,-1).replace('categorie','cat')}-${type==='gst'?'rate':(type==='hsns'?'code':'name')}`).value = '';
            loadMasters();
        }
    } catch (e) { alert("Add master failed"); }
}

async function deleteMaster(type, id) {
    if (!confirm("Delete this master entry?")) return;
    try {
        await fetch(`${API_BASE}/admin/${type}/${id}`, { method: 'DELETE' });
        loadMasters();
    } catch (e) { alert("Delete failed"); }
}

async function loadSettings() {
    try {
        const res = await fetch(`${API_BASE}/admin/settings`);
        const s = await res.json();
        document.getElementById('set-name').value = s.name || '';
        document.getElementById('set-web').value = s.website || '';
        document.getElementById('set-phone').value = s.phones ? s.phones[0] : '';
        document.getElementById('set-address').value = s.address || '';
        document.getElementById('set-admin-email').value = s.adminEmail || '';
        if (document.getElementById('set-stockist-counter')) {
            document.getElementById('set-stockist-counter').value = s.stockistCounter || 0;
        }

        // Footer population
        if (document.getElementById('footer-co-name')) document.getElementById('footer-co-name').innerText = s.name || 'EMYRIS OMS';
        if (document.getElementById('footer-co-address')) document.getElementById('footer-co-address').innerText = s.address || '';
        if (document.getElementById('footer-co-web')) document.getElementById('footer-co-web').innerText = s.website || '';
        
        if (s.scrollingMessage) {
            document.getElementById('set-msg-text').value = s.scrollingMessage.text || '';
            document.getElementById('set-msg-color').value = s.scrollingMessage.color || '#6366f1';
            document.getElementById('set-msg-speed').value = s.scrollingMessage.speed || 30;
        }
    } catch (e) { console.error("Load settings fail"); }
}

async function saveSettings(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('set-name').value,
        website: document.getElementById('set-web').value,
        phones: [document.getElementById('set-phone').value],
        address: document.getElementById('set-address').value,
        adminEmail: document.getElementById('set-admin-email').value,
        stockistCounter: Number(document.getElementById('set-stockist-counter').value),
        scrollingMessage: {
            text: document.getElementById('set-msg-text').value,
            color: document.getElementById('set-msg-color').value,
            speed: Number(document.getElementById('set-msg-speed').value)
        }
    };

    try {
        const res = await fetch(`${API_BASE}/admin/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) alert("Settings updated successfully!");
    } catch (e) { alert("Save settings failed"); }
}

// --- STOCKIST MANAGEMENT ---
async function loadStockists() {
    try {
        const res = await fetch(`${API_BASE}/admin/stockists`);
        allStockists = await res.json();
        renderStockists();
        updateStats();
    } catch (e) { console.error("Load stockists fail"); }
}

function renderStockists() {
    const tbody = document.getElementById('stockistTableBody');
    if (!tbody) return;
    tbody.innerHTML = allStockists.map(s => `
        <tr>
            <td style="font-weight:700;">${s.name}</td>
            <td style="font-family:monospace; color:var(--primary);">
                ${s.loginId}
                ${s.stockistCode ? `<div style="color:var(--accent); font-size:0.7rem; margin-top:4px;">CODE: ${s.stockistCode}</div>` : ''}
            </td>
            <td>
                <div style="font-size:0.8rem;">DL: ${s.dlNo || '-'}</div>
                <div style="font-size:0.8rem;">GST: ${s.gstNo || '-'}</div>
                <div style="font-size:0.8rem;">FSSAI: ${s.fssaiNo || '-'}</div>
            </td>
            <td>${s.address || '-'}</td>
            <td>${s.phone || '-'}</td>
            <td><span class="badge ${s.approved ? 'badge-approved' : 'badge-pending'}">${s.approved ? 'Approved' : 'Pending'}</span></td>
            <td>
                ${!s.approved ? `<button class="btn btn-primary" style="padding: 5px 12px; font-size:0.75rem; margin-right:5px;" onclick="approveStockist('${s._id}')">APPROVE</button>` : '<span style="color:var(--accent); margin-right:10px;">✅ Verified</span>'}
                <button class="btn btn-ghost" style="padding: 5px 10px; color: #ef4444; border-color: rgba(239, 68, 68, 0.2);" onclick="deleteStockist('${s._id}')" title="Delete Stockist">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function approveStockist(id) {
    // Removed confirm() for better automation and faster workflow
    try {
        console.log("Attempting approval for ID:", id);
        const res = await fetch(`${API_BASE}/admin/stockists/${id}/approve`, { method: 'PUT' });
        const result = await res.json();
        if (result.success) {
            console.log("Approval Success:", result.stockist.name);
            alert("Stockist approved successfully!");
            loadStockists();
        } else {
            alert("Approval failed: " + result.message);
        }
    } catch (e) { 
        console.error("Approval error:", e);
        alert("Approval failed."); 
    }
}

async function deleteStockist(id) {
    if (!confirm("Are you sure you want to delete this stockist record?")) return;
    try {
        const res = await fetch(`${API_BASE}/admin/stockists/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            alert("Stockist record deleted.");
            loadStockists();
        }
    } catch (e) { alert("Delete failed."); }
}

async function deleteAllStockists() {
    const code = prompt("Type 'DELETE ALL' to confirm wiping all stockist records from the database:");
    if (code !== 'DELETE ALL') return;
    
    try {
        const res = await fetch(`${API_BASE}/admin/stockists-bulk/all`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            alert(result.message);
            loadStockists();
        }
    } catch (e) { alert("Master delete failed."); }
}

function logout() {
    sessionStorage.removeItem('admin_logged');
    window.location.reload();
}
