# Memoria del Proyecto: Informes de Farmacia (Biotrack)

## Contexto del Proyecto
Este proyecto tiene como objetivo centralizar y analizar datos de ventas, stock y precios de varias sucursales de farmacia integradas con el sistema **Zetti**. Permite generar informes de auditoría, sugerencias de pedidos inteligentes y visualización de datos históricos.

## Tecnologías Principales
- **Frontend**: React + Vite + TypeScript + Tailwind CSS (Diseño Premium/Dark Mode).
- **Backend**: Firebase Cloud Functions (Node.js).
- **Base de Datos**: Firestore para auditorías y configuraciones.
- **Integración**: API REST de Zetti (Oauth2) via Firestore Tunnel.
- **Control de Versiones**: Git (GitHub repo: `soporte-collab/informes`).

## Arquitectura Detallada de Integración Zetti (Túnel Firestore)

### El Problema Técnico Solucionado
La API de Zetti reside en un servidor HTTP (`http://190.15.199.103:8089`) y no soporta CORS. Como nuestro Frontend es HTTPS, el navegador bloquea cualquier conexión directa.

### La Solución: El Túnel
1. **Frontend**: Genera un `queryId` único y escribe en `zetti_queries`.
2. **Firebase Function (`zetti_tunnel_v4` o similar)**: 
   - Se activa por disparador de Firestore.
   - Tiene permisos para saltarse el CORS y conectar a HTTP.
   - Ejecuta la petición vía `axios`.
3. **Escritura de Respuesta**: La función escribe en `zetti_responses/{queryId}`.
4. **Limpieza**: El sistema borra los documentos tras ser leídos para optimizar costos de Firestore.

### Detalles de Autenticación (OAuth2)
- **Grant Type**: `password`
- **Credenciales del Cliente (Basic Auth)**: `biotrack:SRwdDVgLQT1i`
- **Credenciales del Usuario (Body)**: `username: biotrack`, `password: SRwdDVgLQT1i`
- **URL de Token**: `http://190.15.199.103:8089/oauth-server/oauth/token`

### Endpoints Críticos y Trucos
- **Búsqueda**: `/api-rest/v2/{nodeId}/products/search?term=TEXTO` (POST con filtro de status).
- **Stock Multisede (Truco VITAL)**: 
  - Para consultar stock de varias farmacias a la vez, se DEBE usar el ID de la entidad concentradora (**2378039**) en la URL.
  - Endpoint: `/api-rest/2378039/products/details-per-nodes`.
  - Si usas el ID de una sucursal única en la URL pero pides varios nodos en el JSON del body, Zetti devolverá Error 400.

### Manejo de Datos de Negocio
- **Venta Media Diaria (VMD)**: Se calcula consultando estadísticas históricas.
- **IDs de Sucursales**: 2378041 (Paseo Stare), 2406943 (Chacras Park).

## Sincronización Oficina <-> Casa (Git Workflow)

### Al terminar en un lugar (Oficina o Casa):
1. Abrir terminal y guardar cambios:
   ```powershell
   git add .
   git commit -m "Descripción de los cambios realizados"
   git push
   ```

### Al llegar al otro lugar:
1. Abrir la terminal en la carpeta del proyecto.
2. Descargar los cambios más recientes:
   ```powershell
   git pull
   ```
   *Nota: Si es la primera vez en esa PC, primero haz `git clone https://github.com/soporte-collab/informes.git`.*

## Puntos Clave del Análisis
1. **Sugerencia de Pedidos**: Basada en la Venta Media Diaria (VMD) y stock actual obtenido en tiempo real de Zetti.
2. **Auditoría de Precios**: Comparativa entre Biosalud y competidores, detectando oportunidades donde el precio es >15% más barato.
3. **Manejo de Sucursales (Nodos)**: Se utilizan IDs de nodos específicos (ej. 2378041, 2406943) para filtrar datos por farmacia o usar el concentrador (2378039).

## Historial Reciente (Enero 2026)
- Se configuró el repositorio Git para permitir trabajo remoto.
- Se depuraron los endpoints de Zetti para búsqueda de productos y stock multi-nodo.
- Se implementó la visualización de "faltas" y productos sin código de barras en el módulo de auditoría.
- Se optimizó el Dashboard para mostrar métricas clave de ventas de Enero.

---
*Última actualización: 30 de Enero, 2026*
