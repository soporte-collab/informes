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

async function queryRange(nodeName, nodeId) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search`;

    // Broad range to see ANY data
    const body = {
        emissionDateFrom: `2025-12-25T00:00:00.000-0300`,
        emissionDateTo: `2026-01-14T23:59:59.999-0300`,
        page: 0,
        pageSize: 10,
        orderBy: [{ field: "emissionDate", direction: "DESC" }]
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
    console.log(`\n--- RANGE DATA IN ${nodeName} ---`);
    console.log('Keys in response:', Object.keys(data));
    console.log(`Total Found: ${data.totalElements || data.total_elements || 'N/A'}`);
    if (data.content && data.content.length > 0) {
        data.content.forEach(inv => {
            console.log(`${inv.codification} | Date: ${inv.emissionDate} | Amt: ${inv.totalAmount}`);
        });
    }
}

async function run() {
    try {
        await queryRange('BIOSALUD', NODOS.BIOSALUD);
        await queryRange('CHACRAS', NODOS.CHACRAS);
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

run();
