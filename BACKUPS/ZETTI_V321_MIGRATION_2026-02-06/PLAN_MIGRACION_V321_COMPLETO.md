# 🚀 PLAN DE MIGRACIÓN COMPLETO A ZETTI API v3.21

**Fecha**: 06 de Febrero, 2026 - 15:40hs  
**Versión**: 2.0 - Sistema Integral  
**Estado**: PREPARADO PARA EJECUCIÓN DESDE CASA

---

## 📋 RESUMEN EJECUTIVO

Vamos a migrar de la API actual a la **v3.21** que nos permite traer **TODO** en vivo desde Zetti:
- ✅ Ventas (mejorado)
- ✅ Clientes (nuevo)
- ✅ Formas de Pago (nuevo)
- ✅ Obras Sociales (mejorado)
- ✅ Proveedores (nuevo)
- ✅ Compras/Libro IVA (nuevo)
- ✅ Gastos y Servicios vía API (nuevo)
- ✅ Cuentas Corrientes en vivo (nuevo)

**Beneficio**: Sistema 100% integrado, sin CSVs manuales (excepto casos especiales).

---

## 🎯 OBJETIVOS

### **Antes (Sistema Actual)**
- Ventas: ✅ Desde API
- Gastos: ⚠️ CSV manual
- Clientes: ❌ No disponible
- Proveedores: ❌ No disponible
- Cuentas Corrientes: ⚠️ CSV manual
- Obras Sociales: ⚠️ Parcial

### **Después (Sistema v3.21)**
- Ventas: ✅ API v3.21 (más datos)
- Gastos: ✅ API v3.21 (`/expense-invoices`)
- Clientes: ✅ API v3.21 (desde `customer`)
- Proveedores: ✅ API v3.21 (`/entities/search`)
- Compras: ✅ API v3.21 (`/receipts-iva-book-purchases`)
- Cuentas Corrientes: ✅ API v3.21 (en vivo)
- Obras Sociales: ✅ API v3.21 (completo)

---

## 📊 NUEVAS TABLAS EN LA BASE DE DATOS

### 1. `customers.json` (NUEVO)
```typescript
{
  id: string,              // ID de Zetti
  name: string,            // Nombre completo
  documentNumber: string,  // DNI/CUIT
  documentType: string,    // "DNI" / "CUIT"
  vatSituation: string,    // "CONS.FINAL" / "RESP.INSCRIPTO"
  totalPurchases: number,  // Total histórico
  purchaseCount: number,   // Cantidad de compras
  lastPurchase: Date       // Última compra
}
```

### 2. `payments.json` (NUEVO)
```typescript
{
  id: string,
  invoiceId: string,
  paymentType: string,         // "cash" / "prescription" / "cardInstallment"
  valueTypeName: string,       // "BILLE" / "RECE" / "TARJ"
  amount: number,
  date: Date,
  branch: string
}
```

### 3. `providers.json` (NUEVO)
```typescript
{
  id: string,
  name: string,
  entityType: number,          // 2=Droguerías, 27=Servicios, 29=AFIP
  totalPurchases: number,
  purchaseCount: number,
  lastPurchase: Date
}
```

### 4. `purchases.json` (NUEVO - Libro IVA)
```typescript
{
  id: string,
  providerId: string,
  providerName: string,
  amount: number,
  emissionDate: Date,
  status: string,              // "PAGADO" / "INGRESADO"
  branch: string
}
```

### 5. `current_accounts_live.json` (NUEVO)
```typescript
{
  id: string,
  customerId: string,
  customerName: string,
  totalAmount: number,
  paidAmount: number,
  pendingAmount: number,
  daysPastDue: number,
  isPastDue: boolean
}
```

### 6. `invoices.json` (ACTUALIZADA)
**Campos nuevos**:
- `status`: "INGR" / "PAGADO"
- `statusDescription`: "INGRESADO" / "PAGADO"
- `sellerId`: ID del vendedor
- `customerId`: ID del cliente
- `letter`: "A" / "B" / "C"

### 7. `sales.json` (ACTUALIZADA)
**Campos nuevos**:
- `discount`: Descuento del ítem
- `costPrice`: Precio de costo
- `sellerId`: ID del vendedor

---

## 🔧 ARCHIVOS A MODIFICAR

### **1. `types.ts` → `types_v321.ts`** ✅ CREADO
- Nuevas interfaces para todos los tipos
- DTOs de la API
- Records normalizados

### **2. `utils/db.ts`** ⏳ PENDIENTE
**Funciones a agregar**:
```typescript
- saveCustomersToDB()
- getAllCustomersFromDB()
- savePaymentsToDB()
- getAllPaymentsFromDB()
- saveProvidersToDB()
- getAllProvidersFromDB()
- savePurchasesToDB()
- getAllPurchasesFromDB()
- saveCurrentAccountsLiveToDB()
- getAllCurrentAccountsLiveFromDB()
```

### **3. `components/ZettiSync.tsx`** ⏳ PENDIENTE
**Cambios principales**:
1. Cambiar endpoint a v2 con parámetros:
   ```javascript
   const url = `http://190.15.199.103:8089/api-rest/v2/${nodeId}/sales-receipts/search?include_items=true&include_agreements=true&include_concepts=true&per_page=100`;
   ```

2. Reescribir `processAndSaveAll()`:
   - Extraer `customer` directamente
   - Procesar `agreements` para payments
   - Calcular estadísticas de clientes

3. Agregar sincronización de:
   - Proveedores (`/entities/search`)
   - Compras (`/receipts-iva-book-purchases/search`)
   - Gastos API (`/expense-invoices`)

### **4. `components/InvoiceDashboard.tsx`** ⏳ PENDIENTE
- Mostrar `status` y `statusDescription`
- Filtrar por estado (PAGADO / INGRESADO)

---

## 🔌 ENDPOINTS NUEVOS A USAR

### **Ventas (Mejorado)**
```javascript
POST /v2/{nodeId}/sales-receipts/search?include_items=true&include_agreements=true&include_concepts=true
Body: {
  emissionDateFrom: "2026-02-01T00:00:00.000-03:00",
  emissionDateTo: "2026-02-28T23:59:59.999-03:00"
}
```

### **Proveedores**
```javascript
POST /v2/{nodeId}/entities/search
Body: {
  filterText: "BIOLATINA",
  idEntityType: 2  // 2=Droguerías, 27=Servicios, 29=AFIP
}
```

### **Compras (Libro IVA)**
```javascript
POST /api-rest/{nodeId}/receipts-iva-book-purchases/search
Body: {
  fechaEmisionDesde: "01/02/2026",  // ⚠️ Formato dd/MM/yyyy
  fechaEmisionHasta: "28/02/2026"
}
```

### **Gastos y Servicios**
```javascript
POST /v2/{nodeId}/expense-invoices
POST /v2/{nodeId}/service-invoices
```

### **Cuentas Corrientes (Live)**
```javascript
POST /v2/{nodeId}/sales-receipts/search
Body: {
  status: ["INGR"],
  idValueType: 22,  // CUENTA CORRIENTE
  emissionDateFrom: "2024-01-01T00:00:00.000-03:00"
}
```

---

## 📦 BACKUPS REALIZADOS

### **Ubicación**: `BACKUPS/ZETTI_V321_MIGRATION_2026-02-06/`

**Archivos respaldados**:
1. ✅ `types.ts` → `types_BACKUP.ts`
2. ✅ `utils/db.ts` → `db_BACKUP.ts`
3. ✅ `components/ZettiSync.tsx` → `ZettiSync_BACKUP.tsx`
4. ✅ `.agent/skills/zetti_api/SKILL.md` → `SKILL_BACKUP.md`
5. ✅ `.agent/MEMORY.md` → `MEMORY_BACKUP.md`
6. ✅ `MIGRATION_PLAN_V321.md` → Plan completo

### **Data de Prueba**:
- `ARCHIVOS/respuesta/debug con nuevo deploy.json` (estructura actual)
- `ARCHIVOS/respuesta/sync_debug_*.json` (ejemplos de sincronización)

---

## ⚡ PLAN DE EJECUCIÓN (DESDE CASA)

### **FASE 1: Preparación** (15 min)
1. ✅ Abrir proyecto en VS Code
2. ✅ Verificar que Git esté actualizado (`git pull`)
3. ✅ Revisar backups en `BACKUPS/ZETTI_V321_MIGRATION_2026-02-06/`
4. ✅ Leer este plan completo

### **FASE 2: Actualizar Base de Datos** (30 min)
1. Abrir `utils/db.ts`
2. Agregar funciones para nuevas tablas:
   - `saveCustomersToDB()` / `getAllCustomersFromDB()`
   - `savePaymentsToDB()` / `getAllPaymentsFromDB()`
   - `saveProvidersToDB()` / `getAllProvidersFromDB()`
   - `savePurchasesToDB()` / `getAllPurchasesFromDB()`
   - `saveCurrentAccountsLiveToDB()` / `getAllCurrentAccountsLiveFromDB()`

### **FASE 3: Reescribir ZettiSync** (1 hora)
1. Abrir `components/ZettiSync.tsx`
2. Actualizar URL del endpoint (agregar parámetros)
3. Reescribir `processAndSaveAll()`:
   ```typescript
   // Extraer clientes
   const customers = new Map();
   raw.sales.forEach(receipt => {
     if (receipt.customer) {
       customers.set(receipt.customer.id, {
         id: receipt.customer.id,
         name: receipt.customer.name,
         documentNumber: receipt.customer.documentNumber,
         // ...
       });
     }
   });
   
   // Extraer payments
   const payments = [];
   raw.sales.forEach(receipt => {
     receipt.agreements?.forEach(ag => {
       payments.push({
         id: `${receipt.id}-${ag.id}`,
         invoiceId: receipt.id,
         paymentType: ag.type,
         amount: ag.mainAmount,
         // ...
       });
     });
   });
   
   // Guardar todo
   await saveCustomersToDB(Array.from(customers.values()));
   await savePaymentsToDB(payments);
   ```

### **FASE 4: Testing** (30 min)
1. Sincronizar **1 día** de prueba (ej: 02/02/2026)
2. Verificar en consola:
   - Cantidad de clientes extraídos
   - Cantidad de payments
   - Totales coinciden con Zetti
3. Revisar datos en IndexedDB (DevTools → Application)

### **FASE 5: Sincronización Completa** (1 hora)
1. **BORRAR** base de datos actual (botón en ZettiSync)
2. Sincronizar Enero + Febrero 2026
3. Validar totales
4. Verificar dashboards

### **FASE 6: Nuevos Dashboards** (Opcional - 2 horas)
1. Crear `CustomerDashboard.tsx`
2. Crear `PaymentMethodsDashboard.tsx`
3. Crear `ProviderDashboard.tsx`

---

## 🚨 PUNTOS CRÍTICOS

### **⚠️ CUIDADO CON**:
1. **Formato de fechas en Libro IVA**: Usa `dd/MM/yyyy` en lugar de ISO
2. **Deduplicación de clientes**: Usar `Map` por ID
3. **Agreements vacíos**: Algunos receipts no tienen `agreements`
4. **Customer null**: Consumidor final puede venir sin customer

### **✅ VALIDACIONES**:
1. Total de facturas debe coincidir con Zetti
2. Suma de payments debe = suma de invoices
3. Clientes únicos (no duplicados)

---

## 📞 SOPORTE

Si algo falla:
1. **Restaurar backup**: Copiar archivos desde `BACKUPS/`
2. **Revisar logs**: Consola del navegador (F12)
3. **Verificar endpoint**: Probar en Postman/Thunder Client
4. **Consultar SKILL.md**: Tiene ejemplos de cada endpoint

---

## 📝 CHECKLIST FINAL

Antes de hacer commit:
- [ ] Todos los tipos compilando sin errores
- [ ] Base de datos sincronizada correctamente
- [ ] Dashboards mostrando datos
- [ ] Totales validados contra Zetti
- [ ] Backups verificados
- [ ] Git commit con mensaje claro
- [ ] Git push al repositorio

---

**¡ÉXITO! 🚀**

*Generado: 06/02/2026 15:40hs*  
*Próxima sesión: Desde casa*
