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

async function debugItemsUntilManufacturerFound(nodeId) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?include_items=true`;
    const body = {
        emissionDateFrom: `2026-01-20T00:00:00.000-0300`,
        emissionDateTo: `2026-01-31T23:59:59.000-0300`,
        pageSize: 100
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
    for (const inv of content) {
        for (const item of (inv.items || [])) {
            if (item.product?.manufacturer) {
                console.log(`\n--- FOUND MANUFACTURER! ---`);
                console.log(JSON.stringify(item.product.manufacturer, null, 2));
                return;
            }
        }
    }
    console.log("No product with manufacturer found in 100 invoices.");
}

async function run() {
    try {
        await debugItemsUntilManufacturerFound('2378041');
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

run();
