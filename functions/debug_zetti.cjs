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

async function debugProduct(barcode) {
    try {
        console.log(`\n🔍 Buscando producto con barcode: ${barcode}`);
        const token = await getZettiToken();
        const url = `${ZETTI_API_BASE}/v2/2378041/products/search?include_groups=true`;

        const res = await axios.post(url, { barCodes: [String(barcode)] }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const content = res.data.content || res.data || [];
        if (!content.length) {
            console.log('❌ No se encontró el producto.');
            return;
        }

        const p = content[0];
        console.log('\n--- DATOS BASICOS ---');
        console.log(`ID: ${p.id}`);
        console.log(`Descripción: ${p.description}`);
        console.log(`Barcode: ${p.barCode}`);

        console.log('\n--- GRUPOS (CATEGORIAS) ---');
        if (p.groups) {
            p.groups.forEach(g => {
                console.log(`- [${g.groupType?.name}] ${g.name} (ID: ${g.id})`);
            });
        }

        console.log('\n--- ANALISIS DE RUBRO/CATEGORIA ---');
        const rubro = p.groups?.find(g => (g.groupType?.name || '').toUpperCase() === 'RUBRO');
        const familia = p.groups?.find(g => (g.groupType?.name || '').toUpperCase() === 'FAMILIA');
        console.log(`RUBRO detectado: ${rubro ? rubro.name : 'NO ENCONTRADO'}`);
        console.log(`FAMILIA detectada: ${familia ? familia.name : 'NO ENCONTRADO'}`);

    } catch (e) {
        console.error('❌ ERROR:', e.response?.data || e.message);
    }
}

const testBarcode = process.argv[2] || '7795345001309';
debugProduct(testBarcode);
