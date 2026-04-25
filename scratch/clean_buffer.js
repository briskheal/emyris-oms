const fs = require('fs');

const path = 'd:\\MY WORK FLOW\\EMYRIS-OMS\\admin-script.js';
let buffer = fs.readFileSync(path);

function replaceBuffer(buf, badHex, goodHex) {
    const bad = Buffer.from(badHex, 'hex');
    const good = Buffer.from(goodHex, 'hex');
    let pos = buf.indexOf(bad);
    while (pos !== -1) {
        buf = Buffer.concat([buf.slice(0, pos), good, buf.slice(pos + bad.length)]);
        pos = buf.indexOf(bad, pos + good.length);
    }
    return buf;
}

// â‚¹ -> ₹
buffer = replaceBuffer(buffer, 'c3a2e2809ac2b9', 'e282b9');
buffer = replaceBuffer(buffer, 'e2809ac2b9', 'e282b9');
buffer = replaceBuffer(buffer, 'c3a2c282c2b9', 'e282b9');

// ðŸ—‘ï¸  -> 🗑️
buffer = replaceBuffer(buffer, 'c3b0c29fc297c291c3afc2b8c28f', 'f09f9791efb88f');

// ðŸ‘ ï¸  -> 👁️
buffer = replaceBuffer(buffer, 'c3b0c29fc291c281c3afc2b8c28f', 'f09f9181efb88f');

// ðŸ”’ -> 🔒
buffer = replaceBuffer(buffer, 'c3b0c29fc294c292', 'f09f9492');

// âš ï¸  -> ⚠️
buffer = replaceBuffer(buffer, 'c3a2c29ac2a0c3afc2b8c28f', 'e29aa0efb88f');

// â Œ -> ❌
buffer = replaceBuffer(buffer, 'c3a2c29cc296', 'e29cc96');

// â ³ -> ⏳
buffer = replaceBuffer(buffer, 'c3a2c28cc29b', 'e28c9b');

// ðŸ“Š -> 📊
buffer = replaceBuffer(buffer, 'c3b0c29fc293c28a', 'f09f938a');

// ðŸ“‹ -> 📋
buffer = replaceBuffer(buffer, 'c3b0c29fc293c28b', 'f09f938b');

fs.writeFileSync(path, buffer);
console.log("Buffer-level cleanup complete!");
