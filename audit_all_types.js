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
    let all = [];
    let page = 1;

    while (true) {
        const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?page=${page}&pageSize=50`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emissionDateFrom: `${date}T00:00:00.000-0300`,
                emissionDateTo: `${date}T23:59:59.999-0300`
            })
        });
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.content || []);
        if (list.length === 0) break;
        all = [...all, ...list];
        if (list.length < 50) break;
        page++;
    }

    const types = {};
    all.forEach(inv => {
        const t = inv.valueType?.name || 'DESCONOCIDO';
        types[t] = (types[t] || 0) + 1;
    });

    console.log(`\n--- RESULTADOS PARA ${nodeName} (${date}) ---`);
    console.log(`Total Comprobantes: ${all.length}`);
    console.log(`Desglose por Tipo:`, JSON.stringify(types, null, 2));

    // Buscar posibles duplicados de número
    const cods = new Set();
    const dups = [];
    all.forEach(inv => {
        if (cods.has(inv.codification)) dups.push(inv.codification);
        cods.add(inv.codification);
    });
    if (dups.length > 0) console.log(`OJO: Hay ${dups.length} números repetidos en Zetti:`, dups);
}

async function run() {
    await countTypes('2378041', 'BIOSALUD', '2026-01-05');
    await countTypes('2406943', 'CHACRAS', '2026-01-05');
}

run();
