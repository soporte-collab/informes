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

function formatDateISO(dateStr, isEnd) {
    return isEnd ? `${dateStr}T23:59:59.999-03:00` : `${dateStr}T00:00:00.000-03:00`;
}

function formatDateDDMMYYYY(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

async function testFormat(label, body) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/2378041/providers/receipts/search`;

    console.log(`\n--- TEST: ${label} ---`);
    console.log(`Body: ${JSON.stringify(body)}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.message && data.message.includes('filtros de fechas')) {
        console.error(`❌ FALLA: ${data.message}`);
    } else if (data.status === 400 || data.error) {
        console.error(`❌ ERROR ${data.status || 500}: ${data.message || data.error}`);
    } else {
        const list = data.content || data || [];
        console.log(`✅ EXITO: Total: ${Array.isArray(list) ? list.length : 'N/A'}`);
        if (data.content) console.log(`Result sample count: ${data.content.length}`);
    }
}

async function run() {
    const testDate = '2026-01-20';

    // 1. Plain object with ISO
    await testFormat("Plain Object + ISO", {
        emissionDateFrom: formatDateISO(testDate, false),
        emissionDateTo: formatDateISO(testDate, true)
    });

    // 2. Plain object with DD/MM/YYYY
    await testFormat("Plain Object + DD/MM/YYYY", {
        emissionDateFrom: formatDateDDMMYYYY(testDate),
        emissionDateTo: formatDateDDMMYYYY(testDate)
    });

    // 3. Wrapped in request with DD/MM/YYYY (Already failed but for completeness)
    await testFormat("Wrapped in request + DD/MM/YYYY", {
        request: {
            emissionDateFrom: formatDateDDMMYYYY(testDate),
            emissionDateTo: formatDateDDMMYYYY(testDate)
        }
    });
}

run();
