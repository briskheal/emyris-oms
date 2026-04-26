const fs = require('fs');
const content = fs.readFileSync('admin-script.js', 'utf8');

try {
    new Function(content);
    console.log("Syntax OK");
} catch (e) {
    console.error("Syntax Error:", e.message);
    // Find approximate line number
    const lines = content.split('\n');
    let count = 0;
    for(let i=0; i<lines.length; i++) {
        try {
            new Function(lines.slice(0, i+1).join('\n') + '\n}');
        } catch(err) {
            // This is not a reliable way but might help
        }
    }
}
