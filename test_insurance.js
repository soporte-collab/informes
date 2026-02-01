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

function formatDateDDMMYYYY(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

async function testInsurance(label, body) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/2378041/health-insurance-providers/receipts/search`;

    console.log(`\n--- TEST INSURANCE: ${label} ---`);
    console.log(`Body: ${JSON.stringify(body)}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.message && (data.message.includes('filtros de fechas') || data.message.includes('deserialización'))) {
        console.error(`❌ FALLA: ${data.message}`);
    } else {
        const list = data.content || data || [];
        console.log(`✅ EXITO: Total: ${Array.isArray(list) ? list.length : 'N/A'}`);
    }
}

async function run() {
    const testDate = '2026-01-20';

    await testInsurance("Plain Object + DD/MM/YYYY", {
        emissionDateFrom: formatDateDDMMYYYY(testDate),
        emissionDateTo: formatDateDDMMYYYY(testDate)
    });
}

run();
