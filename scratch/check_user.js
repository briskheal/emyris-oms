const mongoose = require('mongoose');
require('dotenv').config();

const stockistSchema = new mongoose.Schema({
    name: String,
    loginId: String,
    password: { type: String },
    approved: Boolean
});

const Stockist = mongoose.model('Stockist', stockistSchema);

async function checkUser() {
    try {
        const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/emyris-oms";
        console.log("Connecting to:", uri);
        await mongoose.connect(uri);
        
        const loginId = "EMY732896";
        const user = await Stockist.findOne({ loginId: loginId });
        
        if (user) {
            console.log("User Found:");
            console.log("ID:", user.loginId);
            console.log("PW in DB:", user.password);
            console.log("Approved:", user.approved);
        } else {
            console.log("User NOT found:", loginId);
        }
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkUser();
