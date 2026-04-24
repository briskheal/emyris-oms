// EMYRIS OMS - Stockist Logic
const API_BASE = '/api';
let currentUser = null;
let allProducts = [];
let cart = {}; // { productId: qty }
let manualBonuses = {}; // Track manually edited bonuses
let currentCat = 'ALL';
let currentSearch = '';
let companySettings = null;
let pendingLoginId = null; // Stores ID during PIN phase

// --- INITIALIZATION ---
window.onload = async () => {
    const savedUser = localStorage.getItem('emyris_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        switchView('order');
        initOrderSystem();
    }
};

function switchView(viewId) {
    document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    if(viewId === 'order') {
        document.getElementById('userMenu').classList.remove('hidden');
        document.getElementById('orderFooter').classList.remove('hidden');
        document.getElementById('stockistName').innerText = currentUser.name;
    } else {
        document.getElementById('userMenu').classList.add('hidden');
        document.getElementById('orderFooter').classList.add('hidden');
        document.getElementById('marquee').classList.add('hidden');
    }
}

function switchOrderTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-tab-${tab}`).classList.add('active');
    
    if (tab === 'place') {
        document.getElementById('section-place-order').classList.remove('hidden');
        document.getElementById('section-order-history').classList.add('hidden');
        document.getElementById('orderFooter').classList.remove('hidden');
    } else {
        document.getElementById('section-place-order').classList.add('hidden');
        document.getElementById('section-order-history').classList.remove('hidden');
        document.getElementById('orderFooter').classList.add('hidden');
        fetchMyOrders();
    }
}
async function handleRegister(e) {
    e.preventDefault();
    try {
        const data = {
            name: document.getElementById('reg-name').value.toUpperCase(),
            email: document.getElementById('reg-email').value,
            phone: document.getElementById('reg-phone').value,
            password: document.getElementById('reg-pass').value,
            address: document.getElementById('reg-address').value.toUpperCase(),
            dlNo: document.getElementById('reg-dl').value.toUpperCase(),
            gstNo: document.getElementById('reg-gst').value.toUpperCase(),
            fssaiNo: document.getElementById('reg-fssai').value.toUpperCase(),
            panNo: document.getElementById('reg-pan').value.toUpperCase()
        };

        const res = await fetch(`${API_BASE}/stockist/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert(result.message);
            switchView('login');
        } else {
            alert(result.message);
        }
    } catch (e) { alert("Registration failed. Server error."); }
}

function handleGstInput(el) {
    const gst = el.value.toUpperCase();
    el.value = gst;
    const statusEl = document.getElementById('gst-status');
    const panEl = document.getElementById('reg-pan');
    
    const states = {
        "01":"Jammu & Kashmir","02":"Himachal Pradesh","03":"Punjab","04":"Chandigarh","05":"Uttarakhand",
        "06":"Haryana","07":"Delhi","08":"Rajasthan","09":"Uttar Pradesh","10":"Bihar","11":"Sikkim",
        "12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur","15":"Mizoram","16":"Tripura",
        "17":"Meghalaya","18":"Assam","19":"West Bengal","20":"Jharkhand","21":"Odisha","22":"Chhattisgarh",
        "23":"Madhya Pradesh","24":"Gujarat","25":"Daman & Diu","26":"Dadra & Nagar Haveli","27":"Maharashtra",
        "29":"Karnataka","30":"Goa","31":"Lakshadweep","32":"Kerala","33":"Tamil Nadu","34":"Puducherry",
        "35":"Andaman & Nicobar Islands","36":"Telangana","37":"Andhra Pradesh","38":"Ladakh"
    };
    
    // GST Regex: 2 digits, 5 letters, 4 digits, 1 letter, 1 digit/letter, 'Z', 1 digit/letter
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    
    if (gst.length >= 2) {
        const stateCode = gst.substring(0, 2);
        const stateName = states[stateCode];
        if (stateName) {
            statusEl.innerHTML = `<span style="color:var(--primary); font-weight:700;">📍 STATE: ${stateName}</span>`;
        } else {
            statusEl.innerHTML = `<span style="color:#ef4444;">⚠️ INVALID STATE CODE</span>`;
        }
    }

    if (gst.length === 15) {
        if (gstRegex.test(gst)) {
            const stateCode = gst.substring(0, 2);
            statusEl.innerHTML = `<span style="color:var(--accent);">✅ VALID GST: ${states[stateCode] || 'Unknown State'}</span>`;
            // Extract PAN (characters 3 to 12)
            const pan = gst.substring(2, 12);
            panEl.value = pan;
            statusEl.innerHTML += ' • <span style="color:var(--primary);">PAN AUTO-FILLED</span>';
        } else {
            statusEl.innerHTML = '<span style="color:#ef4444;">❌ INVALID GST FORMAT</span>';
        }
    } else if (gst.length < 2) {
        statusEl.innerHTML = '';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const loginId = document.getElementById('login-id').value;
    const password = document.getElementById('login-pass').value;

    try {
        const res = await fetch(`${API_BASE}/stockist/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginId, password })
        });
        const result = await res.json();
        if (result.success) {
            currentUser = result.user;
            localStorage.setItem('emyris_user', JSON.stringify(currentUser));
            switchView('order');
            initOrderSystem();
        } else {
            alert(result.message);
        }
    } catch (e) { alert("Login failed. Server error."); }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;

    try {
        const res = await fetch(`${API_BASE}/stockist/forgot-id-pw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const result = await res.json();
        alert(result.message);
        if (result.success) switchView('login');
    } catch (e) { alert("Recovery request failed."); }
}

function logout() {
    localStorage.removeItem('emyris_user');
    window.location.reload();
}

// --- ORDERING SYSTEM ---
async function initOrderSystem() {
    await loadSettings();
    await fetchProducts(); // Fetch products first so loadMasters can harvest categories
    await loadMasters();
    renderExcelProducts();
    fetchMyOrders(); // Load history
}

async function loadSettings() {
    try {
        const res = await fetch(`${API_BASE}/admin/settings`);
        companySettings = await res.json();
        
        // Update UI
        document.getElementById('co-name').innerText = companySettings.name || "EMYRIS BIOLIFESCIENCES";
        document.getElementById('co-address').innerText = companySettings.address || "Loading address...";
        document.getElementById('co-web').innerText = `🌐 ${companySettings.website || 'www.emyrisbio.com'}`;
        document.getElementById('co-phone').innerText = `📞 ${companySettings.phones ? companySettings.phones[0] : 'N/A'}`;
        document.getElementById('co-email').innerText = `✉️ ${companySettings.adminEmail || 'contact@emyrisbio.com'}`;

        // Footer population
        if (document.getElementById('f-co-name')) document.getElementById('f-co-name').innerText = companySettings.name || "EMYRIS BIOLIFESCIENCES";
        if (document.getElementById('f-co-address')) document.getElementById('f-co-address').innerText = companySettings.address || "";
        if (document.getElementById('f-co-phone')) document.getElementById('f-co-phone').innerText = `📞 ${companySettings.phones ? companySettings.phones[0] : ''}`;
        if (document.getElementById('f-co-email')) document.getElementById('f-co-email').innerText = `✉️ ${companySettings.adminEmail || ''}`;

        // Marquee
        if (companySettings.scrollingMessage && companySettings.scrollingMessage.text) {
            const m = document.getElementById('marquee');
            const mc = document.getElementById('marquee-content');
            m.classList.remove('hidden');
            m.style.background = companySettings.scrollingMessage.color || 'var(--primary)';
            mc.innerText = companySettings.scrollingMessage.text;
            mc.style.animationDuration = `${companySettings.scrollingMessage.speed || 30}s`;
        }
    } catch (e) { console.error("Load settings failed"); }
}

async function loadMasters() {
    try {
        const res = await fetch(`${API_BASE}/admin/categories`);
        const catsMaster = await res.json();
        
        // Combine categories from master and existing products to ensure nothing is missed
        const catSet = new Set(catsMaster.map(c => c.name.toUpperCase()));
        allProducts.forEach(p => {
            if (p.category) catSet.add(p.category.toUpperCase());
        });

        const container = document.getElementById('categoryChips');
        if (!container) return;
        
        const uniqueCats = ['ALL', ...Array.from(catSet).sort()];
        container.innerHTML = uniqueCats.map(c => {
            let icon = '📦';
            if (c === 'ALL') icon = '🌍';
            else if (c.includes('SYRUP')) icon = '🧪';
            else if (c.includes('TABLET')) icon = '💊';
            else if (c.includes('CAPSULE')) icon = '💊';
            else if (c.includes('INJECTION')) icon = '💉';
            else if (c.includes('PROTEIN')) icon = '💪';
            else if (c.includes('ANTIBIOTIC')) icon = '🦠';
            else if (c.includes('ANTIFUNGAL')) icon = '🍄';

            return `
                <div class="cat-chip ${c === currentCat ? 'active' : ''}" onclick="filterCat('${c}', this)">
                    <span class="cat-icon">${icon}</span> ${c}
                </div>
            `;
        }).join('');
    } catch (e) { console.error("Load masters failed", e); }
}

async function fetchProducts() {
    try {
        const res = await fetch(`${API_BASE}/products`);
        allProducts = await res.json();
    } catch (e) { console.error("Fetch products failed"); }
}

function filterCat(cat, el) {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    currentCat = cat;
    
    // Clear search input when clicking a category chip
    const searchInput = document.getElementById('productSearch');
    if (searchInput) {
        searchInput.value = '';
        currentSearch = '';
    }
    
    renderExcelProducts();
}

function searchProducts(query) {
    currentSearch = query.toLowerCase().trim();
    
    // Reset category chip to ALL when typing in search
    if (currentSearch !== '') {
        currentCat = 'ALL';
        document.querySelectorAll('.cat-chip').forEach(c => {
            if (c.innerText.toUpperCase() === 'ALL' || c.innerText.toUpperCase() === 'ALL PRODUCTS') {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });
    }
    
    renderExcelProducts();
}

function renderExcelProducts() {
    const tbody = document.getElementById('excelProductBody');
    if (!tbody) return;

    let filtered = allProducts;
    
    // 1. Apply Category Filter
    if (currentCat !== 'ALL') {
        filtered = filtered.filter(p => p.category && p.category.toString().toUpperCase().trim() === currentCat.toUpperCase().trim());
    }
    
    // 2. Apply Search Filter (Name, HSN, or Category)
    if (currentSearch) {
        filtered = filtered.filter(p => 
            (p.name && p.name.toLowerCase().includes(currentSearch)) || 
            (p.hsn && p.hsn.toString().toLowerCase().includes(currentSearch)) ||
            (p.category && p.category.toString().toLowerCase().includes(currentSearch))
        );
    }

    tbody.innerHTML = filtered.map(p => {
        const qty = cart[p._id] || '';
        const price = p.pts || p.ptr || 0;
        const total = qty ? (qty * price).toFixed(2) : '0.00';
        const free = manualBonuses[p._id] !== undefined ? manualBonuses[p._id] : (p.bonusScheme && qty >= p.bonusScheme.buy ? Math.floor(qty / p.bonusScheme.buy) * p.bonusScheme.get : 0);
        
        return `
            <tr id="row-${p._id}">
                <td>
                    <div style="font-weight: 800; color: var(--primary);">${p.name}</div>
                    <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">${p.category || 'GENERAL'}</div>
                </td>
                <td style="text-align: center; font-weight: 700; color: #fff; font-size: 0.8rem;">
                    ${p.packing || '-'}
                </td>
                <td style="font-family: monospace; text-align: center; color: #cbd5e1;">${p.hsn || '-'}</td>
                <td style="text-align: right; font-weight: 600; color: #ffffff;">₹${p.mrp}</td>
                <td style="text-align: right; color: #94a3b8;">₹${p.ptr || '-'}</td>
                <td style="text-align: right; font-weight: 700; color: #818cf8;">₹${p.pts || '-'}</td>
                <td style="text-align: center; color: #ffffff; font-weight: 600;">${p.gstPercent}%</td>
                <td style="text-align: center;">
                    <input type="number" class="qty-input" value="${qty}" min="0" step="1"
                        oninput="updateCart('${p._id}', this.value, this)" 
                        style="width: 80px; padding: 0.5rem; border: 1px solid var(--border); border-radius: 8px; text-align: center; font-weight: 700;">
                </td>
                <td style="text-align: center;">
                    <input type="number" class="bonus-input" value="${free}" min="0" step="1"
                        id="bonus-${p._id}"
                        oninput="updateBonus('${p._id}', this.value)"
                        style="width: 70px; padding: 0.5rem; border: 1px solid var(--border); border-radius: 8px; text-align: center; font-weight: 700; color: #10b981;">
                </td>
                <td style="text-align: right;" class="total-cell" id="total-${p._id}">₹${total}</td>
            </tr>
        `;
    }).join('');
}

function updateCart(pid, qty, inputEl) {
    qty = parseInt(qty) || 0;
    const p = allProducts.find(x => x._id === pid);
    if (qty > 0) cart[pid] = qty;
    else {
        delete cart[pid];
        delete manualBonuses[pid];
    }

    // Update row total immediately
    const price = p.pts || p.ptr || 0;
    const rowTotal = (qty * price).toFixed(2);
    document.getElementById(`total-${pid}`).innerText = `₹${parseFloat(rowTotal).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    // Auto-calculate Bonus if not manually edited
    if (manualBonuses[pid] === undefined) {
        const free = p.bonusScheme && qty >= p.bonusScheme.buy ? Math.floor(qty / p.bonusScheme.buy) * p.bonusScheme.get : 0;
        const bonusEl = document.getElementById(`bonus-${pid}`);
        if (bonusEl) bonusEl.value = free;
    }

    // Highlight row if qty > 0
    const row = document.getElementById(`row-${pid}`);
    if (row) row.style.background = qty > 0 ? 'rgba(99, 102, 241, 0.05)' : 'transparent';
    
    if (inputEl) {
        inputEl.style.borderColor = qty > 0 ? 'var(--primary)' : 'var(--border)';
    }

    updateFooter();
}

function updateBonus(pid, bonusQty) {
    bonusQty = parseInt(bonusQty) || 0;
    manualBonuses[pid] = bonusQty;
    
    // Visual feedback for manual edit
    const bonusEl = document.getElementById(`bonus-${pid}`);
    if (bonusEl) {
        bonusEl.style.borderColor = '#10b981';
        bonusEl.style.background = '#f0fdf4';
    }
    updateFooter();
}

function updateFooter() {
    let taxableValue = 0;
    let gstTotal = 0;
    let itemCount = 0;

    Object.keys(cart).forEach(pid => {
        const p = allProducts.find(x => x._id === pid);
        const qty = cart[pid];
        const price = p.pts || p.ptr || 0;
        const itemVal = qty * price;
        const itemGst = (itemVal * (p.gstPercent || 12)) / 100;
        
        taxableValue += itemVal;
        gstTotal += itemGst;
        itemCount++;
    });

    const netAmount = taxableValue + gstTotal;
    const grandTotal = Math.round(netAmount); // Standard Rounding Logic Applied (.50+ up, else down)

    // Update UI elements
    const taxableEl = document.getElementById('footer-subtotal');
    const gstEl = document.getElementById('footer-gst');
    const netEl = document.getElementById('footer-net');
    const totalEl = document.getElementById('footer-total');

    if (taxableEl) taxableEl.innerText = `₹${taxableValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (gstEl) gstEl.innerText = `₹${gstTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (netEl) netEl.innerText = `₹${netAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (totalEl) totalEl.innerText = `₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    const footer = document.getElementById('orderFooter');
    if (footer) {
        if (itemCount > 0) footer.classList.remove('hidden');
        else footer.classList.add('hidden');
    }
}

async function placeOrder() {
    const pids = Object.keys(cart);
    if(pids.length === 0) return alert("Please enter quantity for at least one product.");
    
    const currentUser = JSON.parse(localStorage.getItem('emyris_user'));
    if (!currentUser) return alert("Session expired. Please login again.");

    const orderItems = pids.map(pid => {
        const p = allProducts.find(x => x._id === pid);
        const qty = cart[pid];
        const free = p.bonusScheme && qty >= p.bonusScheme.buy ? Math.floor(qty / p.bonusScheme.buy) * p.bonusScheme.get : 0;
        const price = p.pts || p.ptr || 0;
        return {
            productId: pid,
            name: p.name,
            qty,
            bonusQty: free,
            priceUsed: price,
            mrp: p.mrp,
            totalValue: qty * price
        };
    });

    const subTotal = orderItems.reduce((a, b) => a + b.totalValue, 0);
    let gstAmt = 0;
    orderItems.forEach(item => {
        const p = allProducts.find(x => x._id === item.productId);
        gstAmt += (item.totalValue * (p.gstPercent || 12)) / 100;
    });
    
    const orderData = {
        stockistId: currentUser._id,
        stockistCode: currentUser.loginId,
        items: orderItems,
        subTotal,
        gstAmount: gstAmt,
        grandTotal: subTotal + gstAmt,
        bonusApproval: {
            isManual: Object.keys(manualBonuses).length > 0
        }
    };

    try {
        const res = await fetch(`${API_BASE}/orders/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        const result = await res.json();
        if (result.success) {
            alert(`✅ Order Placed Successfully!\nOrder No: ${result.orderNo}\nYour distributor has been notified.`);
            cart = {};
            renderExcelProducts();
            updateFooter();
        } else {
            alert("Order failed: " + (result.message || "Unknown error"));
        }
    } catch (e) { alert("Order submission failed."); }
}

async function fetchMyOrders() {
    try {
        const res = await fetch(`${API_BASE}/orders/my-orders/${currentUser._id}`);
        const orders = await res.json();
        renderMyOrders(orders);
    } catch (e) { console.error("Fetch orders failed", e); }
}

function renderMyOrders(orders) {
    const container = document.getElementById('history-container');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `<div class="glass-card" style="text-align:center; color:var(--text-muted);">No orders placed yet.</div>`;
        return;
    }

    // Group by Month (Year-Month)
    const grouped = {};
    orders.forEach(o => {
        const date = new Date(o.createdAt);
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!grouped[monthYear]) grouped[monthYear] = [];
        grouped[monthYear].push(o);
    });

    let html = '';
    for (const [month, list] of Object.entries(grouped)) {
        html += `
            <div style="margin-bottom: 3rem;">
                <h3 style="color:var(--primary); border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem; margin-bottom: 1.5rem;">${month}</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 1.5rem;">
                    ${list.map(o => `
                        <div class="glass-card" style="padding: 1.5rem; margin-bottom: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <div style="font-family: monospace; font-weight: 800; font-size: 1.1rem; color: #fff;">${o.orderNo}</div>
                                <div style="background: ${o.status === 'approved' ? '#10b981' : '#f59e0b'}; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">${o.status}</div>
                            </div>
                            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">Placed on ${new Date(o.createdAt).toLocaleDateString('en-GB')}</div>
                            <div style="border-top: 1px solid var(--glass-border); padding-top: 1rem;">
                                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem;">Order Details</div>
                                <div style="max-height: 150px; overflow-y: auto;">
                                    ${o.items.map(i => `
                                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                                            <span style="color: #cbd5e1;">${i.name} (${i.qty})</span>
                                            <span style="font-weight: 700; color: #fff;">₹${i.totalValue.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                        </div>
                                    `).join('')}
                                </div>
                                <div style="border-top: 1px dashed var(--glass-border); margin-top: 1rem; padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-weight: 800; color: #fff;">GRAND TOTAL</span>
                                    <span style="font-size: 1.25rem; font-weight: 900; color: var(--primary);">₹${o.grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}
