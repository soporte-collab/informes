import React, { useMemo, useState } from 'react';
import { UnifiedTransaction, UnifiedItem, ExpenseRecord, PayrollRecord } from '../types';
import { formatMoney } from '../utils/dataHelpers';
import {
    Activity, ArrowUpRight, ArrowDownRight, TrendingUp, Package,
    Users, DollarSign, CreditCard, ShieldCheck, Zap,
    ChevronRight, Info, AlertTriangle, CheckCircle2, ShoppingCart, Calendar,
    X, Award, Lightbulb
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LiveSellersLeaderboard } from './LiveSellersLeaderboard';

interface MixMaestroDashboardProps {
    data: UnifiedTransaction[];
    expenseData: ExpenseRecord[];
    serviceData: ExpenseRecord[];
    payrollData: PayrollRecord[];
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
    payrollData,
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

    const filteredPayroll = useMemo(() => {
        const safePayroll = payrollData || [];
        return safePayroll.filter(d => {
            const matchBranch = selectedBranch === 'all' || d.branch === selectedBranch;

            let matchDate = true;
            if (startDate) {
                const start = new Date(startDate + 'T00:00:00');
                if (new Date(d.paymentDate) < start) matchDate = false;
            }
            if (matchDate && endDate) {
                const end = new Date(endDate + 'T23:59:59');
                if (new Date(d.paymentDate) > end) matchDate = false;
            }

            return matchBranch && matchDate;
        });
    }, [payrollData, startDate, endDate, selectedBranch]);

    // 2. Aggregate Metrics
    const metrics = useMemo(() => {
        let totalNet = 0;
        let totalCredits = 0;
        let totalItems = 0;
        let totalCostOfSales = 0;
        let transactionsWithStock = 0;
        let totalInsurance = 0;
        let totalCash = 0;
        let totalCard = 0;
        let totalChecking = 0;
        let totalWallets = 0;
        let totalTransfers = 0;

        filteredData.forEach(tx => {
            const typeValue = (tx.type || '').toUpperCase();

            // STRICT CLASSIFICATION (Robust NC detection)
            const isNC = typeValue.includes('NC') || typeValue.includes('N.C') || typeValue.includes('N/C') ||
                typeValue.includes('NOTA DE CREDITO') || typeValue.includes('CREDITO') ||
                typeValue.includes('DEVOLUCION') || typeValue.includes('ANULACION') ||
                typeValue.includes('REVERSO');
            const isTX = typeValue.includes('TX') || typeValue.includes('TRANSFER') || typeValue.includes('REMITO') || typeValue.includes('MOVIMIENTO') || typeValue.includes('TRSU') || typeValue.includes('AJUSTE');

            const amount = Number(tx.totalNet) || 0;
            const isNegative = amount < 0;

            if (isTX) {
                // IGNORE TX COMPLETELY FROM TOTALS
            } else if (isNC || isNegative) {
                totalCredits += Math.abs(amount);
            } else {
                totalNet += amount;

                // --- PAYMENT METHOD BREAKDOWN (PRECISE) ---
                if (tx.hasFinancialDetail) {
                    totalInsurance += (tx.osAmount || 0);
                    totalCash += (tx.cashAmount || 0);
                    totalCard += (tx.cardAmount || 0);
                    totalChecking += (tx.ctacteAmount || 0);

                    if (tx.paymentMethod === 'Billetera Digital') {
                        totalWallets += (tx.cardAmount || 0);
                        totalCard -= (tx.cardAmount || 0);
                    }
                    if (tx.paymentMethod === 'Transferencia') {
                        totalTransfers += (tx.cashAmount || 0);
                        totalCash -= (tx.cashAmount || 0);
                    }
                } else {
                    // Fallback for legacy data
                    if (tx.paymentMethod === 'Obra Social') totalInsurance += amount;
                    else if (tx.paymentMethod === 'Efectivo') totalCash += amount;
                    else if (tx.paymentMethod === 'Transferencia') totalTransfers += amount;
                    else if (tx.paymentMethod === 'Cuenta Corriente') totalChecking += amount;
                    else if (tx.paymentMethod === 'Billetera Digital') totalWallets += amount;
                    else totalCard += amount;
                }
            }

            totalItems += (tx.items?.length || 0);
            if (tx.hasStockDetail) transactionsWithStock++;

            tx.items?.forEach(item => {
                if (item.unitCost) totalCostOfSales += item.unitCost * item.quantity;
            });
        });

        // --- EXPENSE CLASSIFICATION (REAL vs PENDING) ---
        // Real expense = PAGADO (CSV/Zetti) + Services (Manual) + Payroll
        // Pending = INGRESADO (Zetti mostly)
        // NOTE: filteredServices contains BOTH 'expenses' (Zetti) and 'services' (Manual) from App.tsx
        let realExpenseTotal = 0;
        let pendingExpenseTotal = 0;

        filteredServices.forEach(e => {
            const status = (typeof e.status === 'object' ? (e.status as any).name : e.status) || '';
            const upperStatus = status.toUpperCase();

            // Logic:
            // 1. If it's explicitly PAGADO -> Real
            // 2. If it's INGRESADO -> Pending
            // 3. If it has no status (Manual Services likely) -> Real (Assumed paid/incurred)

            if (upperStatus === 'PAGADO') {
                realExpenseTotal += e.amount;
            } else if (upperStatus === 'INGRESADO') {
                pendingExpenseTotal += e.amount;
            } else if (upperStatus === 'IGNORADO') {
                // Skip
            } else {
                // Fallback for manual services without status or unknown
                realExpenseTotal += e.amount;
            }
        });

        const payrollTotal = (filteredPayroll || []).reduce((acc, curr) => acc + curr.netAmount, 0);

        // Total Outflow is now just Real Expenses (which includes Services) + Payroll
        const totalRealOutflow = realExpenseTotal + payrollTotal;
        const serviceTotal = 0; // Merged into realExpenseTotal for this calculation

        // --- AUDIT STRATEGY (Theft Prevention) ---
        // We do NOT subtract Credits from Net Sales because reversed transactions 
        // need to be audited separately to detect potential fraud/theft.
        const netReal = totalNet;

        const linkedRate = filteredData.length > 0 ? (transactionsWithStock / filteredData.length) * 100 : 0;
        const grossMargin = totalNet > 0 ? ((totalNet - totalCostOfSales) / totalNet) * 100 : 0;
        const creditRatio = totalNet > 0 ? (totalCredits / totalNet) * 100 : 0;

        // EBITDA based ON GROSS SALES (for audit visibility)
        const finalEbitda = netReal - totalRealOutflow;
        const profitabilityRatio = netReal > 0 ? (finalEbitda / netReal) * 100 : 0;

        return {
            totalNet,
            totalCredits,
            creditRatio,
            netReal,
            totalItems,
            linkedRate,
            grossMargin,
            profitabilityRatio,
            totalOutflow: totalRealOutflow,
            realExpenseTotal,
            pendingExpenseTotal,
            serviceTotal,
            payrollTotal,
            finalEbitda,
            transactionCount: filteredData.length,
            // Payment Breakdown
            totalInsurance,
            totalCash,
            totalCard,
            totalChecking,
            totalWallets,
            totalTransfers
        };
    }, [filteredData, filteredExpenses, filteredServices, filteredPayroll]);

    // 2.5 Facturación vs Compras (Restock Offset +1)
    const performanceChart = useMemo(() => {
        const salesByDay = new Map<string, number>();
        filteredData.forEach(tx => {
            if (!tx.date) return;
            const d = format(tx.date, 'yyyy-MM-dd');
            salesByDay.set(d, (salesByDay.get(d) || 0) + (tx.totalNet || 0));
        });

        const purchasesByDay = new Map<string, number>();
        filteredExpenses.forEach(e => {
            const d = format(e.issueDate, 'yyyy-MM-dd');
            purchasesByDay.set(d, (purchasesByDay.get(d) || 0) + e.amount);
        });

        const allDays = Array.from(new Set([...salesByDay.keys(), ...purchasesByDay.keys()])).sort();

        return allDays.map(day => {
            const dateObj = new Date(day + 'T12:00:00'); // Mid-day to avoid TZ shifts
            const nextDayStr = format(new Date(dateObj.getTime() + 86400000), 'yyyy-MM-dd');

            const sales = salesByDay.get(day) || 0;
            // Shift provider invoice date +1 for visual reconciliation
            // If I bought on Day N, I want to see its effect mapped to what I sold on Day N-1?
            // OR: If I Sold on Day N, I want to see what I bought on Day N+1.
            const purchasesRestock = purchasesByDay.get(nextDayStr) || 0;

            return {
                date: format(dateObj, 'dd/MM'),
                fullDate: day,
                ventas: sales,
                compras: purchasesRestock
            };
        });
    }, [filteredData, filteredExpenses]);


    // 3. Daily Sales for Chart
    const dailyData = useMemo(() => {
        const map = new Map<string, { date: string, sales: number, credits: number }>();
        filteredData.forEach(tx => {
            if (!tx.date) return;
            const day = format(tx.date, 'dd/MM');
            const current = map.get(day) || { date: day, sales: 0, credits: 0 };

            const typeValue = (tx.type || '').toUpperCase();
            const isNC = typeValue.includes('NC') || typeValue.includes('N.C') || typeValue.includes('N/C') ||
                typeValue.includes('NOTA DE CREDITO') || typeValue.includes('CREDITO') ||
                typeValue.includes('DEVOLUCION') || (Number(tx.totalNet) < 0);

            if (isNC) {
                current.credits += Math.abs(tx.totalNet || 0);
            } else {
                current.sales += (tx.totalNet || 0);
            }
            map.set(day, current);
        });
        return Array.from(map.values()).sort((a, b) => {
            // Sort by day key properly
            return a.date.localeCompare(b.date);
        });
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mt-10">
                    {/* STAT CARDS */}
                    <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-xl shadow-indigo-500/20 group hover:scale-[1.02] transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-white/20 rounded-xl"><DollarSign className="w-5 h-5" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded-full">Finanzas</span>
                        </div>
                        <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Ventas Brutas</p>
                        <h3 className="text-2xl font-black">{formatMoney(metrics.totalNet)}</h3>
                        <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-indigo-300" />
                            <span className="text-xs font-bold text-indigo-200">Facturación Total</span>
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

                    <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl group hover:scale-[1.02] transition-all duration-300 border border-slate-800">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-emerald-500/20 rounded-xl"><Activity className="w-5 h-5 text-emerald-400" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">Desempeño</span>
                        </div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Rentabilidad Neta</p>
                        <h3 className={`text-2xl font-black ${metrics.profitabilityRatio > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {metrics.profitabilityRatio.toFixed(1)}%
                        </h3>
                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
                            <TrendingUp className={`w-4 h-4 ${metrics.profitabilityRatio > 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
                            <span className="text-xs font-bold text-slate-400">Ratio EBITDA / Vtas</span>
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
                            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">Costo Real de Operación</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl group hover:shadow-2xl transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-indigo-50 rounded-xl"><ShieldCheck className="w-5 h-5 text-indigo-500" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full">Stock</span>
                        </div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Cruce de Datos</p>
                        <h3 className="text-2xl font-black text-slate-800">{metrics.linkedRate.toFixed(1)}%</h3>
                        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                            <span className="text-xs font-bold text-slate-400">Ventas con Stock</span>
                        </div>
                    </div>
                </div>

                {/* --- PAYMENT BREAKDOWN WIDGET --- */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                    <div className="md:col-span-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 rounded-2xl"><CreditCard className="w-6 h-6 text-emerald-600" /></div>
                            <div>
                                <h3 className="font-black text-slate-800 uppercase tracking-tight">Breakdown de Medios de Pago</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">ANÁLISIS DE FLUJO</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                            {/* Efectivo */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Efectivo</p>
                                <p className="text-sm font-black text-slate-800">{formatMoney(metrics.totalCash)}</p>
                                <div className="w-full h-1 bg-slate-200 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${(metrics.totalCash / metrics.totalNet) * 100}%` }}></div>
                                </div>
                            </div>
                            {/* Tarjetas */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tarjetas</p>
                                <p className="text-sm font-black text-slate-800">{formatMoney(metrics.totalCard)}</p>
                                <div className="w-full h-1 bg-slate-200 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500" style={{ width: `${(metrics.totalCard / metrics.totalNet) * 100}%` }}></div>
                                </div>
                            </div>
                            {/* Billeteras */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Billeteras</p>
                                <p className="text-sm font-black text-slate-800">{formatMoney(metrics.totalWallets)}</p>
                                <div className="w-full h-1 bg-slate-200 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-500" style={{ width: `${(metrics.totalWallets / metrics.totalNet) * 100}%` }}></div>
                                </div>
                            </div>
                            {/* Transferencias */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Transferencias</p>
                                <p className="text-sm font-black text-slate-800">{formatMoney(metrics.totalTransfers)}</p>
                                <div className="w-full h-1 bg-slate-200 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-500" style={{ width: `${(metrics.totalTransfers / metrics.totalNet) * 100}%` }}></div>
                                </div>
                            </div>
                            {/* Obras Sociales */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Obras Sociales</p>
                                <p className="text-sm font-black text-slate-800">{formatMoney(metrics.totalInsurance)}</p>
                                <div className="w-full h-1 bg-slate-200 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${(metrics.totalInsurance / metrics.totalNet) * 100}%` }}></div>
                                </div>
                            </div>
                            {/* Cta Cte */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cta. Corriente</p>
                                <p className="text-sm font-black text-slate-800">{formatMoney(metrics.totalChecking)}</p>
                                <div className="w-full h-1 bg-slate-200 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-500" style={{ width: `${(metrics.totalChecking / metrics.totalNet) * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* CHARTS AREA */}
                <div className="lg:col-span-2 space-y-8">
                    {/* 1. Daily Sales vs Credits */}
                    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Monitor de Operaciones & Auditoría</h3>
                                <p className="text-slate-400 text-sm font-medium italic">Seguimiento de Ventas vs Créditos/Reversos para detección de anomalías.</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-indigo-600 shadow-lg shadow-indigo-100"></div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Ventas</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-rose-500 shadow-lg shadow-rose-100"></div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Notas de Crédito</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dailyData}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} tickFormatter={(v) => `$${v / 1000}k`} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                                        formatter={(v: number) => [formatMoney(v), '']}
                                    />
                                    <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={5} fillOpacity={1} fill="url(#colorSales)" />
                                    <Area type="monotone" dataKey="credits" stroke="#f43f5e" strokeWidth={5} fillOpacity={1} fill="url(#colorCredits)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* REAL REVENUE PANEL - EBITDA */}
                <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <TrendingUp className="w-32 h-32 text-emerald-400" />
                    </div>

                    <h3 className="text-white font-black text-xl mb-2 relative z-10">Ganancia Operativa (CASH FLOW)</h3>
                    <p className="text-slate-400 text-sm font-medium mb-10 relative z-10">Cálculo basado en egresos EFECTIVOS (Estado PAGADO).</p>

                    <div className="space-y-6 relative z-10">
                        {/* Breakdown for transparency */}
                        <div className="grid grid-cols-2 gap-4 pb-6 border-b border-white/5">
                            <div>
                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Gasto Proveedores (Paid)</p>
                                <p className="text-white font-bold text-sm tracking-tight">{formatMoney(metrics.realExpenseTotal)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-amber-400 text-[9px] font-black uppercase tracking-widest mb-1">Pendiente Pago (Ingr.)</p>
                                <p className="text-amber-400/80 font-bold text-sm tracking-tight">{formatMoney(metrics.pendingExpenseTotal)}</p>
                            </div>
                        </div>

                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Facturación Emitida (Bruto)</p>
                                <p className="text-white font-bold text-lg">{formatMoney(metrics.netReal)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-rose-400 text-xs font-bold leading-none">-{metrics.totalOutflow > 0 ? ((metrics.totalOutflow / metrics.netReal) * 100).toFixed(1) : 0}%</p>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Peso Egresos</p>
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
                            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-2">EBITDA (CASH FLOW)</p>
                            <h4 className="text-5xl font-black text-white tracking-tighter">{formatMoney(metrics.finalEbitda)}</h4>
                            <div className="flex flex-col gap-2 mt-4">
                                <p className="text-slate-500 text-xs font-medium italic">
                                    * Margen operativo: {metrics.profitabilityRatio.toFixed(1)}%
                                </p>
                                <div className="flex items-center justify-between">
                                    <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest">
                                        Pasivo Pendiente: {formatMoney(metrics.pendingExpenseTotal)}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                        <AlertTriangle className="w-3 h-3" /> NC: {formatMoney(metrics.totalCredits)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3">
                            <div className={`p-5 rounded-3xl border transition-all duration-500 ${metrics.creditRatio > 5 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/5'}`}>
                                <div className="flex gap-4">
                                    <div className={`p-3 rounded-2xl ${metrics.creditRatio > 5 ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
                                        {metrics.creditRatio > 5 ? <AlertTriangle className="w-6 h-6 text-amber-400" /> : <ShieldCheck className="w-6 h-6 text-emerald-400" />}
                                    </div>
                                    <div>
                                        <p className="text-white font-black text-sm uppercase tracking-tight">Status de Auditoría</p>
                                        <p className={`text-xs font-medium ${metrics.creditRatio > 5 ? 'text-amber-400' : 'text-slate-500'}`}>
                                            {metrics.creditRatio > 5
                                                ? `ALERTA: Ratio NC alto (${metrics.creditRatio.toFixed(1)}%) - Revisar posibles anulaciones.`
                                                : `Ratio NC Saludable (${metrics.creditRatio.toFixed(1)}%). Operación controlada.`
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 rounded-3xl border border-white/5 bg-white/5">
                                <div className="flex gap-4">
                                    <div className="p-3 bg-indigo-500/20 rounded-2xl"><Zap className="w-6 h-6 text-indigo-400" /></div>
                                    <div>
                                        <p className="text-white font-black text-sm uppercase tracking-tight">Eficiencia de Caja</p>
                                        <p className="text-slate-500 text-xs font-medium italic">
                                            Ventas Brutas sin deducir NC para asegurar trazabilidad total.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Restock Alignment Chart (WIDE FORMAT) */}
            <div className="mt-8 bg-white p-10 rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                    <Activity className="w-80 h-80 text-indigo-900" />
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-12 gap-8 relative z-10">
                    <div className="max-w-2xl">
                        <h3 className="text-3xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                            <div className="p-4 bg-emerald-500 rounded-3xl shadow-xl shadow-emerald-100 transition-transform hover:scale-110">
                                <TrendingUp className="w-8 h-8 text-white" />
                            </div>
                            Relación Facturación vs Compras
                        </h3>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em] mt-4 ml-1">
                            Análisis de Reposición: Ventas de Hoy vs Compras (Reposición de Stock) del día siguiente.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch gap-6 bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 backdrop-blur-md">
                        <div className="flex items-center gap-4 pr-6">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                                <ArrowUpRight className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1.5">Facturación</p>
                                <p className="text-sm font-black text-slate-800 uppercase">Ventas Netas</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
                            <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-200">
                                <ShoppingCart className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1.5">Compras (N+1)</p>
                                <p className="text-sm font-black text-slate-800 uppercase">Reposición</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-[500px] relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={performanceChart} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                            <defs>
                                <linearGradient id="colorRestockSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorRestockPurchases" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fontWeight: 900, fill: '#64748b' }}
                                dy={25}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fontWeight: 900, fill: '#64748b' }}
                                tickFormatter={(v) => `$${v / 1000}k`}
                                dx={-10}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '32px',
                                    border: 'none',
                                    boxShadow: '0 30px 60px -12px rgb(0 0 0 / 0.25)',
                                    padding: '24px',
                                    background: 'rgba(255, 255, 255, 0.98)',
                                    backdropFilter: 'blur(10px)'
                                }}
                                itemStyle={{ fontWeight: 900, fontSize: '14px' }}
                                labelStyle={{ fontWeight: 900, fontSize: '12px', marginBottom: '12px', color: '#64748b', textTransform: 'uppercase' }}
                                formatter={(v: number) => [formatMoney(v), '']}
                            />
                            <Area
                                type="monotone"
                                dataKey="ventas"
                                stroke="#10b981"
                                strokeWidth={7}
                                fillOpacity={1}
                                fill="url(#colorRestockSales)"
                                animationDuration={2000}
                                strokeLinecap="round"
                            />
                            <Area
                                type="monotone"
                                dataKey="compras"
                                stroke="#f97316"
                                strokeWidth={7}
                                fillOpacity={1}
                                fill="url(#colorRestockPurchases)"
                                animationDuration={2500}
                                strokeLinecap="round"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
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
