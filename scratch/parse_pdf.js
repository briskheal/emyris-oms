const fs = require('fs');
const pdf = require('pdf-parse');

console.log(Object.keys(pdf));

const pdfParser = pdf.default || pdf;

const dataBuffer = fs.readFileSync('D:\\MY WORK FLOW\\EMYRIS-OMS\\EMYRIS-OMS-invoice_sample.jpg.PDF');

pdfParser(dataBuffer).then(function(data) {
    console.log("== PDF TEXT ==");
    console.log(data.text);
    console.log("== END PDF TEXT ==");
}).catch(err => {
    console.error("Error reading PDF:", err);
});
