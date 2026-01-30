const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function analyzeCsv() {
    const csvPath = 'c:/programacion/informes/ARCHIVOS/productos y codigos de barra.csv';
    const fileStream = fs.createReadStream(csvPath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    const products = new Map();
    let headers = null;

    for await (const line of rl) {
        if (!headers) {
            headers = line.split(',');
            console.log('Headers:', headers);
            continue;
        }

        // Simple split since data seems comma-separated but might have quotes
        // Based on previous sample: Producto,Cod.barra,...
        const parts = line.split(',');
        if (parts.length < 2) continue;

        const name = parts[0].trim();
        const barcode = parts[1].trim();

        if (name && barcode && barcode !== 'N/A' && barcode.length > 5) {
            products.set(name, barcode);
        }

        count++;
        if (count % 10000 === 0) {
            console.log(`Processed ${count} lines...`);
        }
    }

    console.log('--- Analysis Results ---');
    console.log('Total Lines:', count);
    console.log('Unique Products with Barcodes:', products.size);

    // Sample a few
    const samples = Array.from(products.entries()).slice(0, 10);
    console.log('Samples:', samples);
}

analyzeCsv().catch(console.error);
