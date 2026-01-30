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

async function countForDate(nodeId, date) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search`;
    const body = {
        emissionDateFrom: `${date}T00:00:00.000-0300`,
        emissionDateTo: `${date}T23:59:59.999-0300`,
        page: 0,
        pageSize: 1 // Just to trigger the search
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
    return Array.isArray(data) ? data.length : (data.totalElements || 0);
}

async function run() {
    try {
        const days = ['2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-12', '2026-01-13'];
        console.log("Escaneando volumen de comprobantes por día...\n");
        for (const d of days) {
            const bio = await countForDate(NODOS.BIOSALUD, d);
            const cha = await countForDate(NODOS.CHACRAS, d);
            console.log(`${d} -> BioSalud: ${bio} | Chacras: ${cha} | Total: ${bio + cha}`);
        }
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

run();
