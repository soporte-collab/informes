import React, { useState, useMemo, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { processInvoiceData, processExpenseData, processServiceData, processCurrentAccountData } from './utils/dataHelpers';
import { SaleRecord, InvoiceRecord, ExpenseRecord, CurrentAccountRecord, StockRecord, InsuranceRecord, UnifiedTransaction } from './types';
import { Dashboard } from './components/Dashboard';
import { InvoiceDashboard } from './components/InvoiceDashboard';
import { ExpensesDashboard } from './components/ExpensesDashboard';
import { ServicesDashboard } from './components/ServicesDashboard';
import { CurrentAccountDashboard } from './components/CurrentAccountDashboard';
import { SellerDetail } from './components/SellerDetail';
import { CrossedAnalytics } from './components/CrossedAnalytics';
import { ZettiSync } from './components/ZettiSync';
import { Login } from './components/Login';
import { InsuranceDashboard } from './components/InsuranceDashboard';
import { PrintReport } from './components/PrintReport';
import { ShoppingAssistant } from './components/ShoppingAssistant';
import { MixMaestroDashboard } from './components/MixMaestroDashboard';
import { SellersDashboard } from './components/SellersDashboard';
import { PayrollDashboard } from './components/PayrollDashboard';
import { LiveDashboard } from './components/LiveDashboard';
import { ManualImport } from './components/ManualImport';
import { Activity, LogOut, Trash2, HardDrive, BarChart3, FileText, Radar, Upload, RefreshCw, ShoppingCart, Wallet, Lightbulb, CloudLightning, Blend, LayoutDashboard, Package, Users, Truck, Calendar, Menu, Printer, Banknote, ShieldCheck } from 'lucide-react';
import {
    getAllSalesFromDB, saveSalesToDB, clearDB, saveInvoicesToDB, getAllInvoicesFromDB,
    getAllExpensesFromDB, saveExpensesToDB, getAllCurrentAccountsFromDB, saveCurrentAccountsToDB,
    saveStockToDB, getAllStockFromDB, saveInsuranceToDB, getAllInsuranceFromDB,
    getAllServicesFromDB, saveServicesToDB, getAllUnifiedFromDB, saveUnifiedToDB,
    getAllPayrollFromDB, getAllEmployeesFromDB, saveEmployeesToDB,
    clearCurrentAccountsDB, clearExpensesDB, clearSalesDB, clearInvoicesDB, clearStockDB, clearInsuranceDB, clearServicesDB,
    getMetadata, saveMetadata
} from './utils/db';
import * as firebaseAuth from 'firebase/auth';
import { auth } from './src/firebaseConfig';
import { format } from 'date-fns';
import { PayrollRecord } from './types';

const App: React.FC = () => {
    const [user, setUser] = useState<firebaseAuth.User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const [salesData, setSalesData] = useState<SaleRecord[] | null>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceRecord[] | null>(null);
    const [expenseData, setExpenseData] = useState<ExpenseRecord[] | null>(null);
    const [serviceData, setServiceData] = useState<ExpenseRecord[] | null>(null);
    const [currentAccountData, setCurrentAccountData] = useState<CurrentAccountRecord[] | null>(null);
    const [stockData, setStockData] = useState<StockRecord[] | null>(null);
    const [insuranceData, setInsuranceData] = useState<InsuranceRecord[] | null>(null);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'live' | 'sales' | 'invoices' | 'crossed' | 'expenses' | 'debts' | 'services' | 'zetti' | 'shopping' | 'mixMaestro' | 'import' | 'sellers' | 'payroll' | 'insurance'>('mixMaestro');
    const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
    const [payrollData, setPayrollData] = useState<PayrollRecord[] | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-01'));
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [excludedProducts, setExcludedProducts] = useState<string[]>([]);
    const [includedProducts, setIncludedProducts] = useState<string[]>([]);
    const [excludedEntities, setExcludedEntities] = useState<string[]>([]);
    const [includedEntities, setIncludedEntities] = useState<string[]>([]);
    const [sidebarExpanded, setSidebarExpanded] = useState(false);

    const invoiceFileInputRef = useRef<HTMLInputElement>(null);
    const expenseFileInputRef = useRef<HTMLInputElement>(null);
    const serviceFileInputRef = useRef<HTMLInputElement>(null);
    const currentAccountFileInputRef = useRef<HTMLInputElement>(null);
    const stockFileInputRef = useRef<HTMLInputElement>(null);
    const insuranceFileInputRef = useRef<HTMLInputElement>(null);

    const filteredSalesData = useMemo(() => {
        if (!salesData) return [];
        return salesData.filter(d => {
            const dateStr = format(d.date, 'yyyy-MM-dd');
            const branchMatch = selectedBranch === 'all' || d.branch.toLowerCase().includes(selectedBranch.toLowerCase());
            return dateStr >= startDate && dateStr <= endDate && branchMatch;
        });
    }, [salesData, startDate, endDate, selectedBranch]);

    const enrichedSalesData = useMemo(() => {
        if (!filteredSalesData || filteredSalesData.length === 0) return [];
        if (!invoiceData || invoiceData.length === 0) return filteredSalesData;

        // Map invoices by number for exact matching
        const invMap = new Map<string, InvoiceRecord>();
        invoiceData.forEach(inv => {
            if (inv.invoiceNumber) {
                // Clean the invoice number to match the sales format if necessary
                const key = inv.invoiceNumber.trim();
                invMap.set(key, inv);
            }
        });

        return filteredSalesData.map(sale => {
            const saleInvoiceNum = sale.invoiceNumber ? sale.invoiceNumber.trim() : null;
            const inv = saleInvoiceNum ? invMap.get(saleInvoiceNum) : null;

            if (inv) {
                return {
                    ...sale,
                    hour: inv.date.getHours(),
                    paymentMethod: inv.paymentType || 'OTRO'
                };
            }
            return sale;
        });
    }, [filteredSalesData, invoiceData]);

    const uniqueSellers = useMemo(() => {
        if (!salesData) return [];
        const sellers = new Set(salesData.map(d => d.sellerName));
        return Array.from(sellers).sort();
    }, [salesData]);

    const unifiedFromSales = useMemo(() => {
        if (!enrichedSalesData || enrichedSalesData.length === 0) return [];

        const map = new Map<string, UnifiedTransaction>();

        // Create a map of invoice numbers present in stockData for hasStockDetail tracking
        const stockInvoiceNumbers = new Set<string>();
        (stockData || []).forEach(s => {
            if (s.invoiceNumber) {
                const normalized = s.invoiceNumber.replace(/[^0-9-]/g, '').trim();
                if (normalized) stockInvoiceNumbers.add(normalized);
            }
        });

        // Use enrichedSalesData (which already has correct hours from invoiceData)
        enrichedSalesData.forEach(sale => {
            const key = sale.invoiceNumber || `INV-${sale.date.getTime()}-${sale.sellerName}`;
            if (!map.has(key)) {
                // Check if this invoice has stock detail
                const normalizedInv = sale.invoiceNumber ? sale.invoiceNumber.replace(/[^0-9-]/g, '').trim() : '';
                const hasStock = normalizedInv ? stockInvoiceNumbers.has(normalizedInv) : false;

                map.set(key, {
                    id: key,
                    invoiceNumber: sale.invoiceNumber,
                    type: sale.totalAmount < 0 ? 'NC' : 'FV',
                    date: sale.date,
                    branch: sale.branch,
                    seller: sale.sellerName,
                    client: sale.entity || 'Particular',
                    entity: sale.entity || 'Particular',
                    paymentMethod: sale.paymentMethod || 'Efectivo',
                    totalNet: 0,
                    totalGross: 0,
                    totalDiscount: 0,
                    items: [],
                    hasStockDetail: hasStock,
                    hasFinancialDetail: true,
                    cashAmount: 0,
                    cardAmount: 0,
                    osAmount: 0,
                    ctacteAmount: 0
                });
            }

            const tx = map.get(key)!;
            tx.totalNet += sale.totalAmount;
            tx.totalGross += sale.totalAmount;
            tx.items.push({
                barcode: sale.barcode || '-',
                name: sale.productName,
                quantity: sale.quantity,
                unitPrice: sale.unitPrice,
                unitCost: sale.unitCost || 0,
                totalPrice: sale.totalAmount,
                totalCost: (sale.unitCost || 0) * sale.quantity,
                profit: sale.totalAmount - ((sale.unitCost || 0) * sale.quantity),
                manufacturer: sale.manufacturer || '-',
                category: sale.category || '-'
            });
        });

        return Array.from(map.values());
    }, [enrichedSalesData, stockData]);

    const [supplierCategories, setSupplierCategories] = useState<Record<string, string>>({});

    useEffect(() => {
        // Detect 403 API Key blocking from referer
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const resp = await originalFetch(...args);
            if (resp.status === 403 && args[0].toString().includes('identitytoolkit')) {
                console.error("CRITICAL: Firebase API Key is blocked by referrer restriction.");
                alert("⚠️ ERROR CRÍTICO: La API Key de Firebase está bloqueada para este dominio. Por favor, ve a Google Cloud Console y agrega 'informes-a551f.firebaseapp.com' a los referrers permitidos de la API Key.");
            }
            return resp;
        };

        const unsubscribe = auth.onAuthStateChanged((u) => {
            setUser(u);
            setAuthLoading(false);
        });
        return () => {
            unsubscribe();
            window.fetch = originalFetch;
        };
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const [sales, invoices, expenses, currentAccounts, stock, insurance, services, cats, payroll] = await Promise.all([
                    getAllSalesFromDB(),
                    getAllInvoicesFromDB(),
                    getAllExpensesFromDB(),
                    getAllCurrentAccountsFromDB(),
                    getAllStockFromDB(),
                    getAllInsuranceFromDB(),
                    getAllServicesFromDB(),
                    getMetadata('service_categories'),
                    getAllPayrollFromDB()
                ]);
                setSalesData(sales);
                setInvoiceData(invoices);
                setExpenseData(expenses);
                // Combine expenses with specifically imported manual services
                setServiceData([...expenses, ...services]);
                setCurrentAccountData(currentAccounts);
                setStockData(stock);
                setInsuranceData(insurance);
                setPayrollData(payroll);
                if (cats) setSupplierCategories(cats);
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [user]);

    const handleSalesUpload = async (data: SaleRecord[]) => {
        setSalesData(data);
        await saveSalesToDB(data);
    };

    const handleInvoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const processed = processInvoiceData(results.data as any[]);
                console.log("Invoices processed:", processed.length);
                setInvoiceData(processed);
                await saveInvoicesToDB(processed);
            }
        });
    };

    const handleExpenseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const processed = processExpenseData(results.data as any[]);
                console.log("Expenses processed:", processed.length);

                await saveExpensesToDB(processed);

                // Refresh both to ensure services dashboard is updated
                const [allExpenses, allServices] = await Promise.all([
                    getAllExpensesFromDB(),
                    getAllServicesFromDB()
                ]);

                setExpenseData(allExpenses);
                setServiceData([...allExpenses, ...allServices]);
                alert(`Se importaron ${processed.length} registros de gastos.`);
            }
        });
    };

    const handleServiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const processed = processServiceData(results.data as any[]);
                console.log("Services processed (from CSV):", processed.length);

                const manualServices = processed.map(p => ({ ...p, source: 'manual_csv' }));
                await saveServicesToDB(manualServices);

                // Refresh both to ensure services dashboard has everything
                const [allExpenses, allServices] = await Promise.all([
                    getAllExpensesFromDB(),
                    getAllServicesFromDB()
                ]);

                setServiceData([...allExpenses, ...allServices]);
                alert(`Se importaron ${manualServices.length} registros de servicios.`);
            }
        });
    };

    const handleCurrentAccountUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const processed = processCurrentAccountData(results.data as any[]);
                console.log("Current Account records processed:", processed.length);
                setCurrentAccountData(processed);
                await saveCurrentAccountsToDB(processed);
                alert(`Se importaron ${processed.length} movimientos de Cuenta Corriente.`);
            }
        });
    };
    const handleStockUpload = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
    const handleInsuranceUpload = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };

    const handleZettiImport = async (data: any) => {
        // Use the passed data directly to avoid race conditions with Storage propagation
        if (data) {
            if (data.sales) setSalesData(data.sales);
            if (data.invoices) setInvoiceData(data.invoices);
            if (data.expenses) setExpenseData(data.expenses);
            if (data.insurance) setInsuranceData(data.insurance);
            if (data.currentAccounts) setCurrentAccountData(data.currentAccounts);

            // For services, we still need to combine with potentially existing ones or just update from data
            if (data.expenses || data.services) {
                const combinedServices = [...(data.expenses || []), ...(data.services || [])];
                setServiceData(combinedServices);
            }
            if (data.employees) {
                await saveEmployeesToDB(data.employees);
                alert(`Se crearon ${data.employees.length} legajos de empleados.`);
                window.location.reload();
            }
            return;
        }

        // Fallback: Refresh all data from DB if no direct data passed
        try {
            const [sales, invoices, expenses, currentAccounts, stock, insurance, services, cats] = await Promise.all([
                getAllSalesFromDB(),
                getAllInvoicesFromDB(),
                getAllExpensesFromDB(),
                getAllCurrentAccountsFromDB(),
                getAllStockFromDB(),
                getAllInsuranceFromDB(),
                getAllServicesFromDB(),
                getMetadata('service_categories')
            ]);

            setSalesData(sales);
            setInvoiceData(invoices);
            setExpenseData(expenses);
            setCurrentAccountData(currentAccounts);
            setStockData(stock);
            setInsuranceData(insurance);
            if (cats) setSupplierCategories(cats);
            setServiceData([...expenses, ...services]);
        } catch (error) {
            console.error("Error refreshing data:", error);
        }
    };

    const handleClearCurrentAccount = async () => {
        if (!confirm("¿Seguro que deseas borrar TODA la información de Cuentas Corrientes?")) return;
        await clearCurrentAccountsDB();
        setCurrentAccountData([]);
        alert("Información de Cuentas Corrientes borrada.");
    };

    const handleClearExpenses = async () => {
        if (!confirm("¿Seguro que deseas borrar toda la información de Gastos?")) return;
        await clearExpensesDB();
        setExpenseData([]);
        alert("Información de Gastos borrada.");
    };

    const handleClearServices = async () => {
        if (!confirm("¿Seguro que deseas borrar toda la información de Servicios?")) return;
        await clearServicesDB();
        setServiceData([]);
        alert("Información de Servicios borrada.");
    };

    const handleClearSales = async () => {
        if (!confirm("¿Seguro que deseas borrar toda la información de Ventas?")) return;
        await clearSalesDB();
        setSalesData([]);
        alert("Información de Ventas borrada.");
    };

    const handleClearInvoices = async () => {
        if (!confirm("¿Seguro que deseas borrar toda la información de Facturas de Venta?")) return;
        await clearInvoicesDB();
        setInvoiceData([]);
        alert("Información de Facturas de Venta borrada.");
    };

    const handleClearStock = async () => {
        if (!confirm("¿Seguro que deseas borrar toda la información de Stock?")) return;
        await clearStockDB();
        setStockData([]);
        alert("Información de Stock borrada.");
    };

    const handleClearInsurance = async () => {
        if (!confirm("¿Seguro que deseas borrar toda la información de Seguros/Otras Entidades?")) return;
        await clearInsuranceDB();
        setInsuranceData([]);
        alert("Información de Seguros borrada.");
    };

    const handleClearData = async () => {
        if (window.confirm("¿Está seguro de borrar toda la base de datos local?")) {
            await clearDB();
            window.location.reload();
        }
    };

    useEffect(() => {
        if (selectedSeller) setActiveTab('sellers');
    }, [selectedSeller]);

    if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
    if (!user) return <Login />;

    return (
        <div className="min-h-screen bg-slate-50 flex no-print font-sans overflow-hidden">

            {/* SIDEBAR */}
            <aside
                onMouseEnter={() => setSidebarExpanded(true)}
                onMouseLeave={() => setSidebarExpanded(false)}
                className={`${sidebarExpanded ? 'w-72' : 'w-20'} bg-slate-900 flex flex-col shrink-0 border-r border-slate-800 z-40 relative group transition-all duration-300 ease-in-out no-print`}
            >
                <div className="p-6 border-b border-slate-800/50 flex items-center justify-center overflow-hidden h-[89px]">
                    <div className="flex items-center gap-3 min-w-max">
                        <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <div className={`${sidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'} transition-all duration-300`}>
                            <h1 className="text-white font-black text-xl tracking-tighter uppercase leading-none">BioSalud</h1>
                            <p className="text-indigo-400 text-[10px] font-black tracking-widest uppercase">Analytics 2.0</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto py-6 px-3 space-y-2 custom-scrollbar overflow-x-hidden">
                    <p className={`text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2 truncate transition-opacity duration-300 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>Principal</p>
                    <button onClick={() => setActiveTab('zetti')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'zetti' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <CloudLightning className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Sincronizar Zetti</span>
                    </button>

                    <div className="h-4"></div>
                    <p className={`text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2 truncate transition-opacity duration-300 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>Análisis de Datos</p>
                    <button onClick={() => setActiveTab('sales')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'sales' ? 'bg-indigo-600 text-white shadow-lg font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <Package className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Analítica de Productos</span>
                    </button>
                    <button onClick={() => setActiveTab('shopping')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'shopping' ? 'bg-indigo-600 text-white shadow-lg font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <ShoppingCart className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Asistente de Compras</span>
                    </button>
                    <button onClick={() => setActiveTab('invoices')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'invoices' ? 'bg-slate-800 text-white font-black border border-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <FileText className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Facturación Neta</span>
                    </button>
                    <button onClick={() => setActiveTab('mixMaestro')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'mixMaestro' ? 'bg-indigo-600 text-white shadow-lg font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <Blend className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Mix Maestro</span>
                    </button>

                    <div className="h-4"></div>
                    <p className={`text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2 truncate transition-opacity duration-300 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>CENTRAL LIVE</p>
                    <button onClick={() => setActiveTab('live')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'live' ? 'bg-indigo-600 text-white shadow-lg font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <Activity className={`w-5 h-5 shrink-0 ${activeTab === 'live' ? 'animate-pulse' : ''}`} />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Live Monitor</span>
                    </button>
                    <button onClick={() => setActiveTab('crossed')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'crossed' ? 'bg-slate-800 text-white font-black border border-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <Radar className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Cruce de Datos</span>
                    </button>

                    <div className="h-4"></div>
                    <p className={`text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2 truncate transition-opacity duration-300 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>RRHH & Rendimiento</p>
                    <button onClick={() => setActiveTab('sellers')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'sellers' ? 'bg-amber-500 text-white shadow-lg font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <Users className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Panel Vendedores</span>
                    </button>
                    <button onClick={() => setActiveTab('payroll')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'payroll' ? 'bg-teal-600 text-white shadow-lg font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <Banknote className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Sueldos & RRHH</span>
                    </button>

                    <div className="h-4"></div>
                    <p className={`text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2 truncate transition-opacity duration-300 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>Finanzas & Gastos</p>
                    <button onClick={() => setActiveTab('expenses')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'expenses' ? 'bg-slate-800 text-white font-black border border-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <Truck className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Facturas Proveedor</span>
                    </button>
                    <button onClick={() => setActiveTab('services')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'services' ? 'bg-slate-800 text-white font-black border border-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <Lightbulb className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Gastos / Servicios</span>
                    </button>
                    <button onClick={() => setActiveTab('debts')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'debts' ? 'bg-slate-800 text-white font-black border border-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <Wallet className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Cuentas Corrientes</span>
                    </button>
                    <button onClick={() => setActiveTab('insurance')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'insurance' ? 'bg-slate-800 text-white font-black border border-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <ShieldCheck className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Obras Sociales</span>
                    </button>

                    <div className="h-4"></div>
                    <p className={`text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2 truncate transition-opacity duration-300 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>Herramientas</p>
                    <button onClick={() => setActiveTab('import')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${activeTab === 'import' ? 'bg-indigo-600 text-white shadow-lg font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800 font-medium'}`}>
                        <Upload className="w-5 h-5 shrink-0" />
                        <span className={`${sidebarExpanded ? 'opacity-100' : 'opacity-0 translate-x-4'} transition-all duration-300 whitespace-nowrap`}>Importador PDF</span>
                    </button>

                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                    <div className={`flex items-center gap-3 mb-4 min-w-max transition-all duration-300 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                            <span className="font-black text-indigo-400 text-xs">{user.email?.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="truncate">
                            <p className="text-white text-xs font-black truncate">{user.email?.split('@')[0]}</p>
                            <p className="text-slate-500 text-[9px] uppercase font-bold tracking-tighter">Administrador</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleClearData} className="flex-1 flex justify-center py-2 bg-slate-800 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all duration-300"><Trash2 className="w-4 h-4" /></button>
                        <button onClick={() => firebaseAuth.signOut(auth)} className="flex-1 flex justify-center py-2 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700 hover:text-white transition-all duration-300"><LogOut className="w-4 h-4" /></button>
                    </div>
                </div>
            </aside>

            {/* MAIN */}
            <main className="flex-1 overflow-y-auto bg-slate-50 relative custom-scrollbar h-screen">
                <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 no-print shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarExpanded(!sidebarExpanded)} className="bg-slate-100 p-2.5 rounded-xl hover:bg-slate-200 transition-all text-slate-600"><Menu className="w-5 h-5" /></button>
                        <div className="bg-indigo-600 p-2 rounded-xl"><LayoutDashboard className="w-5 h-5 text-white" /></div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 leading-none uppercase tracking-tight">Analytics Dashboard</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Biosalud 2.0</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => window.print()} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"><Printer className="w-5 h-5" /></button>
                    </div>
                </header>

                <div className="p-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin" />
                            <p className="text-slate-500 font-bold animate-pulse">Cargando base de datos...</p>
                        </div>
                    ) : (
                        <div className="max-w-[1600px] mx-auto">
                            {activeTab === 'live' && (
                                <LiveDashboard />
                            )}
                            {activeTab === 'sales' && (
                                <Dashboard
                                    data={enrichedSalesData || []}
                                    stockData={stockData || []}
                                    expenseData={expenseData || []}
                                    onSelectSeller={setSelectedSeller}
                                    selectedSeller={selectedSeller}
                                    selectedBranch={selectedBranch}
                                    onSelectBranch={setSelectedBranch}
                                    startDate={startDate}
                                    endDate={endDate}
                                    onStartDateChange={setStartDate}
                                    onEndDateChange={setEndDate}
                                    onPrintReport={() => setShowReport(true)}
                                    excludedProducts={excludedProducts}
                                    includedProducts={includedProducts}
                                    onToggleExclusion={(p) => setExcludedProducts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                    onToggleInclusion={(p) => setIncludedProducts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                    excludedEntities={excludedEntities}
                                    includedEntities={includedEntities}
                                    onToggleEntityExclusion={(e) => setExcludedEntities(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])}
                                    onToggleEntityInclusion={(e) => setIncludedEntities(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])}
                                />
                            )}
                            {activeTab === 'sellers' && (
                                <SellersDashboard
                                    data={enrichedSalesData || []}
                                    sellersList={uniqueSellers}
                                    startDate={startDate}
                                    endDate={endDate}
                                    excludedProducts={excludedProducts}
                                    includedProducts={includedProducts}
                                    excludedEntities={excludedEntities}
                                    includedEntities={includedEntities}
                                />
                            )}
                            {activeTab === 'invoices' && (
                                <InvoiceDashboard
                                    data={invoiceData || []}
                                    salesData={salesData || []}
                                    startDate={startDate}
                                    endDate={endDate}
                                    onStartDateChange={setStartDate}
                                    onEndDateChange={setEndDate}
                                    selectedBranch={selectedBranch}
                                    onSelectBranch={setSelectedBranch}
                                    onUpload={handleInvoiceUpload}
                                />
                            )}
                            {activeTab === 'crossed' && <CrossedAnalytics salesData={salesData || []} invoiceData={invoiceData || []} expenseData={expenseData || []} serviceData={serviceData || []} startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />}
                            {activeTab === 'expenses' && (
                                <ExpensesDashboard
                                    data={expenseData || []}
                                    startDate={startDate}
                                    endDate={endDate}
                                    onStartDateChange={setStartDate}
                                    onEndDateChange={setEndDate}
                                    selectedBranch={selectedBranch}
                                    onSelectBranch={setSelectedBranch}
                                    onUpload={handleExpenseUpload}
                                    onClear={handleClearExpenses}
                                    supplierCategories={supplierCategories}
                                    setSupplierCategories={setSupplierCategories}
                                />
                            )}
                            {activeTab === 'services' && (
                                <ServicesDashboard
                                    data={serviceData || []}
                                    startDate={startDate}
                                    endDate={endDate}
                                    onStartDateChange={setStartDate}
                                    onEndDateChange={setEndDate}
                                    selectedBranch={selectedBranch}
                                    onSelectBranch={setSelectedBranch}
                                    onUpload={handleServiceUpload}
                                    onClear={handleClearServices}
                                    supplierCategories={supplierCategories}
                                    setSupplierCategories={setSupplierCategories}
                                />
                            )}
                            {activeTab === 'debts' && (
                                <CurrentAccountDashboard
                                    data={currentAccountData || []}
                                    onUpload={handleCurrentAccountUpload}
                                    onClear={handleClearCurrentAccount}
                                />
                            )}
                            {activeTab === 'insurance' && (
                                <InsuranceDashboard
                                    data={insuranceData || []}
                                    startDate={startDate}
                                    endDate={endDate}
                                    onStartDateChange={setStartDate}
                                    onEndDateChange={setEndDate}
                                    onUploadInsurance={() => { }}
                                />
                            )}
                            {activeTab === 'zetti' && <ZettiSync startDate={startDate} endDate={endDate} onDataImported={handleZettiImport} />}
                            {activeTab === 'shopping' && <ShoppingAssistant salesData={enrichedSalesData || []} stockData={stockData || []} onSelectProduct={(p) => { setActiveTab('sales'); }} />}
                            {activeTab === 'payroll' && (
                                <PayrollDashboard
                                    startDate={startDate}
                                    endDate={endDate}
                                    selectedBranch={selectedBranch}
                                    onPayrollUpdate={async () => {
                                        const p = await getAllPayrollFromDB();
                                        setPayrollData(p);
                                    }}
                                />
                            )}
                            {activeTab === 'mixMaestro' && (
                                <MixMaestroDashboard
                                    data={unifiedFromSales}
                                    expenseData={expenseData || []}
                                    serviceData={serviceData || []}
                                    payrollData={payrollData || []}
                                    startDate={startDate}
                                    endDate={endDate}
                                    onStartDateChange={setStartDate}
                                    onEndDateChange={setEndDate}
                                    selectedBranch={selectedBranch}
                                    onSelectBranch={setSelectedBranch}
                                />
                            )}
                            {activeTab === 'import' && (
                                <ManualImport onImported={handleZettiImport} />
                            )}
                        </div>
                    )}
                </div>

                {showReport && (
                    <PrintReport
                        data={enrichedSalesData || []}
                        startDate={startDate}
                        endDate={endDate}
                        onClose={() => setShowReport(false)}
                        user={user.email || 'Admin'}
                        branchFilter={selectedBranch}
                        excludedCount={excludedProducts.length}
                        includedCount={includedProducts.length}
                        excludedEntitiesCount={excludedEntities.length}
                    />
                )}
            </main>
        </div>
    );
};


export default App;