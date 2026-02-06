
async function getZettiToken() {
    const tokenUrl = 'http://190.15.199.103:8089/oauth-server/oauth/token';
    const credentials = btoa('biotrack:SRwdDVgLQT1i');
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', 'biotrack');
    params.append('password', 'SRwdDVgLQT1i');
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
    });
    const data = await response.json();
    return data.access_token;
}

async function run() {
    const token = await getZettiToken();
    if (token) {
        const nodeId = '2406943';
        const urlIva = `http://190.15.199.103:8089/api-rest/${nodeId}/receipts-iva-book-purchases/search?per_page=100`;
        const body = { fechaEmisionDesde: "01/02/2026", fechaEmisionHasta: "06/02/2026" };
        const res = await fetch(urlIva, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            const data = await res.json();
            const record = data.find(r => JSON.stringify(r).toUpperCase().includes("BIOLATINA"));
            if (record) {
                console.log(`Biolatina in Chacras Park:`);
                console.log(`- Fecha: ${record.fechaEmision}`);
                console.log(`- Importe: ${record.importe}`);
                console.log(`- Tipo Valor: ${JSON.stringify(record.tipoValor)}`);
                console.log(`- Subtipo: ${JSON.stringify(record.subtipo)}`);
            }
        }
    }
}

run();
