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

// Probaremos el endpoint de ProvidersController que ya funciona (receipts/search)
// pero vamos a filtrar para ver si podemos TRAER "GASTOS VARIOS" u otros tipos
// usando el campo 'valueTypes' o 'receiptClasses' si existe.
async function debugMoreExpenses() {
    try {
        console.log(`\n🔍 Explorando GASTOS EXTERNOS vía ProvidersController...`);
        const token = await getZettiToken();
        const nodeId = '2378041';

        const url = `${ZETTI_API_BASE}/v2/${nodeId}/providers/receipts/search?page=1&pageSize=50`;

        const now = new Date();
        // Ampliamos el rango para asegurar encontrar algo similar al CSV (que tiene fechas futuras incluso)
        // El CSV muestra fechas como "18/03/2025", "30/05/2025" (FUTURE!!) o Enero 2025.
        // Vamos a buscar un rango amplio de 2025.

        const formatDate = (date) => {
            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        };

        // Enero a Diciembre 2025 (Segun el CSV hay datos de 2025)
        const startDate = "01/01/2025";
        const endDate = "31/12/2025";

        console.log(`Buscando desde ${startDate} hasta ${endDate}...`);

        const res = await axios.post(url, {
            emissionDateFrom: startDate,
            emissionDateTo: endDate
            // No filtramos por proveedor para ver todo
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const content = res.data.content || res.data || [];
        console.log(`✅ Total encontrados: ${content.length}`);

        // Analizamos si aparecen "GASTOS VARIOS", "FACTURA DE SERVICIOS", etc.
        // El CSV columna "TipoValor" dice: "GASTOS VARIOS", "FACTURA DE SERVICIOS", "COMP. LIQ. FACTURAS DE"
        // Mapeamos lo que devuelve la API en 'valueType' o 'subValueType'

        const typesFound = {};
        const examples = {};

        content.forEach(r => {
            const typeName = r.valueType?.name || 'N/A';
            const subTypeName = r.subValueType?.name || 'N/A';
            const key = `${typeName} (${subTypeName})`;

            if (!typesFound[key]) typesFound[key] = 0;
            typesFound[key]++;

            if (!examples[key]) examples[key] = r;
        });

        console.log(`\n--- TIPOS DE COMPROBANTE ENCONTRADOS ---`);
        console.table(typesFound);

        console.table(Object.keys(examples).map(k => ({
            Tipo: k,
            Proveedor: examples[k].provider?.name,
            Monto: examples[k].mainAmount,
            Fecha: examples[k].emissionDate
        })));

        // Si no encontramos "GASTOS VARIOS", entonces CONFIRMA que este endpoint solo trae stock/mercaderia.

    } catch (e) {
        console.error('❌ ERROR:', e.response?.data || e.message);
    }
}

debugMoreExpenses();
