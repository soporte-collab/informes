const axios = require('axios');

const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

const nodeId = 2378041; // BIOSALUD
const invoiceNumber = '0001-00070692';

async function inspectInvoice() {
    try {
        // 1. Auth
        const credsBase64 = Buffer.from(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`).toString('base64');
        const authParams = new URLSearchParams();
        authParams.append('grant_type', 'password');
        authParams.append('username', ZETTI_CONFIG.client_id);
        authParams.append('password', ZETTI_CONFIG.client_secret);

        const authRes = await axios.post(ZETTI_CONFIG.auth_url, authParams.toString(), {
            headers: {
                'Authorization': `Basic ${credsBase64}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const token = authRes.data.access_token;

        // 2. Fetch specific invoice
        const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?include_items=true&include_agreements=true`;
        const res = await axios.post(url, { codification: invoiceNumber }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = res.data.content ? res.data.content[0] : res.data[0];

        console.log("=== FULL JSON INSPECTION ===");
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error:", error.response?.data || error.message);
    }
}

inspectInvoice();
