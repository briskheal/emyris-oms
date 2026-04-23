const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

dotenv.config();

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'emyrisbio@gmail.com',
        pass: process.env.GMAIL_PASS // Use Google App Password
    }
});

async function sendOrderEmails(order, stockist) {
    try {
        const itemRows = order.items.map(item => `
            <tr>
                <td style="padding:8px; border-bottom:1px solid #eee;">${item.name}</td>
                <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${item.qty}</td>
                <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${item.bonusQty || 0}</td>
                <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">₹${item.totalValue.toFixed(2)}</td>
            </tr>
        `).join('');

        const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background: #6366f1; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">New Order Received: ${order.orderNo}</h2>
                </div>
                <div style="padding: 20px;">
                    <p><strong>Stockist:</strong> ${stockist.name}</p>
                    <p><strong>Address:</strong> ${stockist.address || 'N/A'}</p>
                    <p><strong>Phone:</strong> ${stockist.phone || 'N/A'}</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="text-align:left; padding:8px;">Product</th>
                                <th style="padding:8px;">Qty</th>
                                <th style="padding:8px;">Bonus</th>
                                <th style="text-align:right; padding:8px;">Value</th>
                            </tr>
                        </thead>
                        <tbody>${itemRows}</tbody>
                    </table>
                    <div style="margin-top: 20px; text-align: right; border-top: 2px solid #6366f1; padding-top: 10px;">
                        <p style="margin: 5px 0;"><strong>Subtotal:</strong> ₹${order.subTotal.toFixed(2)}</p>
                        <p style="margin: 5px 0;"><strong>GST Amount:</strong> ₹${order.gstAmount.toFixed(2)}</p>
                        <p style="margin: 5px 0; font-size: 1.2rem; color: #6366f1;"><strong>Grand Total:</strong> ₹${order.grandTotal.toFixed(2)}</p>
                    </div>
                </div>
                <div style="background: #f8fafc; padding: 15px; font-size: 0.8rem; color: #64748b; text-align: center;">
                    This is an automated order notification from EMYRIS OMS.
                </div>
            </div>
        `;

        const mailOptions = {
            from: `"EMYRIS OMS" <${process.env.GMAIL_USER}>`,
            to: `emyrisbio@gmail.com, ${process.env.SUPER_DISTRIBUTOR_EMAIL || 'emyrisbio@gmail.com'}`,
            subject: `📦 New Order Alert: ${order.orderNo} from ${stockist.name}`,
            html: emailBody
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Order Emails Sent: ${order.orderNo}`);
    } catch (e) { console.error("❌ Email Trigger Fail:", e.message); }
}

const dns = require('dns');
// Force Google DNS for SRV resolution (fixes connection issues on some networks)
try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    console.log('🌐 [DNS] Switched to Google DNS for Atlas connection');
} catch (e) {
    console.warn('⚠️ [DNS] Failed to set custom DNS servers:', e.message);
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/emyris-oms";
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ EMYRIS-OMS Database Connected'))
    .catch(err => console.error('❌ Database Connection Error:', err));

// --- SCHEMAS ---

// 1. Company Profile
const companySchema = new mongoose.Schema({
    name: { type: String, default: "Emyris Biolifesciences Pvt. Ltd." },
    address: String,
    website: String,
    phones: [String],
    email: String,
    superDistributorEmail: String,
    adminEmail: String,
    gstRate: { type: Number, default: 12 }
});

// 2. Product Master
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    hsn: String,
    category: { type: String, default: "GENERAL" },
    mrp: { type: Number, default: 0 },
    ptr: { type: Number, default: 0 }, // Price to Retailer
    pts: { type: Number, default: 0 }, // Price to Stockist
    gstPercent: { type: Number, default: 12 },
    qtyAvailable: { type: Number, default: 0 },
    bonusScheme: {
        buy: { type: Number, default: 0 },
        get: { type: Number, default: 0 }
    },
    active: { type: Boolean, default: true }
});

// 3. Stockist / Distributor
const stockistSchema = new mongoose.Schema({
    name: { type: String, required: true },
    loginId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    address: String,
    phone: String,
    email: String,
    approved: { type: Boolean, default: false },
    registeredAt: { type: Date, default: Date.now }
});

// 4. Order
const orderSchema = new mongoose.Schema({
    orderNo: { type: String, unique: true },
    stockist: { type: mongoose.Schema.Types.ObjectId, ref: 'Stockist' },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        qty: Number,
        priceUsed: Number,
        mrp: Number,
        bonusQty: Number,
        totalValue: Number
    }],
    subTotal: Number,
    gstAmount: Number,
    grandTotal: Number,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const Company = mongoose.model('Company', companySchema);
const Product = mongoose.model('Product', productSchema);
const Stockist = mongoose.model('Stockist', stockistSchema);
const Order = mongoose.model('Order', orderSchema);

// --- API ENDPOINTS ---

app.get('/api/health', (req, res) => res.json({ status: 'running', database: mongoose.connection.readyState === 1 }));

// Auth & Registration
app.post('/api/stockist/register', async (req, res) => {
    try {
        const { name, loginId, password, address, phone, email } = req.body;
        const existing = await Stockist.findOne({ loginId });
        if (existing) return res.status(400).json({ success: false, message: 'Login ID already exists' });
        const newStockist = new Stockist({ name, loginId, password, address, phone, email });
        await newStockist.save();
        res.json({ success: true, message: 'Registration successful. Waiting for Admin approval.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/stockist/login', async (req, res) => {
    try {
        const { loginId, password } = req.body;
        const user = await Stockist.findOne({ loginId, password });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid Credentials' });
        if (!user.approved) return res.status(403).json({ success: false, message: 'Account pending approval' });
        res.json({ success: true, user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: Login
app.post('/api/admin/login', (req, res) => {
    const { adminId, password } = req.body;
    // As per user request: Fixed ID "EMYRIS" and Password "1234"
    if (adminId === "EMYRIS" && password === "1234") {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid Admin Credentials' });
    }
});

// Admin: Bulk Add Products
app.post('/api/admin/products/bulk', async (req, res) => {
    try {
        const { products } = req.body;
        if (!Array.isArray(products)) return res.status(400).json({ success: false, message: 'Invalid data' });
        const results = { success: 0, failed: 0, errors: [] };
        for (const p of products) {
            try {
                if (!p.name) { results.failed++; results.errors.push("Missing Product Name"); continue; }
                const newProd = new Product({
                    name: p.name,
                    hsn: p.hsn,
                    category: p.category || "GENERAL",
                    mrp: Number(p.mrp) || 0,
                    ptr: Number(p.ptr) || 0,
                    pts: Number(p.pts) || 0,
                    gstPercent: Number(p.gstPercent) || 12,
                    qtyAvailable: Number(p.qtyAvailable) || 0,
                    bonusScheme: { buy: Number(p.buy) || 0, get: Number(p.get) || 0 }
                });
                await newProd.save();
                results.success++;
            } catch (e) {
                results.failed++;
                results.errors.push(`${p.name || 'Unknown'}: ${e.message}`);
            }
        }
        res.json({ success: true, results });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: Single Add Product
app.post('/api/admin/products', async (req, res) => {
    try {
        const newProd = new Product(req.body);
        await newProd.save();
        res.json({ success: true, product: newProd });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: Get All Stockists
app.get('/api/admin/stockists', async (req, res) => {
    try {
        const stockists = await Stockist.find().sort({ registeredAt: -1 });
        res.json(stockists);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: Approve Stockist
app.put('/api/admin/stockists/:id/approve', async (req, res) => {
    try {
        const stockist = await Stockist.findByIdAndUpdate(req.params.id, { approved: true }, { new: true });
        res.json({ success: true, stockist });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public Products List
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({ active: true });
        res.json(products);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Orders
app.post('/api/orders/create', async (req, res) => {
    try {
        const { stockistId, items, subTotal, gstAmount, grandTotal } = req.body;
        const orderNo = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
        
        const newOrder = new Order({ 
            orderNo, 
            stockist: stockistId, 
            items, 
            subTotal, 
            gstAmount, 
            grandTotal 
        });
        await newOrder.save();

        // Fetch stockist details for the email
        const stockist = await Stockist.findById(stockistId);
        if (stockist) {
            sendOrderEmails(newOrder, stockist);
        }

        res.json({ success: true, orderNo });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`🚀 OMS Server running on http://localhost:${PORT}`));
