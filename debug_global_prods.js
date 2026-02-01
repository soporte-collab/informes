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

async function findAnyProductGlobal() {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/2378039/products/search`;
    const body = {
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
    console.log(`Checking ${content.length} products on parent node...`);
    for (const prod of content) {
        if (prod.groups && prod.groups.length > 0) {
            console.log(`\n--- FOUND PRODUCT WITH GROUPS ---`);
            console.log("Name:", prod.description);
            console.log("Groups:", JSON.stringify(prod.groups, null, 2));
            return;
        }
    }
}

async function run() {
    try {
        await findAnyProductGlobal();
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

run();
