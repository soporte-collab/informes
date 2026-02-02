const axios = require('axios');

const ZETTI_AUTH_URL = 'http://190.15.199.103:8089/oauth-server/oauth/token';
const ZETTI_API_BASE = 'http://190.15.199.103:8089/api-rest';
const ZETTI_USER = 'biotrack';
const ZETTI_PASS = 'SRwdDVgLQT1i';
const ZETTI_CLIENT_ID = 'biotrack';
const ZETTI_CLIENT_SECRET = 'SRwdDVgLQT1i';

async function getZettiToken() {
    const credsBase64 = Buffer.from(`${ZETTI_CLIENT_ID}:${ZETTI_CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', ZETTI_USER);
    params.append('password', ZETTI_PASS);

    const res = await axios.post(ZETTI_AUTH_URL, params.toString(), {
        headers: {
            'Authorization': `Basic ${credsBase64}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return res.data.access_token;
}

async function inspectInvoiceDetails() {
    try {
        console.log(`\n🔍 Inspeccionando Detalle de Factura de Sheila`);
        const token = await getZettiToken();
        const nodeId = '2378041';

        // Replicamos la búsqueda que funcionó (con el ID hackeado)
        const clientIdStr = "134940000000000309";
        const url = `${ZETTI_API_BASE}/v2/${nodeId}/sales-receipts/search?page=1&pageSize=1`; // Solo 1

        const bodyObj = {
            emissionDateFrom: "2025-01-01T00:00:00.000-0300", // Recientes para ver
            emissionDateTo: "2026-12-31T23:59:59.000-0300",
            idEntity: "PLACEHOLDER_ID"
        };
        let bodyJson = JSON.stringify(bodyObj).replace('"PLACEHOLDER_ID"', clientIdStr);

        const res = await axios.post(url, bodyJson, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        const content = res.data.content || res.data || [];

        if (content.length > 0) {
            const invoice = content[0];
            console.log("--- JSON COMPLETO DE LA FACTURA ---");
            console.log(JSON.stringify(invoice, null, 2));

            // Verificamos si tiene info de Pagos (Payment Forms)
            // A veces requiere otro endpoint para ver el "Payoff" o detalle de cobro.

            // Si no vemos nada aquí, probaremos GET /sales-receipts/{id}

        } else {
            console.log("⚠️ No se encontraron facturas recientes (2025+) para inspeccionar.");
        }

    } catch (e) {
        console.error('❌ FATAL ERROR:', e.response?.data || e.message);
    }
}

inspectInvoiceDetails();
