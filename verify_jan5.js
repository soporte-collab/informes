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

    // Using Buffer for stable base64 encoding in Node
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
    if (!data.access_token) {
        throw new Error('Auth Failed: ' + JSON.stringify(data));
    }
    return data.access_token;
}

async function countInvoices(nodeName, nodeId, date) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search`;

    const body = {
        emissionDateFrom: `${date}T00:00:00.000-0300`,
        emissionDateTo: `${date}T23:59:59.999-0300`,
        page: 0,
        pageSize: 1
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    return data.totalElements || 0;
}

async function run() {
    try {
        const date = '2026-01-13';
        console.log(`Pidiendo totales para el dia ${date}...`);

        const bio = await countInvoices('BIOSALUD', NODOS.BIOSALUD, date);
        const chacras = await countInvoices('CHACRAS', NODOS.CHACRAS, date);

        console.log(`\nBIOSALUD: ${bio} comprobantes`);
        console.log(`CHACRAS: ${chacras} comprobantes`);
        console.log(`TOTAL: ${bio + chacras}`);
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

run();
