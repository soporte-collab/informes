const axios = require('axios');

const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

const NODOS = {
    'BIOSALUD': '2378041',
    'CHACRAS': '2406943'
};

async function getZettiToken() {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', 'biotrack');
    params.append('password', 'SRwdDVgLQT1i');

    const auth = Buffer.from(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`).toString('base64');

    try {
        const res = await axios.post(ZETTI_CONFIG.auth_url, params.toString(), {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return res.data.access_token;
    } catch (err) {
        console.error('Auth Error:', err.message);
        throw err;
    }
}

function formatZettiDate(d, end) {
    const timePart = end ? '23:59:59.999' : '00:00:00.000';
    return `${d}T${timePart}-0300`;
}

async function fetchAllForDate(nodeName, nodeId, dateStr) {
    const token = await getZettiToken();
    const allRecords = [];
    let page = 0;

    const startDate = formatZettiDate(dateStr, false);
    const endDate = formatZettiDate(dateStr, true);

    console.log(`\n=== FETCHING ${nodeName} (${nodeId}) ===`);
    console.log(`Date Range: ${startDate} -> ${endDate}`);

    while (page < 20) {
        const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?page=${page + 1}&pageSize=50`;

        const body = {
            emissionDateFrom: startDate,
            emissionDateTo: endDate
        };

        try {
            console.log(`Fetching page ${page + 1}...`);
            const res = await axios.post(url, body, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            const data = res.data;
            const content = data?.content || (Array.isArray(data) ? data : []);

            console.log(`  -> Received ${content.length} records`);

            if (content.length === 0) {
                console.log(`  -> Empty page, stopping.`);
                break;
            }

            allRecords.push(...content);

            if (content.length < 50) {
                console.log(`  -> Partial page, stopping.`);
                break;
            }

            page++;
        } catch (err) {
            console.error(`  -> ERROR on page ${page + 1}:`, err.response?.data || err.message);
            break;
        }
    }

    console.log(`\nTOTAL RECORDS FOR ${nodeName}: ${allRecords.length}`);

    if (allRecords.length > 0) {
        const first = allRecords[0];
        const last = allRecords[allRecords.length - 1];
        console.log(`First: ${first.emissionDate || first.date} - ${first.codification || first.id}`);
        console.log(`Last: ${last.emissionDate || last.date} - ${last.codification || last.id}`);
    }

    return allRecords;
}

async function run() {
    try {
        const date = '2026-01-05';

        const bioSaludRecords = await fetchAllForDate('BIOSALUD', NODOS.BIOSALUD, date);
        const chacrasRecords = await fetchAllForDate('CHACRAS', NODOS.CHACRAS, date);

        console.log(`\n========== SUMMARY ==========`);
        console.log(`BioSalud: ${bioSaludRecords.length} records`);
        console.log(`Chacras: ${chacrasRecords.length} records`);
        console.log(`TOTAL: ${bioSaludRecords.length + chacrasRecords.length} records`);
        console.log(`=============================\n`);

    } catch (e) {
        console.error('FATAL ERROR:', e);
    }
}

run();
