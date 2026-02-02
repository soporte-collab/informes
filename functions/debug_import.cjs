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

async function debugDataExport() {
    try {
        console.log(`\n🔍 Buscando Importaciones de Datos (DataImportationController)...`);
        const token = await getZettiToken();
        const nodeId = '2378039'; // CONCENTRADOR

        // Intento 1: GET Listing?
        // El swagger mostraba /{idNodo}/data-importation/{idImportation}
        // No vi un search explicito, probaremos /search POST
        const urlv1 = `${ZETTI_API_BASE}/${nodeId}/data-importation/search`;
        console.log(`Probando POST ${urlv1}`);

        try {
            const res = await axios.post(urlv1, {}, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            console.log('✅ POST /search Success!');
            console.log(res.data);
            return;
        } catch (e) {
            console.log(`⚠️ POST /search falló: ${e.response?.status} - ${e.message}`);
        }

        // Intento 2: GET simple
        const urlv2 = `${ZETTI_API_BASE}/${nodeId}/data-importation`;
        console.log(`Probando GET ${urlv2}`);
        try {
            const res2 = await axios.get(urlv2, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('✅ GET Success!');
            console.log(res2.data);
        } catch (e) {
            console.log(`⚠️ GET falló: ${e.response?.status}`);
        }

    } catch (e) {
        console.error('❌ ERROR DataImportation:', e.response?.data || e.message);
    }
}

debugDataExport();
