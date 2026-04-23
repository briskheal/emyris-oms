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

    allProducts.forEach(p => {
        if (p.category) cats.add(p.category.toUpperCase());
        if (p.hsn) hsns.add(p.hsn);
    });

    const catList = document.getElementById('category-list');
    const hsnList = document.getElementById('hsn-list');

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
            <td>
                <button class="btn btn-ghost" style="padding: 5px 10px;" onclick="editProduct('${p._id}')">✏️</button>
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
        }
    } catch (e) { alert("Failed to save product."); }
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
            <td style="font-family:monospace; color:var(--primary);">${s.loginId}</td>
            <td>${s.address || '-'}</td>
            <td>${s.phone || '-'}</td>
            <td><span class="badge ${s.approved ? 'badge-approved' : 'badge-pending'}">${s.approved ? 'Approved' : 'Pending'}</span></td>
            <td>
                ${!s.approved ? `<button class="btn btn-primary" style="padding: 5px 12px; font-size:0.75rem;" onclick="approveStockist('${s._id}')">APPROVE</button>` : '✅ Verified'}
            </td>
        </tr>
    `).join('');
}

async function approveStockist(id) {
    if (!confirm("Are you sure you want to approve this stockist?")) return;
    try {
        const res = await fetch(`${API_BASE}/admin/stockists/${id}/approve`, { method: 'PUT' });
        const result = await res.json();
        if (result.success) {
            alert("Stockist approved successfully!");
            loadStockists();
        }
    } catch (e) { alert("Approval failed."); }
}

function logout() {
    sessionStorage.removeItem('admin_logged');
    window.location.reload();
}
