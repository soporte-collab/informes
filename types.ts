
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
  "_inheritedDate"?: string;
  "_inheritedNode"?: string;
  "_inheritedEntity"?: string;
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
  unitCost?: number;
  stockBalance?: number;
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
  cashAmount?: number;
  cardAmount?: number;
  osAmount?: number;
  ctacteAmount?: number;
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
  discountEntity?: number; // A cargo de OS/Seguro para este item
  discountClient?: number; // A cargo de Cliente para este item
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

export interface RawInsuranceRow {
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
}

export interface InsuranceRecord {
  id: string;
  entity: string;
  code: string;
  type: string;
  amount: number; // Monto OS (antes era amount genérico)
  totalVoucher?: number; // Total de la receta (OS + Paciente)
  discountEntity?: number; // A cargo de OS
  discountClient?: number; // A cargo de Cliente
  patientAmount?: number; // Monto a cargo del paciente
  affiliate?: string;
  plan?: string;
  issueDate: Date;
  dueDate: Date;
  branch: string;
  status: string;
  operationType: string;
  monthYear: string;
  items: ExpenseItem[];
  rawAgreements?: any[]; // Store raw agreements for backup/expansion
}

export interface StockRecord {
  id: string;
  productName: string;
  barcode: string;
  date: Date;
  location: string;
  movementType: string;
  units: number;
  currentStock: number;
  costPrice: number;
  salePrice: number;
  manufacturer: string;
  branch: string;
  invoiceNumber?: string;
  seller?: string;
  entity?: string;
}

export interface UnifiedItem {
  barcode: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  totalPrice: number;
  totalCost: number;
  profit: number;
  manufacturer: string;
  category: string;
}

export interface UnifiedTransaction {
  id: string; // Composite key or Invoice Number
  invoiceNumber: string;
  type: string; // FV, NC, TX, etc.
  date: Date;
  branch: string;
  seller: string;
  client: string;
  entity: string; // Mutual/Obra Social
  paymentMethod: string;
  totalNet: number; // From Financial record
  totalGross: number;
  totalDiscount: number;
  items: UnifiedItem[];
  hasStockDetail: boolean;
  hasFinancialDetail: boolean;
  // New granular payment fields
  cashAmount: number;
  cardAmount: number;
  osAmount: number;
  ctacteAmount: number;
}

export interface UniversalSyncResult {
  sales: SaleRecord[];
  invoices: InvoiceRecord[];
  unified: UnifiedTransaction[];
  expenses: ExpenseRecord[];
  services: ExpenseRecord[];
  insurance: InsuranceRecord[];
  currentAccounts: CurrentAccountRecord[];
  stock: StockRecord[];
}

// --- NEW TYPES FOR PAYROLL (SUELDOS) ---

export interface Employee {
  id: string;
  name: string;
  cuil: string;
  position: string;
  startDate: string;
  branch: string;
  status: 'active' | 'inactive';
  baseSalary: number;
  bankInfo?: string;
  zettiSellerName?: string; // Para vincular con ventas reales
  scheduleTemplate?: {
    entrance: string; // HH:mm
    exit: string; // HH:mm
  };
}

export interface TimeAttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  entrance1?: string;
  exit1?: string;
  entrance2?: string;
  exit2?: string;
  totalMinutes: number;
  overtimeMinutes: number;
  status: 'present' | 'absent' | 'late' | 'justified' | 'vacation' | 'medical' | 'holiday';
  isAnomaly?: boolean;
  markedWorkButNoSales?: boolean;
  salesWorkButNoClockIn?: boolean;
  notes?: string;
}

export interface EmployeeLicense {
  id: string;
  employeeId: string;
  type: 'vacation' | 'medical' | 'suspension' | 'permit' | 'other';
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

export interface SpecialPermit {
  id: string;
  employeeId: string;
  date: string;
  fromTime: string;
  toTime: string;
  reason: string;
}

export interface HolidayRecord {
  id: string;
  date: string;
  name: string;
}

export interface PayrollConcept {
  name: string;
  amount: number;
  type: 'earning' | 'deduction';
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  branch: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  netAmount: number;
  concepts: PayrollConcept[];
  observations?: string;
  monthYear: string; // "YYYY-MM"
}
