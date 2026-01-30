const XLSX = require('xlsx');
const fs = require('fs');

function processMaster() {
    const excelPath = 'c:/programacion/informes/ARCHIVOS/codigodebarra.xlsx';
    const outputPath = 'c:/programacion/informes/product_master.json';

    console.log(`Procesando Excel: ${excelPath}`);
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Consolidar productos únicos (priorizar por nombre ya que el Excel tiene duplicados)
    const masterMap = new Map();

    data.forEach(row => {
        const name = row.Producto ? String(row.Producto).trim() : '';
        const barcode = row['Cod.barra'] ? String(row['Cod.barra']).trim() : '';
        const manufacturer = row.Fabricante ? String(row.Fabricante).trim() : 'VARIOS';

        if (!name) return;

        // Si no está en el mapa, o si tenemos un código de barra real para un nombre que antes no tenía
        if (!masterMap.has(name) || (barcode && barcode !== 'N/A' && masterMap.get(name).barcode === 'N/A')) {
            masterMap.set(name, {
                name,
                barcode: (barcode && barcode !== 'N/A') ? barcode : 'N/A',
                manufacturer
            });
        }
    });

    const masterList = Array.from(masterMap.values());
    fs.writeFileSync(outputPath, JSON.stringify(masterList, null, 2));

    console.log('--- Resumen de Procesamiento ---');
    console.log(`Filas originales: ${data.length}`);
    console.log(`Productos únicos: ${masterList.length}`);
    console.log(`Archivo generado en: ${outputPath}`);
}

try {
    processMaster();
} catch (error) {
    console.error('Error procesando el maestro:', error);
}
