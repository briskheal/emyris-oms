const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://jsdash:DASH8093@cluster0.pvnka.mongodb.net/emyris_oms');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    for (let coll of collections) {
        const count = await db.collection(coll.name).countDocuments();
        console.log(`${coll.name}: ${count}`);
    }
    process.exit();
}
check();
