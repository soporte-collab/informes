import { db, auth, storage } from '../src/firebaseConfig';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { SaleRecord, InvoiceRecord, ExpenseRecord, CurrentAccountRecord, InsuranceRecord, StockRecord, UnifiedTransaction } from '../types';

const SHARED_PATH_PREFIX = 'reports_data';

// Generic helper to save JSON to Firebase Storage
const saveJsonToStorage = async (data: any, fileName: string): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Debes estar logueado para guardar datos.");

  const storageRef = ref(storage, `${SHARED_PATH_PREFIX}/${fileName}`);
  const jsonString = JSON.stringify(data);

  await uploadString(storageRef, jsonString, 'raw', {
    contentType: 'application/json',
  });

  return getDownloadURL(storageRef);
};

// Generic helper to load JSON from Firebase Storage
const loadJsonFromStorage = async (fileName: string): Promise<any> => {
  try {
    const storageRef = ref(storage, `${SHARED_PATH_PREFIX}/${fileName}`);
    const url = await getDownloadURL(storageRef);
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.warn(`Could not load ${fileName}, it might not exist yet.`);
    return [];
  }
};

export const testConnection = async () => {
  return !!auth.currentUser;
};

// --- SALES FUNCTIONS ---

export const saveSalesToDB = async (
  newSales: SaleRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, newSales.length);

  const existingRecords = await getAllSalesFromDB();
  const map = new Map<string, SaleRecord>();

  existingRecords.forEach(r => map.set(r.id, r));
  newSales.forEach(r => map.set(r.id, r));

  const merged = Array.from(map.values());
  await saveJsonToStorage(merged, 'sales.json');

  if (onProgress) onProgress(newSales.length, newSales.length);
};

export const getAllSalesFromDB = async (): Promise<SaleRecord[]> => {
  const rawData = await loadJsonFromStorage('sales.json');
  if (!Array.isArray(rawData)) return [];
  return rawData.map((item: any) => ({
    ...item,
    date: new Date(item.date)
  }));
};

// --- INVOICES FUNCTIONS ---

export const saveInvoicesToDB = async (
  newInvoices: InvoiceRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, newInvoices.length);

  const existingRecords = await getAllInvoicesFromDB();
  const map = new Map<string, InvoiceRecord>();

  existingRecords.forEach(r => map.set(r.id, r));
  newInvoices.forEach(r => map.set(r.id, r));

  const merged = Array.from(map.values());
  await saveJsonToStorage(merged, 'invoices.json');

  if (onProgress) onProgress(newInvoices.length, newInvoices.length);
};

export const getAllInvoicesFromDB = async (): Promise<InvoiceRecord[]> => {
  const rawData = await loadJsonFromStorage('invoices.json');
  if (!Array.isArray(rawData)) return [];
  return rawData.map((item: any) => ({
    ...item,
    date: new Date(item.date)
  }));
};

// --- EXPENSES FUNCTIONS ---

export const saveExpensesToDB = async (
  newExpenses: ExpenseRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, newExpenses.length);

  const existingRecords = await getAllExpensesFromDB();
  const map = new Map<string, ExpenseRecord>();

  existingRecords.forEach(r => map.set(r.id, r));
  newExpenses.forEach(r => map.set(r.id, r));

  const merged = Array.from(map.values());
  await saveJsonToStorage(merged, 'expenses.json');

  if (onProgress) onProgress(newExpenses.length, newExpenses.length);
};

export const getAllExpensesFromDB = async (): Promise<ExpenseRecord[]> => {
  const rawData = await loadJsonFromStorage('expenses.json');
  if (!Array.isArray(rawData)) return [];
  return rawData.map((item: any) => ({
    ...item,
    issueDate: new Date(item.issueDate),
    dueDate: new Date(item.dueDate),
    items: item.items || []
  }));
};

// --- CURRENT ACCOUNTS FUNCTIONS ---

export const saveCurrentAccountsToDB = async (
  newRecords: CurrentAccountRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, newRecords.length);

  const existingRecords = await getAllCurrentAccountsFromDB();
  const map = new Map<string, CurrentAccountRecord>();

  existingRecords.forEach(r => map.set(r.id, r));
  newRecords.forEach(r => map.set(r.id, r));

  const merged = Array.from(map.values());
  await saveJsonToStorage(merged, 'current_accounts.json');

  if (onProgress) onProgress(newRecords.length, newRecords.length);
};

export const getAllCurrentAccountsFromDB = async (): Promise<CurrentAccountRecord[]> => {
  const rawData = await loadJsonFromStorage('current_accounts.json');
  if (!Array.isArray(rawData)) return [];
  return rawData.map((item: any) => ({
    ...item,
    date: new Date(item.date)
  }));
};

// --- SERVICES FUNCTIONS ---

export const saveServicesToDB = async (
  newServices: ExpenseRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, newServices.length);

  const existingRecords = await getAllServicesFromDB();
  const map = new Map<string, ExpenseRecord>();

  existingRecords.forEach(r => map.set(r.id, r));
  newServices.forEach(r => map.set(r.id, r));

  const merged = Array.from(map.values());
  await saveJsonToStorage(merged, 'services.json');

  if (onProgress) onProgress(newServices.length, newServices.length);
};

export const getAllServicesFromDB = async (): Promise<ExpenseRecord[]> => {
  const rawData = await loadJsonFromStorage('services.json');
  return rawData.map((item: any) => ({
    ...item,
    issueDate: new Date(item.issueDate),
    dueDate: new Date(item.dueDate),
    items: item.items || []
  }));
};

// --- INSURANCE FUNCTIONS ---

export const saveInsuranceToDB = async (
  newRecords: InsuranceRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, newRecords.length);

  const existingRecords = await getAllInsuranceFromDB();
  const map = new Map<string, InsuranceRecord>();

  existingRecords.forEach(r => map.set(r.id, r));
  newRecords.forEach(r => map.set(r.id, r));

  const merged = Array.from(map.values());
  await saveJsonToStorage(merged, 'insurance.json');

  if (onProgress) onProgress(newRecords.length, newRecords.length);
};

export const getAllInsuranceFromDB = async (): Promise<InsuranceRecord[]> => {
  const rawData = await loadJsonFromStorage('insurance.json');
  return rawData.map((item: any) => ({
    ...item,
    issueDate: new Date(item.issueDate),
    dueDate: new Date(item.dueDate),
    items: item.items || []
  }));
};

// --- PRODUCT MASTER FUNCTIONS ---

export const saveProductMasterToDB = async (
  master: any[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, master.length);
  await saveJsonToStorage(master, 'product_master.json');
  if (onProgress) onProgress(master.length, master.length);
};

export const getAllProductMasterFromDB = async (): Promise<any[]> => {
  const rawData = await loadJsonFromStorage('product_master.json');
  return Array.isArray(rawData) ? rawData : [];
};

// --- METADATA / SETTINGS FUNCTIONS ---

export const getMetadata = async (docId: string): Promise<any> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    // Using Storage for simplicity since the project already uses it for all JSON data
    const storageRef = ref(storage, `${SHARED_PATH_PREFIX}/meta_${docId}.json`);
    const url = await getDownloadURL(storageRef);
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    return null;
  }
};

export const saveMetadata = async (docId: string, data: any): Promise<void> => {
  await saveJsonToStorage(data, `meta_${docId}.json`);
};

// --- GENERAL UTILS ---

export const clearDB = async (): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) return; // Can't clear if not logged in

    const salesRef = ref(storage, `${SHARED_PATH_PREFIX}/sales.json`);
    const invRef = ref(storage, `${SHARED_PATH_PREFIX}/invoices.json`);
    const expRef = ref(storage, `${SHARED_PATH_PREFIX}/expenses.json`);
    const curRef = ref(storage, `${SHARED_PATH_PREFIX}/current_accounts.json`);
    const serRef = ref(storage, `${SHARED_PATH_PREFIX}/services.json`);
    const insRef = ref(storage, `${SHARED_PATH_PREFIX}/insurance.json`);
    const stockRef = ref(storage, `${SHARED_PATH_PREFIX}/stock.json`);
    const metaSerRef = ref(storage, `${SHARED_PATH_PREFIX}/meta_service_categories.json`);

    // Try deleting, ignore if not found
    try { await deleteObject(salesRef); } catch (e) { }
    try { await deleteObject(invRef); } catch (e) { }
    try { await deleteObject(expRef); } catch (e) { }
    try { await deleteObject(curRef); } catch (e) { }
    try { await deleteObject(serRef); } catch (e) { }
    try { await deleteObject(insRef); } catch (e) { }
    try { await deleteObject(stockRef); } catch (e) { }
    try { await deleteObject(metaSerRef); } catch (e) { }
  } catch (error) {
    console.error("Error clearing storage:", error);
    throw error;
  }
};

// --- PURGE BY DATE FUNCTIONS ---

export const purgeDataByDateRange = async (startDate: string, endDate: string): Promise<{
  invoicesRemoved: number;
  salesRemoved: number;
  expensesRemoved: number;
  servicesRemoved: number;
  insuranceRemoved: number;
  currentAccountsRemoved: number;
  stockRemoved: number;
}> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Debes estar logueado para modificar datos.");

  // Load all current data
  const [invoices, sales, expenses, services, insurance, accounts, stock] = await Promise.all([
    getAllInvoicesFromDB(),
    getAllSalesFromDB(),
    getAllExpensesFromDB(),
    getAllServicesFromDB(),
    getAllInsuranceFromDB(),
    getAllCurrentAccountsFromDB(),
    getAllStockFromDB()
  ]);

  // Filter OUT records within the date range (inclusive)
  const rangeStart = new Date(startDate + 'T00:00:00');
  const rangeEnd = new Date(endDate + 'T23:59:59');

  const filteredInvoices = invoices.filter(inv => {
    const d = new Date(inv.date);
    return d < rangeStart || d > rangeEnd;
  });

  const filteredSales = sales.filter(s => {
    const d = new Date(s.date);
    return d < rangeStart || d > rangeEnd;
  });

  const filteredExpenses = expenses.filter(e => {
    const d = new Date(e.issueDate);
    return d < rangeStart || d > rangeEnd;
  });

  const filteredServices = services.filter(s => {
    const d = new Date(s.issueDate);
    return d < rangeStart || d > rangeEnd;
  });

  const filteredInsurance = insurance.filter(i => {
    const d = new Date(i.issueDate);
    return d < rangeStart || d > rangeEnd;
  });

  const filteredAccounts = accounts.filter(a => {
    const d = new Date(a.date);
    return d < rangeStart || d > rangeEnd;
  });

  const filteredStock = stock.filter(s => {
    const d = new Date(s.date);
    return d < rangeStart || d > rangeEnd;
  });

  const result = {
    invoicesRemoved: invoices.length - filteredInvoices.length,
    salesRemoved: sales.length - filteredSales.length,
    expensesRemoved: expenses.length - filteredExpenses.length,
    servicesRemoved: services.length - filteredServices.length,
    insuranceRemoved: insurance.length - filteredInsurance.length,
    currentAccountsRemoved: accounts.length - filteredAccounts.length,
    stockRemoved: stock.length - filteredStock.length
  };

  // Save back the filtered data
  await Promise.all([
    saveJsonToStorage(filteredInvoices, 'invoices.json'),
    saveJsonToStorage(filteredSales, 'sales.json'),
    saveJsonToStorage(filteredExpenses, 'expenses.json'),
    saveJsonToStorage(filteredServices, 'services.json'),
    saveJsonToStorage(filteredInsurance, 'insurance.json'),
    saveJsonToStorage(filteredAccounts, 'current_accounts.json'),
    saveJsonToStorage(filteredStock, 'stock.json')
  ]);

  console.log(`[PURGE] Range: ${startDate} to ${endDate} completed.`);
  return result;
};
// --- STOCK FUNCTIONS ---

export const saveStockToDB = async (
  newStock: StockRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, newStock.length);

  const existingRecords = await getAllStockFromDB();
  const map = new Map<string, StockRecord>();

  existingRecords.forEach(r => map.set(r.id, r));
  newStock.forEach(r => map.set(r.id, r));

  const merged = Array.from(map.values());
  await saveJsonToStorage(merged, 'stock.json');

  if (onProgress) onProgress(newStock.length, newStock.length);
};

export const getAllStockFromDB = async (): Promise<StockRecord[]> => {
  const rawData = await loadJsonFromStorage('stock.json');
  if (!Array.isArray(rawData)) return [];
  return rawData.map((item: any) => ({
    ...item,
    date: new Date(item.date)
  }));
};

// --- UNIFIED TRANSACTIONS FUNCTIONS ---

export const saveUnifiedToDB = async (
  newUnified: UnifiedTransaction[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, newUnified.length);

  const existingRecords = await getAllUnifiedFromDB();
  const map = new Map<string, UnifiedTransaction>();

  existingRecords.forEach(r => map.set(r.id, r));
  newUnified.forEach(r => map.set(r.id, r));

  const merged = Array.from(map.values());
  await saveJsonToStorage(merged, 'unified.json');

  if (onProgress) onProgress(newUnified.length, newUnified.length);
};

export const getAllUnifiedFromDB = async (): Promise<UnifiedTransaction[]> => {
  const rawData = await loadJsonFromStorage('unified.json');
  if (!Array.isArray(rawData)) return [];
  return rawData.map((item: any) => ({
    ...item,
    date: new Date(item.date)
  }));
};
