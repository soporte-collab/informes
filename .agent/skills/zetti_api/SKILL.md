---
name: zetti_api
description: Guía completa de integración con Zetti API v3.21.0 para sistema integral de gestión (ventas, clientes, proveedores, compras, gastos, cuentas corrientes).
---

# Zetti API v3.21 - Guía Completa de Integración

**Versión**: 3.21.0  
**Última actualización**: 06/02/2026  
**Estado**: Sistema Integral Completo

---

## 📋 ÍNDICE

1. [Reglas de Oro](#reglas-de-oro)
2. [Autenticación](#autenticación)
3. [Ventas (Sales Receipts)](#ventas-sales-receipts)
4. [Clientes (Customers)](#clientes-customers)
5. [Proveedores (Providers)](#proveedores-providers)
6. [Compras (Libro IVA)](#compras-libro-iva)
7. [Gastos y Servicios](#gastos-y-servicios)
8. [Cuentas Corrientes](#cuentas-corrientes)
9. [Formas de Pago](#formas-de-pago)
10. [Obras Sociales](#obras-sociales)
11. [Scripts de Utilidad](#scripts-de-utilidad)

---

## 🎯 REGLAS DE ORO

1. **Validación Experimental**: Antes de dar por sentado un endpoint, realiza una consulta via script para validar los campos reales.
2. **Actualización Continua**: Si una respuesta difiere de lo documentado, **actualiza esta skill inmediatamente**.
3. **Formato de Fechas ISO**: `yyyy-MM-dd'T'HH:mm:ss.SSS-03:00` (excepto Libro IVA que usa `dd/MM/yyyy`)
4. **IdNode vs IdEntity**: 
   - `idNode`: Sucursal (2378041=Palmares, 2406943=Chacras Park)
   - `idEntity`: ID de cliente/proveedor/entidad
5. **Parámetros Query**: Usa `?include_items=true&include_agreements=true&include_concepts=true` para datos completos

---

## 🔐 AUTENTICACIÓN

### OAuth2 Token
```javascript
const tokenUrl = 'http://190.15.199.103:8089/oauth-server/oauth/token';
const credentials = btoa('biotrack:SRwdDVgLQT1i');
const params = new URLSearchParams();
params.append('grant_type', 'password');
params.append('username', 'biotrack');
params.append('password', 'SRwdDVgLQT1i');

const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
});
const data = await response.json();
const token = data.access_token;
```

---

## 💰 VENTAS (Sales Receipts)

### Endpoint Principal
```
POST /v2/{idNode}/sales-receipts/search?include_items=true&include_agreements=true&include_concepts=true&per_page=100
```

### Request Body
```json
{
  "emissionDateFrom": "2026-02-01T00:00:00.000-03:00",
  "emissionDateTo": "2026-02-28T23:59:59.999-03:00"
}
```

### Response Structure
```json
{
  "id": "134940000000272688",
  "codification": "0001-00072564",
  "emissionDate": "2026-02-02T09:38:04.119-0300",
  "mainAmount": 17550,
  "letter": "B",
  "status": {
    "name": "INGR",
    "description": "INGRESADO"
  },
  "creationNode": {
    "id": "2378041",
    "name": "FCIA BIOSALUD"
  },
  "creationUser": {
    "id": "1349400002",
    "description": "DIBLASI FLAVIA"
  },
  "customer": {
    "id": "134940000000000494",
    "name": "GIMENEZ , MARÍA GABRIELA",
    "documentNumber": "20424126",
    "documentType": "DNI",
    "vatSituation": {
      "name": "CONS.FINAL"
    }
  },
  "items": [{
    "product": {
      "id": "663929",
      "name": "DICLOGESIC PLUS B12 COMP X 20"
    },
    "quantity": 1,
    "unitPrice": 19500,
    "discount": 0,
    "amount": 17550
  }],
  "agreements": [{
    "type": "cash",
    "valueType": {
      "name": "BILLE",
      "description": "BILLETE"
    },
    "mainAmount": 0,
    "effective": {
      "name": "EFECTIVO"
    }
  }],
  "concepts": [{
    "name": "TOTAL BRUTO NO GRAVADO",
    "amount": 19500
  }]
}
```

### Campos Clave
- `customer`: **NUEVO** - Datos completos del cliente
- `items`: Productos vendidos
- `agreements`: **NUEVO** - Formas de pago detalladas
- `concepts`: **NUEVO** - Conceptos contables
- `status.name`: Estado (INGR/PAGADO)

---

## 👥 CLIENTES (Customers)

### Extracción desde Sales Receipts
Los clientes vienen en el campo `customer` de cada factura.

### Estructura
```json
{
  "id": "134940000000000494",
  "code": "20424126",
  "name": "GIMENEZ , MARÍA GABRIELA",
  "documentType": "DNI",
  "documentNumber": "20424126",
  "cuit": "",
  "email": "",
  "vatSituation": {
    "id": "3",
    "name": "CONS.FINAL",
    "description": "CONSUMIDOR FINAL"
  }
}
```

### Búsqueda Directa
```
POST /v2/{idNode}/entities/search
```
```json
{
  "filterText": "GIMENEZ",
  "idEntityType": 1
}
```

---

## 🏭 PROVEEDORES (Providers)

### Entity Types (idEntityType)
- **1**: Clientes / Entidades
- **2**: Droguerías / Proveedores de Mercadería
- **10**: Laboratorios
- **22**: Agrupadores
- **27**: Proveedores de Servicio / Gastos
- **29**: AFIP / Entes Recaudadores

### Búsqueda de Proveedores
```
POST /v2/{idNode}/entities/search
```
```json
{
  "filterText": "BIOLATINA",
  "idEntityType": 2
}
```

### Ejemplo: Biolatina
- **Biolatina SRL** (Droguería): `idEntityType: 2`, ID: `134940000000000037`
- **Biolatina** (Agrupador): `idEntityType: 22`, ID: `134940000000000058`

---

## 📦 COMPRAS (Libro IVA)

### Endpoint
```
POST /api-rest/{idNode}/receipts-iva-book-purchases/search
```

### ⚠️ FORMATO DE FECHA ESPECIAL
Este endpoint usa `dd/MM/yyyy` (NO ISO)

### Request Body
```json
{
  "fechaEmisionDesde": "01/02/2026",
  "fechaEmisionHasta": "28/02/2026"
}
```

### Response Structure
```json
{
  "id": "...",
  "importe": 80223,
  "tipoValor": "FAPRP",
  "subtipo": "A",
  "fechaEmision": "04/02/2026",
  "entidad": {
    "id": "134940000000000037",
    "nombre": "BIOLATINA SRL"
  },
  "periodo": {
    "descripcion": "02/2026"
  },
  "estado": "PAGADO"
}
```

### Campos Clave
- `importe`: Monto total
- `tipoValor`: Tipo de comprobante (FAPRP = Factura POS)
- `entidad`: Proveedor
- `estado`: PAGADO / INGRESADO

---

## 💸 GASTOS Y SERVICIOS

### 1. Búsqueda de Emisores
```
POST /v2/{idNode}/document-issuers/by-profile/{profile}/search
```
**Profiles**:
- `SERVICES_INVOICE`
- `EXPENSES_INVOICE`

### 2. Crear Factura de Servicio
```
POST /v2/{nodeId}/service-invoices
```
```json
[{
  "codification": "0055-55555",
  "letter": "A",
  "issuedDate": "2025-10-08T00:00:00.000-0300",
  "issuerId": 304604,
  "amount": 50000.0,
  "concepts": [{
    "conceptValueSubtype": { "id": 347 },
    "amount": 50000.0
  }]
}]
```

### 3. Crear Factura de Gasto
```
POST /v2/{idNode}/expense-invoices
```
(Misma estructura que service-invoices)

---

## 💳 CUENTAS CORRIENTES (Live)

### Consulta de Deuda Pendiente
```
POST /v2/{idNode}/sales-receipts/search
```
```json
{
  "idEntity": 134940000000000309,
  "status": ["INGR"],
  "idValueType": 22,
  "emissionDateFrom": "2024-01-01T00:00:00.000-03:00",
  "emissionDateTo": "2026-12-31T23:59:59.000-03:00"
}
```

### Parámetros
- `status: ["INGR"]`: Solo facturas ingresadas (no pagadas)
- `idValueType: 22`: Cuenta Corriente

### Cálculo de Deuda
```javascript
const pendingAmount = invoice.mainAmount - 
  (invoice.agreements?.reduce((sum, ag) => sum + ag.mainAmount, 0) || 0);
```

---

## 💰 FORMAS DE PAGO

### Tipos de Agreement
- `cash`: Efectivo
- `prescription`: Receta / Obra Social
- `cardInstallment`: Tarjeta
- `checkingAccount`: Cuenta Corriente

### Value Types Comunes
- `BILLE`: Billete
- `RECE`: Receta
- `TARJ`: Tarjeta
- `CTAC`: Cuenta Corriente

### Estructura
```json
{
  "type": "cash",
  "valueType": {
    "name": "BILLE",
    "description": "BILLETE"
  },
  "mainAmount": 17550,
  "effective": {
    "name": "EFECTIVO"
  }
}
```

---

## 🏥 OBRAS SOCIALES

### Identificación
Los agreements con `type: "prescription"` son obras sociales.

### Estructura
```json
{
  "type": "prescription",
  "valueType": {
    "name": "RECE",
    "description": "RECETA"
  },
  "mainAmount": 53406.84,
  "authorizationNumber": "...",
  "expirationDate": "..."
}
```

### Búsqueda de Entidades OS
```
POST /v2/{idNode}/entities/search
```
(Usar `idEntityType` apropiado para obras sociales)

---

## 🛠️ SCRIPTS DE UTILIDAD

### Ubicación
`.agent/skills/zetti_api/scripts/`

### research_debt.js
Script multi-propósito para:
- Buscar entidades por tipo
- Consultar comprobantes
- Validar estados de deuda
- Explorar estructura de datos

### Uso
```bash
node .agent/skills/zetti_api/scripts/research_debt.js
```

---

## 📊 NODOS DISPONIBLES

- **2378041**: FCIA BIOSALUD (Palmares)
- **2406943**: BIOSALUD CHACRAS PARK
- **2378039**: Concentrador (para búsquedas globales)

---

## 🚨 ERRORES COMUNES

### 1. Formato de Fecha Incorrecto
**Error**: `400 Bad Request`  
**Solución**: Verificar formato ISO vs dd/MM/yyyy

### 2. IdEntityType Incorrecto
**Error**: Búsqueda vacía  
**Solución**: Probar diferentes tipos (1, 2, 10, 22, 27, 29)

### 3. Missing Parameters
**Error**: `include_items` no trae datos  
**Solución**: Agregar `?include_items=true&include_agreements=true&include_concepts=true`

---

## 📝 CHANGELOG

### v3.21.0 (06/02/2026)
- ✅ Agregado soporte completo para `customer` en sales receipts
- ✅ Documentado `agreements` para formas de pago
- ✅ Agregado `concepts` para conceptos contables
- ✅ Documentado Libro IVA Compras
- ✅ Agregado endpoints de gastos y servicios
- ✅ Documentado cuentas corrientes en vivo

---

*Manual actualizado el 2026-02-06 para migración completa a v3.21*

