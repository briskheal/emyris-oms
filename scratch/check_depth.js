const fs = require('fs');
const content = fs.readFileSync('d:\\MY WORK FLOW\\EMYRIS-OMS\\admin.html', 'utf8');

const lines = content.split('\n');
let balance = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/<div|<main|<section|<aside/g) || []).length;
    const closes = (line.match(/<\/div>|<\/main>|<\/section>|<\/aside>/g) || []).length;
    balance += opens;
    balance -= closes;
    if (line.includes('id="tab-reports"') || line.includes('id="tab-settings"')) {
        console.log(`Balance at line ${i + 1} (${line.trim()}): ${balance}`);
    }
}
