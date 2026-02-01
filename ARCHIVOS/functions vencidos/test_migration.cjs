const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Configuración de Zetti
const ZETTI_AUTH_URL = 'http://190.15.199.103:8089/oauth-server/oauth/token';
const ZETTI_API_BASE = 'http://190.15.199.103:8089/api-rest';
const ZETTI_USER = 'biotrack';
const ZETTI_PASS = 'SRwdDVgLQT1i';
const ZETTI_CLIENT_ID = 'biotrack';
const ZETTI_CLIENT_SECRET = 'SRwdDVgLQT1i';

const BRANCH_TO_NODE = {
    'Paseo Stare': 2378041,
    'Chacras Park': 2406943
};

try {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'vencidos-ca12b'
    });
} catch (e) {
    console.log('Firebase ya inicializado');
}

const db = admin.firestore();

async function getZettiToken() {
    const credsBase64 = Buffer.from(`${ZETTI_CLIENT_ID}:${ZETTI_CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', ZETTI_USER);
    params.append('password', ZETTI_PASS);

    const tokenRes = await fetch(ZETTI_AUTH_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credsBase64}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!tokenRes.ok) throw new Error(`Auth failed: ${tokenRes.status}`);
    const auth = await tokenRes.json();
    return auth.access_token;
}

async function getProductFromZetti(barcode, nodeId, token) {
    const searchUrl = `${ZETTI_API_BASE}/v2/${nodeId}/products/search?include_groups=true`;

    const searchRes = await fetch(searchUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ barCodes: [barcode] })
    });

    if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();

    if (!Array.isArray(searchData) || searchData.length === 0) return null;

    const product = searchData[0];
    let droga = null, potencia = null, potenciaUM = null, cantidad = null, forma = null;

    if (product.groups && Array.isArray(product.groups)) {
        product.groups.forEach(g => {
            const type = g.groupType?.name || '';
            if (type === 'DROGA') droga = g.name;
            if (type === 'POTENCIA') potencia = g.name;
            if (type === 'POTENCIA U.M.') potenciaUM = g.name;
            if (type === 'CANTIDAD') cantidad = g.name;
            if (type === 'FORMA') forma = g.name;
        });
    }

    return {
        droga,
        potencia: potencia ? `${potencia}${potenciaUM || ''}` : null,
        cantidad: cantidad ? parseInt(cantidad) : null,
        forma
    };
}

async function testMigration() {
    console.log('🧪 MODO PRUEBA - Procesando solo 5 productos\n');

    const token = await getZettiToken();
    console.log('✅ Token obtenido\n');

    const snapshot = await db.collection('medications').limit(5).get();
    console.log(`📦 Cargando ${snapshot.size} productos de prueba\n`);

    let count = 0;
    for (const doc of snapshot.docs) {
        const product = doc.data();
        count++;

        console.log(`\n[${count}/5] ${product.name}`);
        console.log(`   Barcode: ${product.barcode || 'SIN BARCODE'}`);

        if (!product.barcode) {
            console.log('   ⚠️  SALTADO: Sin barcode');
            continue;
        }

        try {
            const nodeId = BRANCH_TO_NODE[product.branch] || 2378041;
            const zettiData = await getProductFromZetti(product.barcode, nodeId, token);

            if (!zettiData) {
                console.log('   ⚠️  NO ENCONTRADO en Zetti');
                continue;
            }

            console.log('   ✅ DATOS DE ZETTI:');
            console.log(`      Droga: ${zettiData.droga || 'N/A'}`);
            console.log(`      Potencia: ${zettiData.potencia || 'N/A'}`);
            console.log(`      Cantidad: ${zettiData.cantidad || 'N/A'}`);
            console.log(`      Forma: ${zettiData.forma || 'N/A'}`);
            console.log('   ℹ️  NO SE GUARDÓ (modo prueba)');

            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
        }
    }

    console.log('\n✅ Prueba completada. Si todo se ve bien, ejecutá migrate_products.cjs');
}

testMigration().catch(console.error);
