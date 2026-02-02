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

async function searchAccountingAccounts() {
    try {
        console.log(`\n🔍 Buscando Cuentas Contables...`);
        const token = await getZettiToken();
        const nodeId = '2378041'; // Biosalud

        const url = `${ZETTI_API_BASE}/v2/${nodeId}/accounting/accounts/search`;

        // Probamos con un body vacío para traer todo
        const res = await axios.post(url, {}, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const accounts = res.data || [];
        console.log(`✅ Cuentas encontradas: ${accounts.length}`);

        accounts.forEach(acc => {
            if (acc.name.includes("CUENTA CORRIENTE") || acc.code === "CTACTE" || acc.code === "CCTACTE") {
                console.log(`ID: ${acc.id} - Código: ${acc.code} - Nombre: ${acc.name}`);
            }
        });

        if (accounts.length > 0 && accounts.length < 10) {
            console.log(JSON.stringify(accounts, null, 2));
        }

    } catch (e) {
        console.error('❌ ERROR:', e.response?.data || e.message);
    }
}

searchAccountingAccounts();
