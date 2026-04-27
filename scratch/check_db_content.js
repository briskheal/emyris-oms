const mongoose = require('mongoose');
require('dotenv').config();

const companySchema = new mongoose.Schema({
    name: String,
    musicUrl: String,
    videoUrl: String,
    musicVolume: Number
}, { strict: false });

const Company = mongoose.model('Company', companySchema);

async function checkDB() {
    try {
        console.log("🔍 [DB CHECK] Connecting to:", process.env.MONGODB_URI ? "URI Found" : "URI MISSING");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connected.");

        const count = await Company.countDocuments();
        console.log(`📊 Found ${count} Company records.`);

        const all = await Company.find().sort({ _id: 1 });
        all.forEach((c, i) => {
            console.log(`\nRecord #${i+1} (${c._id}):`);
            console.log(` - Name: ${c.name}`);
            console.log(` - Music: ${c.musicUrl || 'BLANK'}`);
            console.log(` - Video: ${c.videoUrl || 'BLANK'}`);
            console.log(` - Volume: ${c.musicVolume}`);
            console.log(` - Raw Keys: ${Object.keys(c.toObject()).join(', ')}`);
        });

        process.exit(0);
    } catch (e) {
        console.error("❌ Error:", e.message);
        process.exit(1);
    }
}

checkDB();
