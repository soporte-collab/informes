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

async function testLargePageSize() {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/2378041/sales-receipts/search?page=1&pageSize=200`;
    const body = {
        emissionDateFrom: `2026-01-05T00:00:00.000-0300`,
        emissionDateTo: `2026-01-05T23:59:59.999-0300`
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
    console.log(`PageSize=200 in URL -> Received: ${data.length}`);
    console.log(`Pagination Limit Header: ${res.headers.get('x-pagination-limit')}`);
}

testLargePageSize();
