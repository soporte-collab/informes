const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

const NODOS = {
    'BIOSALUD': '2378041',
    'CHACRAS': '2406943',
    'CONCENTRADOR': '2378039'
};

function formatZettiDate(d, end) {
    const timePart = end ? '23:59:59.999' : '00:00:00.000';
    return `${d}T${timePart}-03:00`;
}

async function getZettiToken() {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', 'biotrack');
    params.append('password', 'SRwdDVgLQT1i');

    const auth = btoa(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`);

    try {
        const res = await fetch(ZETTI_CONFIG.auth_url, {
            method: 'POST',
            body: params,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        const data = await res.json();
        return data.access_token;
    } catch (err) {
        console.error('Auth Error:', err.message);
        throw err;
    }
}

async function queryDate(nodeName, nodeId, dateStr) {
    const token = await getZettiToken();
    const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search`;

    const startDate = formatZettiDate(dateStr, false);
    const endDate = formatZettiDate(dateStr, true);

    const body = {
        emissionDateFrom: startDate,
        emissionDateTo: endDate,
        page: 0,
        pageSize: 1, // We only care about totalElements
        orderBy: [{ field: "emissionDate", direction: "DESC" }]
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    console.log(`Node: ${nodeName} (${nodeId}) | Date: ${dateStr} | Total Invoices: ${data.totalElements || 0}`);
    return data.totalElements || 0;
}

async function run() {
    try {
        const date = '2026-01-05';
        console.log(`Fetching ALL invoices for ${date}...\n`);

        async function fetchAllPages(nodeName, nodeId) {
            const token = await getZettiToken();
            const url = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search`;

            let allRecords = [];
            let page = 1; // Zetti uses 1-based pagination

            console.log(`\n=== ${nodeName} (${nodeId}) ===`);
            console.log(`Date range: ${formatZettiDate(date, false)} -> ${formatZettiDate(date, true)}`);

            while (page < 21) {
                const body = {
                    idNode: nodeId,
                    emissionDateFrom: formatZettiDate(date, false),
                    emissionDateTo: formatZettiDate(date, true),
                    page: page,
                    pageSize: 50,
                    orderBy: [{ field: "emissionDate", direction: "DESC" }]
                };

                console.log(`Fetching page ${page}...`);

                try {
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(body)
                    });

                    const data = await res.json();

                    if (data.error || data.errors) {
                        console.log('ERROR:', JSON.stringify(data));
                        break;
                    }

                    const content = data.content || [];
                    console.log(`  -> Received ${content.length} records`);

                    if (content.length === 0) {
                        console.log('  -> Empty page, stopping.');
                        break;
                    }

                    allRecords = [...allRecords, ...content];

                    if (content.length < 50) {
                        console.log('  -> Partial page, stopping.');
                        break;
                    }

                    page++;
                } catch (err) {
                    console.error('Fetch error:', err.message);
                    break;
                }
            }

            console.log(`\nTOTAL for ${nodeName}: ${allRecords.length} records`);

            if (allRecords.length > 0) {
                console.log(`First: ${allRecords[0].emissionDate} - ${allRecords[0].codification}`);
                console.log(`Last: ${allRecords[allRecords.length - 1].emissionDate} - ${allRecords[allRecords.length - 1].codification}`);
            }

            return allRecords;
        }

        const biosalud = await fetchAllPages('BIOSALUD', NODOS.BIOSALUD);
        const chacras = await fetchAllPages('CHACRAS', NODOS.CHACRAS);

        console.log(`\n========== SUMMARY ==========`);
        console.log(`BioSalud: ${biosalud.length} records`);
        console.log(`Chacras: ${chacras.length} records`);
        console.log(`TOTAL: ${biosalud.length + chacras.length} records`);
        console.log(`=============================\n`);

    } catch (e) {
        console.error(e);
    }
}

run();
