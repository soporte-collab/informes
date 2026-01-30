import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SaleRecord, InvoiceRecord, ExpenseRecord, CurrentAccountRecord } from './types';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { InvoiceDashboard } from './components/InvoiceDashboard';
import { ExpensesDashboard } from './components/ExpensesDashboard';
import { CurrentAccountDashboard } from './components/CurrentAccountDashboard';
import { SellerDetail } from './components/SellerDetail';
import { CrossedAnalytics } from './components/CrossedAnalytics';
import { Login } from './components/Login';
import { PrintReport } from './components/PrintReport';
import { Intelligence360 } from './components/Intelligence360';
import { Activity, LogOut, Trash2, HardDrive, BarChart3, FileText, Radar, Upload, FileText as FileTextIcon, Bot, User, RefreshCw, ShoppingCart, Wallet } from 'lucide-react';
import { getAllSalesFromDB, saveSalesToDB, clearDB, saveInvoicesToDB, getAllInvoicesFromDB, getAllExpensesFromDB, saveExpensesToDB, getAllCurrentAccountsFromDB, saveCurrentAccountsToDB } from './utils/db';
import { auth } from './src/firebaseConfig';
import * as firebaseAuth from 'firebase/auth';
import Papa from 'papaparse';
import { processInvoiceData, processTimeSyncData, processExpenseData, processCurrentAccountData } from './utils/dataHelpers';
import { format, getHours } from 'date-fns';

const App: React.FC = () => {
    const [user, setUser] = useState<firebaseAuth.User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [salesData, setSalesData] = useState<SaleRecord[] | null>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceRecord[] | null>(null);
    const [expenseData, setExpenseData] = useState<ExpenseRecord[] | null>(null);
    const [currentAccountData, setCurrentAccountData] = useState<CurrentAccountRecord[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeSyncData, setTimeSyncData] = useState<Array<{ ticket: string, date: Date }> | null>(null);
    const [activeTab, setActiveTab] = useState<'sales' | 'invoices' | 'crossed' | 'intelligence' | 'expenses' | 'debts'>('sales');
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
    const currentAccountFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const unsubscribe = firebaseAuth.onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
            if (!currentUser) {
                setSalesData(null);
                setInvoiceData(null);
                setExpenseData(null);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const storedSales = await getAllSalesFromDB();
                if (storedSales && storedSales.length > 0) setSalesData(storedSales);
                const storedInvoices = await getAllInvoicesFromDB();
                if (storedInvoices && storedInvoices.length > 0) setInvoiceData(storedInvoices);
                const storedExpenses = await getAllExpensesFromDB();
                if (storedExpenses && storedExpenses.length > 0) setExpenseData(storedExpenses);
                const storedCurrentAccounts = await getAllCurrentAccountsFromDB();
                if (storedCurrentAccounts && storedCurrentAccounts.length > 0) setCurrentAccountData(storedCurrentAccounts);
            } catch (error: any) {
                console.error("Failed to load from Local DB", error);
            } finally {
                setLoading(false);
            }
        };
        if (!authLoading) {
            loadData();
        }
    }, [user, authLoading]);

    const enrichedSalesData = useMemo(() => {
        if (!salesData) return null;
        if ((!invoiceData || invoiceData.length === 0) && (!timeSyncData || timeSyncData.length === 0)) {
            return salesData;
        }

        const generateKeys = (nro: string) => {
            const keys = new Set<string>();
            if (!nro) return keys;
            const cleanNro = nro.trim();
            keys.add(cleanNro);
            const alphaNum = cleanNro.replace(/[^a-zA-Z0-9]/g, '');
            if (alphaNum) keys.add(alphaNum);
            if (cleanNro.includes('-')) {
                const parts = cleanNro.split('-');
                const cleanParts = parts.map(p => {
                    const num = parseInt(p.replace(/\D/g, ''), 10);
                    return isNaN(num) ? '' : num.toString();
                }).filter(p => p !== '');
                if (cleanParts.length > 0) {
                    keys.add(cleanParts.join('-'));
                    keys.add(cleanParts.join(''));
                }
                const last = cleanParts[cleanParts.length - 1];
                if (last) keys.add(last);
            } else {
                const digits = cleanNro.replace(/\D/g, '');
                if (digits) keys.add(parseInt(digits, 10).toString());
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
            console.log(`TimeSync: Indexed ${timeSyncMap.size} keys from ${timeSyncData.length} correction records.`);
        }

        const smartInvoiceMap = new Map<string, { entity: string, date: Date, paymentType?: string }>();
        if (invoiceData) {
            invoiceData.forEach(inv => {
                if (inv.invoiceNumber) {
                    const keys = generateKeys(inv.invoiceNumber);
                    let bestEntity = "Particular";
                    if (inv.entity && inv.entity !== 'Particular' && inv.entity.length > 2) {
                        bestEntity = inv.entity;
                    }
                    const info = { entity: bestEntity, date: inv.date, paymentType: inv.paymentType };
                    keys.forEach(k => {
                        if (!smartInvoiceMap.has(k)) smartInvoiceMap.set(k, info);
                    });
                }
            });
        }

        let enrichedCount = 0;
        const enriched = salesData.map(sale => {
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
                enrichedCount++;
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

        console.log(`Smart Join Result: ${enrichedCount} sales records enriched.`);
        return enriched;
    }, [salesData, invoiceData, timeSyncData]);

    const uniqueSellers = useMemo(() => {
        if (!enrichedSalesData) return [];
        const sellers = new Set(enrichedSalesData.map(s => s.sellerName));
        return Array.from(sellers).sort();
    }, [enrichedSalesData]);

    const handleInvoiceUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        setLoading(true);
        let allRows: any[] = [];
        Papa.parse(files[0], {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
            complete: async (results) => {
                allRows = results.data;
                try {
                    if (!results.meta.fields?.some(f => f.includes('Tipo Cmp'))) {
                        alert("El archivo no parece ser un Reporte de Caja (falta columna 'Tipo Cmp.').");
                        setLoading(false);
                        return;
                    }
                    const processedData = processInvoiceData(allRows);

                    // Merge with existing data using deterministic IDs
                    const dataMap = new Map<string, InvoiceRecord>();
                    (invoiceData || []).forEach(i => dataMap.set(i.id, i));
                    processedData.forEach(i => dataMap.set(i.id, i));
                    const combinedData = Array.from(dataMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

                    setUploadProgress({ processed: 0, total: combinedData.length });
                    await saveInvoicesToDB(combinedData, (p, t) => setUploadProgress({ processed: p, total: t }));

                    setInvoiceData(combinedData);
                    alert(`✅ Cargados ${processedData.length} comprobantes. Total en base: ${combinedData.length}`);
                } catch (e: any) {
                    alert("Error procesando facturas: " + e.message);
                } finally {
                    setLoading(false);
                    setUploadProgress(null);
                }
            }
        });
        event.target.value = '';
    };

    const handleTimeSyncUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setLoading(true);
        Papa.parse(files[0], {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
            delimitersToGuess: [';', ',', '\t'], // Important for provided file format
            complete: (results) => {
                try {
                    const processed = processTimeSyncData(results.data);
                    if (processed.length === 0) {
                        alert("No se encontraron datos válidos. Verifique que el archivo tenga 'Fecha y Hora' y 'Nro de Comprobante'.");
                    } else {
                        setTimeSyncData(processed);
                        alert(`✅ Sincronización Exitosa: ${processed.length} horarios cargados.`);
                    }
                } catch (e: any) {
                    alert("Error al procesar archivo de horarios: " + e.message);
                } finally {
                    setLoading(false);
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
                    if (!results.meta.fields?.some(f => f.includes('Codificacion'))) {
                        alert("El archivo no parece ser un Reporte de Compras (falta columna 'Codificacion').");
                        setLoading(false);
                        return;
                    }
                    const processedData = processExpenseData(results.data);

                    // Merge with existing data
                    const dataMap = new Map<string, ExpenseRecord>();
                    (expenseData || []).forEach(e => dataMap.set(e.id, e));
                    processedData.forEach(e => dataMap.set(e.id, e));
                    const combinedData = Array.from(dataMap.values()).sort((a, b) => a.issueDate.getTime() - b.issueDate.getTime());

                    setUploadProgress({ processed: 0, total: combinedData.length });
                    await saveExpensesToDB(combinedData, (p, t) => setUploadProgress({ processed: p, total: t }));

                    setExpenseData(combinedData);
                    alert(`✅ Cargados ${processedData.length} gastos. Total en base: ${combinedData.length}`);
                } catch (e: any) {
                    alert("Error procesando gastos: " + e.message);
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
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
            complete: async (results) => {
                try {
                    const processedData = processCurrentAccountData(results.data);

                    // Merge with existing data
                    const dataMap = new Map<string, CurrentAccountRecord>();
                    (currentAccountData || []).forEach(r => dataMap.set(r.id, r));
                    processedData.forEach(r => dataMap.set(r.id, r));
                    const combinedData = Array.from(dataMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

                    setUploadProgress({ processed: 0, total: combinedData.length });
                    await saveCurrentAccountsToDB(combinedData, (p, t) => setUploadProgress({ processed: p, total: t }));

                    setCurrentAccountData(combinedData);
                    alert(`✅ Cargados ${processedData.length} movimientos. Total en base: ${combinedData.length}`);
                } catch (e: any) {
                    alert("Error procesando cuentas corrientes: " + e.message);
                } finally {
                    setLoading(false);
                    setUploadProgress(null);
                }
            }
        });
        event.target.value = '';
    };

    const handleLogout = async () => {
        await firebaseAuth.signOut(auth);
    };

    const handleSalesDataLoaded = async (newRecords: SaleRecord[]) => {
        setLoading(true);
        setUploadProgress({ processed: 0, total: newRecords.length });
        try {
            const currentData = salesData || [];
            const dataMap = new Map<string, SaleRecord>();
            currentData.forEach(r => dataMap.set(r.id, r));
            newRecords.forEach(r => dataMap.set(r.id, r));
            const combinedData = Array.from(dataMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

            // FIX: We must save the COMBINED data (old + new), not just the new records.
            await saveSalesToDB(combinedData, (processed, total) => {
                setUploadProgress({ processed, total });
            });
            setSalesData(combinedData);
            alert("✅ ¡ÉXITO! Datos guardados en la BASE DE DATOS COMPARTIDA (Nube de Organización).");
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
            setUploadProgress(null);
        }
    };

    const handleClearData = async () => {
        if (window.confirm("⚠️ ¿Desea borrar TODA la base de datos en la NUBE? Esta acción no se puede deshacer.")) {
            setLoading(true);
            try {
                await clearDB();
                // Force full reset of local state
                setSalesData(null);
                setInvoiceData(null);
                setExpenseData(null);
                setCurrentAccountData(null);
                setTimeSyncData(null);
                // Also reset any derived/memoized data dependencies if possible, or force reload
                setSelectedSeller(null);
                setSellerFilter('all');
                setExcludedEntities([]);
                setIncludedEntities([]);
                setExcludedProducts([]);
                setIncludedProducts([]);
            } catch (e) {
                alert("Error al limpiar la base de datos local.");
            } finally {
                setLoading(false);
            }
        }
    };

    if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-biosalud-600"></div></div>;
    if (!user) return <Login />;

    if (showReport && enrichedSalesData) {
        return (
            <PrintReport
                data={enrichedSalesData.filter(d => {
                    if (selectedBranch !== 'all' && !d.branch.includes(selectedBranch)) return false;
                    if (sellerFilter !== 'all' && d.sellerName !== sellerFilter) return false;
                    if (startDate && d.date < new Date(startDate)) return false;
                    if (endDate && d.date > new Date(endDate + 'T23:59:59')) return false;
                    if (includedProducts.length > 0 && !includedProducts.includes(d.productName)) return false;
                    if (excludedProducts.includes(d.productName)) return false;
                    const currentEntity = d.entity || "Particular";
                    if (includedEntities.length > 0) {
                        if (!includedEntities.includes(currentEntity)) return false;
                    }
                    if (excludedEntities.includes(currentEntity)) return false;
                    return true;
                })}
                startDate={startDate}
                endDate={endDate}
                branchFilter={selectedBranch}
                sellerFilter={sellerFilter}
                excludedCount={excludedProducts.length}
                includedCount={includedProducts.length}
                excludedEntitiesCount={excludedEntities.length}
                onClose={() => setShowReport(false)}
                user={user.email || 'Usuario'}
            />
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 pb-12 no-print">
            <input type="file" ref={fileInputRef} className="hidden" />
            <input type="file" ref={invoiceFileInputRef} onChange={handleInvoiceUpload} accept=".csv" className="hidden" />
            <input type="file" ref={expenseFileInputRef} onChange={handleExpenseUpload} accept=".csv" className="hidden" />

            <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center gap-2">
                            <div className="bg-biosalud-500 p-1.5 rounded-lg text-white">
                                <Activity className="w-6 h-6" />
                            </div>
                            <span className="font-bold text-xl tracking-tight text-gray-800">
                                BioSalud<span className="text-biosalud-600">Analytics</span>
                            </span>
                        </div>

                        {(salesData || invoiceData || expenseData) && (
                            <div className="hidden md:flex bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => setActiveTab('sales')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'sales' ? 'bg-white shadow text-biosalud-700' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <BarChart3 className="w-4 h-4" /> Productos
                                </button>
                                <button onClick={() => setActiveTab('invoices')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'invoices' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <FileText className="w-4 h-4" /> Facturación
                                </button>
                                <button onClick={() => setActiveTab('expenses')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'expenses' ? 'bg-white shadow text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <ShoppingCart className="w-4 h-4" /> Gastos
                                </button>
                                <button onClick={() => setActiveTab('debts')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'debts' ? 'bg-white shadow text-green-700' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <Wallet className="w-4 h-4" /> Cuentas
                                </button>
                                {invoiceData && (
                                    <button onClick={() => setActiveTab('crossed')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'crossed' ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>
                                        <Radar className="w-4 h-4" /> Cruce
                                    </button>
                                )}
                                {(salesData || invoiceData) && (
                                    <button onClick={() => setActiveTab('intelligence')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'intelligence' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
                                        <Bot className="w-4 h-4" /> Inteligencia
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex items-center gap-2 text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-100 font-medium">
                                <User className="w-3 h-3" />
                                {user?.email}
                            </div>
                            <div className="hidden md:flex items-center gap-2 text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100 font-medium">
                                <HardDrive className="w-3 h-3" />
                                Nube Activa
                            </div>
                            {(salesData || invoiceData) && (
                                <button
                                    onClick={async () => {
                                        if (salesData) await handleSalesDataLoaded(salesData); // Re-trigger save
                                        // A bit hacky but re-saves current state.Ideally we split save logic.
                                        alert("Sincronización forzada completada.");
                                    }}
                                    className="p-2 text-blue-500 hover:bg-white hover:shadow-sm rounded-full transition-all"
                                    title="Forzar Sincronización a la Nube"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                </button>
                            )}
                            <button onClick={handleClearData} className="p-2 text-red-500 hover:bg-white hover:shadow-sm rounded-full transition-all" title="Borrar Base de Datos">
                                <Trash2 className="w-5 h-5" />
                            </button>
                            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all" title="Salir">
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading && (
                    <div className="flex flex-col items-center justify-center h-64 gap-6">
                        {uploadProgress ? (
                            <div className="w-full max-w-md space-y-3 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                                <div className="flex justify-between text-sm font-medium text-gray-700">
                                    <span className="flex items-center gap-2">
                                        <div className="animate-spin h-3 w-3 border-b-2 border-biosalud-600 rounded-full"></div>
                                        Subiendo a la nube...
                                    </span>
                                    <span>{Math.round((uploadProgress.processed / uploadProgress.total) * 100)}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-biosalud-500 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                                        style={{ width: `${(uploadProgress.processed / uploadProgress.total) * 100}%` }}
                                    ></div>
                                </div>
                                <p className="text-center text-xs text-gray-400">
                                    Procesando registro {uploadProgress.processed.toLocaleString()} de {uploadProgress.total.toLocaleString()}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-biosalud-600"></div>
                                <p className="text-gray-500 text-sm">Procesando datos...</p>
                            </>
                        )}
                    </div>
                )}

                {!loading && activeTab === 'sales' && (
                    <>
                        {!salesData ? (
                            <div className="max-w-xl mx-auto mt-20 text-center">
                                <h1 className="text-3xl font-bold text-gray-900 mb-4">Módulo de Productos</h1>
                                <p className="text-gray-500 mb-8">Cargue el reporte de Ventas por Producto (CSV clásico) para analizar stock, rotación y vendedores.</p>
                                <FileUpload onDataLoaded={handleSalesDataLoaded} variant="primary" />
                                <div className="mt-12 pt-8 border-t border-gray-200">
                                    <p className="text-sm text-gray-400 mb-4">¿Busca el reporte de caja?</p>
                                    <button onClick={() => setActiveTab('invoices')} className="text-blue-600 hover:underline font-medium">Ir a Auditoría de Facturación →</button>
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
                                <div className="mb-6 flex justify-between items-center">
                                    <h2 className="text-xl font-bold">Analítica de Productos</h2>
                                    <FileUpload onDataLoaded={handleSalesDataLoaded} variant="compact" />
                                </div>

                                {!invoiceData && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-yellow-100 p-2 rounded-full">
                                                <Radar className="w-5 h-5 text-yellow-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-yellow-800">Mejore su análisis con Entidades</p>
                                                <p className="text-xs text-yellow-700">
                                                    Cargue el archivo de <strong>Facturación</strong> para habilitar el filtro por Entidad y corregir la Hora Pico.
                                                </p>
                                            </div>
                                        </div>
                                        <button onClick={() => setActiveTab('invoices')} className="bg-white border border-yellow-300 text-yellow-700 text-xs px-3 py-2 rounded-md hover:bg-yellow-50 font-medium">
                                            Cargar Facturación
                                        </button>
                                    </div>
                                )}

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
                                    onTimeSyncUpload={handleTimeSyncUpload}
                                />
                            </>
                        )}
                    </>
                )}

                {!loading && activeTab === 'invoices' && (
                    <>
                        {!invoiceData ? (
                            <div className="max-w-xl mx-auto mt-20 text-center">
                                <h1 className="text-3xl font-bold text-gray-900 mb-4">Auditoría de Facturación</h1>
                                <p className="text-gray-500 mb-8">Cargue el "Reporte de Comprobantes" para analizar Facturación, Obras Sociales, Entidades y Notas de Crédito.</p>
                                <label className="cursor-pointer inline-flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white py-4 px-10 rounded-xl text-lg shadow-lg transition-all">
                                    <FileTextIcon className="w-6 h-6" />
                                    <span>Subir Reporte de Comprobantes</span>
                                    <input type="file" onChange={handleInvoiceUpload} accept=".csv" className="hidden" />
                                </label>
                                <div className="mt-12 pt-8 border-t border-gray-200">
                                    <button onClick={() => setActiveTab('sales')} className="text-biosalud-600 hover:underline font-medium">← Volver a Productos</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="mb-6 flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <div>
                                        <h2 className="text-xl font-bold text-blue-900">Auditoría de Facturación</h2>
                                        <p className="text-xs text-blue-600">Análisis financiero por comprobante</p>
                                    </div>
                                    <label className="cursor-pointer bg-white text-blue-600 border border-blue-200 hover:bg-blue-100 py-2 px-4 rounded-lg text-sm font-medium shadow-sm transition-all flex items-center gap-2">
                                        <Upload className="w-4 h-4" />
                                        <span>Subir más Comprobantes</span>
                                        <input type="file" onChange={handleInvoiceUpload} accept=".csv" className="hidden" />
                                    </label>
                                </div>
                                <InvoiceDashboard data={invoiceData} salesData={salesData || []} />
                            </>
                        )}
                    </>
                )}

                {!loading && activeTab === 'expenses' && (
                    <>
                        {!expenseData ? (
                            <div className="max-w-xl mx-auto mt-20 text-center">
                                <h1 className="text-3xl font-bold text-gray-900 mb-4">Control de Gastos</h1>
                                <p className="text-gray-500 mb-8">Cargue el reporte de "Seguimiento de Valores" para analizar las compras a proveedores y sus vencimientos.</p>
                                <label className="cursor-pointer inline-flex items-center justify-center gap-3 bg-orange-600 hover:bg-orange-700 text-white py-4 px-10 rounded-xl text-lg shadow-lg transition-all">
                                    <ShoppingCart className="w-6 h-6" />
                                    <span>Subir Reporte de Compras</span>
                                    <input type="file" onChange={handleExpenseUpload} accept=".csv" className="hidden" />
                                </label>
                                <div className="mt-12 pt-8 border-t border-gray-200">
                                    <button onClick={() => setActiveTab('sales')} className="text-biosalud-600 hover:underline font-medium">← Volver a Productos</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="mb-6 flex justify-between items-center bg-orange-50 p-4 rounded-xl border border-orange-100 animated-in slide-in-from-top-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-orange-900">Control de Gastos</h2>
                                        <p className="text-xs text-orange-600">Análisis de compras y proveedores</p>
                                    </div>
                                    <label className="cursor-pointer bg-white text-orange-600 border border-orange-200 hover:bg-orange-100 py-2 px-4 rounded-lg text-sm font-medium shadow-sm transition-all flex items-center gap-2">
                                        <Upload className="w-4 h-4" />
                                        <span>Subir más Compras</span>
                                        <input type="file" onChange={handleExpenseUpload} accept=".csv" className="hidden" />
                                    </label>
                                </div>
                                <ExpensesDashboard data={expenseData} />
                            </>
                        )}
                    </>
                )}

                {!loading && activeTab === 'debts' && (
                    <>
                        {!currentAccountData ? (
                            <div className="max-w-xl mx-auto mt-20 text-center">
                                <h1 className="text-3xl font-bold text-gray-900 mb-4">Cuentas Corrientes</h1>
                                <p className="text-gray-500 mb-8">Cargue el reporte de movimientos de cuenta corriente (CSV) para analizar saldos, pagos y deudas.</p>
                                <label className="cursor-pointer inline-flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white py-4 px-10 rounded-xl text-lg shadow-lg transition-all">
                                    <Wallet className="w-6 h-6" />
                                    <span>Subir Movimientos de Cuentas</span>
                                    <input type="file" onChange={handleCurrentAccountUpload} accept=".csv" className="hidden" />
                                </label>
                                <div className="mt-12 pt-8 border-t border-gray-200">
                                    <button onClick={() => setActiveTab('sales')} className="text-biosalud-600 hover:underline font-medium">← Volver a Productos</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="mb-6 flex justify-between items-center bg-green-50 p-4 rounded-xl border border-green-100 animated-in slide-in-from-top-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-green-900">Cuentas Corrientes</h2>
                                        <p className="text-xs text-green-600">Gestión de saldos y movimientos</p>
                                    </div>
                                    <label className="cursor-pointer bg-white text-green-600 border border-green-200 hover:bg-green-100 py-2 px-4 rounded-lg text-sm font-medium shadow-sm transition-all flex items-center gap-2">
                                        <Upload className="w-4 h-4" />
                                        <span>Subir más Movimientos</span>
                                        <input type="file" onChange={handleCurrentAccountUpload} accept=".csv" className="hidden" />
                                    </label>
                                </div>
                                <CurrentAccountDashboard data={currentAccountData} />
                            </>
                        )}
                    </>
                )}

                {!loading && activeTab === 'crossed' && enrichedSalesData && invoiceData && (
                    <CrossedAnalytics salesData={enrichedSalesData} invoiceData={invoiceData} />
                )}

                {!loading && activeTab === 'intelligence' && (
                    <div className="animate-in fade-in zoom-in duration-300">
                        <Intelligence360 salesData={salesData} invoiceData={invoiceData} />
                    </div>
                )}

            </main>
        </div>
    );
};

export default App;