const mongoose = require('mongoose');
require('dotenv').config();

async function checkCollections() {
    await mongoose.connect(process.env.MONGODB_URI);
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    for (const name of ['Stockist', 'Order', 'Company', 'Product']) {
        const count = await mongoose.connection.db.collection(name.toLowerCase() + 's').countDocuments();
        console.log(`${name}s count:`, count);
    }
    
    // Check some samples
    const orders = await mongoose.connection.db.collection('orders').find().limit(5).toArray();
    console.log('Sample Orders:', orders);

    await mongoose.disconnect();
}

checkCollections();
