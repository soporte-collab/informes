import fs from 'fs';
const data = JSON.parse(fs.readFileSync('e:\\programacion\\informes\\current_accounts_updated.json', 'utf8'));

const stats = {};

function processList(list, branch) {
    if (!list) return;
    list.forEach(item => {
        const type = item.type || 'UNKNOWN';
        if (!stats[type]) stats[type] = 0;
        stats[type]++;

        if (item.credit > 0) {
            if (!stats['HAS_CREDIT']) stats['HAS_CREDIT'] = 0;
            stats['HAS_CREDIT']++;
        }
    });
}

processList(data.PASEO, 'PASEO');
processList(data.CHACRAS, 'CHACRAS');
processList(data.GLOBAL, 'GLOBAL');

console.log('Stats:', JSON.stringify(stats, null, 2));

// Check first few items with credit
const credits = [];
[...(data.PASEO || []), ...(data.CHACRAS || []), ...(data.GLOBAL || [])].forEach(item => {
    if (item.credit > 0 && credits.length < 5) {
        credits.push(item);
    }
});
console.log('Samples with Credit:', JSON.stringify(credits, null, 2));
