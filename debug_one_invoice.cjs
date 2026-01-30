const fs = require('fs');
const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

const NODOS = {
    BIOSALUD: '2378041',
    CHACRAS: '2406943'
};

async function getZettiToken() {
    const credsBase64 = Buffer.from(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`).toString('base64');
    const authParams = new URLSearchParams();
    authParams.append('grant_type', 'password');
    authParams.append('username', ZETTI_CONFIG.client_id);
    authParams.append('password', ZETTI_CONFIG.client_secret);

    const res = await fetch(ZETTI_CONFIG.auth_url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credsBase64}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: authParams
    });
    const data = await res.json();
    return data.access_token;
}

async function fetchOneInvoice() {
    try {
        const token = await getZettiToken();
        const url = `${ZETTI_CONFIG.api_url}/v2/${NODOS.BIOSALUD}/sales-receipts/search?include_items=true&include_relations=true&include_agreements=true`;

        const body = {
            emissionDateFrom: "2026-01-01T00:00:00.000-0300",
            emissionDateTo: "2026-01-13T23:59:59.999-0300",
            page: 0,
            pageSize: 1,
            orderBy: [{ field: "emissionDate", direction: "DESC" }]
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        const invoice = data.content?.[0] || data?.[0];
        fs.writeFileSync('invoice_sample.json', JSON.stringify(invoice, null, 2));
        console.log("✅ Factura guardada en invoice_sample.json");
    } catch (e) {
        console.error("ERROR DETECTADO:", e.message);
    }
}

fetchOneInvoice();
