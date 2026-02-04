const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        storageBucket: 'informes-a551f.appspot.com'
    });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function inspect() {
    console.log("=== CHECKING FIRESTORE COLLECTIONS ===");
    const collections = ['zetti_responses', 'zetti_queries', 'zetti_products_master', 'zetti_metadata'];

    for (const col of collections) {
        const snap = await db.collection(col).limit(5).get();
        console.log(`Collection [${col}]: ${snap.size} documents (up to 5 shown)`);
        snap.forEach(doc => {
            console.log(`  - ID: ${doc.id}`);
        });
    }

    console.log("\n=== CHECKING STORAGE FILES ===");
    const [files] = await bucket.getFiles({ prefix: 'reports_data/' });
    console.log(`Found ${files.length} files in reports_data/`);
    files.forEach(file => {
        console.log(`  - ${file.name} (${file.metadata.size} bytes)`);
    });
}

inspect().catch(err => {
    console.error("ERROR:", err.message);
    if (err.message.includes("credential")) {
        console.log("Hint: Need to be authenticated via Firebase CLI or have a service account key.");
    }
});
