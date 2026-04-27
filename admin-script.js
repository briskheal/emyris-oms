// EMYRIS OMS - Admin Logic
const API_BASE = '/api';
let allProducts = [];
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
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: 0.2s;">
                    <td style="padding: 8px 12px; font-weight: 700; color: #fff;">${b.batchNo}</td>
                    <td style="padding: 8px 12px; text-align: center;">${b.expDate || '-'}</td>
                    <td style="padding: 8px 12px; text-align: right;">₹${Number(b.mrp||0).toFixed(2)}</td>
                    <td style="padding: 8px 12px; text-align: right;">₹${Number(b.pts||0).toFixed(2)}</td>
                    <td style="padding: 8px 12px; text-align: right;">₹${Number(b.ptr||0).toFixed(2)}</td>
                    <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: var(--accent); background: rgba(16, 185, 129, 0.05);">${b.qtyAvailable}</td>
                    <td style="padding: 8px 12px; text-align: center;"><button type="button" class="btn btn-ghost" style="padding: 4px 8px; border-radius: 6px; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);" onclick="removeProductBatch(${i})">✕</button></td>
                </tr>
            `;
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
let allStockists = [];
let allOrders = [];
let allInvoices = [];
let allPurchaseEntries = [];
let allNotes = [];
let currentNoteReason = 'ALL';
let purchaseItems = []; // Temporary storage for new purchase entry
let companyProfile = {};
let currentEditingNoteId = null; // Track if we are editing a CN/DN

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
        currentNoteReason = subType || 'ALL';
        renderFinancialNotes();
        filterNotes();
        
        // Update context label
        const label = document.getElementById('note-context-label');
        if(label) {
            label.innerText = currentNoteReason === 'ALL' ? "Global View" : `Viewing: ${currentNoteReason}`;
        }
    }
    if (tabId === 'purchase') renderPurchaseEntries();
    if (tabId === 'reports') refreshInventoryVal();
    if (tabId === 'system') loadFailedEmails();
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
        const [cats, hsns, gst, groups, hq] = await Promise.all([
            fetch(`${API_BASE}/admin/categories`).then(r => r.json()),
            fetch(`${API_BASE}/admin/hsns`).then(r => r.json()),
            fetch(`${API_BASE}/admin/gst`).then(r => r.json()),
            fetch(`${API_BASE}/admin/groups`).then(r => r.json()),
            fetch(`${API_BASE}/admin/masters/hq`).then(r => r.json())
        ]);
        window.masters = { categories: cats, hsns, gst, groups, hq };
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
    
    // Update HQ Dropdowns
    const partyHqSelect = document.getElementById('party-hq');
    if (partyHqSelect && window.masters && window.masters.hq) {
        const currentVal = partyHqSelect.value;
        partyHqSelect.innerHTML = '<option value="">-- Select HQ --</option>' + 
            window.masters.hq.map(h => `<option value="${h.name}">${h.name}</option>`).join('');
        partyHqSelect.value = currentVal;
    }
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
    currentProductBatches = [];
    renderProductBatches();
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
        manufacturer: document.getElementById('prod-manufacturer').value || '',
        hsn: document.getElementById('prod-hsn').value,
        category: document.getElementById('prod-cat').value,
        group: document.getElementById('prod-group').value,
        packing: document.getElementById('prod-packing').value,
        mrp: Number(document.getElementById('prod-mrp').value),
        gstPercent: Number(document.getElementById('prod-gst').value),
        ptr: Number(document.getElementById('prod-ptr').value),
        pts: Number(document.getElementById('prod-pts').value),
        qtyAvailable: Number(document.getElementById('prod-qty').value),
        batches: currentProductBatches,
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
    render('master-hq-list', window.masters.hq || [], 'name', 'masters/hq');
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
    } else if (type === 'hq') {
        val = document.getElementById('new-hq-name').value;
        body = { name: val };
    }

    if (!val) return alert("Please enter a value");
    try {
        const endpoint = type === 'hq' ? `${API_BASE}/admin/masters/hq` : `${API_BASE}/admin/${type}`;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await res.json();
        if (res.ok && result.success) {
            // Clear input
            const inputId = type === 'categories' ? 'new-cat-name' : 
                           type === 'groups' ? 'new-group-name' :
                           type === 'hsns' ? 'new-hsn-code' : 
                           type === 'gst' ? 'new-gst-rate' : 'new-hq-name';
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
        const endpoint = type.includes('/') ? `${API_BASE}/api/admin/${type}/${id}` : `${API_BASE}/admin/${type}/${id}`;
        await fetch(endpoint, { method: 'DELETE' });
        loadMasters();
    } catch (e) { alert("Delete failed"); }
}

async function loadSettings() {
    try {
        const res = await fetch(`${API_BASE}/admin/settings`);
        const s = await res.json();
        companyProfile = s || {};
        
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
        
        document.getElementById('set-bank-details').value = s.bankDetails || '';
        if (document.getElementById('set-invoice-terms')) document.getElementById('set-invoice-terms').value = s.invoiceTerms || '';
        if (document.getElementById('set-cn-terms')) document.getElementById('set-cn-terms').value = s.cnTerms || '';
        if (document.getElementById('set-dn-terms')) document.getElementById('set-dn-terms').value = s.dnTerms || '';
        
        if (document.getElementById('set-invoice-bank-visible')) document.getElementById('set-invoice-bank-visible').checked = !!s.invoiceBankVisible;
        if (document.getElementById('set-cn-bank-visible')) document.getElementById('set-cn-bank-visible').checked = !!s.cnBankVisible;
        if (document.getElementById('set-dn-bank-visible')) document.getElementById('set-dn-bank-visible').checked = !!s.dnBankVisible;

        if (document.getElementById('set-upi-id')) document.getElementById('set-upi-id').value = s.upiId || '';
        if (document.getElementById('set-bank-acc')) document.getElementById('set-bank-acc').value = s.bankAccountNo || '';
        if (document.getElementById('set-bank-ifsc')) document.getElementById('set-bank-ifsc').value = s.bankIfsc || '';
        
        document.getElementById('set-signature-b64').value = s.signatureImage || '';
        if (s.signatureImage) {
            document.getElementById('sig-preview').src = s.signatureImage;
            document.getElementById('sig-preview').style.display = 'block';
        } else {
            document.getElementById('sig-preview').style.display = 'none';
        }

        if (document.getElementById('set-logo-b64')) document.getElementById('set-logo-b64').value = s.logoImage || '';
        if (s.logoImage && document.getElementById('logo-preview')) {
            document.getElementById('logo-preview').src = s.logoImage;
            document.getElementById('logo-preview').style.display = 'block';
        } else if (document.getElementById('logo-preview')) {
            document.getElementById('logo-preview').style.display = 'none';
        }

        // Footer population (handled by script.js in stockist, but here for completeness)
        if (document.getElementById('footer-co-name')) document.getElementById('footer-co-name').innerText = s.name || 'EMYRIS OMS';
        if (document.getElementById('footer-co-address')) document.getElementById('footer-co-address').innerText = s.address || '';
        
        if (s.scrollingMessage) {
            document.getElementById('set-msg-text').value = s.scrollingMessage.text || '';
            document.getElementById('set-msg-color').value = s.scrollingMessage.color || '#6366f1';
        }

        // Load Document Formats
        if (document.getElementById('set-invoice-terms')) document.getElementById('set-invoice-terms').value = s.invoiceTerms || '';
        if (document.getElementById('set-cn-terms')) document.getElementById('set-cn-terms').value = s.cnTerms || '';
        if (document.getElementById('set-dn-terms')) document.getElementById('set-dn-terms').value = s.dnTerms || '';
        if (document.getElementById('set-invoice-bank-visible')) document.getElementById('set-invoice-bank-visible').checked = !!s.invoiceBankVisible;
        if (document.getElementById('set-cn-bank-visible')) document.getElementById('set-cn-bank-visible').checked = !!s.cnBankVisible;
        if (document.getElementById('set-dn-bank-visible')) document.getElementById('set-dn-bank-visible').checked = !!s.dnBankVisible;

        setInvoiceStyle(s.invoiceStyle || 'classic');

        // Sync Volume Slider
        if (s.musicVolume !== undefined) {
            const volSlider = document.getElementById('globalVolume');
            if (volSlider) {
                volSlider.value = s.musicVolume;
                if (document.getElementById('volumePercent')) document.getElementById('volumePercent').innerText = `${Math.round(s.musicVolume * 100)}%`;
                const audio = document.getElementById('bgMusic');
                if (audio) audio.volume = s.musicVolume;
            }
        }


        // Multimedia Setup
        if (s.musicUrl) {
            const musicName = s.musicUrl.split('/').pop();
            if (document.getElementById('current-music-name')) document.getElementById('current-music-name').innerText = `Current: ${musicName}`;
            if (document.getElementById('set-music-url')) document.getElementById('set-music-url').value = s.musicUrl;
            
            const audio = document.getElementById('bgMusic');
            if (audio) {
                const targetSrc = s.musicUrl.startsWith('http') ? s.musicUrl : window.location.origin + s.musicUrl;
                if (audio.src !== targetSrc) {
                    audio.src = targetSrc;
                }
                // Persistence
                if (localStorage.getItem('emyris_music_on') === 'true' && audio.paused) {
                    audio.play().catch(() => {});
                }
            }
        }

        if (s.videoUrl) {
            const videoName = s.videoUrl.split('/').pop();
            if (document.getElementById('current-video-name')) document.getElementById('current-video-name').innerText = `Current: ${videoName}`;
            if (document.getElementById('set-video-url')) document.getElementById('set-video-url').value = s.videoUrl;
        }


    } catch (e) { console.error("Load settings fail"); }
}

function toggleMusic() {
    const audio = document.getElementById('bgMusic');
    const btn = document.getElementById('musicToggleAdmin');
    const text = document.getElementById('musicTextAdmin');
    
    if (!audio || !audio.src || audio.src.endsWith('/') || audio.src.includes('undefined')) {
        alert("⚠️ No music source found.\n\nIf you recently pushed code, your uploaded file may have been removed from the server. Please re-upload or use a permanent URL.");
        return;
    }


    if (audio.paused) {
        audio.volume = companyProfile.musicVolume || 0.5; 
        audio.play().then(() => {

            localStorage.setItem('emyris_music_on', 'true');
            btn.style.background = 'rgba(16, 185, 129, 0.1)';
            btn.style.borderColor = '#10b981';
            btn.style.color = '#10b981';
            btn.querySelector('span').innerText = '🔊';
            text.innerText = 'Music On';
        }).catch(err => {
            console.warn("Playback blocked by browser policy.");
        });
    } else {
        audio.pause();
        localStorage.setItem('emyris_music_on', 'false');
        btn.style.background = 'rgba(99, 102, 241, 0.1)';
        btn.style.borderColor = '#6366f1';
        btn.style.color = '#fff';
        btn.querySelector('span').innerText = '🔇';
        text.innerText = 'Music Off';
    }
}


async function uploadMedia(type) {
    const inputId = type === 'music' ? 'musicFile' : 'videoFile';
    const input = document.getElementById(inputId);
    if (!input.files || !input.files[0]) return alert("Please select a file first");

    const formData = new FormData();
    formData.append('media', input.files[0]);
    formData.append('type', type);

    try {
        const res = await fetch(`${API_BASE}/admin/upload-media`, {
            method: 'POST',
            body: formData
        });
        const result = await res.json();
        if (result.success) {
            alert(`✅ ${type.toUpperCase()} uploaded successfully!`);
            loadSettings();
        } else {
            alert("Upload failed: " + result.message);
        }
    } catch (e) { alert("Upload failed"); }
}

function updateLocalVolume(val) {
    const audio = document.getElementById('bgMusic');
    if (audio) audio.volume = val;
    if (document.getElementById('volumePercent')) document.getElementById('volumePercent').innerText = `${Math.round(val * 100)}%`;
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
        phones: [document.getElementById('set-phone').value].filter(v => v),
        adminEmail: document.getElementById('set-admin-email').value,
        address: document.getElementById('set-address').value,
        gstNo: document.getElementById('set-gst-no').value,
        panNo: document.getElementById('set-pan-no').value,
        dlNo: document.getElementById('set-dl-no').value,
        fssaiNo: document.getElementById('set-fssai-no').value,
        bankDetails: document.getElementById('set-bank-details').value,
        invoiceTerms: document.getElementById('set-invoice-terms').value,
        cnTerms: document.getElementById('set-cn-terms').value,
        dnTerms: document.getElementById('set-dn-terms').value,
        invoiceBankVisible: document.getElementById('set-invoice-bank-visible').checked,
        cnBankVisible: document.getElementById('set-cn-bank-visible').checked,
        dnBankVisible: document.getElementById('set-dn-bank-visible').checked,
        upiId: document.getElementById('set-upi-id') ? document.getElementById('set-upi-id').value : '',
        bankAccountNo: document.getElementById('set-bank-acc') ? document.getElementById('set-bank-acc').value : '',
        bankIfsc: document.getElementById('set-bank-ifsc') ? document.getElementById('set-bank-ifsc').value : '',
        signatureImage: document.getElementById('set-signature-b64').value || companyProfile.signatureImage || '',
        logoImage: (document.getElementById('set-logo-b64') && document.getElementById('set-logo-b64').value) ? document.getElementById('set-logo-b64').value : (companyProfile.logoImage || ''),
        scrollingMessage: {
            text: document.getElementById('set-msg-text').value,
            color: document.getElementById('set-msg-color').value,
            speed: Number(document.getElementById('set-msg-speed').value || 30)
        },
        invoiceStyle: document.getElementById('set-inv-style').value,
        musicVolume: Number(document.getElementById('globalVolume') ? document.getElementById('globalVolume').value : 0.5),
        musicUrl: document.getElementById('set-music-url') ? document.getElementById('set-music-url').value : '',
        videoUrl: document.getElementById('set-video-url') ? document.getElementById('set-video-url').value : ''
    };



    try {
        const res = await fetch(`${API_BASE}/admin/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            alert("✅ Settings updated successfully!");
            loadSettings(); // Refresh UI and global object
        }
    } catch (e) { alert("Save settings failed"); }
    finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}
// --- PARTY MASTER LOGIC ---

function convertSignatureToBase64(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('set-signature-b64').value = e.target.result;
            document.getElementById('sig-preview').src = e.target.result;
            document.getElementById('sig-preview').style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function convertLogoToBase64(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('set-logo-b64').value = e.target.result;
            document.getElementById('logo-preview').src = e.target.result;
            document.getElementById('logo-preview').style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function convertLogoToBase64(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('set-logo-b64').value = e.target.result;
            document.getElementById('logo-preview').src = e.target.result;
            document.getElementById('logo-preview').style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function renderStockists(list = null) {
    const tbody = document.getElementById('stockistTableBody');
    if (!tbody) return;

    const data = list || allStockists;

    // Update Party Stats
    const totalEl = document.getElementById('stat-total-parties');
    if (totalEl) {
        totalEl.innerText = allStockists.length;
        document.getElementById('stat-total-stockists').innerText = allStockists.filter(s => (s.partyType || 'STOCKIST') === 'STOCKIST').length;
        document.getElementById('stat-total-suppliers').innerText = allStockists.filter(s => s.partyType === 'SUPPLIER').length;
        document.getElementById('stat-pending-approval').innerText = allStockists.filter(s => !s.approved).length;
    }

    tbody.innerHTML = data.map(s => `
        <tr>
            <td style="font-weight:600; color:#fff;">${s.name}</td>
            <td style="font-size:0.75rem; font-weight:700; color:var(--primary);">${s.partyType || 'STOCKIST'}</td>
            <td>${s.city || '-'}</td>
            <td style="text-align:right; font-weight:700; color:${(s.outstandingBalance || 0) < 0 ? '#ef4444' : '#10b981'}; font-family:monospace;">₹${(s.outstandingBalance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            <td><span class="badge ${s.approved ? 'badge-approved' : 'badge-pending'}" style="font-size:0.6rem;">${s.approved ? 'APPROVED' : 'PENDING'}</span></td>
            <td style="text-align:right; white-space:nowrap;">
                <button class="btn btn-ghost" style="padding:6px 12px; font-size: 0.65rem; color:var(--primary);" onclick="viewLedger('${s._id}')">LEDGER</button>
                <button class="btn btn-ghost" style="padding:6px 12px; font-size: 0.65rem;" onclick="openPartyModal('${s._id}')">EDIT</button>
                <button class="btn btn-ghost" style="padding:6px 12px; font-size: 0.65rem; color:#ef4444;" onclick="deleteStockist('${s._id}')">DELETE</button>
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

function openPartyModal(id = null) {
    const modal = document.getElementById('partyModal');
    const form = document.getElementById('partyForm');
    if(!modal || !form) return;

    form.reset();
    document.getElementById('party-id').value = id || '';
    
    if (id) {
        const s = allStockists.find(x => x._id === id);
        if (s) {
            document.getElementById('party-name').value = s.name || '';
            document.getElementById('party-type').value = s.partyType || 'STOCKIST';
            document.getElementById('party-login').value = s.loginId || '';
            document.getElementById('party-pass').value = s.password || '';
            document.getElementById('party-email').value = s.email || '';
            document.getElementById('party-limit').value = s.creditLimit || 0;
            document.getElementById('party-balance').value = s.outstandingBalance || 0;
            document.getElementById('party-pan').value = s.panNo || '';
            document.getElementById('party-gst').value = s.gstNo || '';
            document.getElementById('party-dl').value = s.dlNo || '';
            document.getElementById('party-fssai').value = s.fssaiNo || '';
            document.getElementById('party-city').value = s.city || '';
            document.getElementById('party-state').value = s.state || '';
            document.getElementById('party-phone').value = s.phone || '';
            document.getElementById('party-address').value = s.address || '';
            document.getElementById('party-pincode').value = s.pincode || '';

            document.getElementById('party-bank-name').value = s.bankName || '';
            document.getElementById('party-bank-acc').value = s.bankAccountNo || '';
            document.getElementById('party-bank-ifsc').value = s.bankIfsc || '';
            document.getElementById('party-hq').value = s.hq || '';

        }
    }
    modal.classList.remove('hidden');
}

function closePartyModal() {
    document.getElementById('partyModal').classList.add('hidden');
}

async function saveParty(e) {
    e.preventDefault();
    const id = document.getElementById('party-id').value;
    const data = {
        name: document.getElementById('party-name').value,
        partyType: document.getElementById('party-type').value,
        loginId: document.getElementById('party-login').value,
        password: document.getElementById('party-pass').value,
        email: document.getElementById('party-email').value,
        creditLimit: Number(document.getElementById('party-limit').value),
        outstandingBalance: Number(document.getElementById('party-balance').value),
        panNo: document.getElementById('party-pan').value,
        gstNo: document.getElementById('party-gst').value,
        dlNo: document.getElementById('party-dl').value,
        fssaiNo: document.getElementById('party-fssai').value,
        city: document.getElementById('party-city').value,
        state: document.getElementById('party-state').value,
        phone: document.getElementById('party-phone').value,
        address: document.getElementById('party-address').value,
        pincode: document.getElementById('party-pincode').value,
        bankName: document.getElementById('party-bank-name').value,

        bankAccountNo: document.getElementById('party-bank-acc').value,
        bankIfsc: document.getElementById('party-bank-ifsc').value,
        hq: document.getElementById('party-hq').value,
        approved: true 
    };

    const url = id ? `${API_BASE}/admin/stockists/${id}` : `${API_BASE}/admin/stockists`;
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert("✅ Party record saved successfully!");
            closePartyModal();
            loadStockists();
        } else {
            alert("Save failed: " + (result.message || "Unknown error"));
        }
    } catch (e) { alert("Error saving party record."); }
}

function closeStockistModal() {
    document.getElementById('partyModal').classList.add('hidden');
}

function exportParties() {
    const data = allStockists.map(s => ({
        "Party Name": s.name,
        "Type": s.partyType || 'STOCKIST',
        "Login ID": s.loginId,
        "Email": s.email || '-',
        "Phone": s.phone || '-',
        "City": s.city || '-',
        "State": s.state || '-',
        "GST No": s.gstNo || '-',
        "PAN No": s.panNo || '-',
        "DL No": s.dlNo || '-',
        "FSSAI No": s.fssaiNo || '-',
        "Bank": s.bankName || '-',
        "Acc No": s.bankAccountNo || '-',
        "IFSC": s.bankIfsc || '-',
        "Outstanding": s.outstandingBalance
    }));
    downloadExcel(data, "Emyris_Party_Master");
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
                <button class="btn btn-ghost" style="padding:6px 12px; font-size: 0.65rem; color:var(--primary);" onclick="viewOrderDetails('${o._id}')">VIEW ORDER</button>
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
        
        const p = allProducts.find(pr => pr._id === item.product) || { batches: [] };
        let batchCellHtml = '';
        if (o.status === 'pending') {
            const reqQty = (item.qty || 0) + (item.bonusQty || 0);
            const availableBatches = [...(p.batches || [])]
                .filter(b => b.qtyAvailable > 0)
                .sort((a, b) => new Date(a.expDate || '2099') - new Date(b.expDate || '2099'));

            let defaultBatch = availableBatches.length > 0 ? availableBatches[0].batchNo : '';
            for (let b of availableBatches) {
                if (b.qtyAvailable >= reqQty) { defaultBatch = b.batchNo; break; }
            }
            let batchOptions = availableBatches.map(b => 
                `<option value="${b.batchNo}" ${b.batchNo === defaultBatch ? 'selected' : ''}>${b.batchNo} (Exp:${b.expDate}|Qty:${b.qtyAvailable})</option>`
            ).join('');
            if (!batchOptions) batchOptions = `<option value="">No Stock</option>`;
            batchCellHtml = `<select id="batch-${o._id}-${item._id}" class="batch-select" style="width: 100%; background: rgba(0,0,0,0.2); border: 1px solid var(--accent); color: var(--accent); border-radius: 4px; padding: 4px; font-size: 0.75rem;">${batchOptions}</select>`;
        } else {
            batchCellHtml = `<span style="font-weight: 700; color: var(--accent);">${item.batch || 'N/A'}</span>`;
        }

        return `
            <tr style="transition: all 0.2s; border-bottom: 1px solid rgba(255,255,255,0.03);">
                <td style="position: sticky; left: 0; z-index: 5; background: #0f172a; font-weight: 700; color: #f1f5f9; border-right: 1px solid rgba(255,255,255,0.05); font-size: 0.75rem;">${item.name}</td>
                <td style="text-align:center;">${batchCellHtml}</td>
                <td style="text-align:right; color:var(--text-muted); opacity: 0.8; font-family: monospace;">₹${(item.masterRate || item.priceUsed).toFixed(2)}</td>
                <td style="text-align:right; font-weight:700; color:${isNegotiated ? '#ef4444' : '#fff'}; font-family: monospace;">₹${(item.askingRate || item.priceUsed).toFixed(2)}</td>
                <td style="text-align:center; font-style:italic; font-size:0.7rem; color: #94a3b8; line-height: 1.2;">${item.negotiationNote || '-'}</td>
                <td style="text-align:center;">
                    <input type="number" step="0.01" class="final-rate-input" id="rate-${o._id}-${item._id}" 
                        value="${item.priceUsed.toFixed(2)}" 
                        style="width: 70px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 6px; color: var(--accent); font-weight: 800; text-align: center; padding: 3px; font-size: 0.75rem;">
                </td>
                <td style="text-align:center; font-weight:800; color: #fff;">${item.qty}</td>
                <td style="text-align:center; color:var(--accent); font-weight:800; font-size: 0.75rem;">+${item.bonusQty || 0}</td>
                <td style="text-align:right; font-weight:900; color:var(--primary); font-size: 0.85rem; font-family: monospace;">₹${item.totalValue.toFixed(2)}</td>
                <td style="text-align:center;">
                    ${o.status === 'pending' ? `
                        <div style="display:flex; gap:4px; justify-content:center;">
                            <button class="btn" style="padding:4px 6px; font-size:0.55rem; background: rgba(239, 68, 68, 0.1); color:#ef4444; border: 1px solid rgba(239, 68, 68, 0.2); font-weight: 800;" onclick="negotiateItem('${o._id}', '${item._id}', 'reject', this)" title="Revert to Master">REJ</button>
                            <button class="btn" style="padding:4px 6px; font-size:0.55rem; background: rgba(99, 102, 241, 0.1); color:var(--primary); border: 1px solid rgba(99, 102, 241, 0.2); font-weight: 800;" onclick="negotiateItem('${o._id}', '${item._id}', 'onetime', this)" title="Apply for this order only">1-T</button>
                            <button class="btn" style="padding:4px 6px; font-size:0.55rem; background: rgba(16, 185, 129, 0.1); color:#10b981; border: 1px solid rgba(16, 185, 129, 0.2); font-weight: 800;" onclick="negotiateItem('${o._id}', '${item._id}', 'month', this)" title="Lock for 1 Month">MON</button>
                            <button class="btn" style="padding:4px 6px; font-size:0.55rem; background: var(--accent); color:#fff; font-weight: 800;" onclick="negotiateItem('${o._id}', '${item._id}', 'year', this)" title="Lock for 1 Year">YRE</button>
                        </div>
                    ` : '<span style="font-size:0.65rem; font-weight: 900; color:var(--text-muted); letter-spacing: 0.5px;">LOCKED</span>'}
                </td>
            </tr>
        `;
    }).join('');

    const unroundedTotal = Number((o.subTotal + o.gstAmount).toFixed(2));
    const roundOffValue = (o.grandTotal - unroundedTotal).toFixed(2);

    document.getElementById('detail-subtotal').innerText = `₹${o.subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('detail-gst').innerText = `₹${o.gstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('detail-roundoff').innerText = `₹${roundOffValue}`;
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

    // HQ Assignment / Display Logic
    const hqSelection = document.getElementById('hq-selection-container');
    const hqDisplay = document.getElementById('hq-display-container');
    const hqSelect = document.getElementById('detail-hq-select');
    const hqName = document.getElementById('detail-hq-name');

    if (o.stockist && o.stockist.hq) {
        if (hqSelection) hqSelection.classList.add('hidden');
        if (hqDisplay) hqDisplay.classList.remove('hidden');
        if (hqName) hqName.innerText = o.stockist.hq;
    } else if (o.status === 'pending') {
        if (hqSelection) hqSelection.classList.remove('hidden');
        if (hqDisplay) hqDisplay.classList.add('hidden');
        // Populate hqSelect from window.masters.hq
        if (hqSelect) hqSelect.innerHTML = '<option value="">-- Select Headquarters --</option>' + 
            (window.masters.hq || []).map(h => `<option value="${h.name}">${h.name}</option>`).join('');
    } else {
        if (hqSelection) hqSelection.classList.add('hidden');
        if (hqDisplay) hqDisplay.classList.add('hidden');
    }

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
    const o = allOrders.find(x => x._id === id);
    if (!o) return;

    const batchSelections = {};
    o.items.forEach(item => {
        const select = document.getElementById(`batch-${o._id}-${item._id}`);
        if (select) {
            batchSelections[item._id] = select.value;
        }
    });

    const hqSelect = document.getElementById('detail-hq-select');
    const selectedHq = hqSelect ? hqSelect.value : null;

    if (!o.stockist?.hq && !selectedHq && o.status === 'pending') {
        alert("⚠️ MANDATORY: Please assign a Headquarters (HQ) for this stockist before approving the order.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/admin/orders/${id}/approve`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedBy: 'ADMIN', batchSelections, selectedHq })
        });
        const result = await res.json();
        if (result.success) {
            alert("✅ Order approved successfully.");
            loadOrders(); // Refresh history
        } else {
            alert(result.message || "Approval failed.");
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
                <button class="btn btn-ghost" style="padding:6px 12px; font-size: 0.65rem; color:var(--primary);" onclick="downloadInvoicePDF('${inv._id}')">DOWNLOAD PDF</button>
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
                <button class="btn btn-ghost" style="padding:6px 12px; font-size: 0.65rem;" onclick="viewPurchaseDetails('${p._id}')">VIEW</button>
                <button class="btn btn-ghost" style="padding:6px 12px; font-size: 0.65rem; color:var(--primary);" onclick="editPurchaseEntry('${p._id}')">EDIT</button>
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
    const manfName = document.getElementById('pur-manf-name').value;
    const batch = document.getElementById('pur-batch').value;
    const mfg = document.getElementById('pur-mfg').value;
    const exp = document.getElementById('pur-exp').value;
    const gstPct = Number(document.getElementById('pur-gst-pct').value);
    
    if(!prodId || qty <= 0 || rate <= 0) return alert("Please fill item details");
    
    const prod = allProducts.find(p => p._id === prodId);
    purchaseItems.push({
        product: prodId,
        name: prod.name,
        manufacturer: manfName || prod.manufacturer || 'N/A',
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
    document.getElementById('pur-manf-name').value = '';
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
                <small style="color:var(--text-muted)">Mfg: ${item.manufacturer || '-'} | HSN: ${item.hsn || '-'}</small>
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


async function loadFinancialNotes() {
    try {
        const res = await fetch('/api/admin/financial-notes');
        allNotes = await res.json();
        renderFinancialNotes();
    } catch (e) { console.error("Load notes fail", e); }
}

function filterNotes() {
    const query = document.getElementById('noteSearch').value.toLowerCase();
    
    // Update dynamic title
    const titleEl = document.getElementById('notes-page-title');
    if (titleEl) {
        if (currentNoteReason === 'ALL') titleEl.innerText = "📝 Global Financial Adjustments";
        else titleEl.innerText = `📝 ${currentNoteReason} Records`;
    }

    const filtered = allNotes.filter(n => {
        const matchesQuery = n.noteNo.toLowerCase().includes(query) || n.partyName.toLowerCase().includes(query);
        const matchesReason = currentNoteReason === 'ALL' || n.reason === currentNoteReason;
        return matchesQuery && matchesReason;
    });
    
    renderFinancialNotes(filtered);
}

function updateNotePartyDetails(id, infoId = 'note-party-info') {
    const s = allStockists.find(x => x._id === id);
    const info = document.getElementById(infoId);
    if (s && info) {
        info.innerText = `Current Outstanding: ₹${s.outstandingBalance.toLocaleString('en-IN')}`;
    } else if (info) {
        info.innerText = '';
    }
}

function renderFinancialNotes(data = allNotes) {
    const tbody = document.getElementById('noteTableBody');
    if (!tbody) return;

    tbody.innerHTML = data.map(n => {
        const isPending = n.status === 'pending';
        const statusBadge = n.status 
            ? `<span class="badge ${n.status === 'approved' ? 'badge-approved' : (n.status === 'rejected' ? 'badge-rejected' : 'badge-pending')}" style="font-size:0.6rem; margin-top:2px;">${n.status.toUpperCase()}</span>`
            : '';

        return `
            <tr>
                <td style="font-family:monospace; font-weight:700; color:${n.noteType === 'CN' ? 'var(--accent)' : '#ef4444'};">
                    ${n.noteNo}
                    <br>${statusBadge}
                </td>
                <td><span class="badge ${n.noteType === 'CN' ? 'badge-approved' : 'badge-pending'}">${n.noteType === 'CN' ? 'CREDIT' : 'DEBIT'}</span></td>
                <td style="font-weight:600;">${n.partyName}</td>
                <td>
                    <div style="font-weight:700;">${n.reason}</div>
                    ${n.items && n.items.length > 0 
                        ? `<div style="font-size:0.7rem; color:var(--text-muted);">📦 ${n.items.length} Items | Inv: ${n.refInvoiceNo || '-'}</div>` 
                        : (n.productName ? `<div style="font-size:0.7rem; color:var(--text-muted);">📦 ${n.productName} | ${n.batchNo} | Qty: ${n.qty}</div>` : '')}
                </td>
                <td style="text-align:right; font-weight:800; color:${n.noteType === 'CN' ? 'var(--accent)' : '#ef4444'};">₹${n.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td>${new Date(n.createdAt).toLocaleDateString('en-GB')}</td>
                <td style="text-align:right; display: flex; gap: 5px; justify-content: flex-end; align-items: center;">
                    ${isPending ? `
                        <button class="btn btn-primary" style="padding:4px 8px; font-size:0.65rem; background:#10b981;" onclick="reviewPDCNClaim('${n._id}', 'approve')">APPROVE</button>
                        <button class="btn btn-primary" style="padding:4px 8px; font-size:0.65rem; background:#ef4444;" onclick="reviewPDCNClaim('${n._id}', 'reject')">REJECT</button>
                    ` : ''}
                    <button class="btn btn-ghost" style="padding:5px 10px;" onclick="editNote('${n._id}')" title="Edit Record">✏️</button>
                    <button class="btn btn-ghost" style="padding:5px 10px;" onclick="downloadNotePDF('${n._id}')" title="Download PDF">📥</button>
                    <button class="btn btn-ghost" style="padding:5px 10px; color:#ef4444;" onclick="deleteNote('${n._id}')" title="Delete Record">✕</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function reviewPDCNClaim(id, action) {
    if (!confirm(`Are you sure you want to ${action} this claim?`)) return;
    try {
        const res = await fetch(`/api/admin/pdcn-claim/${id}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        const result = await res.json();
        if (result.success) {
            alert(result.message);
            loadFinancialNotes();
        } else {
            alert("Error: " + result.error);
        }
    } catch (e) { alert("Action failed"); }
}

async function editNote(id) {
    const note = allNotes.find(x => x._id === id);
    if (!note) return;
    currentEditingNoteId = id;
    // Any note that was created with items OR belongs to a multi-item module goes to unified table
    const multiItemReasons = ['Salable Return','Exp/Brk/Damg CN','Price Diff CN','Purchase Return','Price Diff DN','Brk/Dmg/Loss DN'];
    if ((note.items && note.items.length > 0) || multiItemReasons.includes(note.reason)) {
        openReturnModal(note.reason, note);
    } else {
        openNoteModal(note);
    }
}

async function deleteNote(id) {
    if (!confirm("⚠️ CAUTION: Are you sure you want to COMPLETELY DELETE this note?\n\nThis will REVERSE all inventory changes and accounting impacts (Stockist balance will be adjusted back). This action cannot be undone.")) return;

    try {
        const res = await fetch(`/api/admin/financial-notes/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            alert("✅ Note deleted and all impacts reversed successfully.");
            await loadFinancialNotes();
            await loadProducts();
            await loadStockists();
            renderFinancialNotes();
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) { alert("Failed to delete note"); }
}

function openNoteModal(editData = null) {
    // Route ALL multi-item module types to the unified return modal
    const multiItemReasons = ['Salable Return','Exp/Brk/Damg CN','Price Diff CN','Purchase Return','Price Diff DN','Brk/Dmg/Loss DN'];
    const activeReason = editData ? editData.reason : currentNoteReason;
    if (!editData && multiItemReasons.includes(activeReason)) {
        openReturnModal(activeReason);
        return;
    }

    const select = document.getElementById('note-party');
    if(select) {
        select.innerHTML = '<option value="">-- Select Party --</option>' + 
            allStockists.map(s => `<option value="${s._id}">${s.name} (${s.partyType || 'STOCKIST'})</option>`).join('');
    }

    const prodSelect = document.getElementById('note-product');
    if(prodSelect) {
        prodSelect.innerHTML = '<option value="">-- Select Product --</option>' + 
            allProducts.map(p => `<option value="${p._id}">${p.name} (${p.packing})</option>`).join('');
    }
    
    const form = document.getElementById('noteForm');
    if(form) form.reset();
    document.getElementById('note-inventory-fields').classList.add('hidden');

    if (editData) {
        document.getElementById('note-type').value = editData.noteType;
        document.getElementById('note-party').value = editData.party?._id || editData.party;
        updateNotePartyDetails(editData.party?._id || editData.party);
        
        document.getElementById('note-amount').value = editData.amount;
        document.getElementById('note-reason').value = editData.reason;
        toggleNoteInventoryFields(editData.reason); // Trigger visibility toggle!
        
        document.getElementById('note-desc').value = editData.description;
        if (editData.productId) {
            document.getElementById('note-product').value = editData.productId;
            document.getElementById('note-batch').value = editData.batchNo || '';
            document.getElementById('note-qty').value = editData.qty || 0;
        }
        document.getElementById('note-modal-title').innerText = "✏️ Edit Financial Note";
    } else {
        document.getElementById('note-modal-title').innerText = "📝 Record Financial Adjustment";
        currentEditingNoteId = null;
    }

    document.getElementById('noteModal').classList.remove('hidden');
}

function toggleNoteInventoryFields(reason) {
    const fields = document.getElementById('note-inventory-fields');
    const typeSelect = document.getElementById('note-type');
    
    // Auto-set Note Type based on common patterns
    if (reason.includes('CN') || reason === 'Salable Return') {
        typeSelect.value = 'CN';
    } else if (reason.includes('DN') || reason === 'Purchase Return') {
        typeSelect.value = 'DN';
    }

    if (reason === 'Salable Return' || reason === 'Purchase Return' || reason === 'Exp/Brk/Damg CN') {
        fields.classList.remove('hidden');
    } else {
        fields.classList.add('hidden');
    }
}

function updateNoteBatches(productId) {
    const p = allProducts.find(x => x._id === productId);
    if (!p) return;
    // We could make this a select, but for now we'll let them type or auto-fill first available
    if (p.batches && p.batches.length > 0) {
        document.getElementById('note-batch').value = p.batches[0].batchNo;
    }
}

function closeNoteModal() {
    document.getElementById('noteModal').classList.add('hidden');
    currentEditingNoteId = null;
}

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
    document.getElementById('returnModal').classList.add('hidden');
    currentEditingNoteId = null;
}

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
                <option value="">â€” Product â€”</option>
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
        <td style="${cellStyle}padding-right:8px;text-align:right;font-weight:800;color:#e2e8f0;font-family:monospace;font-size:0.72rem;" id="return-row-total-${id}">â‚¹0.00</td>
        <td style="padding:4px 6px;text-align:center;">
            <button type="button" onclick="removeReturnRow('${id}')"
                style="background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:0.8rem;opacity:0.6;padding:2px 5px;border-radius:4px;transition:opacity 0.2s;"
                onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">âœ•</button>
        </td>
    `;
    document.getElementById('return-items-body').appendChild(row);
    returnItems.push(id);
    return id;
}
function removeReturnRow(id) {
    if(returnItems.length <= 1) return;
    document.getElementById(`return-row-${id}`).remove();
    returnItems = returnItems.filter(x => x != id);
    calculateReturnTotals();
}

function updateReturnRowData(rowId, productId) {
    const p = allProducts.find(x => x._id === productId);
    if (p) {
        document.getElementById(`return-hsn-${rowId}`).value   = p.hsn || '';
        document.getElementById(`return-price-${rowId}`).value = p.pts || 0;
        document.getElementById(`return-gst-pct-${rowId}`).value = p.gstPercent || 12;
        if (p.batches && p.batches.length > 0) {
            const b = p.batches[0];
            document.getElementById(`return-batch-${rowId}`).value = b.batchNo || '';
            // Auto-fill MM / Year selects from batch expDate (stored as MM/YY or MM/YYYY)
            if (b.expDate) {
                const parts = b.expDate.split('/');
                const mm = (parts[0] || '').padStart(2,'0');
                const yy = parts[1] || '';
                const fullYear = yy.length === 2 ? '20' + yy : yy;
                const mSel = document.getElementById(`return-exp-mm-${rowId}`);
                const ySel = document.getElementById(`return-exp-yy-${rowId}`);
                if (mSel) mSel.value = mm;
                if (ySel) ySel.value = fullYear;
            }
        }
    }
    calculateReturnTotals();
}

function calculateReturnTotals() {
    let subtotal = 0;
    let gstTotal = 0;

    returnItems.forEach(id => {
        const qty = Number(document.getElementById(`return-qty-${id}`).value) || 0;
        const price = Number(document.getElementById(`return-price-${id}`).value) || 0;
        const gstPct = Number(document.getElementById(`return-gst-pct-${id}`).value) || 0;
        
        const taxable = qty * price;
        const gst = taxable * (gstPct / 100);
        const rowTotal = taxable + gst;
        
        subtotal += taxable;
        gstTotal += gst;
        
        document.getElementById(`return-row-total-${id}`).innerText = `₹${rowTotal.toFixed(2)}`;
    });

    const total = subtotal + gstTotal;
    const rounded = Math.round(total);
    const roundOff = rounded - total;

    document.getElementById('return-subtotal').innerText = `₹${subtotal.toLocaleString('en-IN', {minimumFractionDigits:2})}`;
    document.getElementById('return-gst').innerText = `₹${gstTotal.toLocaleString('en-IN', {minimumFractionDigits:2})}`;
    document.getElementById('return-roundoff').innerText = `₹${roundOff.toFixed(2)}`;
    document.getElementById('return-total').innerText = `₹${rounded.toLocaleString('en-IN', {minimumFractionDigits:2})}`;
}

async function saveMultiItemReturn(e) {
    e.preventDefault();
    const reasonValue = document.getElementById('return-reason').value;
    
    // Strict Header Validation
    if(!document.getElementById('return-party').value) return alert("❌ Please select a Party.");
    if(!document.getElementById('return-inv-no').value) return alert("❌ Ref. Invoice No is mandatory.");
    if(!document.getElementById('return-inv-date').value) return alert("❌ Invoice Date is mandatory.");

    try {
        const items = returnItems.map(id => {
            const prodId = document.querySelector(`#return-row-${id} .return-prod-select`).value;
            const p      = allProducts.find(x => x._id === prodId);
            const qty    = Number(document.getElementById(`return-qty-${id}`).value);
            const price  = Number(document.getElementById(`return-price-${id}`).value);
            const gstPct = Number(document.getElementById(`return-gst-pct-${id}`).value);
            const batch  = document.getElementById(`return-batch-${id}`).value;
            const hsn    = document.getElementById(`return-hsn-${id}`).value;
            // Read MM/YY from dropdowns
            const expMM  = (document.getElementById(`return-exp-mm-${id}`)?.value || '');
            const expYY  = (document.getElementById(`return-exp-yy-${id}`)?.value || '');
            const exp    = (expMM && expYY) ? `${expMM}/${String(expYY).slice(-2)}` : '';

            if (!prodId || !qty || !price || !batch || !exp) {
                throw new Error('All columns (Product, Batch, Exp Month/Year, Qty, Price) are mandatory.');
            }
            const taxable = qty * price;
            return {
                productId:    prodId,
                name:         p ? p.name : 'Unknown',
                manufacturer: p ? p.manufacturer : 'EMYRIS',
                qty, hsn, batchNo: batch, expDate: exp, price, gstPercent: gstPct,
                totalValue: taxable + (taxable * (gstPct / 100))
            };
        });

        if(items.length === 0) return alert("Please add at least one product.");

        // --- PDCN QUANTITY VALIDATION ---
        if (reasonValue === 'Price Diff CN') {
            const partyId = document.getElementById('return-party').value;
            try {
                const elRes = await fetch(`/api/admin/pdcn/eligibility/${partyId}`);
                const elData = await elRes.json();
                if (elData.success) {
                    const eligibility = elData.eligibility;
                    for (const item of items) {
                        const pid = String(item.productId);
                        const data = eligibility[pid];
                        const billed = data ? data.totalBilledQty : 0;
                        const claimed = data ? data.totalClaimedQty : 0;
                        const eligible = data ? data.eligibleQty : 0;

                        // If we are EDITING an existing note, we must exclude its own previous quantity from "claimed"
                        // But for simplicity in this admin tool, we'll just check against absolute billed limit
                        // if we want to be precise: eligibleForThisAction = billed - (claimed - (isEditing ? oldQty : 0))
                        
                        if (item.qty > billed) {
                            return alert(`❌ QUANTITY ERROR: Product "${item.name}" was only billed ${billed} units. You cannot raise a PDCN for ${item.qty} units.`);
                        }
                    }
                }
            } catch (e) { console.error("Eligibility check failed:", e); }
        }

        const totalStr = document.getElementById('return-total').innerText.replace(/[₹,]/g, '');
        const subTotalStr = document.getElementById('return-subtotal').innerText.replace(/[₹,]/g, '');
        const gstAmountStr = document.getElementById('return-gst').innerText.replace(/[₹,]/g, '');
        
        const data = {
            noteType:      document.getElementById('return-note-type').value || (reasonValue === 'Salable Return' ? 'CN' : 'DN'),
            party:         document.getElementById('return-party').value,
            amount:        Number(totalStr),
            subTotal:      Number(subTotalStr),
            gstAmount:     Number(gstAmountStr),
            reason:        reasonValue,
            description:   `Multi-item return against Inv: ${document.getElementById('return-inv-no').value}`,
            refInvoiceNo:  document.getElementById('return-inv-no').value,
            refInvoiceDate:document.getElementById('return-inv-date').value,
            items
        };

        const url = currentEditingNoteId ? `/api/admin/financial-notes/${currentEditingNoteId}` : '/api/admin/financial-notes';
        const method = currentEditingNoteId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if(result.success) {
            alert(currentEditingNoteId ? "Note Updated Successfully!" : "Return Processed & Document Generated!");
            closeReturnModal();
            await loadFinancialNotes();
            await loadProducts();
            await loadStockists();
            // Automatically trigger download of the new/updated note
            if (result.note && result.note._id) {
                downloadNotePDF(result.note._id);
            }
        } else {
            alert("Error: " + result.error);
        }
    } catch (e) { alert(e.message || "Submission failed"); }
}

async function saveFinancialNote(e) {
    e.preventDefault();
    const data = {
        noteType: document.getElementById('note-type').value,
        party: document.getElementById('note-party').value,
        amount: Number(document.getElementById('note-amount').value),
        reason: document.getElementById('note-reason').value,
        description: document.getElementById('note-desc').value,
        productId: document.getElementById('note-product').value,
        batchNo: document.getElementById('note-batch').value,
        qty: Number(document.getElementById('note-qty').value)
    };

    try {
        const url = currentEditingNoteId ? `/api/admin/financial-notes/${currentEditingNoteId}` : '/api/admin/financial-notes';
        const method = currentEditingNoteId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert(currentEditingNoteId ? "✅ Note Updated Successfully!" : "✅ Financial Note Issued Successfully!");
            await loadFinancialNotes();
            await loadStockists();
            await loadProducts();
            renderFinancialNotes();
            closeNoteModal();
        }
    } catch (e) { alert("Failed to save note"); }
}

// --- MASTER PDF ENGINE (EXTRACTED TEMPLATE) ---
function numberToWords(num) {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const g = ['', 'Thousand', 'Lakh', 'Crore'];
    const makeGroup = (n) => {
        let s = '';
        if (n >= 100) { s += a[Math.floor(n / 100)] + 'Hundred '; n %= 100; }
        if (n >= 20) { s += b[Math.floor(n / 10)] + ' '; n %= 10; }
        if (n > 0) s += a[n];
        return s;
    };
    if (num === 0) return 'Zero';
    let ns = num.toString().split('.');
    let integer = parseInt(ns[0]);
    let fraction = ns[1] ? parseInt(ns[1]) : 0;
    let out = ''; let i = 0;
    while (integer > 0) {
        let group = (i === 0) ? integer % 1000 : integer % 100;
        integer = (i === 0) ? Math.floor(integer / 1000) : Math.floor(integer / 100);
        if (group > 0) out = makeGroup(group) + (g[i] ? g[i] + ' ' : '') + out;
        i++;
    }
    let final = 'Rupees ' + out.trim();
    if (fraction > 0) final += ' and ' + (fraction < 10 ? '0'+fraction : fraction) + '/100 Paise';
    return final + ' Only';
}

async function generateStandardPDF({ 
    title, 
    subTitle = "Original For Recipient",
    docNo, 
    docTypeLabel = "Invoice No",
    date, 
    party, 
    items, 
    grandTotal, 
    terms, 
    showBank,
    extraFields = [], // e.g., [{label: 'Ref Invoice', value: '...'}]
    filename = "Document.pdf"
}) {
    const { jsPDF } = window.jspdf || window;
    if (!jsPDF) {
        console.error("jsPDF library not found! Please check your internet connection or script includes.");
        alert("CRITICAL ERROR: PDF library not loaded. Please refresh the page.");
        return;
    }
    const doc = new jsPDF('p', 'mm', 'a4');
    const style = (companyProfile && companyProfile.invoiceStyle) || 'classic';

    const themes = {
        classic: { primary: [99, 102, 241], secondary: [40, 44, 52] },
        modern:  { primary: [16, 185, 129], secondary: [30, 41, 59] },
        compact: { primary: [245, 158, 11], secondary: [51, 65, 85] }
    };
    const t = themes[style] || themes.classic;

    // 1. Header Logic
    if (style === 'modern') {
        doc.setFillColor(t.primary[0], t.primary[1], t.primary[2]);
        doc.rect(0, 0, 210, 45, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold"); doc.setFontSize(22);
        doc.text(title, 15, 18);
        doc.setFontSize(10); doc.text((companyProfile && companyProfile.name) || "EMYRIS BIOLIFESCIENCES", 15, 28);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        doc.text(`GSTIN: ${(companyProfile && companyProfile.gstNo) || 'N/A'} | DL: ${(companyProfile && companyProfile.dlNo) || 'N/A'}`, 15, 34);
        doc.text(`Contact: ${(companyProfile && companyProfile.phones?.[0]) || 'N/A'}`, 15, 38);
        doc.setFont("helvetica", "bold");
        doc.text(`${docTypeLabel}: ${docNo}`, 195, 18, { align: 'right' });
        doc.setFont("helvetica", "normal");
        doc.text(`DATE: ${date}`, 195, 28, { align: 'right' });
        doc.setTextColor(40, 44, 52);
    } else if (style === 'compact') {
        doc.setDrawColor(t.primary[0], t.primary[1], t.primary[2]); doc.setLineWidth(1); doc.line(15, 8, 195, 8);
        doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(t.primary[0], t.primary[1], t.primary[2]);
        doc.text((companyProfile && companyProfile.name) || "EMYRIS BIOLIFESCIENCES", 15, 15);
        doc.setFontSize(8); doc.setTextColor(100, 100, 100);
        doc.text(`GST: ${(companyProfile && companyProfile.gstNo) || 'N/A'} | DL: ${(companyProfile && companyProfile.dlNo) || 'N/A'}`, 15, 24);
        doc.setTextColor(t.secondary[0], t.secondary[1], t.secondary[2]);
        doc.setFontSize(10); doc.text(title, 195, 15, { align: 'right' });
        doc.setFontSize(8); doc.text(`${docTypeLabel}: ${docNo} | DT: ${date}`, 195, 24, { align: 'right' });
    } else {
        doc.setFontSize(14); doc.setTextColor(t.primary[0], t.primary[1], t.primary[2]);
        doc.setFont("helvetica", "bold"); doc.text(title, 105, 12, { align: 'center' });
        doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.text(subTitle, 195, 7, { align: 'right' });
        doc.setDrawColor(t.primary[0], t.primary[1], t.primary[2]); doc.setLineWidth(0.5); doc.line(105, 15, 105, 65); 
        if (companyProfile && companyProfile.logoImage) { try { doc.addImage(companyProfile.logoImage, 'JPEG', 15, 8, 30, 15); } catch(e){} }
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(t.primary[0], t.primary[1], t.primary[2]);
        doc.text((companyProfile && companyProfile.name) || "EMYRIS BIOLIFESCIENCES", 15, 28);
        doc.setFont("helvetica", "normal"); doc.setTextColor(40, 44, 52); doc.setFontSize(8);
        const addressLines = doc.splitTextToSize((companyProfile && companyProfile.address) || "Sumadhura Pragati Chambers, Park Ln, Secunderabad, Telangana - 500003", 80);
        doc.text(addressLines, 15, 33);
        let cY = 33 + (addressLines.length * 4);
        doc.text(`DL No: ${(companyProfile && companyProfile.dlNo) || 'N/A'}`, 15, cY);
        doc.text(`GSTIN: ${(companyProfile && companyProfile.gstNo) || 'N/A'}`, 15, cY + 4);
        doc.text(`FSSAI: ${(companyProfile && companyProfile.fssaiNo) || 'N/A'}`, 15, cY + 8);
        doc.text(`Contact: ${(companyProfile && companyProfile.phones?.[0]) || 'N/A'}`, 15, cY + 12);
        doc.text(`Email: ${(companyProfile && companyProfile.emails?.[0]) || 'N/A'}`, 15, cY + 16);
    }

    // 2. Party Info
    let infoY = (style === 'modern') ? 52 : (style === 'compact' ? 32 : 15);
    doc.setFontSize(style === 'compact' ? 8 : 9); doc.setFont("helvetica", "bold"); doc.setTextColor(t.primary[0], t.primary[1], t.primary[2]);
    doc.text("BILL TO / SHIP TO:", style === 'classic' ? 115 : 15, infoY);
    doc.setFont("helvetica", "normal"); doc.setTextColor(40, 44, 52);
    doc.text(party.name || 'N/A', style === 'classic' ? 115 : 15, infoY + 5);
    const pAddr = doc.splitTextToSize(party.address || 'N/A', 80);
    doc.text(pAddr, style === 'classic' ? 115 : 15, infoY + 10);
    
    if (style === 'classic') {
        let sY = infoY + 10 + (pAddr.length * 4);
        doc.setFontSize(8); 
        doc.text(`DL No: ${party.dl || 'N/A'}`, 115, sY); 
        doc.text(`GSTIN: ${party.gst || 'N/A'}`, 115, sY + 4);
        doc.text(`FSSAI: ${party.fssai || 'N/A'}`, 115, sY + 8);
        doc.text(`Contact: ${party.phone || 'N/A'}`, 115, sY + 12);
        doc.text(`Email: ${party.email || 'N/A'}`, 115, sY + 16);
        doc.setFont("helvetica", "bold"); doc.setTextColor(t.primary[0], t.primary[1], t.primary[2]);
        doc.text(`${docTypeLabel}: ${docNo}`, 115, sY + 20);
        doc.setTextColor(40, 44, 52); doc.text(`Date: ${date}`, 115, sY + 24);
        extraFields.forEach((f, i) => doc.text(`${f.label}: ${f.value}`, 115, sY + 28 + (i * 4)));
    }

    // 3. Items Table
    doc.autoTable({
        startY: style === 'classic' ? 70 : (style === 'compact' ? 55 : 85),
        head: [['S.No', 'Description', 'HSN', 'Batch', 'Exp', 'MRP', 'Qty', 'Unit', 'Price', 'Taxable', 'GST%', 'Amount']],
        body: items.map((it, idx) => {
            const taxable = it.qty * it.price;
            const gross = taxable * (1 + (it.gstPercent || 0) / 100);
            return [
                idx + 1, { content: `${it.name}\n(Mfg: ${it.manufacturer || 'EMYRIS'})`, styles: { fontSize: style === 'compact' ? 6 : 7 } },
                it.hsn || '-', it.batch || 'B2401', it.exp || '12/25', (it.mrp || 0).toFixed(2), it.qty, 'NOS', it.price.toFixed(2), taxable.toFixed(2), (it.gstPercent || 0) + '%', gross.toFixed(2)
            ];
        }),
        theme: style === 'modern' ? 'striped' : 'grid',
        headStyles: { fillColor: t.primary, fontSize: style === 'compact' ? 6 : 7, halign: 'center' },
        styles: { fontSize: style === 'compact' ? 6 : 7, cellPadding: style === 'compact' ? 1 : 2 },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 40 },
            9: { halign: 'right' },
            11: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 15, right: 15, bottom: 60 }
    });

    let tableFinalY = doc.lastAutoTable.finalY + 5;

    // 4. Tax Summary
    const taxMap = {};
    let totalTaxable = 0;
    let totalGST = 0;

    items.forEach(it => {
        const rate = parseFloat(it.gstPercent) || 0;
        const taxable = it.qty * it.price;
        const gst = (taxable * rate) / 100;
        
        if (!taxMap[rate]) taxMap[rate] = { taxable: 0, tax: 0 };
        taxMap[rate].taxable += taxable;
        taxMap[rate].tax += gst;
        
        totalTaxable += taxable;
        totalGST += gst;
    });

    const isInter = party.gst && companyProfile.gstNo && companyProfile.gstNo.substring(0,2) !== party.gst.substring(0,2);
    let taxBody = [];
    Object.keys(taxMap).sort((a,b)=>a-b).forEach(r => {
        const rate = parseFloat(r); const d = taxMap[r];
        if (isInter) { taxBody.push([`IGST @ ${rate}%`, d.taxable.toFixed(2), `${rate}%`, d.tax.toFixed(2)]); }
        else {
            const hR = (rate / 2).toFixed(1); const hT = (d.tax / 2).toFixed(2);
            taxBody.push([`CGST @ ${hR}%`, d.taxable.toFixed(2), `${hR}%`, hT]);
            taxBody.push([`SGST @ ${hR}%`, d.taxable.toFixed(2), `${hR}%`, hT]);
        }
    });

    doc.autoTable({
        startY: tableFinalY, head: [['Tax Summary', 'Taxable', 'Rate', 'Tax Amount']], body: taxBody,
        theme: 'plain', headStyles: { fillColor: false, textColor: t.primary, fontStyle: 'bold', fontSize: 7, halign: 'right' },
        styles: { fontSize: 7, halign: 'right', cellPadding: 1 }, margin: { left: 110, right: 15 }, tableWidth: 85
    });

    // 5. Footer
    const finalY = 240;
    doc.setDrawColor(t.primary[0], t.primary[1], t.primary[2]); doc.setLineWidth(0.5); doc.line(15, finalY - 15, 195, finalY - 15);
    doc.setFont("helvetica", "bold"); doc.setTextColor(t.primary[0], t.primary[1], t.primary[2]); doc.setFontSize(9);
    doc.text("Amount in Words:", 15, finalY - 10);
    doc.setTextColor(40, 44, 52); doc.setFont("helvetica", "normal");
    doc.text("(" + numberToWords(grandTotal) + ")", 15, finalY + 5);

    // 5. Total Block (Right Side)
    const unroundedNet = Number((totalTaxable + totalGST).toFixed(2));
    const roundOffValue = (grandTotal - unroundedNet).toFixed(2);
    
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(40, 44, 52);
    doc.text(`Sub Total (Taxable): Rs. ${totalTaxable.toLocaleString('en-IN', {minimumFractionDigits:2})}`, 195, finalY - 10, { align: 'right' });
    doc.text(`GST Amount: Rs. ${totalGST.toLocaleString('en-IN', {minimumFractionDigits:2})}`, 195, finalY - 5, { align: 'right' });
    doc.text(`Round Off: Rs. ${roundOffValue}`, 195, finalY, { align: 'right' });
    
    doc.setFont("helvetica", "bold"); doc.setTextColor(t.primary[0], t.primary[1], t.primary[2]);
    doc.text(`NET PAYABLE: Rs. ${grandTotal.toLocaleString('en-IN', {minimumFractionDigits:2})}`, 195, finalY + 5, { align: 'right' });

    // 6. Bank & QR Code
    if (showBank && companyProfile && companyProfile.bankDetails) {
        doc.setTextColor(0, 0, 0); // BLACK COLOR FOR BANK DETAILS
        doc.setFont("courier", "bold"); doc.setFontSize(style === 'compact' ? 7 : 8);
        doc.text("Bank Details:", 15, finalY + 15);
        doc.setFont("courier", "normal");
        const bD = companyProfile.bankDetails.split('\n');
        bD.forEach((line, i) => doc.text(line, 15, finalY + 19 + (i * 4)));

        // QR Code Logic
        let upiTarget = companyProfile.upiId;
        if (!upiTarget && companyProfile.bankAccountNo && companyProfile.bankIfsc) {
            upiTarget = `${companyProfile.bankAccountNo}@${companyProfile.bankIfsc.toUpperCase().trim()}.ifsc.npci`;
        }
        if (upiTarget && window.QRCode) {
            try {
                const upiUrl = `upi://pay?pa=${upiTarget}&pn=${encodeURIComponent(companyProfile.name || 'EMYRIS')}&am=${Math.round(grandTotal)}&cu=INR`;
                const qrDataUrl = await QRCode.toDataURL(upiUrl, { width: 150, margin: 1 });
                doc.addImage(qrDataUrl, 'PNG', 100, finalY + 10, 30, 30);
                doc.setFontSize(6); doc.text("Scan to Pay", 115, finalY + 42, { align: 'center' });
            } catch(err) { console.error("QR Error", err); }
        }
    }

    doc.setFontSize(style === 'compact' ? 7 : 8); doc.setFont("helvetica", "italic"); doc.setTextColor(0, 0, 0); // BLACK COLOR FOR TERMS
    const tC = terms ? terms.split('\n') : []; tC.forEach((line, i) => doc.text(line, 15, 280 + (i * 4)));

    doc.setFont("helvetica", "bold");
    doc.text(`For ${(companyProfile && companyProfile.name) || "EMYRIS BIOLIFESCIENCES"}`, 195, finalY + 30, { align: 'right' });
    if (companyProfile && companyProfile.signatureImage) { try { doc.addImage(companyProfile.signatureImage, 'JPEG', 165, finalY + 32, 30, 10); } catch(e){} }
    doc.text("Authorised Signatory", 195, finalY + 45, { align: 'right' });

    doc.save(filename);
}

async function downloadNotePDF(id) {
    try {
        const note = allNotes.find(x => x._id === id);
        if (!note) return alert("Note not found");
        const party = allStockists.find(s => s._id === (note.party?._id || note.party)) || {};
        const isCN = note.noteType === 'CN';
                const reasonTitles = {
            'Salable Return':   'CREDIT NOTE (SALES RETURN)',
            'Exp/Brk/Damg CN':  'CREDIT NOTE (EXP/BRK/DAMG)',
            'Price Diff CN':    'CREDIT NOTE (PRICE DIFFERENCE)',
            'Purchase Return':  'DEBIT NOTE (PURCHASE RETURN)',
            'Price Diff DN':    'DEBIT NOTE (PRICE DIFFERENCE)',
            'Brk/Dmg/Loss DN':  'DEBIT NOTE (BRK/DMG/LOSS)'
        };
        const pdfTitle = reasonTitles[note.reason] || (isCN ? "CREDIT NOTE" : "DEBIT NOTE");

        await generateStandardPDF({
            title: pdfTitle, subtitle: "Original For Recipient", docNo: note.noteNo, docTypeLabel: isCN ? "CN No" : "DN No",
            date: new Date(note.createdAt).toLocaleDateString('en-GB'),
            party: { 
                name: note.partyName, 
                address: party.address, 
                dl: party.dlNo || party.dl || 'N/A', 
                gst: party.gstNo || party.gst || 'N/A',
                fssai: party.fssaiNo || party.fssai || 'N/A',
                phone: party.phoneNo || party.phone || 'N/A',
                email: party.email || 'N/A'
            },
            items: note.items && note.items.length > 0 ? note.items.map(it => ({
                name: it.name, manufacturer: it.manufacturer, hsn: it.hsn, batch: it.batchNo, exp: it.expDate,
                mrp: it.mrp || it.price, qty: it.qty, price: it.price, gstPercent: it.gstPercent, totalValue: it.totalValue
            })) : [{ name: note.reason, qty: 1, price: note.amount, gstPercent: 0, totalValue: note.amount, exp: '-', hsn: '-', batch: '-', manufacturer: 'EMYRIS' }],
            grandTotal: note.amount,
            terms: isCN ? (companyProfile.cnTerms || "") : (companyProfile.dnTerms || ""),
            showBank: isCN ? !!companyProfile.cnBankVisible : !!companyProfile.dnBankVisible,
            extraFields: note.refInvoiceNo ? [{ label: 'Ref Invoice', value: note.refInvoiceNo }] : [],
            filename: `${isCN ? 'CN' : 'DN'}_${note.noteNo}.pdf`
        });
    } catch (e) { console.error("PDF Fail", e); }
}

async function downloadInvoicePDF(id) {
    try {
        const inv = allInvoices.find(x => x._id === id);
        if (!inv) return;
        const party = allStockists.find(s => s.name === inv.stockistName) || {};
        await generateStandardPDF({
            title: "TAX INVOICE",
            subTitle: "Original For Buyer",
            docNo: inv.invoiceNo,
            docTypeLabel: "Invoice No",
            date: new Date(inv.createdAt).toLocaleDateString('en-GB'),
            party: { 
                name: inv.stockistName, 
                address: party.address, 
                dl: party.dl || party.dlNo || 'N/A', 
                gst: party.gst || party.gstNo || 'N/A',
                fssai: party.fssai || party.fssaiNo || 'N/A',
                phone: party.phone || party.phoneNo || 'N/A',
                email: party.email || 'N/A'
            },
            items: inv.items.map(it => ({
                name: it.name, manufacturer: it.manufacturer, hsn: it.hsn, batch: it.batch, exp: it.expDate || it.exp || '-',
                mrp: it.mrp || 0, qty: it.qty, price: it.priceUsed || it.price || 0, gstPercent: it.gstPercent || 12, totalValue: it.totalValue || 0
            })),
            grandTotal: inv.grandTotal,
            terms: companyProfile.invoiceTerms || "",
            showBank: !!companyProfile.invoiceBankVisible,
            filename: `Invoice_${inv.invoiceNo}.pdf`
        });
    } catch (e) { console.error("Invoice PDF Fail", e); }
}

function previewInvoiceStyle(style) {
    generateStandardPDF({
        title: "PREVIEW: TAX INVOICE",
        subTitle: "Specimen Copy", docNo: "TEMP-001", docTypeLabel: "Invoice No",
        date: new Date().toLocaleDateString('en-GB'),
        party: { name: "SAMPLE STOCKIST PVT LTD", address: "123 Business Park, Pharma Zone, Industrial Estate", dl: "DL-12345-X", gst: "36AAAAA0000A1Z5" },
        items: [
            { name: "PARACETAMOL 500MG", manufacturer: "EMYRIS", hsn: "3004", batch: "BT2401", exp: "12/2026", mrp: 15.00, qty: 100, price: 10.00, gstPercent: 12, totalValue: 1120.00 },
            { name: "AMOXICILLIN CAPSULES", manufacturer: "EMYRIS", hsn: "3004", batch: "AX992", exp: "06/2025", mrp: 45.00, qty: 50, price: 30.00, gstPercent: 12, totalValue: 1680.00 }
        ],
        grandTotal: 2800.00,
        terms: "1. Sample Preview Terms.\n2. This is a specimen copy.",
        showBank: true,
        filename: `Preview_${style}.pdf`
    });
}

function viewPurchaseDetails(id) {
    const p = allPurchaseEntries.find(x => x._id === id);
    if (!p) return;
    
    let itemSummary = p.items.map(i => `${i.name} [Batch: ${i.batch || 'N/A'}] - Qty: ${i.qty}`).join('\n');
    alert(`🛒 PURCHASE RECORD: ${p.purchaseNo}\n----------------------------------\nSupplier: ${p.supplierName}\nInv No: ${p.supplierInvoiceNo}\nDate: ${new Date(p.invoiceDate).toLocaleDateString('en-GB')}\nLR No: ${p.lrNo || 'N/A'}\n\nITEMS:\n${itemSummary}\n----------------------------------\ Grand Total: ₹${p.grandTotal.toLocaleString('en-IN')}`);
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
            card.style.border = colors[s].border;
            card.style.boxShadow = colors[s].shadow;
            card.style.background = colors[s].bg;
            badge.style.display = 'inline';
        } else {
            card.style.border = '1px solid var(--glass-border)';
            card.style.boxShadow = 'none';
            card.style.background = 'transparent';
            badge.style.display = 'none';
        }
    });
}

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
    document.getElementById('pur-gst-pct').value = p.gstPercent || p.gst || 12;
    document.getElementById('pur-manf-name').value = p.manufacturer || '';
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

// --- SYSTEM HEALTH & EMAIL RECOVERY ---
async function loadFailedEmails() {
    const tbody = document.getElementById('failedEmailTableBody');
    if(!tbody) return;

    try {
        const res = await fetch(`${API_BASE}/admin/failed-emails`);
        const failed = await res.json();
        
        if (failed.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #10b981; padding: 20px;">✅ All system emails delivered successfully.</td></tr>`;
            return;
        }

        tbody.innerHTML = failed.map(e => `
            <tr>
                <td style="font-size: 0.8rem; font-weight: 700;">${e.to}</td>
                <td style="font-size: 0.8rem;">${e.subject}</td>
                <td style="color: #ef4444; font-size: 0.75rem;">${e.error}</td>
                <td style="text-align: right;">
                    <button class="btn btn-primary" style="padding: 5px 10px; font-size: 0.7rem;" onclick="retryEmail('${e._id}', this)">🔄 RETRY</button>
                    <button class="btn btn-ghost" style="padding: 5px 10px; color: #ef4444;" onclick="deleteFailedEmail('${e._id}')">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error("Load failed emails error:", e); }
}

async function retryEmail(id, btn) {
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `⏳`;

    try {
        const res = await fetch(`${API_BASE}/admin/failed-emails/${id}/retry`, { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            alert("✅ Email delivered successfully on retry!");
            loadFailedEmails();
        } else {
            alert("❌ Retry failed: " + (result.message || "Unknown error"));
        }
    } catch (e) { alert("Retry failed"); }
    finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

async function deleteFailedEmail(id) {
    if(!confirm("Are you sure you want to dismiss this failure log?")) return;
    try {
        const res = await fetch(`${API_BASE}/admin/failed-emails/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            loadFailedEmails();
        }
    } catch (e) { alert("Delete failed"); }
}
