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
    console.log("Post to:", ZETTI_CONFIG.auth_url);
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', ZETTI_CONFIG.client_id);
    params.append('client_secret', ZETTI_CONFIG.client_secret);

    try {
        const res = await axios.post(ZETTI_CONFIG.auth_url, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });
        return res.data.access_token;
    } catch (e) {
        console.error("Auth Error details:", e.response?.data || e.message);
        throw e;
    }
}

async function testRaw() {
    try {
        console.log("--- SOLICITANDO TOKEN ---");
        const token = await getZettiToken();
        console.log("TOKEN RECIBIDO.");

        const nodeId = NODOS.BIOSALUD;
        // 8 de Enero
        const testDateFrom = '2026-01-08T00:00:00.000-03:00';
        const testDateTo = '2026-01-08T23:59:59.999-03:00';

        // 1. VENTAS
        console.log("\n--- BUSCANDO VENTAS (sales-receipts) ---");
        const salesRes = await axios.post(`${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?include_items=true&include_agreements=true&pageSize=1`, {
            emissionDateFrom: testDateFrom,
            emissionDateTo: testDateTo
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const salesContent = salesRes.data.content || salesRes.data || [];
        console.log(`Ventas encontradas: ${salesContent.length}`);
        if (salesContent.length > 0) {
            console.log("EJEMPLO DE VENTA (Campos clave):");
            const s = salesContent[0];
            console.log(`ID: ${s.id}, Cod: ${s.cod}, Total: ${s.tot}, Cliente: ${s.cli}`);
            console.log(`Pagos: ${JSON.stringify(s.pagos)}`);
            if (s.items && s.items.length > 0) {
                console.log(`Primer Item: ${JSON.stringify(s.items[0])}`);
            }
        }

        // 2. GASTOS
        console.log("\n--- BUSCANDO GASTOS (provider-receipts) ---");
        const expRes = await axios.post(`${ZETTI_CONFIG.api_url}/v2/${nodeId}/provider-receipts/search?pageSize=1`, {
            emissionDateFrom: testDateFrom,
            emissionDateTo: testDateTo
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const expContent = expRes.data.content || expRes.data || [];
        console.log(`Gastos encontrados: ${expContent.length}`);
        if (expContent.length > 0) {
            console.log("EJEMPLO DE GASTO:");
            console.log(JSON.stringify(expContent[0], null, 2));
        }

        // 3. OBRAS SOCIALES
        console.log("\n--- BUSCANDO OBRAS SOCIALES (insurance-receipts) ---");
        const insuranceRes = await axios.post(`${ZETTI_CONFIG.api_url}/v2/${nodeId}/insurance-receipts/search?pageSize=1`, {
            emissionDateFrom: testDateFrom,
            emissionDateTo: testDateTo
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const insContent = insuranceRes.data.content || insuranceRes.data || [];
        console.log(`Obras Sociales encontradas: ${insContent.length}`);
        if (insContent.length > 0) {
            console.log("EJEMPLO DE OBRA SOCIAL:");
            console.log(JSON.stringify(insContent[0], null, 2));
        }

    } catch (error) {
        // Silencio el error si ya lo mostré en getZettiToken
    }
}

testRaw();
