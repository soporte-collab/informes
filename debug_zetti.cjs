const fetch = require('node-fetch');

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

    const tokenRes = await fetch(ZETTI_AUTH_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credsBase64}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!tokenRes.ok) throw new Error(`Auth failed: ${tokenRes.status}`);
    const auth = await tokenRes.json();
    return auth.access_token;
}

async function debugProduct(barcode) {
    try {
        console.log(`\n🔍 Buscando producto con barcode: ${barcode}`);
        const token = await getZettiToken();
        const url = `${ZETTI_API_BASE}/v2/2378041/products/search?include_groups=true`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ barCodes: [barcode] })
        });

        const data = await res.json();
        console.log('✅ Respuesta completa recibida.');

        const content = data.content || data || [];
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
        } else {
            console.log('⚠️ No tiene el array de "groups".');
        }

        console.log('\n--- JSON COMPLETO DEL PRODUCTO (Primeros 1000 chars) ---');
        console.log(JSON.stringify(p, null, 2).substring(0, 1000));

    } catch (e) {
        console.error('❌ ERROR:', e.message);
    }
}

// Probamos con un barcode que suele estar en farmacias (ej: aspirina o similar)
// Si no, probamos uno genérico. El usuario mencionó uno en los logs? No vi uno claro de éxito.
// Voy a intentar buscar "IBUPROFENO" por descripción si el barcode no va.
const testBarcode = process.argv[2] || '7790100123456';
debugProduct(testBarcode);
