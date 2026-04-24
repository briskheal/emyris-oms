const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/emyris-oms";

async function check() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        const Stockist = mongoose.model('Stockist', new mongoose.Schema({
            name: String,
            loginId: String,
            negotiatedPrices: Array
        }));

        const Product = mongoose.model('Product', new mongoose.Schema({
            name: String,
            pts: Number
        }));

        // Find the product
        const prod = await Product.findOne({ name: /AAVIZZA/i });
        if (prod) {
            console.log(`Product: ${prod.name}, Master PTS: ${prod.pts}`);
        } else {
            console.log("Product AAVIZZA not found");
        }

        // Find all stockists and see if anyone has negotiated prices
        const stockists = await Stockist.find({ negotiatedPrices: { $not: { $size: 0 } } });
        console.log(`\nFound ${stockists.length} stockists with negotiated prices:`);
        stockists.forEach(s => {
            console.log(`- ${s.name} (${s.loginId}): ${s.negotiatedPrices.length} items`);
            s.negotiatedPrices.forEach(n => {
                if (prod && n.productId.toString() === prod._id.toString()) {
                    console.log(`  -> MATCH: Product ${prod.name}, Rate: ${n.lockedRate}, Note: ${n.note}`);
                }
            });
        });

        // Find the "new login" user - looking for the most recent one
        const latest = await Stockist.find().sort({ registeredAt: -1 }).limit(1);
        if (latest.length > 0) {
            console.log(`\nLatest Registration: ${latest[0].name} (${latest[0].loginId})`);
            console.log(`Negotiated Prices Count: ${latest[0].negotiatedPrices.length}`);
            if (latest[0].negotiatedPrices.length > 0) {
                console.log("DATA FOUND IN NEW USER:", latest[0].negotiatedPrices);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
