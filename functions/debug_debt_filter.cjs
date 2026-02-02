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

async function debugDebtDeep() {
    try {
        console.log(`\n🔍 Buscando Deuda de Sheila (ID Long: 134940000000000309)`);
        const token = await getZettiToken();
        const nodeId = '2378041';

        // Objetivo: Encontrar los 7 comprobantes del LOG.
        // Fechas amplias para asegurar (2024-2026)
        const dateFrom = "2024-01-01T00:00:00.000-0300";
        const dateTo = "2026-12-31T23:59:59.000-0300";

        const url = `${ZETTI_API_BASE}/v2/${nodeId}/sales-receipts/search?page=1&pageSize=50`;

        // Vamos a probar CADA variante de filtro una por una.
        const variants = [
            { name: "customer object string", body: { customer: { id: "134940000000000309" } } },
            { name: "customer object number", body: { customer: { id: 134940000000000309 } } },
            { name: "customerId string", body: { customerId: "134940000000000309" } },
            { name: "customerId number", body: { customerId: 134940000000000309 } },
            { name: "idCustomer string", body: { idCustomer: "134940000000000309" } },
            { name: "Entity filter", body: { entity: { id: 134940000000000309 } } }
        ];

        for (const v of variants) {
            console.log(`\nProbando Filtro: [${v.name}]...`);
            const body = {
                emissionDateFrom: dateFrom,
                emissionDateTo: dateTo,
                ...v.body
            };

            try {
                const res = await axios.post(url, body, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                });

                const content = res.data.content || res.data || [];
                console.log(`   Items devueltos: ${content.length}`);

                if (content.length > 0) {
                    // Validamos si es SHEILA o CONSUMIDOR FINAL (Code 99999)
                    const first = content[0];
                    const customerName = first.customer?.name || "Unknown";
                    console.log(`   Cliente del primer item: ${customerName} (Code: ${first.customer?.code})`);

                    if (customerName.includes("BRAHIM")) {
                        console.log("   🎉🎉 ÉXITO!!! ENCONTRAMOS A SHEILA!");
                        console.log("   Items sample:");
                        content.slice(0, 3).forEach(c =>
                            console.log(`     - [${c.emissionDate}] ${c.valueType?.name} Total: $${c.mainAmount}`)
                        );
                        return; // Terminar si encontramos
                    } else {
                        console.log("   ⚠️ Fallo: Trajo otro cliente (probablemente ignoró el filtro)");
                    }
                }
            } catch (e) {
                console.log(`   ❌ Error: ${e.response?.status}`);
            }
        }

    } catch (e) {
        console.error('❌ FATAL ERROR:', e);
    }
}

debugDebtDeep();
