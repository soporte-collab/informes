const axios = require('axios');

const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

const NODOS = {
    'BIOSALUD': '2378041',
    'CHACRAS': '2406943'
};

async function getZettiToken() {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', ZETTI_CONFIG.client_id);
    params.append('client_secret', ZETTI_CONFIG.client_secret);

    const res = await axios.post(ZETTI_CONFIG.auth_url, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return res.data.access_token;
}

async function testRaw() {
    try {
        console.log("--- SOLICITANDO TOKEN ---");
        const token = await getZettiToken();
        console.log("TOKEN RECIBIDO.");

        const nodeId = NODOS.BIOSALUD;
        const testDateFrom = '2026-01-20T00:00:00.000-03:00';
        const testDateTo = '2026-01-20T23:59:59.999-03:00';

        // 1. VENTAS
        console.log("\n--- BUSCANDO VENTAS (sales-receipts) ---");
        const salesRes = await axios.post(`${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?include_items=true&include_agreements=true&pageSize=1`, {
            emissionDateFrom: testDateFrom,
            emissionDateTo: testDateTo
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const firstSale = (salesRes.data.content || salesRes.data || [])[0];
        console.log("ESTRUCTURA DE VENTA:");
        console.log(JSON.stringify(firstSale, null, 2));

        // 2. GASTOS
        console.log("\n--- BUSCANDO GASTOS (provider-receipts) ---");
        const expRes = await axios.post(`${ZETTI_CONFIG.api_url}/v2/${nodeId}/provider-receipts/search?pageSize=1`, {
            emissionDateFrom: testDateFrom,
            emissionDateTo: testDateTo
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const firstExp = (expRes.data.content || expRes.data || [])[0];
        console.log("ESTRUCTURA DE GASTO:");
        console.log(JSON.stringify(firstExp, null, 2));

        // 3. OBRAS SOCIALES
        console.log("\n--- BUSCANDO OBRAS SOCIALES (insurance-receipts) ---");
        const insuranceRes = await axios.post(`${ZETTI_CONFIG.api_url}/v2/${nodeId}/insurance-receipts/search?pageSize=1`, {
            emissionDateFrom: testDateFrom,
            emissionDateTo: testDateTo
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const firstIns = (insuranceRes.data.content || insuranceRes.data || [])[0];
        console.log("ESTRUCTURA DE OBRA SOCIAL:");
        console.log(JSON.stringify(firstIns, null, 2));

    } catch (error) {
        console.error("ERROR EN TEST:", error.response?.data || error.message);
    }
}

testRaw();
