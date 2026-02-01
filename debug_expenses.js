const axios = require('axios');

async function debugExpenses() {
    const nodeId = '2378041'; // BIOSALUD
    const url = `https://api.zettisistemas.com.ar/v2/${nodeId}/providers/receipts/search`;

    // Auth token needed - I'll simulate a request via the tunnel or check logs
    // Actually, I can use the existing debug_request.js logic
}
