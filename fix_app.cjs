
const fs = require('fs');
const path = 'c:\\programacion\\informes\\App.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `        Papa.parse(files[0], {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
            complete: async (results) => {`;

const replacement = `        Papa.parse(files[0], {
            header: false,
            skipEmptyLines: true,
            delimitersToGuess: [';', ',', '\\t'],
            complete: async (results) => {`;

// We use the function level context to avoid replacing Sales or Invoices
const functionStart = 'const handleCurrentAccountUpload =';
const startIndex = content.indexOf(functionStart);
if (startIndex === -1) {
    console.error('Function not found');
    process.exit(1);
}

const functionBody = content.substring(startIndex);
const targetIndex = functionBody.indexOf(target);

if (targetIndex === -1) {
    console.error('Target not found in function body');
    process.exit(1);
}

const newFunctionBody = functionBody.replace(target, replacement);
const newContent = content.substring(0, startIndex) + newFunctionBody;

fs.writeFileSync(path, newContent);
console.log('Update successful');
