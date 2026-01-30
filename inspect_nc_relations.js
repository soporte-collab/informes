const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

async function getZettiToken() {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', 'biotrack');
    params.append('password', 'SRwdDVgLQT1i');
    const auth = Buffer.from(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`).toString('base64');
    const res = await fetch(ZETTI_CONFIG.auth_url, {
        method: 'POST', body: params,
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const data = await res.json();
    return data.access_token;
}

async function inspectNC() {
    const token = await getZettiToken();
    const date = '2026-01-05';
    const url = `${ZETTI_CONFIG.api_url}/v2/2378041/sales-receipts/search?include_relations=true&page=1&pageSize=50`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            emissionDateFrom: `${date}T00:00:00.000-0300`,
            emissionDateTo: `${date}T23:59:59.999-0300`
        })
    });
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.content || []);

    const nc = list.find(inv => (inv.valueType?.name || '').includes('NC') || (inv.valueType?.name || '').includes('CREDITO'));

    if (nc) {
        console.log("--- CREDIT NOTE FOUND ---");
        console.log("Codification:", nc.codification);
        console.log("Relations:", JSON.stringify(nc.relations, null, 2));
    } else {
        console.log("No NC found in first 50 records of BioSalud on Jan 5.");
    }
}

inspectNC();
