
export interface RawCsvRow {
  "Tipo Comprobante": string;
  "Nro": string;
  "Fecha Ticket": string;
  "Producto": string;
  "Cantidad": string;
  "$": string; // Unit Price
  "Comision": string; // Appears to be Total in the provided snippet, but we will calc manually
  "Usuario": string;
  "Alias": string;
  "Nodo_venta": string;
  "Rubro": string;
  "Fabricante": string;
  "Obs": string;
  "Cliente": string;
  "Entidad": string; // We will focus on this one
}

export interface SaleRecord {
  id: string;
  date: Date;
  monthYear: string; // Format "YYYY-MM" for sorting/grouping
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  sellerName: string;
  branch: string; // "BIOSALUD CHACRAS PARK" or "FCIA BIOSALUD"
  hour: number;
  category: string;
  manufacturer: string;
  invoiceNumber: string; // Key for joining with InvoiceRecord
  entity: string; // Changed from client to entity for broader filtering
  paymentMethod?: string; // Derived from Invoice
  barcode?: string;
}

// --- NEW TYPES FOR ADVANCED INVOICE DASHBOARD ---

export interface RawInvoiceRow {
  "Nodo": string;
  "Fecha y Hora": string;
  "Tipo Cmp.": string;
  "Nro de Comprobante": string;
  "Vendedor": string;
  "Cliente": string;
  "Entidad Agrupadora": string;
  "Obra Social": string;
  "Tarjeta": string;
  "Imp. Neto": string;
  "Imp. Bruto": string;
  "Imp. Dto/Rec": string;
  "Anulado": string;
}

export interface InvoiceRecord {
  id: string;
  date: Date;
  monthYear: string;
  branch: string;
  type: string; // FV B, NC B, etc.
  invoiceNumber: string;
  seller: string;
  client: string;
  entity: string; // Entidad Agrupadora
  insurance: string; // Obra Social
  paymentType: string; // Tarjeta / Medio de Pago
  netAmount: number; // Imp. Neto
  grossAmount: number; // Imp. Bruto
  discount: number; // Imp. Dto/Rec
}

export interface MonthlyStats {
  month: string;
  totalSales: number;
  transactionCount: number;
}

export interface SellerStats {
  name: string;
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  topProduct: string;
}

export interface ProductRank {
  name: string;
  quantity: number;
  revenue: number;
}

export interface BranchStats {
  name: string;
  value: number;
}

export interface HourlyStats {
  hour: number;
  count: number;
  sales: number;
}

// --- NEW TYPES FOR EXPENSES (GASTOS) ---

export interface RawExpenseRow {
  "Entidad": string;
  "Codificacion": string;
  "TipoValor": string;
  "EntSec": string;
  "Monto": string;
  "FechaEmision": string;
  "FechaVenc": string;
  "Nodo": string;
  "Estado": string;
  "Transmision": string;
  "TipoOperacion": string;
  "Item"?: string;
  "Cantidad"?: string;
  "Precio Unitario"?: string;
  "Rubro"?: string;
  "Fabricante"?: string;
}

export interface ExpenseItem {
  name: string;
  quantity: number;
  price: number;
  category: string;
  manufacturer: string;
}

export interface ExpenseRecord {
  id: string;
  supplier: string;
  code: string;
  type: string;
  amount: number;
  issueDate: Date;
  dueDate: Date;
  branch: string;
  status: string;
  operationType: string;
  monthYear: string;
  items: ExpenseItem[];
}

export interface CurrentAccountRecord {
  id: string;
  entity: string;
  date: Date;
  type: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  branch?: string;
}
