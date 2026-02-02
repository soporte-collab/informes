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

async function debugFinalDebt() {
    try {
        console.log(`\n🔍 Buscando Deuda (Sales Receipts) con filtro CORRECTO "idEntity"`);
        const token = await getZettiToken();
        const nodeId = '2378041';
        const clientId = 134940000000000309; // Sheila Brahim (Number)

        const url = `${ZETTI_API_BASE}/v2/${nodeId}/sales-receipts/search?page=1&pageSize=50`;
        console.log(`URL: ${url}`);

        const dateFrom = "2024-01-01T00:00:00.000-0300";
        const dateTo = "2026-12-31T23:59:59.000-0300";

        // SEGUN SWAGGER: SalesInvoiceRequestDTO tiene "idEntity"
        const body = {
            emissionDateFrom: dateFrom,
            emissionDateTo: dateTo,
            idEntity: clientId
        };

        const res = await axios.post(url, body, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        const content = res.data.content || res.data || [];
        console.log(`✅ Comprobantes encontrados: ${content.length}`);

        if (content.length > 0) {
            const first = content[0];
            console.log(`   Cliente del primer item: ${first.customer?.name} (Code: ${first.customer?.code})`);

            // Filtramos solo los que parecen deuda (no pagados totalmente?)
            // En Zetti: si "status" = PENDING o similar.
            // O quizás tenemos que comparar montos.

            console.log("\n--- LISTA DE COMPROBANTES DEL CLIENTE ---");
            content.forEach(c => {
                console.log(`   [${c.emissionDate.substring(0, 10)}] ${c.valueType?.shortName} - $${c.mainAmount} (Estado: ${c.status?.name})`);
                // Si es "INGR" (Ingresado) suele ser impago. "PAGADO" es pago.
            });
        }

    } catch (e) {
        console.error('❌ FATAL ERROR:', e.response?.data || e.message);
    }
}

debugFinalDebt();
