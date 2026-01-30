import { db, auth, storage } from '../src/firebaseConfig';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { SaleRecord, InvoiceRecord, ExpenseRecord, CurrentAccountRecord } from '../types';

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
  sales: SaleRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, sales.length);
  await saveJsonToStorage(sales, 'sales.json');
  if (onProgress) onProgress(sales.length, sales.length);
};

export const getAllSalesFromDB = async (): Promise<SaleRecord[]> => {
  const rawData = await loadJsonFromStorage('sales.json');
  return rawData.map((item: any) => ({
    ...item,
    date: new Date(item.date)
  }));
};

// --- INVOICES FUNCTIONS ---

export const saveInvoicesToDB = async (
  invoices: InvoiceRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, invoices.length);
  await saveJsonToStorage(invoices, 'invoices.json');
  if (onProgress) onProgress(invoices.length, invoices.length);
};

export const getAllInvoicesFromDB = async (): Promise<InvoiceRecord[]> => {
  const rawData = await loadJsonFromStorage('invoices.json');
  return rawData.map((item: any) => ({
    ...item,
    date: new Date(item.date)
  }));
};

// --- EXPENSES FUNCTIONS ---

export const saveExpensesToDB = async (
  expenses: ExpenseRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, expenses.length);
  await saveJsonToStorage(expenses, 'expenses.json');
  if (onProgress) onProgress(expenses.length, expenses.length);
};

export const getAllExpensesFromDB = async (): Promise<ExpenseRecord[]> => {
  const rawData = await loadJsonFromStorage('expenses.json');
  return rawData.map((item: any) => ({
    ...item,
    issueDate: new Date(item.issueDate),
    dueDate: new Date(item.dueDate),
    items: item.items || []
  }));
};

// --- CURRENT ACCOUNTS FUNCTIONS ---

export const saveCurrentAccountsToDB = async (
  records: CurrentAccountRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, records.length);
  await saveJsonToStorage(records, 'current_accounts.json');
  if (onProgress) onProgress(records.length, records.length);
};

export const getAllCurrentAccountsFromDB = async (): Promise<CurrentAccountRecord[]> => {
  const rawData = await loadJsonFromStorage('current_accounts.json');
  return rawData.map((item: any) => ({
    ...item,
    date: new Date(item.date)
  }));
};

// --- SERVICES FUNCTIONS ---

export const saveServicesToDB = async (
  services: ExpenseRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<void> => {
  if (onProgress) onProgress(0, services.length);
  await saveJsonToStorage(services, 'services.json');
  if (onProgress) onProgress(services.length, services.length);
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
  return await loadJsonFromStorage('product_master.json');
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
    const metaSerRef = ref(storage, `${SHARED_PATH_PREFIX}/meta_service_categories.json`);

    // Try deleting, ignore if not found
    try { await deleteObject(salesRef); } catch (e) { }
    try { await deleteObject(invRef); } catch (e) { }
    try { await deleteObject(expRef); } catch (e) { }
    try { await deleteObject(curRef); } catch (e) { }
    try { await deleteObject(serRef); } catch (e) { }
    try { await deleteObject(metaSerRef); } catch (e) { }
  } catch (error) {
    console.error("Error clearing storage:", error);
    throw error;
  }
};

// --- PURGE BY DATE FUNCTIONS ---

export const purgeDataByDate = async (targetDate: string): Promise<{ invoicesRemoved: number; salesRemoved: number }> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Debes estar logueado para modificar datos.");

  // Load current data
  const invoices = await getAllInvoicesFromDB();
  const sales = await getAllSalesFromDB();

  // Filter OUT records from the target date
  const targetDateStart = new Date(targetDate + 'T00:00:00');
  const targetDateEnd = new Date(targetDate + 'T23:59:59');

  const filteredInvoices = invoices.filter(inv => {
    const d = new Date(inv.date);
    return d < targetDateStart || d > targetDateEnd;
  });

  const filteredSales = sales.filter(sale => {
    const d = new Date(sale.date);
    return d < targetDateStart || d > targetDateEnd;
  });

  const invoicesRemoved = invoices.length - filteredInvoices.length;
  const salesRemoved = sales.length - filteredSales.length;

  // Save back the filtered data
  await saveInvoicesToDB(filteredInvoices);
  await saveSalesToDB(filteredSales);

  console.log(`[PURGE] Removed ${invoicesRemoved} invoices and ${salesRemoved} sales for date ${targetDate}`);

  return { invoicesRemoved, salesRemoved };
};

export const purgeDataByDateRange = async (startDate: string, endDate: string): Promise<{ invoicesRemoved: number; salesRemoved: number }> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Debes estar logueado para modificar datos.");

  // Load current data
  const invoices = await getAllInvoicesFromDB();
  const sales = await getAllSalesFromDB();

  // Filter OUT records within the date range (inclusive)
  const rangeStart = new Date(startDate + 'T00:00:00');
  const rangeEnd = new Date(endDate + 'T23:59:59');

  const filteredInvoices = invoices.filter(inv => {
    const d = new Date(inv.date);
    return d < rangeStart || d > rangeEnd;
  });

  const filteredSales = sales.filter(sale => {
    const d = new Date(sale.date);
    return d < rangeStart || d > rangeEnd;
  });

  const invoicesRemoved = invoices.length - filteredInvoices.length;
  const salesRemoved = sales.length - filteredSales.length;

  // Save back the filtered data
  await saveInvoicesToDB(filteredInvoices);
  await saveSalesToDB(filteredSales);

  console.log(`[PURGE] Removed ${invoicesRemoved} invoices and ${salesRemoved} sales from ${startDate} to ${endDate}`);

  return { invoicesRemoved, salesRemoved };
};
