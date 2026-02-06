# 🚀 PLAN DE MIGRACIÓN A ZETTI API v3.21

## Fecha: 06/02/2026 - 15:35hs

---

## 📊 CAMBIOS EN LA BASE DE DATOS

### **NUEVAS TABLAS**

#### 1. `customers.json`
```typescript
interface CustomerRecord {
  id: string;              // customer.id
  name: string;            // customer.name
  documentNumber: string;  // customer.documentNumber
  documentType: string;    // customer.documentType (DNI/CUIT)
  vatSituation: string;    // customer.vatSituation.name
  cuit?: string;           // customer.cuit
  email?: string;          // customer.email
  lastPurchase?: string;   // Fecha última compra (calculado)
  totalPurchases?: number; // Total histórico (calculado)
}
```

#### 2. `payments.json`
```typescript
interface PaymentRecord {
  id: string;              // Generado: invoiceId + index
  invoiceId: string;       // ID de la factura
  invoiceNumber: string;   // codification
  date: string;            // emissionDate
  paymentType: string;     // agreements[].type (cash/prescription/cardInstallment)
  valueTypeName: string;   // agreements[].valueType.name (BILLE/RECE/TARJ)
  valueTypeDescription: string; // agreements[].valueType.description
  amount: number;          // agreements[].mainAmount
  effectiveName?: string;  // agreements[].effective.name (si aplica)
  branch: string;          // creationNode.name
}
```

### **TABLAS MODIFICADAS**

#### 3. `invoices.json` (ACTUALIZADA)
```typescript
interface InvoiceRecord {
  // EXISTENTES (sin cambios)
  id: string;
  invoiceNumber: string;
  date: string;
  total: number;
  branch: string;
  
  // NUEVOS CAMPOS
  status: string;              // status.name (INGR/PAGADO)
  statusDescription: string;   // status.description
  sellerId: string;            // creationUser.id
  emissionCenter: string;      // emissionCenter.name
  letter: string;              // letter (A/B/C)
  generalDiscount: number;     // generalDiscount
  customerId?: string;         // customer.id (FK a customers)
  customerName?: string;       // customer.name
  vatSituation?: string;       // customer.vatSituation.name
}
```

#### 4. `sales.json` (ACTUALIZADA)
```typescript
interface SaleRecord {
  // EXISTENTES
  id: string;
  invoiceId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  date: string;
  branch: string;
  seller: string;
  
  // NUEVOS
  discount: number;        // items[].discount
  costPrice?: number;      // items[].costPrice (si viene)
  totalDiscount?: number;  // items[].totalDiscount
}
```

#### 5. `insurance.json` (MEJORADA)
```typescript
interface InsuranceRecord {
  // EXISTENTES
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  
  // NUEVOS
  patientName: string;         // customer.name
  patientDocument: string;     // customer.documentNumber
  insuranceName: string;       // (requiere lookup o mapeo)
  authorizationNumber?: string; // agreements[].authorizationNumber
  expirationDate?: string;     // agreements[].expirationDate
}
```

---

## 🔧 CAMBIOS EN EL CÓDIGO

### **1. `utils/db.ts`**
- ✅ Agregar `saveCustomersToDB()` y `getAllCustomersFromDB()`
- ✅ Agregar `savePaymentsToDB()` y `getAllPaymentsFromDB()`
- ✅ Actualizar tipos de `InvoiceRecord` y `SaleRecord`

### **2. `components/ZettiSync.tsx`**
- ✅ Cambiar endpoint de `/sales-receipts/search` a la versión v2 con parámetros:
  - `?include_items=true&include_agreements=true&include_concepts=true`
- ✅ Reescribir `processAndSaveAll()` para parsear la nueva estructura
- ✅ Agregar extracción de `customers` y `payments`
- ✅ Simplificar lógica de parseo (menos anidamiento)

### **3. `components/InvoiceDashboard.tsx`**
- ✅ Adaptar a nuevos campos (si es necesario)
- ✅ Mostrar `status` y `statusDescription`

### **4. NUEVOS COMPONENTES (Opcional - Fase 2)**
- `components/CustomerDashboard.tsx` - Análisis de clientes
- `components/PaymentMethodsDashboard.tsx` - Análisis de formas de pago

---

## 📝 ENDPOINT NUEVO

### **Antes (actual)**
```javascript
const url = `http://190.15.199.103:8089/api-rest/v2/${nodeId}/sales-receipts/search`;
const body = {
  emissionDateFrom: "2026-02-02T00:00:00.000-03:00",
  emissionDateTo: "2026-02-02T23:59:59.999-03:00"
};
```

### **Después (v3.21)**
```javascript
const url = `http://190.15.199.103:8089/api-rest/v2/${nodeId}/sales-receipts/search?include_items=true&include_agreements=true&include_concepts=true&per_page=100`;
const body = {
  emissionDateFrom: "2026-02-02T00:00:00.000-03:00",
  emissionDateTo: "2026-02-02T23:59:59.999-03:00"
};
```

---

## ⚡ VENTAJAS

1. **Datos más ricos**: Clientes, formas de pago, descuentos
2. **Código más simple**: Menos anidamiento, estructura más plana
3. **Nuevos análisis**: Clientes frecuentes, métodos de pago preferidos
4. **Validación mejorada**: Conceptos contables disponibles

---

## 🎯 PRÓXIMOS PASOS

1. ✅ Actualizar `types.ts` con nuevas interfaces
2. ✅ Actualizar `db.ts` con nuevas funciones
3. ✅ Reescribir `ZettiSync.tsx` - función `processAndSaveAll()`
4. ✅ Testing con 1 día de datos
5. ✅ Sincronización completa

---

*Generado automáticamente - 06/02/2026 15:35hs*
