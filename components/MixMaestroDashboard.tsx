import React, { useMemo, useState } from 'react';
import { UnifiedTransaction, UnifiedItem, ExpenseRecord } from '../types';
import { formatMoney } from '../utils/dataHelpers';
import {
    Activity, ArrowUpRight, ArrowDownRight, TrendingUp, Package,
    Users, DollarSign, CreditCard, ShieldCheck, Zap,
    ChevronRight, Info, AlertTriangle, CheckCircle2, ShoppingCart, Calendar,
    X, Award, Lightbulb
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, Cell, Legend
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LiveSellersLeaderboard } from './LiveSellersLeaderboard';

interface MixMaestroDashboardProps {
    data: UnifiedTransaction[];
    expenseData: ExpenseRecord[];
    serviceData: ExpenseRecord[];
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    selectedBranch: string;
    onSelectBranch: (branch: string) => void;
}

export const MixMaestroDashboard: React.FC<MixMaestroDashboardProps> = ({
    data,
    expenseData,
    serviceData,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    selectedBranch,
    onSelectBranch
}) => {
    // 1. Filter Data by Date
    const filteredData = useMemo(() => {
        const safeData = data || [];
        return safeData.filter(d => {
            const matchBranch = selectedBranch === 'all' || d.branch.toLowerCase().includes(selectedBranch.toLowerCase());

            let matchDate = true;
            if (startDate) {
                const start = new Date(startDate + 'T00:00:00');
                if (d.date < start) matchDate = false;
            }
            if (matchDate && endDate) {
                const end = new Date(endDate + 'T23:59:59');
                if (d.date > end) matchDate = false;
            }

            return matchBranch && matchDate;
        });
    }, [data, startDate, endDate, selectedBranch]);

    const filteredExpenses = useMemo(() => {
        const safeExpenses = expenseData || [];
        return safeExpenses.filter(d => {
            const matchBranch = selectedBranch === 'all' || d.branch.toLowerCase().includes(selectedBranch.toLowerCase());

            let matchDate = true;
            if (startDate) {
                const start = new Date(startDate + 'T00:00:00');
                if (d.issueDate < start) matchDate = false;
            }
            if (matchDate && endDate) {
                const end = new Date(endDate + 'T23:59:59');
                if (d.issueDate > end) matchDate = false;
            }

            return matchBranch && matchDate;
        });
    }, [expenseData, startDate, endDate, selectedBranch]);

    const filteredServices = useMemo(() => {
        const safeServices = serviceData || [];
        return safeServices.filter(d => {
            const matchBranch = selectedBranch === 'all' || d.branch.toLowerCase().includes(selectedBranch.toLowerCase());

            let matchDate = true;
            if (startDate) {
                const start = new Date(startDate + 'T00:00:00');
                if (d.issueDate < start) matchDate = false;
            }
            if (matchDate && endDate) {
                const end = new Date(endDate + 'T23:59:59');
                if (d.issueDate > end) matchDate = false;
            }

            return matchBranch && matchDate;
        });
    }, [serviceData, startDate, endDate, selectedBranch]);

    // 2. Aggregate Metrics
    const metrics = useMemo(() => {
        let totalNet = 0;
        let totalCredits = 0;
        let totalItems = 0;
        let totalCostOfSales = 0;
        let transactionsWithStock = 0;

        filteredData.forEach(tx => {
            if (tx.type?.includes('NC')) {
                totalCredits += Math.abs(tx.totalNet || 0);
            } else {
                totalNet += (tx.totalNet || 0);
            }

            totalItems += (tx.items?.length || 0);
            if (tx.hasStockDetail) transactionsWithStock++;

            tx.items?.forEach(item => {
                if (item.unitCost) totalCostOfSales += item.unitCost * item.quantity;
            });
        });

        const uniqueOutflows = new Map();
        (filteredExpenses || []).forEach(e => uniqueOutflows.set(e.id, e));
        (filteredServices || []).forEach(s => uniqueOutflows.set(s.id, s));

        const combinedOutflow = Array.from(uniqueOutflows.values()).reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);

        const netReal = totalNet - totalCredits;
        const linkedRate = filteredData.length > 0 ? (transactionsWithStock / filteredData.length) * 100 : 0;
        const grossMargin = totalNet > 0 ? ((totalNet - totalCostOfSales) / totalNet) * 100 : 0;
        const finalEbitda = netReal - combinedOutflow;

        return {
            totalNet,
            totalCredits,
            netReal,
            totalItems,
            linkedRate,
            grossMargin,
            totalOutflow: combinedOutflow,
            finalEbitda,
            transactionCount: filteredData.length
        };
    }, [filteredData, filteredExpenses, filteredServices]);

    // 3. Daily Sales for Chart
    const dailyData = useMemo(() => {
        const map = new Map<string, { date: string, sales: number, credits: number }>();
        filteredData.forEach(tx => {
            if (!tx.date) return;
            const day = format(tx.date, 'dd/MM');
            const current = map.get(day) || { date: day, sales: 0, credits: 0 };
            if (tx.type?.includes('NC')) {
                current.credits += Math.abs(tx.totalNet || 0);
            } else {
                current.sales += (tx.totalNet || 0);
            }
            map.set(day, current);
        });
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredData]);

    // 4. Product Intelligence (Top Items)
    const productIntel = useMemo(() => {
        const products = new Map<string, {
            name: string,
            qty: number,
            totalSales: number,
            avgCost: number,
            stock: number,
            barcode: string,
            pareto?: 'A' | 'B' | 'C'
        }>();

        filteredData.forEach(tx => {
            tx.items?.forEach(item => {
                if (!item.name) return;
                const existing = products.get(item.name) || {
                    name: item.name,
                    qty: 0,
                    totalSales: 0,
                    avgCost: item.unitCost || 0,
                    stock: 0,
                    barcode: item.barcode || '-'
                };

                existing.qty += (item.quantity || 0);
                existing.totalSales += (item.unitPrice || 0) * (item.quantity || 0);
                if (item.unitCost) {
                    existing.avgCost = existing.avgCost === 0 ? item.unitCost : (existing.avgCost + item.unitCost) / 2;
                }
                if (item.barcode && (!existing.barcode || existing.barcode === '-')) {
                    existing.barcode = item.barcode;
                }

                products.set(item.name, existing);
            });
        });

        const sortedProducts = Array.from(products.values())
            .sort((a, b) => b.totalSales - a.totalSales);

        const globalSalesTotal = sortedProducts.reduce((acc, p) => acc + p.totalSales, 0);
        let cumulativeSales = 0;

        return sortedProducts.map(p => {
            cumulativeSales += p.totalSales;
            const pct = (cumulativeSales / globalSalesTotal) * 100;
            let pareto: 'A' | 'B' | 'C' = 'C';
            if (pct <= 70) pareto = 'A';
            else if (pct <= 90) pareto = 'B';

            return { ...p, pareto };
        }).slice(0, 20); // Show top 20
    }, [filteredData]);

    const crossSellingAnalysis = useMemo(() => {
        const matrix = new Map<string, Map<string, number>>();

        filteredData.forEach(tx => {
            const items = tx.items?.map(i => i.name) || [];
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
    }, [filteredData]);

    const [selectedProductIntelligence, setSelectedProductIntelligence] = useState<string | null>(null);

    const relatedProducts = useMemo(() => {
        if (!selectedProductIntelligence) return [];
        const matches = crossSellingAnalysis.get(selectedProductIntelligence);
        if (!matches) return [];

        return Array.from(matches.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
    }, [selectedProductIntelligence, crossSellingAnalysis]);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* WIDE Sellers Leaderboard (CSV Mode) */}
            <LiveSellersLeaderboard offlineData={filteredData} />
            {/* Header with Glassmorphism */}
            <div className="bg-white/40 backdrop-blur-xl p-8 rounded-[40px] border border-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <Activity className="w-64 h-64 text-indigo-900" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <h2 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Mix Maestro <span className="text-indigo-600">v2.0</span></h2>
                        </div>
                        <p className="text-slate-500 font-medium max-w-2xl leading-relaxed">
                            Inteligencia de datos unificada. Conciliación automática entre Caja, Stock y Comisiones.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-white/50 backdrop-blur-md p-3 rounded-[30px] border border-white shadow-xl">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl shadow-sm border border-slate-100">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => onStartDateChange(e.target.value)}
                                className="bg-transparent text-xs font-black text-slate-700 outline-none uppercase"
                            />
                            <span className="text-slate-300 font-bold">/</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => onEndDateChange(e.target.value)}
                                className="bg-transparent text-xs font-black text-slate-700 outline-none uppercase"
                            />
                        </div>

                        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl shadow-sm border border-slate-100">
                            <Activity className="w-4 h-4 text-indigo-500" />
                            <select
                                value={selectedBranch}
                                onChange={(e) => onSelectBranch(e.target.value)}
                                className="bg-transparent text-xs font-black text-slate-700 outline-none appearance-none cursor-pointer pr-4 uppercase"
                            >
                                <option value="all">TODAS SUCURSALES</option>
                                <option value="FCIA BIOSALUD">FCIA BIOSALUD</option>
                                <option value="CHACRAS">CHACRAS PARK</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-10">
                    {/* STAT CARDS */}
                    <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-xl shadow-indigo-500/20 group hover:scale-[1.02] transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-white/20 rounded-xl"><DollarSign className="w-5 h-5" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded-full">Finanzas</span>
                        </div>
                        <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Ventas Netas</p>
                        <h3 className="text-2xl font-black">{formatMoney(metrics.totalNet)}</h3>
                        <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-indigo-300" />
                            <span className="text-xs font-bold text-indigo-200">Facturación Confirmada</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl group hover:shadow-2xl transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-rose-50 rounded-xl"><AlertTriangle className="w-5 h-5 text-rose-500" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 px-2 py-1 rounded-full">Devoluciones</span>
                        </div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Notas de Crédito</p>
                        <h3 className="text-2xl font-black text-rose-600">{formatMoney(metrics.totalCredits)}</h3>
                        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-rose-300" />
                            <span className="text-xs font-bold text-rose-400">Impacto en Caja</span>
                        </div>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl group hover:scale-[1.02] transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-emerald-500/20 rounded-xl"><ShieldCheck className="w-5 h-5 text-emerald-400" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">Integridad</span>
                        </div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Cruce de Datos</p>
                        <h3 className="text-2xl font-black text-emerald-400">{metrics.linkedRate.toFixed(1)}%</h3>
                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold text-slate-400">Ventas con Stock Vinculado</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl group hover:shadow-2xl transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-amber-50 rounded-xl"><ShoppingCart className="w-5 h-5 text-amber-500" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 px-2 py-1 rounded-full">Egresos</span>
                        </div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Gastos Operat.</p>
                        <h3 className="text-2xl font-black text-amber-600">{formatMoney(metrics.totalOutflow)}</h3>
                        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2">
                            <Info className="w-4 h-4 text-amber-300" />
                            <span className="text-xs font-bold text-slate-400">Proveedores + Servicios</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* CHARTS AREA */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h3 className="text-xl font-black text-slate-900">Historial de Operaciones</h3>
                            <p className="text-slate-400 text-sm font-medium italic">Volumen transaccional diario (Ventas vs Créditos)</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                                <span className="text-xs font-black uppercase text-slate-400">Ventas</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                                <span className="text-xs font-black uppercase text-slate-400">NC</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyData}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} tickFormatter={(v) => `$${v / 1000} k`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                                    formatter={(v: number) => [formatMoney(v), '']}
                                />
                                <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                                <Area type="monotone" dataKey="credits" stroke="#f43f5e" strokeWidth={4} fill="transparent" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* REAL REVENUE PANEL - EBITDA */}
                <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <TrendingUp className="w-32 h-32 text-emerald-400" />
                    </div>

                    <h3 className="text-white font-black text-xl mb-2 relative z-10">Ganancia Operativa</h3>
                    <p className="text-slate-400 text-sm font-medium mb-10 relative z-10">Resultado final después de todos los egresos detectados.</p>

                    <div className="space-y-6 relative z-10">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Caja Neta</p>
                                <p className="text-white font-bold text-lg">{formatMoney(metrics.netReal)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-rose-400 text-xs font-bold leading-none">-{metrics.totalOutflow > 0 ? ((metrics.totalOutflow / metrics.netReal) * 100).toFixed(1) : 0}%</p>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Gastos/Serv</p>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                            <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                                style={{ width: `${Math.max(0, (metrics.finalEbitda / metrics.netReal) * 100)}% ` }}
                            ></div>
                        </div>

                        <div className="pt-8 mt-8 border-t border-white/5">
                            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-2">EBITDA Proyectado</p>
                            <h4 className="text-5xl font-black text-white tracking-tighter">{formatMoney(metrics.finalEbitda)}</h4>
                            <p className="text-slate-500 text-xs mt-4 font-medium italic">
                                * Margen bruto sobre ventas: {metrics.grossMargin.toFixed(1)}%
                            </p>
                        </div>

                        <div className="mt-10 bg-white/5 p-6 rounded-3xl border border-white/5 group-hover:border-emerald-500/30 transition-all duration-500">
                            <div className="flex gap-4">
                                <div className="p-3 bg-emerald-500/20 rounded-2xl"><ShieldCheck className="w-6 h-6 text-emerald-400" /></div>
                                <div>
                                    <p className="text-white font-black text-sm">Salud Financiera</p>
                                    <p className="text-slate-500 text-xs font-medium">
                                        {metrics.finalEbitda > 0 ? 'Operación Rentable' : 'Alerta de Margen'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* PRODUCT INTELLIGENCE TABLE */}
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Product Intelligence</h3>
                        <p className="text-slate-400 text-sm font-medium">Desempeño de stock y rentabilidad por unidad.</p>
                    </div>
                    <button className="flex items-center gap-2 px-6 py-3 bg-slate-50 text-slate-600 rounded-2xl font-black text-xs hover:bg-slate-100 transition-all">
                        <span>Ver Reporte Completo</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-8 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Producto</th>
                                <th className="px-8 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Barcode</th>
                                <th className="px-8 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Pareto</th>
                                <th className="px-8 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">QTY</th>
                                <th className="px-8 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Total Ventas</th>
                                <th className="px-8 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Stock</th>
                                <th className="px-8 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Días Stock</th>
                                <th className="px-8 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">ROI</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {productIntel.map((p, idx) => {
                                const daysOfStock = p.qty > 0 ? (p.stock / (p.qty / 30)) : 0;
                                return (
                                    <tr
                                        key={idx}
                                        className={`hover:bg-slate-50/50 transition-colors group cursor-pointer ${selectedProductIntelligence === p.name ? 'bg-indigo-50/30' : ''}`}
                                        onClick={() => setSelectedProductIntelligence(p.name)}
                                    >
                                        <td className="px-8 py-5">
                                            <div>
                                                <p className="text-sm font-black text-slate-700 group-hover:text-indigo-600 transition-colors uppercase">{p.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">{p.barcode}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-md ${p.pareto === 'A' ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-100' :
                                                p.pareto === 'B' ? 'bg-amber-500 text-white shadow-sm shadow-amber-100' :
                                                    'bg-slate-200 text-slate-600'
                                                }`}>
                                                CLASE {p.pareto}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className="text-sm font-black text-slate-600">{p.qty}</span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <p className="text-sm font-black text-slate-700">{formatMoney(p.totalSales)}</p>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black ${p.stock < 5 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                <Package className="w-3 h-3" />
                                                {p.stock}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex flex-col items-center">
                                                <p className={`text-xs font-black ${daysOfStock < 7 ? 'text-rose-500' : daysOfStock > 60 ? 'text-amber-500' : 'text-slate-600'}`}>
                                                    {daysOfStock > 365 ? '>365' : daysOfStock.toFixed(0)} d
                                                </p>
                                                <div className="w-12 bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${daysOfStock < 7 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                                        style={{ width: `${Math.min(100, (daysOfStock / 60) * 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex items-center justify-center gap-1 text-emerald-500 font-black text-xs">
                                                <ArrowUpRight className="w-3 h-3" />
                                                {p.avgCost > 0 ? (Math.max(0, (p.totalSales / p.qty - p.avgCost) / p.avgCost * 100)).toFixed(0) : 0}%
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CROSS SELLING SIDEBAR / PANEL */}
            {selectedProductIntelligence && (
                <div className="bg-indigo-900 rounded-[40px] p-8 text-white shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <div className="flex items-center gap-2 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
                                <Zap className="w-4 h-4 fill-indigo-300" /> Venta Cruzada & Inteligencia
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-tighter">Análisis de Canasta: {selectedProductIntelligence}</h3>
                        </div>
                        <button onClick={() => setSelectedProductIntelligence(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-2xl transition-all">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-4">Productos vinculados (Sugerencias)</h4>
                            <div className="space-y-3">
                                {relatedProducts.length > 0 ? relatedProducts.map((rp, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center text-xs font-black">{i + 1}</div>
                                            <span className="font-bold text-sm uppercase">{rp.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded-md">
                                                {rp.count} COINCIDENCIAS
                                            </span>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-8 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                                        <p className="text-indigo-300 text-sm font-bold">No se detectaron compras conjuntas significativas.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-[32px] p-8 border border-white/10">
                            <h4 className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-6">Acción Recomendada</h4>
                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                                        <Award className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="font-black text-sm mb-1 uppercase">Promoción de Pack</p>
                                        <p className="text-indigo-200/60 text-xs font-medium">Ofrecer descuento en la segunda unidad o combo con los productos vinculados para aumentar el UPT.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                                        <Lightbulb className="w-6 h-6 text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="font-black text-sm mb-1 uppercase">Ubicación en Góndola</p>
                                        <p className="text-indigo-200/60 text-xs font-medium">Colocar físicamente cerca de su rubro complementario para maximizar la venta por impulso.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
