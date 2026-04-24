const axios = require('axios');

const URL1 = "https://script.google.com/macros/s/AKfycbzwd4FlloFDymjkWWGo9BV3SB11_3cHximWDgNcvNW86bz6Q-NNRbR1m2j7dAX0qVVPFA/exec";
const URL2 = "https://script.google.com/macros/s/AKfycbxRkXtOUnrHsDuA5C7bD2NngC_ytvr_wcXeVwGvpUJNDHUBAtuitYLCgdA7bFsauflk/exec";

async function test(url, name) {
    console.log(`Testing ${name}...`);
    try {
        const res = await axios.post(url, {
            to: "emyrisbio@gmail.com",
            subject: "Diagnostic Test",
            htmlBody: "Testing bridge"
        }, { timeout: 10000 });
        console.log(`${name} Result:`, res.data);
    } catch (e) {
        console.log(`${name} Error:`, e.message);
        if (e.response) console.log(`${name} Status:`, e.response.status);
    }
}

async function run() {
    await test(URL1, "OMS Bridge (Current)");
    await test(URL2, "Onboard App Bridge (Alternative)");
}

run();
