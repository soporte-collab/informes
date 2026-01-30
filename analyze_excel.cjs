const XLSX = require('xlsx');
const path = require('path');

function analyzeExcel() {
    const excelPath = 'c:/programacion/informes/ARCHIVOS/codigodebarra.xlsx';
    console.log(`Leyendo: ${excelPath}`);

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convertir a JSON para inspeccionar
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log('--- Resumen Excel ---');
    console.log(`Total filas: ${data.length}`);
    if (data.length > 0) {
        console.log('Columnas detectadas:', Object.keys(data[0]));
        console.log('Primeras 5 filas:');
        console.log(JSON.stringify(data.slice(0, 5), null, 2));
    }
}

try {
    analyzeExcel();
} catch (error) {
    console.error('Error analizando Excel:', error);
}
