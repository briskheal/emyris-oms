// EMYRIS OMS - Stockist Logic
const API_BASE = '/api';
let currentUser = null;
let allProducts = [];
let cart = {}; // { productId: qty }
let gstRate = 12;

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
        document.getElementById('stockistName').innerText = currentUser.name;
    } else {
        document.getElementById('userMenu').classList.add('hidden');
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
    await fetchProducts();
    renderProducts();
    renderCategories();
}

async function fetchProducts() {
    try {
        const res = await fetch(`${API_BASE}/products`);
        allProducts = await res.json();
        // Mocking some data if DB is empty
        if(allProducts.length === 0) {
            allProducts = [
                { _id: 'p1', name: 'EMYCOLD TABLETS', category: 'TABLETS', mrp: 45, companyPrice: 22, listPrice: 20, bonusScheme: { buy: 10, get: 1 } },
                { _id: 'p2', name: 'EMY-GUM SYRUP', category: 'SYRUPS', mrp: 120, companyPrice: 65, listPrice: 60, bonusScheme: { buy: 5, get: 1 } },
                { _id: 'p3', name: 'EMYVIT INJECTION', category: 'INJECTIONS', mrp: 180, companyPrice: 90, listPrice: 85, bonusScheme: { buy: 10, get: 2 } }
            ];
        }
    } catch (e) { console.error("Fetch products failed"); }
}

function renderCategories() {
    const cats = ['ALL', ...new Set(allProducts.map(p => p.category))];
    const container = document.getElementById('categoryChips');
    container.innerHTML = cats.map(c => `<div class="cat-chip ${c==='ALL'?'active':''}" onclick="filterCat('${c}', this)">${c}</div>`).join('');
}

function filterCat(cat, el) {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderProducts(cat === 'ALL' ? null : cat);
}

function renderProducts(filter = null) {
    const list = document.getElementById('productList');
    const filtered = filter ? allProducts.filter(p => p.category === filter) : allProducts;
    
    list.innerHTML = filtered.map(p => {
        const qty = cart[p._id] || 0;
        return `
            <div class="product-card">
                <div style="flex: 1;">
                    <div style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">${p.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
                        Category: ${p.category} | MRP: ₹${p.mrp} | Co. Price: ₹${p.companyPrice}
                        ${p.bonusScheme ? `<span class="bonus-tag">Scheme: ${p.bonusScheme.buy}+${p.bonusScheme.get}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="text-align: right;">
                        <div style="font-size: 0.7rem; color: var(--text-muted);">Enter Qty</div>
                        <input type="number" class="qty-input" value="${qty}" min="0" onchange="updateCart('${p._id}', this.value)">
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateCart(pid, qty) {
    qty = parseInt(qty) || 0;
    if (qty > 0) cart[pid] = qty;
    else delete cart[pid];
    renderOrderSummary();
}

function renderOrderSummary() {
    const container = document.getElementById('orderItems');
    let subTotal = 0;
    
    const itemsHtml = Object.keys(cart).map(pid => {
        const p = allProducts.find(x => x._id === pid);
        const qty = cart[pid];
        const itemVal = qty * p.companyPrice;
        subTotal += itemVal;

        let bonusMsg = "";
        if(p.bonusScheme) {
            const free = Math.floor(qty / p.bonusScheme.buy) * p.bonusScheme.get;
            if(free > 0) bonusMsg = `<span style="color:var(--accent); font-size:0.75rem;">(+${free} Bonus)</span>`;
        }

        return `
            <div class="summary-row" style="margin-bottom: 0.5rem; font-size: 0.85rem;">
                <span style="font-weight: 600;">${p.name} x ${qty} ${bonusMsg}</span>
                <span>₹${itemVal.toFixed(2)}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = itemsHtml || '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">No items selected</p>';
    
    const gstAmt = (subTotal * gstRate) / 100;
    const grandTotal = subTotal + gstAmt;

    document.getElementById('sum-subtotal').innerText = `₹${subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    document.getElementById('sum-gst-amt').innerText = `₹${gstAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    document.getElementById('sum-grand').innerText = `₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
}

async function placeOrder() {
    if(Object.keys(cart).length === 0) return alert("Select at least one product.");
    
    const orderItems = Object.keys(cart).map(pid => {
        const p = allProducts.find(x => x._id === pid);
        const qty = cart[pid];
        const free = p.bonusScheme ? Math.floor(qty / p.bonusScheme.buy) * p.bonusScheme.get : 0;
        return {
            productId: pid,
            name: p.name,
            qty,
            bonusQty: free,
            priceUsed: p.companyPrice,
            totalValue: qty * p.companyPrice
        };
    });

    const subTotal = orderItems.reduce((a, b) => a + b.totalValue, 0);
    const gstAmt = (subTotal * gstRate) / 100;
    
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
            alert(`Order Placed Successfully! Order No: ${result.orderNo}\nEmails triggered to Admin & Super Distributor.`);
            cart = {};
            renderProducts();
            renderOrderSummary();
        }
    } catch (e) { alert("Order submission failed."); }
}
