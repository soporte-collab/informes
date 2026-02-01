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

async function searchInvoiceRaw(nodeId, codification) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?include_items=false&include_agreements=true`;

    console.log(`\n>>> ANALIZANDO RAW DATA - Factura ${codification} en Nodo ${nodeId}...`);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ codification })
    });

    const data = await res.json();
    const list = data.content || data || [];

    console.log(JSON.stringify(list.map(inv => ({
        id: inv.id,
        cod: inv.codification,
        date: inv.emissionDate,
        amount: inv.mainAmount || inv.totalAmount,
        customer: inv.customer?.name || inv.customer?.lastName,
        valueType: inv.valueType, // Objeto completo
        invoiceType: inv.invoiceType,
        status: inv.status
    })), null, 2));
}

async function run() {
    await searchInvoiceRaw('2406943', '0008-00000607');
}

run();
