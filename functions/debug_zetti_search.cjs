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

async function debugSearch(termValue) {
    try {
        console.log(`\n🔍 Buscando productos con término: ${termValue}`);
        const token = await getZettiToken();
        // Probamos con term en el body y query param por las dudas
        const url = `${ZETTI_API_BASE}/v2/2378041/products/search?include_groups=true&term=${termValue}`;

        const res = await axios.post(url, {}, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const content = res.data.content || res.data || [];
        if (!content.length) {
            console.log('❌ No se encontraron productos.');
            return;
        }

        content.slice(0, 3).forEach((p, idx) => {
            console.log(`\n--- PRODUCTO [${idx + 1}] ---`);
            console.log(`ID: ${p.id}`);
            console.log(`Descripción: ${p.description}`);
            console.log(`Barcode: ${p.barCode}`);

            console.log('GRUPOS:');
            if (p.groups) {
                p.groups.forEach(g => {
                    console.log(`  - [${g.groupType?.name}] ${g.name}`);
                });
            }
        });

    } catch (e) {
        console.error('❌ ERROR:', e.response?.data || e.message);
    }
}

const term = process.argv[2] || 'IBUPROFENO';
debugSearch(term);
