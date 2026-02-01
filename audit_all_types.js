const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

async function getZettiToken() {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', 'biotrack');
    params.append('password', 'SRwdDVgLQT1i');
    const auth = Buffer.from(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`).toString('base64');
    const res = await fetch(ZETTI_CONFIG.auth_url, {
        method: 'POST', body: params,
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const data = await res.json();
    return data.access_token;
}

async function countTypes(nodeId, nodeName, date) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?page=1&pageSize=50`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            request: {
                emissionDateFrom: `${date}T00:00:00.000-0300`,
                emissionDateTo: `${date}T23:59:59.999-0300`
            }
        })
    });
    const data = await res.json();
    const list = data.content || [];
    const types = {};
    list.forEach(inv => {
        const t = inv.valueType?.name || 'DESCONOCIDO';
        types[t] = (types[t] || 0) + 1;
    });

    console.log(`\n--- RESULTADOS PARA ${nodeName} (${date}) ---`);
    console.log(`Total Comprobantes: ${list.length}`);
    console.log(`Desglose por Tipo:`, JSON.stringify(types, null, 2));
}

async function auditExpenses(nodeId, nodeName, date) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/providers/receipts/search`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            request: {
                emissionDateFrom: `${date}T00:00:00.000-0300`,
                emissionDateTo: `${date}T23:59:59.999-0300`
            }
        })
    });
    const data = await res.json();
    const list = data.content || [];
    console.log(`\n--- GASTOS (PROV) PARA ${nodeName} (${date}) ---`);
    console.log(`Total Gastos: ${list.length}`);
    if (list.length > 0) console.log(`Ejemplo Gasto:`, JSON.stringify(list[0], null, 2));
}

async function auditInsurance(nodeId, nodeName, date) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/health-insurance-providers/receipts/search`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            request: {
                emissionDateFrom: `${date}T00:00:00.000-0300`,
                emissionDateTo: `${date}T23:59:59.999-0300`
            }
        })
    });
    const data = await res.json();
    const list = data.content || [];
    console.log(`\n--- OBRAS SOCIALES PARA ${nodeName} (${date}) ---`);
    console.log(`Total Liquidaciones: ${list.length}`);
    if (list.length > 0) console.log(`Ejemplo Liquidación:`, JSON.stringify(list[0], null, 2));
}

async function auditBalances(nodeId, nodeName) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/customers/search?page=1&pageSize=10`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            request: {}
        })
    });
    const data = await res.json();
    const list = data.content || [];
    console.log(`\n--- SALDOS CLIENTES PARA ${nodeName} ---`);
    console.log(`Muestra de Clientes: ${list.length}`);
    if (list.length > 0) {
        const withBalance = list.filter(c => (c.balance || 0) !== 0);
        console.log(`Clientes con Saldo (!=0): ${withBalance.length}`);
        if (withBalance.length > 0) console.log(`Ejemplo Saldo:`, JSON.stringify({ id: withBalance[0].id, name: withBalance[0].fullName, balance: withBalance[0].balance }, null, 2));
    }
}

async function run() {
    const nodes = [
        { id: '2378041', name: 'BIOSALUD' },
        { id: '2406943', name: 'CHACRAS' }
    ];
    const dates = ['2026-01-20', '2026-01-25', '2025-12-15'];

    for (const node of nodes) {
        console.log(`\n=========================================`);
        console.log(`AUDITING NODE: ${node.name} (${node.id})`);
        console.log(`=========================================`);

        await auditBalances(node.id, node.name);

        for (const testDate of dates) {
            console.log(`\n>>> Testing Date: ${testDate}`);
            await countTypes(node.id, node.name, testDate);
            await auditExpenses(node.id, node.name, testDate);
            await auditInsurance(node.id, node.name, testDate);
        }
    }
}

run();
