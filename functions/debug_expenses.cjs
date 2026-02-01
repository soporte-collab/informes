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

async function debugExpenses() {
    try {
        console.log(`\n🔍 Obteniendo comprobantes de proveedores recientes...`);
        const token = await getZettiToken();
        // Usamos el nodo BIOSALUD 2378041
        const url = `${ZETTI_API_BASE}/v2/2378041/providers/receipts/search?page=1&pageSize=10`;

        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        // Formato DD/MM/YYYY que requiere este endpoint según index.js
        const formatDate = (date) => {
            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        };

        const startDate = formatDate(thirtyDaysAgo);
        const endDate = formatDate(now);

        console.log(`Buscando desde ${startDate} hasta ${endDate}...`);

        const res = await axios.post(url, {
            emissionDateFrom: startDate,
            emissionDateTo: endDate
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const content = res.data.content || res.data || [];
        if (!content.length) {
            console.log('❌ No se encontraron comprobantes de proveedores.');
            return;
        }

        console.log(`✅ Se encontraron ${content.length} comprobantes.\n`);
        console.log(`--- MUESTRA DE DATOS (Muestra 2 comprobantes con toda su info) ---`);

        content.slice(0, 2).forEach((receipt, index) => {
            console.log(`\n--- COMPROBANTE #${index + 1} ---`);
            console.log(JSON.stringify(receipt, null, 2));
        });

        console.log(`\n--- RESUMEN DE PROVEEDORES ENCONTRADOS ---`);
        const summary = content.map(r => ({
            proveedor: r.supplier?.name || '?',
            monto: r.totalAmount || r.amount || 0,
            tipo: r.valueType?.name || '?',
            clase: r.receiptClass?.name || '?'
        }));
        console.table(summary);

    } catch (e) {
        console.error('❌ ERROR:', e.response?.data || e.message);
    }
}

debugExpenses();
