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

async function debugFinalDebt() {
    try {
        console.log(`\n🔍 Buscando Deuda de Sheila con idEntity (Intento Precision/String)`);
        const token = await getZettiToken();
        const nodeId = '2378041';

        // El ID gigante como string para evitar redondeo JS
        const clientIdStr = "134940000000000309";

        const url = `${ZETTI_API_BASE}/v2/${nodeId}/sales-receipts/search?page=1&pageSize=50`;
        const dateFrom = "2024-01-01T00:00:00.000-0300";
        const dateTo = "2026-12-31T23:59:59.000-0300";

        // Axios serializará esto. Si la API es estricta, podría fallar con string en campo int.
        // Pero es nuestro mejor intento si hubo perdida de precision.
        // Si no, probaremos BigInt (que JSON.stringify no soporta nativo sin replacer).

        console.log("Probando con ID como numérico (JSON.stringify maneja safe integers, pero este es border)");
        // 134940000000000309 < MAX_SAFE_INTEGER (9007199254740991)
        // 134,940,000,000,000,309 vs 9,007,199,254,740,991
        // Espera.. 134 PETA > 9 PETA. 
        // ¡¡¡ES MAYOR QUE MAX_SAFE_INTEGER!!!
        // 134940000000000309 es mucho mayor que 9007199254740991.
        // JS lo redondearía a 134940000000000300 o similar. 
        // ESE ES EL PROBLEMA. Estábamos enviando un ID redondeado y por eso trajo cualquier cosa.

        // SOLUCION: Enviar el body como STRING crudo modificado o usar librería para BigInt.
        // Haremos un hack manual en el JSON string.

        const bodyObj = {
            emissionDateFrom: dateFrom,
            emissionDateTo: dateTo,
            idEntity: "PLACEHOLDER_ID" // Lo reemplazaremos en el string final
        };

        let bodyJson = JSON.stringify(bodyObj);
        bodyJson = bodyJson.replace('"PLACEHOLDER_ID"', clientIdStr); // Reemplazo sin comillas -> numérico puro

        console.log("Body enviado (RAW):", bodyJson);

        const res = await axios.post(url, bodyJson, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        const content = res.data.content || res.data || [];
        console.log(`✅ Comprobantes encontrados: ${content.length}`);

        if (content.length > 0) {
            const first = content[0];
            console.log(`   Cliente del primer item: ${first.customer?.name} (Code: ${first.customer?.code})`);

            console.log("\n--- LISTA DE COMPROBANTES DEL CLIENTE ---");
            content.forEach(c => {
                console.log(`   [${c.emissionDate.substring(0, 10)}] ${c.valueType?.shortName} - $${c.mainAmount} (Estado: ${c.status?.name})`);
            });
        } else {
            console.log("⚠️ Ningún comprobante encontrado (pero quizás ahora el filtro sí funciona y ella no tiene facturas en este rango/nodo)");
        }

    } catch (e) {
        console.error('❌ FATAL ERROR:', e.response?.data || e.message);
    }
}

debugFinalDebt();
