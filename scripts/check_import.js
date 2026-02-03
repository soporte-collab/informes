const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkImportStatus() {
    console.log("--- ESTADO DE IMPORTACIÓN ---");

    // Check Master Products
    const masterSnap = await db.collection('zetti_products_master').orderBy('lastUpdated', 'desc').limit(5).get();
    console.log(`\nÚltimos productos en Maestro (${masterSnap.size}):`);
    masterSnap.forEach(doc => {
        const d = doc.data();
        console.log(`- [${d.lastUpdated?.toDate().toLocaleTimeString() || 'N/A'}] ${d.name} (${d.category})`);
    });

    // Check Metadata sync
    const metaDoc = await db.collection('zetti_metadata').doc('last_sync').get();
    if (metaDoc.exists()) {
        const d = metaDoc.data();
        const lastTime = d.lastSyncAt?.toDate().toLocaleTimeString();
        console.log(`\nÚltima Sincronización Zetti: ${lastTime}`);
        console.log(`Registros: ${d.recordsProcessed}`);
    }

    process.exit(0);
}

checkImportStatus().catch(console.error);
