const fs = require('fs');
const path = require('path');

const filesToClean = ['admin.html', 'admin-script.js', 'index.html', 'script.js'];

const replacements = [
    { regex: /âœï¸/g, rep: '📝' },
    { regex: /ðŸ—‘ï¸/g, rep: '🗑️' },
    { regex: /ðŸ‘ï¸/g, rep: '👁️' },
    { regex: /âœ…/g, rep: '✅' },
    { regex: /ðŸ“¦/g, rep: '📦' },
    { regex: /ðŸš€/g, rep: '🚀' },
    { regex: /ðŸ’°/g, rep: '💰' },
    { regex: /ðŸ“Š/g, rep: '📊' },
    { regex: /ðŸ›’/g, rep: '🛒' },
    { regex: /ðŸ¤/g, rep: '🤝' },
    { regex: /âœ–/g, rep: '✖' },
    { regex: /âœ”/g, rep: '✔' }
];

filesToClean.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;
        replacements.forEach(r => {
            content = content.replace(r.regex, r.rep);
        });
        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Cleaned: ${file}`);
        } else {
            console.log(`ℹ️ No garbled characters found in: ${file}`);
        }
    }
});
