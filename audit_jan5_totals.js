const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

const NODOS = {
    'BIOSALUD': '2378041',
    'CHACRAS': '2406943'
};

async function getZettiToken() {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', 'biotrack');
    params.append('password', 'SRwdDVgLQT1i');
    const auth = Buffer.from(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`).toString('base64');
    const res = await fetch(ZETTI_CONFIG.auth_url, {
        method: 'POST',
        body: params,
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    const data = await res.json();
    return data.access_token;
}

async function getInvoicesDetail(nodeName, nodeId, date) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search`;

    let allRecords = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) {
        console.log(`  [${nodeName}] Buscando página ${page}...`);
        const paginatedUrl = `${url}?page=${page}&pageSize=50&include_items=true`;
        const body = {
            emissionDateFrom: `${date}T00:00:00.000-03:00`,
            emissionDateTo: `${date}T23:59:59.999-03:00`
        };

        const res = await fetch(paginatedUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.content || []);

        if (list.length > 0) {
            console.log(`  [${nodeName}] Pág ${page}: ${list[0].emissionDate} AL ${list[list.length - 1].emissionDate}`);
        }

        allRecords = allRecords.concat(list);
        console.log(`  [${nodeName}] Recibidos ${list.length} registros (Total acumulado: ${allRecords.length})`);

        if (list.length < 50) {
            hasMore = false;
        } else {
            page++;
        }
    }

    let totalAmt = 0;
    allRecords.forEach(inv => {
        totalAmt += inv.mainAmount || 0;
    });

    return { count: allRecords.length, totalAmt, list: allRecords };
}

async function run() {
    try {
        const date = '2026-01-05';
        console.log(`Auditoria detallada (Monto Real) para el ${date}...\n`);

        const bio = await getInvoicesDetail('BIOSALUD', NODOS.BIOSALUD, date);
        const chacras = await getInvoicesDetail('CHACRAS', NODOS.CHACRAS, date);

        console.log(`BIOSALUD:`);
        console.log(`  - Comprobantes: ${bio.count}`);
        console.log(`  - Monto Total (Calculado): $${bio.totalAmt.toLocaleString('es-AR')}`);

        console.log(`\nCHACRAS:`);
        console.log(`  - Comprobantes: ${chacras.count}`);
        console.log(`  - Monto Total (Calculado): $${chacras.totalAmt.toLocaleString('es-AR')}`);

        console.log(`\nTOTAL GENERAL (ZETTI):`);
        console.log(`  - Comprobantes: ${bio.count + chacras.count}`);
        console.log(`  - Monto Acumulado: $${(bio.totalAmt + chacras.totalAmt).toLocaleString('es-AR')}`);

        console.log(`\nEXPORTACION USUARIO:`);
        console.log(`  - Comprobantes: 88`);
        console.log(`  - Monto Bio: $1.323.245`);
        console.log(`  - Monto Chacras: $1.081.288`);
        console.log(`  - Total Export: $2.404.533`);

    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

run();
