const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const ZETTI_CONFIG = {
    client_id: 'biotrack',
    client_secret: 'SRwdDVgLQT1i',
    auth_url: 'http://190.15.199.103:8089/oauth-server/oauth/token',
    api_url: 'http://190.15.199.103:8089/api-rest'
};

/**
 * LOGICA DE SINCRONIZACION COMPARTIDA
 */
async function syncZettiLive() {
    console.log("[SYNC] Iniciando Sincronización...");
    const token = await getZettiToken();
    const now = new Date();
    // Hoy a las 00:00 AM para Argentina
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const startDate = formatZettiLiveDate(todayStart);
    const endDate = formatZettiLiveDate(now);

    const summary = { totalSales: 0, nodes: {} };

    const batch = db.batch();
    let batchCount = 0;

    for (const [name, id] of Object.entries(NODOS)) {
        try {
            const url = `${ZETTI_CONFIG.api_url}/v2/${id}/sales-receipts/search?include_items=true`;
            const res = await axios.post(url, {
                emissionDateFrom: startDate,
                emissionDateTo: endDate,
                pageSize: 500,
                orderBy: [
                    { field: "emissionDate", direction: "DESC" }
                ]
            }, {
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: 45000
            });

            const sales = res.data?.content || res.data || [];
            console.log(`[SYNC] ${name}: Encontrados ${sales.length} comprobantes.`);

            if (sales.length > 0) {
                // DEBUG: Log first sale to see structure
                console.log(`[DEBUG] First sale from ${name}:`, JSON.stringify(sales[0]).substring(0, 500));
            }

            summary.nodes[name] = sales.length;
            summary.totalSales += sales.length;

            sales.forEach(sale => {
                const docId = `LIVE-${name}-${sale.id}`; // Use name to avoid conflicts
                const ref = db.collection('zetti_responses').doc(docId);

                // Biosalud might use different amount fields
                const amount = sale.totalAmount || sale.mainAmount || sale.amount || sale.netAmount || 0;
                const seller = sale.creationUser?.description || sale.creationUser?.alias || 'SISTEMA';
                const issueDate = sale.emissionDate || sale.issueDate || new Date().toISOString();

                const items = sale.items || [];
                const receiptId = sale.id;
                const emissionDate = sale.emissionDate;

                // 4. PREPARAR REGISTROS PARA PERSISTENCIA
                const records = items.map(item => {
                    const prodName = item.description || item.product?.description || 'SIN NOMBRE';
                    const barcode = item.barCode || item.product?.barCode || item.product?.barcode || 'N/A';

                    // --- NUEVO: ALIMENTAR BASE MAESTRA DE PRODUCTOS ---
                    if (barcode !== 'N/A' && prodName !== 'SIN NOMBRE') {
                        const prodRef = admin.firestore().collection('zetti_products_master').doc(Buffer.from(prodName).toString('base64').substring(0, 50));
                        prodRef.set({
                            name: prodName,
                            barcode: barcode,
                            productId: item.product?.id || null,
                            lastSeen: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true }).catch(e => console.error("Error saving master product:", e));
                    }
                    // ------------------------------------------------

                    return {
                        id: `${receiptId}_${item.id}`,
                        date: emissionDate,
                        productName: prodName,
                        barcode: barcode,
                        quantity: item.quantity || 0,
                        totalPrice: item.totalPrice || 0,
                        category: item.product?.group?.description || 'VARIOS',
                        nodeId: id
                    };
                });

                if (batchCount < 450) { // Safety limit for batch
                    batch.set(ref, {
                        id: sale.id || docId,
                        issueDate: issueDate,
                        amount: Number(amount),
                        seller: seller,
                        branch: name,
                        type: 'hourly_sale',
                        nodeId: id,
                        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
                        items: records // Add the detailed items to the sale record
                    });
                    batchCount++;
                }
            });

        } catch (error) {
            console.error(`[SYNC] Error en nodo ${name}:`, error.message);
        }
    }

    if (batchCount > 0) {
        await batch.commit();
        console.log(`[SYNC] Batch commit exitoso: ${batchCount} registros.`);
    }

    // Save sync metadata for frontend display
    await db.collection('zetti_metadata').doc('last_sync').set({
        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        type: 'automatic',
        recordsProcessed: batchCount,
        summary: summary
    }, { merge: true });

    return summary;
}

// Mapeo Centralizado de IDs de Zetti
const NODOS = {
    'BIOSALUD': '2378041',
    'CHACRAS': '2406943'
};

const formatZettiDate = (dateStr, isEnd = false) => {
    if (!dateStr) return '';
    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    return isEnd ? `${datePart}T23:59:59.999-03:00` : `${datePart}T00:00:00.000-03:00`;
};

const formatZettiLiveDate = (date) => {
    if (!date) return '';
    // Formatear Date object a YYYY-MM-DDTHH:mm:ss.SSS-03:00
    const pad = (n) => n.toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}.${ms}-03:00`;
};

/**
 * TUNEL PRINCIPAL (Activado por Firestore)
 */
exports.zetti_tunnel_v4 = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB' })
    .firestore.document('zetti_queries/{queryId}')
    .onCreate(async (snap, context) => {
        const queryId = context.params.queryId;
        const { type, payload, nodeId } = snap.data();
        console.log(`[TUNNEL v4] >> START Query: ${queryId}`);

        try {
            const token = await getZettiToken();
            const effectiveNodeId = NODOS[nodeId] || nodeId;

            let url = '';
            let body = { ...payload };

            let finalResponseData = null;

            if (type === 'SEARCH_INVOICES' || type === 'SEARCH_INVOICE' || type === 'MASSIVE_SYNC') {
                // Volvemos a pedir agreements (liviano) pero NO relations (pesado)
                url = `${ZETTI_CONFIG.api_url}/v2/${effectiveNodeId}/sales-receipts/search?include_items=true&include_agreements=true`;
                if (body.codification) {
                    delete body.startDate;
                    delete body.endDate;
                    const res = await axios.post(url, body, {
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        timeout: 60000
                    });
                    finalResponseData = res.data;
                } else {
                    body.emissionDateFrom = formatZettiDate(body.startDate, false);
                    body.emissionDateTo = formatZettiDate(body.endDate, true);
                    console.log(`[TUNNEL V8] DATES ORDERED: ${body.emissionDateFrom} -> ${body.emissionDateTo}`);
                    delete body.startDate;
                    delete body.endDate;

                    // --- PAGINACIÓN ROBUSTA EN EL TÚNEL ---
                    let allItems = [];
                    let page = 1;
                    let hasMore = true;
                    // let lastPageSignature = null; (Ya no lo usamos con page index)
                    const includeItems = body.includeItems !== false;
                    const lightMode = body.lightMode === true;

                    // Ajustamos URL según necesidad
                    let finalUrl = url;
                    if (lightMode) {
                        finalUrl = `${ZETTI_CONFIG.api_url}/v2/${nodeId}/sales-receipts/search?include_items=false&include_relations=false&include_agreements=true`;
                    }

                    while (hasMore && page <= 15) { // Max 15 pages * 50 records = 750 records
                        try {
                            const paginatedUrl = `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}page=${page}&pageSize=50`;

                            // 🏗️ CONSTRUCCIÓN LIMPIA DEL BODY (Solo filtros aceptados)
                            const cleanBody = {};
                            const rawStart = body.startDate || body.emissionDateFrom;
                            const rawEnd = body.endDate || body.emissionDateTo;

                            if (rawStart) cleanBody.emissionDateFrom = formatZettiDate(rawStart, false);
                            if (rawEnd) cleanBody.emissionDateTo = formatZettiDate(rawEnd, true);

                            console.log(`[TUNNEL V12] ${nodeId} Pág ${page} URL: ${paginatedUrl} Body: ${JSON.stringify(cleanBody)}`);

                            const res = await axios.post(paginatedUrl, cleanBody, {
                                headers: { 'Authorization': `Bearer ${token}` },
                                timeout: 120000
                            });

                            const data = res.data;
                            const pageContent = Array.isArray(data) ? data : (data?.content || []);

                            if (pageContent.length === 0) {
                                console.log(`[TUNNEL V12] ${nodeId} - Pág ${page} vacía.`);
                                break;
                            }

                            // 🎯 MAPEO ESTRICTO V7
                            const mapped = pageContent.map(inv => {
                                // Mapeo V11+ (Misma lógica que funciona en auditoría)
                                return {
                                    id: inv.id,
                                    cod: inv.codification || inv.number || 'S/N',
                                    tco: inv.valueType?.name || 'FV',
                                    fec: inv.emissionDate || inv.creationDate,
                                    tot: inv.mainAmount || inv.totalAmount || 0,
                                    ven: inv.creationUser?.description || inv.creationUser?.alias || 'BIO',
                                    ent: inv.entityAgrupadora?.name || inv.healthInsurance?.name || 'Particular',
                                    pagos: (inv.agreements || []).map(a => ({
                                        t: a.type || 'Pago',
                                        n: a.entity?.name || a.healthInsurance?.name || a.card?.name || a.codification || 'Contado'
                                    }))
                                };
                            });

                            // De-duplicar por ID
                            const currentIds = new Set(allItems.map(i => i.id));
                            const uniqueFromPage = mapped.filter(f => !currentIds.has(f.id));

                            allItems = [...allItems, ...uniqueFromPage];
                            console.log(`[TUNNEL V12] ${nodeId} recibidos ${pageContent.length}, acumulados únicos: ${allItems.length}`);

                            if (pageContent.length < 50) {
                                hasMore = false;
                            } else {
                                page++;
                            }
                        } catch (err) {
                            console.error(`[TUNNEL V12] Error pág ${page}:`, err.response?.data || err.message);
                            break;
                        }
                    }
                    finalResponseData = { content: allItems };
                }
            } else if (type === 'SEARCH_PRODUCT' || type === 'SEARCH_PRODUCT_BY_BARCODE' || type === 'SEARCH_PRODUCT_BY_DESCRIPTION') {
                url = `${ZETTI_CONFIG.api_url}/v2/${effectiveNodeId}/products/search?include_groups=true&include_groups_configuration=true`;

                let searchPayload = {};
                const barcode = payload.barcode || payload.barCode || (payload.barCodes && payload.barCodes[0]);
                const description = payload.description || payload.productName || payload.name;

                // PRIORIDAD: Si hay barcode, buscamos SOLO por barcode para máxima precisión
                if (barcode) {
                    searchPayload = { barCodes: [barcode.trim()] };
                } else if (description) {
                    searchPayload = { description: description.trim() };
                } else {
                    searchPayload = { ...payload };
                }

                console.log(`[TUNNEL] 🔍 SEARCH ${nodeId} | Body: ${JSON.stringify(searchPayload)}`);

                const searchRes = await axios.post(url, searchPayload, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    timeout: 30000
                });

                const products = searchRes.data.content || (Array.isArray(searchRes.data) ? searchRes.data : []);

                if (products.length > 0) {
                    const foundProd = products[0];
                    console.log(`[TUNNEL] ✅ HALLADO: "${foundProd.description}" (ID: ${foundProd.id})`);

                    // Si buscamos por barcode y hallamos producto, traemos stock multi-nodo de una vez
                    if (barcode) {
                        try {
                            const stockUrl = `${ZETTI_CONFIG.api_url}/2378039/products/details-per-nodes`;
                            const stockRes = await axios.post(stockUrl, {
                                idsNodos: [2378041, 2406943],
                                idsProductos: [Number(foundProd.id)]
                            }, { headers: { 'Authorization': `Bearer ${token}` }, timeout: 20000 });
                            foundProd._multiStock = stockRes.data;
                            console.log(`[TUNNEL] 📦 STOCK REAL cargado para ID ${foundProd.id}`);
                        } catch (e) {
                            console.error("[TUNNEL] ❌ Error stock proactivo:", e.message);
                        }
                    }
                } else {
                    console.log(`[TUNNEL] ⚠️ NO se encontró producto para: ${JSON.stringify(searchPayload)}`);
                }
                finalResponseData = searchRes.data;

            } else if (type === 'GET_MULTI_STOCK' || type === 'MASSIVE_STOCK_CHECK') {
                // URL SIN /v2/ según ZETTI_CURL_QUICKSTART.md
                url = `${ZETTI_CONFIG.api_url}/2378039/products/details-per-nodes`;
                const pId = payload.productId || payload.productIds;
                const pIds = (Array.isArray(pId) ? pId : [pId]).map(id => Number(id)).filter(id => !isNaN(id));
                body = { idsNodos: [2378041, 2406943], idsProductos: pIds };
                console.log(`[TUNNEL] 📦 STOCK ${nodeId} | Body: ${JSON.stringify(body)}`);
                const res = await axios.post(url, body, { headers: { 'Authorization': `Bearer ${token}` }, timeout: 60000 });
                finalResponseData = res.data;
            } else if (type === 'GET_VMD' || type === 'GET_STATISTICS') {
                // Endpoint para estadísticas de venta (VMD)
                url = `${ZETTI_CONFIG.api_url}/2378039/centralized-purchases/statistics-by-node`;
                console.log(`[TUNNEL] 📊 VMD | Body: ${JSON.stringify(payload)}`);
                const res = await axios.post(url, payload, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 60000
                });
                finalResponseData = res.data;
            } else if (type === 'MANUAL_SYNC') {
                // Special internal trigger
                console.log(`[TUNNEL] >> TRIGERRED GLOBAL SYNC FOR ALL NODES`);
                const summary = await syncZettiLive();
                await db.collection('zetti_responses').doc(queryId).set({
                    status: 'SUCCESS',
                    data: summary,
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return;
            }

            // ... (otros tipos de query quedarían igual, pero este bloque reemplaza el res = await axios.post general) ...

            if (!finalResponseData) {
                const res = await axios.post(url, body, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    timeout: 60000
                });
                finalResponseData = res.data;
            }

            await db.collection('zetti_responses').doc(queryId).set({
                status: 'SUCCESS',
                data: JSON.parse(JSON.stringify(finalResponseData)),
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });

        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            console.error(`[TUNNEL v4] ERROR:`, errorMsg);
            await db.collection('zetti_responses').doc(queryId).set({
                status: 'ERROR',
                message: errorMsg,
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    });

/**
 * SINCRONIZADOR HORARIO (Cron Job)
 * Actualiza las ventas de la última hora para alimentar el Ranking y Sugerencias
 */
exports.zetti_hourly_sync = functions.pubsub
    .schedule('0 * * * *') // Cada hora al minuto 0
    .timeZone('America/Argentina/Buenos_Aires')
    .onRun(async (context) => {
        console.log("[CRON] Iniciando Sincronización Horaria...");
        return await syncZettiLive();
    });

const cors = require('cors')({ origin: true });
exports.zetti_manual_sync = functions.https.onRequest((req, res) => {
    return cors(req, res, async () => {
        try {
            const summary = await syncZettiLive();
            await db.collection('zetti_metadata').doc('last_sync').set({
                lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
                type: 'manual',
                recordsProcessed: summary.totalSales,
                summary: summary
            }, { merge: true });
            res.json(summary);
        } catch (error) {
            console.error("Manual Sync Error:", error);
            res.status(500).send(error.message);
        }
    });
});

exports.zetti_sync_live_v2 = functions.https.onRequest((req, res) => {
    return cors(req, res, async () => {
        try {
            const summary = await syncZettiLive();
            await db.collection('zetti_metadata').doc('last_sync').set({
                lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
                type: 'manual',
                recordsProcessed: summary.totalSales,
                summary: summary
            }, { merge: true });
            res.json(summary);
        } catch (error) {
            console.error("Manual Sync Error:", error);
            res.status(500).send(error.message);
        }
    });
});

// HELPERS
async function getZettiToken() {
    const credsBase64 = Buffer.from(`${ZETTI_CONFIG.client_id}:${ZETTI_CONFIG.client_secret}`).toString('base64');
    const authParams = new URLSearchParams();
    authParams.append('grant_type', 'password');
    authParams.append('username', ZETTI_CONFIG.client_id);
    authParams.append('password', ZETTI_CONFIG.client_secret);

    const res = await axios.post(ZETTI_CONFIG.auth_url, authParams.toString(), {
        headers: {
            'Authorization': `Basic ${credsBase64}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
    });
    return res.data.access_token;
}

exports.zetti_api_v5 = functions.https.onCall(() => ({ success: false }));

/**
 * SINCRONIZADOR DE BASE DE DATOS (Cron y Manual)
 * Descarga sales.json e invoices.json del Storage, busca las ventas del día en Zetti,
 * y actualiza los archivos persistentes.
 */
async function syncDatabaseLogic(customStartDate, customEndDate) {
    console.log("[DB SYNC] Iniciando Sincronización de Base de Datos...");
    const bucket = admin.storage().bucket();

    // 1. Obtener datos de Zetti (Rango dinámico o Hoy)
    const zettiData = await fetchZettiSales(customStartDate, customEndDate);
    console.log(`[DB SYNC] Zetti: ${zettiData.length} comprobantes recuperados entre ${customStartDate || 'HOY'} y ${customEndDate || 'HOY'}.`);

    if (zettiData.length === 0) return { message: "No hay ventas nuevas en Zetti." };

    // 2. Mapear a Formato App (Sales e Invoices)
    const newSales = [];
    const newInvoices = [];

    zettiData.forEach(r => {
        // A. Mapear Invoice (UPDATED ZETTI MAPPING)
        const rawDate = r.emissionDate || r.creationDate || new Date().toISOString();
        const safeNro = (r.codification || r.number || 'SN').replace(/[^a-zA-Z0-9-]/g, '');
        const amount = r.mainAmount || 0;

        const invId = `INV-${safeNro}-${new Date(rawDate).getTime()}-${amount}`;

        // Determinar Tipo de Comprobante (Normalizar a FV, NC, TX)
        const rawType = (r.valueType?.name || r.invoiceType?.name || 'FV').toUpperCase();
        let normalizedType = 'FV';
        if (rawType.includes('CREDITO')) normalizedType = 'NC';
        else if (rawType.includes('DEBITO')) normalizedType = 'ND';
        else if (rawType.includes('TRANSFER')) normalizedType = 'TX';

        // Determinar Entidad y Obra Social
        let entity = 'Particular';
        if (r.entityAgrupadora?.name) entity = r.entityAgrupadora.name;
        else if (r.healthInsurance?.name) entity = r.healthInsurance.name;
        else if (r.agreements?.some(a => a.type === 'prescription')) {
            const ag = r.agreements.find(a => a.type === 'prescription');
            if (ag?.healthInsurance?.name) entity = ag.healthInsurance.name;
        }

        // Lógica Avanzada de Método de Pago (Enhanced with MODO)
        let paymentType = 'Contado';
        if (r.agreements && Array.isArray(r.agreements)) {
            // 1. Prioritize Digital Wallets (MODO, Mercado Pago, QR)
            const digitalWallet = r.agreements.find(a => {
                const desc = (a.valueType?.description || a.valueType?.name || a.codification || '').toUpperCase();
                return desc.includes('MODO') || desc.includes('MERCADO PAGO') || desc.includes('QR');
            });

            if (digitalWallet) {
                const desc = digitalWallet.valueType?.description || digitalWallet.codification || 'Billetera Digital';
                paymentType = desc.includes('MODO') ? 'MODO' : desc;
            } else {
                // 2. Cards
                const cardPayment = r.agreements.find(a =>
                    a.type === 'cardInstallment' ||
                    a.card ||
                    (a.valueType?.name || '').toUpperCase().includes('TARJETA') ||
                    (a.codification || '').toUpperCase().includes('TARJETA')
                );

                if (cardPayment) {
                    paymentType = cardPayment.card?.name || cardPayment.valueType?.name || 'Tarjeta';
                } else {
                    const ccPayment = r.agreements.find(a =>
                        a.type === 'currentAccount' ||
                        (a.codification || '').toUpperCase().includes('CTA') ||
                        (a.codification || '').toUpperCase().includes('CORRIENTE')
                    );
                    if (ccPayment) {
                        paymentType = 'Cuenta Corriente';
                    } else {
                        const otherPayment = r.agreements.find(a => a.type !== 'agreement' && a.type !== 'prescription');
                        if (otherPayment) {
                            paymentType = otherPayment.codification || otherPayment.valueType?.name || otherPayment.type || 'Contado';
                        }
                    }
                }
            }
        }

        const invoice = {
            id: invId,
            date: rawDate,
            monthYear: rawDate.substring(0, 7),
            branch: r.emissionCenter?.name || r.terminal?.name || (r.nodeId === 2378041 ? 'FCIA BIOSALUD' : 'CHACRAS PARK'),
            type: normalizedType,
            invoiceNumber: r.codification || r.invoiceNumber || 'SN',
            seller: r.creationUser?.description || r.creationUser?.alias || 'SISTEMA',
            client: r.customer?.name || (r.customer?.firstName ? `${r.customer.lastName} ${r.customer.firstName}` : 'CONSUMIDOR FINAL'),
            entity: entity,
            insurance: entity !== 'Particular' ? entity : '-',
            paymentType: paymentType,
            netAmount: amount,
            grossAmount: amount,
            discount: 0
        };
        newInvoices.push(invoice);

        // B. Mapear Items (Sales)
        r.items.forEach(item => {
            const safeNro = (r.codification || r.number || 'SN').replace(/[^a-zA-Z0-9-]/g, '');
            const prodName = item.product?.description || item.description || 'Prod';
            const barcode = item.barCode || item.product?.barCode || item.product?.barcode || 'N/A';

            // --- NUEVO: ALIMENTAR BASE MAESTRA ---
            if (barcode !== 'N/A' && prodName !== 'Prod') {
                const prodId = item.product?.id || null;
                const docId = Buffer.from(prodName.substring(0, 50)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
                admin.firestore().collection('zetti_products_master').doc(docId).set({
                    name: prodName,
                    barcode: barcode,
                    productId: prodId,
                    lastSeen: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(err => console.error("Error saving master prod:", err));
            }
            // ------------------------------------

            const safeProd = prodName.replace(/[^a-zA-Z0-9]/g, '');
            const saleId = `SALE-${safeNro}-${safeProd}-${new Date(rawDate).getTime()}-${item.quantity}`;

            const sale = {
                id: saleId,
                date: rawDate,
                monthYear: rawDate.substring(0, 7),
                productName: prodName,
                barcode: barcode,
                quantity: item.quantity,
                unitPrice: item.unitPrice || (item.amount / (item.quantity || 1)),
                totalAmount: item.amount,
                sellerName: invoice.seller,
                branch: invoice.branch,
                hour: new Date(rawDate).getHours(),
                category: item.product?.category?.description || 'Varios',
                manufacturer: item.product?.manufacturer?.description || 'Varios',
                invoiceNumber: r.codification || safeNro,
                type: invoice.type, // Nuevo: FV o NC para diferenciar devoluciones
                entity: invoice.entity
            };
            newSales.push(sale);
        });
    });

    console.log(`[DB SYNC] Mapeados: ${newInvoices.length} facturas, ${newSales.length} ventas.`);

    // 3. Descargar, Fusionar y Guardar (Invoices)
    // IMPORTANT: Batch updates locally to avoid excessive reads/writes if huge range
    await mergeAndSave(bucket, 'reports_data/invoices.json', newInvoices, 'invoiceNumber');

    // 4. Descargar, Fusionar y Guardar (Sales)
    await mergeAndSave(bucket, 'reports_data/sales.json', newSales, 'id');

    return {
        message: "Sincronización exitosa",
        stats: { invoices: newInvoices.length, sales: newSales.length }
    };
}

/**
 * SINCRONIZADOR DE STOCK MAESTRO
 * Recorre el maestro de productos y actualiza sus niveles de stock real desde Zetti.
 */
async function syncStockMasterLogic() {
    console.log("[STOCK SYNC] 🔄 Iniciando actualización masiva de Stock...");
    const token = await getZettiToken();

    // 1. Obtener productos activos (vistos en los últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const snapshot = await admin.firestore().collection('zetti_products_master')
        .where('lastSeen', '>=', thirtyDaysAgo)
        .limit(2000)
        .get();

    const products = snapshot.docs.map(doc => ({
        docId: doc.id,
        productId: doc.data().productId,
        name: doc.data().name
    })).filter(p => p.productId);

    console.log(`[STOCK SYNC] Procesando stock para ${products.length} productos activos.`);

    if (products.length === 0) return { message: "No hay productos activos para sincronizar stock." };

    // 2. Batch de a 50 ids (Límite típico de Zetti para evitar timeouts)
    const batches = [];
    for (let i = 0; i < products.length; i += 50) {
        batches.push(products.slice(i, i + 50));
    }

    const stockMap = new Map();

    for (const batch of batches) {
        try {
            const pIds = batch.map(p => Number(p.productId)).filter(id => !isNaN(id));
            const url = `${ZETTI_CONFIG.api_url}/2378039/products/details-per-nodes`;

            const res = await axios.post(url, {
                idsNodos: [2378041, 2406943],
                idsProductos: pIds
            }, {
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: 30000
            });

            // La respuesta es un array plano: [{ idProducto, idNodo, detalles: { stock } }, ...]
            const data = Array.isArray(res.data) ? res.data : [];
            data.forEach(item => {
                const pid = item.idProducto;
                if (!stockMap.has(pid)) stockMap.set(pid, { bio: 0, chacras: 0 });
                if (item.idNodo === 2378041) stockMap.get(pid).bio = item.detalles?.stock || 0;
                if (item.idNodo === 2406943) stockMap.get(pid).chacras = item.detalles?.stock || 0;
            });
        } catch (e) {
            console.error("[STOCK SYNC] Error en batch:", e.message);
        }
    }

    // 3. Actualizar Firestore en lotes de 500 (límite de Firestore)
    let dbBatch = admin.firestore().batch();
    let opCount = 0;

    for (const p of products) {
        const stock = stockMap.get(p.productId);
        if (stock) {
            const ref = admin.firestore().collection('zetti_products_master').doc(p.docId);
            dbBatch.update(ref, {
                stockBio: stock.bio,
                stockChacras: stock.chacras,
                stockUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            opCount++;

            if (opCount >= 450) {
                await dbBatch.commit();
                dbBatch = admin.firestore().batch();
                opCount = 0;
            }
        }
    }

    if (opCount > 0) await dbBatch.commit();

    // 4. Exportar el Maestro Completo a Storage para que la App lo lea rápido
    try {
        console.log("[STOCK SYNC] 📦 Exportando maestro a Storage...");
        const allDocs = await admin.firestore().collection('zetti_products_master').get();
        const masterList = allDocs.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const bucket = admin.storage().bucket();
        const file = bucket.file('reports_data/product_master.json');
        await file.save(JSON.stringify(masterList), {
            contentType: 'application/json',
            metadata: { cacheControl: 'public, max-age=3600' }
        });
        console.log(`[STOCK SYNC] 💾 Maestro guardado en Storage (${masterList.length} productos).`);
    } catch (e) {
        console.error("[STOCK SYNC] ❌ Error exportando maestro:", e.message);
    }

    console.log(`[STOCK SYNC] ✅ Finalizado. Stock actualizado para ${products.length} productos.`);
    return { status: 'success', count: products.length };
}

async function fetchZettiSales(customStart, customEnd) {
    const token = await getZettiToken();
    let startDate, endDate;

    if (customStart && customEnd) {
        startDate = formatZettiDate(customStart, false);
        endDate = formatZettiDate(customEnd, true);
    } else {
        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        startDate = formatZettiLiveDate(start);
        endDate = formatZettiLiveDate(now);
    }

    console.log(`[ZETTI FETCH] Rango Solicitado: ${startDate} -> ${endDate}`);

    let allSales = [];

    for (const [name, id] of Object.entries(NODOS)) {
        try {
            let page = 1;
            let hasMore = true;

            while (hasMore && page <= 15) {
                // Traemos items y acuerdos (pagos), pero evitamos relaciones pesadas
                const paginatedUrl = `${ZETTI_CONFIG.api_url}/v2/${id}/sales-receipts/search?page=${page}&pageSize=50&include_items=true&include_agreements=true`;
                const cleanBody = {
                    emissionDateFrom: startDate,
                    emissionDateTo: endDate
                };

                console.log(`[ZETTI FETCH V12] ${name} Pág ${page} Body: ${JSON.stringify(cleanBody)}`);

                const res = await axios.post(paginatedUrl, cleanBody, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 120000
                });

                const data = res.data;
                const content = data?.content || (Array.isArray(data) ? data : []);

                if (content.length === 0) {
                    console.log(`[ZETTI FETCH V12] ${name} Pág ${page} vacía.`);
                    break;
                }

                // Inyectar ID de nodo y acumular
                content.forEach(s => s.nodeId = id);
                allSales = [...allSales, ...content];

                console.log(`[ZETTI FETCH V12] ${name} rcv ${content.length}. Total: ${allSales.length}`);

                if (content.length < 50) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
        } catch (e) {
            console.error(`[ZETTI FETCH V12] Error nodo ${name}:`, e.response?.data || e.message);
        }
    }
    return allSales;
}

// Helper para fusionar JSONs en Storage
async function mergeAndSave(bucket, path, newRecords, dedupKey) {
    const file = bucket.file(path);
    let existing = [];

    try {
        const [exists] = await file.exists();
        if (exists) {
            const [content] = await file.download();
            existing = JSON.parse(content.toString());
        }
    } catch (e) {
        console.warn(`[DB SYNC] No se pudo leer ${path}, creando nuevo.`, e.message);
    }

    // Dedup logic: Create Map by Key
    const map = new Map();
    existing.forEach(r => {
        const key = r[dedupKey] || r.id; // Fallback to ID
        map.set(key, r);
    });

    // Overwrite with new records (Update strategy)
    newRecords.forEach(r => {
        const key = r[dedupKey] || r.id;
        map.set(key, r);
    });

    const merged = Array.from(map.values());
    await file.save(JSON.stringify(merged), {
        contentType: 'application/json',
        metadata: { cacheControl: 'public, max-age=60' }
    });
    console.log(`[DB SYNC] Guardado ${path}: ${merged.length} registros (${newRecords.length} nuevos/act).`);
}

exports.zetti_sync_db_cron = functions.pubsub
    .schedule('0 21 * * *')
    .timeZone('America/Argentina/Buenos_Aires')
    .onRun(async (context) => {
        return await syncDatabaseLogic();
    });

// 2. Cron Job Stock: Todos los días a las 03:00 AM
exports.zetti_sync_stock_cron = functions.pubsub
    .schedule('0 3 * * *')
    .timeZone('America/Argentina/Buenos_Aires')
    .onRun(async (context) => {
        return await syncStockMasterLogic();
    });

// 2. HTTP Trigger Manual (Para el botón)
// 2. HTTP Trigger Manual (Callable Function para evitar CORS)
// 2. HTTP Trigger Manual (Callable Function para evitar CORS)
exports.zetti_sync_db_manual = functions.runWith({
    timeoutSeconds: 540, // 9 min para Reset Total
    memory: '1GB'
}).https.onCall(async (data, context) => {
    try {
        const { startDate, endDate, debug, wipe } = data;
        console.log(`[MANUAL TRIGGER] Solicitud: ${startDate} - ${endDate} (Wipe: ${wipe})`);

        if (wipe) {
            console.log("[MANUAL TRIGGER] ⚠️ BORRADO DE BASE DE DATOS ACTIVADO");
            const bucket = admin.storage().bucket();
            await Promise.all([
                bucket.file('reports_data/sales.json').delete().catch(() => { }),
                bucket.file('reports_data/invoices.json').delete().catch(() => { })
            ]);
        }

        if (debug) {
            const rawSales = await fetchZettiSales(startDate, endDate);
            return {
                status: 'DEBUG_MODE',
                count: rawSales.length,
                sample: rawSales.slice(0, 5)
            };
        }

        const result = await syncDatabaseLogic(startDate, endDate);
        return { status: 'SUCCESS', ...result };
    } catch (error) {
        console.error("Manual Sync Error:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.zetti_sync_stock_manual = functions.https.onCall(async (data, context) => {
    try {
        return await syncStockMasterLogic();
    } catch (error) {
        console.error("Manual Stock Sync Error:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
