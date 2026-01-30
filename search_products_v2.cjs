/**
 * Buscar productos con el body correcto según el Swagger
 */

const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

const NODES = {
    CONCENTRADOR: 2378039,
    BIOSALUD: 2378041,
    CHACRAS: 2406943
};

async function getZettiToken() {
    const credsBase64 = Buffer.from(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`).toString('base64');
    const authParams = new URLSearchParams();
    authParams.append('grant_type', 'password');
    authParams.append('username', ZETTI_CONFIG.client_id);
    authParams.append('password', ZETTI_CONFIG.client_secret);

    const res = await fetch(ZETTI_CONFIG.auth_url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credsBase64}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: authParams.toString()
    });
    const data = await res.json();
    return data.access_token;
}

async function searchProducts() {
    try {
        const token = await getZettiToken();
        console.log("✅ Token obtenido\n");

        const url = `${ZETTI_CONFIG.api_url}/v2/${NODES.BIOSALUD}/products/search`;

        // Body según el Swagger
        const body = {
            name: "TAFIROL",  // Campo correcto según Swagger
            includeParentNodes: true,
            includeChildrenNodes: true,
            onlyEnabledLeafGroups: true
        };

        console.log(`🔍 Buscando productos con name="TAFIROL"...`);
        console.log(`   URL: ${url}`);
        console.log(`   Body: ${JSON.stringify(body)}\n`);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        console.log(`Status: ${res.status}\n`);

        if (res.status === 200 && data.content?.length > 0) {
            console.log(`📦 Encontrados ${data.content.length} productos:\n`);

            data.content.slice(0, 5).forEach((p, i) => {
                console.log(`${i + 1}. ${p.description || p.name}`);
                console.log(`   ID: ${p.id}`);
                console.log(`   Barcode: ${p.barCode || p.barcode}`);
                console.log('');
            });

            const ids = data.content.slice(0, 5).map(p => p.id);
            console.log(`🎯 ProductIds: [${ids.join(', ')}]`);
        } else {
            console.log(JSON.stringify(data, null, 2).slice(0, 800));
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

searchProducts();
