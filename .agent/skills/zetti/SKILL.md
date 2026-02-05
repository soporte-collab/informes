# Skill: Zetti API Integration

Esta skill contiene el conocimiento destilado sobre la integración con Zetti (T&SWeb API) para evitar búsquedas redundantes en el Swagger y documentación técnica.

## Configuración de Nodos (Branches)
- **ID Nodo Concentrador:** `2378039`
- **FCIA BIOSALUD:** `2378041` (Código jerárquico: `000.004.015.001.001`)
- **CHACRAS PARK:** `2406943` (Código jerárquico: `2406943`)

## Endpoints Críticos (V2)

### Clientes (Customers)
`POST /v2/{idNode}/customers/search`
- **Body:** `CustomerRequestDTO` (`filterText`, `documentNumbers`, `cuits`)
- **Respuesta:** Array de `CustomerDTO`
- **Permiso:** `FTWEB_LISTAR_CLIENTES`

### Comprobantes de Venta (Sales Receipts)
`POST /api-rest/v2/{idNode}/sales-receipts/search`
- **Body:** `{ emissionDateFrom, emissionDateTo, idEntity, ... }`
- **Formato Fecha:** `yyyy-MM-dd'T'HH:mm:ss.SSSX` (Ej: `2026-02-05T00:00:00.000Z`)

### Estadísticas y Stock
`GET /v1/{idNode}/statistics-by-node?idsProduct=...`
- Usado para calcular **Venta Media Diaria (VMD)** y stock en tiempo real.

## Formatos y Reglas de Negocio
- **Cuit/CUIL:** Siempre limpiar strings para comparaciones (`replace(/[^0-9]/g, '')`).
- **IVA:** Situaciones comunes (1=Resp. Insc., 3=Consumidor Final, 4=Exento).
- **Créditos:** Las Notas de Crédito (NC) deben visualizarse como auditoría, no solo netearse.

## Troubleshooting Común
- **CORS:** Las llamadas al túnel de Firebase deben incluir el header de autenticación correcto.
- **Fechas:** Si el API retorna 400 en fechas, verificar que incluyan el milisegundo y el indicador de zona horaria `X`.
