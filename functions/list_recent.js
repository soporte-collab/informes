const axios = require('axios');

const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

const nodeId = '2378041'; // BIOSALUD

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

async function listMostRecent() {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?include_items=false`;

    console.log("Fetching invoices for Feb 2nd for BIOSALUD...");
    const data = {
        idNode: Number(nodeId),
        emissionDateFrom: '2026-02-02T00:00:00.000-03:00',
        emissionDateTo: '2026-02-02T23:59:59.000-03:00',
        page: 1,
        pageSize: 10
    };

    console.log("Payload:", JSON.stringify(data));

    const res = await axios({
        method: 'POST',
        url: url,
        data: data,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    const items = res.data?.content || [];
    console.log(`Found ${items.length} items.`);
    items.forEach(inv => {
        console.log(`ID: ${inv.id} | Cod: ${inv.codification} | Date: ${inv.emissionDate} | Amt: ${inv.totalAmount}`);
    });
}

listMostRecent().catch(err => {
    if (err.response) {
        console.error("Status:", err.response.status);
        console.error("Data:", JSON.stringify(err.response.data, null, 2));
    } else {
        console.error(err.message);
    }
});
