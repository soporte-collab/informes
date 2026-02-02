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

async function debugAccountById() {
    try {
        const token = await getZettiToken();
        const nodeId = '2378041';
        const clientId = '134940000000000309';

        console.log(`\n🔍 TEST DIRECTO: GET /accounting/accounts/${clientId}`);
        // Intentamos usar el id de cliente como si fuera el id de cuenta directamente
        const urlDirect = `${ZETTI_API_BASE}/v2/${nodeId}/accounting/accounts/${clientId}`;

        try {
            const res = await axios.get(urlDirect, { headers: { 'Authorization': `Bearer ${token}` } });
            console.log("✅ Cuenta encontrada usando ID Cliente:", JSON.stringify(res.data, null, 2));
        } catch (e) {
            console.log(`❌ No es el mismo ID (404/500): ${e.response?.status}`);
        }

    } catch (e) {
        console.error('❌ FATAL ERROR:', e);
    }
}

debugAccountById();
