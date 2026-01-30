import React, { useMemo, useState, useRef } from 'react';
import { SaleRecord } from '../types';
import { StatsCard } from './StatsCard';
import { formatMoney } from '../utils/dataHelpers';
import { ProductFilter } from './ProductFilter';
import { EntityFilter } from './EntityFilter';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, Legend, PieChart, Pie, Cell
} from 'recharts';
import { DollarSign, ShoppingBag, Building2, TrendingUp, Filter, Ban, Printer, CheckCircle, X, PieChart as PieChartIcon, Package, Tag, CalendarRange, User, Clock, Award, Users, Search, ChevronRight, Lightbulb, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SalesHeatmap } from './SalesHeatmap';
import { PaymentMethodChart } from './PaymentMethodChart';
import { HeatmapDetailModal } from './HeatmapDetailModal';
import { LiveSellersLeaderboard } from './LiveSellersLeaderboard';
import { ScheduleOptimization } from './ScheduleOptimization';

interface DashboardProps {
    data: SaleRecord[];
    onSelectSeller: (name: string) => void;
    selectedBranch: string;
    onSelectBranch: (branch: string) => void;
    sellerFilter: string;
    onSellerFilterChange: (seller: string) => void;
    sellersList: string[];
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
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
    onSelectSeller,
    selectedBranch,
    onSelectBranch,
    sellerFilter,
    onSellerFilterChange,
    sellersList,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
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

    // Heatmap Detail State
    const [isHeatmapModalOpen, setIsHeatmapModalOpen] = useState(false);
    const [activeHeatmapSlot, setActiveHeatmapSlot] = useState<{ dayIndex: number, hour: number, dayName: string } | null>(null);
    const [heatmapMode, setHeatmapMode] = useState<'map' | 'optimize'>('map');

    const timeInputRef = useRef<HTMLInputElement>(null);

    // Extract unique months for the filter dropdown
    const availableMonths = useMemo(() => {
        const months = new Set(data.map(d => d.monthYear));
        return Array.from(months).sort().reverse();
    }, [data]);

    // Extract unique products
    const allProducts = useMemo(() => {
        const products = new Set(data.map(d => d.productName));
        return Array.from(products).sort();
    }, [data]);

    // Extract unique Entities
    const allEntities = useMemo(() => {
        const entities = new Set(data.map(d => d.entity || "Particular"));
        return Array.from(entities).filter(e => e).sort();
    }, [data]);

    const handleQuickMonthSelect = (monthStr: string) => {
        if (monthStr === 'all') {
            onStartDateChange('');
            onEndDateChange('');
            return;
        }
        const parts = (monthStr || "").split('-');
        if (parts.length === 2) {
            const year = Number(parts[0]);
            const month = Number(parts[1]);
            const firstDay = new Date(year, month - 1, 1);
            const lastDay = new Date(year, month, 0);

            onStartDateChange(format(firstDay, 'yyyy-MM-dd'));
            onEndDateChange(format(lastDay, 'yyyy-MM-dd'));
        }
    };

    const currentMonthValue = useMemo(() => {
        if (!startDate || !endDate) return 'all';
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        if (start.getDate() === 1) {
            const nextDay = new Date(end);
            nextDay.setDate(nextDay.getDate() + 1);
            if (nextDay.getDate() === 1 && start.getMonth() === end.getMonth()) {
                return format(start, 'yyyy-MM');
            }
        }
        return 'custom';
    }, [startDate, endDate]);

    // Filter data
    const filteredData = useMemo(() => {
        return data.filter(d => {
            const matchBranch = selectedBranch === 'all' || d.branch.includes(selectedBranch);
            const matchSeller = sellerFilter === 'all' || d.sellerName === sellerFilter;

            let matchDate = true;
            if (startDate) {
                const start = new Date(startDate + 'T00:00:00');
                if (d.date < start) matchDate = false;
            }
            if (matchDate && endDate) {
                const end = new Date(endDate + 'T23:59:59');
                if (d.date > end) matchDate = false;
            }

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

            return matchBranch && matchSeller && matchDate && productMatch && entityMatch;
        });
    }, [data, selectedBranch, sellerFilter, startDate, endDate, excludedProducts, includedProducts, excludedEntities, includedEntities]);

    // Aggregated Stats
    const stats = useMemo(() => {
        const totalSales = filteredData.reduce((acc, curr) => {
            const val = Number(curr.totalAmount);
            return isNaN(val) ? acc : acc + val;
        }, 0);
        const totalTransactions = filteredData.length;

        return { totalSales, totalTransactions };
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

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActiveProduct(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Package className="w-6 h-6 text-purple-600" />
                                {activeProduct}
                            </h3>
                            <p className="text-sm text-gray-500">Análisis histórico de producto</p>
                        </div>
                        <button onClick={() => setActiveProduct(null)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-purple-50 p-4 rounded-xl text-center">
                                <p className="text-xs text-purple-600 font-bold uppercase">Total Unidades</p>
                                <p className="text-2xl font-bold text-purple-900">{totalQty}</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-xl text-center">
                                <p className="text-xs text-green-600 font-bold uppercase">Total Facturado</p>
                                <p className="text-2xl font-bold text-green-900">{formatMoney(totalRev)}</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-800 uppercase mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-gray-500" />
                                Evolución de Ventas (Unidades)
                            </h4>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={productTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="label" fontSize={11} />
                                        <YAxis fontSize={11} />
                                        <Tooltip
                                            formatter={(val: number, name: string) => {
                                                if (name === 'revenue') return [formatMoney(val), 'Facturación'];
                                                return [val, 'Unidades'];
                                            }}
                                            labelStyle={{ color: 'black' }}
                                        />
                                        <Bar dataKey="qty" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Unidades" barSize={30} isAnimationActive={false} />
                                    </BarChart>
                                </ResponsiveContainer>
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

    return (
        <div className="space-y-8 animate-in fade-in duration-500 relative">
            {renderDetailModal()}
            {renderProductModal()}
            {renderCategoryModal()}

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

            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 no-print">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Panel General</h2>
                    <p className="text-gray-500 text-sm">Resumen de operaciones y rendimiento</p>
                </div>

                <div className="flex flex-wrap gap-3 w-full xl:w-auto items-end">
                    <div className="relative group flex-1 xl:flex-none">
                        <span className="text-xs text-gray-400 font-semibold uppercase ml-1">Vendedor</span>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                            <select
                                className="w-full xl:w-40 bg-gray-50 border border-gray-200 text-gray-700 py-2 pl-9 pr-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all text-sm appearance-none"
                                value={sellerFilter}
                                onChange={(e) => onSellerFilterChange(e.target.value)}
                            >
                                <option value="all">Todos</option>
                                {sellersList.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="relative group flex-1 xl:flex-none">
                        <span className="text-xs text-gray-400 font-semibold uppercase ml-1">Sucursal</span>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-biosalud-500 transition-colors" />
                            <select
                                className="w-full xl:w-48 bg-gray-50 border border-gray-200 text-gray-700 py-2 pl-9 pr-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-biosalud-500 focus:bg-white transition-all text-sm appearance-none"
                                value={selectedBranch}
                                onChange={(e) => onSelectBranch(e.target.value)}
                            >
                                <option value="all">Todas las Sucursales</option>
                                <option value="BIOSALUD CHACRAS PARK">Chacras Park</option>
                                <option value="FCIA BIOSALUD">Fcia Biosalud (Paseo)</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-end gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">Mes Completo</span>
                            <div className="relative">
                                <CalendarRange className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <select
                                    className="w-32 pl-8 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-biosalud-500"
                                    value={currentMonthValue}
                                    onChange={(e) => handleQuickMonthSelect(e.target.value)}
                                >
                                    <option value="all">Histórico</option>
                                    <option disabled value="custom">-- Rango --</option>
                                    {availableMonths.map(m => {
                                        const parts = (m || "").split('-');
                                        if (parts.length !== 2) return null;
                                        const y = Number(parts[0]);
                                        const mNum = Number(parts[1]);
                                        const date = new Date(y, mNum - 1);
                                        return (
                                            <option key={m} value={m}>
                                                {format(date, 'MMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>

                        <div className="w-px h-8 bg-gray-200 mx-1"></div>

                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">Desde</span>
                            <input
                                type="date"
                                className="py-1.5 px-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-biosalud-500"
                                value={startDate}
                                onChange={(e) => onStartDateChange(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">Hasta</span>
                            <input
                                type="date"
                                className="py-1.5 px-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-biosalud-500"
                                value={endDate}
                                onChange={(e) => onEndDateChange(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 border-l pl-2 border-gray-200">
                        <button
                            onClick={() => setIsFilterOpen(true)}
                            className={`p-2.5 rounded-lg transition-colors border ${includedProducts.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-600' :
                                excludedProducts.length > 0 ? 'bg-red-50 border-red-200 text-red-600' :
                                    'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                            title="Filtrar Productos"
                        >
                            {includedProducts.length > 0 ? <CheckCircle className="w-4 h-4" /> : excludedProducts.length > 0 ? <Ban className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
                        </button>

                        <button
                            onClick={() => setIsEntityFilterOpen(true)}
                            className={`p-2.5 rounded-lg transition-colors border ${includedEntities.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-600' :
                                excludedEntities.length > 0 ? 'bg-red-50 border-red-200 text-red-600' :
                                    'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                            title="Filtrar Entidades"
                        >
                            {includedEntities.length > 0 ? <CheckCircle className="w-4 h-4" /> : excludedEntities.length > 0 ? <Ban className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                        </button>

                        {onTimeSyncUpload && (
                            <button
                                onClick={() => timeInputRef.current?.click()}
                                className="p-2.5 bg-purple-50 border border-purple-200 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                                title="Sincronizar Horarios (Cargar CSV Auxiliar)"
                            >
                                <Clock className="w-4 h-4" />
                            </button>
                        )}

                        <button
                            onClick={onPrintReport}
                            className="p-2.5 bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Imprimir reporte resumen"
                        >
                            <Printer className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Real Time Leaderboard Section */}
            <div className="no-print">
                <LiveSellersLeaderboard />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                <StatsCard title="Ventas Totales" value={formatMoney(stats.totalSales)} icon={<DollarSign className="w-5 h-5" />} color="green" onClick={() => setActiveStatDetail('sales')} />
                <StatsCard title="Transacciones" value={filteredData.length.toLocaleString()} icon={<ShoppingBag className="w-5 h-5" />} color="blue" onClick={() => setActiveStatDetail('transactions')} />
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-gray-500">Mejor Sucursal</span>
                        <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                            <Building2 className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        {(() => {
                            const branchMap = new Map<string, number>();
                            filteredData.forEach(d => branchMap.set(d.branch, (branchMap.get(d.branch) || 0) + d.totalAmount));
                            const top = Array.from(branchMap.entries()).sort((a, b) => b[1] - a[1])[0];
                            return top ? (
                                <>
                                    <h3 className="text-lg font-bold text-gray-900 truncate" title={top[0]}>
                                        {(() => {
                                            const rawName = top[0].toUpperCase();
                                            if (rawName.includes('CHACRAS')) return 'Chacras Park';
                                            if (rawName.includes('FCIA') || rawName.includes('PASEO')) return 'Fcia Biosalud (Paseo)';

                                            // Fallback cleaning
                                            const cleaned = rawName.replace('BIOSALUD', '').replace('FCIA', '').trim();
                                            return cleaned || rawName;
                                        })()}
                                    </h3>
                                    <p className="text-xs text-green-600 font-medium">{formatMoney(top[1])}</p>
                                </>
                            ) : <h3 className="text-xl font-bold text-gray-300">-</h3>;
                        })()}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-gray-500">Producto Top</span>
                        <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                            <Package className="w-5 h-5" />
                        </div>
                    </div>
                    <div>
                        {(() => {
                            const prodMap = new Map<string, number>();
                            filteredData.forEach(d => prodMap.set(d.productName, (prodMap.get(d.productName) || 0) + d.quantity));
                            const top = Array.from(prodMap.entries()).sort((a, b) => b[1] - a[1])[0];
                            return top ? (
                                <>
                                    <h3 className="text-lg font-bold text-gray-900 truncate" title={top[0]}>
                                        {top[0]}
                                    </h3>
                                    <p className="text-xs text-orange-600 font-medium">{top[1]} unidades</p>
                                </>
                            ) : <h3 className="text-xl font-bold text-gray-300">-</h3>;
                        })()}
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

            <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100 no-print">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-gray-400" />
                    Ventas por Rubro (Top 10)
                </h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        {(() => {
                            const catMap = new Map<string, number>();
                            filteredData.forEach(d => catMap.set(d.category || 'Sin Categoría', (catMap.get(d.category || 'Sin Categoría') || 0) + d.totalAmount));
                            const catData = Array.from(catMap.entries())
                                .map(([name, value]) => ({ name, value }))
                                .sort((a, b) => b.value - a.value)
                                .slice(0, 10);

                            return (
                                <BarChart data={catData} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                                    <Tooltip formatter={(val: number) => formatMoney(val)} />
                                    <Bar
                                        dataKey="value"
                                        fill="#3b82f6"
                                        radius={[0, 4, 4, 0]}
                                        barSize={20}
                                        onClick={(data) => setActiveCategory(data.name)}
                                        cursor="pointer"
                                        isAnimationActive={false}
                                    />
                                </BarChart>
                            );
                        })()}
                    </ResponsiveContainer>
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
                            className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            Actualizar Horarios (Caja)
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print mt-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-400" /> Ranking de Vendedores
                    </h3>
                    <div className="overflow-y-auto max-h-80 flex-1">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs sticky top-0">
                                <tr>
                                    <th className="py-2 px-3">Nombre</th>
                                    <th className="py-2 px-3 text-right">Ventas ($)</th>
                                    <th className="py-2 px-3 text-right">Tx</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(() => {
                                    const sMap = new Map<string, { sales: number, count: number }>();
                                    filteredData.forEach(d => {
                                        if (!sMap.has(d.sellerName)) sMap.set(d.sellerName, { sales: 0, count: 0 });
                                        const e = sMap.get(d.sellerName)!;
                                        e.sales += d.totalAmount;
                                        e.count += 1;
                                    });
                                    return Array.from(sMap.entries())
                                        .sort((a, b) => b[1].sales - a[1].sales)
                                        .map(([name, stat], idx) => (
                                            <tr key={name} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => onSelectSeller(name)}>
                                                <td className="py-2 px-3 font-medium text-gray-700 truncate max-w-[150px]">{idx + 1}. {name}</td>
                                                <td className="py-2 px-3 text-right font-bold text-gray-900">{formatMoney(stat.sales)}</td>
                                                <td className="py-2 px-3 text-right text-gray-500">{stat.count}</td>
                                            </tr>
                                        ));
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Award className="w-5 h-5 text-gray-400" /> Top Productos (Unidades)
                    </h3>
                    <div className="overflow-y-auto max-h-80 flex-1">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs sticky top-0">
                                <tr>
                                    <th className="py-2 px-3">Producto</th>
                                    <th className="py-2 px-3 text-right">Cantidad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(() => {
                                    const pMap = new Map<string, number>();
                                    filteredData.forEach(d => pMap.set(d.productName, (pMap.get(d.productName) || 0) + d.quantity));
                                    return Array.from(pMap.entries())
                                        .sort((a, b) => b[1] - a[1])
                                        .slice(0, 15)
                                        .map(([name, qty], idx) => (
                                            <tr
                                                key={name}
                                                className="hover:bg-gray-50 cursor-pointer"
                                                onClick={() => setActiveProduct(name)}
                                            >
                                                <td className="py-2 px-3 font-medium text-gray-700 truncate max-w-[200px]" title={name}>{idx + 1}. {name}</td>
                                                <td className="py-2 px-3 text-right font-bold text-purple-600">{qty}</td>
                                            </tr>
                                        ));
                                })()}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-center">Click en un producto para ver historial</p>
                </div>
            </div>
        </div>

    );
};