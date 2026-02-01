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

async function searchInvoice(nodeId, codification) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?include_items=true&include_agreements=true`;

    console.log(`\n>>> Buscando Factura ${codification} en Nodo ${nodeId}...`);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ codification })
    });

    const data = await res.json();
    console.log(`Zetti mandó ${Array.isArray(data) ? data.length : (data.content ? data.content.length : 'error')} resultados.`);

    const list = data.content || data || [];
    list.forEach((inv, i) => {
        console.log(`\n[${i}] ID: ${inv.id} | Cod: ${inv.codification} | Fecha: ${inv.emissionDate} | Total: ${inv.mainAmount || inv.totalAmount}`);
        if (inv.customer) console.log(`    Cliente: ${inv.customer.name || inv.customer.lastName}`);
    });
}

async function run() {
    // Chacras Park es 2406943
    await searchInvoice('2406943', '0008-00000607');
}

run();
