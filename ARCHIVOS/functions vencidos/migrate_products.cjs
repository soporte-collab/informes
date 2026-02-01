const admin = require('firebase-admin');
const fetch = require('node-fetch');
const fs = require('fs');

// Configuración de Zetti
const ZETTI_AUTH_URL = 'http://190.15.199.103:8089/oauth-server/oauth/token';
const ZETTI_API_BASE = 'http://190.15.199.103:8089/api-rest';
const ZETTI_USER = 'biotrack';
const ZETTI_PASS = 'SRwdDVgLQT1i';
const ZETTI_CLIENT_ID = 'biotrack';
const ZETTI_CLIENT_SECRET = 'SRwdDVgLQT1i';

// Mapeo de sucursales a Node IDs
const BRANCH_TO_NODE = {
    'Paseo Stare': 2378041,
    'Chacras Park': 2406943
};

// Inicializar Firebase Admin
try {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'vencidos-ca12b'
    });
} catch (e) {
    console.log('Firebase ya inicializado o usando credenciales por defecto');
}

const db = admin.firestore();

// Función para obtener token de Zetti
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

    if (!tokenRes.ok) {
        throw new Error(`Auth failed: ${tokenRes.status}`);
    }

    const auth = await tokenRes.json();
    return auth.access_token;
}

// Función para consultar producto en Zetti
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

    if (!searchRes.ok) {
        throw new Error(`Search failed: ${searchRes.status}`);
    }

    const searchData = await searchRes.json();

    if (!Array.isArray(searchData) || searchData.length === 0) {
        return null;
    }

    const product = searchData[0];

    // Extraer campos de los grupos
    let droga = null;
    let potencia = null;
    let potenciaUM = null;
    let cantidad = null;
    let cantidadUM = null;
    let forma = null;
    let familia = null;
    let laboratorio = null;
    let marca = null;

    if (product.groups && Array.isArray(product.groups)) {
        product.groups.forEach(g => {
            const type = g.groupType?.name || '';
            switch (type) {
                case 'DROGA':
                    droga = g.name;
                    break;
                case 'POTENCIA':
                    potencia = g.name;
                    break;
                case 'POTENCIA U.M.':
                    potenciaUM = g.name;
                    break;
                case 'CANTIDAD':
                    cantidad = g.name;
                    break;
                case 'CANTIDAD U.M.':
                    cantidadUM = g.name;
                    break;
                case 'FORMA':
                    forma = g.name;
                    break;
                case 'FAMILIA':
                    familia = g.name;
                    break;
                case 'FABRICANTE':
                    laboratorio = g.name;
                    break;
                case 'MARCA':
                    marca = g.name;
                    break;
            }
        });
    }

    return {
        droga,
        potencia: potencia ? `${potencia}${potenciaUM || ''}` : null,
        cantidad: cantidad ? parseInt(cantidad) : null,
        forma,
        familia,
        laboratorio,
        marca
    };
}

// Función principal de migración
async function migrateProducts() {
    console.log('🚀 Iniciando migración de productos...\n');

    const logFile = 'migration_log.txt';
    const errorFile = 'migration_errors.txt';

    // Limpiar archivos de log anteriores
    fs.writeFileSync(logFile, `Migración iniciada: ${new Date().toISOString()}\n\n`);
    fs.writeFileSync(errorFile, `Errores de migración: ${new Date().toISOString()}\n\n`);

    try {
        // Obtener token de Zetti
        console.log('🔐 Obteniendo token de Zetti...');
        const token = await getZettiToken();
        console.log('✅ Token obtenido\n');

        // Obtener todos los productos de Firestore
        console.log('📦 Cargando productos de Firestore...');
        const snapshot = await db.collection('medications').get();
        const totalProducts = snapshot.size;
        console.log(`✅ ${totalProducts} productos encontrados\n`);

        let processed = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const doc of snapshot.docs) {
            const product = doc.data();
            processed++;

            console.log(`\n[${processed}/${totalProducts}] Procesando: ${product.name}`);
            console.log(`   Barcode: ${product.barcode || 'SIN BARCODE'}`);
            console.log(`   Sucursal: ${product.branch}`);

            // Saltar si no tiene barcode
            if (!product.barcode) {
                console.log('   ⚠️  SALTADO: Sin código de barras');
                skipped++;
                fs.appendFileSync(logFile, `[SKIP] ${product.name} - Sin barcode\n`);
                continue;
            }

            // Saltar si ya tiene los campos nuevos
            if (product.potencia && product.cantidad && product.forma) {
                console.log('   ✓ YA TIENE DATOS: Saltando');
                skipped++;
                continue;
            }

            try {
                // Obtener nodeId según la sucursal
                const nodeId = BRANCH_TO_NODE[product.branch] || 2378041;

                // Consultar Zetti
                console.log('   🔍 Consultando Zetti...');
                const zettiData = await getProductFromZetti(product.barcode, nodeId, token);

                if (!zettiData) {
                    console.log('   ⚠️  NO ENCONTRADO en Zetti');
                    errors++;
                    fs.appendFileSync(errorFile, `[NOT FOUND] ${product.name} (${product.barcode})\n`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }

                // Preparar actualización
                const updates = {};

                if (zettiData.droga && !product.monodrug) {
                    updates.monodrug = zettiData.droga;
                }
                if (zettiData.potencia) {
                    updates.potencia = zettiData.potencia;
                }
                if (zettiData.cantidad) {
                    updates.cantidad = zettiData.cantidad;
                }
                if (zettiData.forma) {
                    updates.forma = zettiData.forma;
                }
                if (zettiData.familia && !product.family) {
                    updates.family = zettiData.familia;
                }
                if (zettiData.laboratorio && !product.laboratory) {
                    updates.laboratory = zettiData.laboratorio;
                }
                if (zettiData.marca && !product.brand) {
                    updates.brand = zettiData.marca;
                }

                // Actualizar en Firestore
                if (Object.keys(updates).length > 0) {
                    await doc.ref.update(updates);
                    updated++;
                    console.log('   ✅ ACTUALIZADO:');
                    console.log(`      Droga: ${zettiData.droga || 'N/A'}`);
                    console.log(`      Potencia: ${zettiData.potencia || 'N/A'}`);
                    console.log(`      Cantidad: ${zettiData.cantidad || 'N/A'}`);
                    console.log(`      Forma: ${zettiData.forma || 'N/A'}`);

                    fs.appendFileSync(logFile,
                        `[OK] ${product.name} - Droga: ${zettiData.droga}, ` +
                        `Potencia: ${zettiData.potencia}, Cantidad: ${zettiData.cantidad}, ` +
                        `Forma: ${zettiData.forma}\n`
                    );
                } else {
                    console.log('   ℹ️  Sin cambios necesarios');
                    skipped++;
                }

                // Esperar 500ms entre consultas para no saturar la API
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.log(`   ❌ ERROR: ${error.message}`);
                errors++;
                fs.appendFileSync(errorFile,
                    `[ERROR] ${product.name} (${product.barcode}) - ${error.message}\n`
                );

                // Esperar un poco más si hay error
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Resumen final
        console.log('\n' + '='.repeat(80));
        console.log('📊 RESUMEN DE MIGRACIÓN');
        console.log('='.repeat(80));
        console.log(`Total procesados: ${processed}`);
        console.log(`✅ Actualizados: ${updated}`);
        console.log(`⚠️  Saltados: ${skipped}`);
        console.log(`❌ Errores: ${errors}`);
        console.log('='.repeat(80));

        fs.appendFileSync(logFile,
            `\n\nRESUMEN:\n` +
            `Total: ${processed}\n` +
            `Actualizados: ${updated}\n` +
            `Saltados: ${skipped}\n` +
            `Errores: ${errors}\n`
        );

        console.log(`\n📄 Logs guardados en:`);
        console.log(`   - ${logFile}`);
        console.log(`   - ${errorFile}`);

    } catch (error) {
        console.error('\n❌ Error fatal en la migración:', error);
        fs.appendFileSync(errorFile, `\n[FATAL] ${error.message}\n${error.stack}\n`);
    }
}

// Ejecutar migración
console.log('⚠️  ADVERTENCIA: Este script modificará productos en Firestore');
console.log('⚠️  Asegúrate de tener un backup antes de continuar\n');

migrateProducts()
    .then(() => {
        console.log('\n✅ Migración completada');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Migración fallida:', error);
        process.exit(1);
    });
