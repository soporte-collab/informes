# Memoria del Proyecto: Informes de Farmacia (Biotrack)

## Contexto del Proyecto
Este proyecto tiene como objetivo centralizar y analizar datos de ventas, stock y precios de varias sucursales de farmacia integradas con el sistema **Zetti**. Permite generar informes de auditoría, sugerencias de pedidos inteligentes y visualización de datos históricos.

## Tecnologías Principales
- **Frontend**: React + Vite + TypeScript + Tailwind CSS (Diseño Premium/Dark Mode).
- **Backend**: Firebase Cloud Functions (Node.js).
- **Base de Datos**: Firestore para auditorías y configuraciones.
- **Integración**: API REST de Zetti (Oauth2) via Firestore Tunnel.

### Knowledge and Patterns
- **Golden Rules for Data**: Always prioritize manual uploads for debt (found in `DebtImporter`).
- **Mix Maestro Logic**: Aggregates from `filteredServices` (which includes Zetti expenses and manual services) plus `filteredPayroll`).
- **Zetti API Skill**: A specialized skill has been created in `.agent/skills/zetti_api/` to document the interaction with the T&SWeb API based on the `zetti_swagger.json`. It includes authentication patterns, key endpoints for searching sales and statistics, and example scripts.
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
- **Importación Inteligente**: 
    - Auto-puntuación de delimitadores (CSV, CSV-Excel) para importar cualquier formato (`handleAttendanceImport`).
    - Detección automática de Sucursal por nombre de archivo.
    - IDs únicos compuestos `empId-date-branch` para soportar múltiples marcas diarias en distintas sucursales.
- **Gestión Visual de Identidad**: Vinculación manual rápida para empleados con nombres variables ("ALONSO, SILVIA" vs "SILVIA ALONZO").
- **Reset "Zona de Peligro"**: Botón para limpiar toda la base de asistencias en caso de corrupción masiva.

### 10. Gestión Integral de Tiempo: Bitácora y Banco de Horas (04 de Feb, 2026)
- **Bitácora Interactiva**: Al hacer clic en un empleado, se abre un calendario detallado (modal) con acciones por día.
- **Herramientas de Gestión Manual**:
    - **Carga Manual (Reloj)**: Permite ingresar horas trabajadas si el empleado olvidó fichar (entrada/salida).
    - **Licencias y Permisos (Maletín)**: Carga de vacaciones, carpeta médica o permisos por horas (ej: trámite de 9 a 11).
    - **Banco de Horas (Retorno)**: Sistema de deuda/crédito.
        - **DEUDA (Rojo)**: Se cargan horas negativas cuando el empleado debe tiempo (ej: día personal).
        - **CRÉDITO (Verde)**: Se cargan horas positivas cuando el empleado devuelve el tiempo adeudado.
        - **Saldo en Vivo**: Indicador visual en la cabecera del calendario mostrando el balance total de horas (+/-).
- **Lógica de Feriados Mejorada**: Los feriados ahora **restan** del objetivo de horas mensual. Si se trabaja un feriado, cuenta 100% como extra, solucionando el problema de cálculo de objetivos.
- **Mapeo Proactivo**: Botón "Vincular Nuevo Alias" para crear relaciones de nombres antes de importar archivos, previniendo registros "Desconocidos".

### 11. Finanzas: Lógica de Notas de Crédito (NC)
- **Problema**: El sistema trataba las NC como deuda (Debe), inflando el saldo negativo.
- **Corrección**: Se ajustó `dataHelpers.ts` y el importador de JSON. Cualquier comprobante identificado como "NC", "CRÉDITO" o "ANULACIÓN" se asigna automáticamente al **Haber**, restando de la deuda total.

### 12. Herramientas de Automatización (Python)
- **`extract_employees.py`**: Script para raspar nombres y CUILs de archivos XLS binarios antiguos para crear legajos automáticamente. Resuelve el caso de formatos mezclados (ej. "Enrique Ferrer" sin coma).
- **`process_cc_pdfs.py`**: Procesador robusto basado en **PyMuPDF** para leer reportes "Detallados" de Zetti. Maneja bloques multilínea para vincular identidad del cliente con sus movimientos financieros.

### 13. Optimización de Reportes (Impresión)
- **Fix "Página en Blanco"**: Se detectó que las animaciones de Tailwind (`animate-in`, `fade-in`) bloqueaban la captura del PDF en el navegador. Se crearon reglas `@media print` para forzar opacidad 100% y eliminar transiciones, garantizando reportes de Deuda claros y en formato A4.

### 14. Mix Maestro Dashboard v2.1 y Conciliación de Gastos (05 de Feb, 2026)
- **EBITDA Dinámico (Cash-on-Hand)**: Se refinó el cálculo del EBITDA para distinguir entre facturas Pagadas e Ingresadas.
    - **Real Expense Outflow**: Solo suma registros con estado `PAGADO` (o servicios/sueldos).
    - **Pending Liabilities**: Visualiza el total de registros `INGRESADO` como deuda a corto plazo sin afectar el EBITDA actual.
- **Relación Facturación vs Compras (Offset +1d)**: Nuevo gráfico de performance que permite visualizar si las ventas del día cubren la reposición de stock (compras) proyectada para el día siguiente.
- **Simplificación de CSV de Proveedores**: 
    - Se abandonó el soporte para archivos CSV de Zetti con desglose de ítems debido a formateo inconsistente en el origen.
    - El sistema ahora se basa exclusivamente en el formato de exportación de **Encabezados (sin ítems)**, garantizando una carga rápida y precisa de importes, fechas y estados.
    - **Normalización de Estados**: Los estados de Zetti (`PAGADO`, `AGRUPADO`, `LIQUIDADO`, `INGRESADO`) se mapean automáticamente a `PAGADO` (Salida Real) o `INGRESADO` (Pasivo Pendiente).
- **Herramientas de Control**: Botón de **"Borrar Historial"** en el dashboard de gastos para permitir re-cargas limpias.

### 15. Unificación de Identidad de Vendedores (Zetti ID)
- **Problema**: Zetti registra a los usuarios de forma inconsistente (ej. "DIAME" vs "OJEDA DIAMELA MARIA").
- **Solución**: Se implementó una lógica de prioridad en la sincronización:
    1.  **Nombre Completo**: Si el objeto de usuario tiene descripción, se usa esa.
    2.  **Mapeo por ID**: Se busca el ID numérico del usuario en la base de datos de empleados local.
    3.  **Alias**: Último recurso.
- **Configuración**: En el módulo de RRHH -> Legajos, ahora se puede editar un empleado e ingresar su **Zetti User ID** (ej. `1349400030`). Esto vincula permanentemente al empleado con sus ventas, sin importar cómo Zetti envíe el nombre.

---
*Última actualización: 05 de Febrero, 2026 - 12:45hs*

### 15. Sistema de RRHH: Mejoras en Visualización y Cálculo de Horas (05 de Feb, 2026)

#### A. Formato de Horas Mejorado (HH:mm)
- **Problema Detectado**: El sistema mostraba horas en formato decimal (ej: `8.7h`), lo cual era confuso ya que parecía "8 horas y 7 minutos" cuando en realidad representaba 8.7 horas (8h 42m).
- **Solución Implementada**: 
  - Se creó la función utilitaria `formatMinutesToHM()` en `hrUtils.ts` que convierte minutos totales a formato legible "Xh Ym".
  - Se aplicó en todos los componentes de RRHH:
    - `AttendanceCalendar.tsx`: Totales de período, banco de horas, horas diarias.
    - `SchedulesDashboard.tsx`: Totales de empresa, horas extras, horas por empleado.
    - `SalesHeatmap.tsx`: Tiempo activo y horas muertas.

#### B. Cambio en Cálculo de Horas Extras (Sistema Semanal)
- **Sistema Anterior**: Base fija de 180 horas mensuales, con prorrateo según días del mes.
- **Sistema Nuevo (ACTUAL)**: **Base de 45 horas semanales**
  - Fórmula: `expectedHours = (daysInRange / 7) × 45`
  - **Ventajas**:
    - Más justo y preciso para cualquier período (no solo meses completos).
    - Se adapta automáticamente a la cantidad real de días laborables.
    - Ejemplos:
      - 7 días = 45h base
      - 14 días = 90h base
      - 31 días = 199.3h base (4.43 semanas)
      - 28 días = 180h base (4 semanas exactas)
  - Todo lo que supere esta base se considera **Horas Extras**.

#### C. Jornada Laboral por Día de Semana
- **Lunes a Viernes**: 8 horas
- **Sábado**: 4 horas
- **Domingo**: 0 horas (no laborable)

#### D. Visualización de Feriados
- **Nueva Funcionalidad**: Cuando un día está marcado como feriado, el calendario ahora muestra:
  - Tarjeta color ámbar con ícono de sol
  - Texto "FERIADO"
  - **Horas computadas** según el día de la semana (ej: "8h computadas" para un feriado que cae lunes)
- **Lógica**: Los feriados se consideran como horas trabajadas para efectos de liquidación, aunque el empleado no haya asistido.

#### E. Gestión de Registros de Asistencia
- **Edición y Eliminación**: 
  - Al pasar el mouse sobre cualquier registro de asistencia (PASEO, CHACRAS, MANUAL), aparecen iconos de:
    - **Lápiz (Editar)**: Permite modificar hora de entrada/salida
    - **Tacho (Borrar)**: Elimina el registro tras confirmación
  - Los registros marcados como "MANUAL" se destacan en color índigo para fácil identificación.

#### F. Reporte de Impresión Profesional
- **Nuevo Componente**: `AttendancePrintReport.tsx`
- **Características**:
  - Formato A4 horizontal (landscape) optimizado para impresión
  - Sin animaciones para evitar páginas en blanco
  - Incluye:
    - Resumen ejecutivo: Total horas trabajadas, total horas extras, personal consolidado
    - Tabla detallada por empleado con sucursal, horas totales, base mínima y extras
    - Espacio para firma de validación de RRHH
  - **Solución técnica**: CSS `@media print` que desactiva todas las animaciones y fuerza visibilidad completa del reporte.
  - Delay de 300ms antes de abrir el diálogo de impresión para asegurar renderizado completo.

#### G. Mejoras en UX del Calendario
- **Menú flotante refinado**: El menú de acciones (agregar fichaje, licencia, banco de horas) ahora aparece como una barra compacta en la parte inferior de cada celda, sin bloquear la visibilidad de los datos existentes.
- **Prevención de clicks accidentales**: Uso de `stopPropagation()` en botones de acción para evitar conflictos con eventos del contenedor padre.

### 16. Módulo de Obras Sociales e Integridad de Datos (06 de Feb, 2026)

#### A. Rediseño del Insurance Dashboard
- **Visualización Premium**: Se implementaron "Tarjetas de Deuda por Entidad" con código de colores según antigüedad (Verde < 30d, Ámbar > 30d, Rojo > 60d).
- **Paginación**: La tabla de detalle ahora carga 10 registros por defecto con un botón de "Mostrar Más" para optimizar el rendimiento.
- **Filtros Interactivos**: Al hacer clic en una tarjeta de entidad, se filtra automáticamente la tabla inferior.

#### B. Gestión de Datos Manuales (Clear & Import)
- **Borrado Selectivo**: Se implementó `onClearManualData` que filtra exclusivamente los registros de tipo `DEUDA_HISTORICA`.
- **Problema de Persistencia (Storage 404)**: Se detectó que al usar `clearInsuranceDB()` (que elimina el archivo físico en Firebase Storage) seguido de un `save`, hay una ventana de tiempo donde las peticiones de lectura devuelven 404, causando que el dashboard parezca vacío o no cargue tras importar.
- **Solución Propuesta**: Modificar `db.ts` para que "borrar" signifique guardar un array vacío `[]` en lugar de eliminar el objeto, evitando errores de "File Not Found" en el cliente.

#### C. Control de Inflación de Totales (Deduplicación)
- **Hallazgo**: Se detectaron inconsistencias en "Ventas Totales" y "Gastos Operativos" debido a registros duplicados (posiblemente por múltiples sincronizaciones Zetti o solapamiento de archivos CSV).
- **Herramienta de Limpieza**: Se agregó un botón **"Eliminar Duplicados de Ventas"** (icono `Blend` amarillo) en la barra lateral.
- **Lógica de Deduplicación**: Filtra la base de datos local comparando `Comprobante + Producto + Monto + Cantidad`.

#### D. Corrección en Mix Maestro (Doble Contabilidad)
- **Error Solucionado**: El dashboard sumaba `expenseData` y `serviceData` de forma independiente, pero `serviceData` ya contenía una copia de los gastos.
- **Corrección**: Se unificó la iteración en `MixMaestroDashboard.tsx` para procesar una sola fuente de egresos, clasificando por estado (`PAGADO` vs `INGRESADO`).

### 17. Estado de Bloqueo Actual y Reversión
- **Situación**: Tras múltiples intentos de corregir duplicados y flujos de importación manual, el sistema entró en un estado de inconsistencia (datos duplicados persistentes y errores de carga).
- **Decisión**: Se procede a realizar un **Git Revert / Pull** desde el backup conocido para estabilizar la rama principal antes de re-aplicar las correcciones de lógica financiera de forma controlada.

### 18. Integración Zetti v3.21 y Mapeo de Entidades (06 de Feb, 2026)
- **Investigación de Proveedores de Gasto**: Se descubrió que para cargar facturas de servicios (Luz, Gas, etc.) vía API v3.21, es CRÍTICO usar el `idEntityType` correcto en las búsquedas genéricas (`/v2/{idNode}/entities/search`).
- **Mapeo de Categorías Decodificado**:
    - **Tipo 1**: Clientes y Entidades (Sheila, YPF).
    - **Tipo 2**: Proveedores de Mercadería / Droguerías (Del Sud, Monroe, Biolatina SRL).
    - **Tipo 10**: Laboratorios (Abbott, Bayer).
    - **Tipo 27**: Proveedores de Servicios / Gastos Operativos (Akro Medica, Andreani, Adroelectric).
    - **Tipo 29**: Entes Recaudadores y AFIP (AFIP, a veces EDEMSA).
- **Error 400 (Bad Request)**: Zetti devuelve este error si se intenta buscar una entidad sin especificar el `idEntityType`.

### 19. Auditoría de Proveedores vía Libro de IVA
- **Descubrimiento**: Muchos "gastos" que no aparecen en las búsquedas de ventas residen en el **Libro de IVA Compras**.
- **Endpoint**: `POST /api-rest/{idNodo}/receipts-iva-book-purchases/search`.
- **Dato Curioso**: Este endpoint usa formato de fecha `dd/MM/yyyy` (a diferencia del ISO usual de v2).
- **Caso Biolatina**: 
    - Se identificó que Biolatina opera como **Tipo 2 (Droguería)**.
    - Su actividad principal en 2026 se concentra en el nodo de **Palmares (2378041)**, con movimientos por +$1.5M.
    - En **Chacras Park (2406943)** solo se registró un movimiento de $80,223 el 04/02/2026.

---
*Última actualización: 06 de Febrero, 2026 - 15:30hs (v3.21 Decoded)*
