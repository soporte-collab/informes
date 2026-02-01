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

async function debugRecentSales() {
    try {
        console.log(`\n🔍 Obteniendo ventas recientes para ver productos reales...`);
        const token = await getZettiToken();
        const url = `${ZETTI_API_BASE}/v2/2378041/sales-receipts/search?page=1&pageSize=5&include_items=true`;

        // Ayer y hoy
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);

        const startDate = yesterday.toISOString().split('T')[0] + 'T00:00:00.000-03:00';
        const endDate = now.toISOString().split('T')[0] + 'T23:59:59.999-03:00';

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
            console.log('❌ No se encontraron ventas.');
            return;
        }

        console.log(`✅ Se encontraron ${content.length} ventas.`);

        let foundBarcode = null;
        content.forEach(sale => {
            if (sale.items) {
                sale.items.forEach(it => {
                    const bc = it.barCode || it.product?.barCode;
                    const name = it.description || it.product?.description;
                    console.log(`  - Producto: ${name} | Barcode: ${bc}`);
                    if (bc && bc !== 'N/A') foundBarcode = bc;
                });
            }
        });

        if (foundBarcode) {
            console.log(`\n🎯 Usando Barcode real para probar enriquecimiento: ${foundBarcode}`);
            const enrichUrl = `${ZETTI_API_BASE}/v2/2378041/products/search?include_groups=true`;
            const enrichRes = await axios.post(enrichUrl, { barCodes: [foundBarcode] }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const prodData = enrichRes.data.content || enrichRes.data || [];
            if (prodData.length > 0) {
                const p = prodData[0];
                console.log(`\n--- RESULTADO ENRIQUECIMIENTO PARA ${p.description} ---`);
                console.log('GROUPS:');
                if (p.groups) {
                    p.groups.forEach(g => {
                        console.log(`  - [${g.groupType?.name}] ${g.name}`);
                    });
                } else {
                    console.log('  ⚠️ NO TIENE GRUPOS');
                }
            }
        }

    } catch (e) {
        console.error('❌ ERROR:', e.response?.data || e.message);
    }
}

debugRecentSales();
