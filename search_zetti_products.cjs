/**
 * Buscar productos en Zetti para obtener IDs válidos
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

async function searchProducts() {
    try {
        const token = await getZettiToken();
        console.log("✅ Token obtenido\n");

        // Buscar productos por nombre - endpoint v2
        const nodeId = 2378041; // BioSalud
        const searchTerm = "IBUPROFENO";  // Algo común

        const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/products/search?name=${encodeURIComponent(searchTerm)}&page=0&size=5`;

        console.log(`🔍 Buscando: ${searchTerm}`);
        console.log(`   URL: ${url}\n`);

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        if (res.status === 200 && data.content) {
            console.log(`📦 Encontrados ${data.content.length} productos:\n`);
            data.content.forEach((p, i) => {
                console.log(`${i + 1}. ${p.name}`);
                console.log(`   ID: ${p.id}`);
                console.log(`   Barcode: ${p.barcode}`);
                console.log('');
            });

            // Guardar IDs para usar en statistics-by-node
            const ids = data.content.map(p => p.id);
            console.log(`\n📋 IDs para usar: [${ids.join(', ')}]`);
        } else {
            console.log(`Status: ${res.status}`);
            console.log(JSON.stringify(data, null, 2));
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

searchProducts();
