import axios from 'axios';

const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
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

async function testPagination() {
    const token = await getZettiToken();
    const nodeId = 2378041;
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?include_items=true&include_relations=true&include_agreements=true`;

    const body = {
        emissionDateFrom: "2026-01-01T00:00:00.000-0300",
        emissionDateTo: "2026-01-13T23:59:59.999-0300",
        page: 0,
        pageSize: 50
    };

    try {
        const res = await axios.post(url, body, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log("KEYS:", Object.keys(res.data));
        console.log("CONTENT LENGTH:", res.data.content?.length);
        console.log("TOTAL ELEMENTS:", res.data.totalElements);
        console.log("TOTAL PAGES:", res.data.totalPages);
        console.log("NUMBER:", res.data.number);
        console.log("SIZE:", res.data.size);
    } catch (e) {
        console.error(e.response?.data || e.message);
    }
}

testPagination();
