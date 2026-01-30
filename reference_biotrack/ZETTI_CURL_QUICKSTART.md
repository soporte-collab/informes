# Guía Rápida de cURL - Integración Zetti

Copia y pega estos comandos en tu otra sesión de Antigravity para que sepa exactamente cómo interactuar con la API.

### 1. Obtener Token de Acceso (OAuth2)
Este token es necesario para todas las llamadas siguientes. Dura aproximadamente 1 hora.

```bash
curl --location --request POST 'http://190.15.199.103:8089/oauth-server/oauth/token' \
--header 'Authorization: Basic YmlvdHJhY2s6U1J3ZERWZ0xRVDFp' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'grant_type=password' \
--data-urlencode 'username=biotrack' \
--data-urlencode 'password=SRwdDVgLQT1i'
```
*(Nota: El header Basic ya tiene codificado `biotrack:SRwdDVgLQT1i`)*

---

### 2. Buscar Producto por Código de Barras (Para obtener el ID)
Usa este comando cuando solo tienes el código de barras. Te devolverá el `id` numérico necesario para el stock.

```bash
curl --location --request POST 'http://190.15.199.103:8089/api-rest/v2/2378041/products/search?include_groups=true' \
--header 'Authorization: Bearer <TU_TOKEN_AQUÍ>' \
--header 'Content-Type: application/json' \
--data-raw '{
    "barCodes": ["7793640215523"]
}'
```

---

### 3. Obtener Stock Multi-Nodo (La "Query" de Stock)
Este es el comando clave. Devuelve un **Array directo** con el stock de las sucursales Paseo Stare y Chacras Park.

```bash
curl --location --request POST 'http://190.15.199.103:8089/api-rest/2378039/products/details-per-nodes' \
--header 'Authorization: Bearer <TU_TOKEN_AQUÍ>' \
--header 'Content-Type: application/json' \
--data-raw '{
    "idsNodos": [2378041, 2406943],
    "idsProductos": [678940]
}'
```

### Detalles Técnicos Importantes:
- **Entidad Concentradora:** Usamos `2378039` en la URL de stock para tener permisos globales.
- **Formato de Respuesta:** Es un `JSON Array` nativo. No busques la propiedad `.content`, no existe en este endpoint.
- **IDs de Sucursales:** 
  - `2378041`: Paseo Stare
  - `2406943`: Chacras Park
