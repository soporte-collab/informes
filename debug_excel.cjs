const XLSX = require('xlsx');
const workbook = XLSX.readFile('e:/programacion/informes/ARCHIVOS/horarios/todos informe reloj chacras.xls');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
data.forEach(row => {
    if (JSON.stringify(row).toUpperCase().includes('BRAHIM') || JSON.stringify(row).toUpperCase().includes('SHEILA')) {
        console.log(row);
    }
});
