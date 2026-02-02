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

async function testDebtWithValueTypes() {
    try {
        const token = await getZettiToken();
        const nodeId = '2378041'; // Biosalud Node
        const clientIdStr = "134940000000000309"; // Sheila Brahim ID

        // Date range
        const dateFrom = "2024-01-01T00:00:00.000Z";
        const dateTo = "2026-12-31T23:59:59.000Z";

        const testIds = [21, 22];

        for (const valId of testIds) {
            console.log(`\n🔍 Probando idValueType: ${valId} ...`);

            const url = `${ZETTI_API_BASE}/v2/${nodeId}/sales-receipts/search`;

            // Re-using the manual JSON string logic to avoid precision loss on idEntity
            const bodyObj = {
                emissionDateFrom: dateFrom,
                emissionDateTo: dateTo,
                idEntity: "PLACEHOLDER_ID",
                idValueType: valId
            };

            let bodyJson = JSON.stringify(bodyObj);
            bodyJson = bodyJson.replace('"PLACEHOLDER_ID"', clientIdStr);

            const res = await axios.post(url, bodyJson, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const results = res.data || [];
            console.log(`✅ Resultados para ID ${valId}: ${results.length}`);

            results.forEach(r => {
                console.log(`- [${r.emissionDate}] ${r.typeName} ${r.codification} - Monto: $${r.mainAmount} - Estado: ${r.status?.name}`);
                // If there's more detail on values/payments, it might be in the response
                if (r.values && r.values.length > 0) {
                    r.values.forEach(v => console.log(`  > Valor: ${v.valueType?.description} - Monto: $${v.amount}`));
                }
            });
        }

    } catch (e) {
        console.error('❌ ERROR:', e.response?.data || e.message);
    }
}

testDebtWithValueTypes();
