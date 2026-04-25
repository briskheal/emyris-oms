// EMYRIS OMS - Admin Logic
const API_BASE = '/api';
let allProducts = [];
let allStockists = [];
let allOrders = [];
let allInvoices = [];
let allPurchaseEntries = [];
let purchaseItems = []; // Temporary storage for new purchase entry

// --- INITIALIZATION ---
window.onload = async () => {
    if (sessionStorage.getItem('admin_logged') !== 'true') {
        document.getElementById('adminLoginOverlay').classList.remove('hidden');
        return;
    }
    
    // Load all data sequentially to ensure dependencies are met
    try {
        await loadProducts();
        await loadStockists();
        await loadOrders();
        await loadInvoices();
        await loadPurchaseEntries();
        await loadFinancialNotes();
        await loadMasters();
        await loadSettings();
        await refreshDashboard();
    } catch (e) {
        console.error("Critical Initialization Error:", e);
    }
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
function switchTab(tabId, el, subType = null) {
    // 1. Update Sidebar UI
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (el) el.classList.add('active');

    // 2. Switch Content Visibility
    document.querySelectorAll('.content > div').forEach(div => div.classList.add('hidden'));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    } else {
        console.error(`Tab ${tabId} not found`);
        return;
    }

    // 3. Trigger Data Renders
    if (tabId === 'masters') renderMasterLists();
    if (tabId === 'orders') renderOrderHistory();
    if (tabId === 'invoices') renderInvoices();
    if (tabId === 'notes') {
        renderFinancialNotes();
        if (subType) {
            // If a specific sub-type was requested (e.g. from sub-menu)
            const typeFilter = document.getElementById('note-type-filter');
            if (typeFilter) {
                typeFilter.value = subType;
                filterNotes(subType);
            }
        }
    }
    if (tabId === 'purchase') renderPurchaseEntries();
    if (tabId === 'reports') refreshInventoryVal();
}

function toggleSubmenu(id, el) {
    const submenu = document.getElementById(id);
    if (!submenu) return;
    
    const isHidden = submenu.classList.contains('hidden');
    
    // Close other submenus if any
    document.querySelectorAll('[id^="sub-"]').forEach(sub => {
        if (sub.id !== id) sub.classList.add('hidden');
    });

    if (isHidden) {
        submenu.classList.remove('hidden');
        if (el) el.classList.add('active');
    } else {
        submenu.classList.add('hidden');
        if (el) el.classList.remove('active');
    }
}

// --- DASHBOARD ---
let chartInstances = {};

async function refreshDashboard() {
    try {
        await Promise.all([loadOrders(), loadStockists(), loadProducts()]);
        
        // Update Stats
        const pendingOrders = allOrders.filter(o => o.status === 'pending');
        const approvedOrders = allOrders.filter(o => o.status === 'approved');
        
        document.getElementById('stat-orders').innerText = allOrders.length;
        document.getElementById('stat-pending').innerText = pendingOrders.length;
        document.getElementById('stat-stockists').innerText = allStockists.length;

        // Revenue (Ex. GST) calculation from approved orders
        const totalRevenue = approvedOrders.reduce((sum, o) => sum + (o.subTotal || 0), 0);
        const revenueEl = document.getElementById('stat-revenue');
        if (revenueEl) {
            revenueEl.innerText = totalRevenue.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        // Month-over-Month Logic
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const currentOrders = allOrders.filter(o => {
            const d = new Date(o.createdAt);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const previousOrders = allOrders.filter(o => {
            const d = new Date(o.createdAt);
            return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        });

        const currentTotal = currentOrders.reduce((sum, o) => sum + o.grandTotal, 0);
        const previousTotal = previousOrders.reduce((sum, o) => sum + o.grandTotal, 0);

        const growth = previousTotal === 0 ? 100 : (((currentTotal - previousTotal) / previousTotal) * 100);
        const momBadge = document.getElementById('mom-badge');
        if (momBadge) {
            momBadge.innerText = `${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth).toFixed(1)}% vs Last Month`;
            momBadge.style.background = growth >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
            momBadge.style.color = growth >= 0 ? '#10b981' : '#ef4444';
        }

        renderCharts(currentOrders, allOrders);
        updateDBStats();
    } catch (e) { console.error("Dashboard refresh fail", e); }
}

async function updateDBStats() {
    try {
        const res = await fetch(`${API_BASE}/admin/db-stats`);
        const stats = await res.json();
        
        const textEl = document.getElementById('db-usage-text');
        const barEl = document.getElementById('db-usage-bar');
        
        if (textEl) {
            textEl.innerText = `${stats.usedMB} / ${stats.capacityMB} MB (${stats.percent}%)`;
        }
        if (barEl) {
            barEl.style.width = `${stats.percent}%`;
            // Color warning if usage > 80%
            if (parseFloat(stats.percent) > 80) {
                barEl.style.background = '#ef4444';
                textEl.style.color = '#ef4444';
            }
        }
    } catch (e) { console.error("DB stats fail", e); }
}

async function loadOrders() {
    try {
        const res = await fetch(`${API_BASE}/admin/orders`);
        allOrders = await res.json();
    } catch (e) { console.error("Load orders fail"); }
}

async function loadInvoices() {
    try {
        const res = await fetch(`${API_BASE}/admin/invoices`);
        allInvoices = await res.json();
    } catch (e) { console.error("Load invoices fail"); }
}

async function loadPurchaseEntries() {
    try {
        const res = await fetch(`${API_BASE}/admin/purchase-entries`);
        allPurchaseEntries = await res.json();
    } catch (e) { console.error("Load purchases fail"); }
}

function renderCharts(currentMonthOrders, totalOrders) {
    // Destroy existing charts
    Object.values(chartInstances).forEach(chart => chart.destroy());

    // --- SALES TREND (Current Month) ---
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dailyData = Array(daysInMonth).fill(0);
    currentMonthOrders.forEach(o => {
        const day = new Date(o.createdAt).getDate();
        dailyData[day - 1] += o.grandTotal;
    });

    chartInstances.sales = new Chart(document.getElementById('salesChart'), {
        type: 'line',
        data: {
            labels: Array.from({length: daysInMonth}, (_, i) => i + 1),
            datasets: [{
                label: 'Revenue (₹)',
                data: dailyData,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#6366f1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });

    // --- TOP PRODUCTS ---
    const productCounts = {};
    totalOrders.forEach(o => {
        o.items.forEach(item => {
            productCounts[item.name] = (productCounts[item.name] || 0) + item.qty;
        });
    });
    const topProds = Object.entries(productCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);

    chartInstances.products = new Chart(document.getElementById('topProductsChart'), {
        type: 'bar',
        data: {
            labels: topProds.map(p => p[0]),
            datasets: [{
                label: 'Units Sold',
                data: topProds.map(p => p[1]),
                backgroundColor: '#818cf8',
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                y: { ticks: { color: '#94a3b8' } }
            }
        }
    });

    // --- TOP STOCKISTS ---
    const stockistSales = {};
    totalOrders.forEach(o => {
        const name = o.stockist ? o.stockist.name : 'Unknown';
        stockistSales[name] = (stockistSales[name] || 0) + o.grandTotal;
    });
    const topStockists = Object.entries(stockistSales).sort((a,b) => b[1] - a[1]).slice(0, 5);

    chartInstances.stockists = new Chart(document.getElementById('topStockistsChart'), {
        type: 'bar',
        data: {
            labels: topStockists.map(s => s[0]),
            datasets: [{
                label: 'Total Purchase (₹)',
                data: topStockists.map(s => s[1]),
                backgroundColor: '#10b981',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { ticks: { color: '#94a3b8' } }
            }
        }
    });

    // --- ORDER STATUS ---
    const statusCounts = { pending: 0, approved: 0 };
    totalOrders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

    chartInstances.status = new Chart(document.getElementById('orderStatusChart'), {
        type: 'doughnut',
        data: {
            labels: ['Pending', 'Approved'],
            datasets: [{
                data: [statusCounts.pending, statusCounts.approved],
                backgroundColor: ['#f59e0b', '#10b981'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8', font: { weight: 'bold' } } }
            },
            cutout: '70%'
        }
    });

    // --- NEW ANALYTICS: PRODUCT GROUP SHARE & GST ---
    const groupSales = { 'GROUP1': 0, 'GROUP2': 0, 'GROUP3': 0 };
    let totalTaxableBusiness = 0;
    let totalGSTAll = 0;

    totalOrders.filter(o => o.status === 'approved').forEach(o => {
        o.items.forEach(item => {
            const prod = allProducts.find(p => p._id === item.product);
            // Normalize Group Name: Remove spaces/dashes and uppercase (e.g. "Group 1" -> "GROUP1")
            let rawGroup = (prod && prod.group) ? prod.group.toUpperCase().replace(/[\s-]/g, '') : 'GENERAL';
            
            // Map common variations back to standard keys
            if (rawGroup.includes('GROUP1')) rawGroup = 'GROUP1';
            if (rawGroup.includes('GROUP2')) rawGroup = 'GROUP2';
            if (rawGroup.includes('GROUP3')) rawGroup = 'GROUP3';

            if (groupSales.hasOwnProperty(rawGroup)) {
                groupSales[rawGroup] += (item.totalValue || 0);
                
                const gstRate = prod ? (prod.gstPercent || 12) : 12;
                const itemGst = ((item.totalValue || 0) * gstRate) / 100;
                totalGSTAll += itemGst;
                totalTaxableBusiness += (item.totalValue || 0);
            }
        });
    });

    // Chart 1: Business Share (GROUP1, 2, 3 only)
    chartInstances.groupPie = new Chart(document.getElementById('groupPieChart'), {
        type: 'pie',
        data: {
            labels: ['GROUP 1', 'GROUP 2', 'GROUP 3'],
            datasets: [{
                data: [groupSales.GROUP1, groupSales.GROUP2, groupSales.GROUP3],
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b'],
                borderWidth: 2,
                borderColor: 'rgba(15, 23, 42, 0.5)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12, padding: 15 } } }
        }
    });

    // Chart 2: GST Liability vs Total Business
    chartInstances.gstBar = new Chart(document.getElementById('gstBarChart'), {
        type: 'bar',
        data: {
            labels: ['Total Taxable Business', 'GST Liability'],
            datasets: [{
                data: [totalTaxableBusiness, totalGSTAll],
                backgroundColor: ['rgba(99, 102, 241, 0.5)', 'rgba(245, 158, 11, 0.8)'],
                borderColor: ['#6366f1', '#f59e0b'],
                borderWidth: 2,
                borderRadius: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });

    const gstDisplay = document.getElementById('total-gst-display');
    if (gstDisplay) gstDisplay.innerText = `₹${totalGSTAll.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
}

// --- DATA FETCHING ---
async function loadProducts() {
    try {
        const res = await fetch(`${API_BASE}/products`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        allProducts = await res.json();
        renderProducts();
        updateDatalists();
    } catch (e) { 
        console.error("Load products fail", e);
        // Fallback to empty if fail
        allProducts = [];
    }
}

async function loadStockists(type = '') {
    try {
        const res = await fetch(`${API_BASE}/admin/stockists${type ? `?type=${type}` : ''}`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        allStockists = await res.json();
        renderStockists();
    } catch (e) { console.error("Load parties fail", e); }
}

async function loadMasters() {
    try {
        const [cats, hsns, gst, groups] = await Promise.all([
            fetch(`${API_BASE}/admin/categories`).then(r => r.json()),
            fetch(`${API_BASE}/admin/hsns`).then(r => r.json()),
            fetch(`${API_BASE}/admin/gst`).then(r => r.json()),
            fetch(`${API_BASE}/admin/groups`).then(r => r.json())
        ]);
        window.masters = { categories: cats, hsns, gst, groups };
        renderMasterLists();
        updateDatalists();
    } catch (e) { console.error("Load masters fail", e); }
}

function updateDatalists() {
    const cats = new Set(["TABLETS", "SYRUPS", "INJECTIONS", "CAPSULES", "SACHETS"]);
    const groups = new Set(["GENERAL"]);
    const hsns = new Set();
    const gsts = new Set([12, 18, 5, 28]);

    // Add from existing products
    allProducts.forEach(p => {
        if (p.category) cats.add(p.category.toUpperCase());
        if (p.group) groups.add(p.group.toUpperCase());
        if (p.hsn) hsns.add(p.hsn);
        if (p.gstPercent) gsts.add(p.gstPercent);
    });

    // Add from masters (if loaded)
    if (window.masters) {
        if (window.masters.categories) window.masters.categories.forEach(c => cats.add(c.name.toUpperCase()));
        if (window.masters.groups) window.masters.groups.forEach(g => groups.add(g.name.toUpperCase()));
        if (window.masters.hsns) window.masters.hsns.forEach(h => hsns.add(h.code));
        if (window.masters.gst) window.masters.gst.forEach(g => gsts.add(g.rate));
    }

    const catList = document.getElementById('category-list');
    const groupList = document.getElementById('group-list');
    const hsnList = document.getElementById('hsn-list');
    const gstList = document.getElementById('gst-rate-list');

    if (catList) catList.innerHTML = Array.from(cats).map(c => `<option value="${c}"></option>`).join('');
    if (groupList) groupList.innerHTML = Array.from(groups).map(g => `<option value="${g}"></option>`).join('');
    if (hsnList) hsnList.innerHTML = Array.from(hsns).map(h => `<option value="${h}"></option>`).join('');
    if (gstList) gstList.innerHTML = Array.from(gsts).map(g => `<option value="${g}"></option>`).join('');
}

function renderProducts() {
    const tbody = document.getElementById('productTableBody');
    tbody.innerHTML = allProducts.map(p => `
        <tr>
            <td style="font-weight: 700;">${p.name}</td>
            <td style="color:var(--text-muted); font-size:0.8rem;">${p.packing || '-'}</td>
            <td style="font-family: monospace;">${p.hsn || '-'}</td>
            <td>₹${p.mrp}</td>
            <td style="color:var(--accent); font-weight:700;">₹${p.ptr}</td>
            <td>₹${p.pts}</td>
            <td>${p.gstPercent}%</td>
            <td>${p.qtyAvailable}</td>
            <td><span class="badge ${p.active ? 'badge-approved' : 'badge-pending'}">${p.active ? 'Active' : 'Inactive'}</span></td>
            <td style="white-space: nowrap;">
                <button class="btn btn-ghost" style="padding: 5px 10px;" onclick="editProduct('${p._id}')" title="Edit">📝</button>
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
        group: document.getElementById('prod-group').value,
        packing: document.getElementById('prod-packing').value,
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
    document.getElementById('prod-group').value = p.group || '';
    document.getElementById('prod-packing').value = p.packing || '';
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
window.masters = { categories: [], hsns: [], gst: [], groups: [] };

async function loadMasters() {
    try {
        const [cats, hsns, gst, groups] = await Promise.all([
            fetch(`${API_BASE}/admin/categories`).then(r => r.json()),
            fetch(`${API_BASE}/admin/hsns`).then(r => r.json()),
            fetch(`${API_BASE}/admin/gst`).then(r => r.json()),
            fetch(`${API_BASE}/admin/groups`).then(r => r.json())
        ]);
        window.masters = { categories: cats, hsns, gst, groups };
        renderMasterLists();
        updateDatalists();
    } catch (e) { console.error("Load masters fail", e); }
}

function renderMasterLists() {
    const render = (id, list, key, type) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = list.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:rgba(255,255,255,0.05); border-radius:8px; margin-bottom:5px; font-size:0.85rem;">
                <span>${item[key]}</span>
                <button style="background:none; border:none; color:#ef4444; cursor:pointer;" onclick="deleteMaster('${type}', '${item._id}')">✖</button>
            </div>
        `).join('');
    };
    render('master-cat-list', window.masters.categories, 'name', 'categories');
    render('master-group-list', window.masters.groups, 'name', 'groups');
    render('master-hsn-list', window.masters.hsns, 'code', 'hsns');
    render('master-gst-list', window.masters.gst, 'rate', 'gst');
}

async function addMaster(type) {
    let val = "";
    let body = {};
    if (type === 'categories') {
        val = document.getElementById('new-cat-name').value;
        body = { name: val };
    } else if (type === 'groups') {
        val = document.getElementById('new-group-name').value;
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
        const result = await res.json();
        if (res.ok && result.success) {
            // Clear input
            const inputId = type === 'categories' ? 'new-cat-name' : 
                           type === 'groups' ? 'new-group-name' :
                           type === 'hsns' ? 'new-hsn-code' : 'new-gst-rate';
            const input = document.getElementById(inputId);
            if (input) input.value = '';
            loadMasters();
        } else {
            alert("Action Failed: " + (result.message || result.error || "Unknown error"));
        }
    } catch (e) { alert("Operation failed."); }
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
        document.getElementById('set-tollfree').value = s.tollFree || '';
        
        // Websites
        if (s.websites) {
            document.getElementById('set-web1').value = s.websites[0] || '';
            document.getElementById('set-web2').value = s.websites[1] || '';
        }
        
        // Emails
        if (s.emails) {
            document.getElementById('set-email1').value = s.emails[0] || '';
            document.getElementById('set-email2').value = s.emails[1] || '';
            document.getElementById('set-email3').value = s.emails[2] || '';
        }

        document.getElementById('set-phone').value = s.phones ? s.phones[0] : '';
        document.getElementById('set-address').value = s.address || '';
        document.getElementById('set-admin-email').value = s.adminEmail || '';

        // Legal Details
        document.getElementById('set-gst-no').value = s.gstNo || '';
        document.getElementById('set-pan-no').value = s.panNo || '';
        document.getElementById('set-dl-no').value = s.dlNo || '';
        document.getElementById('set-fssai-no').value = s.fssaiNo || '';

        // Footer population (handled by script.js in stockist, but here for completeness)
        if (document.getElementById('footer-co-name')) document.getElementById('footer-co-name').innerText = s.name || 'EMYRIS OMS';
        if (document.getElementById('footer-co-address')) document.getElementById('footer-co-address').innerText = s.address || '';
        
        if (s.scrollingMessage) {
            document.getElementById('set-msg-text').value = s.scrollingMessage.text || '';
            document.getElementById('set-msg-color').value = s.scrollingMessage.color || '#6366f1';
        }
        setInvoiceStyle(s.invoiceStyle || 'classic');
    } catch (e) { console.error("Load settings fail"); }
}

async function saveSettings(e) {
    e.preventDefault();
    const btn = document.querySelector('button[form="companyForm"]');
    if (!btn) return;
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `⏳ SAVING CONFIGURATION...`;

    const data = {
        name: document.getElementById('set-name').value,
        tollFree: document.getElementById('set-tollfree').value,
        websites: [
            document.getElementById('set-web1').value,
            document.getElementById('set-web2').value
        ].filter(v => v),
        emails: [
            document.getElementById('set-email1').value,
            document.getElementById('set-email2').value,
            document.getElementById('set-email3').value
        ].filter(v => v),
        phones: [document.getElementById('set-phone').value],
        address: document.getElementById('set-address').value,
        adminEmail: document.getElementById('set-admin-email').value,
        scrollingMessage: {
            text: document.getElementById('set-msg-text').value,
            color: document.getElementById('set-msg-color').value,
            speed: Number(document.getElementById('set-msg-speed').value)
        },
        invoiceStyle: document.getElementById('set-inv-style').value,
        gstNo:   document.getElementById('set-gst-no').value.toUpperCase(),
        panNo:   document.getElementById('set-pan-no').value.toUpperCase(),
        dlNo:    document.getElementById('set-dl-no').value,
        fssaiNo: document.getElementById('set-fssai-no').value
    };

    try {
        const res = await fetch(`${API_BASE}/admin/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) alert("✅ Settings updated successfully!");
    } catch (e) { alert("Save settings failed"); }
    finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

// --- PARTY MASTER LOGIC ---

function renderStockists(list = null) {
    const tbody = document.getElementById('stockistTableBody');
    if (!tbody) return;

    const data = list || allStockists;

    tbody.innerHTML = data.map(s => `
        <tr>
            <td style="font-weight:600; color:#fff;">${s.name}</td>
            <td style="font-size:0.75rem; font-weight:700; color:var(--primary);">${s.partyType || 'STOCKIST'}</td>
            <td>${s.city || '-'}</td>
            <td style="text-align:right; font-weight:700; color:${(s.outstandingBalance || 0) < 0 ? '#ef4444' : '#10b981'};">₹${(s.outstandingBalance || 0).toLocaleString('en-IN')}</td>
            <td><span class="badge ${s.approved ? 'badge-approved' : 'badge-pending'}">${s.approved ? 'APPROVED' : 'PENDING'}</span></td>
            <td style="text-align:right;">
                <button class="btn btn-ghost" style="padding:5px 10px; color:var(--primary); font-size: 0.7rem; font-weight: 800;" onclick="viewLedger('${s._id}')">LEDGER</button>
                <button class="btn btn-ghost" style="padding:5px 10px; font-size: 0.7rem; font-weight: 800;" onclick="openPartyModal('${s._id}')">EDIT</button>
                <button class="btn btn-ghost" style="padding:5px 10px; color:#ef4444;" onclick="deleteStockist('${s._id}')">DELETE</button>
            </td>
        </tr>
    `).join('');
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
}

function closeStockistModal() {
    document.getElementById('stockistModal').classList.add('hidden');
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

// --- ORDER HISTORY LOGIC ---
function renderOrderHistory(filter = '') {
    const tbody = document.getElementById('orderHistoryBody');
    if (!tbody) return;
    
    let filtered = allOrders;
    if (filter) {
        filtered = allOrders.filter(o => 
            o.orderNo.toLowerCase().includes(filter.toLowerCase()) || 
            (o.stockist && o.stockist.name.toLowerCase().includes(filter.toLowerCase()))
        );
    }

    tbody.innerHTML = filtered.map(o => `
        <tr>
            <td style="font-family:monospace; font-weight:700; color:var(--primary); cursor:pointer;" onclick="viewOrderDetails('${o._id}')">${o.orderNo}</td>
            <td style="font-weight:600;">${o.stockist ? o.stockist.name : 'Unknown'}</td>
            <td>${new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
            <td style="text-align:center;">${o.items.length}</td>
            <td style="text-align:right; font-weight:700;">₹${o.grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td style="text-align:center;"><span class="badge ${o.status === 'approved' ? 'badge-approved' : (o.status === 'invoiced' ? 'badge-approved' : (o.status === 'rejected' ? 'badge-pending' : 'badge-pending'))}" style="${o.status === 'rejected' ? 'background:#ef4444; color:#fff;' : (o.status === 'invoiced' ? 'background:var(--accent); color:#fff;' : '')}">${o.status.toUpperCase()}</span></td>
            <td style="text-align:right;">
                <button class="btn btn-ghost" style="padding:5px 10px;" onclick="viewOrderDetails('${o._id}')">👁️ VIEW</button>
            </td>
        </tr>
    `).join('');
}

function filterOrderHistory(val) {
    renderOrderHistory(val);
}

function viewOrderDetails(id) {
    const o = allOrders.find(x => x._id === id);
    if (!o) return;

    document.getElementById('detail-order-no').innerText = `Order #${o.orderNo}`;
    document.getElementById('detail-date').innerText = `Placed on ${new Date(o.createdAt).toLocaleString('en-GB')}`;
    document.getElementById('detail-stockist-name').innerText = o.stockist ? o.stockist.name : 'Unknown';
    document.getElementById('detail-stockist-code').innerText = o.stockistCode || 'N/A';
    
    const statusEl = document.getElementById('detail-status');
    statusEl.innerText = o.status.toUpperCase();
    statusEl.style.background = o.status === 'approved' ? '#10b981' : (o.status === 'invoiced' ? 'var(--accent)' : (o.status === 'rejected' ? '#ef4444' : '#f59e0b'));
    statusEl.style.color = '#fff';

    const itemsBody = document.getElementById('detail-items-body');
    itemsBody.innerHTML = o.items.map(item => {
        const isNegotiated = item.askingRate && item.askingRate !== item.masterRate;
        const rateStatusClass = isNegotiated ? 'price-warning' : '';
        
        return `
            <tr style="transition: all 0.2s;">
                <td style="position: sticky; left: 0; z-index: 5; background: #1e293b; font-weight: 700; color: #fff; border-right: 1px solid var(--glass-border);">${item.name}</td>
                <td style="text-align:right; color:var(--text-muted); opacity: 0.8;">₹${(item.masterRate || item.priceUsed).toFixed(2)}</td>
                <td style="text-align:right; font-weight:700; color:${isNegotiated ? '#ef4444' : '#fff'};">₹${(item.askingRate || item.priceUsed).toFixed(2)}</td>
                <td style="text-align:center; font-style:italic; font-size:0.75rem; color: #cbd5e1;">${item.negotiationNote || '-'}</td>
                <td style="text-align:center;">
                    <input type="number" step="0.01" class="final-rate-input" id="rate-${o._id}-${item._id}" 
                        value="${item.priceUsed.toFixed(2)}" 
                        style="width: 80px; background: rgba(255,255,255,0.05); border: 1px solid var(--accent); border-radius: 6px; color: var(--accent); font-weight: 800; text-align: center; padding: 4px;">
                </td>
                <td style="text-align:center; font-weight:700;">${item.qty}</td>
                <td style="text-align:center; color:var(--accent); font-weight:700;">+${item.bonusQty || 0}</td>
                <td style="text-align:right; font-weight:800; color:var(--primary); font-size: 0.9rem;">₹${item.totalValue.toFixed(2)}</td>
                <td style="text-align:center;">
                    ${o.status === 'pending' ? `
                        <div style="display:flex; gap:6px; justify-content:center;">
                            <button class="btn" style="padding:4px 8px; font-size:0.6rem; background: rgba(239, 68, 68, 0.1); color:#ef4444; border: 1px solid rgba(239, 68, 68, 0.2);" onclick="negotiateItem('${o._id}', '${item._id}', 'reject', this)" title="Revert to Master PTS">REJECT</button>
                            <button class="btn" style="padding:4px 8px; font-size:0.6rem; background: rgba(99, 102, 241, 0.1); color:var(--primary); border: 1px solid rgba(99, 102, 241, 0.2);" onclick="negotiateItem('${o._id}', '${item._id}', 'onetime', this)" title="Apply for this order only">1-TIME</button>
                            <button class="btn" style="padding:4px 8px; font-size:0.6rem; background: rgba(16, 185, 129, 0.1); color:#10b981; border: 1px solid rgba(16, 185, 129, 0.2);" onclick="negotiateItem('${o._id}', '${item._id}', 'month', this)" title="Lock for 1 Month">MONTH</button>
                            <button class="btn" style="padding:4px 8px; font-size:0.6rem; background: var(--accent); color:#fff;" onclick="negotiateItem('${o._id}', '${item._id}', 'year', this)" title="Lock for 1 Year">YEAR</button>
                        </div>
                    ` : '<span style="font-size:0.7rem; font-weight: 800; color:var(--text-muted);">🔒 LOCKED</span>'}
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('detail-subtotal').innerText = `₹${o.subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('detail-gst').innerText = `₹${o.gstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('detail-total').innerText = `₹${o.grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    const rejectBtn = document.getElementById('detail-reject-btn');
    const approveBtn = document.getElementById('detail-approve-btn');
    const deleteBtn = document.getElementById('detail-delete-btn');

    if (o.status === 'pending') {
        approveBtn.classList.remove('hidden');
        approveBtn.onclick = () => {
            if(confirm("Approve this order for billing?")) {
                approveOrder(o._id);
                closeOrderModal();
            }
        };

        rejectBtn.classList.remove('hidden');
        rejectBtn.onclick = () => {
            if(confirm("Reject this order? It will be marked as REJECTED for the stockist.")) {
                rejectOrder(o._id);
                closeOrderModal();
            }
        };
    } else {
        approveBtn.classList.add('hidden');
        rejectBtn.classList.add('hidden');
    }

    // Invoice Buttons logic
    const invoiceBtn = document.getElementById('detail-invoice-btn');
    const downloadBtn = document.getElementById('detail-download-btn');
    const inv = allInvoices.find(i => i.order === o._id || (i.order && i.order._id === o._id));

    if (o.status === 'approved') {
        invoiceBtn.style.display = 'inline-flex';
        invoiceBtn.onclick = () => generateInvoice(o._id);
        downloadBtn.style.display = 'none';
    } else if (o.status === 'invoiced') {
        invoiceBtn.style.display = 'none';
        downloadBtn.style.display = 'inline-flex';
        if (inv) downloadBtn.onclick = () => downloadInvoicePDF(inv._id);
    } else {
        invoiceBtn.style.display = 'none';
        downloadBtn.style.display = 'none';
    }

    deleteBtn.onclick = () => {
        if (confirm(`âš ï¸ CRITICAL: Are you sure you want to PERMANENTLY DELETE Order #${o.orderNo}?\n\nThis will also remove it from the Stockist's view.`)) {
            deleteOrder(o._id);
            closeOrderModal();
        }
    };

    document.getElementById('orderDetailModal').classList.remove('hidden');
}

async function rejectOrder(id) {
    try {
        const res = await fetch(`${API_BASE}/admin/orders/${id}/reject`, { method: 'PUT' });
        const result = await res.json();
        if (result.success) {
            alert("âŒ Order rejected and marked accordingly.");
            loadOrders(); // Refresh history
        } else {
            alert("Rejection failed: " + result.message);
        }
    } catch (e) { alert("Rejection failed."); }
}

async function negotiateItem(orderId, itemId, action, btn) {
    if (!confirm(`Are you sure you want to apply the [${action.toUpperCase()}] negotiation logic to this item?`)) return;
    
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `â³`;

    const customRate = document.getElementById(`rate-${orderId}-${itemId}`).value;

    try {
        const res = await fetch(`${API_BASE}/admin/orders/${orderId}/items/${itemId}/negotiate`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, customRate })
        });
        const result = await res.json();
        if (result.success) {
            allOrders = allOrders.map(o => o._id === orderId ? result.order : o);
            viewOrderDetails(orderId);
            renderOrderHistory();
        }
    } catch (e) { alert("Negotiation failed."); }
    finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

async function approveOrder(id) {
    try {
        const res = await fetch(`${API_BASE}/admin/orders/${id}/approve`, { method: 'PUT' });
        const result = await res.json();
        if (result.success) {
            alert("✅ Order approved successfully.");
            loadOrders(); // Refresh history
        }
    } catch (e) { alert("Approval failed."); }
}

async function deleteOrder(id) {
    try {
        const res = await fetch(`${API_BASE}/admin/orders/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            alert("🗑️ Order deleted successfully.");
            loadOrders(); // Refresh history
        }
    } catch (e) { alert("Delete failed."); }
}

function closeOrderModal() {
    document.getElementById('orderDetailModal').classList.add('hidden');
}

// --- LEDGER & PAYMENTS LOGIC ---
let currentLedgerPartyId = null;

async function viewLedger(id) {
    const s = allStockists.find(x => x._id === id);
    if (!s) return;

    currentLedgerPartyId = id;
    const nameEl = document.getElementById('ledger-party-name');
    if(nameEl) nameEl.innerText = '📋 Ledger: ' + s.name;
    
    try {
        const res = await fetch('/api/admin/parties/' + id + '/ledger');
        const ledger = await res.json();
        renderLedger(ledger);
        document.getElementById('ledgerModal').classList.remove('hidden');
    } catch (e) { alert("Failed to load ledger"); }
}

function renderLedger(ledger) {
    const tbody = document.getElementById('ledgerTableBody');
    if(!tbody) return;
    let runningBalance = 0;

    tbody.innerHTML = ledger.map(entry => {
        runningBalance += (entry.debit - entry.credit);

        return '<tr>' +
                '<td>' + new Date(entry.date).toLocaleDateString('en-GB') + '</td>' +
                '<td style="font-family:monospace; font-weight:700;">' + entry.refNo + '</td>' +
                '<td><span class="badge" style="background:rgba(255,255,255,0.05); color:#fff;">' + entry.type + '</span></td>' +
                '<td style="font-size:0.85rem;">' + entry.description + '</td>' +
                '<td style="text-align:right; color:#ef4444; font-weight:700;">' + (entry.debit > 0 ? '₹' + entry.debit.toLocaleString('en-IN') : '-') + '</td>' +
                '<td style="text-align:right; color:#10b981; font-weight:700;">' + (entry.credit > 0 ? '₹' + entry.credit.toLocaleString('en-IN') : '-') + '</td>' +
                '<td style="text-align:right; font-weight:800; color:' + (runningBalance >= 0 ? 'var(--accent)' : '#10b981') + '">₹' + Math.abs(runningBalance).toLocaleString('en-IN') + ' ' + (runningBalance >= 0 ? 'Dr' : 'Cr') + '</td>' +
            '</tr>';
    }).join('');
}

function closeLedgerModal() {
    document.getElementById('ledgerModal').classList.add('hidden');
}

function openPaymentModalFromLedger() {
    if (!currentLedgerPartyId) return;
    const partyInput = document.getElementById('payment-party-id');
    if(partyInput) partyInput.value = currentLedgerPartyId;
    
    const form = document.getElementById('paymentForm');
    if(form) form.reset();
    
    const s = allStockists.find(x => x._id === currentLedgerPartyId);
    if (s) {
        document.getElementById('payment-type').value = s.partyType === 'STOCKIST' ? 'RECEIPT' : 'PAYMENT';
    }
    
    document.getElementById('payment-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('paymentModal').classList.remove('hidden');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
}

async function savePayment(e) {
    e.preventDefault();
    const data = {
        party: document.getElementById('payment-party-id').value,
        type: document.getElementById('payment-type').value,
        amount: Number(document.getElementById('payment-amount').value),
        method: document.getElementById('payment-method').value,
        refNo: document.getElementById('payment-ref').value,
        date: document.getElementById('payment-date').value
    };

    try {
        const res = await fetch('/api/admin/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert("✅ Payment recorded and Ledger updated!");
            closePaymentModal();
            if (currentLedgerPartyId) viewLedger(currentLedgerPartyId);
            loadStockists(document.getElementById('party-type-filter').value);
        }
    } catch (e) { alert("Payment record failed"); }
}

// --- INVOICE LOGIC ---
function renderInvoices() {
    const tbody = document.getElementById('invoiceTableBody');
    if (!tbody) return;

    tbody.innerHTML = allInvoices.map(inv => `
        <tr>
            <td style="font-family:monospace; font-weight:700; color:var(--accent);">${inv.invoiceNo}</td>
            <td style="font-weight:600;">${inv.stockistName}</td>
            <td>${new Date(inv.createdAt).toLocaleDateString('en-GB')}</td>
            <td style="text-align:right;">₹${inv.subTotal.toLocaleString('en-IN')}</td>
            <td style="text-align:right;">₹${inv.gstAmount.toLocaleString('en-IN')}</td>
            <td style="text-align:right; font-weight:800; color:var(--primary);">₹${inv.grandTotal.toLocaleString('en-IN')}</td>
            <td style="text-align:right;">
                <button class="btn btn-ghost" style="padding:5px 10px;" onclick="downloadInvoicePDF('${inv._id}')">📥</button>
            </td>
        </tr>
    `).join('');
}

async function generateInvoice(orderId) {
    try {
        const res = await fetch(`${API_BASE}/admin/invoices/generate/${orderId}`, { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            alert("✅ Invoice Generated Successfully!");
            await loadInvoices();
            await loadOrders();
            renderOrderHistory();
            renderInvoices();
        } else {
            alert("Generation failed: " + result.message);
        }
    } catch (e) { alert("Failed to generate invoice"); }
}

// --- PURCHASE ENTRY LOGIC ---
function renderPurchaseEntries() {
    const tbody = document.getElementById('purchaseTableBody');
    if (!tbody) return;

    tbody.innerHTML = allPurchaseEntries.map(p => `
        <tr>
            <td style="font-family:monospace; font-weight:700;">${p.purchaseNo}</td>
            <td style="font-weight:600;">${p.supplierName}</td>
            <td>${p.supplierInvoiceNo}</td>
            <td>${new Date(p.invoiceDate).toLocaleDateString('en-GB')}</td>
            <td style="text-align:center;">${p.items.length}</td>
            <td style="text-align:right; font-weight:800; color:var(--primary);">₹${p.grandTotal.toLocaleString('en-IN')}</td>
            <td style="text-align:right; white-space:nowrap;">
                <button class="btn btn-ghost" style="padding:5px 8px; font-size:1rem;" onclick="viewPurchaseDetails('${p._id}')" title="View">🔍</button>
                <button class="btn btn-ghost" style="padding:5px 8px; font-size:1rem; color:var(--primary);" onclick="editPurchaseEntry('${p._id}')" title="Edit">✏️</button>
            </td>
        </tr>
    `).join('');
}

function openPurchaseModal() {
    document.getElementById('purchaseForm').reset();
    document.getElementById('pur-id').value = ''; // Reset ID
    purchaseItems = [];
    renderPurchaseItems();
    
    // Populate Supplier Dropdown (Only show parties of type SUPPLIER)
    const select = document.getElementById('pur-supplier');
    if(select) {
        select.innerHTML = '<option value="">-- Select Supplier --</option>' + 
            allStockists.filter(s => s.partyType === 'SUPPLIER').map(s => `<option value="${s._id}">${s.name}</option>`).join('');
    }

    // Populate Product Dropdown
    const prodSelect = document.getElementById('pur-prod-select');
    if(prodSelect) {
        prodSelect.innerHTML = '<option value="">-- Select Product --</option>' + 
            allProducts.map(p => `<option value="${p._id}">${p.name}</option>`).join('');
    }

    document.getElementById('purchaseModal').classList.remove('hidden');
}

function closePurchaseModal() {
    document.getElementById('purchaseModal').classList.add('hidden');
}

function addPurchaseItem() {
    const prodId = document.getElementById('pur-prod-select').value;
    const qty = Number(document.getElementById('pur-qty').value);
    const rate = Number(document.getElementById('pur-rate').value);
    const batch = document.getElementById('pur-batch').value;
    const mfg = document.getElementById('pur-mfg').value;
    const exp = document.getElementById('pur-exp').value;
    const gstPct = Number(document.getElementById('pur-gst-pct').value);
    
    if(!prodId || qty <= 0 || rate <= 0) return alert("Please fill item details");
    
    const prod = allProducts.find(p => p._id === prodId);
    purchaseItems.push({
        product: prodId,
        name: prod.name,
        qty: qty,
        bonusQty: 0,
        purchaseRate: rate,
        batch: batch || 'N/A',
        mfgDate: mfg || 'N/A',
        expDate: exp || 'N/A',
        gstPercent: gstPct || 12,
        totalValue: qty * rate
    });
    
    renderPurchaseItems();
    // Clear line inputs
    document.getElementById('pur-qty').value = '';
    document.getElementById('pur-batch').value = '';
    document.getElementById('pur-mfg').value = '';
    document.getElementById('pur-exp').value = '';
}

function renderPurchaseItems() {
    const tbody = document.getElementById('purchase-items-body');
    if(!tbody) return;
    
    let subTotal = 0;
    let gstTotal = 0;

    tbody.innerHTML = purchaseItems.map((item, index) => {
        const gst = (item.totalValue * item.gstPercent) / 100;
        subTotal += item.totalValue;
        gstTotal += gst;
        
        return `<tr>
            <td>
                <strong>${item.name}</strong><br>
                <small style="color:var(--text-muted)">HSN: ${item.hsn || '-'}</small>
            </td>
            <td>${item.batch}</td>
            <td>${item.expDate}</td>
            <td style="text-align:center;">${item.qty}</td>
            <td style="text-align:right;">₹${item.purchaseRate.toFixed(2)}</td>
            <td style="text-align:center;">${item.gstPercent}%</td>
            <td style="text-align:right; font-weight:700;">₹${(item.totalValue + gst).toFixed(2)}</td>
            <td><button type="button" onclick="purchaseItems.splice(${index},1); renderPurchaseItems();" style="color:red; background:none; border:none; cursor:pointer;">✖</button></td>
        </tr>`;
    }).join('');

    document.getElementById('pur-subtotal').innerText = '₹' + subTotal.toLocaleString('en-IN');
    document.getElementById('pur-gst-total').innerText = '₹' + gstTotal.toLocaleString('en-IN');
    document.getElementById('pur-total').innerText = '₹' + (subTotal + gstTotal).toLocaleString('en-IN');
}

async function savePurchaseEntry(e) {
    e.preventDefault();
    if(!purchaseItems.length) return alert("Add at least one item");

    const supplierId = document.getElementById('pur-supplier').value;
    const supplier = allStockists.find(s => s._id === supplierId);

    const data = {
        supplier: supplierId,
        supplierName: supplier ? supplier.name : 'Unknown',
        supplierInvoiceNo: document.getElementById('pur-inv-no').value,
        invoiceDate: document.getElementById('pur-inv-date').value,
        lrNo: document.getElementById('pur-lr-no').value,
        lrDate: document.getElementById('pur-lr-date').value,
        transport: document.getElementById('pur-transport').value,
        paymentMode: document.getElementById('pur-payment-type').value,
        remarks: document.getElementById('pur-remarks').value,
        items: purchaseItems,
        subTotal: purchaseItems.reduce((s, i) => s + i.totalValue, 0),
        gstAmount: purchaseItems.reduce((s, i) => s + (i.totalValue * i.gstPercent / 100), 0),
        grandTotal: purchaseItems.reduce((s, i) => s + (i.totalValue * (1 + i.gstPercent / 100)), 0)
    };

    const purId = document.getElementById('pur-id').value;
    const method = purId ? 'PUT' : 'POST';
    const url = purId ? `/api/admin/purchase-entries/${purId}` : '/api/admin/purchase-entries';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert("✅ Purchase Entry Recorded & Stock Updated!");
            await loadPurchaseEntries();
            await loadProducts();
            await loadStockists();
            renderPurchaseEntries();
            closePurchaseModal();
        }
    } catch (e) { alert("Failed to save purchase"); }
}

// --- REPORTING & COMPLIANCE LOGIC ---
async function exportGSTR1() {
    const month = document.getElementById('report-month').value;
    const year = document.getElementById('report-year').value;
    
    try {
        const res = await fetch('/api/admin/reports/gstr1?month=' + month + '&year=' + year);
        const data = await res.json();
        
        if (!data.length) {
            alert("No data found for selected period.");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "GSTR1_B2B");
        XLSX.writeFile(wb, "GSTR1_Report_" + month + "_" + year + ".xlsx");
    } catch (e) { alert("Report export failed"); }
}

function refreshInventoryVal() {
    const totalVal = allProducts.reduce((sum, p) => sum + ((p.qtyAvailable || 0) * (p.pts || 0)), 0);
    const valEl = document.getElementById('report-inventory-val');
    if (valEl) {
        valEl.innerText = '₹' + totalVal.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
}

// --- MISSING UTILS & RECOVERED LOGIC ---
function updateStats() {
    const totalStockists = allStockists.length;
    const pendingOrders = allOrders.filter(o => o.status === 'pending').length;
    const totalProducts = allProducts.length;
    
    if(document.getElementById('stat-stockists')) document.getElementById('stat-stockists').innerText = totalStockists;
    if(document.getElementById('stat-pending')) document.getElementById('stat-pending').innerText = pendingOrders;
    if(document.getElementById('stat-orders')) document.getElementById('stat-orders').innerText = allOrders.length;
}

// --- FINANCIAL NOTES LOGIC ---
let allNotes = [];

async function loadFinancialNotes() {
    try {
        const res = await fetch('/api/admin/financial-notes');
        allNotes = await res.json();
    } catch (e) { console.error("Load notes fail", e); }
}

function renderFinancialNotes() {
    const tbody = document.getElementById('noteTableBody');
    if (!tbody) return;

    tbody.innerHTML = allNotes.map(n => `
        <tr>
            <td style="font-family:monospace; font-weight:700; color:${n.noteType === 'CN' ? 'var(--accent)' : '#ef4444'};">${n.noteNo}</td>
            <td><span class="badge ${n.noteType === 'CN' ? 'badge-approved' : 'badge-pending'}">${n.noteType === 'CN' ? 'CREDIT' : 'DEBIT'}</span></td>
            <td style="font-weight:600;">${n.partyName}</td>
            <td>${n.reason}</td>
            <td style="text-align:right; font-weight:800; color:${n.noteType === 'CN' ? 'var(--accent)' : '#ef4444'};">₹${n.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            <td>${new Date(n.createdAt).toLocaleDateString('en-GB')}</td>
            <td style="text-align:right;">
                <button class="btn btn-ghost" style="padding:5px 10px;" onclick="downloadNotePDF('${n._id}')">📥</button>
            </td>
        </tr>
    `).join('');
}

function openNoteModal() {
    const select = document.getElementById('note-party');
    if(select) {
        select.innerHTML = '<option value="">-- Select Party --</option>' + 
            allStockists.map(s => `<option value="${s._id}">${s.name} (${s.partyType || 'STOCKIST'})</option>`).join('');
    }
    
    const form = document.getElementById('noteForm');
    if(form) form.reset();
    document.getElementById('noteModal').classList.remove('hidden');
}

function closeNoteModal() {
    document.getElementById('noteModal').classList.add('hidden');
}

async function saveFinancialNote(e) {
    e.preventDefault();
    const data = {
        noteType: document.getElementById('note-type').value,
        party: document.getElementById('note-party').value,
        amount: Number(document.getElementById('note-amount').value),
        reason: document.getElementById('note-reason').value,
        description: document.getElementById('note-desc').value
    };

    try {
        const res = await fetch('/api/admin/financial-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert("✅ Financial Note Issued Successfully!");
            await loadFinancialNotes();
            await loadStockists();
            renderFinancialNotes();
            closeNoteModal();
        }
    } catch (e) { alert("Failed to issue note"); }
}

function downloadNotePDF(id) {
    const note = allNotes.find(x => x._id === id);
    if (!note) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setTextColor(note.noteType === 'CN' ? 16 : 239, note.noteType === 'CN' ? 185 : 68, note.noteType === 'CN' ? 129 : 68);
    doc.text(note.noteType === 'CN' ? "CREDIT NOTE" : "DEBIT NOTE", 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("EMYRIS BIOLIFESCIENCES", 20, 35);
    
    doc.text("Issued To:", 20, 50);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(note.partyName || 'N/A', 20, 57);

    doc.setFontSize(10);
    doc.text("Note No: " + note.noteNo, 140, 50);
    doc.text("Date: " + new Date(note.createdAt).toLocaleDateString('en-GB'), 140, 57);

    doc.autoTable({
        startY: 70,
        head: [['Reason/Description', 'Adjustment Amount']],
        body: [[
            `${note.reason} - ${note.description || ''}`,
            `₹ ${note.amount.toLocaleString('en-IN')}`
        ]],
        theme: 'grid',
        headStyles: { fillColor: note.noteType === 'CN' ? [16, 185, 129] : [239, 68, 68] }
    });

    doc.text("This is a financial adjustment note and does not affect physical inventory.", 20, doc.lastAutoTable.finalY + 20);
    doc.save(`Note_${note.noteNo}.pdf`);
}

// --- LEDGER RE-INTEGRATION ---
async function viewLedger(id) {
    const s = allStockists.find(x => x._id === id);
    if (!s) return;

    currentLedgerPartyId = id;
    const nameEl = document.getElementById('ledger-party-name');
    if(nameEl) nameEl.innerText = '📋 Ledger: ' + s.name;
    
    try {
        const res = await fetch('/api/admin/parties/' + id + '/ledger');
        const ledger = await res.json();
        renderLedger(ledger);
        document.getElementById('ledgerModal').classList.remove('hidden');
    } catch (e) { alert("Failed to load ledger"); }
}

function renderLedger(ledger) {
    const tbody = document.getElementById('ledgerTableBody');
    if(!tbody) return;
    let runningBalance = 0;

    tbody.innerHTML = ledger.map(entry => {
        runningBalance += (entry.debit - entry.credit);

        return `<tr>
                <td>${new Date(entry.date).toLocaleDateString('en-GB')}</td>
                <td style="font-family:monospace; font-weight:700;">${entry.refNo}</td>
                <td><span class="badge" style="background:rgba(255,255,255,0.05); color:#fff;">${entry.type}</span></td>
                <td>${entry.description}</td>
                <td style="text-align:right; color:#ef4444; font-weight:700;">${entry.debit > 0 ? '₹' + entry.debit.toLocaleString('en-IN') : '-'}</td>
                <td style="text-align:right; color:#10b981; font-weight:700;">${entry.credit > 0 ? '₹' + entry.credit.toLocaleString('en-IN') : '-'}</td>
                <td style="text-align:right; font-weight:800; color:${runningBalance >= 0 ? 'var(--accent)' : '#10b981'}">₹${Math.abs(runningBalance).toLocaleString('en-IN')} ${runningBalance >= 0 ? 'Dr' : 'Cr'}</td>
            </tr>`;
    }).join('');
}
function closeLedgerModal() {
    document.getElementById('ledgerModal').classList.add('hidden');
}

function viewPurchaseDetails(id) {
    const p = allPurchaseEntries.find(x => x._id === id);
    if (!p) return;
    
    let itemSummary = p.items.map(i => `${i.name} [Batch: ${i.batch || 'N/A'}] - Qty: ${i.qty}`).join('\n');
    alert(`🛒 PURCHASE RECORD: ${p.purchaseNo}\n----------------------------------\nSupplier: ${p.supplierName}\nInv No: ${p.supplierInvoiceNo}\nDate: ${new Date(p.invoiceDate).toLocaleDateString('en-GB')}\nLR No: ${p.lrNo || 'N/A'}\n\nITEMS:\n${itemSummary}\n----------------------------------\nGrand Total: ₹${p.grandTotal.toLocaleString('en-IN')}`);
}

function editPurchaseEntry(id) {
    const p = allPurchaseEntries.find(x => x._id === id);
    if (!p) return;

    openPurchaseModal();
    document.getElementById('pur-id').value = p._id; // Set ID
    // Fill Header
    document.getElementById('pur-supplier').value = p.supplier;
    document.getElementById('pur-inv-no').value = p.supplierInvoiceNo;
    document.getElementById('pur-inv-date').value = p.invoiceDate ? p.invoiceDate.split('T')[0] : '';
    document.getElementById('pur-lr-no').value = p.lrNo || '';
    document.getElementById('pur-lr-date').value = p.lrDate ? p.lrDate.split('T')[0] : '';
    document.getElementById('pur-payment-type').value = p.paymentMode || 'CREDIT';
    document.getElementById('pur-transport').value = p.transport || '';
    document.getElementById('pur-remarks').value = p.remarks || '';
    
    // Fill Items
    purchaseItems = p.items.map(i => ({
        product: i.product,
        name: i.name,
        qty: i.qty,
        bonusQty: i.bonusQty || 0,
        purchaseRate: i.purchaseRate,
        batch: i.batch || 'N/A',
        mfgDate: i.mfgDate || 'N/A',
        expDate: i.expDate || 'N/A',
        gstPercent: i.gstPercent || 12,
        totalValue: i.totalValue
    }));
    
    renderPurchaseItems();
    updateSupplierDetailsDisplay(p.supplier);
}

function setInvoiceStyle(style) {
    // Save to hidden input
    document.getElementById('set-inv-style').value = style;

    const styles = ['classic', 'modern', 'compact'];
    const colors = {
        classic: { border: '2px solid var(--primary)', shadow: '0 0 20px rgba(99,102,241,0.3)', bg: 'rgba(99,102,241,0.05)' },
        modern:  { border: '2px solid #10b981', shadow: '0 0 20px rgba(16,185,129,0.3)', bg: 'rgba(16,185,129,0.05)' },
        compact: { border: '2px solid #f59e0b', shadow: '0 0 20px rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.05)' }
    };

    styles.forEach(s => {
        const card = document.getElementById(`specimen-${s}`);
        const badge = document.getElementById(`check-${s}`);
        if (!card || !badge) return;

        if (s === style) {
            // Active card
            card.style.border = colors[s].border;
            card.style.boxShadow = colors[s].shadow;
            card.style.background = colors[s].bg;
            badge.style.display = 'inline';
        } else {
            // Inactive card
            card.style.border = '1px solid var(--glass-border)';
            card.style.boxShadow = 'none';
            card.style.background = 'transparent';
            badge.style.display = 'none';
        }
    });

    // Show a brief confirmation
    const labels = { classic: 'Classic Pharma', modern: 'Modern Glass', compact: 'Compact Compliance' };
    console.log(`✅ Invoice template set to: ${labels[style] || style}`);
}

function downloadInvoicePDF(id) {
    const inv = allInvoices.find(x => x._id === id);
    if (!inv) return;

    // Helper: Number to Words conversion for Indian Currency
    function numberToWords(num) {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const g = ['', 'Thousand', 'Lakh', 'Crore'];

        const makeGroup = (n) => {
            let s = '';
            if (n >= 100) {
                s += a[Math.floor(n / 100)] + 'Hundred ';
                n %= 100;
            }
            if (n >= 20) {
                s += b[Math.floor(n / 10)] + ' ';
                n %= 10;
            }
            if (n > 0) s += a[n];
            return s;
        };

        if (num === 0) return 'Zero';
        let ns = num.toString().split('.');
        let integer = parseInt(ns[0]);
        let fraction = ns[1] ? parseInt(ns[1]) : 0;
        
        let out = '';
        let i = 0;
        while (integer > 0) {
            let group;
            if (i === 0) { group = integer % 1000; integer = Math.floor(integer / 1000); }
            else { group = integer % 100; integer = Math.floor(integer / 100); }
            
            if (group > 0) out = makeGroup(group) + (g[i] ? g[i] + ' ' : '') + out;
            i++;
        }
        
        let final = 'Rupees ' + out.trim();
        if (fraction > 0) final += ' and ' + fraction + '/100 Paise';
        return final + ' Only';
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const style = companyProfile.invoiceStyle || 'classic';

    if (style === 'modern') {
        // MODERN STYLE
        doc.setFillColor(99, 102, 241); // Primary color
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.text("TAX INVOICE", 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`${companyProfile.name || 'EMYRIS BIOLIFESCIENCES'}`, 105, 30, { align: 'center' });
        doc.setTextColor(40, 44, 52);
    } else {
        // CLASSIC / COMPACT HEADER
        doc.setFontSize(style === 'compact' ? 18 : 22);
        doc.setTextColor(40, 44, 52);
        doc.text("TAX INVOICE", 105, 15, { align: 'center' });
        
        doc.setDrawColor(200);
        doc.rect(15, 10, 40, 20); 
        doc.setFontSize(8);
        doc.text("LOGO", 35, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(companyProfile.name || "EMYRIS BIOLIFESCIENCES PVT. LTD.", 140, 15);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(companyProfile.address || "Sumadhura Pragati Chambers, Park Ln, Secunderabd,", 140, 20);
        doc.text("Hyderabad, Telangana - 500003", 140, 24);
        doc.text(`DL No: TS/SEC/2023-44281, 44282`, 140, 28);
        doc.text(`GSTIN: 36AABCE1234F1Z5`, 140, 32);
        doc.text(`FSSAI: 13623011000123`, 140, 36);
    }

    doc.line(15, 40, 195, 40);

    // Invoice Meta
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Invoice No: ${inv.invoiceNo}`, 15, 48);
    doc.text(`Date: ${new Date(inv.createdAt).toLocaleDateString('en-GB')}`, 15, 53);
    
    const party = allStockists.find(s => s.name === inv.stockistName) || {};
    doc.text("BILL TO:", 110, 48);
    doc.setFont("helvetica", "normal");
    doc.text(inv.stockistName || 'N/A', 110, 53);
    doc.text(party.address || '', 110, 58, { maxWidth: 80 });
    doc.text(`GST: ${party.gst || 'N/A'} | DL: ${party.dl || 'N/A'}`, 110, 68);

    doc.autoTable({
        startY: 75,
        head: [['S.No', 'Product Description', 'HSN', 'Batch', 'Exp', 'MRP', 'Qty', 'Unit', 'Price/Unit', 'Taxable', 'GST%', 'Amount']],
        body: inv.items.map((item, idx) => [
            idx + 1,
            { content: `${item.name}\n(Mfg: ${item.manufacturer || 'EMYRIS'})`, styles: { fontSize: style === 'compact' ? 6 : 7 } },
            item.hsn || '-',
            item.batch || 'B2401',
            item.exp || '12/25',
            `₹${(item.mrp || 0).toFixed(2)}`,
            item.qty,
            'NOS',
            item.priceUsed.toFixed(2),
            item.totalValue.toFixed(2),
            item.gstPercent + '%',
            (item.totalValue * (1 + item.gstPercent/100)).toFixed(2)
        ]),
        theme: style === 'modern' ? 'striped' : 'grid',
        headStyles: { fillColor: style === 'modern' ? [99, 102, 241] : [40, 44, 52], fontSize: style === 'compact' ? 6 : 7, halign: 'center' },
        styles: { fontSize: style === 'compact' ? 6 : 7, cellPadding: style === 'compact' ? 1 : 2 },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 40 },
            9: { halign: 'right' },
            11: { halign: 'right' }
        },
        margin: { left: 15, right: 15 }
    });

    // Summary Footer
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.text("Amount in Words:", 15, finalY);
    doc.setFont("helvetica", "normal");
    doc.text(numberToWords(inv.grandTotal), 15, finalY + 5);

    doc.setFont("helvetica", "bold");
    doc.text("TAX SUMMARY", 130, finalY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Taxable Amount: ₹${inv.subTotal.toLocaleString('en-IN')}`, 130, finalY + 5);
    doc.text(`CGST (Total): ₹${(inv.gstAmount/2).toLocaleString('en-IN')}`, 130, finalY + 9);
    doc.text(`SGST (Total): ₹${(inv.gstAmount/2).toLocaleString('en-IN')}`, 130, finalY + 13);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`NET PAYABLE: ₹${inv.grandTotal.toLocaleString('en-IN')}`, 130, finalY + 22);

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Terms: 1. Goods once sold will not be taken back. 2. Subject to Hyderabad Jurisdiction.", 15, 280);

    doc.save(`Invoice_${inv.invoiceNo}.pdf`);
}

function downloadInvoicePDF(id) {
    const inv = allInvoices.find(x => x._id === id);
    if (!inv) return alert('Invoice not found.');

    // ── NUMBER TO WORDS (Indian Currency) ────────────────────────────────────
    function numToWords(num) {
        const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                   'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
                   'Seventeen','Eighteen','Nineteen'];
        const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
        const grp = n => {
            let s = '';
            if (n >= 100) { s += a[Math.floor(n/100)] + ' Hundred '; n %= 100; }
            if (n >= 20)  { s += b[Math.floor(n/10)] + ' '; n %= 10; }
            if (n > 0)    { s += a[n] + ' '; }
            return s;
        };
        if (num === 0) return 'Zero Rupees Only';
        const parts = num.toFixed(2).split('.');
        let int = parseInt(parts[0]), dec = parseInt(parts[1]);
        let out = '', i = 0, divisors = [1000, 100, 100, 100];
        const groups = ['Thousand ', 'Lakh ', 'Crore ', ''];
        // Indian number system: units < 1000, then pairs
        const groups2 = [];
        groups2.push(int % 1000); int = Math.floor(int / 1000);
        while (int > 0) { groups2.push(int % 100); int = Math.floor(int / 100); }
        const suffixes = ['', 'Thousand ', 'Lakh ', 'Crore '];
        for (let j = groups2.length - 1; j >= 0; j--) {
            if (groups2[j] > 0) out += grp(groups2[j]) + suffixes[j];
        }
        let result = 'Rupees ' + out.trim();
        if (dec > 0) result += ' and ' + grp(dec).trim() + ' Paise';
        return result + ' Only';
    }

    const { jsPDF } = window.jspdf;
    // A5 = 148mm x 210mm
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
    const W = 148, H = 210;
    const co = companyProfile || {};

    // Company legal info
    const coName    = co.name    || 'EMYRIS BIOLIFESCIENCES';
    const coAddr    = co.address || 'Corporate Office, Hyderabad, Telangana';
    const coGST     = co.gstNo   || 'N/A';
    const coPAN     = co.panNo   || 'N/A';
    const coDL      = co.dlNo    || 'N/A';
    const coFSSAI   = co.fssaiNo || '';
    const coPhone   = (co.phones && co.phones[0]) || co.tollFree || '';
    const coEmail   = (co.emails && co.emails[0]) || '';
    const coWeb     = (co.websites && co.websites[0]) || '';

    const stockist  = inv.stockistName || 'Unknown Party';
    const stkCode   = inv.stockistCode || '';
    const invDate   = new Date(inv.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' });

    // ── COLOURS & HELPERS ──────────────────────────────────────────────────────
    const PRIMARY = [99, 102, 241];   // indigo
    const DARK    = [15, 23, 42];
    const LIGHT   = [241, 245, 249];
    const MUTED   = [100, 116, 139];
    const WHITE   = [255, 255, 255];
    const GREEN   = [16, 185, 129];

    const setFont = (size, style = 'normal', color = DARK) => {
        doc.setFontSize(size);
        doc.setFont('helvetica', style);
        doc.setTextColor(...color);
    };

    let y = 0; // current Y position

    // ── HEADER BAND ────────────────────────────────────────────────────────────
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, W, 24, 'F');

    // Company Name
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text(coName.toUpperCase(), 5, 9);

    // TAX INVOICE label (right)
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', W - 5, 7, { align: 'right' });
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('(Original for Recipient)', W - 5, 11, { align: 'right' });

    // Company sub-info in header
    doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 210, 255);
    const headerInfo = [coAddr, `GST: ${coGST} | PAN: ${coPAN}`];
    if (coDL !== 'N/A') headerInfo.push(`DL: ${coDL}`);
    headerInfo.forEach((line, i) => doc.text(line, 5, 14 + (i * 3.5)));
    // Phone / Email / Web (right side of header)
    doc.text([`Ph: ${coPhone}`, coEmail, coWeb].filter(Boolean).join(' | '), W - 5, 18, { align: 'right' });
    if (coFSSAI) doc.text(`FSSAI: ${coFSSAI}`, W - 5, 21, { align: 'right' });

    y = 27;

    // ── INVOICE META (2 columns) ───────────────────────────────────────────────
    doc.setFillColor(...LIGHT);
    doc.rect(0, y, W, 20, 'F');
    doc.setDrawColor(220, 220, 230);
    doc.rect(0, y, W, 20);
    
    // Left: Bill To
    setFont(6, 'bold', PRIMARY);
    doc.text('BILL TO', 5, y + 5);
    setFont(8, 'bold', DARK);
    doc.text(stockist.toUpperCase(), 5, y + 10);
    setFont(6.5, 'normal', MUTED);
    if (stkCode) doc.text(`Code: ${stkCode}`, 5, y + 14);
    // Get stockist object for compliance info
    const stkObj = allStockists.find(s => s.name === inv.stockistName) || {};
    const stkComplianceLines = [];
    if (stkObj.gstNo) stkComplianceLines.push(`GSTIN: ${stkObj.gstNo}`);
    if (stkObj.dlNo)  stkComplianceLines.push(`DL: ${stkObj.dlNo}`);
    stkComplianceLines.forEach((line, i) => doc.text(line, 5, y + 17 + i * 3));

    // Right: Invoice details
    const midX = W / 2 + 2;
    const metaRows = [
        ['Invoice No.', inv.invoiceNo],
        ['Date',        invDate],
        ['Place of Supply', (stkObj.state || 'Telangana')],
    ];
    setFont(6, 'bold', MUTED); doc.text('INVOICE DETAILS', midX, y + 5);
    metaRows.forEach(([label, val], i) => {
        setFont(6, 'normal', MUTED); doc.text(label + ':', midX, y + 10 + i * 3.5);
        setFont(6.5, 'bold', DARK);  doc.text(String(val), W - 5, y + 10 + i * 3.5, { align: 'right' });
    });

    y += 23;

    // ── ITEMS TABLE ────────────────────────────────────────────────────────────
    const cols = {
        sl:   { x: 1,  w: 5  },
        name: { x: 6,  w: 32 },
        hsn:  { x: 38, w: 10 },
        batch:{ x: 48, w: 12 },
        exp:  { x: 60, w: 8  },
        qty:  { x: 68, w: 6  },
        bon:  { x: 74, w: 6  },
        mrp:  { x: 80, w: 10 },
        rate: { x: 90, w: 11 },
        txbl: { x: 101,w: 14 },
        gst:  { x: 115,w: 9  },
        amt:  { x: 124,w: 23 },
    };

    // Header row
    doc.setFillColor(...DARK);
    doc.rect(0, y, W, 6, 'F');
    setFont(4.5, 'bold', WHITE);
    const headers = { sl:'Sl', name:'Product', hsn:'HSN', batch:'Batch', exp:'Exp', qty:'Qty', bon:'Free', mrp:'MRP', rate:'Rate', txbl:'Taxable', gst:'GST', amt:'Amount' };
    Object.entries(cols).forEach(([key, c]) => {
        const align = ['sl','qty','bon','mrp','rate','txbl','gst','amt'].includes(key) ? 'center' : 'left';
        doc.text(headers[key], c.x + (align === 'center' ? c.w/2 : 1), y + 4, { align });
    });
    y += 6;

    // Item rows
    let taxableTotal = 0, gstTotal = 0;
    const gstBreakdown = {}; // { rate: { taxable, cgst, sgst } }

    inv.items.forEach((item, idx) => {
        const isEven = idx % 2 === 0;
        const rowH = 6;
        if (isEven) { doc.setFillColor(248, 250, 252); doc.rect(0, y, W, rowH, 'F'); }

        const taxable  = (item.priceUsed || 0) * (item.qty || 0);
        const gstPct   = item.gstPercent || 12;
        const gstAmt   = taxable * gstPct / 100;
        const lineAmt  = taxable + gstAmt;
        taxableTotal  += taxable;
        gstTotal      += gstAmt;

        if (!gstBreakdown[gstPct]) gstBreakdown[gstPct] = { taxable: 0, cgst: 0, sgst: 0 };
        gstBreakdown[gstPct].taxable += taxable;
        gstBreakdown[gstPct].cgst   += gstAmt / 2;
        gstBreakdown[gstPct].sgst   += gstAmt / 2;

        const fmt = n => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        doc.setDrawColor(230, 230, 240);
        doc.rect(0, y, W, rowH);
        setFont(5, 'normal', DARK);
        doc.text(String(idx + 1), cols.sl.x + cols.sl.w/2, y + 4, { align: 'center' });
        doc.text((item.name || '-').substring(0,25), cols.name.x + 1, y + 4, { maxWidth: cols.name.w - 1 });
        doc.text(item.hsn || '30049', cols.hsn.x + 1, y + 4);
        doc.text(item.batch || 'BT-01', cols.batch.x + 1, y + 4);
        doc.text(item.exp || '12/26', cols.exp.x + 1, y + 4);
        doc.text(String(item.qty || 0), cols.qty.x + cols.qty.w/2, y + 4, { align: 'center' });
        setFont(5, 'normal', GREEN);
        doc.text(String(item.bonusQty || 0), cols.bon.x + cols.bon.w/2, y + 4, { align: 'center' });
        setFont(5, 'normal', DARK);
        doc.text(fmt(item.mrp || 0), cols.mrp.x + cols.mrp.w - 1, y + 4, { align: 'right' });
        doc.text(fmt(item.priceUsed || 0), cols.rate.x + cols.rate.w - 1, y + 4, { align: 'right' });
        doc.text(fmt(taxable), cols.txbl.x + cols.txbl.w - 1, y + 4, { align: 'right' });
        doc.text(`${gstPct}%`, cols.gst.x + cols.gst.w/2, y + 4, { align: 'center' });
        setFont(5.5, 'bold', DARK);
        doc.text(fmt(lineAmt), cols.amt.x + cols.amt.w - 1, y + 4, { align: 'right' });
        y += rowH;

        // Page break safety
        if (y > H - 55) {
            doc.addPage('a5');
            y = 10;
        }
    });

    // ── GST BREAKDOWN TABLE ────────────────────────────────────────────────────
    y += 2;
    const grandTotal = taxableTotal + gstTotal;

    // Left: GST Summary
    const gstSummaryX = 0;
    setFont(5.5, 'bold', PRIMARY);
    doc.text('GST SUMMARY', gstSummaryX + 2, y + 4);
    y += 5;
    doc.setFillColor(235, 237, 255);
    doc.rect(gstSummaryX, y, 75, 5, 'F');
    setFont(5, 'bold', PRIMARY);
    doc.text('GST Rate', gstSummaryX + 2, y + 3.5);
    doc.text('Taxable', gstSummaryX + 20, y + 3.5);
    doc.text('CGST', gstSummaryX + 38, y + 3.5);
    doc.text('SGST', gstSummaryX + 52, y + 3.5);
    doc.text('Total GST', gstSummaryX + 64, y + 3.5);
    y += 5;
    Object.entries(gstBreakdown).forEach(([rate, vals]) => {
        setFont(5, 'normal', DARK);
        const fv = v => v.toLocaleString('en-IN', { minimumFractionDigits: 2 });
        doc.text(`${rate}%`, gstSummaryX + 2, y + 3.5);
        doc.text(fv(vals.taxable), gstSummaryX + 20, y + 3.5);
        doc.text(fv(vals.cgst), gstSummaryX + 38, y + 3.5);
        doc.text(fv(vals.sgst), gstSummaryX + 52, y + 3.5);
        doc.text(fv(vals.cgst + vals.sgst), gstSummaryX + 64, y + 3.5);
        y += 4.5;
    });

    // Right: Grand Total Box
    const totX = W - 60;
    const fmt2 = n => '₹ ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const totRows = [
        ['Taxable Value', taxableTotal],
        ['Total GST',     gstTotal],
        ['ROUND OFF',     Math.round(grandTotal) - grandTotal],
    ];
    let tY = y - (totRows.length + 1) * 5.5;
    totRows.forEach(([lbl, val]) => {
        setFont(6, 'normal', MUTED); doc.text(lbl, totX + 1, tY + 4);
        setFont(6, 'normal', DARK);  doc.text(fmt2(val), W - 2, tY + 4, { align: 'right' });
        tY += 5.5;
    });
    // Grand Total row
    doc.setFillColor(...PRIMARY);
    doc.rect(totX, tY, W - totX, 8, 'F');
    setFont(7, 'bold', WHITE); doc.text('GRAND TOTAL', totX + 2, tY + 5.5);
    doc.text(fmt2(Math.round(grandTotal)), W - 2, tY + 5.5, { align: 'right' });

    y += 4;

    // ── AMOUNT IN WORDS ────────────────────────────────────────────────────────
    doc.setFillColor(240, 253, 250);
    doc.rect(0, y, W, 7, 'F');
    setFont(5.5, 'bold', GREEN); doc.text('Amount in Words:', 3, y + 4.5);
    setFont(5.5, 'italic', DARK);
    doc.text(numToWords(Math.round(grandTotal)), 33, y + 4.5, { maxWidth: W - 35 });
    y += 9;

    // ── TERMS & SIGNATURE ─────────────────────────────────────────────────────
    setFont(5, 'normal', MUTED);
    doc.text('Terms: Goods once sold will not be taken back. Subject to ' + (stkObj.state || 'Hyderabad') + ' jurisdiction.', 3, y + 4);
    doc.text('Reverse Charge Applicable: NO', 3, y + 7.5);

    // Signature block (right)
    setFont(5.5, 'bold', PRIMARY); doc.text(`For ${coName}`, W - 3, y + 4, { align: 'right' });
    doc.setDrawColor(...MUTED);
    doc.line(W - 45, y + 16, W - 3, y + 16);
    setFont(5, 'normal', MUTED); doc.text('Authorised Signatory', W - 3, y + 19, { align: 'right' });

    // ── FOOTER ────────────────────────────────────────────────────────────────
    y += 22;
    doc.setFillColor(...DARK);
    doc.rect(0, H - 8, W, 8, 'F');
    setFont(5, 'normal', [150, 160, 200]);
    doc.text('E. & O.E.  —  This is a Computer Generated Invoice  —  No signature required', W / 2, H - 4, { align: 'center' });
    setFont(5, 'normal', [120, 130, 180]);
    doc.text(coWeb, 3, H - 4);
    doc.text(coEmail, W - 3, H - 4, { align: 'right' });

    doc.save(`Invoice_${inv.invoiceNo}.pdf`);
}


// --- PURCHASE ENTRY ENHANCEMENTS ---
function updateSupplierDetailsDisplay(id) {
    const s = allStockists.find(x => x._id === id);
    const box = document.getElementById('supplier-compliance-box');
    if (!box) return;
    if (!s) { box.innerHTML = 'Select a supplier to view compliance data.'; return; }
    
    box.innerHTML = `
        <strong>Address:</strong> ${s.address || 'N/A'}<br>
        <strong>DL:</strong> ${s.dl || 'N/A'} | <strong>GST:</strong> ${s.gst || 'N/A'}<br>
        <strong>PAN:</strong> ${s.pan || 'N/A'} | <strong>FSSAI:</strong> ${s.fssai || 'N/A'}<br>
        <strong>Phone:</strong> ${s.phone || 'N/A'}
    `;
}

function updateProductEntryMeta(id) {
    const p = allProducts.find(x => x._id === id);
    if (!p) return;
    document.getElementById('pur-rate').value = p.pts || 0;
    document.getElementById('pur-gst-pct').value = p.gst || 12;
}

// --- REPORT GENERATION ENGINE ---
function generateReport(type) {
    let reportData = [];
    let filename = "";

    switch(type) {
        case 'sales-summary':
            filename = "Sales_Summary_Report";
            reportData = allInvoices.map(inv => ({
                "Invoice No": inv.invoiceNo,
                "Date": new Date(inv.createdAt).toLocaleDateString('en-GB'),
                "Party Name": inv.stockistName,
                "Items": inv.items.length,
                "Taxable Value": inv.subTotal,
                "GST Amount": inv.gstAmount,
                "Grand Total": inv.grandTotal
            }));
            break;

        case 'party-sales':
            filename = "Party_Wise_Sales_Analysis";
            // Group invoices by party
            const partyMap = {};
            allInvoices.forEach(inv => {
                if(!partyMap[inv.stockistName]) partyMap[inv.stockistName] = { Name: inv.stockistName, TotalOrders: 0, TotalRevenue: 0, TotalGST: 0 };
                partyMap[inv.stockistName].TotalOrders++;
                partyMap[inv.stockistName].TotalRevenue += inv.grandTotal;
                partyMap[inv.stockistName].TotalGST += inv.gstAmount;
            });
            reportData = Object.values(partyMap);
            break;

        case 'product-sales':
            filename = "Product_Movement_Report";
            const prodMap = {};
            allInvoices.forEach(inv => {
                inv.items.forEach(item => {
                    if(!prodMap[item.name]) prodMap[item.name] = { Name: item.name, QtySold: 0, Revenue: 0 };
                    prodMap[item.name].QtySold += item.qty;
                    prodMap[item.name].Revenue += item.totalValue;
                });
            });
            reportData = Object.values(prodMap).sort((a,b) => b.QtySold - a.QtySold);
            break;

        case 'purchase-register':
            filename = "Purchase_Register";
            reportData = allPurchaseEntries.map(p => ({
                "Pur No": p.purchaseNo,
                "Supplier": p.supplierName,
                "Inv No": p.supplierInvoiceNo,
                "Date": new Date(p.invoiceDate).toLocaleDateString('en-GB'),
                "Items": p.items.length,
                "Total Value": p.grandTotal
            }));
            break;

        case 'outstanding-summary':
            filename = "Party_Outstanding_Summary";
            reportData = allStockists
                .filter(s => s.outstandingBalance !== 0)
                .map(s => ({
                    "Party Name": s.name,
                    "City": s.city || '-',
                    "Type": s.partyType || 'STOCKIST',
                    "Outstanding Balance": s.outstandingBalance
                }));
            break;

        case 'inventory-val':
            filename = "Inventory_Valuation_Report";
            reportData = allProducts.map(p => ({
                "Product Name": p.name,
                "Packing": p.packing,
                "Current Stock": p.stock,
                "PTS Rate": p.pts,
                "Total Value (PTS)": (p.stock * p.pts)
            }));
            break;

        case 'low-stock':
            filename = "Shortage_Reorder_List";
            reportData = allProducts
                .filter(p => p.stock <= 10) // Threshold of 10
                .map(p => ({
                    "Product Name": p.name,
                    "Packing": p.packing,
                    "Current Stock": p.stock,
                    "Status": p.stock === 0 ? "OUT OF STOCK" : "LOW STOCK"
                }));
            break;

        case 'gstr-1':
            return exportGSTR1(); // Use existing function

        default:
            alert("Report logic for '" + type + "' is under development.");
            return;
    }

    if(reportData.length === 0) {
        alert("No data available for this report.");
        return;
    }

    downloadExcel(reportData, filename);
}

function downloadExcel(data, filename) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
