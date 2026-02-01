const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

// URLs de Zetti
const ZETTI_AUTH_URL = 'http://190.15.199.103:8089/oauth-server/oauth/token';
const ZETTI_API_BASE = 'http://190.15.199.103:8089/api-rest';

const ZETTI_USER = 'biotrack';
const ZETTI_PASS = 'SRwdDVgLQT1i';
const ZETTI_CLIENT_ID = 'biotrack';
const ZETTI_CLIENT_SECRET = 'SRwdDVgLQT1i';

exports.zetti_tunnel_v4 = functions.firestore
    .document('zetti_queries/{queryId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        const queryId = context.params.queryId;

        console.log(`🚀 [Tunnel] Consulta ${queryId} iniciada.`);

        try {
            // 1. Auth Zetti (OAuth2)
            const credsBase64 = Buffer.from(`${ZETTI_CLIENT_ID}:${ZETTI_CLIENT_SECRET}`).toString('base64');
            const params = new URLSearchParams();
            params.append('grant_type', 'password');
            params.append('username', ZETTI_USER);
            params.append('password', ZETTI_PASS);

            console.log(`📡 [Auth] Intentando obtener token para: ${ZETTI_USER}`);
            const tokenRes = await fetch(ZETTI_AUTH_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credsBase64}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            if (!tokenRes.ok) {
                const errText = await tokenRes.text();
                throw new Error(`Auth Fallida: ${tokenRes.status} - ${errText}`);
            }

            const auth = await tokenRes.json();
            console.log("✅ [Auth] Token obtenido.");

            // 2. Ejecutar Query (Search o Stock)
            let targetUrl = '';
            let body = null;
            let result = null;

            if (data.barcode) {
                // BÚSQUEDA POR BARCODE (V2)
                targetUrl = `${ZETTI_API_BASE}/v2/${data.nodeId}/products/search?include_groups=true`;
                body = JSON.stringify({ barCodes: [String(data.barcode)] });

                console.log(`📡 [Search] Barcode ${data.barcode} en Nodo ${data.nodeId}`);
                const res = await fetch(targetUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${auth.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body
                });

                if (!res.ok) {
                    const err = await res.text();
                    throw new Error(`Error Búsqueda ${res.status}: ${err}`);
                }

                const searchData = await res.json();
                console.log(`📦 [Search] Resultados: ${Array.isArray(searchData) ? searchData.length : "0 (no array)"}`);

                if (Array.isArray(searchData) && searchData.length > 0) {
                    result = searchData.map(p => {
                        let family = '', monodrug = '', laboratory = '', brand = '', rubro = '', etica = '';
                        let potencia = null, potenciaUM = null, cantidad = null, forma = null;

                        if (p.groups && Array.isArray(p.groups)) {
                            p.groups.forEach(g => {
                                const type = g.groupType?.name || '';
                                if (type === 'FAMILIA') family = g.name;
                                if (type === 'DROGA' || type === 'MONODROGA') monodrug = g.name;
                                if (type === 'FABRICANTE' || type === 'LABORATORIO') laboratory = g.name;
                                if (type === 'MARCA') brand = g.name;
                                if (type === 'RUBRO') rubro = g.name;
                                if (type === 'ÉTICA DE VENTA') etica = g.name;
                                // Nuevos campos para matching exacto
                                if (type === 'POTENCIA') potencia = g.name;
                                if (type === 'POTENCIA U.M.') potenciaUM = g.name;
                                if (type === 'CANTIDAD') cantidad = g.name;
                                if (type === 'FORMA') forma = g.name;
                            });
                        }

                        return {
                            found: true,
                            id: p.id,
                            name: p.name || p.nombre || "Producto",
                            barcode: p.barCode || data.barcode,
                            family,
                            monodrug,
                            laboratory,
                            brand,
                            price: p.suggestedSalePrice || 0,
                            // Metadatos para matching exacto
                            potencia: potencia ? `${potencia}${potenciaUM || ''}` : null,
                            cantidad: cantidad ? parseInt(cantidad) : null,
                            forma,
                            rubro,
                            etica
                        };
                    });
                } else {
                    result = { found: false };
                }
            } else if (data.productId) {
                // CONSULTA STOCK MULTI-NODO
                targetUrl = `${ZETTI_API_BASE}/2378039/products/details-per-nodes`;
                const safeProductId = String(data.productId).replace(/[^0-9]/g, '');
                body = `{"idsNodos":[2378041,2406943],"idsProductos":[${safeProductId}]}`;

                console.log(`📡 [Stock] Solicitando detalles ID ${safeProductId}`);
                const res = await fetch(targetUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${auth.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body
                });

                if (!res.ok) throw new Error(`Error Stock ${res.status}`);
                result = await res.json();
                console.log(`✅ [Stock] Éxito.`);
            }

            // 3. Escribir respuesta en Firestore
            console.log(`💾 [Firestore] Guardando respuesta para ${queryId}`);
            await admin.firestore().collection('zetti_responses').doc(queryId).set({
                data: result,
                status: 'success',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

        } catch (error) {
            console.error("🚨 [Tunnel Error]", error);
            await admin.firestore().collection('zetti_responses').doc(queryId).set({
                status: 'error',
                message: error.message,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    });
