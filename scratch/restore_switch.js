const fs = require('fs');
const oldCode = fs.readFileSync('scratch/old_admin.js', 'utf8');
const newCode = fs.readFileSync('admin-script.js', 'utf8');

const switchStartStr = "switch (type) {";
const switchEndStr = "if (reportData.length === 0)";

const switchStartIndex = oldCode.indexOf(switchStartStr);
const switchEndIndex = oldCode.indexOf(switchEndStr);

if (switchStartIndex === -1 || switchEndIndex === -1) {
    console.error("Markers not found in old code");
    process.exit(1);
}

const switchBody = oldCode.substring(switchStartIndex, switchEndIndex);

const newCodeFixed = newCode.replace('${switchBody}', switchBody);
fs.writeFileSync('admin-script.js', newCodeFixed, 'utf8');
console.log("Fixed!");
