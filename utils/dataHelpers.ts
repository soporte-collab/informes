import { RawCsvRow, SaleRecord, RawInvoiceRow, InvoiceRecord, RawExpenseRow, ExpenseRecord, CurrentAccountRecord, InsuranceRecord, UniversalSyncResult, StockRecord, UnifiedTransaction, UnifiedItem } from "../types";
import { format, getHours, isValid } from "date-fns";

const normalizeKey = (str: string) => {
  return str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
};

export const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const parseCurrency = (value: string): number => {
  if (!value) return 0;
  const cleanString = value.replace(/[^\d.,-]/g, "");
  // Assumes format 1.234,56 (AR/EU) -> replace dot, swap comma for dot
  // If format is already 1234.56, this logic requires adjustment. 
  // Assuming standard AR locale.
  const normalized = cleanString.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
};

export const parseDate = (dateString: string, timeString: string = ''): Date | null => {
  if (!dateString) return null;

  let str = String(dateString).trim();
  let time = timeString ? String(timeString).trim() : '';

  if (str.match(/^\d{4}[\-\/]\d{2}[\-\/]\d{2}/)) {
    if (time && !str.includes('T') && !str.includes(':')) {
      str = `${str} ${time}`;
    }
    const date = new Date(str);
    if (isValid(date)) return date;
  }

  if (time.length > 0 && !str.includes(':')) {
    str = `${str} ${time}`;
  }

  let cleanStr = str.replace(/[\/\.]/g, '-')
    .toLowerCase()
    .replace(/\s*p\.?\s*m\.?/g, ' pm')
    .replace(/\s*a\.?\s*m\.?/g, ' am')
    .trim();

  const dmyRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?(?:\s*(am|pm))?$/;
  const dmyMatch = cleanStr.match(dmyRegex);

  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    let hr = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 12;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const meridiem = dmyMatch[7];

    if (meridiem === 'pm' && hr < 12) hr += 12;
    if (meridiem === 'am' && hr === 12) hr = 0;

    if (m >= 0 && m <= 11 && d >= 1 && d <= 31 && hr <= 23 && min <= 59) {
      const date = new Date(y, m, d, hr, min, sec);
      if (isValid(date)) return date;
    }
  }

  const fallback = new Date(str);
  if (isValid(fallback)) return fallback;

  return null;
};

const getValue = (row: any, ...possibleKeys: string[]): string => {
  const rowKeys = Object.keys(row);
  for (const targetKey of possibleKeys) {
    if (row[targetKey] !== undefined && row[targetKey] !== null && String(row[targetKey]).trim() !== "") {
      return row[targetKey];
    }
  }
  for (const targetKey of possibleKeys) {
    const targetNormalized = normalizeKey(targetKey);
    const foundKey = rowKeys.find(k => normalizeKey(k) === targetNormalized);
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== "") {
      return row[foundKey];
    }
  }
  if (row.__parsed_extra && Array.isArray(row.__parsed_extra)) {
    for (const val of row.__parsed_extra) {
      if (val && String(val).trim() !== "") {
        return String(val).trim();
      }
    }
  }
  return "";
};

// --- COMPOSITE KEY GENERATOR ---
const generateCompositeID = (rawType: string, rawNumber: string): string => {
  const cleanNumber = rawNumber?.replace(/[^0-9]/g, '') || '0';
  let prefix = 'TX';

  const typeUpper = (rawType || '').toUpperCase();

  if (typeUpper.includes('FACTURA') || typeUpper.includes('FV')) prefix = 'FV';
  else if (typeUpper.includes('NOTA DE CRE') || typeUpper.includes('NC')) prefix = 'NC';
  else if (typeUpper.includes('NOTA DE DEB') || typeUpper.includes('ND')) prefix = 'ND';
  else if (typeUpper.includes('TICKET')) prefix = 'TK';
  else if (typeUpper.includes('PRESUPUESTO')) prefix = 'PR';
  else if (typeUpper.includes('REMITO')) prefix = 'RM';

  return `${prefix}-${cleanNumber}`;
};

// --- MAIN SALES PROCESSING FUNCTION (UPSERT LOGIC) ---
export const processSalesData = (data: RawCsvRow[], existingData: SaleRecord[] = []): SaleRecord[] => {
  // Use a Map to handle Upserts (Update or Insert) efficiently
  // First, load all existing data into the Map by ID
  const salesMap = new Map<string, SaleRecord>();
  existingData.forEach(d => salesMap.set(d.id, d));

  data.forEach((row, index) => {
    // 1. Extract Info
    const tipoComprobante = getValue(row, "Tipo Comprobante", "Tipo Comp.", "Tipo") || "Ticket";
    const nroComprobante = getValue(row, "Nro Comprobante", "Número", "Nro.", "Comprobante") || `GEN-${index}`;
    const dateStr = getValue(row, "Fecha", "Fecha Emision", "Fecha Ticket", "Fecha Comprobante");
    const timeStr = getValue(row, "Hora", "Time", "Hs");

    // 2. Generate ID
    const isGenericNumber = nroComprobante.includes('GEN-');
    let uniqueId = generateCompositeID(tipoComprobante, nroComprobante);

    if (isGenericNumber) {
      uniqueId += `-IDX${index}`;
    }

    // 3. Parse Date
    const dateObj = parseDate(dateStr, timeStr);
    if (!dateObj) return;

    // 4. Parse Values
    let unitPrice = parseCurrency(getValue(row, "Precio", "Unitario", "P. Unit", "$")) || 0;
    let quantity = parseCurrency(getValue(row, "Cantidad", "Cant.", "Unidades")) || 1;

    // Calculate total if not explicit, trying common Total columns first
    let totalAmount = parseCurrency(getValue(row, "Total", "Importe Total", "Monto", "Importe"));
    if (totalAmount === 0 && unitPrice !== 0) {
      totalAmount = unitPrice * quantity;
    }

    // Handle NC Logic (Negative values if not already negative)
    // Sometimes CSVs have negative amounts for NC, sometimes positive.
    if (tipoComprobante.toUpperCase().includes('NC') || tipoComprobante.toUpperCase().includes('CREDITO')) {
      if (totalAmount > 0) totalAmount = -totalAmount;
      if (unitPrice > 0) unitPrice = -unitPrice;
    }

    // 5. Metadata
    const product = getValue(row, "Producto", "Descripción", "Detalle", "Item") || "Varios";
    const category = getValue(row, "Rubro", "Familia", "Categoria", "Marca") || "General";

    let entity = getValue(row, "Cliente", "Razon Social", "Nombre", "Entidad");
    const obraSocial = getValue(row, "Obra Social", "Mutual");
    if (obraSocial && obraSocial.length > 2) {
      entity = obraSocial;
    }

    // 6. UPSERT: Set (or overwrite) the record in the Map
    salesMap.set(uniqueId, {
      id: uniqueId,
      date: dateObj,
      monthYear: format(dateObj, 'yyyy-MM'),
      sellerName: getValue(row, "Vendedor", "Vend.", "Legajo", "Usuario") || "Sin Asignar",
      branch: getValue(row, "Sucursal", "Punto Venta", "Nodo_venta", "Nodo") || "Central",
      totalAmount: totalAmount,
      quantity: quantity,
      unitPrice: unitPrice,
      productName: product || "Producto Sin Nombre",
      category: category,
      paymentMethod: "Efectivo",
      entity: entity || "Particular",
      manufacturer: getValue(row, "Fabricante", "Laboratorio", "Marca") || "Varios",
      hour: getHours(dateObj),
      invoiceNumber: nroComprobante
    });
  });

  // Convert Map back to Array and sort
  return Array.from(salesMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
};

// --- INVOICE PROCESSING (UPSERT LOGIC) ---
export const processInvoiceData = (data: RawInvoiceRow[], existingData: InvoiceRecord[] = []): InvoiceRecord[] => {
  const invoiceMap = new Map<string, InvoiceRecord>();
  existingData.forEach(d => invoiceMap.set(d.id, d));

  data.forEach((row, index) => {
    const dateStr = getValue(row, "Fecha y Hora", "Fecha");
    const timeStr = getValue(row, "Hora", "Time", "Hs", "Hora Comprobante");
    const typeStr = getValue(row, "Tipo Cmp.", "Tipo", "Comprobante");
    const nroStr = getValue(row, "Nro de Comprobante", "Nro", "Numero");
    const branchStr = getValue(row, "Nodo", "Sucursal");
    const sellerStr = getValue(row, "Vendedor", "Usuario");
    const clientStr = getValue(row, "Cliente", "Razon Social");
    const insuranceStr = getValue(row, "Obra Social", "O.S.");
    const paymentStr = getValue(row, "Tarjeta", "Medio Pago", "Pago");
    const netStr = getValue(row, "Imp. Neto", "Neto", "Subtotal");
    const grossStr = getValue(row, "Imp. Bruto", "Bruto", "Total");
    const discountStr = getValue(row, "Imp. Dto/Rec", "Descuento", "Dto");
    const canceledStr = getValue(row, "Anulado");

    if (!dateStr) return;
    if (canceledStr && (canceledStr.toLowerCase() === 'si' || canceledStr.toLowerCase() === 'x')) return;

    const date = parseDate(dateStr, timeStr);
    if (!date) return;

    const netAmount = parseCurrency(netStr);
    const grossAmount = parseCurrency(grossStr);
    const discountAmount = parseCurrency(discountStr);

    const uniqueId = generateCompositeID(typeStr, nroStr) + (nroStr ? '' : `-${index}`);

    let derivedEntity = clientStr?.trim() || "Particular";
    if (derivedEntity.toUpperCase().includes("CONSUMIDOR FINAL")) {
      derivedEntity = "Particular";
    }

    // UPSERT Logic
    invoiceMap.set(uniqueId, {
      id: uniqueId,
      date: date,
      monthYear: format(date, "yyyy-MM"),
      branch: branchStr?.trim() || "General",
      type: typeStr?.trim() || "Desconocido",
      invoiceNumber: nroStr || `GEN-${index}`,
      seller: sellerStr?.trim() || "Desconocido",
      client: clientStr?.trim() || "Consumidor Final",
      entity: derivedEntity,
      insurance: insuranceStr?.trim() || "-",
      paymentType: paymentStr?.trim() || "Otros / Efectivo",
      netAmount: netAmount,
      grossAmount: grossAmount,
      discount: discountAmount
    });
  });

  return Array.from(invoiceMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
};

// --- TIME SYNC HELPERS ---
export const processTimeSyncData = (data: any[]): Array<{ ticket: string, date: Date }> => {
  const result: Array<{ ticket: string, date: Date }> = [];
  data.forEach((row) => {
    const nroStr = getValue(row, "Nro de Comprobante", "Nro", "Numero", "Comprobante", "Ticket");
    const dateStr = getValue(row, "Fecha y Hora", "Fecha", "Hora", "Time");
    if (!nroStr || !dateStr) return;
    if (nroStr.toUpperCase().includes("E+")) return;

    // Simplistic normalization just for syncing purposes
    const cleanTicket = nroStr.replace(/[^0-9]/g, '');
    const date = parseDate(dateStr);
    if (date) {
      result.push({ ticket: cleanTicket, date });
    }
  });
  return result;
};

// --- EXPENSE PROCESSING ---
export const processExpenseData = (data: RawExpenseRow[]): ExpenseRecord[] => {
  const processed: ExpenseRecord[] = [];
  let currentSupplier = "Varios";

  data.forEach((row, index) => {
    // Zetti outputs often group multiple documents under one supplier header row
    // If we find a new supplier, we track it for all subsequent rows until the next change
    const supplierInRow = getValue(row, "Entidad", "Proveedor", "Beneficiario", "Nombre");
    if (supplierInRow && supplierInRow.trim() !== "") {
      currentSupplier = supplierInRow.trim();
    }

    const dateStr = getValue(row, "Fecha Emision", "Fecha", "FechaPago");
    const date = parseDate(dateStr);

    // If no date, this is likely a metadata row or a sub-row without business data
    if (!date) return;

    const dueDateStr = getValue(row, "FechaVenc", "Vencimiento", "Vto");
    const dueDate = parseDate(dueDateStr) || date;
    const amount = parseCurrency(getValue(row, "Importe", "Monto", "Total", "Imp. Neto"));

    const uniqueId = `EXP-${index}-${date.getTime()}`;

    processed.push({
      id: uniqueId,
      issueDate: date,
      dueDate: dueDate,
      monthYear: format(date, "yyyy-MM"),
      operationType: getValue(row, "TipoOperacion") || "Gasto Genérico",
      supplier: currentSupplier,
      amount: amount,
      code: getValue(row, "Codificacion", "Comprobante") || "-",
      type: getValue(row, "TipoValor") || "Varios",
      branch: getValue(row, "Nodo") || "General",
      status: getValue(row, "Estado") || "Pagado",
      items: []
    });
  });
  return processed.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
};

// --- SERVICE PROCESSING ---
export const processServiceData = (data: any[]): ExpenseRecord[] => {
  return processExpenseData(data);
};

// --- CURRENT ACCOUNT PROCESSING ---
export const processCurrentAccountData = (data: any[]): CurrentAccountRecord[] => {
  const processed: CurrentAccountRecord[] = [];
  data.forEach((row, index) => {
    const dateStr = getValue(row, "Fecha Emision", "Fecha");
    const date = parseDate(dateStr);
    if (!date) return;

    const entity = getValue(row, "Entidad", "Cliente", "Proveedor");
    const debit = parseCurrency(getValue(row, "Debe", "Debito", "Cargo"));
    const credit = parseCurrency(getValue(row, "Haber", "Credito", "Abono"));
    const balance = parseCurrency(getValue(row, "Saldo"));

    processed.push({
      id: `CA-${index}-${date.getTime()}`,
      date: date,
      entity: entity || "Desconocido",
      type: debit > 0 ? "Debe" : "Haber",
      debit: debit,
      credit: credit,
      balance: balance,
      description: getValue(row, "Comprobante", "Concepto") || "-",
      reference: getValue(row, "Comprobante", "Referencia") || `REF-${index}`,
      branch: "General"
    });
  });
  return processed;
};

// --- INSURANCE PROCESSING ---
export const processInsuranceData = (data: any[]): InsuranceRecord[] => {
  const processed: InsuranceRecord[] = [];
  data.forEach((row, index) => {
    const dateStr = getValue(row, "Fecha Presentacion", "Fecha", "FechaEmision");
    const date = parseDate(dateStr);
    if (!date) return;

    const entity = getValue(row, "Entidad", "Obra Social");
    const amount = parseCurrency(getValue(row, "Total Facturado", "Importe", "Monto"));

    processed.push({
      id: `INS-${index}-${date.getTime()}`,
      issueDate: date,
      dueDate: date, // Fallback
      monthYear: format(date, "yyyy-MM"),
      entity: entity || "O.S. Desconocida",
      amount: amount, // Mapped to amount, though interface might say 'totalAmount' depending on version, let's check types.ts
      code: getValue(row, "Codificacion") || "-",
      type: getValue(row, "TipoValor") || "Liquidacion",
      branch: getValue(row, "Nodo") || "General",
      status: getValue(row, "Estado") || "Pendiente",
      operationType: getValue(row, "TipoOperacion") || "Obras Sociales",
      items: []
    });
  });
  return processed;
};

// --- STOCK PROCESSING ---
export const processStockData = (data: any[]): StockRecord[] => {
  const processed: StockRecord[] = [];
  data.forEach((row, index) => {
    const rawDate = getValue(row, "Fecha");
    const date = parseDate(rawDate) || new Date();

    // Headers from the new detailed report
    const productName = getValue(row, "Producto", "Nombre", "Descripcion");
    const barcode = getValue(row, "Cod.barra", "Barcode", "Codigo", "ID");
    const units = parseCurrency(getValue(row, "Unidades", "Cant."));
    const currentStock = parseCurrency(getValue(row, "Stock Actual", "Stock"));
    const costPrice = parseCurrency(getValue(row, "Precio Costo", "Costo"));
    const salePrice = parseCurrency(getValue(row, "Venta Total", "Venta", "Total"));
    const movementType = getValue(row, "Tipo de mov.", "Movimiento");
    const invoiceNumber = getValue(row, "Comprobante", "Factura", "Remito");

    if (productName || barcode) {
      processed.push({
        id: `STK-${index}-${date.getTime()}-${barcode}`,
        productName: productName || "Producto Sin Nombre",
        barcode: barcode || "S/B",
        date: date,
        location: getValue(row, "Deposito", "Almacen") || "PPAL",
        movementType: movementType || "Varios",
        units: units,
        currentStock: currentStock,
        costPrice: costPrice,
        salePrice: salePrice,
        manufacturer: getValue(row, "Fabricante", "Laboratorio") || "Varios",
        branch: getValue(row, "Nodo", "Sucursal") || "General",
        invoiceNumber: invoiceNumber,
        seller: getValue(row, "Vendedor", "Usuario"),
        entity: getValue(row, "Entidad", "Cliente", "Proveedor")
      });
    }
  });
  return processed.sort((a, b) => b.date.getTime() - a.date.getTime());
};

const normalizeInvoiceNumber = (nro: string): string => {
  if (!nro) return "";
  // Remove types like "FV B", "NC A", "FACTURA DE VENTA", etc.
  // Keep only the 0000-00000000 format or pure digits
  const parts = nro.match(/\d+-\d+/);
  if (parts) return parts[0];
  const digits = nro.replace(/\D/g, "");
  if (digits.length > 8) {
    const p1 = digits.substring(0, digits.length - 8).padStart(4, '0');
    const p2 = digits.substring(digits.length - 8);
    return `${p1}-${p2}`;
  }
  return nro.trim();
};

export const createUnifiedTransactions = (
  invoices: InvoiceRecord[],
  stock: StockRecord[],
  sales: SaleRecord[]
): UnifiedTransaction[] => {
  const unifiedMap = new Map<string, UnifiedTransaction>();

  // 1. Initialize from Invoices (Financial Source of Truth)
  invoices.forEach(inv => {
    const key = normalizeInvoiceNumber(inv.invoiceNumber);
    if (!key) return;

    unifiedMap.set(key, {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      type: inv.type,
      date: inv.date,
      branch: inv.branch,
      seller: inv.seller || "S/V",
      client: inv.client || "PARTICULAR",
      entity: inv.entity || "PARTICULAR",
      paymentMethod: inv.paymentType || "EFECTIVO", // Changed from paymentMethod to paymentType
      totalNet: inv.netAmount, // Changed from revenue to netAmount
      totalGross: inv.grossAmount, // Changed from revenue to grossAmount
      totalDiscount: inv.discount, // Changed from 0 to discount
      items: [],
      hasStockDetail: false,
      hasFinancialDetail: true
    });
  });

  // 2. Enrich with Stock Movements (Operational Details/Barcodes/Costs)
  stock.forEach(stk => {
    const key = normalizeInvoiceNumber(stk.invoiceNumber || "");
    if (!key) return;

    let transaction = unifiedMap.get(key);
    if (!transaction) {
      // If not in caja (financial), create a placeholder (Operational only)
      transaction = {
        id: stk.id,
        invoiceNumber: stk.invoiceNumber || key,
        type: stk.movementType,
        date: stk.date,
        branch: stk.branch,
        seller: stk.seller || "S/V",
        client: "PARTICULAR",
        entity: "PARTICULAR",
        paymentMethod: "S/D",
        totalNet: 0,
        totalGross: 0,
        totalDiscount: 0,
        items: [],
        hasStockDetail: true,
        hasFinancialDetail: false
      };
      unifiedMap.set(key, transaction);
    }

    const item: UnifiedItem = {
      barcode: stk.barcode,
      name: stk.productName,
      quantity: stk.units,
      unitPrice: stk.salePrice / (stk.units || 1),
      unitCost: stk.costPrice,
      totalPrice: stk.salePrice,
      totalCost: stk.costPrice * Math.abs(stk.units),
      profit: stk.salePrice - (stk.costPrice * Math.abs(stk.units)),
      manufacturer: stk.manufacturer,
      category: "VARIOS"
    };

    transaction.items.push(item);
    transaction.hasStockDetail = true;
    // Only add to totalGross if it was not already set by an invoice (financial source)
    if (!transaction.hasFinancialDetail) {
      transaction.totalGross += item.totalPrice;
    }
    if (stk.seller && transaction.seller === "S/V") transaction.seller = stk.seller;
  });

  // 3. Final Polish with Sales (Sellers/Commission Data)
  sales.forEach(s => {
    const key = normalizeInvoiceNumber(s.invoiceNumber || "");
    if (!key) return;

    const transaction = unifiedMap.get(key);
    if (transaction) {
      if (transaction.seller === "S/V" && s.sellerName) {
        transaction.seller = s.sellerName;
      }
      // If we don't have stock detail but have sales detail, we can at least fill category/manufacturer
      if (!transaction.hasStockDetail) {
        // Optionally add dummy item from sales data if needed
      }
    }
  });

  return Array.from(unifiedMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
};

// --- UNIVERSAL SYNC ---
export const processUniversalReport = (data: any[]): UniversalSyncResult => {
  const result: UniversalSyncResult = {
    sales: [],
    invoices: [],
    unified: [],
    expenses: [],
    services: [],
    insurance: [],
    currentAccounts: [],
    stock: []
  };
  return result;
};

// Legacy Helper needed for compatibility if referenced elsewhere
export const processRawData = (data: RawCsvRow[]): SaleRecord[] => {
  return processSalesData(data);
};