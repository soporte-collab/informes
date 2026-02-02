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

async function debugAccounting() {
    try {
        const token = await getZettiToken();
        const nodeId = '2378041';
        const clientId = '134940000000000309'; // ID de cliente provisto por el usuario

        console.log(`\n🔍 TEST: Buscar "Cuentas" del Cliente ${clientId}`);

        // El script anterior falló al listar cuentas generales.
        // Pero ahora tenemos un ID de Cliente.
        // ¿Dónde buscar cuentas de UN cliente?

        // Hipótesis A: Customer Current Accounts (Cuentas Corrientes de Clientes)
        // No vi un endpoint de "Current Account" especifico en el swagger, pero intentaré ver si hay algo en CustomersController

        console.log("Probando endpoint de 'Customers' (si existe) para ver sus cuentas");
        const urlCustomers = `${ZETTI_API_BASE}/v2/${nodeId}/customers/${clientId}`;
        // No estoy seguro si este endpoint existe, lo construyo por convención REST

        try {
            const res = await axios.get(urlCustomers, { headers: { 'Authorization': `Bearer ${token}` } });
            console.log("✅ Customer encontrado:", JSON.stringify(res.data, null, 2));
        } catch (e) {
            console.log(`⚠️ Customer GET failed: ${e.response?.status}`);
        }

        // Hipótesis B: Accounting Accounts con filtro? 
        // En AccountRequestDTO vimos propiedades 'name', 'code'.
        // Quizás no se filtra por cliente aquí.

        // Hipótesis C: Saldos de Cuenta Corriente
        // Muchas veces en Zetti el saldo de cta cte se saca de un reporte o endpoint especifico de Ventas/Cuentas.

        // Voy a intentar el endpoint de VENTA que vimos al principio: SalesController? No..
        // Probemos un search generico de Accounts PERO buscando el ID del cliente en el "Nombre" o "Código" si es que se mapean así.

        console.log("\n🔍 Buscando en Accounts filtrando por codigo/nombre...");
        const urlAccSearch = `${ZETTI_API_BASE}/v2/${nodeId}/accounting/accounts/search`;
        try {
            // A veces el codigo de cuenta es el ID del cliente o parecido
            const body = { code: clientId };
            const res = await axios.post(urlAccSearch, body, { headers: { 'Authorization': `Bearer ${token}` } });
            console.log(`Búsqueda por Code=${clientId}: ${res.data.content?.length || 0} items`);
        } catch (e) { }


    } catch (e) {
        console.error('❌ FATAL ERROR:', e);
    }
}

debugAccounting();
