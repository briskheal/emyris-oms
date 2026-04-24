require('dotenv').config();
const axios = require('axios');

async function testEmail() {
    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
    console.log("Using URL:", GOOGLE_SCRIPT_URL);
    
    const testData = {
        to: "jrdash.ctc@gmail.com",
        subject: "🚀 Test Email from Emyris-OMS",
        html: "<h1>Testing Bridge</h1><p>If you see this, the bridge is working!</p>"
    };

    try {
        const res = await axios.post(GOOGLE_SCRIPT_URL, testData);
        console.log("✅ Success:", res.status, res.data);
    } catch (e) {
        console.error("❌ Error:", e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", e.response.data);
        }
    }
}

testEmail();
