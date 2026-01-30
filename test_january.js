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

    const auth = btoa(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`);

    try {
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
    } catch (err) {
        console.error('Auth Error:', err.message);
        throw err;
    }
}

async function testQuery(nodeName, nodeId) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search`;

    const body = {
        emissionDateFrom: "2026-01-01T00:00:00.000-03:00",
        emissionDateTo: "2026-01-31T23:59:59.999-03:00",
        page: 1,
        pageSize: 5
    };

    console.log(`\n=== Testing ${nodeName} ===`);
    console.log('Body:', JSON.stringify(body, null, 2));

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (data.error || data.errors) {
            console.log('ERROR:', JSON.stringify(data));
        } else {
            const content = data.content || [];
            console.log(`Received ${content.length} records`);
            if (content.length > 0) {
                console.log(`First invoice: ${content[0].emissionDate} - ${content[0].codification}`);
            }
        }
    } catch (err) {
        console.error('Fetch error:', err.message);
    }
}

async function run() {
    await testQuery('BIOSALUD', NODOS.BIOSALUD);
    await testQuery('CHACRAS', NODOS.CHACRAS);
}

run();
