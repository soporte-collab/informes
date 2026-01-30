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

async function testPageIndices() {
    const token = await getZettiToken();
    const date = '2026-01-05';

    async function check(p) {
        const url = `${ZETTI_CONFIG.api_url}/v2/2378041/sales-receipts/search?page=${p}&pageSize=10`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emissionDateFrom: `${date}T00:00:00.000-0300`,
                emissionDateTo: `${date}T23:59:59.999-0300`
            })
        });
        const data = await res.json();
        return {
            header: res.headers.get('x-pagination-page'),
            firstCod: data[0]?.codification
        };
    }

    const p0 = await check(0);
    const p1 = await check(1);
    const p2 = await check(2);

    console.log(`Page 0: Header=${p0.header}, FirstCod=${p0.firstCod}`);
    console.log(`Page 1: Header=${p1.header}, FirstCod=${p1.firstCod}`);
    console.log(`Page 2: Header=${p2.header}, FirstCod=${p2.firstCod}`);
}

testPageIndices();
