const axios = require('axios');
const qs = require('qs');

async function testZetti() {
    console.log('--- TEST ZETTI API (SIN PAGINACIÓN EXPLÍCITA) ---');

    const client_id = 'biotrack';
    const client_secret = 'SRwdDVgLQT1i';
    const username = 'biotrack';
    const password = 'SRwdDVgLQT1i';
    const authUrl = 'http://190.15.199.103:8089/oauth-server/oauth/token';

    try {
        console.log('1. Autenticando...');
        const authHeader = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
        const authResponse = await axios.post(authUrl, qs.stringify({
            grant_type: 'password',
            username: username,
            password: password
        }), {
            headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const token = authResponse.data.access_token;
        console.log('✔ Token obtenido.');

        // Probamos con los parámetros que usa la Firebase Function
        const nodeId = 2378041;
        console.log('Buscando comprobante específico: 0008-00011819');

        const response = await axios.post(url, {
            emissionDateFrom: '2025-01-01T00:00:00.000-0300',
            emissionDateTo: '2026-12-31T23:59:59.999-0300',
            codification: '0008-00011819' // Buscamos por número exacto
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('\n✔ Respuesta recibida');
        console.log('Status:', response.status);
        console.log('Tipo de respuesta:', typeof response.data);
        console.log('Es array:', Array.isArray(response.data));
        console.log('Cantidad:', Array.isArray(response.data) ? response.data.length : 'N/A');

        if (Array.isArray(response.data) && response.data.length > 0) {
            console.log('\n--- ESTRUCTURA PRIMER COMPROBANTE ---');
            console.log(JSON.stringify(response.data[0], null, 2));
        } else {
            console.log('\nRespuesta completa:', JSON.stringify(response.data, null, 2).substring(0, 500));
        }

    } catch (err) {
        console.log(`\n✖ Falló:`, err.response ? err.response.status : err.message);
        if (err.response && err.response.data) {
            console.log('Error data:', JSON.stringify(err.response.data).substring(0, 500));
        }
    }
}

testZetti();
