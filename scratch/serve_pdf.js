const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

http.createServer(function (req, res) {
    const filePath = path.join(__dirname, req.url);
    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
    }
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': stat.size
    });
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
}).listen(PORT, () => {
    console.log("Server running on port", PORT);
});
