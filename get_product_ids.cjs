/**
 * Obtener ProductIds de las ventas recientes en Zetti
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

async function getProductIdsFromSales() {
    try {
        const token = await getZettiToken();
        console.log("✅ Token obtenido\n");

        // Consultar ventas de ayer
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        const fechaDesde = ayer.toISOString();
        const fechaHasta = new Date().toISOString();

        const nodeId = 2378041; // BioSalud
        const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search`;

        console.log(`🔍 Buscando ventas de ayer en BioSalud...`);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                emissionDateFrom: fechaDesde,
                emissionDateTo: fechaHasta,
                page: 0,
                size: 5  // Solo 5 facturas para obtener productos
            })
        });

        const data = await res.json();

        if (res.status === 200 && data.content) {
            console.log(`📦 Encontradas ${data.content.length} facturas\n`);

            // Extraer productIds únicos de los items
            const productIds = new Set();
            const productSamples = [];

            data.content.forEach(sale => {
                (sale.items || []).forEach(item => {
                    if (item.product?.id) {
                        productIds.add(item.product.id);
                        if (productSamples.length < 10) {
                            productSamples.push({
                                id: item.product.id,
                                name: item.description || item.product.description,
                                barcode: item.barCode || item.product.barCode
                            });
                        }
                    }
                });
            });

            console.log(`📋 Productos encontrados:\n`);
            productSamples.forEach((p, i) => {
                console.log(`${i + 1}. ID: ${p.id}`);
                console.log(`   Nombre: ${p.name}`);
                console.log(`   Barcode: ${p.barcode}\n`);
            });

            console.log(`\n🎯 IDs para usar en statistics-by-node:`);
            console.log(`   [${[...productIds].slice(0, 10).join(', ')}]`);

        } else {
            console.log(`Status: ${res.status}`);
            console.log(JSON.stringify(data, null, 2));
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

getProductIdsFromSales();
