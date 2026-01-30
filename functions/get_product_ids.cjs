/**
 * Buscar productos en el maestro de Firestore para obtener sus IDs de Zetti
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function getProductIds() {
    console.log("🔍 Buscando productos en Firestore...");

    const snapshot = await admin.firestore()
        .collection('zetti_products_master')
        .limit(10)
        .get();

    console.log(`\n📦 Encontrados ${snapshot.size} productos:\n`);

    snapshot.docs.forEach((doc, i) => {
        const data = doc.data();
        console.log(`${i + 1}. ${data.name}`);
        console.log(`   Doc ID: ${doc.id}`);
        console.log(`   Barcode: ${data.barcode}`);
        console.log(`   ProductId: ${data.productId || 'NO TIENE'}`);
        console.log('');
    });

    process.exit(0);
}

getProductIds();
