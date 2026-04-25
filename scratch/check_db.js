const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

// Fix for Atlas DNS issue
dns.setServers(['8.8.8.8', '8.8.4.4']);
console.log("🌐 [DNS] Switched to Google DNS for Atlas connection");

async function checkDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        // Define schemas just for counting
        const Product = mongoose.models.Product || mongoose.model('Product', new mongoose.Schema({}));
        const Stockist = mongoose.models.Stockist || mongoose.model('Stockist', new mongoose.Schema({}));
        const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({}));

        const pCount = await Product.countDocuments();
        const sCount = await Stockist.countDocuments();
        const oCount = await Order.countDocuments();

        console.log(`Products: ${pCount}`);
        console.log(`Stockists: ${sCount}`);
        console.log(`Orders: ${oCount}`);

    } catch (err) {
        console.error("DB Error:", err);
    } finally {
        process.exit();
    }
}

checkDB();
