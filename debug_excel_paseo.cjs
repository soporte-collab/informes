const XLSX = require('xlsx');

function debugExcel(filePath) {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log(`--- DEBUG: ${filePath} ---`);
        console.log(`Total rows: ${rows.length}`);

        for (let i = 0; i < Math.min(20, rows.length); i++) {
            console.log(`Row ${i}:`, JSON.stringify(rows[i]));
        }
    } catch (e) {
        console.error("Error reading file:", e.message);
    }
}

debugExcel("e:\\programacion\\informes\\ARCHIVOS\\horarios\\todos horarios paseo.xls");
