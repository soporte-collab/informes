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

async function inspectFirstInvoice(nodeName, nodeId, date) {
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
    const list = Array.isArray(data) ? data : (data.content || []);

    console.log(`\n--- PRIMER COMPROBANTE EN ${nodeName} ---`);
    if (list.length > 0) {
        console.log('Keys disponibles:', Object.keys(list[0]));
        console.log('Ejemplo de datos:', JSON.stringify(list[0], null, 2));
    } else {
        console.log('No se encontraron comprobantes.');
    }
}

async function run() {
    try {
        const date = '2026-01-05';
        await inspectFirstInvoice('BIOSALUD', NODOS.BIOSALUD, date);
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

run();
