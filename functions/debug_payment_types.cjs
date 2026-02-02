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

async function listValueTypes() {
    try {
        console.log(`\n🔍 Obteniendo Formas de Pago (Value Types)...`);
        const token = await getZettiToken();
        const nodeId = '2378041'; // Biosalud

        const url = `${ZETTI_API_BASE}/v2/${nodeId}/value-type/payments`;

        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const types = res.data || [];
        console.log(`✅ Tipos encontrados: ${types.length}`);

        console.log("\n--- Formas de Pago ---");
        types.forEach(t => {
            console.log(`ID: ${t.id} - Nombre: ${t.name} - Descripción: ${t.description}`);
        });

    } catch (e) {
        console.error('❌ ERROR:', e.response?.data || e.message);
    }
}

listValueTypes();
