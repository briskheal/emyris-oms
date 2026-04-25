const fs = require('fs');
const content = fs.readFileSync('d:\\MY WORK FLOW\\EMYRIS-OMS\\admin.html', 'utf8');

const lines = content.split('\n');
let balance = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/<div/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    balance += opens;
    balance -= closes;
    if (balance < 0) {
        console.log(`Balance dropped below 0 at line ${i + 1}: ${line}`);
    }
}
console.log('Final balance:', balance);
