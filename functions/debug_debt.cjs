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

// Probaremos buscar FACTURAS DE VENTA (Sales Receipts) pendientes
async function debugDebt() {
    try {
        console.log(`\n🔍 Buscando Deuda (Sales Receipts)...`);
        const token = await getZettiToken();
        const nodeId = '2378041'; // Paseo Stare
        const clientId = '134940000000000309'; // Sheila Brahim

        // El endpoint exacto lo confirmaríamos con el grep, pero probamos el estandar v2
        const url = `${ZETTI_API_BASE}/v2/${nodeId}/sales-receipts/search?page=1&pageSize=20`;
        console.log(`URL: ${url}`);

        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(now.getMonth() - 6);

        // Cuerpo de búsqueda tentativo para encontrar comprobantes de ese cliente
        const body = {
            emissionDateFrom: sixMonthsAgo.toISOString(),
            emissionDateTo: now.toISOString(),
            customer: { id: clientId }
            // Ojo: algunos endpoints piden 'customerId': clientId, otros el objeto completo
        };

        try {
            const res = await axios.post(url, body, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });

            const content = res.data.content || res.data || [];
            console.log(`✅ Comprobantes encontrados: ${content.length}`);

            if (content.length > 0) {
                console.log("--- Ejemplo (Top 1) ---");
                console.log(JSON.stringify(content[0], null, 2));

                // Calculamos la deuda sumando los que no están pagados del todo?
                // O miramos si tienen campo 'balance' o 'pendingAmount'
            } else {
                console.log("⚠️ No se encontraron comprobantes con este filtro. Probando filtro alternativo (customerId plano)...");

                // Intento 2: customerId plano
                const body2 = {
                    emissionDateFrom: sixMonthsAgo.toISOString(),
                    emissionDateTo: now.toISOString(),
                    customerId: clientId
                };
                const res2 = await axios.post(url, body2, { headers: { 'Authorization': `Bearer ${token}` } });
                console.log(`✅ (Intento 2) Comprobantes encontrados: ${res2.data.content?.length || 0}`);
            }

        } catch (e) {
            console.log(`❌ Search failed: ${e.response?.status} - ${e.message}`);
            // console.log(e.response?.data);
        }

    } catch (e) {
        console.error('❌ FATAL ERROR:', e);
    }
}

debugDebt();
