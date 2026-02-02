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

async function debugInventory() {
    try {
        const token = await getZettiToken();
        const nodeId = '2378039'; // CONCENTRADOR

        console.log(`\n🔍 TEST 1: Inventory List (GET)`);
        const urlGet = `${ZETTI_API_BASE}/${nodeId}/inventories`;
        console.log(`Testing GET ${urlGet}`);

        try {
            const res = await axios.get(urlGet, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { page: 0, size: 5 } // Standard params
            });
            console.log(`✅ GET Inventory Success! Found: ${res.data.content?.length || '?'}`);
            console.log(JSON.stringify(res.data, null, 2));
        } catch (e) {
            console.log(`❌ GET Inventory failed: ${e.response?.status} - ${e.message}`);
            if (e.response?.status === 405) console.log("   (Method Not Allowed)");
        }

    } catch (e) {
        console.error('❌ FATAL ERROR:', e);
    }
}

debugInventory();
