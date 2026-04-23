const mongoose = require('mongoose');
require('dotenv').config();

const stockistSchema = new mongoose.Schema({
    loginId: String,
    approved: Boolean
});
const Stockist = mongoose.model('Stockist', stockistSchema);

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const stockists = await Stockist.find();
    console.log(JSON.stringify(stockists, null, 2));
    process.exit(0);
}
check();
