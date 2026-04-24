const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({ path: 'd:/MY WORK FLOW/EMYRIS-OMS/.env' });

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

async function testEmail() {
    console.log("Using URL:", GOOGLE_SCRIPT_URL);
    const testData = {
        to: "emyrisbio@gmail.com", // testing with the primary email
        subject: "📧 EMYRIS OMS - System Email Test",
        htmlBody: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #6366f1; border-radius: 12px; max-width: 500px;">
                <h2 style="color: #6366f1;">System Connection Test</h2>
                <p>This is a diagnostic email to verify the Google Script Bridge connectivity.</p>
                <div style="background: #f5f3ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <strong>Timestamp:</strong> ${new Date().toLocaleString()}<br>
                    <strong>Status:</strong> Testing Delivery...
                </div>
                <p style="font-size: 0.8rem; color: #64748b;">If you received this, the email bridge is functioning correctly.</p>
            </div>
        `
    };

    try {
        console.log("Sending test email to:", testData.to);
        const res = await axios.post(GOOGLE_SCRIPT_URL, testData);
        console.log("Response Status:", res.status);
        console.log("Response Data:", res.data);
        if (res.data && (res.data.status === "success" || res.data.success === true || res.status === 200)) {
            console.log("✅ EMAIL BRIDGE IS WORKING!");
        } else {
            console.log("⚠️ Bridge returned unusual response:", res.data);
        }
    } catch (err) {
        console.error("❌ EMAIL BRIDGE FAILED:");
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", err.response.data);
        } else {
            console.error("Error Message:", err.message);
        }
    }
}

testEmail();
