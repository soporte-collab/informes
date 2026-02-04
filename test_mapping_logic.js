/**
 * TEST MAPPING LOGIC
 * Based on the DOCX example provided by the user.
 */

const sampleReceipt = {
    "id": 144680000000061020,
    "codification": "FV B0008-00012688",
    "emissionDate": "2026-02-02T16:05:08.467-0300",
    "mainAmount": 705202.5, // Header amount
    "items": [
        {
            "id": "144680000000061014",
            "amount": 705202.5,
            "quantity": 1,
            "product": {
                "description": "DETALLE PRODUCTO EJEMPLO",
                "barCode": "123456789"
            }
        }
    ],
    "values": [ // Array of payments/agreements
        {
            "type": "cash",
            "mainAmount": 1000,
            "valueType": { "id": "3", "name": "BILLE" }
        },
        {
            "type": "prescription",
            "mainAmount": 0,
            "valueType": { "id": "2", "name": "RECE" },
            "healthInsurancePlan": { "name": "PLAN PARTICULAR" }
        },
        {
            "type": "checkingAccount",
            "mainAmount": 705202.5,
            "valueType": { "id": "22", "name": "CTACTE" },
            "customer": { "name": "ASOCIART S.A." }
        }
    ],
    "customer": {
        "name": "ASOCIART S.A., TEL 11 3800-9711",
        "id": "134940000000000030"
    }
};

function analyzeReceipt(r) {
    console.log("--- ANALYZING RECEIPT ---");
    const headerAmount = r.mainAmount || r.totalAmount || 0;

    // 1. PAYMENT BREAKDOWN
    const payments = r.values || r.agreements || [];
    let ctacteAmount = 0;
    let cashAmount = 0;
    let osAmount = 0;
    let mainPaymentType = 'Contado';
    let entity = 'Particular';

    payments.forEach(p => {
        const typeId = String(p.valueType?.id);
        const typeName = (p.valueType?.name || '').toUpperCase();
        const amount = p.mainAmount || 0;

        if (typeId === '22' || typeName.includes('CTACTE') || typeName.includes('CORRIENTE')) {
            ctacteAmount += amount;
            mainPaymentType = 'Cuenta Corriente';
        } else if (typeId === '3' || typeName.includes('BILLE') || typeName.includes('EFECTIVO')) {
            cashAmount += amount;
        } else if (typeId === '2' || typeName.includes('RECE') || p.type === 'prescription') {
            osAmount += amount;
            if (p.healthInsurance?.name) entity = p.healthInsurance.name;
            else if (p.healthInsurancePlan?.name) entity = p.healthInsurancePlan.name;
        }
    });

    // If header amount is 0, we can try to re-sum from items or values
    let calculatedTotal = headerAmount;
    if (calculatedTotal === 0) {
        calculatedTotal = payments.reduce((acc, p) => acc + (p.mainAmount || 0), 0);
    }

    // 2. ITEMS SUMMARY
    const items = (r.items || []).map(it => ({
        name: it.product?.description || it.description,
        total: it.amount || it.totalAmount || 0
    }));

    return {
        id: r.id,
        invoiceNumber: r.codification,
        totalAmount: calculatedTotal,
        paymentType: mainPaymentType,
        breakdown: {
            ctacte: ctacteAmount,
            cash: cashAmount,
            os: osAmount
        },
        entity: entity,
        customer: r.customer?.name,
        itemCount: items.length
    };
}

const result = analyzeReceipt(sampleReceipt);
console.log(JSON.stringify(result, null, 2));
