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

async function debugSingleInvoice(nodeId, invoiceId) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/${invoiceId}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await res.json();
    console.log(`\n--- SINGLE INVOICE DETAILS (${invoiceId}) ---`);
    if (data.items && data.items.length > 0) {
        console.log("Item 0 Product keys:", Object.keys(data.items[0].product || {}));
        console.log("Item 0 Product Category:", data.items[0].product?.category);
        console.log("Item 0 Product Group:", data.items[0].product?.group);
        console.log("Full Item 0 sample:", JSON.stringify(data.items[0], null, 2));
    } else {
        console.log("Invoice has no items.");
    }
}

async function run() {
    try {
        // ID from previous debug: 134940000000271781 (the SERTAL one)
        await debugSingleInvoice('2378041', '134940000000271781');
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

run();
