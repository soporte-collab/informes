const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // I might not have this, let me check

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        storageBucket: 'informes-a551f.appspot.com'
    });
}

async function checkFiles() {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: 'reports_data/' });
    console.log("Files in reports_data/:");
    files.forEach(file => console.log(`- ${file.name}`));

    if (files.some(f => f.name === 'reports_data/product_master.json')) {
        console.log("\nReading product_master.json sample:");
        const [content] = await bucket.file('reports_data/product_master.json').download();
        const json = JSON.parse(content.toString());
        console.log(JSON.stringify(json.slice(0, 3), null, 2));
    }
}

checkFiles().catch(console.error);
