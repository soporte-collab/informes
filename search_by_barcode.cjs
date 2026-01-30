/**
 * Buscar productos por barcode para obtener sus IDs de Zetti
 * Usando el mismo endpoint que funciona en el tunnel
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

async function searchByBarcode() {
    try {
        const token = await getZettiToken();
        console.log("✅ Token obtenido\n");

        const nodeId = 2378041; // BioSalud

        // Barcodes reales del maestro que pasaste antes
        const barcodes = [
            "7793094000478",  // ACEITE CITRONELA
            "7793640232261",  // ACETILSALIC
            "7790375000219",  // BIL 13
        ];

        const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/products/search?include_groups=true&include_groups_configuration=true`;

        console.log(`🔍 Buscando productos por barcode...`);
        console.log(`   URL: ${url}\n`);

        for (const barcode of barcodes) {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ barCodes: [barcode] })
            });

            const data = await res.json();

            if (res.status === 200 && data.content && data.content.length > 0) {
                const product = data.content[0];
                console.log(`✅ ${product.description || product.name}`);
                console.log(`   ID: ${product.id}`);
                console.log(`   Barcode: ${barcode}\n`);
            } else {
                console.log(`❌ No encontrado: ${barcode}`);
                if (data.message) console.log(`   Error: ${data.message}\n`);
            }
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

searchByBarcode();
