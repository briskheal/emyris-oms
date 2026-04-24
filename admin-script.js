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
    
    await loadProducts();
    await loadStockists();
    await loadOrders();
    await loadMasters();
    await loadSettings();
    await refreshDashboard();
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

    if (tabId === 'orders') renderOrderHistory();
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
    const TARGET_GROUPS = ['GROUP1', 'GROUP2', 'GROUP3'];
    const groupSales = { 'GROUP1': 0, 'GROUP2': 0, 'GROUP3': 0 };
    const groupGST = { 'GROUP1': 0, 'GROUP2': 0, 'GROUP3': 0 };
    let totalGSTAll = 0;

    totalOrders.filter(o => o.status === 'approved').forEach(o => {
        o.items.forEach(item => {
            const prod = allProducts.find(p => p._id === item.product);
            const rawGroup = (prod && prod.group) ? prod.group.toUpperCase().trim() : 'GENERAL';
            
            // Strictly filter for the three requested groups
            if (TARGET_GROUPS.includes(rawGroup)) {
                groupSales[rawGroup] += (item.totalValue || 0);
                
                const gstRate = prod ? (prod.gstPercent || 12) : 12;
                const itemGst = ((item.totalValue || 0) * gstRate) / 100;
                groupGST[rawGroup] += itemGst;
                totalGSTAll += itemGst;
            }
        });
    });

    chartInstances.groupPie = new Chart(document.getElementById('groupPieChart'), {
        type: 'pie',
        data: {
            labels: Object.keys(groupSales),
            datasets: [{
                data: Object.values(groupSales),
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'],
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

    chartInstances.gstBar = new Chart(document.getElementById('gstBarChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(groupGST),
            datasets: [{
                label: 'GST Amount (₹)',
                data: Object.values(groupGST),
                backgroundColor: 'rgba(99, 102, 241, 0.7)',
                borderColor: '#6366f1',
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

async function loadMasters() {
    try {
        const [cats, hsns, gst, groups] = await Promise.all([
            fetch(`${API_BASE}/admin/categories`).then(r => r.json()),
            fetch(`${API_BASE}/admin/hsns`).then(r => r.json()),
            fetch(`${API_BASE}/admin/gst`).then(r => r.json()),
            fetch(`${API_BASE}/admin/groups`).then(r => r.json())
        ]);
        window.masters = { categories: cats, hsns, gst, groups };
        renderMasters();
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
                <button style="background:none; border:none; color:#ef4444; cursor:pointer;" onclick="deleteMaster('${type}', '${item._id}')">✕</button>
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

        // Footer population (handled by script.js in stockist, but here for completeness)
        if (document.getElementById('footer-co-name')) document.getElementById('footer-co-name').innerText = s.name || 'EMYRIS OMS';
        if (document.getElementById('footer-co-address')) document.getElementById('footer-co-address').innerText = s.address || '';
        
        if (s.scrollingMessage) {
            document.getElementById('set-msg-text').value = s.scrollingMessage.text || '';
            document.getElementById('set-msg-color').value = s.scrollingMessage.color || '#6366f1';
            document.getElementById('set-msg-speed').value = s.scrollingMessage.speed || 30;
        }
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
        }
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
            <td>
                <a href="javascript:void(0)" onclick="viewStockistDetails('${s._id}')" style="color:var(--primary); font-weight:700; text-decoration:none; border-bottom:1px dashed var(--primary);">
                    ${s.name}
                </a>
            </td>
            <td style="font-family:monospace; font-size:0.85rem;">
                ${s.loginId}
            </td>
            <td style="font-size:0.85rem; color:var(--text-muted);">
                ${new Date(s.registeredAt || Date.now()).toLocaleDateString('en-GB')}
            </td>
            <td><span class="badge ${s.approved ? 'badge-approved' : 'badge-pending'}">${s.approved ? 'Approved' : 'Pending'}</span></td>
            <td style="text-align: right; white-space: nowrap;">
                ${!s.approved ? `<button class="btn btn-primary" style="padding: 5px 12px; font-size:0.75rem; margin-right:5px;" onclick="approveStockist('${s._id}')">APPROVE</button>` : '<span style="color:var(--accent); margin-right:10px; font-size:0.8rem; font-weight:700;">✅ VERIFIED</span>'}
                <button class="btn btn-ghost" style="padding: 5px 10px; color: #ef4444; border-color: rgba(239, 68, 68, 0.2);" onclick="deleteStockist('${s._id}')" title="Delete Stockist">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function viewStockistDetails(id) {
    const s = allStockists.find(x => x._id === id);
    if (!s) return;

    const content = document.getElementById('stockist-details-content');
    const actions = document.getElementById('stockist-modal-actions');
    
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <div>
                <label style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Drug License (DL)</label>
                <div style="color:#fff; font-family:monospace; margin-bottom:1rem;">${s.dlNo || 'Not Provided'}</div>
                
                <label style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">GST Number</label>
                <div style="color:#fff; font-family:monospace; margin-bottom:1rem;">${s.gstNo || 'Not Provided'}</div>
                
                <label style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">FSSAI Number</label>
                <div style="color:#fff; font-family:monospace; margin-bottom:1rem;">${s.fssaiNo || 'Not Provided'}</div>
                
                <label style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">PAN Number</label>
                <div style="color:#fff; font-family:monospace; margin-bottom:1rem;">${s.panNo || 'Not Provided'}</div>
            </div>
            <div>
                <label style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Contact Phone</label>
                <div style="color:#fff; margin-bottom:1rem;">${s.phone || '-'}</div>
                
                <label style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Email Address</label>
                <div style="color:#fff; margin-bottom:1rem;">${s.email || '-'}</div>
                
                <label style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Full Address</label>
                <div style="color:#fff; font-size:0.85rem; line-height:1.4;">${s.address || 'No address provided'}</div>
            </div>
        </div>
        
        <div style="margin-top: 2rem; background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 20px; padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0; font-size: 0.9rem; color: var(--primary);">💼 Business Summary</h4>
                <span class="badge badge-approved" style="font-size: 0.6rem;">REAL-TIME DATA</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="text-align: center; border-right: 1px solid var(--glass-border);">
                    <div style="color: var(--text-muted); font-size: 0.65rem; text-transform: uppercase; margin-bottom: 5px;">Total Orders</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #fff;">${allOrders.filter(o => o.stockist && o.stockist._id === s._id).length}</div>
                </div>
                <div style="text-align: center;">
                    <div style="color: var(--text-muted); font-size: 0.65rem; text-transform: uppercase; margin-bottom: 5px;">Life-time Business</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent);">₹${allOrders.filter(o => o.stockist && o.stockist._id === s._id).reduce((acc, curr) => acc + curr.grandTotal, 0).toLocaleString('en-IN')}</div>
                </div>
            </div>
        </div>
    `;

    actions.innerHTML = `
        <button class="btn btn-ghost" onclick="closeStockistModal()" style="flex:1; justify-content:center;">CLOSE</button>
        ${!s.approved ? `
            <button class="btn btn-primary" onclick="approveStockist('${s._id}'); closeStockistModal();" style="flex:2; justify-content:center;">APPROVE STOCKIST</button>
        ` : ''}
        <button class="btn btn-ghost" onclick="deleteStockist('${s._id}'); closeStockistModal();" style="color:#ef4444; border-color:rgba(239,68,68,0.2);">DELETE RECORD</button>
    `;

    document.getElementById('stockistModal').classList.remove('hidden');
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
            <td style="text-align:center;"><span class="badge ${o.status === 'approved' ? 'badge-approved' : (o.status === 'rejected' ? 'badge-pending' : 'badge-pending')}" style="${o.status === 'rejected' ? 'background:#ef4444; color:#fff;' : ''}">${o.status.toUpperCase()}</span></td>
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
    statusEl.style.background = o.status === 'approved' ? '#10b981' : (o.status === 'rejected' ? '#ef4444' : '#f59e0b');
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

    deleteBtn.onclick = () => {
        if (confirm(`⚠️ CRITICAL: Are you sure you want to PERMANENTLY DELETE Order #${o.orderNo}?\n\nThis will also remove it from the Stockist's view.`)) {
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
            alert("❌ Order rejected and marked accordingly.");
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
    btn.innerHTML = `⏳`;

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
            alert("🗑️ Order deleted successfully.");
            loadOrders(); // Refresh history
        }
    } catch (e) { alert("Delete failed."); }
}

function closeOrderModal() {
    document.getElementById('orderDetailModal').classList.add('hidden');
}
