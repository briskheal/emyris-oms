
const mongoose = require('mongoose');
require('dotenv').config();

const productSchema = new mongoose.Schema({
    name: String,
    category: String,
    active: { type: Boolean, default: true }
});

const Product = mongoose.model('Product', productSchema);

async function checkCategories() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB");
        
        const products = await Product.find({ active: true });
        const categories = [...new Set(products.map(p => p.category))];
        
        console.log("Found Categories in DB:", categories);
        
        products.forEach(p => {
            console.log(`Product: ${p.name} | Category: "${p.category}"`);
        });
        
        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
    }
}

checkCategories();
