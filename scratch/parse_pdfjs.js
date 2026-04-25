const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const filePath = 'D:\\MY WORK FLOW\\EMYRIS-OMS\\EMYRIS-OMS-invoice_sample.jpg.PDF';
const dataBuffer = fs.readFileSync(filePath);

pdfjsLib.getDocument({data: dataBuffer}).promise.then(async function(pdf) {
    let maxPages = pdf.numPages;
    let text = '';
    for (let j = 1; j <= maxPages; j++) {
        let page = await pdf.getPage(j);
        let content = await page.getTextContent();
        let strings = content.items.map(item => item.str);
        text += strings.join(' ') + '\n';
    }
    console.log("== PDF TEXT ==");
    console.log(text.trim());
    console.log("== END PDF TEXT ==");
}).catch(err => {
    console.error("Error reading PDF:", err);
});
