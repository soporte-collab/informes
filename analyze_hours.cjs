const fs = require('fs');
const readline = require('readline');
const path = require('path');

const ARCHIVOS_DIR = 'c:/programacion/informes/ARCHIVOS';
const FILE = 'septiembre.CSV';

async function debugAnalysis() {
    const stats = Array.from({ length: 7 }, () =>
        Array.from({ length: 24 }, () => 0)
    );

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const filePath = path.join(ARCHIVOS_DIR, FILE);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let headers = null;
    let lineCount = 0;
    let parsedCount = 0;

    for await (const line of rl) {
        lineCount++;
        if (!headers) {
            headers = line.split(',');
            continue;
        }

        const parts = line.split(',');
        const dateStr = parts[2]; // Fecha Ticket

        if (dateStr && dateStr.includes(' ')) {
            const [dmy, hm] = dateStr.split(' ');
            const [d, m, y] = dmy.split('-').map(Number);
            const [hour, min] = hm.split(':').map(Number);

            // Month is 1-12 in CSV, 0-11 in JS
            const date = new Date(y, m - 1, d, hour, min);
            const day = date.getDay();

            if (!isNaN(day)) {
                stats[day][hour]++;
                parsedCount++;
            }
        }

        if (lineCount < 10) {
            console.log(`Line ${lineCount}: ${dateStr} -> Hour: ${dateStr?.split(' ')[1]?.split(':')[0]}`);
        }
    }

    console.log(`\nTotal Lines: ${lineCount}`);
    console.log(`Parsed Records: ${parsedCount}\n`);

    for (let d = 0; d < 7; d++) {
        let row = `${dayNames[d].padEnd(10)}: `;
        for (let h = 8; h <= 21; h++) {
            row += `${h}h(${stats[d][h]}) `;
        }
        console.log(row);
    }
}

debugAnalysis().catch(console.error);
