# Guía de Integración Zetti API via Firestore Tunnel

Este documento describe la arquitectura de "Túnel Firestore" implementada para BioTrack para permitir la comunicación segura y sin problemas de CORS con la API de Zetti/TYS desde un frontend alojado en HTTPS.

## 1. Arquitectura del Sistema

Debido a que la API de Zetti solo soporta HTTP (no seguro) y carece de políticas de CORS, se implementó un proxy basado en eventos de Firestore:

1.  **Frontend (Vite/React)**: Crea un documento en la colección `zetti_queries` con los parámetros de búsqueda.
2.  **Firestore**: Actúa como bus de datos en tiempo real.
3.  **Firebase Function (`zetti_tunnel_v4`)**: Se activa ante cada nuevo documento en `zetti_queries`, realiza la petición física a la API de Zetti y escribe el resultado en la colección `zetti_responses`.
4.  **Frontend**: Escucha en tiempo real (vía `onSnapshot`) el documento de respuesta correspondiente.

## 2. Flujo de Autenticación Zetti

La API utiliza OAuth2 con `grant_type=password`. Es fundamental el envío de credenciales básicas en los headers además de los parámetros en el cuerpo.

*   **Auth URL**: `http://190.15.199.103:8089/oauth-server/oauth/token`
*   **Headers**: `Authorization: Basic <base64(clientId:clientSecret)>`
*   **Body (URLSearchParams)**: 
    *   `grant_type`: `password`
    *   `username`: `biotrack`
    *   `password`: `SRwdDVgLQT1i`

## 3. Consultas de Stock Multi-Nodo

Para obtener el stock de múltiples sucursales en una sola llamada y evitar errores de permisos, se debe usar el **ID de la Entidad Concentradora** en la URL.

*   **Endpoint**: `/api-rest/2378039/products/details-per-nodes`
*   **Body (JSON)**:
    ```json
    {
      "idsNodos": [2378041, 2406943],
      "idsProductos": [123456]
    }
    ```
*   **Nota**: El ID en la URL (`2378039`) permite consultar cualquier nodo bajo esa entidad. Usar un ID de nodo individual en la URL restringirá la búsqueda a solo ese nodo, dando Error 400 si se incluyen otros en el cuerpo.

## 4. Estrategia Anti-Caché y Sincronización

Para evitar que el usuario vea datos de productos consultados anteriormente o respuestas "colgadas":

1.  **QueryId Único**: Cada consulta genera un ID único basado en `timestamp + random`.
2.  **Validación de Timestamp**: Tanto la consulta como la respuesta incluyen un `serverTimestamp`. El frontend ignora cualquier respuesta cuyo timestamp sea inferior al momento en que inició la búsqueda actual.
3.  **Limpieza Automática**: Al recibir la respuesta exitosa o por timeout, se eliminan los documentos de `queries` y `responses` para mantener Firestore limpio.

## 5. Requerimientos de Firestore

### Colecciones
*   `zetti_queries`: Documentos con `barcode`, `productId`, `nodeId`, `timestamp`.
*   `zetti_responses`: Documentos con `status`, `data`, `timestamp`, `message`.

### Reglas de Seguridad (`firestore.rules`)
```javascript
match /zetti_queries/{queryId} {
  allow read, write: if true; // El frontend escribe, la función lee/borra
}
match /zetti_responses/{responseId} {
  allow read, write: if true; // La función escribe, el frontend lee/borra
}
```

## 6. Mapeo de Nodos (BioTrack)
*   **Entidad Core**: `2378039`
*   **Sucursal Paseo Stare**: `2378041`
*   **Sucursal Chacras Park**: `2406943`

---
**BioTrack Integration Guide** - Diciembre 2025
