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

## Historial Reciente (Febrero 2026) -> Integración de Gastos y Mix Maestro v2.0

### 1. Gestión de Gastos y Servicios (YPF, Edemsa, Alquileres)
- **Desafío**: La API de Zetti (`SEARCH_PROVIDER_RECEIPTS`) solo devuelve facturas de proveedores de mercadería (stock), dejando fuera gastos operativos y servicios públicos.
- **Investigación**: Se intentó buscar en endpoints como `/cashier-sessions`, `/accounting/journal-records` y `/value-type/payments`. Se concluyó que estos gastos probablemente residen en un nodo de Administración/Concentrador o se manejan como asientos contables puros que la integración actual no captura.
- **Solución Implementada**: **Carga Manual via CSV**.
  - Se reactivó la funcionalidad de importar CSV en la pestaña "Gastos / Servicios".
  - **Parser Habilitado**: `PapaParse` procesa el archivo CSV (ej: `GASTOS EXTERNOS.CSV`) mapeando columnas clave (`Entidad`, `Monto`, `FechaEmision`).
  - **Visualización**: Los registros importados se marcan internamente como `source: 'manual_csv'` y se muestran inmediatamente en el dashboard, incluso sin categorización previa.

### 2. Mix Maestro v2.0 (Corrección Crítica)
- **Problema**: El dashboard sumaba erróneamente `Total Gastos` + `Total Servicios`, causando duplicación de montos cuando un mismo registro existía en ambas vistas (por la carga híbrida API + Manual).
- **Corrección**: Se implementó una lógica de deduplicación basada en `Map<ID, Record>`.
  - Ahora `Gastos Operativos` = Unification(Gastos API, Servicios Manuales) por ID único.
  - Esto garantiza que el cálculo del **EBITDA** y la **Ganancia Operativa** sean matemáticamente correctos.

### 3. Flujo de Trabajo Actualizado (Workflow)
**Para agregar Gastos de Servicios (Luz, Gas, etc.):**
1. **En Zetti**: Generar el informe de "Gastos Externos" o "Liquidaciones" y exportarlo a `.csv` o `.txt`.
2. **En la App**:
   - Ir a la pestaña **Gastos / Servicios**.
   - Clic en el botón **"Importar CSV"**.
   - Seleccionar el archivo.
3. **Resultado**: Los gastos se visualizarán al instante y se impactarán en el cálculo de ganancias de Mix Maestro.

### Historial Previo (Enero 2026)
- Se configuró el repositorio Git para permitir trabajo remoto.
- Se depuraron los endpoints de Zetti para búsqueda de productos y stock multi-nodo.
- Se implementó la visualización de "faltas" y productos sin código de barras en el módulo de auditoría.
- Se optimizó el Dashboard para mostrar métricas clave de ventas de Enero.

### 4. Cuentas Corrientes y Deuda (Febrero 2026)
- **ID de Valor 22**: `CUENTA CORRIENTE` (CTACTE). Es la forma de pago principal para generar deuda.
- **ID de Valor 21**: `CUOTA DE CUENTA CORRIENTE` (CCTACTE).
- **ID del Cliente (Sheila Brahim)**: `134940000000000309`.
- **Estado 'INGR' (ID 4)**: Significa "Ingresado" (pendiente de cobro).
- **Hallazgo API**: Se intentó buscar deuda vía `sales-receipts/search` filtrando por `idValueType: 22`, pero el endpoint devuelve 0 resultados. Esto sugiere que las Facturas de Venta (ID 197) se registran inicialmente con su propio ID, y la "Cuenta Corriente" es un *valor de pago* relacionado que vive en otro endpoint de Tesorería aún no identificado positivamente en V2.
- **Estado Actual**: Se pausó la investigación de la API para priorizar la vuelta a la **Carga por CSV** en el dashboard de Cuentas Corrientes.

### 5. Sueldos, RRHH y Sincronización (03 de Febrero, 2026)
- **Payroll (Sueldos & RRHH)**: Se reconstruyó el componente `PayrollDashboard.tsx` para corregir errores de anidamiento JSX que impedían su renderizado. Se implementaron tres sub-pestañas: **Legajos** (personal), **Fichadas** (asistencia via XLS) y **Eficiencia** (KPIs de venta).
- **Mejoras en el Túnel Zetti**:
  - **Detección de Montos**: Se ajustó la lógica en `functions/index.js` para capturar montos desde múltiples campos posibles (`totalAmount`, `mainAmount`, `amount`, `netAmount`) tanto en facturas como en ítems.
  - **Corrección de Paginación**: Se arregló un bug crítico donde una variable indefinida (`pageContent`) cortaba la sincronización prematuramente después de la primera página.
- **Robustez de Datos**: Se integró `parseCurrency` en el proceso de guardado para limpiar strings con comas decimales (formato AR) y asegurar que las métricas del dashboard operen con números reales.

## Pendientes / Próximos Pasos
1. **Investigar "Ventas Totales $0"**: A pesar de las mejoras, algunos reportes muestran transacciones pero monto total 0. Posiblemente por datos cacheados incorrectos o campos inconsistentes en el objeto `items` de Zetti. 
2. **Purga y Re-sync**: Se recomienda al usuario purgar las fechas conflictivas (01/02 al 03/02) y volver a sincronizar para validar el fix de montos.
3. **KPIs de Eficiencia**: Desarrollar la lógica de ventas por hora/empleado cruzando Fichadas con Ventas Zetti.

---
*Última actualización: 03 de Febrero, 2026*
