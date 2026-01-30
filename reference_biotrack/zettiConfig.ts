/**
 * Configuración de la API de Zetti
 * Permite cambiar fácilmente entre servidor demo y producción
 */

export interface ZettiConfig {
    apiBaseUrl: string;
    clientId: string;
    clientSecret: string;
    username: string;
    userPassword: string; // Contraseña del usuario (puede ser igual o diferente a clientSecret)
    nodeId: number;
    entityId?: number; // ID de la entidad concentradora para consultas multi-nodo
}

// Configuraciones predefinidas
export const ZETTI_DEMO_CONFIG: ZettiConfig = {
    apiBaseUrl: 'https://demo.zetti.com.ar/api-rest',
    clientId: 'biotrack',
    clientSecret: 'SRwdDVgLQT1i',
    username: 'biotrack',
    userPassword: 'SRwdDVgLQT1i', // Mismo que client_secret por defecto
    nodeId: 1964584
};

export const ZETTI_PRODUCTION_CONFIG: ZettiConfig = {
    apiBaseUrl: 'http://192.168.50.200:8080/api-rest', // ✅ Confirmado desde servidor (red local)
    clientId: 'biotrack',
    clientSecret: 'SRwdDVgLQT1i', // ✅ Credenciales de API Client
    username: 'biotrack',
    userPassword: 'SRwdDVgLQT1i', // ✅ Mismo que client_secret según Swagger
    nodeId: 2378041 // ✅ ID de FCIA BIOSALUD en servidor de producción
};

// Configuración alternativa usando URL externa (accesible desde cualquier red)
export const ZETTI_PRODUCTION_EXTERNAL_CONFIG: ZettiConfig = {
    apiBaseUrl: 'http://190.15.199.103:8089/api-rest', // ✅ URL externa verificada
    clientId: 'biotrack',
    clientSecret: 'SRwdDVgLQT1i', // ✅ Credenciales de API Client
    username: 'biotrack',
    userPassword: 'SRwdDVgLQT1i', // ✅ CONFIRMADO: Mismo que client_secret (usuario habilitado 22/12/2024)
    nodeId: 2378041, // ✅ ID de FCIA BIOSALUD en servidor de producción
    entityId: 2378039 // ✅ ID de entidad concentradora para consultas multi-nodo
};

// Configuración para Farmacia CHACRAS PARK
export const ZETTI_CHACRAS_PARK_CONFIG: ZettiConfig = {
    apiBaseUrl: 'http://190.15.199.103:8089/api-rest', // ✅ URL externa
    clientId: 'biotrack',
    clientSecret: 'SRwdDVgLQT1i',
    username: 'biotrack',
    userPassword: 'SRwdDVgLQT1i', // ✅ CONFIRMADO: Mismo que client_secret
    nodeId: 2406943, // ✅ ID de FCIA CHACRAS PARK en servidor de producción
    entityId: 2378039 // ✅ ID de entidad concentradora
};

// 🔄 Configuración activa (cambiar según el entorno)
// Opciones: ZETTI_DEMO_CONFIG, ZETTI_PRODUCTION_CONFIG, ZETTI_PRODUCTION_EXTERNAL_CONFIG, ZETTI_CHACRAS_PARK_CONFIG
export const ACTIVE_CONFIG = ZETTI_PRODUCTION_EXTERNAL_CONFIG; // ✅ URL externa confirmada 22/12/2024

// Helper para construir URL completa
export function getApiUrl(endpoint: string): string {
    return `${ACTIVE_CONFIG.apiBaseUrl}${endpoint}`;
}
