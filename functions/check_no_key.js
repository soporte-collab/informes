const admin = require('firebase-admin');

// Try to initialize without a service account key, picking up from local environment
try {
    admin.initializeApp();
} catch (e) {
    console.log('Default init failed, trying with ADC...');
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

const db = admin.firestore();

async function check(qid) {
    console.log('--- CHECKING QUERY ---');
    const q = await db.collection('zetti_queries').doc(qid).get();
    const r = await db.collection('zetti_responses').doc(qid).get();

    if (q.exists) console.log('Query:', q.data());
    else console.log('Query NOT found.');

    if (r.exists) console.log('Response:', r.data());
    else console.log('Response NOT found.');
}

check('aTh0gQ6GxGk9malDeUyh');
