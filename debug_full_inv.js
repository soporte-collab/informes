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

async function debugFullInvoice(nodeId, invoiceId) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/${invoiceId}?include_items=true&include_relations=true`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await res.json();
    console.log(`\n--- FULL INVOICE DETAILS (${invoiceId}) ---`);
    if (data.items && data.items.length > 0) {
        const firstItem = data.items[0];
        console.log("Product Name:", firstItem.product?.description);
        console.log("Category:", firstItem.product?.category);
        console.log("Group:", firstItem.product?.group);
        if (firstItem.product?.category) {
            console.log("CATEGORY FOUND!");
        }
        if (firstItem.product?.group) {
            console.log("GROUP FOUND!");
        }
        console.log("Is there a category description?", firstItem.product?.category?.description);
    } else {
        console.log("Invoice has no items or was not found.");
    }
}

async function run() {
    try {
        await debugFullInvoice('2378041', '134940000000271781');
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

run();
