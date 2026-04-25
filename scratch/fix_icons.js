const fs = require('fs');
const path = 'd:\\MY WORK FLOW\\EMYRIS-OMS\\admin-script.js';

let content = fs.readFileSync(path, 'utf8');

// 1. Fix icons in renderProducts
content = content.replace(/âœ ï¸ /g, '📝 EDIT');
content = content.replace(/ðŸ—‘ï¸ /g, '🗑️ DELETE');

// 2. Fix icons in renderStockists
content = content.replace(/ðŸ“Š LEDGER/g, '📊 LEDGER');
// (The previous replaces might have already handled EDIT and DELETE if they were identical)

// 3. Fix icons in renderOrderHistory
content = content.replace(/ðŸ‘ ï¸  VIEW/g, '👁️ VIEW');

// 4. Fix icons in alerts
content = content.replace(/âš ï¸ /g, '⚠️');
content = content.replace(/â Œ/g, '❌');
content = content.replace(/â ³/g, '⏳');

// 5. Implement renderStockists with list and filter functions
const oldRenderStockists = /function renderStockists\(\) \{[\s\S]*?\}\n\}/; 
// This might be tricky. I'll just look for the function start and end.

// Instead of regex, I'll do a string replacement for the whole block if possible.
// But I'll just use simple string replaces for the icons first.

fs.writeFileSync(path, content, 'utf8');
console.log('Icons cleaned up.');
