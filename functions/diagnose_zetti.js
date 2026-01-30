const axios = require('axios');
const qs = require('qs');

async function diagnose() {
    const config = {
        client_id: 'biotrack',
        client_secret: 'SRwdDVgLQT1i',
        auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
        api_url: 'http://190.15.199.103:8089/api-rest'
    };

    try {
        console.log('1. Obteniendo Token...');
        const authHeader = Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64');
        const authRes = await axios.post(config.auth_url, qs.stringify({
            grant_type: 'password',
            username: config.client_id,
            password: config.client_secret
        }), {
            headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const token = authRes.data.access_token;
        console.log('✔ Token OK');

        const name = 'ADERMICINA';
        console.log(`\n2. Buscando por nombre (term in URL): ${name}...`);
        const searchUrl = `${config.api_url}/v2/2378041/products/search?term=${encodeURIComponent(name)}`;
        const searchRes = await axios.post(searchUrl, {
            status: "ACTIVO"
        }, { headers: { 'Authorization': `Bearer ${token}` } });

        const products = searchRes.data.content || searchRes.data;
        console.log(`✔ Encontrados: ${products.length} productos`);
        if (products.length > 0) {
            console.log('Primer producto:', products[0].description, 'ID:', products[0].id);
        }

        // Derive productId for subsequent calls, if any product was found
        const productId = products.length > 0 ? products[0].id : undefined;
        if (!productId) {
            console.log('No product ID found to proceed with stock consultation.');
            return; // Exit if no product ID is available
        }


        console.log('\n3. Consultando Stock Multi-Nodo (URL SIN /v2/)...');
        const stockUrl = `${config.api_url}/2378039/products/details-per-nodes`;
        const res = await axios.post(stockUrl, {
            idsNodos: [2378041, 2406943],
            idsProductos: [productId]
        }, { headers: { 'Authorization': `Bearer ${token}` } });

        console.log('\n--- RESPUESTA CRUDA DE ZETTI ---');
        console.log(JSON.stringify(res.data, null, 2));

    } catch (err) {
        console.error('\n✖ ERROR:', err.response?.status, err.response?.data || err.message);
    }
}

diagnose();
