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
- **Deduplicación Crítica (Zetti)**: 
  - Zetti puede devolver la misma factura varias veces en una sola consulta (típico cuando hay pagos con tarjeta).
  - **REGLA DE ORO**: Siempre deduplicar por `id` único de factura antes de cualquier cálculo.
  - **Cálculo de Totales**: NO confiar en el campo `mainAmount` de la factura raíz si hay discrepancias. La fuente de verdad definitiva es la **SUMA de items.amount** filtrada por productos reales (ignorando líneas técnicas/resumen).

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
- **Optimización de Límite Firestore**: Se redujo el tamaño del lote de escritura/lectura del Maestro de Productos de 5,000 a 1,000 para evitar errores de cuota (`Limit value is over...`) en bases de datos grandes (+80k productos).

### 6. Estrategia Futura: Limpieza Inteligente del Maestro (Product Master Purge)
- **Problema Detectado**: La base de datos maestra contiene una cantidad excesiva de productos (80,000+) en comparación con el surtido real activo de la farmacia (aprox. 2,500 productos). Esto ralentiza las búsquedas y sincronizaciones innecesariamente.
- **Objetivo**: Implementar una herramienta de "Depuración Maestra" que elimine automáticamente productos inactivos (invendibles) tras un periodo de tiempo (ej. 1 año).
- **Plan de Implementación Propuesto**:
    1.  **Marcar Actividad**: Modificar el `ZettiSync` para que, cada vez que procese una venta, actualice un campo `lastSoldDate` en el documento del producto correspondiente en Firestore.
    2.  **Análisis de "Muertos"**: Crear un script (preferiblemente una Cloud Function programada mensual) que busque productos donde `lastSoldDate` sea menor a `HOY - 365 días` (y que no tengan stock actual > 0).
    3.  **Ejecución Segura**:
        -   **Fase 1 (Soft Delete)**: Marcar productos como `status: 'ARCHIVED'`.
        -   **Fase 2 (Hard Delete)**: Eliminar definitivamente tras confirmación manual o periodo de gracia.
    4.  **Beneficio**: Reducir el tamaño de la colección en un ~95%, acelerando drásticamente todas las consultas futuras.

### 7. Solución Definitiva a Duplicaciones y Fuente Única (03 de Feb, 2026)
- **Problema**: Zetti envía facturas duplicadas (tarjetas) e ítems duplicados (resúmenes técnicos), lo que inflaba la facturación al doble o triple.
- **Acción Realizada**: **RE-ESCRITURA TOTAL** (no reparación) de la lógica de importación y KPIs.
- **Implementación**:
    - **Sincronización (`ZettiSync.tsx`)**: Ahora ignora todos los campos de total de Zetti. Recalcula el total de cada factura sumando uno a uno los productos válidos (aquellos con ID y nombre real).
    - **KPIs (`InvoiceDashboard.tsx`)**: Se implementó deduplicación por ID de factura mediante `Map` antes de cualquier cálculo.
    - **Banner de Validación**: Sincronizado para usar la misma fuente que el total visible (productos).
- **Estado Actual**: Aunque el código es matemáticamente perfecto, persiste un acumulado de **$26,015,441** en el dashboard. 
- **Hipótesis de Bloqueo**: Se sospecha que quedan datos "sucios" de sincronizaciones anteriores en la base de datos local (IndexedDB) que no fueron borrados correctamente, o que el proceso de "Borrar Datos" tiene una fuga con ciertos registros (ej. transferencias o notas de crédito mal clasificadas).

### 8. REGLAS DE ORO (FUENTES DE VERDAD)
Estas reglas son de cumplimiento OBLIGATORIO para evitar discrepancias:

1.  **REGLA 0 – FUENTE ÚNICA**: Si hay productos visibles, todo (total, validación y KPIs) debe salir de la misma fuente. Prohibido mezclar totales calculados con totales cacheados.
2.  **REGLA 1 – PRODUCTOS**: Un producto válido es un ítem con referencia real (nombre/barcode/id). Ítems técnicos o resúmenes se ignoran.
3.  **REGLA 2 – TOTAL DE FACTURA**: `TotalFactura = SUMA(productos válidos)`. No se usan campos agregados (`netAmount`, `tot`) cuando hay productos.
4.  **REGLA 3 – PAGOS**: Los pagos (Tarjeta, Efectivo, OS) solo describen CÓMO se cobró, nunca cuánto se facturó. No afectan al total.
5.  **REGLA 4 – VALIDACIÓN (BANNER)**: La validación compara la misma fuente que el total mostrado. Si el total sale de productos, la validación usa productos.
6.  **REGLA 5 – KPIs**: Antes de calcular KPIs, deduplicar facturas por ID. Una factura cuenta una sola vez.
7.  **REGLA 6 – PROHIBICIONES**: Nunca sumar items + pagos. Nunca validar contra un valor que no se muestra.
8.  **REGLA FINAL**: Lo que se ve = lo que se suma = lo que se valida.

### 9. RRHH Avanzado y Auditoría de Personal (04 de Feb, 2026)
- **AttendanceCalendar**: Se integró un calendario interactivo por empleado que cruza:
    - **Fichadas Reales** (Reloj de control).
    - **Ventas Zetti**: Detecta anomalías (vendedor vendió sin fichar o viceversa) con alertas visuales.
    - **Cómputo de Horas**: Cálculo automático de horas trabajadas y **Horas Extras** (umbral de 45hs semanales).
- **Importación Inteligente**: El motor de carga de XLS ahora es "omnipresente": escanea cada celda para vincular nombres, alias de Zetti o CUILs, permitiendo procesar archivos complejos de diferentes sucursales simultáneamente.
- **Gestión de Ausentismo**: Se añadieron formularios para cargar Licencias (Vacaciones, Médicas) y Permisos especiales por horas.

### 10. Finanzas: Lógica de Notas de Crédito (NC)
- **Problema**: El sistema trataba las NC como deuda (Debe), inflando el saldo negativo.
- **Corrección**: Se ajustó `dataHelpers.ts` y el importador de JSON. Cualquier comprobante identificado como "NC", "CRÉDITO" o "ANULACIÓN" se asigna automáticamente al **Haber**, restando de la deuda total.

### 11. Herramientas de Automatización (Python)
- **`extract_employees.py`**: Script para raspar nombres y CUILs de archivos XLS binarios antiguos para crear legajos automáticamente. Resuelve el caso de formatos mezclados (ej. "Enrique Ferrer" sin coma).
- **`process_cc_pdfs.py`**: Procesador robusto basado en **PyMuPDF** para leer reportes "Detallados" de Zetti. Maneja bloques multilínea para vincular identidad del cliente con sus movimientos financieros.

### 12. Optimización de Reportes (Impresión)
- **Fix "Página en Blanco"**: Se detectó que las animaciones de Tailwind (`animate-in`, `fade-in`) bloqueaban la captura del PDF en el navegador. Se crearon reglas `@media print` para forzar opacidad 100% y eliminar transiciones, garantizando reportes de Deuda claros y en formato A4.

---
*Última actualización: 04 de Febrero, 2026 - 12:35hs*
