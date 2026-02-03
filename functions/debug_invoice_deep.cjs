
const axios = require('axios');

const ZETTI_CONFIG = {
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest',
    username: 'biotrack',
    password: 'SRwdDVgLQT1i',
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i'
};

const NODE_ID = '2378041'; // BIOSALUD
const INVOICE_COD = '0001-00071059';

async function getZettiToken() {
    const credsBase64 = Buffer.from(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', ZETTI_CONFIG.username);
    params.append('password', ZETTI_CONFIG.password);

    const res = await axios.post(ZETTI_CONFIG.auth_url, params.toString(), {
        headers: {
            'Authorization': `Basic ${credsBase64}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return res.data.access_token;
}

async function investigate_invoice() {
    try {
        const token = await getZettiToken();
        console.log(`--- INVESTIGANDO FACTURA ${INVOICE_COD} ---`);

        // Probamos variantes para FORZAR a Zetti a soltar el detalle de pagos
        const variants = [
            { name: "EXPANDED_SEARCH", params: "?include_items=true&include_agreements=true&include_concepts=true&include_completed=true" },
            { name: "RELATIONS_SEARCH", params: "?include_items=true&include_relations=true" }
        ];

        for (const v of variants) {
            console.log(`\n\n>>> TESTING VARIANT: ${v.name}`);
            const url = `${ZETTI_CONFIG.api_url}/v2/${NODE_ID}/sales-receipts/search${v.params}`;

            const res = await axios.post(url, { codification: INVOICE_COD }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = res.data.content?.[0] || res.data?.[0];

            if (data) {
                console.log(`Result found in ${v.name}`);
                console.log("-----------------------------------------");
                console.log("ID:", data.id);
                console.log("Total:", data.totalAmount || data.mainAmount);
                console.log("Items count:", data.items?.length);

                // Analizamos AGREEMENTS (Aquí debería estar la plata de la OS)
                if (data.agreements) {
                    console.log("\n[AGREEMENTS DETECTED]");
                    data.agreements.forEach((a, i) => {
                        console.log(`AGR #${i}:`, JSON.stringify(a, null, 2));
                    });
                } else {
                    console.log("\n[NO AGREEMENTS FIELD]");
                }
                // (Removed Pagos and Concepts logging)
            } else {
                console.log("No data found for this codification.");
            }
        }

        // --- NEW: TEST DIRECT DETAIL ENDPOINT ---
        const firstId = "134940000000265146";
        console.log(`\n\n>>> TESTING DIRECT DETAIL ENDPOINT: /sales-receipts/${firstId}`);
        const detailUrl = `${ZETTI_CONFIG.api_url}/v2/${NODE_ID}/sales-receipts/${firstId}?include_items=true&include_relations=true&include_agreements=true&include_concepts=true&include_completed=true&include_others=true`;

        const detailRes = await axios.get(detailUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const detailData = detailRes.data;
        if (detailData) {
            console.log("DETAIL SUCCESS!");
            console.log("Keys available:", Object.keys(detailData).join(', '));
            console.log("Agreements:", detailData.agreements ? detailData.agreements.length : 'MISSING');
            console.log("Operations:", detailData.operations ? detailData.operations.length : 'MISSING');

            if (detailData.agreements) console.log("AGREEMENTS:", JSON.stringify(detailData.agreements, null, 2));
            if (detailData.operations) console.log("OPERATIONS:", JSON.stringify(detailData.operations, null, 2));
        }

    } catch (e) {
        console.error("ERROR FATAL:", e.response?.data || e.message);
    }
}

investigate_invoice();
