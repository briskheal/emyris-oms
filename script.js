// EMYRIS OMS - Stockist Logic
const API_BASE = '/api';
let currentUser = null;
let allProducts = [];
let cart = {}; // { productId: qty }
let companySettings = null;

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

// --- AUTH ---
async function handleRegister(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        phone: document.getElementById('reg-phone').value,
        loginId: document.getElementById('reg-login').value,
        password: document.getElementById('reg-pass').value,
        address: document.getElementById('reg-address').value
    };

    try {
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

function logout() {
    localStorage.removeItem('emyris_user');
    window.location.reload();
}

// --- ORDERING SYSTEM ---
async function initOrderSystem() {
    await Promise.all([
        loadSettings(),
        fetchProducts(),
        loadMasters()
    ]);
    renderExcelProducts();
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
        const cats = await res.json();
        const container = document.getElementById('categoryChips');
        const uniqueCats = ['ALL', ...new Set(cats.map(c => c.name.toUpperCase()))];
        container.innerHTML = uniqueCats.map(c => `<div class="cat-chip ${c==='ALL'?'active':''}" onclick="filterCat('${c}', this)">${c}</div>`).join('');
    } catch (e) { console.error("Load masters failed"); }
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
    renderExcelProducts(cat === 'ALL' ? null : cat);
}

function searchProducts(query) {
    renderExcelProducts(null, query.toLowerCase());
}

function renderExcelProducts(catFilter = null, searchFilter = null) {
    const tbody = document.getElementById('excelProductBody');
    let filtered = allProducts;
    
    if (catFilter) filtered = filtered.filter(p => p.category.toUpperCase() === catFilter);
    if (searchFilter) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchFilter));

    tbody.innerHTML = filtered.map(p => {
        const qty = cart[p._id] || '';
        const price = p.pts || p.ptr || 0;
        const total = qty ? (qty * price).toFixed(2) : '0.00';
        return `
            <tr>
                <td>
                    <div style="font-weight: 800; color: var(--primary);">${p.name}</div>
                    ${p.bonusScheme && p.bonusScheme.buy > 0 ? `<div class="bonus-tag" style="display:inline-block; margin-top:4px;">Scheme: ${p.bonusScheme.buy}+${p.bonusScheme.get}</div>` : ''}
                </td>
                <td style="font-family: monospace; color: var(--text-muted);">${p.hsn || '-'}</td>
                <td style="text-align: right; font-weight: 600;">₹${p.mrp}</td>
                <td style="text-align: right; font-weight: 700; color: var(--accent);">₹${price}</td>
                <td style="text-align: center;">
                    <input type="number" class="qty-input" value="${qty}" min="0" 
                        oninput="updateCart('${p._id}', this.value, this)" 
                        style="width: 100px; padding: 0.5rem; border: 1px solid var(--border); border-radius: 8px; text-align: center; font-weight: 700;">
                </td>
                <td style="text-align: right; font-weight: 800; font-size: 1rem;" id="total-${p._id}">₹${total}</td>
            </tr>
        `;
    }).join('');
}

function updateCart(pid, qty, inputEl) {
    qty = parseInt(qty) || 0;
    const p = allProducts.find(x => x._id === pid);
    if (qty > 0) cart[pid] = qty;
    else delete cart[pid];

    // Update row total immediately
    const price = p.pts || p.ptr || 0;
    const rowTotal = (qty * price).toFixed(2);
    document.getElementById(`total-${pid}`).innerText = `₹${rowTotal}`;
    
    // Highlight input if qty > 0
    if (inputEl) {
        inputEl.style.borderColor = qty > 0 ? 'var(--primary)' : 'var(--border)';
        inputEl.style.background = qty > 0 ? '#f5f3ff' : '#fff';
    }

    updateFooter();
}

function updateFooter() {
    let subTotal = 0;
    let gstTotal = 0;
    let itemCount = 0;

    Object.keys(cart).forEach(pid => {
        const p = allProducts.find(x => x._id === pid);
        const qty = cart[pid];
        const price = p.pts || p.ptr || 0;
        const itemVal = qty * price;
        const itemGst = (itemVal * (p.gstPercent || companySettings.gstRate || 12)) / 100;
        
        subTotal += itemVal;
        gstTotal += itemGst;
        itemCount++;
    });

    const grandTotal = subTotal + gstTotal;

    document.getElementById('footer-item-count').innerText = itemCount;
    document.getElementById('footer-subtotal').innerText = `₹${subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    document.getElementById('footer-gst').innerText = `₹${gstTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    document.getElementById('footer-total').innerText = `₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
}

async function placeOrder() {
    const pids = Object.keys(cart);
    if(pids.length === 0) return alert("Please enter quantity for at least one product.");
    
    const orderItems = pids.map(pid => {
        const p = allProducts.find(x => x._id === pid);
        const qty = cart[pid];
        const free = p.bonusScheme ? Math.floor(qty / p.bonusScheme.buy) * p.bonusScheme.get : 0;
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
    // Recalculate GST exactly as done in footer
    let gstAmt = 0;
    orderItems.forEach(item => {
        const p = allProducts.find(x => x._id === item.productId);
        gstAmt += (item.totalValue * (p.gstPercent || companySettings.gstRate || 12)) / 100;
    });
    
    const orderData = {
        stockistId: currentUser._id,
        items: orderItems,
        subTotal,
        gstAmount: gstAmt,
        grandTotal: subTotal + gstAmt
    };

    try {
        const res = await fetch(`${API_BASE}/orders/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        const result = await res.json();
        if (result.success) {
            alert(`Order Placed Successfully! Order No: ${result.orderNo}\nNotification sent to Admin.`);
            cart = {};
            renderExcelProducts();
            updateFooter();
        }
    } catch (e) { alert("Order submission failed."); }
}
