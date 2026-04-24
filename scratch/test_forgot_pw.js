
require('dotenv').config({ path: 'd:/MY WORK FLOW/EMYRIS-OMS/.env' });
const axios = require('axios');

async function sendEmail(to, subject, html) {
    const url = process.env.GOOGLE_SCRIPT_URL;
    if (!url) {
        console.error("No URL");
        return;
    }
    try {
        console.log("Sending to:", to);
        const res = await axios.post(url, { to, subject, html });
        console.log("Response:", res.data);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

const testContent = "<h1>Test Recover</h1><p>ID: EMY123</p><p>PW: pass123</p>";
sendEmail("vedicana4u@gmail.com", "📦 TEST RECOVERY", testContent);
