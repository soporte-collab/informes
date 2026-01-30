const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // assuming it exists or using default

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

const db = admin.firestore();

async function checkQuery(queryId) {
    console.log(`Checking Query: ${queryId}`);

    const querySnapshot = await db.collection('zetti_queries').doc(queryId).get();
    const responseSnapshot = await db.collection('zetti_responses').doc(queryId).get();

    console.log('QUERY DOC EXISTS:', querySnapshot.exists);
    if (querySnapshot.exists) {
        console.log('QUERY DATA:', JSON.stringify(querySnapshot.data(), null, 2));
    }

    console.log('RESPONSE DOC EXISTS:', responseSnapshot.exists);
    if (responseSnapshot.exists) {
        console.log('RESPONSE DATA:', JSON.stringify(responseSnapshot.data(), null, 2));
    } else {
        console.log('No response found yet for this ID.');
    }
}

const qid = 'aTh0gQ6GxGk9malDeUyh';
checkQuery(qid).catch(console.error);
