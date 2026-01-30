/**
 * Test del endpoint: POST /{idEntidad}/centralized-purchases/statistics-by-node
 * Basado en el Swagger oficial
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
    console.log("🔐 Obteniendo token...");
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
    console.log("✅ Token obtenido");
    return data.access_token;
}

async function testStatisticsByNode() {
    try {
        const token = await getZettiToken();

        const idEntidad = NODES.CONCENTRADOR;
        const url = `${ZETTI_CONFIG.api_url}/${idEntidad}/centralized-purchases/statistics-by-node`;

        // Fechas: último mes
        const hoy = new Date();
        const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);

        const fechaDesde = hace30Dias.toISOString().split('T')[0]; // "2025-12-17"
        const fechaHasta = hoy.toISOString().split('T')[0];        // "2026-01-16"

        const body = {
            fechaDesde: fechaDesde,
            fechaHasta: fechaHasta,
            idsNodos: [NODES.BIOSALUD, NODES.CHACRAS],  // Ambas sucursales
            idsProductos: [],  // Vacío = todos los productos? o necesitamos IDs específicos
            considerarMovimientoEntreSucursales: true
        };

        console.log(`\n📊 Llamando a: ${url}`);
        console.log("📦 Body enviado:", JSON.stringify(body, null, 2));

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        console.log(`\n✅ Respuesta (status ${res.status}):`);

        if (Array.isArray(data)) {
            console.log(`   Total registros: ${data.length}`);
            console.log("\n   Primeros 5 registros:");
            data.slice(0, 5).forEach((item, i) => {
                console.log(`   ${i + 1}. Producto ${item.idProducto} - Nodo ${item.idNodo}`);
                console.log(`      Ventas: ${item.ventasProductoNodoPorMes} | Compras: ${item.comprasProductoNodoPorMes} | Días: ${item.diasTrabajadosNodoPorMes}`);
                if (item.diasTrabajadosNodoPorMes > 0) {
                    const vmd = item.ventasProductoNodoPorMes / item.diasTrabajadosNodoPorMes;
                    console.log(`      VMD (calculada): ${vmd.toFixed(2)} unidades/día`);
                }
            });
        } else {
            console.log(JSON.stringify(data, null, 2));
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

testStatisticsByNode();
