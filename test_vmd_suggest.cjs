/**
 * Test del endpoint: suggestBuyQuantityByVmdCriteria
 * Objetivo: Obtener sugerencia de compra basada en Venta Media Diaria (VMD)
 */

const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

const NODES = {
    CONCENTRADOR: '2378039',
    BIOSALUD: '2378041',
    CHACRAS: '2406943'
};

async function getZettiToken() {
    console.log("🔐 Obteniendo token...");
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
    console.log("✅ Token obtenido");
    return data.access_token;
}

async function testVmdSuggest() {
    try {
        const token = await getZettiToken();

        // Probamos con BioSalud
        const idEntidad = NODES.BIOSALUD;

        // El endpoint parece ser algo como: /{idEntidad}/products/suggest-buy-quantity-by-vmd
        // Probemos varias variantes
        const endpoints = [
            `/v2/${idEntidad}/products/suggest-buy-quantity-by-vmd`,
            `/${idEntidad}/products/suggest-buy-quantity-by-vmd`,
            `/${idEntidad}/productos/suggest-buy-quantity-by-vmd-criteria`,
        ];

        for (const endpoint of endpoints) {
            const url = `${ZETTI_CONFIG.api_url}${endpoint}`;
            console.log(`\n📊 Probando: ${url}`);

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            const data = await res.json();
            console.log(`   Status: ${res.status}`);
            if (res.status !== 404) {
                console.log("   Respuesta:", JSON.stringify(data, null, 2).slice(0, 500));
            }
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

testVmdSuggest();
