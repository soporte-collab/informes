/**
 * Test completo: 
 * 1. Buscar producto por nombre
 * 2. Obtener su ID
 * 3. Consultar stock
 * 4. Probar statistics-by-node
 */

const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

const NODES = {
    CONCENTRADOR: 2378039,
    BIOSALUD: 2378041,
    CHACRAS: 2406943
};

async function getZettiToken() {
    const credsBase64 = Buffer.from(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`).toString('base64');
    const authParams = new URLSearchParams();
    authParams.append('grant_type', 'password');
    authParams.append('username', ZETTI_CONFIG.client_id);
    authParams.append('password', ZETTI_CONFIG.client_secret);

    const res = await fetch(ZETTI_CONFIG.auth_url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credsBase64}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: authParams.toString()
    });
    const data = await res.json();
    return data.access_token;
}

async function test() {
    try {
        const token = await getZettiToken();
        console.log("✅ Token obtenido\n");

        // PASO 1: Buscar un producto
        console.log("━━━━ PASO 1: Buscar producto ━━━━");
        const searchUrl = `${ZETTI_CONFIG.api_url}/v2/${NODES.BIOSALUD}/products/search`;

        const searchRes = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: "TAFIROL"  // Un producto común
            })
        });

        const searchData = await searchRes.json();

        if (searchRes.status !== 200 || !searchData.content?.length) {
            console.log("❌ No encontrado. Status:", searchRes.status);
            console.log(JSON.stringify(searchData, null, 2).slice(0, 500));
            return;
        }

        const producto = searchData.content[0];
        console.log(`✅ Encontrado: ${producto.description}`);
        console.log(`   ID: ${producto.id}`);
        console.log(`   Barcode: ${producto.barCode}`);

        // PASO 2: Obtener stock de ese producto
        console.log("\n━━━━ PASO 2: Stock del producto ━━━━");
        const stockUrl = `${ZETTI_CONFIG.api_url}/${NODES.CONCENTRADOR}/products/details-per-nodes`;

        const stockRes = await fetch(stockUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idsNodos: [NODES.BIOSALUD, NODES.CHACRAS],
                idsProductos: [Number(producto.id)]
            })
        });

        const stockData = await stockRes.json();
        console.log(`Status: ${stockRes.status}`);
        console.log("Respuesta:", JSON.stringify(stockData, null, 2).slice(0, 500));

        // PASO 3: Probar statistics-by-node
        console.log("\n━━━━ PASO 3: Statistics-by-node ━━━━");
        const hoy = new Date();
        const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);

        const statsUrl = `${ZETTI_CONFIG.api_url}/${NODES.CONCENTRADOR}/centralized-purchases/statistics-by-node`;

        const statsRes = await fetch(statsUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fechaDesde: hace30.toISOString().split('T')[0],
                fechaHasta: hoy.toISOString().split('T')[0],
                idsNodos: [NODES.BIOSALUD],
                idsProductos: [Number(producto.id)],
                considerarMovimientoEntreSucursales: true
            })
        });

        const statsData = await statsRes.json();
        console.log(`Status: ${statsRes.status}`);
        console.log("Respuesta:", JSON.stringify(statsData, null, 2).slice(0, 800));

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

test();
