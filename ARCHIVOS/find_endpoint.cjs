
const fs = require('fs');
const path = 'c:\\programacion\\informes\\ARCHIVOS\\zetti_swagger.json';

try {
    const data = fs.readFileSync(path, 'utf8');
    // Find "SalesReportController"
    const regex = /SalesReportController/g;
    let match;
    while ((match = regex.exec(data)) !== null) {
        console.log(`Found at index ${match.index}`);
        // Print 500 chars before and after
        const start = Math.max(0, match.index - 500);
        const end = Math.min(data.length, match.index + 1000); // 1000 chars after to see the path
        console.log(data.substring(start, end));
        console.log('-------------------------------------------');
    }
} catch (err) {
    console.error(err);
}
