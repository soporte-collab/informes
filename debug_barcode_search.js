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

async function searchByBarcode(nodeId, barcode) {
    const token = await getZettiToken();
    // Probamos con estas flags que vi en el código pero que quizás no estaban activas en la factura
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/products/search?include_groups=true&include_groups_configuration=true`;

    const body = {
        barCodes: [barcode]
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
    console.log(`\n--- SEARCH BY BARCODE (${barcode}) ---`);
    if (data.content && data.content.length > 0) {
        const prod = data.content[0];
        console.log("Name:", prod.description);
        console.log("Groups:", JSON.stringify(prod.groups, null, 2));
        console.log("Groups Config:", JSON.stringify(prod.groupsConfiguration, null, 2));
        if (prod.groups && prod.groups.length > 0) {
            console.log("SUCCESS: Category found via Barcode Search!");
        } else {
            console.log("FAIL: Still no groups found for this barcode.");
        }
    } else {
        console.log("Product not found by barcode.");
    }
}

async function run() {
    try {
        // Sertal: 7795345124230
        await searchByBarcode('2378041', '7795345124230');
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

run();
