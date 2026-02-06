---
name: zetti_api
description: Guía de interacción con la API de Zetti para BioSalud Analytics, actualizada a v3.21.0. Incluye hallazgos de investigación sobre deuda de clientes.
---

# Zetti API Interaction Skill

Esta skill define cómo interactuar con los servicios de Zetti para BioSalud Analytics, basándose en la versión **3.21.0** del swagger.

## Reglas de Oro
1. **Validación Experimental**: Antes de dar por sentado un endpoint, realiza una consulta via script para validar los campos reales que devuelve el servidor.
2. **Actualización Continua**: Si una respuesta de la API difiere de lo documentado o se descubre un patrón nuevo (ej. estados de deuda), **debes actualizar esta skill inmediatamente** para que otros agentes no repitan el error.
3. **Formato de Fechas**: Zetti requiere rigurosamente el formato ISO con offset: `yyyy-MM-dd'T'HH:mm:ss.SSS-03:00`.
4. **IdNode vs IdEntity**: Los reportes generales suelen pedir `idNode` (sucursal), pero las transacciones específicas pueden requerir `idEntity` (el ID interno de la empresa o cliente).

## Módulo: Cuentas Corrientes (Deuda Cliente)
Nuestro objetivo es automatizar la validación de deuda real en Zetti para cuentas corrientes cargadas en el sistema.

### 1. Localización del Cliente / Proveedor
Zetti requiere el `idEntityType` correcto para encontrar la entidad. Si usas el tipo equivocado, la búsqueda daría vacío o error 400.
*   **idEntityType: 1** -> **Clientes / Entidades** (Ej: Sheila Brahim, YPF).
*   **idEntityType: 2** -> **Droguerías / Proveedores de Mercadería** (Ej: Del Sud, Monroe, Biolatina SRL ID `134940000000000037`).
*   **idEntityType: 10** -> **Laboratorios** (Ej: Abbott, Bago).
*   **idEntityType: 22** -> **Agrupadores** (Ej: Biolatina ID `134940000000000058`).
*   **idEntityType: 27** -> **Proveedores de Servicio / Gastos** (Ej: AKRO Medica, Andreani, Adroelectric).
*   **idEntityType: 29** -> **AFIP / Entes Recaudadores** (Ej: AFIP, a veces EDEMSA).
*   **Búsqueda por Código (DNI/CUIT)**: Usa `/v2/{idNode}/entities/search` con el tipo correspondiente y `filterText`.

### 2. Consulta de Comprobantes Pendientes (Ventas)
Para saber qué debe un cliente, consultamos los comprobantes en estado "Ingresado".
*   **Endpoint**: `POST /v2/{idNode}/sales-receipts/search`
*   **Payload Recomendado**:
```json
{
  "idEntity": 134940000000000309,
  "status": ["INGR"],
  "idValueType": 22,
  "emissionDateFrom": "2024-01-01T00:00:00.000-03:00",
  "emissionDateTo": "2026-12-31T23:59:59.000-03:00"
}
```

## Módulo: Libro de IVA Compras (Proveedores de Mercadería)
Para auditar pagos a droguerías o grandes proveedores (como Biolatina), se usa el libro de IVA.

### 1. Consulta de Comprobantes de Compra
*   **Endpoint**: `POST /api-rest/{idNodo}/receipts-iva-book-purchases/search`
*   **Formato de Fecha**: ¡Cuidado! Este endpoint usa `dd/MM/yyyy`.
*   **Payload**:
```json
{
  "fechaEmisionDesde": "01/02/2026",
  "fechaEmisionHasta": "06/02/2026"
}
```
*   **Campos Clave**:
    *   `importe`: Monto total.
    *   `tipoValor`: Tipo de comprobante (ej: `FAPRP` es Factura POS).
    *   `entidad`: Objeto con `id` y `nombre`.

## Módulo: Gastos y Servicios (Nuevo v3.21)
Permite automatizar la carga de comprobantes de gastos externos (archivo CSV).

### 1. Búsqueda de Emisores (Proveedores)
*   **Endpoint**: `POST /v2/{idNode}/document-issuers/by-profile/{profile}/search`
*   **Profile**: `SERVICES_INVOICE` o `EXPENSES_INVOICE`.

### 2. Grabación de Comprobantes
*   **Servicios**: `POST /v2/{nodeId}/service-invoices`
*   **Gastos**: `POST /v2/{idNode}/expense-invoices`
*   **Estructura (Array)**:
```json
[
  {
    "codification": "0055-55555",
    "letter": "A",
    "issuedDate": "2025-10-08T00:00:00.000-0300",
    "issuerId": 304604,
    "amount": 50000.0,
    "concepts": [
      { "conceptValueSubtype": { "id": 347 }, "amount": 50000.0 }
    ]
  }
]
```

## Scripts de Utilidad
En `.agent/skills/zetti_api/scripts/` encontrarás:
*   `research_debt.js`: Script multi-propósito para buscar entidades, comprobantes y validar estados de deuda. Úsalo para "mirar" antes de integrar.

---
*Manual actualizado el 2026-02-06 en base a la API 3.21 y resultados de búsqueda reales.*
