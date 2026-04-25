const fs = require('fs');
const path = require('path');

const filePath = 'd:\\MY WORK FLOW\\EMYRIS-OMS\\admin-script.js';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
    { bad: /â‚¹/g, good: '₹' },
    { bad: /ðŸ—‘ï¸ /g, good: '🗑️' },
    { bad: /ðŸ‘ ï¸ /g, good: '👁️' },
    { bad: /âœ…/g, good: '✅' },
    { bad: /â Œ/g, good: '❌' },
    { bad: /â ³/g, good: '⏳' },
    { bad: /â–²/g, good: '▲' },
    { bad: /â–¼/g, good: '▼' },
    { bad: /âœ ï¸ /g, good: '✍️' },
    { bad: /ðŸ“Š/g, good: '📊' },
    { bad: /ðŸ“‹/g, good: '📋' },
    { bad: /âœ•/g, good: '✖' },
    { bad: /ðŸ”’/g, good: '🔒' },
    { bad: /âš ï¸ /g, good: '⚠️' },
    { bad: /ðŸ“¥/g, good: '📥' },
    { bad: /ðŸ“¦/g, good: '📦' }
];

replacements.forEach(r => {
    content = content.replace(r.bad, r.good);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log("Cleanup complete!");
