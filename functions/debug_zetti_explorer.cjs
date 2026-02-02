const axios = require('axios');

const ZETTI_AUTH_URL = 'http://190.15.199.103:8089/oauth-server/oauth/token';
const ZETTI_API_BASE = 'http://190.15.199.103:8089/api-rest';
const ZETTI_USER = 'biotrack';
const ZETTI_PASS = 'SRwdDVgLQT1i';
const ZETTI_CLIENT_ID = 'biotrack';
const ZETTI_CLIENT_SECRET = 'SRwdDVgLQT1i';

async function getZettiToken() {
    try {
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
    } catch (e) {
        console.error("Auth Error:", e.message);
        return null;
    }
}

async function probeEndpoint(token, method, url, body = null, desc = "") {
    try {
        const config = {
            headers: { 'Authorization': `Bearer ${token}` }
        };
        let res;
        if (method === 'GET') res = await axios.get(url, config);
        else res = await axios.post(url, body, config);

        console.log(`✅ [${method}] ${url} | ${desc} -> STATUS: ${res.status}`);
        const data = res.data.content || res.data;
        const count = Array.isArray(data) ? data.length : (data ? 'Obj' : 0);
        console.log(`   Result: ${count} items/data`);
        if (count > 0 && count !== 'Obj') {
            console.log(`   Ejemplo:`, JSON.stringify(data[0], null, 2).substring(0, 300) + "...");
        } else if (count === 'Obj') {
            console.log(`   Ejemplo:`, JSON.stringify(data, null, 2).substring(0, 300) + "...");
        }
        return true;
    } catch (e) {
        // Ignoramos 404 y 405 para limpiar el log, solo mostramos si hay dudas
        if (e.response) {
            // console.log(`❌ [${method}] ${url} -> ${e.response.status} (${e.response.statusText})`);
            if (e.response.status !== 404 && e.response.status !== 405) {
                console.log(`⚠️ [${method}] ${url} -> ERROR ${e.response.status}: ${JSON.stringify(e.response.data)}`);
            }
        } else {
            console.log(`❌ [${method}] ${url} -> Error: ${e.message}`);
        }
        return false;
    }
}

async function runExplorer() {
    const token = await getZettiToken();
    if (!token) return;

    const nodeId = '2378041'; // Paseo Stare
    const concentradorId = '2378039';

    const candidates = [
        // Variantes Accounts
        { method: 'GET', url: `${ZETTI_API_BASE}/v2/${nodeId}/accounting/accounts` },
        { method: 'POST', url: `${ZETTI_API_BASE}/v2/${nodeId}/accounting/accounts/search`, body: {} },
        { method: 'POST', url: `${ZETTI_API_BASE}/v2/${nodeId}/accounting/accounts/search`, body: { active: true } },
        { method: 'GET', url: `${ZETTI_API_BASE}/v2/${nodeId}/accounting/account-plans` },

        // Sin V2?
        { method: 'GET', url: `${ZETTI_API_BASE}/${nodeId}/accounting/accounts` },
        { method: 'POST', url: `${ZETTI_API_BASE}/${nodeId}/accounting/accounts/search`, body: {} },

        // Concentrador
        { method: 'POST', url: `${ZETTI_API_BASE}/v2/${concentradorId}/accounting/accounts/search`, body: {} },

        // Value Types (Buscar "Gastos")
        { method: 'GET', url: `${ZETTI_API_BASE}/v2/${nodeId}/value-types`, desc: "Listar ValueTypes" },
        { method: 'POST', url: `${ZETTI_API_BASE}/v2/${nodeId}/value-types/search`, body: {}, desc: "Search ValueTypes" },

        // Receipts Classes (Clases de comprobante)
        { method: 'POST', url: `${ZETTI_API_BASE}/v2/${nodeId}/providers/receipt-classes/search`, body: {}, desc: "Receipt Classes" }
    ];

    console.log("🚀 Iniciando Exploración de Endpoints Zetti...\n");

    for (const c of candidates) {
        await probeEndpoint(token, c.method, c.url, c.body, c.desc || "");
    }

    // Test Adicional: Value Types Filter
    console.log("\n🔍 Buscando 'GASTOS' en Value Types encontrados manualmente...");
    // Suponiendo que el GET /value-types funcionó, si no, intentamos un search genérico
    const urlVT = `${ZETTI_API_BASE}/v2/${nodeId}/value-types`;
    try {
        const res = await axios.get(urlVT, { headers: { 'Authorization': `Bearer ${token}` } });
        const types = res.data.content || res.data || [];
        if (Array.isArray(types)) {
            const gastos = types.filter(t => t.description && t.description.toUpperCase().includes('GASTO'));
            console.log(`Encontrados ${gastos.length} tipos con la palabra 'GASTO':`);
            gastos.forEach(g => console.log(` - [ID ${g.id}] ${g.name}: ${g.description}`));
        }
    } catch (e) { }
}

runExplorer();
