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

function formatZettiDate(d, end) {
    if (!d) return end ? '2026-12-31T23:59:59.999-0300' : '2025-01-01T00:00:00.000-0300';
    const datePart = d.split('T')[0];
    const timePart = end ? '23:59:59.999' : '00:00:00.000';
    return `${datePart}T${timePart}-0300`;
}

async function getZettiToken() {
    console.log(`[DEBUG] Authenticating...`);
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

async function testQuery(pageSize, page) {
    const token = await getZettiToken();
    const nodeId = NODOS.BIOSALUD;
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?include_items=true`;

    const startDate = formatZettiDate('2026-01-01', false);
    const endDate = formatZettiDate('2026-01-13', true);

    console.log(`\n--- TEST: Page ${page}, PageSize ${pageSize} ---`);
    console.log(`Dates: ${startDate} to ${endDate}`);

    const body = {
        emissionDateFrom: startDate,
        emissionDateTo: endDate,
        page: page,
        pageSize: pageSize,
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
    const content = data.content || [];

    console.log(`Response status: ${res.status}`);
    console.log(`Total elements: ${data.totalElements}`);
    console.log(`Current page: ${data.number}`);
    console.log(`Content length: ${content.length}`);

    if (content.length > 0) {
        const signature = content.slice(0, 3).map(item => `${item.codification} (${item.emissionDate})`).join(', ');
        console.log(`Top 3: ${signature}`);
        const last = content[content.length - 1];
        console.log(`Last item: ${last.codification} (${last.emissionDate})`);
    } else {
        console.log(`Content is EMPTY`);
        // console.log('Raw data:', JSON.stringify(data, null, 2));
    }
}

async function runTests() {
    try {
        // Test Page 0
        await testQuery(50, 0);
        // Test Page 1
        await testQuery(50, 1);
    } catch (e) {
        console.error(e);
    }
}

runTests();
