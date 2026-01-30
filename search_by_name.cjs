/**
 * Buscar productos por descripción para obtener IDs de Zetti
 */

const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
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

async function searchByName() {
    try {
        const token = await getZettiToken();
        console.log("✅ Token obtenido\n");

        const nodeId = 2378041; // BioSalud

        const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/products/search?include_groups=true`;

        console.log(`🔍 Buscando "IBUPROFENO"...`);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: "IBUPROFENO",
                page: 0,
                size: 5
            })
        });

        const data = await res.json();

        console.log(`\nStatus: ${res.status}`);

        if (res.status === 200 && data.content && data.content.length > 0) {
            console.log(`📦 Encontrados ${data.content.length} productos:\n`);

            data.content.slice(0, 5).forEach((p, i) => {
                console.log(`${i + 1}. ${p.description || p.name}`);
                console.log(`   ID: ${p.id}`);
                console.log(`   Barcode: ${p.barCode || p.barcode}`);
                console.log('');
            });

            const ids = data.content.slice(0, 5).map(p => p.id);
            console.log(`\n🎯 IDs para statistics-by-node: [${ids.join(', ')}]`);
        } else {
            console.log(JSON.stringify(data, null, 2).slice(0, 1000));
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

searchByName();
