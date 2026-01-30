/**
 * Obtener detalle de una factura específica para ver los productIds de los items
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

async function getInvoiceDetail() {
    try {
        const token = await getZettiToken();
        console.log("✅ Token obtenido\n");

        const nodeId = 2378041; // BioSalud
        const invoiceId = "134940000000267919"; // ID de la última factura que vimos

        // Endpoint para obtener detalle de factura
        const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/${invoiceId}`;

        console.log(`🔍 Obteniendo detalle de factura: ${invoiceId}`);

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        if (res.status === 200) {
            console.log(`\n📦 Factura: ${data.codification}`);
            console.log(`   Monto: $${data.mainAmount}`);
            console.log(`\n📋 Items (${(data.items || []).length}):\n`);

            (data.items || []).slice(0, 10).forEach((item, i) => {
                console.log(`${i + 1}. ${item.description || item.product?.description}`);
                console.log(`   Product ID: ${item.product?.id}`);
                console.log(`   Barcode: ${item.barCode || item.product?.barCode}`);
                console.log(`   Cantidad: ${item.quantity}`);
                console.log('');
            });

            // Guardar los IDs
            const productIds = (data.items || []).map(item => item.product?.id).filter(Boolean);
            console.log(`\n🎯 ProductIds para statistics-by-node:`);
            console.log(`   [${productIds.join(', ')}]`);

        } else {
            console.log(`Status: ${res.status}`);
            console.log(JSON.stringify(data, null, 2));
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

getInvoiceDetail();
