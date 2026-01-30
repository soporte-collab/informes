const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

async function getZettiToken() {
    console.log("Obteniendo token...");
    const credsBase64 = Buffer.from(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`).toString('base64');
    const authParams = new URLSearchParams();
    authParams.append('grant_type', 'password');
    authParams.append('username', ZETTI_CONFIG.client_id);
    authParams.append('password', ZETTI_CONFIG.client_secret);

    const res = await fetch(ZETTI_CONFIG.auth_url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credsBase64}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: authParams.toString()
    });
    const data = await res.json();
    return data.access_token;
}

async function testStock() {
    try {
        const token = await getZettiToken();
        if (!token) {
            console.error("No se pudo obtener el token.");
            return;
        }
        console.log("Token obtenido. Probando stock...");

        const url = `${ZETTI_CONFIG.api_url}/2378039/products/details-per-nodes`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idsNodos: [2378041, 2406943],
                idsProductos: [2146955]
            })
        });

        const data = await res.json();
        console.log("Respuesta Stock:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testStock();
