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

async function debugAccounting() {
    try {
        const token = await getZettiToken();
        const nodeId = '2378041'; // PASEO STARE

        console.log(`\n🔍 TEST 1: Cuentas Contables (Accounts) - TRYING GET`);
        // Probamos GET en lugar de POST
        const urlAccounts = `${ZETTI_API_BASE}/v2/${nodeId}/accounting/accounts`;

        console.log(`Requesting GET ${urlAccounts}...`);

        try {
            const res = await axios.get(urlAccounts, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { page: 1, pageSize: 20 }
            });
            console.log(`✅ Accounts found (GET): ${res.data.content?.length || 0}`);
            if (res.data.content?.length) {
                console.log(JSON.stringify(res.data.content[0], null, 2));
            } else {
                console.log("Response data:", res.data);
            }
        } catch (e) {
            console.log(`❌ Accounts GET failed: ${e.response?.status} - ${e.message}`);
        }

        // Intento con /search pero GET (raro pero posible en algunas APIs mal hechas)
        console.log(`\n🔍 TEST 2: Cuentas Contables (Accounts) - TRYING GET /search`);
        const urlAccountsSearch = `${ZETTI_API_BASE}/v2/${nodeId}/accounting/accounts/search`;
        try {
            const res = await axios.get(urlAccountsSearch, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`✅ Accounts Search (GET) result:`, res.status);
        } catch (e) {
            console.log(`❌ Accounts Search (GET) failed: ${e.response?.status}`);
        }

    } catch (e) {
        console.error('❌ FATAL ERROR:', e);
    }
}

debugAccounting();
