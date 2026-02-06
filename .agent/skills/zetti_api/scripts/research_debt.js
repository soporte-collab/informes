
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

async function fetchNewV2Sales(token, nodeId) {
    const dateStr = "2026-02-02T00:00:00.000-03:00";
    const dateEnd = "2026-02-02T23:59:59.999-03:00";
    const url = `http://190.15.199.103:8089/api-rest/v2/${nodeId}/sales-receipts/search?include_items=true&include_agreements=true&include_concepts=true&per_page=5`;
    const body = { emissionDateFrom: dateStr, emissionDateTo: dateEnd };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (response.ok) return await response.json();
    return null;
}

async function run() {
    const token = await getZettiToken();
    if (token) {
        const nodeId = '2378041';
        const receipts = await fetchNewV2Sales(token, nodeId);

        if (receipts && receipts.length > 0) {
            console.log(`\n=== MAPEO COMPLETO DE DATOS (${receipts.length} facturas) ===\n`);

            receipts.forEach((r, idx) => {
                console.log(`\n--- FACTURA ${idx + 1} ---`);
                console.log("IDENTIFICACIÓN:");
                console.log(`  - ID Factura: ${r.id}`);
                console.log(`  - Número: ${r.codification}`);
                console.log(`  - Fecha Emisión: ${r.emissionDate}`);
                console.log(`  - Estado: ${r.status?.name} (${r.status?.description})`);

                console.log("\nMONTOS:");
                console.log(`  - Monto Principal: ${r.mainAmount}`);
                console.log(`  - Descuento General: ${r.generalDiscount}`);

                console.log("\nNODO/SUCURSAL:");
                console.log(`  - Nodo Creación: ${r.creationNode?.name} (ID: ${r.creationNode?.id})`);
                console.log(`  - Centro Emisión: ${r.emissionCenter?.name}`);

                console.log("\nVENDEDOR:");
                console.log(`  - Usuario: ${r.creationUser?.description}`);
                console.log(`  - ID Usuario: ${r.creationUser?.id}`);

                console.log("\nCLIENTE:");
                if (r.customer) {
                    console.log(`  - Nombre: ${r.customer.name}`);
                    console.log(`  - DNI/CUIT: ${r.customer.documentNumber}`);
                    console.log(`  - Tipo Doc: ${r.customer.documentType}`);
                    console.log(`  - Situación IVA: ${r.customer.vatSituation?.name}`);
                } else {
                    console.log("  - (Sin datos de cliente)");
                }

                console.log("\nPRODUCTOS:");
                if (r.items && r.items.length > 0) {
                    r.items.forEach((item, i) => {
                        console.log(`  [${i + 1}] ${item.product?.name || 'SIN NOMBRE'}`);
                        console.log(`      - ID Producto: ${item.product?.id}`);
                        console.log(`      - Cantidad: ${item.quantity}`);
                        console.log(`      - Precio Unit: ${item.unitPrice}`);
                        console.log(`      - Descuento: ${item.discount}`);
                        console.log(`      - Monto Total: ${item.amount}`);
                    });
                } else {
                    console.log("  (Sin ítems)");
                }

                console.log("\nFORMAS DE PAGO:");
                if (r.agreements && r.agreements.length > 0) {
                    r.agreements.forEach((ag, i) => {
                        console.log(`  [${i + 1}] Tipo: ${ag.type}`);
                        console.log(`      - Forma: ${ag.valueType?.name} (${ag.valueType?.description})`);
                        console.log(`      - Monto: ${ag.mainAmount}`);
                        if (ag.effective) {
                            console.log(`      - Efectivo: ${ag.effective.name}`);
                        }
                    });
                } else {
                    console.log("  (Sin formas de pago)");
                }

                console.log("\nCONCEPTOS CONTABLES:");
                if (r.concepts && r.concepts.length > 0) {
                    r.concepts.forEach((c, i) => {
                        console.log(`  [${i + 1}] ${c.name}: $${c.amount}`);
                    });
                } else {
                    console.log("  (Sin conceptos)");
                }
            });
        }
    }
}

run();
