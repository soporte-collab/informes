const admin = require('firebase-admin');
const axios = require('axios');

if (!admin.apps.length) {
    admin.initializeApp({
        storageBucket: 'informes-a551f.appspot.com'
    });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

const NODOS = {
    'BIOSALUD': '2378041',
    'CHACRAS': '2406943'
};

async function getZettiToken() {
    const credsBase64 = Buffer.from(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`).toString('base64');
    const authParams = new URLSearchParams();
    authParams.append('grant_type', 'password');
    authParams.append('username', ZETTI_CONFIG.client_id);
    authParams.append('password', ZETTI_CONFIG.client_secret);

    const res = await axios.post(ZETTI_CONFIG.auth_url, authParams.toString(), {
        headers: {
            'Authorization': `Basic ${credsBase64}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return res.data.access_token;
}

async function syncDate(dateStr) {
    console.log(`\n=== SYNCING DATE: ${dateStr} ===`);
    const token = await getZettiToken();
    let allInvoices = [];
    let allSales = [];

    for (const [name, id] of Object.entries(NODOS)) {
        console.log(`Processing node: ${name} (${id})...`);
        const url = `${ZETTI_CONFIG.api_url}/v2/${id}/sales-receipts/search?include_items=true`;

        const res = await axios.post(url, {
            emissionDateFrom: `${dateStr}T00:00:00.000-03:00`,
            emissionDateTo: `${dateStr}T23:59:59.999-03:00`,
            pageSize: 500
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const rawInvoices = res.data?.content || [];
        console.log(`  -> Found ${rawInvoices.length} raw invoices.`);

        rawInvoices.forEach(inv => {
            // Regla de Oro: recalcular total desde items
            const items = inv.items || [];
            let calculatedTotal = 0;
            const seenItems = new Set();

            items.forEach(it => {
                const isReal = it.product && it.product.id && (it.product.name || it.product.description);
                if (!isReal) return;

                // Ignorar líneas de resumen
                if (Number(it.amount) === (inv.totalAmount || inv.mainAmount) && items.length > 1) {
                    if ((it.product?.name || '').toUpperCase().includes('TOTAL')) return;
                }

                const itemId = it.id?.toString() || `${it.product.id}-${it.amount}`;
                if (seenItems.has(itemId)) return;
                seenItems.add(itemId);

                const amount = Number(it.amount) || 0;
                calculatedTotal += amount;

                allSales.push({
                    id: `${inv.id}-${it.id || Math.random()}`,
                    invoiceNumber: inv.codification || inv.number,
                    date: inv.emissionDate,
                    productName: it.product?.name || it.product?.description || 'Producto',
                    totalAmount: amount,
                    branch: name,
                    barcode: it.product?.barCode || ''
                });
            });

            allInvoices.push({
                id: inv.id,
                invoiceNumber: inv.codification || inv.number,
                date: inv.emissionDate,
                grossAmount: calculatedTotal,
                zettiAmount: inv.totalAmount || inv.mainAmount,
                branch: name
            });
        });
    }

    const totalCalculated = allInvoices.reduce((s, i) => s + i.grossAmount, 0);
    const totalZetti = allInvoices.reduce((s, i) => s + i.zettiAmount, 0);

    console.log(`\n--- RESULTS FOR ${dateStr} ---`);
    console.log(`Total Invoices: ${allInvoices.length}`);
    console.log(`Total Calculated (Regla de Oro): ${totalCalculated}`);
    console.log(`Total reported by Zetti (Raw):   ${totalZetti}`);
    console.log(`Difference: ${totalZetti - totalCalculated}`);

    // Persistir en Storage (esto sobreescribirá/creará los archivos que lee la app)
    console.log("\nPersisting to Storage...");
    const salesRef = bucket.file('reports_data/sales.json');
    const invoicesRef = bucket.file('reports_data/invoices.json');

    await salesRef.save(JSON.stringify(allSales));
    await invoicesRef.save(JSON.stringify(allInvoices));

    console.log("✅ Done.");
}

syncDate('2026-02-03').catch(err => console.error(err.response?.data || err.message));
