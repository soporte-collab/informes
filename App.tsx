import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SaleRecord, InvoiceRecord, ExpenseRecord, CurrentAccountRecord } from './types';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { InvoiceDashboard } from './components/InvoiceDashboard';
import { ExpensesDashboard } from './components/ExpensesDashboard';
import { ServicesDashboard } from './components/ServicesDashboard';
import { CurrentAccountDashboard } from './components/CurrentAccountDashboard';
import { SellerDetail } from './components/SellerDetail';
import { CrossedAnalytics } from './components/CrossedAnalytics';
import { ZettiSync } from './components/ZettiSync';
import { Login } from './components/Login';
import { PrintReport } from './components/PrintReport';
import { ShoppingAssistant } from './components/ShoppingAssistant';
import { Activity, LogOut, Trash2, HardDrive, BarChart3, FileText, Radar, Upload, FileText as FileTextIcon, User, RefreshCw, ShoppingCart, Wallet, Lightbulb, CloudLightning } from 'lucide-react';
import { getAllSalesFromDB, saveSalesToDB, clearDB, saveInvoicesToDB, getAllInvoicesFromDB, getAllExpensesFromDB, saveExpensesToDB, getAllCurrentAccountsFromDB, saveCurrentAccountsToDB, getAllServicesFromDB, saveServicesToDB } from './utils/db';
import { auth } from './src/firebaseConfig';
import * as firebaseAuth from 'firebase/auth';
import Papa from 'papaparse';
import { processInvoiceData, processTimeSyncData, processExpenseData, processCurrentAccountData, processServiceData } from './utils/dataHelpers';
import { format, getHours } from 'date-fns';

const App: React.FC = () => {
    const [user, setUser] = useState<firebaseAuth.User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // Initial states set to null to indicate "Not Loaded Yet"
    const [salesData, setSalesData] = useState<SaleRecord[] | null>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceRecord[] | null>(null);
    const [expenseData, setExpenseData] = useState<ExpenseRecord[] | null>(null);
    const [serviceData, setServiceData] = useState<ExpenseRecord[] | null>(null);
    const [currentAccountData, setCurrentAccountData] = useState<CurrentAccountRecord[] | null>(null);

    const [loading, setLoading] = useState(true);
    const [timeSyncData, setTimeSyncData] = useState<Array<{ ticket: string, date: Date }> | null>(null);
    const [activeTab, setActiveTab] = useState<'sales' | 'invoices' | 'crossed' | 'expenses' | 'debts' | 'services' | 'zetti' | 'shopping'>('sales');
    const [uploadProgress, setUploadProgress] = useState<{ processed: number; total: number } | null>(null);
    const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
    const [sellerFilter, setSellerFilter] = useState<string>('all');
    const [showReport, setShowReport] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [excludedProducts, setExcludedProducts] = useState<string[]>([]);
    const [includedProducts, setIncludedProducts] = useState<string[]>([]);
    const [excludedEntities, setExcludedEntities] = useState<string[]>([]);
    const [includedEntities, setIncludedEntities] = useState<string[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const invoiceFileInputRef = useRef<HTMLInputElement>(null);
    const expenseFileInputRef = useRef<HTMLInputElement>(null);
    const serviceFileInputRef = useRef<HTMLInputElement>(null);
    const currentAccountFileInputRef = useRef<HTMLInputElement>(null);

    // Auth monitor
    useEffect(() => {
        const unsubscribe = firebaseAuth.onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
            if (!currentUser) {
                setSalesData(null);
                setInvoiceData(null);
                setExpenseData(null);
                setServiceData(null);
                setCurrentAccountData(null);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // Data loader
    useEffect(() => {
        const loadAllData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // Initialize with empty arrays to prevent "stuck in upload" screen if file exists but empty
                // and to indicate that we ATTEMPTED to load.
                const [s, i, e, ser, c] = await Promise.all([
                    getAllSalesFromDB(),
                    getAllInvoicesFromDB(),
                    getAllExpensesFromDB(),
                    getAllServicesFromDB(),
                    getAllCurrentAccountsFromDB()
                ]);

                setSalesData(s || []);
                setInvoiceData(i || []);
                setExpenseData(e || []);
                setServiceData(ser || []);
                setCurrentAccountData(c || []);

                console.log("Database successfully loaded from Firebase Storage.");
            } catch (error: any) {
                console.error("Failed to load from Cloud DB", error);
                // Fallback to empty arrays so the UI can at least show empty dashboards
                setSalesData([]);
                setInvoiceData([]);
                setExpenseData([]);
                setServiceData([]);
                setCurrentAccountData([]);
            } finally {
                setLoading(false);
            }
        };

        if (!authLoading && user) {
            loadAllData();
        }
    }, [user, authLoading]);

    const enrichedSalesData = useMemo(() => {
        if (!salesData || salesData.length === 0) return salesData;
        if ((!invoiceData || invoiceData.length === 0) && (!timeSyncData || timeSyncData.length === 0)) {
            return salesData;
        }

        const generateKeys = (nro: any) => {
            const keys = new Set<string>();
            if (!nro) return keys;
            const cleanNro = String(nro).trim();
            keys.add(cleanNro);
            const alphaNum = cleanNro.replace(/[^a-zA-Z0-9]/g, '');
            if (alphaNum) keys.add(alphaNum);

            if (cleanNro.includes('-')) {
                const parts = cleanNro.split('-');
                const cleanParts = parts.map(p => p.replace(/\D/g, '').replace(/^0+/, '')).filter(p => p !== '');
                if (cleanParts.length > 0) {
                    keys.add(cleanParts.join('-'));
                    keys.add(cleanParts.join(''));
                }
                const last = cleanParts[cleanParts.length - 1];
                if (last) keys.add(last);
            } else {
                const digits = cleanNro.replace(/\D/g, '').replace(/^0+/, '');
                if (digits) keys.add(digits);
            }
            return keys;
        };

        const timeSyncMap = new Map<string, Date>();
        if (timeSyncData) {
            timeSyncData.forEach(item => {
                const keys = generateKeys(item.ticket);
                keys.forEach(k => {
                    if (!timeSyncMap.has(k)) timeSyncMap.set(k, item.date);
                });
            });
        }

        const smartInvoiceMap = new Map<string, { entity: string, date: Date, paymentType?: string }>();
        if (invoiceData) {
            // Sort invoiceData to prioritize "real-looking" times over "dummy-looking" times (12:xx)
            // This ensures that when we build the map, the "best" info for each ticket number wins.
            const sortedInvoices = [...invoiceData].sort((a, b) => {
                const aIsDummy = a.date.getHours() === 12;
                const bIsDummy = b.date.getHours() === 12;
                if (aIsDummy && !bIsDummy) return 1;
                if (!aIsDummy && bIsDummy) return -1;
                return b.date.getTime() - a.date.getTime(); // Latest first if same quality
            });

            sortedInvoices.forEach(inv => {
                if (inv.invoiceNumber) {
                    const keys = generateKeys(inv.invoiceNumber);
                    let bestEntity = "Particular";
                    if (inv.entity && inv.entity !== 'Particular' && inv.entity.length > 2) {
                        bestEntity = inv.entity;
                    }
                    const info = { entity: bestEntity, date: inv.date, paymentType: inv.paymentType };
                    keys.forEach(k => {
                        // We set it if not exists OR if the new one is better (not dummy)
                        const existing = smartInvoiceMap.get(k);
                        const isBetter = !existing || (existing.date.getHours() === 12 && inv.date.getHours() !== 12);
                        if (isBetter) smartInvoiceMap.set(k, info);
                    });
                }
            });
        }

        return salesData.map(sale => {
            const saleKeys = generateKeys(sale.invoiceNumber);
            let newDate: Date | null = null;
            for (const key of saleKeys) {
                if (timeSyncMap.has(key)) {
                    newDate = timeSyncMap.get(key)!;
                    break;
                }
            }

            let newEntity = sale.entity;
            let newPaymentMethod = sale.paymentMethod;
            let invoiceMatch = false;

            for (const key of saleKeys) {
                if (smartInvoiceMap.has(key)) {
                    const info = smartInvoiceMap.get(key)!;
                    if (info.entity !== 'Particular') newEntity = info.entity;
                    if (info.paymentType) newPaymentMethod = info.paymentType;
                    if (!newDate) newDate = info.date;
                    invoiceMatch = true;
                    break;
                }
            }

            if (newDate || invoiceMatch) {
                const finalDate = newDate || sale.date;
                return {
                    ...sale,
                    entity: newEntity,
                    date: finalDate,
                    hour: getHours(finalDate),
                    monthYear: format(finalDate, 'yyyy-MM'),
                    paymentMethod: newPaymentMethod
                };
            }
            return sale;
        });
    }, [salesData, invoiceData, timeSyncData]);

    const uniqueSellers = useMemo(() => {
        if (!enrichedSalesData) return [];
        const sellers = new Set(enrichedSalesData.map(s => s.sellerName));
        return Array.from(sellers).sort();
    }, [enrichedSalesData]);

    // UPLOAD HANDLERS
    const handleSalesUpload = async (newRecords: SaleRecord[]) => {
        setLoading(true);
        setUploadProgress({ processed: 0, total: newRecords.length });
        try {
            const currentData = salesData || [];
            const dataMap = new Map<string, SaleRecord>();
            currentData.forEach(r => dataMap.set(r.id, r));
            newRecords.forEach(r => dataMap.set(r.id, r));
            const combinedData = Array.from(dataMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

            await saveSalesToDB(combinedData, (p, t) => setUploadProgress({ processed: p, total: t }));
            setSalesData(combinedData);
            alert("✅ Ventas y productos actualizados correctamente.");
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
            setUploadProgress(null);
        }
    };

    const handleInvoiceUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        setLoading(true);
        Papa.parse(files[0], {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
            complete: async (results) => {
                try {
                    const processedData = processInvoiceData(results.data);
                    const dataMap = new Map<string, InvoiceRecord>();
                    (invoiceData || []).forEach(i => dataMap.set(i.id, i));
                    processedData.forEach(i => dataMap.set(i.id, i));
                    const combinedData = Array.from(dataMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
                    setUploadProgress({ processed: 0, total: combinedData.length });
                    await saveInvoicesToDB(combinedData, (p, t) => setUploadProgress({ processed: p, total: t }));
                    setInvoiceData(combinedData);
                } finally {
                    setLoading(false);
                    setUploadProgress(null);
                }
            }
        });
        event.target.value = '';
    };

    const handleExpenseUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        setLoading(true);
        Papa.parse(files[0], {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
            complete: async (results) => {
                try {
                    const processedData = processExpenseData(results.data);
                    const dataMap = new Map<string, ExpenseRecord>();
                    (expenseData || []).forEach(e => dataMap.set(e.id, e));
                    processedData.forEach(e => dataMap.set(e.id, e));
                    const combinedData = Array.from(dataMap.values()).sort((a, b) => a.issueDate.getTime() - b.issueDate.getTime());
                    setUploadProgress({ processed: 0, total: combinedData.length });
                    await saveExpensesToDB(combinedData, (p, t) => setUploadProgress({ processed: p, total: t }));
                    setExpenseData(combinedData);
                } finally {
                    setLoading(false);
                    setUploadProgress(null);
                }
            }
        });
        event.target.value = '';
    };

    const handleServiceUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        setLoading(true);
        Papa.parse(files[0], {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
            complete: async (results) => {
                try {
                    const processedData = processServiceData(results.data);
                    const dataMap = new Map<string, ExpenseRecord>();
                    (serviceData || []).forEach(e => dataMap.set(e.id, e));
                    processedData.forEach(e => dataMap.set(e.id, e));
                    const combinedData = Array.from(dataMap.values()).sort((a, b) => a.issueDate.getTime() - b.issueDate.getTime());
                    setUploadProgress({ processed: 0, total: combinedData.length });
                    await saveServicesToDB(combinedData, (p, t) => setUploadProgress({ processed: p, total: t }));
                    setServiceData(combinedData);
                } finally {
                    setLoading(false);
                    setUploadProgress(null);
                }
            }
        });
        event.target.value = '';
    };

    const handleCurrentAccountUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        setLoading(true);
        Papa.parse(files[0], {
            header: false,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const processedData = processCurrentAccountData(results.data);
                    const dataMap = new Map<string, CurrentAccountRecord>();
                    (currentAccountData || []).forEach(r => dataMap.set(r.id, r));
                    processedData.forEach(r => dataMap.set(r.id, r));
                    const combinedData = Array.from(dataMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
                    setUploadProgress({ processed: 0, total: combinedData.length });
                    await saveCurrentAccountsToDB(combinedData, (p, t) => setUploadProgress({ processed: p, total: t }));
                    setCurrentAccountData(combinedData);
                } finally {
                    setLoading(false);
                    setUploadProgress(null);
                }
            }
        });
        event.target.value = '';
    };

    const handleClearData = async () => {
        if (window.confirm("⚠️ ¿Desea borrar TODA la base de datos compartida?")) {
            setLoading(true);
            try {
                await clearDB();
                setSalesData([]);
                setInvoiceData([]);
                setExpenseData([]);
                setServiceData([]);
                setCurrentAccountData([]);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleZettiImport = async (data: any) => {
        let newInvoices: InvoiceRecord[] = [];
        let newSales: SaleRecord[] = [];

        // Support both legacy (array) and new (object) formats
        if (Array.isArray(data)) {
            newInvoices = data;
        } else {
            newInvoices = data.invoices || [];
            newSales = data.sales || [];
        }

        let updatedInvoices = false;
        let updatedSales = false;

        // 1. Process Invoices
        if (newInvoices.length > 0) {
            const currentInvoices = invoiceData || [];
            const existingInvIds = new Set(currentInvoices.map(i => i.id));
            // Also check invoiceNumber to avoid duplicate business records even if ID differs slightly
            const existingInvNumbers = new Set(currentInvoices.map(i => i.invoiceNumber));

            const uniqueInvoices = newInvoices.filter(i =>
                !existingInvIds.has(i.id) && !existingInvNumbers.has(i.invoiceNumber)
            );

            if (uniqueInvoices.length > 0) {
                const merged = [...currentInvoices, ...uniqueInvoices];
                setInvoiceData(merged);
                await saveInvoicesToDB(merged);
                updatedInvoices = true;
                console.log(`[IMPORT] Added ${uniqueInvoices.length} new invoices.`);
            }
        }

        // 2. Process Sales
        if (newSales.length > 0) {
            const currentSales = salesData || [];
            const existingSaleIds = new Set(currentSales.map(s => s.id));

            const uniqueSales = newSales.filter(s => !existingSaleIds.has(s.id));

            if (uniqueSales.length > 0) {
                const merged = [...currentSales, ...uniqueSales];
                setSalesData(merged);
                await saveSalesToDB(merged);
                updatedSales = true;
                console.log(`[IMPORT] Added ${uniqueSales.length} new sales items.`);
            }
        }

        if (updatedInvoices || updatedSales) {
            alert(`¡Importación Existosa!\nSe añadieron:\n- ${newInvoices.length} Comprobantes\n- ${newSales.length} Ítems de Venta\n\nLa base de datos se ha actualizado correctamente.`);
        } else {
            alert("No se encontraron registros nuevos relevantes (ya existían en la base de datos).");
        }
    };

    if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-biosalud-600"></div></div>;
    if (!user) return <Login />;

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 pb-12 no-print font-sans">
            {/* Hidden native inputs for custom triggers */}
            <input type="file" ref={invoiceFileInputRef} onChange={handleInvoiceUpload} accept=".csv" className="hidden" />
            <input type="file" ref={expenseFileInputRef} onChange={handleExpenseUpload} accept=".csv" className="hidden" />
            <input type="file" ref={serviceFileInputRef} onChange={handleServiceUpload} accept=".csv" className="hidden" />
            <input type="file" ref={currentAccountFileInputRef} onChange={handleCurrentAccountUpload} accept=".csv" className="hidden" />

            <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center gap-2">
                            <Activity className="w-6 h-6 text-biosalud-600" />
                            <span className="font-bold text-xl tracking-tight">BioSalud <span className="text-biosalud-600">Analytics</span></span>
                        </div>

                        <div className="hidden md:flex bg-gray-100 p-1 rounded-xl items-center my-2">
                            <button
                                onClick={() => setActiveTab('zetti')}
                                className={`px-4 py-3 rounded-xl text-sm font-black flex items-center gap-2 transition-all ${activeTab === 'zetti'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105'
                                    : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                <CloudLightning className="w-5 h-5" />
                                <span className="hidden md:inline">Zetti API</span>
                            </button>

                            <div className="w-px h-6 bg-slate-100 mx-2"></div>

                            <button onClick={() => setActiveTab('sales')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'sales' ? 'bg-white shadow text-biosalud-700' : 'text-gray-500 hover:text-gray-700'}`}>Productos</button>
                            <button onClick={() => setActiveTab('invoices')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'invoices' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>Facturación</button>
                            <button onClick={() => setActiveTab('crossed')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'crossed' ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>Cruces</button>
                            <button onClick={() => setActiveTab('expenses')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'expenses' ? 'bg-white shadow text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}>Proveedores</button>
                            <button onClick={() => setActiveTab('services')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'services' ? 'bg-white shadow text-blue-500' : 'text-gray-500 hover:text-gray-700'}`}>Servicios</button>
                            <button onClick={() => setActiveTab('debts')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'debts' ? 'bg-white shadow text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}>Cuentas</button>
                            <button onClick={() => setActiveTab('shopping')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'shopping' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>Compras</button>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase hidden lg:block">{user.email?.split('@')[0]}</span>
                            <button onClick={handleClearData} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Limpiar Base de Datos"><Trash2 className="w-5 h-5" /></button>
                            <button onClick={() => firebaseAuth.signOut(auth)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Cerrar Sesión"><LogOut className="w-5 h-5" /></button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {loading && (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-biosalud-600"></div>
                        <p className="text-gray-500 font-medium animate-pulse">Sincronizando con la nube...</p>
                        {uploadProgress && (
                            <div className="w-48 bg-gray-200 rounded-full h-1.5">
                                <div className="bg-biosalud-600 h-1.5 rounded-full" style={{ width: `${(uploadProgress.processed / uploadProgress.total) * 100}%` }}></div>
                            </div>
                        )}
                    </div>
                )}

                {!loading && (
                    <div className="animate-in fade-in duration-500">
                        {activeTab === 'sales' && (
                            <>
                                {(!salesData || salesData.length === 0) ? (
                                    <div className="text-center mt-20 max-w-xl mx-auto">
                                        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-xl">
                                            <div className="bg-biosalud-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                                <BarChart3 className="w-10 h-10 text-biosalud-600" />
                                            </div>
                                            <h2 className="text-3xl font-black mb-4">Base de Productos</h2>
                                            <p className="text-gray-500 mb-8 font-medium">No se detectaron datos en la nube. Cargue su reporte de ventas para comenzar el análisis.</p>
                                            <FileUpload onDataLoaded={handleSalesUpload} variant="primary" />
                                        </div>
                                    </div>
                                ) : selectedSeller ? (
                                    <SellerDetail
                                        sellerName={selectedSeller}
                                        data={enrichedSalesData || []}
                                        onBack={() => setSelectedSeller(null)}
                                        startDate={startDate}
                                        endDate={endDate}
                                        excludedProducts={excludedProducts}
                                        includedProducts={includedProducts}
                                        excludedEntities={excludedEntities}
                                        includedEntities={includedEntities}
                                    />
                                ) : (
                                    <>
                                        <div className="mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                            <h2 className="text-2xl font-black tracking-tight">Analítica de Ventas</h2>
                                            <FileUpload onDataLoaded={handleSalesUpload} variant="compact" />
                                        </div>
                                        <Dashboard
                                            data={enrichedSalesData || []}
                                            onSelectSeller={setSelectedSeller}
                                            selectedBranch={selectedBranch}
                                            onSelectBranch={setSelectedBranch}
                                            sellerFilter={sellerFilter}
                                            onSellerFilterChange={setSellerFilter}
                                            sellersList={uniqueSellers}
                                            startDate={startDate}
                                            endDate={endDate}
                                            onStartDateChange={setStartDate}
                                            onEndDateChange={setEndDate}
                                            excludedProducts={excludedProducts}
                                            includedProducts={includedProducts}
                                            onToggleExclusion={(p) => setExcludedProducts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                            onToggleInclusion={(p) => setIncludedProducts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                            excludedEntities={excludedEntities}
                                            includedEntities={includedEntities}
                                            onToggleEntityExclusion={(c) => setExcludedEntities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                                            onToggleEntityInclusion={(c) => setIncludedEntities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                                            onPrintReport={() => setShowReport(true)}
                                            onUploadInvoices={() => invoiceFileInputRef.current?.click()}
                                            onTimeSyncUpload={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    Papa.parse(file, {
                                                        header: true,
                                                        skipEmptyLines: true,
                                                        complete: (r) => setTimeSyncData(processTimeSyncData(r.data))
                                                    });
                                                }
                                            }}
                                        />
                                    </>
                                )}
                            </>
                        )}

                        {activeTab === 'invoices' && (
                            <>
                                {(!invoiceData || invoiceData.length === 0) ? (
                                    <div className="text-center mt-20 max-w-xl mx-auto">
                                        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-xl">
                                            <div className="bg-blue-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                                <FileText className="w-10 h-10 text-blue-600" />
                                            </div>
                                            <h2 className="text-3xl font-black mb-4">Auditoría Fiscal</h2>
                                            <p className="text-gray-500 mb-8 font-medium">Cargue sus comprobantes de facturación para habilitar filtros de obras sociales y entidades.</p>
                                            <button onClick={() => invoiceFileInputRef.current?.click()} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-3 mx-auto">
                                                <Upload className="w-5 h-5" /> Subir Facturación
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                            <h2 className="text-2xl font-black tracking-tight text-blue-900">Módulo de Facturación</h2>
                                            <button onClick={() => invoiceFileInputRef.current?.click()} className="text-blue-600 border border-blue-100 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50 transition-all">Sincronizar más datos</button>
                                        </div>
                                        <InvoiceDashboard
                                            data={invoiceData}
                                            salesData={salesData || []}
                                            expenseData={expenseData || []}
                                            serviceData={serviceData || []}
                                            startDate={startDate}
                                            endDate={endDate}
                                            onStartDateChange={setStartDate}
                                            onEndDateChange={setEndDate}
                                        />
                                    </>
                                )}
                            </>
                        )}

                        {activeTab === 'expenses' && (
                            <>
                                {(!expenseData || expenseData.length === 0) ? (
                                    <div className="text-center mt-20 max-w-xl mx-auto">
                                        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-xl">
                                            <div className="bg-orange-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                                <ShoppingCart className="w-10 h-10 text-orange-600" />
                                            </div>
                                            <h2 className="text-3xl font-black mb-4">Gestión de Proveedores</h2>
                                            <p className="text-gray-500 mb-8 font-medium">Controle vencimientos, facturas de compra y rotación de stock por proveedor.</p>
                                            <button onClick={() => expenseFileInputRef.current?.click()} className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-orange-200 hover:bg-orange-700 transition-all flex items-center gap-3 mx-auto">
                                                <Upload className="w-5 h-5" /> Subir Reporte Proveedores
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                            <h2 className="text-2xl font-black tracking-tight text-orange-900">Control de Proveedores</h2>
                                            <button onClick={() => expenseFileInputRef.current?.click()} className="text-orange-600 border border-orange-100 px-4 py-2 rounded-xl text-sm font-bold hover:bg-orange-50 transition-all">Sincronizar compras</button>
                                        </div>
                                        <ExpensesDashboard
                                            data={expenseData}
                                            startDate={startDate}
                                            endDate={endDate}
                                            onStartDateChange={setStartDate}
                                            onEndDateChange={setEndDate}
                                        />
                                    </>
                                )}
                            </>
                        )}

                        {activeTab === 'services' && (
                            <>
                                {(!serviceData || serviceData.length === 0) ? (
                                    <div className="text-center mt-20 max-w-xl mx-auto">
                                        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-xl">
                                            <div className="bg-blue-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                                <Lightbulb className="w-10 h-10 text-blue-500" />
                                            </div>
                                            <h2 className="text-3xl font-black mb-4">Gastos de Servicios</h2>
                                            <p className="text-gray-500 mb-8 font-medium">Separe los gastos operativos (luz, agua, limpieza) de la mercadería.</p>
                                            <button onClick={() => serviceFileInputRef.current?.click()} className="bg-blue-500 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all flex items-center gap-3 mx-auto">
                                                <Upload className="w-5 h-5" /> Subir Gastos Externos
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                            <h2 className="text-2xl font-black tracking-tight text-blue-800">Gastos Operativos</h2>
                                            <button onClick={() => serviceFileInputRef.current?.click()} className="text-blue-500 border border-blue-100 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50 transition-all">Actualizar servicios</button>
                                        </div>
                                        <ServicesDashboard
                                            data={serviceData}
                                            startDate={startDate}
                                            endDate={endDate}
                                            onStartDateChange={setStartDate}
                                            onEndDateChange={setEndDate}
                                        />
                                    </>
                                )}
                            </>
                        )}

                        {activeTab === 'debts' && (
                            <>
                                {(!currentAccountData || currentAccountData.length === 0) ? (
                                    <div className="text-center mt-20 max-w-xl mx-auto">
                                        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-xl">
                                            <div className="bg-teal-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                                <Wallet className="w-10 h-10 text-teal-600" />
                                            </div>
                                            <h2 className="text-3xl font-black mb-4">Cuentas Corrientes</h2>
                                            <p className="text-gray-500 mb-8 font-medium">Controle saldos históricos y deudas pendientes de clientes y proveedores.</p>
                                            <button onClick={() => currentAccountFileInputRef.current?.click()} className="bg-teal-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all flex items-center gap-3 mx-auto">
                                                <Upload className="w-5 h-5" /> Subir Ctas Ctes
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                            <h2 className="text-2xl font-black tracking-tight text-teal-900">Estado de Cuenta Sincronizado</h2>
                                            <button onClick={() => currentAccountFileInputRef.current?.click()} className="text-teal-600 border border-teal-100 px-4 py-2 rounded-xl text-sm font-bold hover:bg-teal-50 transition-all">Sincronizar saldos</button>
                                        </div>
                                        <CurrentAccountDashboard data={currentAccountData} />
                                    </>
                                )}
                            </>
                        )}

                        {activeTab === 'zetti' && (
                            <div className="animate-in fade-in zoom-in duration-300">
                                <ZettiSync
                                    startDate={startDate}
                                    endDate={endDate}
                                    onDataImported={handleZettiImport}
                                />
                            </div>
                        )}

                        {activeTab === 'crossed' && (
                            <div className="animate-in fade-in zoom-in duration-300">
                                {enrichedSalesData && invoiceData && invoiceData.length > 0 ? (
                                    <CrossedAnalytics
                                        salesData={enrichedSalesData}
                                        invoiceData={invoiceData}
                                        expenseData={expenseData || []}
                                        serviceData={serviceData || []}
                                        startDate={startDate}
                                        endDate={endDate}
                                        onStartDateChange={setStartDate}
                                        onEndDateChange={setEndDate}
                                    />
                                ) : (
                                    <div className="text-center bg-white p-20 rounded-3xl border border-gray-100 italic text-gray-400">
                                        Se requieren datos de Ventas y Comprobantes para generar cruces.
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'shopping' && (
                            <div className="animate-in fade-in zoom-in duration-300">
                                <ShoppingAssistant salesData={salesData || []} />
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;