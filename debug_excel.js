const XLSX = require('xlsx');
const workbook = XLSX.readFile('e:/programacion/informes/ARCHIVOS/horarios/todos informe reloj chacras.xls');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log(JSON.stringify(data.slice(0, 50), null, 2));
