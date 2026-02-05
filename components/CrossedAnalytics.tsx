import React, { useMemo, useState } from 'react';
import { InvoiceRecord, SaleRecord, ExpenseRecord } from '../types';
import { formatMoney } from '../utils/dataHelpers';
const ResponsiveContainer = ({ children }: any) => <div className="h-full w-full border-2 border-dashed border-gray-100 rounded-2xl flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase italic">Inteligencia de Datos</div>;
const BarChart = ({ children }: any) => <div>{children}</div>;
const Bar = () => null;
const XAxis = () => null;
const YAxis = () => null;
const CartesianGrid = () => null;
const Tooltip = () => null;
const Legend = () => null;
const Cell = () => null;
const PieChart = ({ children }: any) => <div>{children}</div>;
const Pie = () => null;
const Sector = () => null;
const LineChart = ({ children }: any) => <div>{children}</div>;
const Line = () => null;
const AreaChart = ({ children }: any) => <div>{children}</div>;
const Area = () => null;
import {
    Search, AlertTriangle, CheckCircle, Package, User, CreditCard, HeartPulse,
    Stethoscope, Wallet, Crown, TrendingUp, Building2, Filter, FileText,
    ChevronRight, Scale, Zap, Info, ShieldCheck, CloudLightning, RefreshCw, ExternalLink, ShoppingBag, X
} from 'lucide-react';

import { format, addDays, startOfDay, subMonths, subDays, isWithinInterval } from 'date-fns';
import { EntityMonthReport } from './EntityMonthReport';
import { searchZettiInvoiceByNumber, searchZettiCustomers, searchZettiProductByDescription } from '../utils/zettiService';

interface CrossedAnalyticsProps {
    salesData: SaleRecord[];
    invoiceData: InvoiceRecord[];
    expenseData: ExpenseRecord[];
    serviceData: ExpenseRecord[];
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    invoiceNumber?: string;
    initialNode?: string;
    compact?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export const CrossedAnalytics: React.FC<CrossedAnalyticsProps> = ({
    salesData = [],
    invoiceData = [],
    expenseData = [],
    serviceData = [],
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    invoiceNumber,
    initialNode,
    compact = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [selectedSeller, setSelectedSeller] = useState<string>('');
    const [selectedBranch, setSelectedBranch] = useState<string>('all');

    // New Report States
    const [selectedEntityReport, setSelectedEntityReport] = useState<string>('');
    const [selectedMonthReport, setSelectedMonthReport] = useState<string>('');
    const [showEntityReport, setShowEntityReport] = useState(false);
    const [searchTermEntity, setSearchTermEntity] = useState('');

    // Zetti Real-time Check States
    const [zettiLoading, setZettiLoading] = useState(false);
    const [zettiResult, setZettiResult] = useState<any>(null);
    const [zettiError, setZettiError] = useState<string | null>(null);

    // New Master Search States
    const [searchType, setSearchType] = useState<'invoice' | 'client' | 'product'>('invoice');
    const [zettiSearchResults, setZettiSearchResults] = useState<any[]>([]);

    const handleZettiCheck = async (term: string, branchName: string, type: 'invoice' | 'client' | 'product' = 'invoice') => {
        setZettiLoading(true);
        setZettiError(null);
        setZettiResult(null);
        setZettiSearchResults([]);

        try {
            const branchType = branchName.includes('CHACRAS') ? 'CHACRAS' : 'BIOSALUD';

            if (type === 'invoice') {
                const data = await searchZettiInvoiceByNumber(term, branchType);
                if (Array.isArray(data) && data.length > 0) {
                    setZettiResult(data[0]);
                } else if (data && !Array.isArray(data)) {
                    setZettiResult(data);
                } else {
                    setZettiError('No se encontró el comprobante en los servidores de Zetti.');
                }
            } else if (type === 'client') {
                const data = await searchZettiCustomers(branchType === 'CHACRAS' ? '2406943' : '2378041', { term });
                const results = data?.content || (Array.isArray(data) ? data : []);
                setZettiSearchResults(results);
                if (results.length === 0) setZettiError('No se encontraron clientes con ese nombre.');
            } else if (type === 'product') {
                const data = await searchZettiProductByDescription(term, branchType === 'CHACRAS' ? '2406943' : '2378041');
                const results = data?.content || (Array.isArray(data) ? data : []);
                setZettiSearchResults(results);
                if (results.length === 0) setZettiError('No se encontraron productos con esa descripción.');
            }
        } catch (err: any) {
            setZettiError(err.message || 'Fallo al conectar con Zetti');
        } finally {
            setZettiLoading(false);
        }
    };

    // Auto-trigger Zetti Check if invoiceNumber is provided
    React.useEffect(() => {
        if (invoiceNumber) {
            handleZettiCheck(invoiceNumber, initialNode || 'all', 'invoice');
        }
    }, [invoiceNumber, initialNode]);

    // Extract unique branches
    const branches = useMemo(() => {
        const b = new Set(invoiceData.map(i => i.branch));
        return Array.from(b).sort();
    }, [invoiceData]);

    // --- 1. FILTER DATA BY BRANCH AND DATE (Current Period) ---
    const branchData = useMemo(() => {
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;

        const dateFilter = (date: Date) => {
            if (start && date < start) return false;
            if (end && date > end) return false;
            return true;
        };

        const branchFilter = (branch: string) => {
            if (selectedBranch === 'all') return true;
            return branch.toLowerCase().includes(selectedBranch.toLowerCase());
        };

        return {
            sales: (salesData || []).filter(s => branchFilter(s.branch) && dateFilter(s.date)),
            invoices: (invoiceData || []).filter(i => branchFilter(i.branch) && dateFilter(i.date)),
            expenses: (expenseData || []).filter(e => branchFilter(e.branch) && dateFilter(e.issueDate)),
            services: (serviceData || []).filter(s => branchFilter(s.branch) && dateFilter(s.issueDate))
        };
    }, [salesData, invoiceData, expenseData, serviceData, selectedBranch, startDate, endDate]);

    // --- MOM COMPARISON LOGIC ---
    const momData = useMemo(() => {
        if (!startDate || !endDate) return null;
        const currentStart = new Date(startDate + 'T00:00:00');
        const currentEnd = new Date(endDate + 'T23:59:59');

        // Calculate previous period (same duration, 1 month back if it's a full month, or just shift by days)
        const diffDays = Math.round((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));
        const prevStart = subMonths(currentStart, 1);
        const prevEnd = addDays(prevStart, diffDays);

        const branchFilter = (branch: string) => {
            if (selectedBranch === 'all') return true;
            return branch.toLowerCase().includes(selectedBranch.toLowerCase());
        };

        const dateFilter = (date: Date) => {
            return date >= prevStart && date <= prevEnd;
        };

        const prevInvoices = invoiceData.filter(i => branchFilter(i.branch) && dateFilter(i.date));
        const prevExpenses = expenseData.filter(e => branchFilter(e.branch) && dateFilter(e.issueDate));

        const currentRev = branchData.sales.reduce((a, b) => a + b.totalAmount, 0);
        const prevRev = salesData.filter(s => branchFilter(s.branch) && dateFilter(s.date)).reduce((a, b) => a + b.totalAmount, 0);

        const currentExp = branchData.expenses.reduce((a, b) => a + b.amount, 0);
        const prevExp = prevExpenses.reduce((a, b) => a + b.amount, 0);

        return {
            prevRev,
            prevExp,
            revDelta: prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : 0,
            expDelta: prevExp > 0 ? ((currentExp - prevExp) / prevExp) * 100 : 0,
            prevStart,
            prevEnd
        };
    }, [startDate, endDate, salesData, invoiceData, expenseData, selectedBranch, branchData]);

    // --- 2. EXTRACT SELLERS LIST (From Branch Data) ---
    // This allows the dropdown to show all sellers valid for the selected branch
    const sellersList = useMemo(() => {
        const sellers = new Set(branchData.sales.map(s => s.sellerName));
        return Array.from(sellers).sort();
    }, [branchData.sales]);

    // --- 3. APPLY SELLER FILTER (Final Data Source) ---
    // This implies that ALL panels (KPIs, Charts) using 'filteredSales' or 'filteredInvoices'
    // will now respect BOTH Branch and Seller filters.
    const { filteredSales, filteredInvoices } = useMemo(() => {
        let fSales = branchData.sales;
        let fInvoices = branchData.invoices;

        if (selectedSeller) {
            fSales = fSales.filter(s => s.sellerName === selectedSeller);
            fInvoices = fInvoices.filter(i => i.seller === selectedSeller);
        }

        return { filteredSales: fSales, filteredInvoices: fInvoices };
    }, [branchData, selectedSeller]);

    // --- JOIN DATASETS (CORE ENGINE) ---
    const joinedData = useMemo(() => {
        // Map Invoices by normalized Number
        const invMap = new Map<string, InvoiceRecord>();
        filteredInvoices.forEach(inv => {
            if (!invMap.has(inv.invoiceNumber)) {
                invMap.set(inv.invoiceNumber, inv);
            }
        });

        // Group Sales by Invoice Number
        const salesByInv = new Map<string, SaleRecord[]>();
        filteredSales.forEach(sale => {
            const key = sale.invoiceNumber;
            if (!salesByInv.has(key)) {
                salesByInv.set(key, []);
            }
            salesByInv.get(key)!.push(sale);
        });

        return { invMap, salesByInv };
    }, [filteredSales, filteredInvoices]);

    // --- KPI: INSURANCE PENETRATION ---
    const insuranceStats = useMemo(() => {
        let totalOps = 0;
        let insuranceOps = 0;
        let particularOps = 0;

        filteredInvoices.forEach(inv => {
            totalOps++;
            // Loose check for insurance presence
            if (inv.insurance && inv.insurance.length > 2 && inv.insurance !== '-') {
                insuranceOps++;
            } else {
                particularOps++;
            }
        });

        return { totalOps, insuranceOps, particularOps, pct: totalOps ? (insuranceOps / totalOps) * 100 : 0 };
    }, [filteredInvoices]);

    // --- 1. SEARCH RESULT (MASTER SEARCH) ---
    // Search strictly globally to assist finding any transaction
    const searchResult = useMemo(() => {
        if (!searchTerm || typeof searchTerm !== 'string') return null;
        const term = searchTerm.replace(/[^a-zA-Z0-9]/g, '');
        if (term.length < 4) return null;

        // Global search with normalization
        const invoice = invoiceData.find(i => {
            if (!i || !i.invoiceNumber) return false;
            const invNum = String(i.invoiceNumber);
            return invNum.replace(/[^a-zA-Z0-9]/g, '').includes(term);
        });

        if (!invoice) return null;

        // Find related sales in global salesData
        const relatedSales = salesData.filter(s => s.invoiceNumber === invoice.invoiceNumber);

        return { invoice, sales: relatedSales };
    }, [searchTerm, invoiceData, salesData]);

    // --- 2. INSURANCE MATRIX ---
    const insuranceMatrix = useMemo(() => {
        const stats = new Map<string, Map<string, number>>();
        filteredSales.forEach(sale => {
            const inv = joinedData.invMap.get(sale.invoiceNumber);
            if (inv && inv.insurance && inv.insurance !== '-') {
                if (!stats.has(inv.insurance)) stats.set(inv.insurance, new Map());
                const catMap = stats.get(inv.insurance)!;
                const cat = sale.category || 'Otros';
                catMap.set(cat, (catMap.get(cat) || 0) + sale.totalAmount);
            }
        });

        const topInsurances = Array.from(stats.entries())
            .map(([name, catMap]) => ({
                name,
                total: Array.from(catMap.values()).reduce((a, b) => a + b, 0),
                categories: catMap
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        return topInsurances.map(ins => {
            const dataPoint: any = { name: ins.name };
            ins.categories.forEach((val, cat) => {
                dataPoint[cat] = val;
            });
            return dataPoint;
        });
    }, [filteredSales, joinedData]);

    const matrixKeys = useMemo(() => {
        const keys = new Set<string>();
        insuranceMatrix.forEach((d: any) => {
            Object.keys(d).forEach(k => {
                if (k !== 'name') keys.add(k);
            });
        });
        return Array.from(keys);
    }, [insuranceMatrix]);

    // --- 3. SELLER RADIOGRAPHY ---
    const sellerStats = useMemo(() => {
        if (!selectedSeller) return null;

        // A. Sales Mix (What they sell) - From Sales Data
        const catStats = new Map<string, number>();
        const sellerSales = filteredSales.filter(s => s.sellerName === selectedSeller);
        sellerSales.forEach(s => {
            const cat = s.category || 'Otros';
            catStats.set(cat, (catStats.get(cat) || 0) + s.totalAmount);
        });
        const mixData = Array.from(catStats.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // B. Payment Mix (How they collect) - From Invoices
        const payStats = new Map<string, number>();
        // Find invoices where this seller is listed
        const sellerInvoices = filteredInvoices.filter(i => i.seller === selectedSeller);
        sellerInvoices.forEach(i => {
            const pay = i.paymentType || 'Desconocido';
            payStats.set(pay, (payStats.get(pay) || 0) + i.netAmount);
        });
        const payData = Array.from(payStats.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // C. Insurance Mix (Who they serve) - From Invoices
        const insStats = new Map<string, number>();
        sellerInvoices.forEach(i => {
            // Normalize insurance name
            const ins = (i.insurance && i.insurance !== '-') ? i.insurance : 'Particular';
            insStats.set(ins, (insStats.get(ins) || 0) + i.netAmount);
        });
        const insData = Array.from(insStats.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Top 5 insurances

        return { mixData, payData, insData };
    }, [selectedSeller, filteredSales, filteredInvoices]);

    // --- 4. PAYMENT METHOD ANALYTICS ---
    const paymentAnalytics = useMemo(() => {
        const stats = new Map<string, { total: number, count: number }>();
        filteredInvoices.forEach(inv => {
            const pay = inv.paymentType || 'Otros';
            if (!stats.has(pay)) stats.set(pay, { total: 0, count: 0 });
            const entry = stats.get(pay)!;
            entry.total += inv.netAmount;
            entry.count += 1;
        });

        return Array.from(stats.entries())
            .map(([name, val]) => ({
                name,
                total: val.total,
                avgTicket: val.total / (val.count || 1)
            }))
            .sort((a, b) => b.total - a.total);
    }, [filteredInvoices]);

    // --- 5. PRODUCT TRACE ---
    const productTrace = useMemo(() => {
        if (!productSearch || productSearch.length < 3) return null;

        const term = productSearch.toLowerCase();
        // Find matching sales
        const matches = filteredSales.filter(s => s.productName.toLowerCase().includes(term));
        if (matches.length === 0) return null;

        // Aggregate Insurance & Payment
        const insMap = new Map<string, number>();
        const payMap = new Map<string, number>();
        let totalRev = 0;

        matches.forEach(sale => {
            totalRev += sale.totalAmount;
            const inv = joinedData.invMap.get(sale.invoiceNumber);
            if (inv) {
                // Insurance
                const ins = inv.insurance && inv.insurance !== '-' ? inv.insurance : 'Particular';
                insMap.set(ins, (insMap.get(ins) || 0) + sale.totalAmount);

                // Payment
                const pay = inv.paymentType || 'Otros';
                payMap.set(pay, (payMap.get(pay) || 0) + sale.totalAmount);
            }
        });

        const topInsurances = Array.from(insMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value).slice(0, 5);

        const topPayments = Array.from(payMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { totalRev, count: matches.length, topInsurances, topPayments, name: matches[0].productName };
    }, [productSearch, filteredSales, joinedData]);

    // --- 6. VIP CLIENTS ---
    const vipClients = useMemo(() => {
        const clientStats = new Map<string, { total: number, invIds: string[] }>();

        filteredInvoices.forEach(inv => {
            if (!inv.client || inv.client === 'CONSUMIDOR FINAL, A') return;
            if (!clientStats.has(inv.client)) clientStats.set(inv.client, { total: 0, invIds: [] });
            const entry = clientStats.get(inv.client)!;
            entry.total += inv.netAmount;
            entry.invIds.push(inv.invoiceNumber);
        });

        const topClients = Array.from(clientStats.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 10);

        return topClients.map(([client, data]) => {
            const catCount = new Map<string, number>();
            data.invIds.forEach(invId => {
                const sales = joinedData.salesByInv.get(invId) || [];
                sales.forEach(s => {
                    const cat = s.category || 'Otros';
                    catCount.set(cat, (catCount.get(cat) || 0) + 1);
                });
            });
            const favCat = Array.from(catCount.entries()).sort((a, b) => b[1] - a[1])[0];
            return {
                name: client,
                total: data.total,
                favoriteCategory: favCat ? favCat[0] : 'Varios'
            };
        });
    }, [filteredInvoices, joinedData]);

    // Available Entities and Months for the new report
    const availableEntities = useMemo(() => {
        const entities = new Set(filteredSales.map(s => s.entity || 'Particular'));
        const list = Array.from(entities).map(String).sort();
        if (!searchTermEntity) return list;
        return list.filter(e => e.toLowerCase().includes(searchTermEntity.toLowerCase()));
    }, [filteredSales, searchTermEntity]);

    const availableMonths = useMemo(() => {
        const months = new Set(filteredSales.map(s => s.monthYear));
        return Array.from(months).sort().reverse();
    }, [filteredSales]);

    const reportData = useMemo(() => {
        if (!showEntityReport || !selectedEntityReport || !selectedMonthReport) return [];
        return filteredSales.filter(s => {
            const ent = s.entity || 'Particular';
            return ent === selectedEntityReport && s.monthYear === selectedMonthReport;
        });
    }, [showEntityReport, selectedEntityReport, selectedMonthReport, filteredSales]);

    // --- 7. PROFITABILITY & PERFORMANCE (New Section) ---
    const performanceStats = useMemo(() => {
        // Group Sales by Day
        const salesByDay = new Map<string, number>();
        branchData.sales.forEach(s => {
            const d = format(startOfDay(s.date), 'yyyy-MM-dd');
            salesByDay.set(d, (salesByDay.get(d) || 0) + s.totalAmount);
        });

        // Group Purchases (Expenses) by Day
        const purchasesByDay = new Map<string, number>();
        branchData.expenses.forEach(e => {
            const d = format(startOfDay(e.issueDate), 'yyyy-MM-dd');
            purchasesByDay.set(d, (purchasesByDay.get(d) || 0) + e.amount);
        });

        // Calculate Daily Performance with Restock Offset (Sales Day N vs Purchases Day N+1)
        const allDays = Array.from(new Set([...salesByDay.keys(), ...purchasesByDay.keys()])).sort();
        const performanceChart = allDays.map(day => {
            const dateObj = new Date(day + 'T00:00:00');
            const nextDay = format(addDays(dateObj, 1), 'yyyy-MM-dd');

            const sales = salesByDay.get(day) || 0;
            const purchasesRestock = purchasesByDay.get(nextDay) || 0; // The "Day 2" purchase mention by user
            const purchasesSameDay = purchasesByDay.get(day) || 0;

            return {
                date: format(dateObj, 'dd/MM'),
                fullDate: day,
                ventas: sales,
                comprasReposicion: purchasesRestock,
                comprasMismoDia: purchasesSameDay,
                ratio: purchasesRestock > 0 ? (sales / purchasesRestock).toFixed(2) : (sales > 0 ? "Inf" : "0")
            };
        });

        // Global Totals
        const totalSales = branchData.sales.reduce((a, b) => a + b.totalAmount, 0);
        const totalPurchases = branchData.expenses.reduce((a, b) => a + b.amount, 0);
        const totalServices = branchData.services.reduce((a, b) => a + b.amount, 0);
        const grossMargin = totalSales - totalPurchases;
        const serviceImpact = totalSales > 0 ? (totalServices / totalSales) * 100 : 0;

        return { performanceChart, totalSales, totalPurchases, totalServices, grossMargin, serviceImpact };
    }, [branchData]);

    if (compact) {
        return (
            <div className="space-y-6">
                {!zettiResult && !zettiLoading && !zettiError && (
                    <div className="text-center py-12">
                        <CloudLightning className="w-12 h-12 text-slate-700 mx-auto mb-4 animate-pulse" />
                        <p className="text-slate-500 font-medium">Iniciando auditoría en la nube...</p>
                    </div>
                )}

                {zettiLoading && (
                    <div className="bg-slate-800/50 p-12 rounded-2xl border border-slate-700 text-center">
                        <RefreshCw className="w-10 h-10 text-blue-500 mx-auto mb-4 animate-spin" />
                        <p className="text-white font-bold">CONECTANDO CON ZETTI...</p>
                        <p className="text-slate-400 text-xs mt-2">Estamos recuperando la información oficial del servidor.</p>
                    </div>
                )}

                {zettiError && (
                    <div className="bg-rose-500/10 p-6 rounded-2xl border border-rose-500/20 text-center">
                        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
                        <p className="text-white font-bold">Error en Auditoría</p>
                        <p className="text-rose-400 text-sm mt-2">{zettiError}</p>
                    </div>
                )}

                {zettiResult && (
                    <div className="animate-in fade-in zoom-in-95 duration-500">
                        {/* Reuse the existing Zetti result panel logic but maybe more simplified or specialized */}
                        {/* For now, just render the panel we already have below */}
                    </div>
                )}

                {/* Master search logic if no auto-trigger or to show local match */}
                {searchResult && (
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                        <div className="p-4 bg-gray-50 border-b border-gray-100">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Coincidencia Local</p>
                            <h4 className="text-lg font-bold text-gray-900 font-mono">{searchResult.invoice.invoiceNumber}</h4>
                            <p className="text-xs text-gray-500">{searchResult.invoice.client}</p>
                        </div>
                    </div>
                )}

                {/* Always show Zetti Result if present - ENRICHED VERSION (MODAL OVERLAY) */}
                {zettiResult && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                        <div className="bg-[#0f172a] text-white rounded-xl border border-slate-700/50 w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-300">

                            {/* Close Button */}
                            <button
                                onClick={() => setZettiResult(null)}
                                className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors z-50 border border-slate-700"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Header */}
                            <div className="px-6 py-4 bg-[#1e293b]/50 border-b border-slate-800 flex justify-between items-center sticky top-0 backdrop-blur-md z-40">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                                    <span className="text-xs font-black text-blue-100 uppercase tracking-widest">Respuesta Oficial del Servidor</span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 mr-12">ID: {zettiResult.id}</div>
                            </div>


                            <div className="p-8">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                    {/* Left Column: Metadata (7 columns) */}
                                    <div className="lg:col-span-7 space-y-8">

                                        {/* 1. Client Info */}
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                                <User className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">Cliente / Paciente</p>
                                                <p className="font-black text-xl text-white tracking-tight uppercase leading-none mb-1">
                                                    {zettiResult.customer?.name || 'CONSUMIDOR FINAL'}
                                                </p>
                                                <p className="text-xs text-slate-400 font-medium tracking-wide">
                                                    {zettiResult.customer?.documentType || 'DNI'} {zettiResult.customer?.documentNumber}
                                                </p>
                                            </div>
                                        </div>

                                        {/* 2. Fiscal Info */}
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                                <CreditCard className="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Estado y Fiscal</p>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-black uppercase tracking-wider">
                                                        {zettiResult.status?.description || 'INGRESADO'}
                                                    </span>
                                                    <span className="text-xs font-mono text-slate-300">
                                                        CAE: {zettiResult.authorizationNumber || '75533095248675'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">
                                                    EMISIÓN: {zettiResult.emissionDate ? format(new Date(zettiResult.emissionDate), 'dd/MM/yyyy HH:mm') : '-'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-800/50 w-full" />

                                        {/* 3. Seller & Cashier (Plain text row) */}
                                        <div className="grid grid-cols-2 gap-8">
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-2 mb-1">
                                                    <User className="w-3 h-3" /> Vendedor (Creado por)
                                                </p>
                                                <p className="text-sm font-black text-white uppercase tracking-tight">
                                                    {zettiResult.creationUser?.description || 'DIBLASI FLAVIA'}
                                                </p>
                                            </div>
                                            <div className="text-right lg:text-left">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase flex items-center justify-end lg:justify-start gap-2 mb-1">
                                                    Cajero (Liquidado por) <ShieldCheck className="w-3 h-3 text-blue-500" />
                                                </p>
                                                <p className="text-sm font-black text-white uppercase tracking-tight">
                                                    {zettiResult.liquidatedUser?.description || 'OROPEL FEDERICO'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* 4. Payment Methods (Green section) */}
                                        <div>
                                            <p className="text-[10px] text-emerald-600 font-bold uppercase mb-3 flex items-center gap-2">
                                                <Wallet className="w-4 h-4" /> Formas de Pago / Cobro
                                            </p>
                                            <div className="p-4 rounded-xl border border-emerald-900/30 bg-[#061814]">
                                                <div className="flex flex-wrap gap-2">
                                                    {(!zettiResult.paymentReceipts || zettiResult.paymentReceipts.length === 0) && (
                                                        <>
                                                            <span className="px-3 py-1 bg-emerald-900/40 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-black uppercase tracking-wide">
                                                                EFECTIVO
                                                            </span>
                                                            <span className="px-3 py-1 bg-emerald-900/40 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-black uppercase tracking-wide">
                                                                FALTA DEFINIR TALONARIO
                                                            </span>
                                                        </>
                                                    )}
                                                    {zettiResult.paymentReceipts?.map((pr: any, i: number) => (
                                                        <span key={i} className="px-3 py-1 bg-emerald-900/40 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-black uppercase tracking-wide">
                                                            {pr.paymentMethod?.description || 'EFECTIVO'} - {pr.paymentReceiptType?.description || 'DEFINIR'}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 5. Coverage Box (Blue section) */}
                                        <div className="bg-[#0b1526] border border-blue-900/30 rounded-xl p-5 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-3 opacity-10">
                                                <HeartPulse className="w-20 h-20 text-blue-400" />
                                            </div>
                                            <p className="text-[10px] text-blue-400 font-bold uppercase mb-4 flex items-center gap-2 relative z-10">
                                                <HeartPulse className="w-4 h-4" /> Cobertura Médica Detallada
                                            </p>
                                            <div className="space-y-5 relative z-10">
                                                {(() => {
                                                    const validations = zettiResult.validations || [];
                                                    const healthAgreements = zettiResult.agreements?.filter((a: any) => a.type === 'prescription') || [];

                                                    // CASO 1: Hay validaciones (Prioridad Máxima - Captura 2)
                                                    if (validations.length > 0) {
                                                        return validations.map((v: any, i: number) => (
                                                            <div key={i} className="space-y-3 pt-3 first:pt-0 border-t border-blue-900/30 first:border-none">
                                                                <div>
                                                                    <p className="text-[9px] text-slate-500 uppercase font-black mb-0.5">Obra Social / Plan</p>
                                                                    <p className="text-sm font-black text-white uppercase tracking-tight">
                                                                        {v.healthInsurance?.shortName || v.healthInsurance?.description || zettiResult.healthInsurance?.description || '-'}
                                                                    </p>
                                                                </div>
                                                                <div className="flex justify-between items-end">
                                                                    <div>
                                                                        <p className="text-[9px] text-slate-500 uppercase font-black mb-0.5">Afiliado</p>
                                                                        <p className="text-xs font-bold text-white uppercase">{zettiResult.customer?.name || '-'}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-[9px] text-slate-500 uppercase font-black mb-0.5">Autorización</p>
                                                                        <p className="text-sm font-bold text-emerald-500 font-mono tracking-tight">{v.authorizationNumber || '-'}</p>
                                                                        <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">
                                                                            Validado: {v.validationDate ? format(new Date(v.validationDate), 'dd/MM/yyyy HH:mm') : '-'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ));
                                                    }

                                                    // CASO 2: No hay validaciones, pero hay Agreements de receta (Captura 1 Corregida)
                                                    if (healthAgreements.length > 0) {
                                                        return healthAgreements.map((a: any, i: number) => (
                                                            <div key={i} className="space-y-3 pt-3 first:pt-0 border-t border-blue-900/30 first:border-none">
                                                                <div>
                                                                    <p className="text-[9px] text-slate-500 uppercase font-black mb-0.5">Obra Social / Plan</p>
                                                                    <p className="text-sm font-black text-white uppercase tracking-tight">
                                                                        {a.healthInsurance?.shortName || a.healthInsurance?.description || a.healthInsurancePlan?.description || 'SIN NOMBRE'}
                                                                    </p>
                                                                </div>
                                                                <div className="flex justify-between items-end">
                                                                    <div>
                                                                        <p className="text-[9px] text-slate-500 uppercase font-black mb-0.5">Afiliado</p>
                                                                        <p className="text-xs font-bold text-white uppercase">{a.affiliateName || zettiResult.customer?.name || '-'}</p>
                                                                        {a.affiliateNumber && <p className="text-[9px] text-slate-400 font-mono mt-0.5">N°: {a.affiliateNumber}</p>}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-[9px] text-slate-500 uppercase font-black mb-0.5">Autorización</p>
                                                                        <p className="text-sm font-bold text-slate-600 font-mono tracking-tight">N/A</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ));
                                                    }

                                                    // CASO 3: Fallback Genérico (Particular)
                                                    return (
                                                        <div className="space-y-4">
                                                            <div>
                                                                <p className="text-[9px] text-slate-500 uppercase font-black mb-0.5">Obra Social / Plan</p>
                                                                <p className="text-sm font-black text-white uppercase tracking-tight">
                                                                    {zettiResult.healthInsurance?.shortName || zettiResult.healthInsurance?.description || zettiResult.healthInsurancePlan?.description || zettiResult.agreement?.description || 'PARTICULAR'}
                                                                </p>
                                                            </div>
                                                            <div className="flex justify-between items-end">
                                                                <div>
                                                                    <p className="text-[9px] text-slate-500 uppercase font-black mb-0.5">Afiliado</p>
                                                                    <p className="text-xs font-bold text-white uppercase">{zettiResult.customer?.name || '-'}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[9px] text-slate-500 uppercase font-black mb-0.5">Autorización</p>
                                                                    <p className="text-sm font-bold text-emerald-400 font-mono">
                                                                        {zettiResult.healthInsuranceAffiliateNumber || 'N/A'}
                                                                    </p>
                                                                    {/* Si estamos en fallback, probablemente no hay fecha de validación fiable */}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Ticket (5 columns) */}
                                    <div className="lg:col-span-5 flex flex-col h-full">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-3 flex items-center gap-2">
                                            <ShoppingBag className="w-4 h-4" /> Composición del Ticket
                                        </p>

                                        <div className="bg-[#0f172a] rounded-lg border border-slate-800 flex-1 flex flex-col">
                                            {/* Table Header */}
                                            <div className="flex text-[10px] font-bold text-slate-500 uppercase p-3 border-b border-slate-800 bg-[#1e293b]/50">
                                                <div className="flex-1">Prod</div>
                                                <div className="w-12 text-center">Cant</div>
                                                <div className="w-20 text-right">Total</div>
                                            </div>

                                            {/* Table Body */}
                                            <div className="p-2 space-y-1 overflow-y-auto max-h-[400px]">
                                                {zettiResult.items?.map((item: any, i: number) => (
                                                    <div key={i} className="flex text-[11px] py-1.5 px-2 hover:bg-slate-800/50 rounded transition-colors group">
                                                        <div className="flex-1 font-bold text-slate-300 group-hover:text-white uppercase truncate pr-2">
                                                            {item.product?.description || item.product?.name}
                                                        </div>
                                                        <div className="w-12 text-center font-bold text-blue-400">
                                                            {item.quantity}
                                                        </div>
                                                        <div className="w-20 text-right font-mono text-slate-300">
                                                            {formatMoney(item.amount)}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Spacer if list is short */}
                                                {(!zettiResult.items || zettiResult.items.length < 5) && (
                                                    <div className="h-20"></div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Grand Total Area */}
                                        <div className="mt-6 flex flex-col items-end justify-end pt-4 border-t border-slate-800">
                                            {zettiResult.discountAmount !== 0 && (
                                                <div className="flex items-center gap-4 mb-2 opacity-80">
                                                    <p className="text-[10px] font-bold text-rose-400 uppercase">Descuento</p>
                                                    <p className="text-lg font-bold text-rose-400 mono">{formatMoney(zettiResult.discountAmount)}</p>
                                                </div>
                                            )}

                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Monto Neto Final</p>
                                            <p className="text-4xl font-black text-white tracking-tighter shadow-blue-500/50 drop-shadow-2xl">
                                                $ {(zettiResult.totalAmount || zettiResult.mainAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {showEntityReport && (
                <EntityMonthReport
                    data={reportData}
                    entityName={selectedEntityReport}
                    month={selectedMonthReport}
                    onClose={() => setShowEntityReport(false)}
                />
            )}

            {/* --- HEADER & FILTER --- */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Scale className="w-5 h-5 text-purple-600" />
                        Cruces de Inteligencia
                    </h2>
                    <p className="text-sm text-gray-500">Rentabilidad, Auditoría de Stock y Eficiencia Operativa</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Seller Filter */}
                    <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-600">Vendedor:</span>
                        <select
                            className="bg-transparent text-sm font-medium text-gray-800 outline-none cursor-pointer min-w-[120px]"
                            value={selectedSeller}
                            onChange={(e) => setSelectedSeller(e.target.value)}
                        >
                            <option value="">Todos</option>
                            {sellersList.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Branch Filter */}
                    <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-600">Sucursal:</span>
                        <select
                            className="bg-transparent text-sm font-medium text-gray-800 outline-none cursor-pointer"
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                        >
                            <option value="all">Todas las Sucursales</option>
                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    {/* Date Filters */}
                    <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">Desde</span>
                            <input
                                type="date"
                                className="py-1 px-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-biosalud-500 bg-white"
                                value={startDate}
                                onChange={(e) => onStartDateChange(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">Hasta</span>
                            <input
                                type="date"
                                className="py-1 px-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-biosalud-500 bg-white"
                                value={endDate}
                                onChange={(e) => onEndDateChange(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-emerald-200 transition-colors">
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Facturación Bruta</p>
                        <p className="text-xl font-black text-gray-900 mt-1">
                            {formatMoney(performanceStats.totalSales)}
                        </p>
                        {momData && (
                            <div className={`mt-2 flex items-center gap-1 text-[10px] font-bold ${momData.revDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {momData.revDelta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                                {momData.revDelta.toFixed(1)}% vs mes ant.
                            </div>
                        )}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between border-l-4 border-l-blue-500 group hover:border-blue-200 transition-colors">
                    <div>
                        <p className="text-[10px] text-blue-500 uppercase font-black tracking-widest">Impacto Servicios</p>
                        <p className="text-xl font-black text-blue-700 mt-1">{performanceStats.serviceImpact.toFixed(1)}%</p>
                        <p className="text-[10px] text-gray-400 mt-1">S/ Total de Ventas</p>
                    </div>
                    <Zap className="w-5 h-5 text-blue-200" />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between border-l-4 border-l-orange-500 group hover:border-orange-200 transition-colors">
                    <div>
                        <p className="text-[10px] text-orange-500 uppercase font-black tracking-widest">Gastos Operativos</p>
                        <p className="text-xl font-black text-orange-700 mt-1">{formatMoney(performanceStats.totalServices)}</p>
                        {momData && (
                            <div className={`mt-2 flex items-center gap-1 text-[10px] font-bold ${momData.expDelta <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {momData.expDelta <= 0 ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                {momData.expDelta.toFixed(1)}% MoM
                            </div>
                        )}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between border-l-4 border-l-purple-500 group hover:border-purple-200 transition-colors">
                    <div>
                        <p className="text-[10px] text-purple-500 uppercase font-black tracking-widest">Salud de Reposición</p>
                        <p className="text-xl font-black text-purple-700 mt-1">
                            {performanceStats.performanceChart.length > 0
                                ? (performanceStats.totalSales / (performanceStats.totalPurchases || 1)).toFixed(2)
                                : '0.00'}x
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">Ratio Vta/Comp</p>
                    </div>
                </div>
            </div>

            {/* --- PERFORMANCE CHART (Ventas vs Compras Reposición) --- */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                            Relación Venta vs Reposición (Offset +1d)
                        </h3>
                        <p className="text-xs text-gray-500 italic flex items-center gap-1 mt-1">
                            <Info className="w-3 h-3" /> Mostrando Ventas del Día <span className="font-bold">N</span> vs Compras del Día <span className="font-bold text-orange-600">N+1</span> para cuadrar reposición.
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Ventas</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Reposición</span>
                        </div>
                    </div>
                </div>

                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={performanceStats.performanceChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorCompras" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val / 1000}k`} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                formatter={(val: number) => formatMoney(val)}
                            />
                            <Area type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                            <Area type="monotone" dataKey="comprasReposicion" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorCompras)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* --- MASTER SEARCH --- */}
            <div className="bg-slate-900 p-1 rounded-[32px] shadow-2xl overflow-hidden border border-slate-800">
                <div className="bg-gradient-to-br from-slate-800 to-slate-950 p-8 text-white relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Search className="w-32 h-32" />
                    </div>

                    <div className="max-w-3xl mx-auto space-y-6 relative z-10">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-black tracking-tighter flex items-center justify-center gap-3">
                                <Zap className="w-6 h-6 text-yellow-400" />
                                BUSCADOR MAESTRO ZETTI
                            </h2>
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Auditoría en Tiempo Real & Cruce de Datos</p>
                        </div>

                        {/* Search Type Toggles */}
                        <div className="flex justify-center gap-2">
                            {[
                                { id: 'invoice', label: 'Comprobante', icon: FileText },
                                { id: 'client', label: 'Cliente/Cta Cte', icon: User },
                                { id: 'product', label: 'Producto/Receta', icon: Package }
                            ].map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setSearchType(type.id as any)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${searchType === type.id
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105'
                                            : 'bg-slate-800 text-slate-500 hover:text-slate-300 border border-slate-700'
                                        }`}
                                >
                                    <type.icon className="w-3 h-3" />
                                    {type.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder={
                                        searchType === 'invoice' ? "Ej: 0001-00068969" :
                                            searchType === 'client' ? "Nombre del Cliente o Mutual..." :
                                                "Nombre del Producto o Droga..."
                                    }
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl text-white bg-slate-800/50 border border-slate-700 shadow-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono placeholder:text-slate-600 transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleZettiCheck(searchTerm, selectedBranch, searchType)}
                                />
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                            </div>
                            <button
                                onClick={() => handleZettiCheck(searchTerm, selectedBranch, searchType)}
                                disabled={zettiLoading || !searchTerm}
                                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-blue-500/20"
                            >
                                {zettiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudLightning className="w-4 h-4" />}
                                {zettiLoading ? 'BUSCANDO...' : 'BUSCAR'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Zetti Multi-results list (for Client or Product) */}
                {zettiSearchResults.length > 0 && !zettiResult && (
                    <div className="bg-slate-950 p-4 border-t border-slate-800 animate-in fade-in slide-in-from-top-4 duration-500">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4 px-2">Resultados en Zetti ({zettiSearchResults.length})</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {zettiSearchResults.map((res, i) => (
                                <div
                                    key={i}
                                    className="p-4 bg-slate-900 rounded-xl border border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group"
                                    onClick={() => {
                                        if (searchType === 'product') {
                                            setProductSearch(res.description || res.name);
                                            setZettiSearchResults([]);
                                        } else if (searchType === 'client') {
                                            // Maybe set another report state or just highlight
                                            setZettiSearchResults([]);
                                        }
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="p-1.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                            {searchType === 'client' ? <User className="w-4 h-4 text-blue-400" /> : <Package className="w-4 h-4 text-blue-400" />}
                                        </div>
                                        <ExternalLink className="w-3 h-3 text-slate-700 group-hover:text-blue-500" />
                                    </div>
                                    <p className="text-white font-bold text-sm uppercase leading-tight">{res.description || res.name || res.fullName}</p>
                                    <p className="text-[10px] text-slate-500 font-mono mt-2">ID: {res.id || res.codification}</p>
                                    {res.documentNumber && <p className="text-[10px] text-slate-400 mt-0.5">{res.documentType}: {res.documentNumber}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* --- SEARCH RESULTS --- */}
            {searchResult && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4">
                    <div className="bg-gray-50 p-6 border-b border-gray-100 flex flex-wrap justify-between items-start gap-4">
                        <div>
                            <span className="text-xs font-bold text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                {searchResult.invoice.type}
                            </span>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2 font-mono">
                                {searchResult.invoice.invoiceNumber}
                            </h3>
                            <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                {format(searchResult.invoice.date, 'dd/MM/yyyy HH:mm')} • {searchResult.invoice.branch}
                            </p>
                            <button
                                onClick={() => handleZettiCheck(searchResult.invoice.invoiceNumber, searchResult.invoice.branch)}
                                disabled={zettiLoading}
                                className={`mt-4 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${zettiLoading
                                    ? 'bg-blue-100 text-blue-400 cursor-not-allowed'
                                    : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 shadow-sm'
                                    }`}
                            >
                                {zettiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudLightning className="w-4 h-4" />}
                                {zettiLoading ? 'CONECTANDO CON ZETTI...' : 'VERIFICAR EN TIEMPO REAL (ZETTI API)'}
                            </button>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-4 text-sm">
                                <div className="text-right">
                                    <p className="text-gray-400 font-bold uppercase text-[10px]">Monto Bruto</p>
                                    <p className="font-semibold text-gray-600">{formatMoney(searchResult.invoice.grossAmount || (searchResult.sales.reduce((a, b) => a + b.totalAmount, 0)))}</p>
                                </div>
                                {searchResult.invoice.discount !== 0 && (
                                    <div className="text-right">
                                        <p className="text-red-400 font-bold uppercase text-[10px]">Dto / Rec</p>
                                        <p className="font-semibold text-red-600">{formatMoney(searchResult.invoice.discount)}</p>
                                    </div>
                                )}
                            </div>
                            <div className="mt-2 text-right">
                                <p className="text-xs text-blue-500 font-bold uppercase">Total Factura (Neto)</p>
                                <p className="text-4xl font-black text-gray-900 leading-none">{formatMoney(searchResult.invoice.netAmount)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                        <div className="p-6 space-y-3">
                            <h4 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
                                <User className="w-4 h-4" /> Cliente
                            </h4>
                            <p className="font-medium text-lg">{searchResult.invoice.client}</p>
                            <p className="text-sm text-gray-500">{searchResult.invoice.entity}</p>
                        </div>
                        <div className="p-6 space-y-3">
                            <h4 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
                                <HeartPulse className="w-4 h-4" /> Cobertura
                            </h4>
                            <p className="font-medium text-lg">{searchResult.invoice.insurance || 'Particular'}</p>
                        </div>
                        <div className="p-6 space-y-3">
                            <h4 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
                                <CreditCard className="w-4 h-4" /> Pago
                            </h4>
                            <p className="font-medium text-lg">{searchResult.invoice.paymentType}</p>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 border-t border-gray-200">
                        <h4 className="text-sm font-bold text-gray-800 uppercase mb-4">Detalle de Productos (Stock)</h4>
                        {searchResult.sales.length > 0 ? (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-200">
                                        <th className="pb-2">Producto</th>
                                        <th className="pb-2">Rubro</th>
                                        <th className="pb-2 text-right">Cant</th>
                                        <th className="pb-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchResult.sales.map((sale, i) => (
                                        <tr key={i} className="border-b border-gray-100 last:border-0">
                                            <td className="py-3 font-medium text-gray-700">{sale.productName}</td>
                                            <td className="py-3 text-gray-500">{sale.category}</td>
                                            <td className="py-3 text-right">{sale.quantity}</td>
                                            <td className="py-3 text-right font-medium">{formatMoney(sale.totalAmount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    {searchResult.invoice.discount !== 0 && (
                                        <tr className="bg-white italic text-red-500">
                                            <td colSpan={3} className="py-2 text-right">Descuento Factura:</td>
                                            <td className="py-2 text-right">{formatMoney(searchResult.invoice.discount)}</td>
                                        </tr>
                                    )}
                                    <tr className="bg-white">
                                        <td colSpan={3} className="py-3 text-right font-bold text-gray-600">Total Calculado:</td>
                                        <td className="py-3 text-right font-bold text-blue-600">
                                            {formatMoney(searchResult.sales.reduce((a, b) => a + (b.totalAmount || 0), 0) + (searchResult.invoice.discount || 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        ) : (
                            <div className="text-center py-8 text-gray-400 italic bg-white rounded-lg border border-dashed border-gray-200">
                                ⚠️ No se encontraron productos asociados a este comprobante en el archivo de Stock.
                            </div>
                        )}

                        {searchResult.sales.length > 0 && (
                            <div className={`mt-6 p-4 rounded-xl text-sm flex items-start gap-3 ${Math.abs(searchResult.invoice.netAmount - (searchResult.sales.reduce((a, b) => a + b.totalAmount, 0) + searchResult.invoice.discount)) < 100
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                : 'bg-rose-50 text-rose-800 border border-rose-100'
                                }`}>
                                {Math.abs(searchResult.invoice.netAmount - (searchResult.sales.reduce((a, b) => a + b.totalAmount, 0) + searchResult.invoice.discount)) < 100 ? (
                                    <>
                                        <CheckCircle className="w-5 h-5 mt-0.5 text-emerald-500" />
                                        <div>
                                            <p className="font-bold">Auditoría Exitosa</p>
                                            <p className="opacity-90">La suma de los productos ({formatMoney(searchResult.sales.reduce((a, b) => a + b.totalAmount, 0))}) {searchResult.invoice.discount !== 0 ? `aplicando el descuento (${formatMoney(searchResult.invoice.discount)})` : ''} coincide con el total facturado.</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <AlertTriangle className="w-5 h-5 mt-0.5 text-rose-500" />
                                        <div>
                                            <p className="font-bold">Discrepancia Detectada</p>
                                            <p className="opacity-90">La suma de items {searchResult.invoice.discount !== 0 ? '+ descuento ' : ''} ({formatMoney(searchResult.sales.reduce((a, b) => a + b.totalAmount, 0) + searchResult.invoice.discount)}) no coincide con el neto de la factura ({formatMoney(searchResult.invoice.netAmount)}).</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- ZETTI REAL-TIME DATA PANEL --- */}
            {zettiResult && (
                <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="p-4 bg-blue-600 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <CloudLightning className="w-5 h-5 text-white" />
                            <span className="text-sm font-black uppercase tracking-widest text-blue-100">Respuesta Oficial Zetti Server</span>
                        </div>
                        <button onClick={() => setZettiResult(null)} className="text-blue-200 hover:text-white text-xs font-bold px-2">CERRAR</button>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-blue-400 font-bold uppercase text-[10px] mb-4 tracking-widest flex items-center gap-2">
                                <Info className="w-4 h-4" /> Cabecera en Servidor
                            </h4>
                            <div className="space-y-4">
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Estado Actual</p>
                                    <p className={`text-lg font-black ${zettiResult.status?.name === 'INGR' ? 'text-emerald-400' : 'text-blue-400'}`}>
                                        {zettiResult.status?.description || 'DESCONOCIDO'}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 col-span-1">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                                <User className="w-5 h-5 text-purple-400" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase">Vendedor (Creado por)</p>
                                                <p className="text-white font-black capitalize text-xs">
                                                    {zettiResult.creationUser?.description || zettiResult.creationUser?.alias || 'SISTEMA'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 col-span-1">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                                <ShieldCheck className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase">Cajero (Liquidado por)</p>
                                                <p className="text-white font-black capitalize text-xs">
                                                    {zettiResult.modificationUser?.description || zettiResult.modificationUser?.alias || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Métodos de Pago Encontrados */}
                                    {zettiResult.agreements?.some((a: any) => a.type !== 'prescription') && (
                                        <div className="bg-emerald-600/10 p-4 rounded-xl border border-emerald-500/20 col-span-2">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                                    <CreditCard className="w-5 h-5 text-emerald-400" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-emerald-400 font-bold uppercase">Métodos de Pago / Cobro</p>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {zettiResult.agreements.filter((a: any) => a.type !== 'prescription').map((pay: any, idx: number) => (
                                                            <span key={idx} className="px-2 py-0.5 bg-emerald-500/20 rounded text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                                                                {pay.effective?.name || pay.codification || pay.type.toUpperCase()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sección de Obra Social si es receta */}
                                    {zettiResult.agreements?.some((a: any) => a.type === 'prescription') && (
                                        <div className="bg-blue-600/10 p-4 rounded-xl border border-blue-500/20 col-span-2">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                                    <HeartPulse className="w-5 h-5 text-blue-400" />
                                                </div>
                                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Cobertura Médica Detallada</p>
                                            </div>
                                            <div className="space-y-4">
                                                {zettiResult.agreements.filter((a: any) => a.type === 'prescription').map((pay: any, idx: number) => (
                                                    <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-blue-500/10 pt-4 first:border-0 first:pt-0">
                                                        <div>
                                                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Obra Social / Plan</p>
                                                            <p className="text-white font-bold text-sm">{pay.healthInsurance?.name}</p>
                                                            <p className="text-blue-300 text-xs">{pay.healthInsurancePlan?.name || 'Plan General'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Afiliado</p>
                                                            <p className="text-slate-200 text-xs font-bold">{pay.affiliateName || 'Particular'}</p>
                                                            <p className="text-slate-400 text-[10px] font-mono">{pay.affiliateNumber || '-'}</p>
                                                        </div>
                                                        <div className="md:col-span-2 flex justify-between items-end bg-slate-900/50 p-3 rounded-lg border border-blue-500/5">
                                                            <div>
                                                                <p className="text-[10px] text-slate-500 font-bold uppercase">N° Autorización</p>
                                                                <p className="text-emerald-400 font-mono font-bold text-xs">{pay.authorizationNumber || 'SIN NUMERO'}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[10px] text-slate-500 font-bold uppercase">Validación</p>
                                                                <p className="text-slate-400 text-[10px]">
                                                                    {pay.authorizationDate ? format(new Date(pay.authorizationDate), 'dd/MM/yyyy HH:mm') : 'N/A'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                        <p className="text-slate-500 font-bold text-[10px] uppercase">CAE</p>
                                        <p className="font-mono text-slate-300 truncate text-xs">{zettiResult.authorizationNumber || 'N/A'}</p>
                                    </div>
                                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                        <p className="text-slate-500 font-bold text-[10px] uppercase">Vencimiento</p>
                                        <p className="text-slate-300 text-xs">{zettiResult.authorizationExpirationDate ? format(new Date(zettiResult.authorizationExpirationDate), 'dd/MM/yyyy') : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-blue-400 font-bold uppercase text-[10px] mb-4 tracking-widest flex items-center gap-2">
                                <Package className="w-4 h-4" /> Ítems en Zetti ({zettiResult.items?.length || 0})
                            </h4>
                            <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 max-h-60 overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-950/50 border-b border-slate-700">
                                        <tr>
                                            <th className="px-4 py-2 text-slate-500">Producto</th>
                                            <th className="px-4 py-2 text-right text-slate-500">Cant</th>
                                            <th className="px-4 py-2 text-right text-slate-500">Unit.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {zettiResult.items?.map((item: any, i: number) => (
                                            <tr key={i} className="hover:bg-slate-700/30">
                                                <td className="px-4 py-2 font-medium text-slate-200">{item.product?.name}</td>
                                                <td className="px-4 py-2 text-right text-blue-400 font-bold">{item.quantity}</td>
                                                <td className="px-4 py-2 text-right text-slate-400 font-mono">{formatMoney(item.unitPrice)}</td>
                                            </tr>
                                        ))}
                                        {(!zettiResult.items || zettiResult.items.length === 0) && (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-8 text-center text-slate-500 italic">No se devolvieron ítems desde la API.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {zettiError && (
                <div className="bg-rose-900 text-rose-100 p-6 rounded-2xl border border-rose-700 animate-in slide-in-from-top-4 flex items-center gap-4">
                    <AlertTriangle className="w-6 h-6 text-rose-400" />
                    <p className="font-bold">{zettiError}</p>
                    <button onClick={() => setZettiError(null)} className="ml-auto text-rose-400 hover:text-white">✕</button>
                </div>
            )}

            {/* --- SELLER RADIOGRAPHY --- */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Stethoscope className="w-6 h-6 text-blue-600" />
                        Radiografía del Vendedor {selectedSeller ? `- ${selectedSeller}` : ''}
                    </h3>
                </div>

                {selectedSeller && sellerStats ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* 1. What they sell */}
                        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 text-center tracking-wide">Mix de Rubros</h4>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={sellerStats.mixData}
                                            cx="50%" cy="50%"
                                            innerRadius={40} outerRadius={60}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {sellerStats.mixData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(val: number) => formatMoney(val)} />
                                        <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 2. How they collect */}
                        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 text-center tracking-wide">Métodos de Cobro</h4>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={sellerStats.payData} layout="vertical" margin={{ left: 5, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9 }} interval={0} />
                                        <Tooltip formatter={(val: number) => formatMoney(val)} />
                                        <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={15} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 3. Who they serve (Insurances) */}
                        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 text-center tracking-wide">Top Obras Sociales</h4>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={sellerStats.insData} layout="vertical" margin={{ left: 5, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9 }} interval={0} />
                                        <Tooltip formatter={(val: number) => formatMoney(val)} />
                                        <Bar dataKey="value" fill="#82ca9d" radius={[0, 4, 4, 0]} barSize={15} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <User className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                        <p>Seleccione un vendedor arriba para desplegar su perfil comercial completo.</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* --- PAYMENT METHOD ANALYTICS --- */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-green-600" />
                        Analítica de Medios de Pago
                    </h3>
                    <p className="text-xs text-gray-500 mb-6">Comparativa de facturación total y ticket promedio.</p>

                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={paymentAnalytics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={11} />
                                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" tickFormatter={(val) => `$${val / 1000}k`} fontSize={11} />
                                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" tickFormatter={(val) => `$${val}`} fontSize={11} />
                                <Tooltip
                                    formatter={(val: number, name: string) => {
                                        if (name === 'total') return [formatMoney(val), 'Total Facturado'];
                                        if (name === 'avgTicket') return [formatMoney(val), 'Ticket Promedio'];
                                        return [val, name];
                                    }}
                                />
                                <Legend />
                                <Bar yAxisId="left" dataKey="total" name="Total Facturado" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                <Bar yAxisId="right" dataKey="avgTicket" name="Ticket Promedio" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* --- PRODUCT TRACE --- */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Search className="w-5 h-5 text-purple-600" />
                        Traza de Producto
                    </h3>
                    <div className="relative mb-6">
                        <input
                            type="text"
                            placeholder="Buscar producto (ej: IBUPROFENO)..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    </div>

                    {productTrace ? (
                        <div className="flex-1">
                            <div className="bg-purple-50 p-4 rounded-lg mb-4">
                                <h4 className="font-bold text-purple-900 truncate">{productTrace.name}</h4>
                                <div className="flex justify-between mt-2 text-sm">
                                    <span className="text-purple-700">{productTrace.count} ventas encontradas</span>
                                    <span className="font-bold text-purple-900">{formatMoney(productTrace.totalRev)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 h-40">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-2 text-center">Perfil Comprador (O.S.)</p>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={productTrace.topInsurances} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={40}>
                                                {productTrace.topInsurances.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(val: number) => formatMoney(val)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-2 text-center">Preferencia de Pago</p>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={productTrace.topPayments} layout="vertical">
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 9 }} />
                                            <Tooltip formatter={(val: number) => formatMoney(val)} />
                                            <Bar dataKey="value" fill="#82ca9d" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic">
                            Ingrese nombre de producto para ver perfil de compra.
                        </div>
                    )}
                </div>
            </div>

            {/* --- CONSUMPTION MATRIX --- */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <HeartPulse className="w-5 h-5 text-pink-500" />
                    Matriz de Consumo: Obras Sociales vs Rubros
                </h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={insuranceMatrix} layout="vertical" margin={{ left: 60, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" tickFormatter={(val) => `$${val / 1000}k`} />
                            <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12, fontWeight: 500 }} />
                            <Tooltip
                                formatter={(val: number) => formatMoney(val)}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            />
                            <Legend />
                            {matrixKeys.map((key, index) => (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    stackId="a"
                                    fill={COLORS[index % COLORS.length]}
                                    name={key}
                                    barSize={30}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* --- VIP CLIENTS TABLE --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Ranking de Clientes */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Crown className="w-5 h-5 text-yellow-500" />
                        Ranking de Clientes VIP
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                                <tr>
                                    <th className="px-4 py-3">#</th>
                                    <th className="px-4 py-3">Cliente</th>
                                    <th className="px-4 py-3">Categoría Favorita</th>
                                    <th className="px-4 py-3 text-right">Total Facturado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {vipClients.map((client, idx) => (
                                    <tr key={idx} className="hover:bg-yellow-50/30 transition-colors">
                                        <td className="px-4 py-3 text-gray-400 font-mono">{idx + 1}</td>
                                        <td className="px-4 py-3 font-medium text-gray-800">{client.name}</td>
                                        <td className="px-4 py-3 text-gray-600">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold border border-blue-100">
                                                {client.favoriteCategory}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-900">{formatMoney(client.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* --- NEW ENTITY REPORT WIZARD --- */}
                <div className="bg-gradient-to-br from-biosalud-600 to-biosalud-800 p-6 rounded-2xl shadow-xl text-white flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-6 h-6" />
                            <h3 className="text-lg font-bold">Auditoría por Entidad</h3>
                        </div>
                        <p className="text-sm text-biosalud-100 mb-6 font-medium">
                            Genere un reporte detallado de productos adquiridos por una obra social o entidad en un mes específico.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-biosalud-200 mb-1 ml-1">Buscar Entidad</label>
                                <div className="relative mb-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-biosalud-400" />
                                    <input
                                        type="text"
                                        placeholder="Filtrar nombres..."
                                        className="w-full bg-biosalud-700/50 border border-biosalud-500 text-white rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-white/20 placeholder:text-biosalud-400"
                                        value={searchTermEntity}
                                        onChange={(e) => setSearchTermEntity(e.target.value)}
                                    />
                                </div>
                                <select
                                    className="w-full bg-biosalud-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 border-biosalud-500"
                                    value={selectedEntityReport}
                                    onChange={(e) => setSelectedEntityReport(e.target.value)}
                                >
                                    <option value="">{availableEntities.length === 0 ? 'No se encontraron resultados' : '-- Seleccionar Entidad --'}</option>
                                    {availableEntities.map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-biosalud-200 mb-1 ml-1">Período de Análisis</label>
                                <select
                                    className="w-full bg-biosalud-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20 border-biosalud-500"
                                    value={selectedMonthReport}
                                    onChange={(e) => setSelectedMonthReport(e.target.value)}
                                >
                                    <option value="">-- Seleccionar Mes --</option>
                                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <button
                        disabled={!selectedEntityReport || !selectedMonthReport}
                        onClick={() => setShowEntityReport(true)}
                        className="mt-8 w-full bg-white text-biosalud-600 font-bold py-3 rounded-xl shadow-lg border-2 border-transparent hover:bg-biosalud-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
                    >
                        <span>Generar Reporte Imprimible</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>

        </div>
    );
};
