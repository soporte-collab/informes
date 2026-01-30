import { RawCsvRow, SaleRecord, RawInvoiceRow, InvoiceRecord, RawExpenseRow, ExpenseRecord, CurrentAccountRecord } from "../types";
import { format, getHours, isValid } from "date-fns";

const normalizeKey = (str: string) => {
  return str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "") // Remove all non-alphanumeric chars
    .trim();
};

export const parseCurrency = (value: string): number => {
  if (!value) return 0;
  const cleanString = value.replace(/[^\d.,-]/g, "");
  const normalized = cleanString.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
};

export const parseDate = (dateString: string, timeString: string = ''): Date | null => {
  if (!dateString) return null;

  let str = dateString.trim();
  const time = timeString ? timeString.trim() : '';

  // Handle ISO 8601 (YYYY-MM-DD) which might be common in exports
  // Check for YYYY-MM-DD or YYYY/MM/DD at the start
  if (str.match(/^\d{4}[\-\/]\d{2}[\-\/]\d{2}/)) {
    // If there is a separate time string, append it
    if (time && !str.includes('T') && !str.includes(time)) {
      str = `${str} ${time}`;
    }
    const date = new Date(str);
    if (isValid(date)) return date;
  }

  if (time.length > 0 && !str.includes(':')) {
    str = `${str} ${time}`;
  }

  str = str.replace(/[\/\.]/g, '-')
    .toLowerCase()
    .replace(/\s*p\.?\s*m\.?/g, ' pm')
    .replace(/\s*a\.?\s*m\.?/g, ' am');

  const regex = /^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?(?:\s*(am|pm))?$/;

  const match = str.match(regex);

  if (match) {
    const d = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const y = parseInt(match[3], 10);

    let hr = match[4] ? parseInt(match[4], 10) : 12;
    const min = match[5] ? parseInt(match[5], 10) : 0;
    const sec = match[6] ? parseInt(match[6], 10) : 0;
    const meridiem = match[7];

    if (meridiem === 'pm' && hr < 12) hr += 12;
    if (meridiem === 'am' && hr === 12) hr = 0;

    if (hr > 23 || min > 59 || sec > 59) return null;

    const date = new Date(y, m, d, hr, min, sec);
    if (isValid(date)) return date;
  }

  return null;
};

const getValue = (row: any, ...possibleKeys: string[]): string => {
  const rowKeys = Object.keys(row);
  for (const targetKey of possibleKeys) {
    if (row[targetKey] !== undefined) return row[targetKey];
  }
  for (const targetKey of possibleKeys) {
    const targetNormalized = normalizeKey(targetKey);
    const foundKey = rowKeys.find(k => normalizeKey(k) === targetNormalized);
    if (foundKey) return row[foundKey];
  }
  return "";
};

export const processRawData = (data: RawCsvRow[]): SaleRecord[] => {
  const processed: SaleRecord[] = [];

  data.forEach((row, index) => {
    const dateStr = getValue(row, "Fecha Ticket", "Fecha", "Fecha Comprobante", "Fecha Emision");
    const timeStr = getValue(row, "Hora", "Time", "Hs");
    const prodStr = getValue(row, "Producto", "Descripcion", "Descripción", "Articulo");
    const priceStr = getValue(row, "$", "Precio", "Unitario", "Importe", "P. Unit");
    const qtyStr = getValue(row, "Cantidad", "Cant", "Unidades");
    const sellerStr = getValue(row, "Usuario", "Vendedor", "Atendio");
    const branchStr = getValue(row, "Nodo_venta", "Sucursal", "Nodo", "Punto de Venta");
    const rubroStr = getValue(row, "Rubro", "Categoria", "Familia");
    const manufacturerStr = getValue(row, "Fabricante", "Marca", "Laboratorio");
    const nroStr = getValue(row, "Nro", "Numero", "Comprobante", "Ticket");
    const entityStr = getValue(row, "Entidad", "Entidad Agrupadora", "Obra Social", "Cliente");

    if (!dateStr || !prodStr) return;

    const date = parseDate(dateStr, timeStr);
    if (!date) return;

    const unitPrice = parseCurrency(priceStr) || 0;
    const quantity = parseCurrency(qtyStr) || 0;
    let total = quantity * unitPrice;

    const cleanProdName = prodStr.trim() || "Producto Sin Nombre";
    const safeProdId = cleanProdName.replace(/[\/\.\s]/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    const safeNro = nroStr ? nroStr.replace(/[^a-zA-Z0-9-]/g, '') : 'SN';

    // Generate a deterministic ID based on content to avoid duplicates on re-upload
    const uniqueId = `SALE-${safeNro}-${safeProdId}-${date.getTime()}-${quantity}-${unitPrice}-${branchStr}-${sellerStr}`;

    const finalEntity = entityStr?.trim() || "Particular";

    const record: SaleRecord = {
      id: uniqueId,
      date: date,
      monthYear: format(date, "yyyy-MM") || "2024-01",
      productName: cleanProdName,
      quantity: isNaN(quantity) ? 0 : quantity,
      unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
      totalAmount: isNaN(total) ? 0 : total,
      sellerName: sellerStr?.trim() || "Desconocido",
      branch: branchStr?.trim() || "General",
      hour: getHours(date),
      category: rubroStr?.trim() || "Varios",
      manufacturer: manufacturerStr?.trim() || "Varios",
      invoiceNumber: safeNro,
      entity: finalEntity
    };

    processed.push(record);
  });

  return processed.sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const processInvoiceData = (data: RawInvoiceRow[]): InvoiceRecord[] => {
  const processed: InvoiceRecord[] = [];

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
    const rawNro = nroStr || '';
    const joinNro = rawNro.replace(/[^a-zA-Z0-9-]/g, '');
    const uniqueId = `INV-${joinNro}-${date.getTime()}-${grossAmount}-${netAmount}-${branchStr}`;

    let derivedEntity = clientStr?.trim() || "Particular";
    if (derivedEntity.toUpperCase().includes("CONSUMIDOR FINAL")) {
      derivedEntity = "Particular";
    }

    const record: InvoiceRecord = {
      id: uniqueId,
      date: date,
      monthYear: format(date, "yyyy-MM"),
      branch: branchStr?.trim() || "General",
      type: typeStr?.trim() || "Desconocido",
      invoiceNumber: joinNro,
      seller: sellerStr?.trim() || "Desconocido",
      client: clientStr?.trim() || "Consumidor Final",
      entity: derivedEntity,
      insurance: insuranceStr?.trim() || "-",
      paymentType: paymentStr?.trim() || "Otros / Efectivo",
      netAmount: netAmount,
      grossAmount: grossAmount,
      discount: discountAmount
    };

    processed.push(record);
  });

  return processed.sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const processTimeSyncData = (data: any[]): Array<{ ticket: string, date: Date }> => {
  const result: Array<{ ticket: string, date: Date }> = [];

  data.forEach((row) => {
    // 1. Get Ticket Number
    const nroStr = getValue(row, "Nro de Comprobante", "Nro", "Numero", "Comprobante", "Ticket");

    // 2. Get Date/Time
    const dateStr = getValue(row, "Fecha y Hora", "Fecha", "Hora", "Time");

    if (!nroStr || !dateStr) return;

    // Filter out Scientific Notation errors from Excel (e.g. "1E+16")
    if (nroStr.toUpperCase().includes("E+")) {
      return;
    }

    // Try parsing date
    const date = parseDate(dateStr);

    if (date && isValid(date)) {
      result.push({ ticket: nroStr, date: date });
    }
  });

  return result;
};

export const processExpenseData = (data: any[]): ExpenseRecord[] => {
  const recordsMap = new Map<string, ExpenseRecord>();
  let lastSupplier = "";
  let lastDateStr = "";
  let lastRecord: ExpenseRecord | null = null;

  data.forEach((row, index) => {
    const supplierStr = getValue(row, "Entidad", "Entidad Agrupadora", "Proveedor", "Empresa")?.trim();
    if (supplierStr) lastSupplier = supplierStr;

    const code = getValue(row, "Codificacion", "Codigo", "Nro", "Comprobante")?.trim();
    const itemName = getValue(row, "Item", "Producto", "Descripcion", "Artículo")?.trim();
    const amountStr = getValue(row, "Monto", "Importe", "Total")?.trim();
    const issueDateStr = getValue(row, "FechaEmision", "Fecha Emision", "Fecha")?.trim();

    if (issueDateStr) lastDateStr = issueDateStr;

    // A row is considered a primary record row if it has a code or an amount
    if (code || amountStr) {
      // Use code + date + supplier as uniqueness key. 
      // If code is missing, use 'SN' + date + amount to distinguish same-day SN records
      const dateForId = lastDateStr || "01/01/2024";
      const key = `${lastSupplier}-${code || 'SN'}-${dateForId}-${amountStr || ''}`;

      if (!recordsMap.has(key)) {
        const issueDate = parseDate(dateForId);
        if (issueDate) {
          const dueDateStr = getValue(row, "FechaVenc", "Vencimiento")?.trim();
          const branch = getValue(row, "Nodo", "Sucursal")?.trim();
          const status = getValue(row, "Estado", "Situacion")?.trim();
          const opType = getValue(row, "TipoOperacion", "Operacion")?.trim();
          const amount = parseCurrency(amountStr);

          const stableId = `EXP-${lastSupplier}-${code || 'SN'}-${issueDate.getTime()}-${amount}`;
          lastRecord = {
            id: stableId,
            supplier: lastSupplier || "Desconocido",
            code: code || "S/N",
            type: getValue(row, "TipoValor", "Tipo")?.trim() || "Varios",
            amount: amount,
            issueDate: issueDate,
            dueDate: parseDate(dueDateStr) || issueDate,
            branch: branch || "N/A",
            status: status || "N/A",
            operationType: opType || "N/A",
            monthYear: format(issueDate, "yyyy-MM"),
            items: []
          };
          recordsMap.set(key, lastRecord);
        }
      } else {
        lastRecord = recordsMap.get(key)!;
      }
    }

    if (itemName && lastRecord) {
      lastRecord.items.push({
        name: itemName,
        quantity: parseCurrency(getValue(row, "Cantidad", "Cant", "Unid")) || 1,
        price: parseCurrency(getValue(row, "Precio Unitario", "Precio", "P. Unit", "Unitario")) || 0,
        category: getValue(row, "Rubro", "Categoria", "Familia")?.trim() || "Varios",
        manufacturer: getValue(row, "Fabricante", "Marca", "Laboratorio")?.trim() || "Varios"
      });
    }
  });

  return Array.from(recordsMap.values()).sort((a, b) => a.issueDate.getTime() - b.issueDate.getTime());
};

export const processCurrentAccountData = (data: any[]): CurrentAccountRecord[] => {
  const result: CurrentAccountRecord[] = [];
  let currentEntity = "";

  // The provided CSV is semicolon delimited and has a hierarchical structure
  // Row example: ;01/12/2025;;CUENTA CORRIENTE;FV B0005-00002908 / ABBONA...

  data.forEach((row, index) => {
    // PapaParse might put all content in one key if delimiter isn't auto-detected
    // but normalizeKey handles that or we look at the raw row object
    const rowValues = Object.values(row) as string[];
    const firstVal = rowValues[0]?.trim() || "";

    // 1. Detect Entity Row
    // Entity rows have values at index 3 but no date at index 0 or 1
    const isEntityRow = !rowValues[0] && !rowValues[1] && rowValues[3] &&
      !rowValues[3].toLowerCase().includes("total") &&
      !rowValues[3].toLowerCase().includes("clientes") &&
      !rowValues[3].toLowerCase().includes("documento");

    if (isEntityRow) {
      const rawVal = rowValues[3] || "";
      currentEntity = rawVal.split(';')[0].trim();
    }

    // 2. Detect Data Row (starts with a date string at rowValues[1])
    const dateStr = rowValues[1] || "";
    const date = parseDate(dateStr);

    if (date && currentEntity) {
      // In row: ;01/12/2025;;CUENTA CORRIENTE;FV B0005-00002908...;Node;Venc;Total;Acum;Pend
      const docTypeRaw = rowValues[3] || "";
      const referenceRaw = rowValues[4] || "S/N";

      // Amount is at index 10
      const amount = parseCurrency(rowValues[10]);

      // Simple accounting: Positive = Debit (Debt), Negative = Credit (Payment/CN)
      const debit = amount > 0 ? amount : 0;
      const credit = amount < 0 ? Math.abs(amount) : 0;

      // Try to extract a cleaner type from reference (e.g., FV, NC, RE)
      let type = docTypeRaw;
      if (referenceRaw.startsWith("FV ")) type = "FV";
      else if (referenceRaw.startsWith("NC ")) type = "NC";
      else if (referenceRaw.startsWith("RE ")) type = "RE";
      else if (referenceRaw.startsWith("RC ")) type = "RC";

      result.push({
        id: `CUR-${currentEntity}-${referenceRaw}-${date.getTime()}-${index}`,
        entity: currentEntity,
        date,
        type,
        reference: referenceRaw,
        description: "-",
        debit,
        credit,
        balance: amount, // Individual movement impact
        branch: rowValues[7] || "N/A"
      });
    }
  });

  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
};

// Removed amountsToSide helper as logic is moved inline for simplicity

export const processServiceData = (data: any[]): ExpenseRecord[] => {
  // Filters for only real expenses (INGRESAR FACTURA) to avoid duplicates with payments
  return processExpenseData(data);
};

export const formatMoney = (amount: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};