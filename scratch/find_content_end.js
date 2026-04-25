const fs = require('fs');
const content = fs.readFileSync('d:\\MY WORK FLOW\\EMYRIS-OMS\\admin.html', 'utf8');

const lines = content.split('\n');
let contentDepth = -1;
let contentLine = -1;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('<main class="content">')) {
        contentDepth = 0;
        contentLine = i + 1;
    }
    if (contentDepth !== -1) {
        const opens = (line.match(/<div|<main|<section|<aside/g) || []).length;
        const closes = (line.match(/<\/div>|<\/main>|<\/section>|<\/aside>/g) || []).length;
        contentDepth += opens;
        contentDepth -= closes;
        if (contentDepth === 0) {
            console.log(`Content area CLOSED at line ${i + 1}: ${line.trim()}`);
            // Don't break, see if there are more closures or if it re-opens (which shouldn't happen)
        }
        if (contentDepth < 0) {
             console.log(`Content area Balance NEGATIVE at line ${i + 1}: ${line.trim()}`);
        }
    }
}
