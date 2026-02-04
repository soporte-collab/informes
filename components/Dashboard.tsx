import React, { useMemo, useState, useRef } from 'react';
import { SaleRecord, StockRecord, ExpenseRecord } from '../types';
import { StatsCard } from './StatsCard';
import { formatMoney } from '../utils/dataHelpers';
import { ProductFilter } from './ProductFilter';
import { EntityFilter } from './EntityFilter';
const ResponsiveContainer = ({ children }: any) => <div className="h-full w-full bg-gray-50 rounded-2xl flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase">Gráfico Detalizado</div>;
const BarChart = ({ children }: any) => <div>{children}</div>;
const Bar = () => null;
const XAxis = () => null;
const YAxis = () => null;
const CartesianGrid = () => null;
const Tooltip = () => null;
const AreaChart = ({ children }: any) => <div>{children}</div>;
const Area = () => null;
const PieChart = ({ children }: any) => <div>{children}</div>;
const Pie = () => null;
const Cell = () => null;
const Legend = () => null;
const ComposedChart = ({ children }: any) => <div>{children}</div>;
const Line = () => null;
import { DollarSign, ShoppingBag, Building2, TrendingUp, Filter, Ban, Printer, CheckCircle, X, PieChart as PieChartIcon, Package, Tag, CalendarRange, User, Clock, Award, Users, Search, ChevronRight, Lightbulb, Upload, ShoppingCart, ShieldCheck, Zap, Calendar, HardDrive } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SalesHeatmap } from './SalesHeatmap';
import { PaymentMethodChart } from './PaymentMethodChart';
import { HeatmapDetailModal } from './HeatmapDetailModal';
import { ScheduleOptimization } from './ScheduleOptimization';

interface DashboardProps {
    data: SaleRecord[];
    stockData: StockRecord[];
    expenseData: ExpenseRecord[];
    onSelectSeller: (name: string) => void;
    selectedSeller: string | null;
    selectedBranch: string;
    onSelectBranch: (branch: string) => void;
    startDate: string;
    endDate: string;
    excludedProducts: string[];
    includedProducts: string[];
    onToggleExclusion: (productName: string) => void;
    onToggleInclusion: (productName: string) => void;
    excludedEntities: string[];
    includedEntities: string[];
    onToggleEntityExclusion: (entityName: string) => void;
    onToggleEntityInclusion: (entityName: string) => void;
    onPrintReport: () => void;
    onTimeSyncUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUploadInvoices?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
    data,
    stockData,
    expenseData,
    onSelectSeller,
    selectedSeller,
    selectedBranch,
    onSelectBranch,
    startDate,
    endDate,
    excludedProducts,
    includedProducts,
    onToggleExclusion,
    onToggleInclusion,
    excludedEntities,
    includedEntities,
    onToggleEntityExclusion,
    onToggleEntityInclusion,
    onPrintReport,
    onTimeSyncUpload,
    onUploadInvoices
}) => {
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isEntityFilterOpen, setIsEntityFilterOpen] = useState(false);
    const [activeStatDetail, setActiveStatDetail] = useState<'sales' | 'transactions' | null>(null);
    const [activeProduct, setActiveProduct] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [activeManufacturer, setActiveManufacturer] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showStockEvolution, setShowStockEvolution] = useState(false);

    // Heatmap Detail State
    const [isHeatmapModalOpen, setIsHeatmapModalOpen] = useState(false);
    const [activeHeatmapSlot, setActiveHeatmapSlot] = useState<{ dayIndex: number, hour: number, dayName: string } | null>(null);
    const [heatmapMode, setHeatmapMode] = useState<'map' | 'optimize'>('map');

    const timeInputRef = useRef<HTMLInputElement>(null);

    // Extract unique products
    const allProducts = useMemo(() => {
        const products = new Set((data || []).map(d => d.productName));
        return Array.from(products).sort();
    }, [data]);

    // Extract unique Entities
    const allEntities = useMemo(() => {
        const entities = new Set((data || []).map(d => d.entity || "Particular"));
        return Array.from(entities).filter(e => e).sort();
    }, [data]);


    // Filter data
    const filteredData = useMemo(() => {
        return (data || []).filter(d => {
            let productMatch = true;
            if (includedProducts.length > 0) {
                productMatch = includedProducts.includes(d.productName);
            } else {
                productMatch = !excludedProducts.includes(d.productName);
            }

            let entityMatch = true;
            const currentEntity = d.entity || "Particular";
            if (includedEntities.length > 0) {
                entityMatch = includedEntities.includes(currentEntity);
            } else {
                entityMatch = !excludedEntities.includes(currentEntity);
            }

            return productMatch && entityMatch;
        });
    }, [data, excludedProducts, includedProducts, excludedEntities, includedEntities]);

    // Aggregated Stats
    const stats = useMemo(() => {
        let totalSales = 0;
        let missingAmounts = 0;

        filteredData.forEach(curr => {
            const val = Number(curr.totalAmount);
            if (isNaN(val) || val === 0) {
                missingAmounts++;
            } else {
                totalSales += val;
            }
        });

        const totalTransactions = filteredData.length;
        const totalUnits = filteredData.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
        const upt = totalTransactions > 0 ? totalUnits / totalTransactions : 0;

        return { totalSales, totalTransactions, totalUnits, upt, hasAnomalies: missingAmounts > 0 && totalTransactions > 0 && totalSales === 0 };
    }, [filteredData]);

    // Branch Breakdown Logic for Modal
    const branchBreakdown = useMemo(() => {
        const breakdown = {
            chacras: { name: 'Chacras Park', sales: 0, tx: 0 },
            fcia: { name: 'Fcia Biosalud (Paseo)', sales: 0, tx: 0 }
        };

        filteredData.forEach(d => {
            const amount = Number(d.totalAmount) || 0;
            if (d.branch.toUpperCase().includes('CHACRAS')) {
                breakdown.chacras.sales += amount;
                breakdown.chacras.tx += 1;
            } else {
                breakdown.fcia.sales += amount;
                breakdown.fcia.tx += 1;
            }
        });
        return breakdown;
    }, [filteredData]);

    // Evolution Data for Branch Modal
    const branchTrendData = useMemo(() => {
        if (!activeStatDetail) return [];

        const trendBaseData = filteredData.filter(d => {
            let productMatch = true;
            if (includedProducts.length > 0) productMatch = includedProducts.includes(d.productName);
            else productMatch = !excludedProducts.includes(d.productName);

            let entityMatch = true;
            const currentEntity = d.entity || "Particular";
            if (includedEntities.length > 0) entityMatch = includedEntities.includes(currentEntity);
            else entityMatch = !excludedEntities.includes(currentEntity);

            return productMatch && entityMatch;
        });

        const map = new Map<string, { label: string, month: string, chacras: number, fcia: number }>();

        trendBaseData.forEach(d => {
            const key = d.monthYear;
            if (!key) return; // Robustness

            if (!map.has(key)) {
                const parts = key.split('-');
                const y = Number(parts[0]);
                const m = Number(parts[1]);
                const dateObj = new Date(y, m - 1);
                const label = format(dateObj, 'MMM yy', { locale: es });
                map.set(key, { label, month: key, chacras: 0, fcia: 0 });
            }
            const entry = map.get(key)!;
            const val = activeStatDetail === 'sales' ? d.totalAmount : 1;

            if (d.branch.toUpperCase().includes('CHACRAS')) {
                entry.chacras += val;
            } else {
                entry.fcia += val;
            }
        });

        return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    }, [data, activeStatDetail, includedProducts, excludedProducts, includedEntities, excludedEntities]);

    // Evolution Data for Product Modal
    const productTrendData = useMemo(() => {
        if (!activeProduct) return [];
        const productData = filteredData.filter(d => d.productName === activeProduct);
        const map = new Map<string, { label: string, month: string, qty: number, revenue: number }>();
        productData.forEach(d => {
            const key = d.monthYear;
            if (!key) return; // Robustness

            if (!map.has(key)) {
                const parts = key.split('-');
                const y = Number(parts[0]);
                const m = Number(parts[1]);
                const dateObj = new Date(y, m - 1);
                const label = format(dateObj, 'MMM yy', { locale: es });
                map.set(key, { label, month: key, qty: 0, revenue: 0 });
            }
            const entry = map.get(key)!;
            entry.qty += d.quantity;
            entry.revenue += d.totalAmount;
        });
        return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    }, [data, activeProduct]);

    // PREPARE PRODUCT EVOLUTION DATA (Stock + Sales)
    const productEvolutionData = useMemo(() => {
        if (!activeProduct) return [];

        // 1. Get Sales by day
        const salesByDay = new Map<string, number>();
        (data || []).filter(d => d.productName === activeProduct).forEach(d => {
            const day = d.date.toISOString().split('T')[0];
            salesByDay.set(day, (salesByDay.get(day) || 0) + d.quantity);
        });

        // 2. Get Stock Snapshots
        const stockByDay = new Map<string, number>();
        (stockData || []).filter(s => s.productName === activeProduct).forEach(s => {
            const day = s.date.toISOString().split('T')[0];
            stockByDay.set(day, s.currentStock);
        });

        // 3. Get Purchase/Expense movements
        const purchasesByDay = new Map<string, number>();
        (expenseData || []).forEach(exp => {
            exp.items?.filter(item => item.name === activeProduct).forEach(item => {
                const day = exp.issueDate.toISOString().split('T')[0];
                purchasesByDay.set(day, (purchasesByDay.get(day) || 0) + item.quantity);
            });
        });

        // Combine unique days
        const allDays = Array.from(new Set([
            ...Array.from(salesByDay.keys()),
            ...Array.from(stockByDay.keys()),
            ...Array.from(purchasesByDay.keys())
        ])).sort().slice(-30); // Last 30 days of activity
        return allDays.map(day => ({
            day: format(new Date(day + 'T12:00:00'), 'dd/MM'),
            sales: salesByDay.get(day) || 0,
            stock: stockByDay.get(day) || 0,
            purchases: purchasesByDay.get(day) || 0
        }));
    }, [activeProduct, data, stockData, expenseData]);

    const crossSellingAnalysis = useMemo(() => {
        const matrix = new Map<string, Map<string, number>>();
        const transactionsMap = new Map<string, string[]>();

        (data || []).forEach(d => {
            if (!d.invoiceNumber) return;
            if (!transactionsMap.has(d.invoiceNumber)) transactionsMap.set(d.invoiceNumber, []);
            transactionsMap.get(d.invoiceNumber)!.push(d.productName);
        });

        transactionsMap.forEach(items => {
            if (items.length < 2) return;
            for (let i = 0; i < items.length; i++) {
                for (let j = 0; j < items.length; j++) {
                    if (i === j) continue;
                    const pA = items[i];
                    const pB = items[j];
                    if (!matrix.has(pA)) matrix.set(pA, new Map());
                    const subMap = matrix.get(pA)!;
                    subMap.set(pB, (subMap.get(pB) || 0) + 1);
                }
            }
        });
        return matrix;
    }, [data]);

    const relatedProducts = useMemo(() => {
        if (!activeProduct) return [];
        const matches = crossSellingAnalysis.get(activeProduct);
        if (!matches) return [];

        return Array.from(matches.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
    }, [activeProduct, crossSellingAnalysis]);

    const filteredProductList = useMemo(() => {
        if (!searchTerm) return [];
        return allProducts.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10);
    }, [searchTerm, allProducts]);

    // Ranking data for specific category Modal
    const categoryProductRanking = useMemo(() => {
        if (!activeCategory) return [];
        const categoryData = filteredData.filter(d => (d.category || 'Sin Categoría') === activeCategory);
        const map = new Map<string, { name: string, qty: number, total: number }>();
        categoryData.forEach(d => {
            const current = map.get(d.productName) || { name: d.productName, qty: 0, total: 0 };
            map.set(d.productName, {
                name: d.productName,
                qty: current.qty + d.quantity,
                total: current.total + d.totalAmount
            });
        });
        return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
    }, [filteredData, activeCategory]);

    const manufacturerProductRanking = useMemo(() => {
        if (!activeManufacturer) return [];
        const manufacturerData = filteredData.filter(d => (d.manufacturer || 'Varios') === activeManufacturer);
        const map = new Map<string, { name: string, qty: number, total: number }>();
        manufacturerData.forEach(d => {
            const current = map.get(d.productName) || { name: d.productName, qty: 0, total: 0 };
            map.set(d.productName, {
                name: d.productName,
                qty: current.qty + d.quantity,
                total: current.total + d.totalAmount
            });
        });
        return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
    }, [filteredData, activeManufacturer]);

    const renderDetailModal = () => {
        if (!activeStatDetail) return null;
        const isSales = activeStatDetail === 'sales';
        const total = isSales ? stats.totalSales : stats.totalTransactions;
        const valA = isSales ? branchBreakdown.chacras.sales : branchBreakdown.chacras.tx;
        const valB = isSales ? branchBreakdown.fcia.sales : branchBreakdown.fcia.tx;
        const pctA = total > 0 ? (valA / total) * 100 : 0;
        const pctB = total > 0 ? (valB / total) * 100 : 0;
        const diff = valA - valB;
        const diffPct = valB > 0 ? ((valA - valB) / valB) * 100 : 0;
        const winnerName = valA >= valB ? branchBreakdown.chacras.name : branchBreakdown.fcia.name;
        const formatValue = (v: number) => isSales ? formatMoney(v) : v.toLocaleString();

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActiveStatDetail(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            {isSales ? <DollarSign className="w-6 h-6 text-green-600" /> : <ShoppingBag className="w-6 h-6 text-blue-600" />}
                            Detalle de {isSales ? 'Ventas' : 'Transacciones'}
                        </h3>
                        <button onClick={() => setActiveStatDetail(null)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <div className="text-center mb-6">
                            <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Total Global (Selección)</p>
                            <p className="text-4xl font-extrabold text-gray-900 mt-1">{formatValue(total)}</p>
                        </div>
                        <div className="space-y-4 mb-8">
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-biosalud-500"></span>
                                        {branchBreakdown.chacras.name}
                                    </span>
                                    <span className="text-gray-900">{formatValue(valA)}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-biosalud-500 rounded-full" style={{ width: `${pctA}%` }}></div>
                                </div>
                                <div className="text-right text-xs text-gray-500">{pctA.toFixed(1)}% del total</div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                        {branchBreakdown.fcia.name}
                                    </span>
                                    <span className="text-gray-900">{formatValue(valB)}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pctB}%` }}></div>
                                </div>
                                <div className="text-right text-xs text-gray-500">{pctB.toFixed(1)}% del total</div>
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-8">
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Análisis de Diferencia</h4>
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-full ${diff !== 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200'}`}>
                                    <PieChartIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                        La sucursal <strong className="text-gray-900">{winnerName}</strong> lidera con una diferencia de <strong>{formatValue(Math.abs(diff))}</strong>.
                                    </p>
                                    {valB > 0 && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Representa un <strong>{Math.abs(diffPct).toFixed(1)}%</strong> {diff >= 0 ? 'más' : 'menos'} respecto a la otra sucursal.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-gray-500" />
                                Evolución Mensual Comparativa
                            </h4>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={branchTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorChacras" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorFcia" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="label" fontSize={11} />
                                        <YAxis fontSize={11} tickFormatter={(val) => isSales ? `$${val / 1000}k` : val} />
                                        <Tooltip formatter={(val: number, name: string) => [formatValue(val), name]} />
                                        <Legend />
                                        <Area type="monotone" dataKey="chacras" name="Chacras Park" stroke="#22c55e" fillOpacity={1} fill="url(#colorChacras)" isAnimationActive={false} />
                                        <Area type="monotone" dataKey="fcia" name="Paseo" stroke="#3b82f6" fillOpacity={1} fill="url(#colorFcia)" isAnimationActive={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderProductModal = () => {
        if (!activeProduct) return null;

        const totalQty = productTrendData.reduce((acc, d) => acc + d.qty, 0);
        const totalRev = productTrendData.reduce((acc, d) => acc + d.revenue, 0);

        // Find current stock from stockData
        const currentStockItem = (stockData || []).filter(s => s.productName === activeProduct).sort((a, b) => b.date.getTime() - a.date.getTime())[0];
        const currentStock = currentStockItem ? currentStockItem.currentStock : 0;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setActiveProduct(null)}>
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                        <div className="flex gap-4">
                            <div className="bg-indigo-600 p-4 rounded-3xl shadow-lg shadow-indigo-200">
                                <Package className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">
                                    {activeProduct}
                                </h3>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Auditoría detallada de inventario</p>
                            </div>
                        </div>
                        <button onClick={() => setActiveProduct(null)} className="p-2 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 shadow-sm transition-all">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
                        {/* KPI Header */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Stock Actual</p>
                                <div className="flex items-center gap-2">
                                    <p className={`text-2xl font-black ${currentStock < 5 ? 'text-rose-500' : 'text-slate-700'}`}>{currentStock}</p>
                                    <span className="text-[10px] font-bold text-slate-400">UNIDADES</span>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Ventas Período</p>
                                <p className="text-2xl font-black text-indigo-600">{totalQty}</p>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Facturación</p>
                                <p className="text-2xl font-black text-emerald-600">{formatMoney(totalRev)}</p>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Promedio Diario</p>
                                <p className="text-2xl font-black text-amber-600">{(totalQty / 30).toFixed(1)}</p>
                            </div>
                        </div>

                        {/* Chart Area - Now Full Width */}
                        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-indigo-500" />
                                    Evolución Mixta (Stock vs Ventas)
                                </h4>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Stock Real</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Ventas</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={productEvolutionData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} name="Ventas" barSize={30} />
                                        <Line type="monotone" dataKey="stock" stroke="#10b981" strokeWidth={4} dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} name="Stock Real" />
                                        <Area type="monotone" dataKey="purchases" fill="#f59e0b" fillOpacity={0.1} stroke="#f59e0b" strokeDasharray="5 5" name="Ingresos de Mercaderia" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* NEW: Cross Selling & Intelligence */}
                        {relatedProducts.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-slate-900 rounded-[32px] p-8 text-white shadow-xl">
                                    <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                                        <Zap className="w-4 h-4 fill-indigo-400" /> Inteligencia de Venta Cruzada
                                    </div>
                                    <h4 className="text-xl font-black mb-6 uppercase tracking-tighter">Frecuentemente comprados juntos</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {relatedProducts.map((rp, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all group">
                                                <span className="text-xs font-bold uppercase truncate max-w-[200px]">{rp.name}</span>
                                                <span className="text-[10px] font-black bg-indigo-500/30 text-indigo-200 px-2 py-1 rounded-lg">
                                                    {rp.count} COINCIDENCIAS
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-indigo-50 rounded-[32px] p-8 border border-indigo-100 flex flex-col justify-center">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4">
                                        <Lightbulb className="w-6 h-6 text-white" />
                                    </div>
                                    <h4 className="text-indigo-900 font-black text-sm uppercase mb-2">Acción Recomendada</h4>
                                    <p className="text-indigo-600/70 text-xs font-medium leading-relaxed">
                                        Considere crear un <b>"Pack de Salud"</b> o combo promocional con estos artículos vinculados para incrementar el ticket promedio (UPT).
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Detailed Evolution Table - Captura 2 style */}
                        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                    Detalle Histórico de Movimientos
                                </h4>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80">
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Fecha</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Sucursal</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Movimiento</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Entidad</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Ingreso</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Egreso</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Saldo</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Codificación</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Usuario</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {(stockData || [])
                                            .filter(s => s.productName === activeProduct)
                                            .sort((a, b) => b.date.getTime() - a.date.getTime())
                                            .map((mov, idx) => {
                                                const type = (mov.movementType || '').toUpperCase();
                                                const isSale = type.includes('FACTURA') || type.includes('VENTA');
                                                const isReceipt = type.includes('REMITO') || type.includes('PROVEEDOR');
                                                const isAjustePlus = type.includes('(+)');
                                                const isAjusteMinus = type.includes('(-)');

                                                // Determine if it should be an Ingreso or Egreso based on user rules
                                                let isIngreso = mov.units > 0;
                                                if (isSale) isIngreso = false;
                                                else if (isReceipt) isIngreso = true;
                                                else if (isAjustePlus) isIngreso = true;
                                                else if (isAjusteMinus) isIngreso = false;

                                                const qtyAbs = Math.abs(mov.units);

                                                // Entity mapping: 99999 = CONSUMIDOR FINAL
                                                const entityDisplay = (String(mov.entity) === '99999')
                                                    ? 'CONSUMIDOR FINAL'
                                                    : (mov.entity || (mov.invoiceNumber ? (isSale ? 'CLIENTE FINAL' : 'PROVEEDOR') : 'SISTEMA'));

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 text-[11px] font-bold text-slate-600">
                                                            {format(mov.date, 'dd/MM/yyyy HH:mm')}
                                                        </td>
                                                        <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">
                                                            {mov.branch.replace('BIOSALUD ', '')}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${isSale ? 'bg-indigo-50 text-indigo-600' :
                                                                isReceipt ? 'bg-emerald-50 text-emerald-600' :
                                                                    'bg-slate-100 text-slate-500'
                                                                }`}>
                                                                {mov.movementType || 'AJUSTE'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase truncate max-w-[150px]">
                                                            {entityDisplay}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-xs font-black text-emerald-600">
                                                            {isIngreso ? qtyAbs : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-xs font-black text-rose-600">
                                                            {!isIngreso ? qtyAbs : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-xs font-black text-slate-800 bg-slate-50/50">
                                                            {mov.currentStock}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-[10px] font-mono font-bold text-slate-400">
                                                            {mov.invoiceNumber || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase">
                                                            {mov.seller || 'SISTEMA'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderCategoryModal = () => {
        if (!activeCategory) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActiveCategory(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Tag className="w-6 h-6 text-blue-600" />
                                {activeCategory}
                            </h3>
                            <p className="text-sm text-gray-500">Top 10 Productos por Facturación</p>
                        </div>
                        <button onClick={() => setActiveCategory(null)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-0 overflow-y-auto">
                        {categoryProductRanking.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">No hay datos para este rubro.</div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3">Producto</th>
                                        <th className="px-6 py-3 text-right">Unidades</th>
                                        <th className="px-6 py-3 text-right">Total ($)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {categoryProductRanking.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => setActiveProduct(item.name)}>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold text-gray-500 bg-gray-100`}>
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-right text-sm text-gray-600">{item.qty}</td>
                                            <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatMoney(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <div className="p-4 bg-gray-50 text-center text-xs text-gray-400 border-t border-gray-100">
                            Toque un producto para ver su evolución histórica
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderManufacturerModal = () => {
        if (!activeManufacturer) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActiveManufacturer(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Award className="w-6 h-6 text-emerald-600" />
                                {activeManufacturer}
                            </h3>
                            <p className="text-sm text-gray-500">Top 10 Productos por Facturación</p>
                        </div>
                        <button onClick={() => setActiveManufacturer(null)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-0 overflow-y-auto">
                        {manufacturerProductRanking.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">No hay datos para este fabricante.</div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3">Producto</th>
                                        <th className="px-6 py-3 text-right">Unidades</th>
                                        <th className="px-6 py-3 text-right">Total ($)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {manufacturerProductRanking.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-emerald-50 cursor-pointer transition-colors" onClick={() => setActiveProduct(item.name)}>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold text-gray-500 bg-gray-100`}>
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-right text-sm text-gray-600">{item.qty}</td>
                                            <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatMoney(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <div className="p-4 bg-gray-50 text-center text-xs text-gray-400 border-t border-gray-100">
                            Toque un producto para ver su evolución histórica
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 relative">
            {renderDetailModal()}
            {renderProductModal()}
            {renderCategoryModal()}
            {renderManufacturerModal()}

            <HeatmapDetailModal
                isOpen={isHeatmapModalOpen}
                onClose={() => setIsHeatmapModalOpen(false)}
                activeSlot={activeHeatmapSlot}
                setActiveSlot={setActiveHeatmapSlot}
                data={filteredData}
            />

            <ProductFilter
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                allProducts={allProducts}
                excludedProducts={excludedProducts}
                includedProducts={includedProducts}
                onToggleExclusion={onToggleExclusion}
                onToggleInclusion={onToggleInclusion}
            />

            <EntityFilter
                isOpen={isEntityFilterOpen}
                onClose={() => setIsEntityFilterOpen(false)}
                allEntities={allEntities}
                excludedEntities={excludedEntities}
                includedEntities={includedEntities}
                onToggleExclusion={onToggleEntityExclusion}
                onToggleInclusion={onToggleEntityInclusion}
            />

            {onTimeSyncUpload && (
                <input
                    type="file"
                    ref={timeInputRef}
                    className="hidden"
                    accept=".csv,.txt"
                    onChange={onTimeSyncUpload}
                />
            )}



            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                <StatsCard title="Ventas Totales" value={formatMoney(stats.totalSales)} icon={<DollarSign className="w-5 h-5" />} color="green" onClick={() => setActiveStatDetail('sales')} />
                <StatsCard title="Transacciones" value={stats.totalTransactions.toLocaleString()} icon={<ShoppingBag className="w-5 h-5" />} color="blue" onClick={() => setActiveStatDetail('transactions')} />

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-gray-500">Unidades Vendidas</span>
                        <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                            <Package className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-gray-900">
                            {stats.totalUnits.toLocaleString()}
                        </h3>
                        <p className="text-xs text-orange-600 font-medium">Volumen Total</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-gray-500">UPT (Promedio)</span>
                        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-gray-900">
                            {stats.upt.toFixed(2)}
                        </h3>
                        <p className="text-xs text-indigo-600 font-medium">Unidades por Ticket</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-gray-400" />
                        Tendencia de Ventas (Mensual)
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            {(() => {
                                const map = new Map<string, { label: string, value: number }>();
                                filteredData.forEach(d => {
                                    const key = d.monthYear;
                                    if (!key) return; // Robustness

                                    if (!map.has(key)) {
                                        const parts = key.split('-');
                                        const y = Number(parts[0]);
                                        const m = Number(parts[1]);
                                        const date = new Date(y, m - 1);
                                        const label = format(date, 'MMM yy', { locale: es });
                                        map.set(key, { label, value: 0 });
                                    }
                                    map.get(key)!.value += d.totalAmount;
                                });
                                const sortedData = Array.from(map.entries())
                                    .sort((a, b) => a[0].localeCompare(b[0]))
                                    .map(e => e[1]);

                                return (
                                    <AreaChart data={sortedData}>
                                        <defs>
                                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="label" fontSize={12} />
                                        <YAxis fontSize={12} tickFormatter={(val) => `$${val / 1000}k`} />
                                        <Tooltip formatter={(val: number) => formatMoney(val)} />
                                        <Area type="monotone" dataKey="value" stroke="#22c55e" fillOpacity={1} fill="url(#colorSales)" name="Ventas" isAnimationActive={false} />
                                    </AreaChart>
                                );
                            })()}
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Tag className="w-5 h-5 text-gray-400" />
                        Ventas por Rubro
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            {(() => {
                                const map = new Map<string, number>();
                                filteredData.forEach(d => {
                                    const cat = d.category || 'Varios';
                                    map.set(cat, (map.get(cat) || 0) + d.totalAmount);
                                });
                                // Top 5 categories + others
                                const sorted = Array.from(map.entries())
                                    .sort((a, b) => b[1] - a[1]);

                                let finalData = sorted;
                                if (sorted.length > 7) {
                                    const top7 = sorted.slice(0, 7);
                                    const others = sorted.slice(7).reduce((acc, curr) => acc + curr[1], 0);
                                    finalData = [...top7, ['Otros', others]];
                                }

                                const data = finalData.map(e => ({ name: e[0], value: e[1] }));
                                const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ef4444', '#9ca3af'];

                                return (
                                    <PieChart>
                                        <Pie
                                            data={data}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {data.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(val: number) => formatMoney(val)} />
                                        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '11px' }} />
                                    </PieChart>
                                );
                            })()}
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* NEW ROW: Sales by Category */}

            {/* NEW ROW: TOP RUBROS (VOLUMEN) - Replaces Bar Chart */}
            {/* NEW ROW: TOP RANKINGS (SPLIT) */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 no-print">
                {/* COLUMN 1: TOP RUBROS */}
                <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-100 flex flex-col h-[500px]">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                                <Award className="w-6 h-6 text-indigo-600" /> TOP RUBROS
                            </h3>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Ranking por unidades</p>
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 text-slate-400 uppercase text-[9px] font-black tracking-widest sticky top-0 backdrop-blur-md z-10">
                                <tr>
                                    <th className="py-3 px-4">Rubro</th>
                                    <th className="py-3 px-4 text-right">Unidades</th>
                                    <th className="py-3 px-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {(() => {
                                    const catMap = new Map<string, { qty: number, revenue: number }>();
                                    filteredData.forEach(d => {
                                        const cat = d.category || 'Varios';
                                        const current = catMap.get(cat) || { qty: 0, revenue: 0 };
                                        catMap.set(cat, {
                                            qty: current.qty + (d.quantity || 0),
                                            revenue: current.revenue + (d.totalAmount || 0)
                                        });
                                    });

                                    const sorted = Array.from(catMap.entries())
                                        .sort((a, b) => b[1].revenue - a[1].revenue);

                                    const totalRev = sorted.reduce((acc, curr) => acc + curr[1].revenue, 0);
                                    let cumulative = 0;

                                    return sorted
                                        .slice(0, 50)
                                        .map(([name, vals], idx) => {
                                            cumulative += vals.revenue;
                                            const pct = (cumulative / totalRev) * 100;
                                            const pareto = pct <= 70 ? 'A' : pct <= 90 ? 'B' : 'C';

                                            return (
                                                <tr
                                                    key={name}
                                                    className="hover:bg-slate-50/50 cursor-pointer group transition-all"
                                                    onClick={() => setActiveCategory(name)}
                                                >
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-black text-slate-300 w-4">{idx + 1}</span>
                                                            <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 uppercase truncate max-w-[180px]">{name}</span>
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${pareto === 'A' ? 'bg-emerald-500 text-white' :
                                                                pareto === 'B' ? 'bg-amber-500 text-white' :
                                                                    'bg-slate-200 text-slate-600'
                                                                }`}>
                                                                {pareto}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                                            {vals.qty.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                                                    </td>
                                                </tr>
                                            );
                                        });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* COLUMN 2: TOP FABRICANTES */}
                <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-100 flex flex-col h-[500px]">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                                <Award className="w-6 h-6 text-emerald-600" /> TOP FABRICANTES
                            </h3>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Ranking por unidades</p>
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 text-slate-400 uppercase text-[9px] font-black tracking-widest sticky top-0 backdrop-blur-md z-10">
                                <tr>
                                    <th className="py-3 px-4">Laboratorio</th>
                                    <th className="py-3 px-4 text-right">Unidades</th>
                                    <th className="py-3 px-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {(() => {
                                    const mfgMap = new Map<string, { qty: number, revenue: number }>();
                                    filteredData.forEach(d => {
                                        const mfg = d.manufacturer || 'Varios';
                                        const current = mfgMap.get(mfg) || { qty: 0, revenue: 0 };
                                        mfgMap.set(mfg, {
                                            qty: current.qty + (d.quantity || 0),
                                            revenue: current.revenue + (d.totalAmount || 0)
                                        });
                                    });

                                    const sortedMfg = Array.from(mfgMap.entries())
                                        .sort((a, b) => b[1].revenue - a[1].revenue);

                                    const totalRevMfg = sortedMfg.reduce((acc, curr) => acc + curr[1].revenue, 0);
                                    let cumulativeMfg = 0;

                                    return sortedMfg
                                        .slice(0, 50)
                                        .map(([name, vals], idx) => {
                                            cumulativeMfg += vals.revenue;
                                            const pct = (cumulativeMfg / totalRevMfg) * 100;
                                            const pareto = pct <= 70 ? 'A' : pct <= 90 ? 'B' : 'C';

                                            return (
                                                <tr
                                                    key={name}
                                                    className="hover:bg-slate-50/50 cursor-pointer group transition-all"
                                                    onClick={() => setActiveManufacturer(name)}
                                                >
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-black text-slate-300 w-4">{idx + 1}</span>
                                                            <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-600 uppercase truncate max-w-[180px]">{name}</span>
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${pareto === 'A' ? 'bg-emerald-500 text-white' :
                                                                pareto === 'B' ? 'bg-amber-500 text-white' :
                                                                    'bg-slate-200 text-slate-600'
                                                                }`}>
                                                                {pareto}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                                            {vals.qty.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500" />
                                                    </td>
                                                </tr>
                                            );
                                        });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* NEW ROW: Heatmap & Payment Methods */}
            <div className="mt-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 no-print">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div className="flex flex-col">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-purple-600" />
                            Análisis Temporal de Operaciones
                        </h3>
                        <p className="text-[10px] text-gray-400 font-medium">Use los comprobantes de caja para mayor precisión en los horarios.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onUploadInvoices}
                            className="flex items-center gap-2 bg-indigo-600 px-4 py-2 rounded-xl text-xs font-black text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                        >
                            <Upload className="w-4 h-4" />
                            ACTUALIZAR CAJA
                        </button>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setHeatmapMode('map')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${heatmapMode === 'map' ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Mapa de Calor (Tráfico)
                            </button>
                            <button
                                onClick={() => setHeatmapMode('optimize')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${heatmapMode === 'optimize' ? 'bg-white shadow text-amber-700' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <Lightbulb className="w-3.5 h-3.5" />
                                    Sugerencias de Cierre
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2">
                        {heatmapMode === 'map' ? (
                            <SalesHeatmap
                                data={filteredData}
                                onCellClick={(dayIndex, hour, dayName) => {
                                    setActiveHeatmapSlot({ dayIndex, hour, dayName });
                                    setIsHeatmapModalOpen(true);
                                }}
                            />
                        ) : (
                            <ScheduleOptimization data={filteredData} />
                        )}
                    </div>
                    <div className="xl:col-span-1">
                        <PaymentMethodChart data={filteredData} />
                    </div>
                </div>
            </div>

            <div className="mt-12 mb-20 no-print">
                {/* Audit Search at Bottom - Full Width Row */}
                <div className="bg-slate-900 p-12 rounded-[50px] shadow-3xl relative overflow-hidden flex flex-col justify-center min-h-[400px]">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none transform rotate-12">
                        <Search className="w-96 h-96 text-white" />
                    </div>

                    <div className="relative z-10 max-w-4xl mx-auto w-full text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20 mb-6">
                            <ShieldCheck className="w-4 h-4 text-indigo-400" />
                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">Módulo de Auditoría</span>
                        </div>
                        <h3 className="text-2xl font-black">{formatMoney(stats.totalSales)}</h3>
                        {stats.hasAnomalies && (
                            <p className="text-[10px] text-red-100 font-bold mt-1 bg-red-500/20 px-2 py-0.5 rounded-full inline-block animate-pulse">
                                ⚠️ DATOS EN $0 DETECTADOS
                            </p>
                        )}
                        <p className="text-indigo-100/60 text-[10px] font-bold uppercase mt-1">Bruto Total (Selección)</p>
                        <p className="text-indigo-200/60 text-sm font-bold uppercase tracking-widest mb-12">Analice la trazabilidad y evolución de cualquier unidad del inventario</p>

                        <div className="relative group max-w-3xl mx-auto">
                            <div className="absolute inset-y-0 left-0 pl-8 flex items-center pointer-events-none">
                                <Search className="w-8 h-8 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Escriba el nombre del producto para auditar..."
                                className="w-full bg-white/5 border-2 border-white/10 pl-20 pr-10 py-7 rounded-[32px] text-2xl font-black text-white focus:outline-none focus:ring-8 focus:ring-indigo-500/20 focus:bg-white/10 focus:border-indigo-500/50 shadow-2xl transition-all placeholder:text-slate-600"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <div className="absolute bottom-full left-0 right-0 mb-6 bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-8">
                                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {filteredProductList.length > 0 ? (
                                            filteredProductList.map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => { setActiveProduct(p); setSearchTerm(''); }}
                                                    className="w-full text-left px-10 py-6 hover:bg-slate-50 flex items-center justify-between group/item border-b border-slate-50 last:border-0"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-lg font-black text-slate-800 group-hover/item:text-indigo-600 uppercase transition-colors">{p}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Abrir ficha técnica de auditoría</span>
                                                    </div>
                                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover/item:bg-indigo-600 group-hover/item:text-white group-hover/item:translate-x-2 transition-all">
                                                        <ChevronRight className="w-6 h-6" />
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-10 py-10 text-center">
                                                <X className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                                <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No se encontraron productos coincidentes</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <p className="text-slate-500 text-[10px] font-black uppercase mt-12 tracking-[0.3em] opacity-50">Pulse ENTER después de escribir para ver resultados</p>
                    </div>
                </div>
            </div>
        </div >
    );
};