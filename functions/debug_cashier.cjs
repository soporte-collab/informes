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

async function debugCashierSessions() {
    try {
        console.log(`\n🔍 Buscando Rendiciones de Caja (CashierSessionsController)...`);
        const token = await getZettiToken();
        const nodeId = '2378041'; // PASEO STARE

        const url = `${ZETTI_API_BASE}/v2/${nodeId}/cashier-sessions/search`;
        console.log(`URL: ${url}`);

        // Buscamos rendiciones recientes
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const body = {
            openDateFrom: thirtyDaysAgo.toISOString(),
            openDateTo: now.toISOString(),
            include_details: true // Probamos flags comunes
        };

        const res = await axios.post(url, body, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const content = res.data.content || res.data || [];

        if (!content.length) {
            console.log('❌ No se encontraron rendiciones.');
            return;
        }

        console.log(`✅ Se encontraron ${content.length} rendiciones.`);
        console.log(`\n--- MUESTRA (Top 1) ---`);
        const session = content[0];
        console.log(JSON.stringify(session, null, 2));

        // Si tenemos ID, probamos buscar los comprobantes/gastos dentro de esa caja
        if (session.id) {
            console.log(`\n🔍 Explorando GASTOS dentro de la Sesión #${session.id}...`);
            // El swagger mencionaba /receipts-import, pero quizás haya otro endpoint para ver movimientos de caja
            // O quizás en el mismo objeto session venga algo sobre "expenses" o "withdrawals"

            // Intento A: Endpoint específico de receipts
            const urlReceipts = `${ZETTI_API_BASE}/v2/${nodeId}/cashier-sessions/${session.id}/receipts-import`;
            try {
                const resReceipts = await axios.get(urlReceipts, { headers: { 'Authorization': `Bearer ${token}` } });
                console.log(`   ➜ Recibos en caja:`, resReceipts.data);
            } catch (e) {
                console.log(`   ⚠️ Error fetching receipts: ${e.response?.status}`);
            }
        }

    } catch (e) {
        console.error('❌ ERROR CashierSessions:', e.response?.data || e.message);
    }
}

debugCashierSessions();
