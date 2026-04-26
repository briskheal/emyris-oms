// EMYRIS OMS - Stockist Logic
const API_BASE = '/api';
let currentUser = null;
let allProducts = [];
let cart = {}; // { productId: qty }
let manualBonuses = {}; // Track manually edited bonuses
let currentCat = 'ALL';
let currentSearch = '';
let companySettings = null;
let askingRates = {}; // Store negotiated rates
let negotiationNotes = {}; // Store authorization details
let myOrdersHistory = []; // Store history for modal lookup
let currentViewOrderId = null; // Track order for invoice downloading


async function syncProfile() {
    if (!currentUser || !currentUser._id) return;
    try {
        const res = await fetch(`${API_BASE}/stockist/profile/${currentUser._id}`);
        const data = await res.json();
        if (data.success) {
            currentUser = data.stockist;
            localStorage.setItem('emyris_user', JSON.stringify(currentUser));
            console.log("🔄 [SYNC] Latest Price Locks Loaded");
        }
    } catch (e) { console.error("❌ Profile Sync Failed:", e.message); }
}

// --- INITIALIZATION ---
window.onload = async () => {
    // Load company settings immediately for landing page footer/contact
    await loadSettings();

    const savedUser = localStorage.getItem('emyris_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        switchView('order');
        initOrderSystem();
    } else {
        // Explicitly ensure we are on login view if no session found
        switchView('login');
    }
};

function switchView(view) {
    const views = ['section-auth', 'view-order'];
    const authCards = ['view-auth-combined', 'view-login', 'view-register', 'view-forgot', 'view-pin', 'view-reg-success'];
    
    // Hide all
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });
    authCards.forEach(c => {
        const el = document.getElementById(c);
        if (el) el.classList.add('hidden');
    });

    const navbar = document.querySelector('.navbar');
    if (navbar) navbar.classList.add('hidden');

    const marquee = document.getElementById('marquee');
    if (marquee) marquee.classList.add('hidden');

    const globalFooter = document.getElementById('global-footer');
    if (globalFooter) globalFooter.classList.add('hidden');

    if (view === 'order') {
        document.getElementById('view-order').classList.remove('hidden');
        if (navbar) navbar.classList.remove('hidden');
        const userMenu = document.getElementById('userMenu');
        if (userMenu) userMenu.classList.remove('hidden');
        if (marquee) marquee.classList.remove('hidden');
        if (globalFooter) globalFooter.classList.remove('hidden');
        document.getElementById('stockistName').innerText = currentUser.name;
    } else {
        // Show auth section
        document.getElementById('section-auth').classList.remove('hidden');
        if (globalFooter) globalFooter.classList.remove('hidden');
        const userMenu = document.getElementById('userMenu');
        if (userMenu) userMenu.classList.add('hidden');

        if (view === 'login' || view === 'register') {
            document.getElementById('view-auth-combined').classList.remove('hidden');
            document.getElementById('view-login').classList.remove('hidden');
            document.getElementById('view-register').classList.remove('hidden');
            // Smooth scroll to auth section if needed
            const authSection = document.getElementById('view-auth-combined');
            if (authSection) authSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            const card = document.getElementById(`view-${view}`);
            if (card) card.classList.remove('hidden');
        }
    }
}

function switchOrderTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-tab-${tab}`).classList.add('active');
    
    if (tab === 'place') {
        document.getElementById('section-place-order').classList.remove('hidden');
        document.getElementById('section-order-history').classList.add('hidden');
        if (document.getElementById('orderFooter')) document.getElementById('orderFooter').classList.remove('hidden');
    } else {
        document.getElementById('section-place-order').classList.add('hidden');
        document.getElementById('section-order-history').classList.remove('hidden');
        if (document.getElementById('orderFooter')) document.getElementById('orderFooter').classList.add('hidden');
        fetchMyOrders(); // Load history
    }
}
async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('regBtn');
    const originalText = btn.innerText;
    
    try {
        btn.innerText = "⌛ CREATING ACCOUNT...";
        btn.disabled = true;

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

        console.log("📝 Registering Stockist:", data);

        const res = await fetch(`${API_BASE}/stockist/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        if (result.success) {
            // Show registration success card with credentials and summary
            document.getElementById('success-login-id').innerText = result.loginId;
            document.getElementById('success-password').innerText = result.password;
            
            // Populate Summary
            document.getElementById('summary-name').innerText = data.name;
            document.getElementById('summary-email').innerText = data.email;
            document.getElementById('summary-gst').innerText = data.gstNo;
            document.getElementById('summary-dl').innerText = data.dlNo;
            document.getElementById('summary-address').innerText = data.address;
            
            switchView('reg-success');
        } else {
            alert(result.message || "Registration failed. Please check your details.");
        }
    } catch (e) { 
        console.error("❌ Registration Error:", e);
        alert("Registration failed. Server error."); 
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function handleGstInput(el) {
    try {
        const gst = el.value.toUpperCase();
        el.value = gst;
        const statusEl = document.getElementById('gst-status');
        const panEl = document.getElementById('reg-pan');
        
        if (!statusEl) return;
        
        const states = {
            "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
            "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar",
            "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
            "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
            "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "27": "Maharashtra",
            "28": "Andhra Pradesh", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala",
            "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh"
        };

        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

        if (gst.length === 15) {
            if (gstRegex.test(gst)) {
                const stateCode = gst.substring(0, 2);
                statusEl.innerHTML = `<span style="color:var(--accent);">✅ VALID GST: ${states[stateCode] || 'Unknown State'}</span>`;
                // Extract PAN (characters 3 to 12)
                const pan = gst.substring(2, 12);
                if (panEl) panEl.value = pan;
                statusEl.innerHTML += ' • <span style="color:var(--primary);">PAN AUTO-FILLED</span>';
            } else {
                statusEl.innerHTML = '<span style="color:#ef4444;">❌ INVALID GST FORMAT</span>';
            }
        } else if (gst.length < 2) {
            statusEl.innerHTML = '';
        }
    } catch (err) { console.warn("GST Validation Error:", err); }
}

async function handleLogin(e) {
    e.preventDefault();
    const loginId = document.getElementById('login-id').value;
    const password = document.getElementById('login-pass').value;
    const btn = document.getElementById('loginBtn');
    const originalText = btn.innerText;

    try {
        btn.innerText = "⌛ SECURING SESSION...";
        btn.disabled = true;

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
            console.log('✅ [LOGIN] Direct session established for:', currentUser.name);
        } else {
            alert(result.message);
        }
    } catch (e) { 
        console.error("❌ [LOGIN] Connection failed:", e);
        alert("Login failed. Server error."); 
    }
    finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
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
    await syncProfile(); // CRITICAL: Get latest negotiated prices first
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
        
        const safeSet = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        // Dashboard Header
        safeSet('co-name', companySettings.name || "EMYRIS BIOLIFESCIENCES");
        safeSet('co-address', companySettings.address || "Office Address Loading...");
        safeSet('co-tollfree', companySettings.tollFree || "7993163300");
        
        const mainPhone = (companySettings.phones && companySettings.phones[0]) ? companySettings.phones[0] : '+91-XXXXXXXXXX';
        safeSet('co-phone', `WhatsApp: ${mainPhone}`);
        
        // Digital Channels
        if (companySettings.websites) {
            safeSet('co-web1', `🌐 ${companySettings.websites[0] || ''}`);
            safeSet('co-web2', companySettings.websites[1] ? `🌐 ${companySettings.websites[1]}` : '');
        }
        
        if (companySettings.emails) {
            safeSet('co-email1', `✉️ ${companySettings.emails[0] || ''}`);
            safeSet('co-email2', companySettings.emails[1] ? `✉️ ${companySettings.emails[1]}` : '');
            safeSet('co-email3', companySettings.emails[2] ? `✉️ ${companySettings.emails[2]}` : '');
        }

        // Landing Footer population (Synchronized)
        const web = (companySettings.websites && companySettings.websites[0]) ? companySettings.websites[0] : 'www.emyrisbio.com';
        const toll = companySettings.tollFree || '7993163300';
        const email = (companySettings.emails && companySettings.emails[0]) ? companySettings.emails[0] : 'contact@emyrisbio.com';
        
        safeSet('land-web', `🌐 ${web}`);
        safeSet('land-tollfree', `📞 TOLL-FREE: ${toll}`);
        safeSet('land-phone', `💬 WHATSAPP: ${mainPhone}`);
        safeSet('land-email', `✉️ ${email}`);
        safeSet('land-address', companySettings.address || "Corporate Office: EMYRIS BIOLIFESCIENCES");

        // Global Footer population (New)
        safeSet('f-co-web', web);
        safeSet('f-co-phone', mainPhone);
        safeSet('f-co-email', email);
        safeSet('f-co-address', companySettings.address || "Corporate Office: EMYRIS BIOLIFESCIENCES");

        // Marquee
        if (companySettings.scrollingMessage && companySettings.scrollingMessage.text) {
            const m = document.getElementById('marquee');
            const mc = document.getElementById('marquee-content');
            if (m && mc) {
                m.classList.remove('hidden');
                m.style.background = companySettings.scrollingMessage.color || 'var(--primary)';
                mc.innerText = companySettings.scrollingMessage.text;
                mc.style.animationDuration = `${companySettings.scrollingMessage.speed || 30}s`;
            }
        }
    } catch (e) { console.error("Load settings failed", e); }
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
        const locked = currentUser?.negotiatedPrices?.find(n => n.productId === p._id && new Date(n.expiryDate) > new Date());
        
        const masterRate = p.pts || 0;
        const currentRate = askingRates[p._id] !== undefined ? askingRates[p._id] : (locked ? locked.lockedRate : masterRate);
        const note = negotiationNotes[p._id] || (locked ? locked.note : '');
        
        const totalVal = qty ? (qty * currentRate) : 0;
        const totalFormatted = totalVal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        const isWarning = currentRate < masterRate;
        const free = manualBonuses[p._id] !== undefined ? manualBonuses[p._id] : (p.bonusScheme && qty >= p.bonusScheme.buy ? Math.floor(qty / p.bonusScheme.buy) * p.bonusScheme.get : 0);

        return `
            <tr id="row-${p._id}">
                <td>
                    <div class="${isWarning ? 'price-warning' : ''}" style="font-weight: 800; color: ${isWarning ? '#f59e0b' : 'var(--primary)'};">${p.name}</div>
                    <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">${p.category || 'GENERAL'}</div>
                </td>
                <td style="text-align: center; font-weight: 700; color: #fff; font-size: 0.8rem;">${p.packing || '-'}</td>
                <td style="font-family: monospace; text-align: center; color: #cbd5e1;">${p.hsn || '-'}</td>
                <td style="text-align: right; color: #ffffff;">₹${p.mrp}</td>
                <td style="text-align: right; color: #94a3b8;">₹${p.ptr || '-'}</td>
                <td style="text-align: center;">
                    <input type="number" class="negotiation-input ${isWarning ? 'price-warning' : ''}" 
                        value="${currentRate}" 
                        oninput="updateRate('${p._id}', this.value, ${masterRate})"
                        title="Master PTS: ₹${masterRate}">
                </td>
                <td style="text-align: center;">
                    <input type="text" class="note-input" 
                        value="${note}" 
                        placeholder="Auth Details..."
                        oninput="updateNote('${p._id}', this.value)">
                </td>
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
                <td style="text-align: right;" class="total-cell" id="total-${p._id}">₹${totalFormatted}</td>
            </tr>
        `;
    }).join('');
}

function updateRate(id, val, master) {
    const rate = parseFloat(val) || 0;
    askingRates[id] = rate;
    
    // Direct DOM update instead of full re-render
    const input = document.querySelector(`#row-${id} .negotiation-input`);
    const totalEl = document.getElementById(`total-${id}`);
    const qty = cart[id] || 0;
    
    if (input) {
        if (rate < master) input.classList.add('price-warning');
        else input.classList.remove('price-warning');
    }
    
    if (totalEl) {
        const formattedTotal = (qty * rate).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        totalEl.innerText = `₹${formattedTotal}`;
    }
    updateFooter();
}

function updateNote(id, val) {
    negotiationNotes[id] = val;
}

function updateCart(pid, qty, inputEl) {
    qty = parseInt(qty) || 0;
    if (qty < 0) {
        qty = 0;
        if (inputEl) inputEl.value = 0;
    }
    const p = allProducts.find(x => x._id === pid);
    if (qty > 0) cart[pid] = qty;
    else {
        delete cart[pid];
        delete manualBonuses[pid];
    }

    // --- SMART PRICING LOGIC ---
    // Use the same priority as the final order: Negotiated > Locked > Master
    const locked = currentUser?.negotiatedPrices?.find(n => n.productId === p._id && new Date(n.expiryDate) > new Date());
    const rate = parseFloat(askingRates[pid] !== undefined ? askingRates[pid] : (locked ? locked.lockedRate : (p.pts || p.ptr || 0)));

    const rowTotal = (qty * rate).toFixed(2);
    const totalEl = document.getElementById(`total-${pid}`);
    if (totalEl) {
        totalEl.innerText = `₹${parseFloat(rowTotal).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
    
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
        
        // Use Negotiated Rate for Calculations
        const locked = currentUser?.negotiatedPrices?.find(n => n.productId === p._id && new Date(n.expiryDate) > new Date());
        const rate = parseFloat(askingRates[pid] !== undefined ? askingRates[pid] : (locked ? locked.lockedRate : (p.pts || p.ptr || 0)));
        
        const itemVal = qty * rate;
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
    if (!currentUser) return alert("Session expired. Please login again.");

    const btn = document.querySelector('button[onclick="placeOrder()"]');
    if (!btn) return;
    const originalHtml = btn.innerHTML;

    // Validate negotiation notes
    for (const pid of Object.keys(cart)) {
        const p = allProducts.find(x => x._id === pid);
        const locked = currentUser?.negotiatedPrices?.find(n => n.productId === p._id && new Date(n.expiryDate) > new Date());
        const rate = parseFloat(askingRates[pid] !== undefined ? askingRates[pid] : (locked ? locked.lockedRate : (p.pts || p.ptr || 0)));
        
        if (rate < parseFloat(p.pts || 0) && !negotiationNotes[pid] && !(locked && locked.note)) {
            alert(`⚠️ MANDATORY: Please provide an 'Auth Note' for negotiated price on: ${p.name}`);
            return;
        }
    }

    const pids = Object.keys(cart);
    if(pids.length === 0) return alert("Please enter quantity for at least one product.");

    btn.disabled = true;
    btn.innerHTML = `⏳ PLACING ORDER...`;

    const orderItems = pids.map(pid => {
        const p = allProducts.find(x => x._id === pid);
        const qty = cart[pid];
        const locked = currentUser?.negotiatedPrices?.find(n => n.productId === p._id && new Date(n.expiryDate) > new Date());
        const rate = askingRates[pid] !== undefined ? askingRates[pid] : (locked ? locked.lockedRate : p.pts);
        
        return {
            product: pid, // Corrected from productId to match schema
            name: p.name,
            qty: qty,
            bonusQty: manualBonuses[pid] !== undefined ? manualBonuses[pid] : (p.bonusScheme && qty >= p.bonusScheme.buy ? Math.floor(qty / p.bonusScheme.buy) * p.bonusScheme.get : 0),
            priceUsed: Number(rate) || 0,
            askingRate: askingRates[pid] !== undefined ? Number(askingRates[pid]) : Number(rate),
            masterRate: Number(p.pts) || 0,
            negotiationNote: negotiationNotes[pid] || (locked ? locked.note : ''),
            mrp: p.mrp,
            totalValue: Number(qty * rate) || 0
        };
    });

    const subTotal = orderItems.reduce((a, b) => a + (b.totalValue || 0), 0);
    let gstAmt = 0;
    orderItems.forEach(item => {
        const p = allProducts.find(x => x._id === item.product);
        if (p) {
            gstAmt += ((item.totalValue || 0) * (p.gstPercent || 12)) / 100;
        }
    });
    
    const orderData = {
        stockistId: currentUser._id,
        stockistCode: currentUser.loginId,
        items: orderItems,
        subTotal: Number(subTotal) || 0,
        gstAmount: Number(gstAmt) || 0,
        grandTotal: Number(subTotal + gstAmt) || 0,
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
            alert(`✅ Order Placed Successfully! Order No: ${result.order.orderNo}`);
            cart = {};
            askingRates = {};
            negotiationNotes = {};
            renderExcelProducts();
            updateFooter();
            switchOrderTab('history');
        } else { alert(result.message); }
    } catch (e) { alert("Order submission failed."); }
    finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}



async function fetchMyOrders() {
    try {
        const res = await fetch(`${API_BASE}/orders/my-orders/${currentUser._id}`);
        const orders = await res.json();
        myOrdersHistory = orders;
        renderMyOrders(orders);
    } catch (e) { console.error("Fetch orders failed", e); }
}

function renderMyOrders(orders) {
    const container = document.getElementById('history-container');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `<div class="glass-card" style="text-align:center; color:var(--text-muted); padding: 3rem;">No orders found in your history.</div>`;
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
                <h3 style="color:var(--primary); border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem; margin-bottom: 1.5rem; font-size: 1.1rem; display: flex; align-items: center; gap: 10px;">
                    📅 ${month} <span style="font-size: 0.75rem; background: rgba(99, 102, 241, 0.1); padding: 2px 10px; border-radius: 20px; font-weight: 500;">${list.length} Orders</span>
                </h3>
                <div class="excel-container" style="border-radius: 16px;">
                    <table class="excel-table">
                        <thead>
                            <tr>
                                <th style="width: 180px;">Order Number</th>
                                <th style="width: 180px;">Placed Date & Time</th>
                                <th>Items Summary</th>
                                <th style="width: 120px; text-align: center;">Status</th>
                                <th style="width: 150px; text-align: right;">Grand Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map(o => {
                                const dateObj = new Date(o.createdAt);
                                const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                const timeStr = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
                                
                                const itemsBrief = o.items.map(i => `${i.name} (${i.qty})`).join(', ');
                                const statusColor = o.status === 'invoiced' ? '#6366f1' : (o.status === 'approved' ? '#10b981' : (o.status === 'rejected' ? '#ef4444' : '#f59e0b'));
                                
                                return `
                                    <tr onclick="viewOrderDetails('${o._id}')" style="cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                                        <td style="font-family: monospace; font-weight: 800; color: #fff;">${o.orderNo}</td>
                                        <td style="font-size: 0.8rem;">
                                            <div style="color: #fff; font-weight: 600;">${dateStr}</div>
                                            <div style="color: var(--text-muted); font-size: 0.7rem;">🕒 ${timeStr}</div>
                                        </td>
                                        <td style="font-size: 0.8rem; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px;">
                                            ${itemsBrief}
                                        </td>
                                        <td style="text-align: center;">
                                            <span style="background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30; padding: 4px 10px; border-radius: 8px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; display: inline-block;">
                                                ${o.status}
                                            </span>
                                        </td>
                                        <td style="text-align: right; font-weight: 900; color: var(--primary); font-size: 1rem;">
                                            ₹${o.grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function handleLogout() {
    if (!confirm('Are you sure you want to log out from your secure session?')) return;
    
    // Clear Session Variables
    currentUser = null;
    cart = {};
    manualBonuses = {};
    askingRates = {};
    negotiationNotes = {};
    myOrdersHistory = [];

    // Reset UI
    renderExcelProducts();
    updateFooter();
    switchView('login');
    
    // Clear persistent storage
    localStorage.removeItem('emyris_user');
    
    console.log('🚪 [LOGOUT] Session ended successfully');
}

function viewOrderDetails(orderId) {
    const o = myOrdersHistory.find(x => x._id === orderId);
    if (!o) {
        console.error("❌ Order not found in history:", orderId);
        return;
    }
    currentViewOrderId = orderId;
    console.log("📂 Opening Order/Invoice Details:", orderId, o);
    
    document.getElementById('detail-order-no').innerText = o.status === 'invoiced' ? `Invoice Details (${o.orderNo})` : `Order Details (${o.orderNo})`;
    document.getElementById('detail-date').innerText = `Placed on ${new Date(o.createdAt).toLocaleString('en-GB')}`;
    
    const statusEl = document.getElementById('detail-status');
    statusEl.innerText = o.status.toUpperCase();
    statusEl.style.color = o.status === 'invoiced' ? '#6366f1' : (o.status === 'approved' ? '#10b981' : (o.status === 'rejected' ? '#ef4444' : '#f59e0b'));

    const dlBtn = document.getElementById('btn-download-invoice');
    if (o.status === 'invoiced' && dlBtn) dlBtn.classList.remove('hidden');
    else if (dlBtn) dlBtn.classList.add('hidden');

    document.getElementById('detail-item-count').innerText = `${o.items.length} Items`;

    const body = document.getElementById('detail-items-body');
    body.innerHTML = o.items.map(i => {
        const requested = i.askingRate || i.masterRate || i.priceUsed;
        const approved = i.priceUsed;
        const lineTotal = Number(approved) * Number(i.qty);
        
        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 1rem 1.25rem; font-weight: 700; color: #fff; font-size: 0.9rem;">${i.name}</td>
                <td style="padding: 1rem 1.25rem; text-align: right; color: var(--text-muted); font-size: 0.85rem;">₹${requested.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td style="padding: 1rem 1.25rem; text-align: right; color: var(--accent); font-weight: 800; font-size: 0.9rem;">₹${approved.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td style="padding: 1rem 1.25rem; text-align: center; font-weight: 800; color: #fff; font-size: 0.9rem;">${i.qty}</td>
                <td style="padding: 1rem 1.25rem; text-align: center; color: var(--accent); font-weight: 700; font-size: 0.9rem;">+${i.bonusQty || 0}</td>
                <td style="padding: 1rem 1.25rem; text-align: right; font-weight: 900; color: #fff; font-size: 0.95rem;">₹${lineTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('detail-subtotal').innerText = `₹${o.subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    document.getElementById('detail-gst').innerText = `₹${o.gstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    document.getElementById('detail-total').innerText = `₹${o.grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

    document.getElementById('orderDetailModal').style.display = 'flex';
}

function closeOrderModal() {
    document.getElementById('orderDetailModal').style.display = 'none';
    currentViewOrderId = null;
}

async function downloadStockistInvoice() {
    if (!currentViewOrderId) return;
    try {
        const btn = document.getElementById('btn-download-invoice');
        if (btn) {
            btn.innerText = "⏳ Generating...";
            btn.disabled = true;
        }

        const res = await fetch(`${API_BASE}/stockist/orders/${currentViewOrderId}/invoice`);
        const data = await res.json();
        
        if (!data.success || !data.invoice) {
            alert("Could not load invoice data: " + (data.message || 'Unknown error'));
            if (btn) { btn.innerText = "📄 Download Invoice"; btn.disabled = false; }
            return;
        }

        generateInvoicePDF(data.invoice);
        
        if (btn) {
            btn.innerText = "✅ Downloaded";
            setTimeout(() => { btn.innerText = "📄 Download Invoice"; btn.disabled = false; }, 2000);
        }
    } catch (e) {
        console.error("PDF Gen Error:", e);
        alert("Failed to generate PDF.");
        const btn = document.getElementById('btn-download-invoice');
        if (btn) { btn.innerText = "📄 Download Invoice"; btn.disabled = false; }
    }
}

async function generateInvoicePDF(inv) {
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
    const style = companySettings?.invoiceStyle || 'classic';

    if (style === 'modern') {
        doc.setFillColor(99, 102, 241);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.text("TAX INVOICE", 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`${companySettings?.name || 'EMYRIS BIOLIFESCIENCES'}`, 105, 30, { align: 'center' });
        doc.setTextColor(40, 44, 52);
    } else {
        doc.setFontSize(12);
        doc.setTextColor(99, 102, 241);
        doc.setFont("helvetica", "bold");
        doc.text("TAX INVOICE", 105, 10, { align: 'center' });

        // Original For Buyer Tag
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text("Original For Buyer", 195, 7, { align: 'right' });

        // 2. Vertical Blue Separator Line (Shorter)
        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.5);
        doc.line(105, 15, 105, 75); 

        // 3. Company Info (Moved to LEFT)
        if (companySettings?.logoImage) {
            doc.addImage(companySettings.logoImage, 'PNG', 15, 8, 30, 15);
        }
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129);
        doc.text(companySettings?.name || "EMYRIS BIOLIFESCIENCES PVT. LTD.", 15, 28);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 44, 52);
        doc.setFontSize(8);
        const addressLines = doc.splitTextToSize(companySettings?.address || "Sumadhura Pragati Chambers, Park Ln, Secunderabad, Telangana - 500003", 80);
        doc.text(addressLines, 15, 33);
        let currY = 33 + (addressLines.length * 4);
        doc.text(`DL No: ${companySettings?.dlNo || 'N/A'}`, 15, currY);
        doc.text(`GSTIN: ${companySettings?.gstNo || 'N/A'}`, 15, currY + 4);
        doc.text(`FSSAI: ${companySettings?.fssaiNo || 'N/A'}`, 15, currY + 8);
        doc.text(`Contact: ${companySettings?.phones?.[0] || 'N/A'}`, 15, currY + 12);
        doc.text(`Email: ${companySettings?.emails?.[0] || 'N/A'}`, 15, currY + 16);
    }

    const party = currentUser || {};
    
    // 4. Party Info (Moved to RIGHT)
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text("BILL TO / SHIP TO:", 115, 15);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 44, 52);
    doc.text(inv.stockistName || 'N/A', 115, 20);
    const stockistAddressLines = doc.splitTextToSize(party.address || 'N/A', 80);
    doc.text(stockistAddressLines, 115, 25);
    let sY = 25 + (stockistAddressLines.length * 4);
    doc.setFontSize(8);
    doc.text(`DL No: ${party.dl || party.dlNo || 'N/A'}`, 115, sY);
    doc.text(`GSTIN: ${party.gst || party.gstNo || 'N/A'}`, 115, sY + 4);
    doc.text(`FSSAI: ${party.fssai || party.fssaiNo || 'N/A'}`, 115, sY + 8);
    doc.text(`Contact: ${party.phone || party.phoneNo || 'N/A'}`, 115, sY + 12);
    doc.text(`Email: ${party.email || 'N/A'}`, 115, sY + 16);

    // 5. Invoice Details (Below Party Info)
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text(`Invoice No: ${inv.invoiceNo}`, 115, sY + 22);
    doc.setTextColor(40, 44, 52);
    doc.text(`Date: ${new Date(inv.createdAt).toLocaleDateString('en-GB')}`, 115, sY + 27);

    // Horizontal Separator removed as per request
    doc.autoTable({
        startY: 85,
        head: [['S.No', 'Product Description', 'HSN', 'Batch', 'Exp', 'MRP', 'Qty', 'Unit', 'Price/Unit', 'Taxable', 'GST%', 'Amount']],
        body: inv.items.map((item, idx) => [
            idx + 1,
            { content: `${item.name}\n(Mfg: ${item.manufacturer || 'EMYRIS'})`, styles: { fontSize: style === 'compact' ? 6 : 7 } },
            item.hsn || '-',
            item.batch || 'B2401',
            item.exp || '12/25',
            `Rs. ${(item.mrp || 0).toFixed(2)}`,
            item.qty,
            'NOS',
            item.priceUsed.toFixed(2),
            item.totalValue.toFixed(2),
            item.gstPercent + '%',
            (item.totalValue * (1 + item.gstPercent/100)).toFixed(2)
        ]),
        theme: style === 'modern' ? 'striped' : 'grid',
        headStyles: { fillColor: style === 'compact' ? [40, 44, 52] : [99, 102, 241], fontSize: style === 'compact' ? 6 : 7, halign: 'center' },
        styles: { fontSize: style === 'compact' ? 6 : 7, cellPadding: style === 'compact' ? 1 : 2 },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 40 },
            9: { halign: 'right' },
            11: { halign: 'right' }
        },
        margin: { left: 15, right: 15, bottom: 60 }
    });

    const tableFinalY = doc.lastAutoTable.finalY + 10;
    
    // Dynamic Interstate / Intrastate GST Logic
    const companyGST = companySettings?.gstNo || '36'; // Default Telangana
    const buyerGST = party.gst || party.gstNo || '';
    const isInterstate = buyerGST.length > 2 && companyGST.substring(0, 2) !== buyerGST.substring(0, 2);
    
    let taxBody = [];
    if (isInterstate) {
        taxBody = [
            ['IGST', `Rs. ${inv.subTotal.toFixed(2)}`, `${inv.items[0]?.gstPercent || 0}%`, `Rs. ${inv.gstAmount.toFixed(2)}`]
        ];
    } else {
        const gstHalves = (inv.gstAmount / 2).toFixed(2);
        taxBody = [
            ['CGST', `Rs. ${inv.subTotal.toFixed(2)}`, `${(inv.items[0]?.gstPercent || 0)/2}%`, `Rs. ${gstHalves}`],
            ['SGST', `Rs. ${inv.subTotal.toFixed(2)}`, `${(inv.items[0]?.gstPercent || 0)/2}%`, `Rs. ${gstHalves}`]
        ];
    }

    doc.autoTable({
        startY: tableFinalY,
        head: [['Tax Type', 'Taxable Amount', 'Tax Rate', 'Tax Amount']],
        body: taxBody,
        theme: 'plain',
        headStyles: { fillColor: false, textColor: [99, 102, 241], fontStyle: 'bold', fontSize: 8, halign: 'right' },
        styles: { fontSize: 8, halign: 'right', cellPadding: 1, textColor: [40, 44, 52] },
        columnStyles: { 0: { fontStyle: 'bold', halign: 'center' } },
        margin: { left: 110, right: 15 },
        tableWidth: 85
    });

    const finalY = 240; 
    
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.line(15, finalY - 5, 195, finalY - 5);
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text("Amount in Words:", 15, finalY);
    doc.setTextColor(40, 44, 52);
    doc.setFont("helvetica", "normal");
    doc.text(numberToWords(inv.grandTotal), 15, finalY + 5);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text(`NET PAYABLE: Rs. ${inv.grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 195, finalY + 5, { align: 'right' });
    doc.setTextColor(40, 44, 52);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Bank Details:", 15, finalY + 15);
    doc.setFont("helvetica", "normal");
    const bDetails = companySettings?.bankDetails ? companySettings.bankDetails.split('\n') : [];
    bDetails.forEach((line, i) => doc.text(line, 15, finalY + 19 + (i * 4)));

    if (companySettings?.upiId && window.QRCode) {
        try {
            const upiUrl = `upi://pay?pa=${companySettings.upiId}&pn=${encodeURIComponent(companySettings.name || 'Company')}&am=${Math.round(inv.grandTotal)}&cu=INR`;
            const qrDataUrl = await QRCode.toDataURL(upiUrl, { width: 150, margin: 1 });
            doc.addImage(qrDataUrl, 'PNG', 85, finalY + 10, 25, 25);
            doc.setFontSize(6);
            doc.text("Scan to Pay", 97.5, finalY + 38, { align: 'center' });
        } catch(err) { console.error("QR Code Error:", err); }
    }

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    const tConds = companySettings?.termsConditions ? companySettings.termsConditions.split('\n') : ["1. Goods once sold will not be taken back. 2. Subject to local Jurisdiction."];
    tConds.forEach((line, i) => doc.text(line, 15, 280 + (i * 4)));

    doc.setFont("helvetica", "bold");
    doc.text(`For ${companySettings?.name || "EMYRIS BIOLIFESCIENCES"}`, 195, finalY + 30, { align: 'right' });
    if (companySettings?.signatureImage) {
        doc.addImage(companySettings.signatureImage, 'PNG', 165, finalY + 32, 30, 12);
    }
    doc.setFont("helvetica", "normal");
    doc.text("Authorised Signatory", 195, 280, { align: 'right' });

    doc.save(`Invoice_${inv.invoiceNo}.pdf`);
}
