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

async function debugProductDetailsBatch(nodeId, productIds) {
    const token = await getZettiToken();
    // In functions it was using 2378039 (some parent node?)
    // const url = `${ZETTI_CONFIG.api_url}/2378039/products/details-per-nodes`;
    const url = `${ZETTI_CONFIG.api_url}/v2/products/details-per-nodes`;

    const body = {
        idsNodos: [nodeId],
        idsProductos: productIds
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
    console.log(`\n--- BATCH PRODUCT DETAILS ---`);
    if (data && data.length > 0) {
        console.log("Sample product detail keys:", Object.keys(data[0] || {}));
        console.log("Sample details keys:", Object.keys(data[0].detalles || {}));
        console.log("Full sample:", JSON.stringify(data[0], null, 2));
    } else {
        console.log("No data returned or empty array.");
    }
}

async function run() {
    try {
        // Sertal ID: 100100000000162990
        await debugProductDetailsBatch('2378041', ['100100000000162990']);
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

run();
