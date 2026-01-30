const axios = require('axios');
const qs = require('qs');

async function testZetti() {
    console.log('--- TEST ZETTI API 0008-00011819 ---');

    const client_id = 'biotrack';
    const client_secret = 'SRwdDVgLQT1i';
    const authUrl = 'http://190.15.199.103:8089/oauth-server/oauth/token';

    try {
        console.log('1. Autenticando...');
        const authHeader = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
        const authResponse = await axios.post(authUrl, qs.stringify({
            grant_type: 'password',
            username: client_id,
            password: client_secret
        }), {
            headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const token = authResponse.data.access_token;
        console.log('✔ Token obtenido.');

        const nodeId = 2406943;
        const url = `http://190.15.199.103:8089/api-rest/v2/${nodeId}/sales-receipts/search?include_items=true&include_agreements=true`;

        console.log('2. Buscando comprobante 0008-00011819 en Nodo', nodeId);
        const body = {
            emissionDateFrom: '2025-01-01T00:00:00.000-0300',
            emissionDateTo: '2026-12-31T23:59:59.999-0300',
            codification: '0008-00011819'
        };

        const response = await axios.post(url, body, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✔ Respuesta recibida.');
        console.log('RESULTADO:', JSON.stringify(response.data, null, 2));

    } catch (err) {
        console.error('✘ ERROR:', err.response?.data || err.message);
    }
}

testZetti();
