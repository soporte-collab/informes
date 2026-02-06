/**
 * Ejemplo de script para probar la conexión con la API de Zetti
 * Uso local vía Node.js
 */

async function testZettiSearch(token, nodeId) {
    const url = `https://api.test-zetti.com.ar/api-rest/v2/${nodeId}/sales-receipts/search?include_items=true&per_page=5`;

    // Rango de fechas para hoy
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const body = {
        emissionDateFrom: yesterday.toISOString().replace('Z', '-03:00'),
        emissionDateTo: today.toISOString().replace('Z', '-03:00')
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        console.log('Resultados encontrados:', data.length);
        console.dir(data, { depth: null });
    } catch (error) {
        console.error('Error en la petición:', error.message);
    }
}

// Ejemplo de llamada:
// testZettiSearch('TU_TOKEN_AQUI', '2378041');
