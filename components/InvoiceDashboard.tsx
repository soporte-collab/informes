import React, { useMemo, useState, useEffect } from 'react';
import { InvoiceRecord, SaleRecord, ExpenseRecord } from '../types';
import { StatsCard } from './StatsCard';
import { formatMoney } from '../utils/dataHelpers';
import { ClientFilter } from './ClientFilter';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend
} from 'recharts';
import { DollarSign, FileText, Building2, TrendingUp, ShieldCheck, CalendarRange, ChevronLeft, ChevronRight, Users, Filter, Package, Search, CheckCircle, AlertTriangle, Cloud, Zap, Clock, Link2OffIcon } from 'lucide-react';
import { format, addDays, startOfDay, startOfWeek, endOfWeek, isSameWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { InvoiceTrendChart } from './InvoiceTrendChart';
import { InvoicePaymentChart } from './InvoicePaymentChart';
import { EntityMonthReport } from './EntityMonthReport';
import { SalesHeatmap } from './SalesHeatmap';
import { HeatmapDetailModal } from './HeatmapDetailModal';

interface InvoiceDashboardProps {
    data: InvoiceRecord[];
    salesData: SaleRecord[];
    expenseData?: ExpenseRecord[];
    serviceData?: ExpenseRecord[];
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    selectedBranch: string;
    onSelectBranch: (branch: string) => void;
}

const ITEMS_PER_PAGE = 50;

export const InvoiceDashboard: React.FC<InvoiceDashboardProps> = ({
    data,
    salesData,
    expenseData = [],
    serviceData = [],
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    selectedBranch,
    onSelectBranch
}) => {
    // Filters
    const [selectedEntity, setSelectedEntity] = useState('all');
    const [selectedType, setSelectedType] = useState('all');
    const [selectedPayment, setSelectedPayment] = useState('all');

    // Advanced Client Filter State
    const [isClientFilterOpen, setIsClientFilterOpen] = useState(false);
    const [excludedClients, setExcludedClients] = useState<string[]>([]);
    const [includedClients, setIncludedClients] = useState<string[]>([]);

    // Interactive Table Filter (Controlled by Cards)
    const [tableFilterMode, setTableFilterMode] = useState<'ALL' | 'NC' | 'TX' | 'FV'>('ALL');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);

    // Detail View State
    const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
    const [auditInvoice, setAuditInvoice] = useState<InvoiceRecord | null>(null);

    // Entity Report State
    const [selectedEntityReport, setSelectedEntityReport] = useState<string>('');
    const [selectedMonthReport, setSelectedMonthReport] = useState<string>('');
    const [showEntityReport, setShowEntityReport] = useState(false);
    const [searchTermEntity, setSearchTermEntity] = useState('');

    // Client Report State
    const [selectedClientReport, setSelectedClientReport] = useState<string>('');
    const [searchTermClient, setSearchTermClient] = useState('');
    const [showClientReport, setShowClientReport] = useState(false);

    // Heatmap State
    const [isHeatmapModalOpen, setIsHeatmapModalOpen] = useState(false);
    const [activeHeatmapSlot, setActiveHeatmapSlot] = useState<{ dayIndex: number, hour: number, dayName: string } | null>(null);
    const [selectedWeek, setSelectedWeek] = useState('all');

    // Extract available weeks from filtered sales data
    const weekOptions = useMemo(() => {
        const weeksMap = new Map<string, { label: string, start: Date }>();

        salesData.forEach(d => {
            const startStr = startOfWeek(d.date, { weekStartsOn: 1 }).toISOString();
            if (!weeksMap.has(startStr)) {
                const start = startOfWeek(d.date, { weekStartsOn: 1 });
                const end = endOfWeek(d.date, { weekStartsOn: 1 });
                const label = `Semana del ${format(start, 'dd/MM', { locale: es })} al ${format(end, 'dd/MM', { locale: es })}`;
                weeksMap.set(startStr, { label, start });
            }
        });

        return Array.from(weeksMap.entries())
            .sort((a, b) => a[1].start.getTime() - b[1].start.getTime())
            .map(([value, { label }]) => ({ value, label }));
    }, [salesData]);

    const heatmapDisplayData = useMemo(() => {
        const filteredSales = (salesData || []).filter(s => {
            let matchDate = true;
            if (startDate) {
                const start = new Date(startDate + 'T00:00:00');
                if (s.date < start) matchDate = false;
            }
            if (matchDate && endDate) {
                const end = new Date(endDate + 'T23:59:59');
                if (s.date > end) matchDate = false;
            }
            return matchDate;
        });

        if (selectedWeek === 'all') return filteredSales;
        const selectedDate = new Date(selectedWeek);
        return filteredSales.filter(d => isSameWeek(d.date, selectedDate, { weekStartsOn: 1 }));
    }, [salesData, startDate, endDate, selectedWeek]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [startDate, endDate, selectedBranch, selectedEntity, selectedType, selectedPayment, excludedClients, includedClients, tableFilterMode]);

    // Derive Options from Data (Memoized for performance)
    const { entities, branches, payments, clients } = useMemo(() => {
        const ent = new Set<string>();
        const bra = new Set<string>();
        const pay = new Set<string>();
        const cli = new Set<string>();

        // Single pass loop for performance
        data.forEach(d => {
            if (d.entity) ent.add(d.entity);
            if (d.branch) bra.add(d.branch);
            if (d.paymentType) pay.add(d.paymentType);
            if (d.client && d.client !== 'CONSUMIDOR FINAL, A') cli.add(d.client);
        });

        return {
            entities: Array.from(ent).sort(),
            branches: Array.from(bra).sort(),
            payments: Array.from(pay).sort(),
            clients: Array.from(cli).sort()
        };
    }, [data]);

    // Available Months for Quick Select
    const availableMonths = useMemo(() => {
        const months = new Set((data || []).map(d => d.monthYear));
        return Array.from(months).sort().reverse();
    }, [data]);

    // Handle Quick Month Select
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

    // Main Data Filtering
    const filteredData = useMemo(() => {
        return (data || []).filter(d => {
            // Branch (Case-insensitive loose match)
            if (selectedBranch !== 'all' && !d.branch.toLowerCase().includes(selectedBranch.toLowerCase())) return false;

            // Date Range
            if (startDate && d.date < new Date(startDate + 'T00:00:00')) return false;
            if (endDate && d.date > new Date(endDate + 'T23:59:59')) return false;

            // Other Exact Filters
            if (selectedEntity !== 'all' && d.entity !== selectedEntity) return false;
            if (selectedType !== 'all' && d.type !== selectedType) return false;
            if (selectedPayment !== 'all' && d.paymentType !== selectedPayment) return false;

            // Client Filter (Advanced)
            const currentClient = d.client || "Desconocido";
            let clientMatch = true;
            if (includedClients.length > 0) {
                clientMatch = includedClients.includes(currentClient);
            } else {
                clientMatch = !excludedClients.includes(currentClient);
            }
            if (!clientMatch) return false;

            return true;
        });
    }, [data, startDate, endDate, selectedBranch, selectedEntity, selectedType, selectedPayment, excludedClients, includedClients]);

    // --- KPI CALCULATIONS ---
    const stats = useMemo(() => {
        let totalNet = 0;
        let count = 0;
        let ncAmount = 0; // Credit Notes (for Health KPI)
        let txAmount = 0; // Transfers (Ignored)
        let fvAmount = 0; // Sales (The real metric)
        let discountTotal = 0; // Discount Leakage

        filteredData.forEach(d => {
            const typeValue = (d.type || '').toUpperCase();

            // STRICT CLASSIFICATION
            const isNC = typeValue.includes('NC') || typeValue.includes('N.C') || typeValue.includes('N/C') || typeValue.includes('NOTA DE CREDITO') || typeValue.includes('CREDITO') || typeValue.includes('DEVOLUCION');
            const isTX = typeValue.includes('TX') || typeValue.includes('TRANSFER') || typeValue.includes('REMITO') || typeValue.includes('MOVIMIENTO') || typeValue.includes('TRSU') || typeValue.includes('AJUSTE');

            const amount = Number(d.netAmount) || 0;
            const discount = Number(d.discount) || 0;

            // SECURITY CHECK: If amount is negative, treat it as a return/adjustment to prevent subtraction from Net Sales
            const isNegative = amount < 0;

            if (isTX) {
                txAmount += amount;
                // IGNORE TX COMPLETELY FROM TOTALS
            } else if (isNC || isNegative) {
                ncAmount += Math.abs(amount);
                // IGNORE NC/NEGATIVES FROM TOTALS (We only sum positive generation)
            } else {
                // IS SALE (FV) -> STRICTLY POSITIVE
                totalNet += amount;
                fvAmount += amount;
                count++;
                discountTotal += Math.abs(discount);
            }
        });

        // --- DATA INTEGRITY (ORPHANS) ---
        // Find invoices in filteredData (FV only) that have NO matching records in salesData
        const salesInvoiceNumbers = new Set((salesData || []).map(s => s.invoiceNumber));
        let orphanCount = 0;
        let orphanAmount = 0;

        filteredData.forEach(d => {
            const typeValue = (d.type || '').toUpperCase();
            const isNC = typeValue.includes('NC') || typeValue.includes('N.C') || typeValue.includes('N/C') || typeValue.includes('CREDITO') || typeValue.includes('DEVOLUCION');
            const isTX = typeValue.includes('TX') || typeValue.includes('TRANSFER') || typeValue.includes('REMITO') || typeValue.includes('TRSU');

            if (!isNC && !isTX && !salesInvoiceNumbers.has(d.invoiceNumber)) {
                orphanCount++;
                orphanAmount += (d.netAmount || 0);
            }
        });

        // --- MOM (Month over Month) Comparison ---
        let momGrowth = 0;
        let prevTotal = 0;

        if (startDate) {
            const currentStart = new Date(startDate);
            const prevStart = new Date(currentStart);
            prevStart.setMonth(currentStart.getMonth() - 1);

            // Calc duration
            let durationDays = 30;
            if (endDate) {
                const currentEnd = new Date(endDate);
                durationDays = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));
            }
            const prevEnd = new Date(prevStart);
            prevEnd.setDate(prevEnd.getDate() + durationDays);

            // Filter data for previous period (using raw 'data' prop)
            const prevData = (data || []).filter(d => {
                const dDate = new Date(d.date);
                if (d.branch && selectedBranch !== 'all' && !d.branch.toLowerCase().includes(selectedBranch.toLowerCase())) return false;
                return dDate >= prevStart && dDate <= prevEnd;
            });

            // Calculate Prev Total (Same logic: Only FV)
            prevData.forEach(d => {
                const typeValue = (d.type || '').toUpperCase();
                const isNC = typeValue.includes('NC') || typeValue.includes('N.C') || typeValue.includes('N/C') || typeValue.includes('CREDITO');
                const isTX = typeValue.includes('TX') || typeValue.includes('TRANSFER') || typeValue.includes('REMITO');
                if (!isNC && !isTX) {
                    prevTotal += (d.netAmount || 0);
                }
            });

            if (prevTotal > 0) {
                momGrowth = ((totalNet - prevTotal) / prevTotal) * 100;
            }
        }

        return {
            totalNet, // Sum of FV only
            count,    // Count of FV only
            avgTicket: count > 0 ? totalNet / count : 0,
            ncAmount,
            ncRatio: totalNet > 0 ? (ncAmount / totalNet) * 100 : 0,
            txAmount,
            discountTotal,
            discountRatio: totalNet > 0 ? (discountTotal / totalNet) * 100 : 0,
            orphanCount,
            orphanAmount,
            momGrowth,
            prevTotal
        };
    }, [filteredData, salesData, startDate, endDate, data, selectedBranch]);

    // Financial Heatmap Data Transformation
    const financialHeatmapData: any[] = useMemo(() => {
        return filteredData
            .filter(d => {
                const typeValue = (d.type || '').toUpperCase();
                return !(typeValue.includes('NC') || typeValue.includes('TX'));
            })
            .map(inv => ({
                id: inv.id,
                date: inv.date,
                monthYear: inv.monthYear,
                productName: 'FACTURACION',
                quantity: 1,
                unitPrice: inv.netAmount,
                totalAmount: inv.netAmount,
                sellerName: inv.seller,
                branch: inv.branch,
                hour: new Date(inv.date).getHours(),
                category: 'GENERAL',
                manufacturer: 'GENERAL',
                invoiceNumber: inv.invoiceNumber,
                entity: inv.entity
            } as SaleRecord));
    }, [filteredData]);

    // --- BRANCH COMPARISON (Only when 'All' branches selected) ---
    const branchComparison = useMemo(() => {
        if (selectedBranch !== 'all') return null;

        const compMap = new Map<string, { value: number, count: number }>();
        filteredData.forEach(d => {
            const typeValue = (d.type || '').toUpperCase();
            const isNC = typeValue.includes('NC') || typeValue.includes('CREDITO') || typeValue.includes('DEVOLUCION');
            const isTX = typeValue.includes('TX') || typeValue.includes('TRANSFER') || typeValue.includes('REMITO') || typeValue.includes('MOVIMIENTO') || typeValue.includes('TRSU');

            // Skip NC and TX from branch totals for comparison
            if (isNC || isTX) return;

            let bName = d.branch || 'Desconocida';
            if (bName.toUpperCase().includes('CHACRAS')) bName = 'Chacras Park';
            else if (bName.toUpperCase().includes('BIOSALUD')) bName = 'Fcia Biosalud';

            const curr = compMap.get(bName) || { value: 0, count: 0 };
            compMap.set(bName, {
                value: curr.value + (Number(d.netAmount) || 0),
                count: curr.count + 1
            });
        });

        return Array.from(compMap.entries()).map(([name, data]) => ({ name, ...data }));
    }, [filteredData, selectedBranch]);

    // --- CHARTS DATA ---

    // 1. Entities (excluding NC and TX)
    const entityData = useMemo(() => {
        const map = new Map<string, number>();
        filteredData.forEach(d => {
            const typeValue = (d.type || '').toUpperCase();
            const isNC = typeValue.includes('NC') || typeValue.includes('CREDITO') || typeValue.includes('DEVOLUCION');
            const isTX = typeValue.includes('TX') || typeValue.includes('TRANSFER') || typeValue.includes('REMITO') || typeValue.includes('MOVIMIENTO') || typeValue.includes('TRSU');

            if (!isNC && !isTX && d.netAmount > 0) {
                map.set(d.entity, (map.get(d.entity) || 0) + d.netAmount);
            }
        });
        return Array.from(map.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [filteredData]);

    // 2. Insurance (Obra Social) - excluding NC and TX
    const insuranceData = useMemo(() => {
        const map = new Map<string, number>();
        filteredData.forEach(d => {
            const typeValue = (d.type || '').toUpperCase();
            const isNC = typeValue.includes('NC') || typeValue.includes('CREDITO') || typeValue.includes('DEVOLUCION');
            const isTX = typeValue.includes('TX') || typeValue.includes('TRANSFER') || typeValue.includes('REMITO') || typeValue.includes('MOVIMIENTO') || typeValue.includes('TRSU');

            if (!isNC && !isTX && d.insurance && d.insurance !== '-' && d.netAmount > 0) {
                map.set(d.insurance, (map.get(d.insurance) || 0) + d.netAmount);
            }
        });
        return Array.from(map.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filteredData]);

    // --- TABLE DATA & PAGINATION ---
    const tableDataRaw = useMemo(() => {
        return (filteredData || []).filter(d => {
            const typeValue = d.type.toUpperCase();
            if (tableFilterMode === 'ALL') return true;

            if (tableFilterMode === 'FV') {
                const isNC = typeValue.includes('NC') || typeValue.includes('CREDITO') || typeValue.includes('DEVOLUCION');
                const isTX = typeValue.includes('TX') || typeValue.includes('TRANSFER') || typeValue.includes('REMITO') || typeValue.includes('MOVIMIENTO') || typeValue.includes('TRSU');
                // Any F-type or Ticket or FDVP...
                const isFV = typeValue.includes('FV') || typeValue.includes('FACTURA') || typeValue.includes('TICKET') || typeValue.includes('FDVP') || typeValue.startsWith('B') || typeValue.startsWith('A') || typeValue.startsWith('T') || typeValue.startsWith('F');
                return isFV && !isNC && !isTX;
            }

            return typeValue.includes(tableFilterMode);
        });
    }, [filteredData, tableFilterMode]);

    // Available Entities and Months for the auditoría report
    const availableEntitiesReport = useMemo(() => {
        if (!selectedMonthReport) return [];
        const ent = new Set<string>();
        salesData.forEach(s => {
            if (s.monthYear === selectedMonthReport && s.entity) {
                if (searchTermEntity && !s.entity.toLowerCase().includes(searchTermEntity.toLowerCase())) return;
                ent.add(s.entity);
            }
        });
        return Array.from(ent).sort();
    }, [salesData, selectedMonthReport, searchTermEntity]);

    const availableClientsReport = useMemo(() => {
        if (!selectedMonthReport) return [];
        const cli = new Set<string>();
        salesData.forEach(s => {
            if (s.monthYear === selectedMonthReport && s.client) {
                if (searchTermClient && !s.client.toLowerCase().includes(searchTermClient.toLowerCase())) return;
                cli.add(s.client);
            }
        });
        return Array.from(cli).sort();
    }, [salesData, selectedMonthReport, searchTermClient]);

    const reportData = useMemo(() => {
        if (!showEntityReport && !showClientReport) return [];
        return salesData;
    }, [showEntityReport, showClientReport, salesData]);

    const totalPages = Math.ceil(tableDataRaw.length / ITEMS_PER_PAGE);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return tableDataRaw.slice().reverse().slice(start, start + ITEMS_PER_PAGE);
    }, [tableDataRaw, currentPage]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header / Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 1. Net Sales (FV) */}
                <StatsCard
                    title="Facturación Neta (FV)"
                    value={formatMoney(stats.totalNet)}
                    icon={<DollarSign className="w-5 h-5" />}
                    trend={`${stats.momGrowth > 0 ? '+' : ''}${stats.momGrowth.toFixed(1)}%`}
                    trendUp={stats.momGrowth >= 0}
                    color="indigo"
                />

                {/* 2. Commercial Operations */}
                <StatsCard
                    title="Operaciones Comerciales"
                    value={stats.count.toLocaleString()}
                    icon={<FileText className="w-5 h-5" />}
                    subValue={`Ticket Prom: ${formatMoney(stats.avgTicket)}`}
                    color="blue"
                />

                {/* 3. Operational Health (Returns & Leaks) */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Salud Operativa</p>
                            <h3 className="text-xl font-black text-slate-700 mt-1">{stats.ncRatio.toFixed(1)}% <span className="text-xs text-slate-400 font-medium">Tasa Devolución</span></h3>
                        </div>
                        <div className="bg-orange-100 p-2 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                        </div>
                    </div>
                    <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Monto NC:</span>
                            <span className="font-bold text-red-400">-{formatMoney(stats.ncAmount)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Fuga Descuentos:</span>
                            <span className="font-bold text-orange-400">-{formatMoney(stats.discountTotal)} ({stats.discountRatio.toFixed(1)}%)</span>
                        </div>
                    </div>
                </div>

                {/* 4. Data Integrity */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Integridad de Datos</p>
                            <h3 className={`text-xl font-black mt-1 ${stats.orphanCount === 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {stats.orphanCount} <span className="text-xs text-slate-400 font-medium">Huérfanos</span>
                            </h3>
                        </div>
                        <div className={`p-2 rounded-lg ${stats.orphanCount === 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            {stats.orphanCount === 0 ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <Link2OffIcon className="w-5 h-5 text-red-600" />}
                        </div>
                    </div>
                    <div className="mt-2">
                        <p className="text-xs text-slate-500 leading-snug">
                            {stats.orphanCount === 0
                                ? "Todas las facturas tienen detalle sincronizado."
                                : `${formatMoney(stats.orphanAmount)} en facturas sin detalle de productos.`}
                        </p>
                    </div>
                </div>
            </div>

            {/* --- FILTER BAR --- */}
            <div className="flex flex-col xl:flex-row gap-4">
                <div className="flex-1 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
                        {/* Branch Selector */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <select
                                value={selectedBranch}
                                onChange={(e) => onSelectBranch(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer uppercase"
                            >
                                <option value="all">TODAS SUCURSALES</option>
                                <option value="FCIA BIOSALUD">FCIA BIOSALUD</option>
                                <option value="CHACRAS">CHACRAS PARK</option>
                            </select>
                        </div>

                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                        <select
                            value={currentMonthValue}
                            onChange={(e) => handleQuickMonthSelect(e.target.value)}
                            className="bg-gray-100 text-gray-700 text-xs font-bold rounded-xl px-3 py-2 outline-none hover:bg-gray-200 transition-colors cursor-pointer uppercase"
                        >
                            <option value="all">TODO EL HISTORIAL</option>
                            <option value="custom">PERSONALIZADO</option>
                            {availableMonths.map(month => (
                                <option key={month} value={month}>{month}</option>
                            ))}
                        </select>

                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-2 py-1 border border-gray-100">
                            <CalendarRange className="w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="date"
                                className="bg-transparent text-xs text-gray-600 font-medium outline-none"
                                value={startDate}
                                onChange={(e) => onStartDateChange(e.target.value)}
                            />
                            <span className="text-gray-300">-</span>
                            <input
                                type="date"
                                className="bg-transparent text-xs text-gray-600 font-medium outline-none"
                                value={endDate}
                                onChange={(e) => onEndDateChange(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative group">
                            <button
                                onClick={() => setIsClientFilterOpen(!isClientFilterOpen)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${(includedClients.length > 0 || excludedClients.length > 0)
                                    ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                <span>Filtrar Clientes</span>
                                {(includedClients.length > 0 || excludedClients.length > 0) && (
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] text-white">
                                        {includedClients.length + excludedClients.length}
                                    </span>
                                )}
                            </button>
                            {/* Client Filter Popover */}
                            {isClientFilterOpen && (
                                <div className="absolute top-full right-0 mt-2 z-50 w-80">
                                    <ClientFilter
                                        clients={clients}
                                        includedClients={includedClients}
                                        excludedClients={excludedClients}
                                        onInclude={setIncludedClients}
                                        onExclude={setExcludedClients}
                                        onClose={() => setIsClientFilterOpen(false)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Financial Heatmap */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <Cloud className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-bold text-slate-700">Mapa de Calor Financiero (Facturación)</h3>
                </div>
                <SalesHeatmap data={financialHeatmapData} />
            </div>

            {/* --- BRANCH COMPARISON (CONDITIONAL) --- */}
            {selectedBranch === 'all' && branchComparison && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {branchComparison.map((b) => (
                        <button
                            key={b.name}
                            onClick={() => {
                                // Find the original branch name that matches this category
                                const realBranch = branches.find(br => br.toUpperCase().includes(b.name.split(' ')[0].toUpperCase()));
                                if (realBranch) onSelectBranch(realBranch);
                                else onSelectBranch(b.name);
                            }}
                            className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-blue-300 hover:shadow-md transition-all text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-full ${b.name.includes('Chacras') ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">{b.name}</p>
                                    <h3 className="text-xl font-bold text-gray-800">{formatMoney(b.value)}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">
                                        {b.count} Comprobantes
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">
                                    {((b.value / (stats.totalNet || 1)) * 100).toFixed(1)}%
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <div className="mb-6">
                <InvoiceTrendChart data={filteredData} dateRange={{ start: startDate, end: endDate }} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">

                {/* --- AUDITORÍA POR ENTIDAD / CLIENTE WIZARD (REDISEÑADO) --- */}
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-[100px] -z-0 transition-transform group-hover:scale-110"></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-emerald-100 p-2 rounded-xl">
                                <FileText className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Auditoría de Consumos</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Entidades & Clientes</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 ml-1">1. Período de Análisis</label>
                                <select
                                    className="w-full bg-slate-50 text-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 border border-slate-200 font-medium"
                                    value={selectedMonthReport}
                                    onChange={(e) => setSelectedMonthReport(e.target.value)}
                                >
                                    <option value="">-- Seleccionar Mes --</option>
                                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Entity Column */}
                                <div className={`transition-opacity ${!selectedMonthReport ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 ml-1">2. Por Entidad</label>
                                    <div className="relative mb-2">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar Entidad..."
                                            className="w-full bg-white border border-slate-200 text-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                            value={searchTermEntity}
                                            onChange={(e) => setSearchTermEntity(e.target.value)}
                                        />
                                    </div>
                                    <select
                                        className="w-full bg-slate-50 text-slate-700 rounded-lg px-3 py-2 text-xs outline-none border border-slate-200 focus:border-emerald-500"
                                        value={selectedEntityReport}
                                        onChange={(e) => setSelectedEntityReport(e.target.value)}
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {availableEntitiesReport.map(e => <option key={e} value={e}>{e}</option>)}
                                    </select>
                                    <button
                                        disabled={!selectedEntityReport || !selectedMonthReport}
                                        onClick={() => setShowEntityReport(true)}
                                        className="mt-2 w-full bg-emerald-600 text-white font-bold py-2 rounded-lg text-xs hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-200"
                                    >
                                        Generar Reporte
                                    </button>
                                </div>

                                {/* Client Column */}
                                <div className={`transition-opacity ${!selectedMonthReport ? 'opacity-50 pointer-events-none' : ''} border-l border-slate-100 pl-4`}>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 ml-1">3. Por Cliente</label>
                                    <div className="relative mb-2">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar Cliente..."
                                            className="w-full bg-white border border-slate-200 text-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            value={searchTermClient}
                                            onChange={(e) => setSearchTermClient(e.target.value)}
                                        />
                                    </div>
                                    <select
                                        className="w-full bg-slate-50 text-slate-700 rounded-lg px-3 py-2 text-xs outline-none border border-slate-200 focus:border-blue-500"
                                        value={selectedClientReport}
                                        onChange={(e) => setSelectedClientReport(e.target.value)}
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {availableClientsReport.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <button
                                        disabled={!selectedClientReport || !selectedMonthReport}
                                        onClick={() => setShowClientReport(true)}
                                        className="mt-2 w-full bg-blue-600 text-white font-bold py-2 rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-200"
                                    >
                                        Generar Reporte
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sales by Insurance Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-gray-400" />
                        Obras Sociales (Top 10)
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={insuranceData} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" tickFormatter={(val) => `$${val / 1000}k`} />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(val: number) => formatMoney(val)} />
                                <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]} name="Facturación" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Payment Methods Chart */}
                <div className="xl:col-span-1">
                    <InvoicePaymentChart data={filteredData} />
                </div>
            </div>

            {/* --- DETAILED TABLE WITH PAGINATION --- */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-400" />
                        Detalle de Comprobantes
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full ml-2 hidden sm:inline-block">
                            Filtro: {tableFilterMode === 'ALL' ? 'Todos' : tableFilterMode === 'NC' ? 'Notas de Crédito' : tableFilterMode === 'TX' ? 'Transferencias' : 'Facturas'}
                        </span>
                    </h3>
                    <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-lg">
                        Total: <strong>{tableDataRaw.length}</strong> registros
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse relative">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase sticky top-0 z-10">
                            <tr>
                                <th className="p-3">Fecha</th>
                                <th className="p-3">Tipo</th>
                                <th className="p-3">Comprobante</th>
                                <th className="p-3">Cliente</th>
                                <th className="p-3">Entidad</th>
                                <th className="p-3">Obra Social</th>
                                <th className="p-3">Pago</th>
                                <th className="p-3 text-right">Neto</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100">
                            {paginatedData.map((inv) => (
                                <tr
                                    key={inv.id}
                                    className="hover:bg-blue-50 cursor-pointer transition-colors group"
                                    onClick={() => setSelectedInvoice(inv)}
                                >
                                    <td className="p-3 whitespace-nowrap text-gray-600 group-hover:text-blue-600 font-medium transition-colors">{format(inv.date, 'dd/MM/yy HH:mm')}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${(inv.type.toUpperCase().includes('NC') || inv.type.toUpperCase().includes('CREDITO')) ? 'bg-red-50 text-red-600 border border-red-100' :
                                            (inv.type.toUpperCase().includes('TX') || inv.type.toUpperCase().includes('TRANSFER')) ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                                'bg-green-50 text-green-600 border border-green-100'
                                            }`}>
                                            {inv.type}
                                        </span>
                                    </td>
                                    <td className="p-3 font-mono text-xs text-gray-500 group-hover:text-blue-500 flex items-center gap-2">
                                        {inv.invoiceNumber}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAuditInvoice(inv);
                                            }}
                                            className="p-1 rounded-md bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                            title="Ver detalle en Zetti API"
                                        >
                                            <Cloud className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                    <td className="p-3 truncate max-w-[150px]" title={inv.client}>{inv.client}</td>
                                    <td className="p-3 text-gray-500">{inv.entity}</td>
                                    <td className="p-3 text-gray-500">{inv.insurance}</td>
                                    <td className="p-3 text-gray-500">{inv.paymentType}</td>
                                    <td className="p-3 text-right font-medium">{formatMoney(inv.netAmount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex justify-between items-center py-4 border-t border-gray-100 bg-gray-50 mt-4 px-4 rounded-lg">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-semibold text-gray-600"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Anterior
                        </button>
                        <span className="text-xs text-gray-500 font-medium">
                            Página {currentPage} de {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-semibold text-gray-600"
                        >
                            Siguiente
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {showEntityReport && (
                <EntityMonthReport
                    data={salesData}
                    entityName={selectedEntityReport}
                    month={selectedMonthReport}
                    onClose={() => setShowEntityReport(false)}
                    isClientReport={false}
                />
            )}

            {showClientReport && (
                <EntityMonthReport
                    data={salesData}
                    entityName={selectedClientReport}
                    month={selectedMonthReport}
                    onClose={() => setShowClientReport(false)}
                    isClientReport={true}
                />
            )}

            {/* --- QUICK ZETTI AUDIT MODAL --- */}
            {auditInvoice && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-3xl w-full max-w-lg border border-white/10 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-800/50">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-emerald-400" />
                                <h3 className="text-white font-bold text-sm tracking-tight uppercase">Auditoría Instantánea Zetti</h3>
                            </div>
                            <button onClick={() => setAuditInvoice(null)} className="text-slate-400 hover:text-white p-1">
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <p className="text-white text-sm mb-4">Esta función requiere que el servidor de Zetti esté activo.</p>
                        </div>
                        <div className="p-4 bg-slate-950/50 border-t border-white/5 text-center">
                            <p className="text-[10px] text-slate-500 font-medium">Buscando ticket <span className="text-emerald-400">{auditInvoice.invoiceNumber}</span> en tiempo real...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* --- INVOICE DETAIL MODAL --- */}
            {selectedInvoice && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div
                        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 font-mono flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-blue-500" />
                                    {selectedInvoice.invoiceNumber}
                                    <button
                                        onClick={() => setAuditInvoice(selectedInvoice)}
                                        className="ml-2 p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5"
                                        title="Auditar con Zetti API"
                                    >
                                        <Cloud className="w-4 h-4" />
                                        <span className="text-[10px] font-bold uppercase">Auditar</span>
                                    </button>
                                </h3>
                                <div className="flex items-center gap-3 text-sm text-gray-500 mt-2">
                                    <span>{format(selectedInvoice.date, 'EEEE dd MMMM yyyy, HH:mm', { locale: es })} h</span>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    <span>{selectedInvoice.branch}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Validated Amount Check */}
                        {(() => {
                            const relatedSales = salesData?.filter(s => s.invoiceNumber === selectedInvoice.invoiceNumber) || [];
                            const salesTotal = relatedSales.reduce((acc, curr) => acc + curr.totalAmount, 0);
                            const diff = Math.abs(selectedInvoice.netAmount - salesTotal);
                            const isMatch = diff < 100; // Tolerance for small rounding errors
                            const hasProducts = relatedSales.length > 0;

                            return (
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* Key Info Cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                            <p className="text-xs font-bold text-gray-400 uppercase">Cliente</p>
                                            <p className="font-semibold text-gray-800 truncate" title={selectedInvoice.client}>{selectedInvoice.client}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                            <p className="text-xs font-bold text-gray-400 uppercase">Obra Social</p>
                                            <p className="font-semibold text-gray-800 truncate" title={selectedInvoice.insurance}>{selectedInvoice.insurance || '-'}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                            <p className="text-xs font-bold text-gray-400 uppercase">Pago</p>
                                            <p className="font-semibold text-gray-800">{selectedInvoice.paymentType || '-'}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                            <p className="text-xs font-bold text-gray-400 uppercase">Total</p>
                                            <p className="font-bold text-lg text-emerald-600">{formatMoney(selectedInvoice.netAmount)}</p>
                                        </div>
                                    </div>

                                    {/* Product Match Status */}
                                    <div className={`p-4 rounded-xl border ${isMatch ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${isMatch ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                {isMatch ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h4 className={`font-bold ${isMatch ? 'text-green-800' : 'text-red-800'}`}>
                                                    {hasProducts ? (isMatch ? 'Conciliación Correcta' : 'Discrepancia en Montos') : 'Sin Detalle de Productos'}
                                                </h4>
                                                <p className={`text-sm ${isMatch ? 'text-green-600' : 'text-red-600'}`}>
                                                    {hasProducts
                                                        ? `Suma de productos: ${formatMoney(salesTotal)} ${!isMatch ? `(Dif: ${formatMoney(diff)})` : ''}`
                                                        : 'Este comprobante existe en el reporte fiscal pero no en el de productos.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Product List Table */}
                                    {hasProducts && (
                                        <div>
                                            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                                <ShoppingBag className="w-4 h-4 text-gray-400" />
                                                Productos
                                            </h4>
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                                                        <th className="py-2">Producto</th>
                                                        <th className="py-2 text-right">Cant.</th>
                                                        <th className="py-2 text-right">Unit.</th>
                                                        <th className="py-2 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-sm divide-y divide-gray-50">
                                                    {relatedSales.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td className="py-3 pr-2 font-medium text-gray-700">{item.productName}</td>
                                                            <td className="py-3 text-right text-gray-600">{item.quantity}</td>
                                                            <td className="py-3 text-right text-gray-600">{formatMoney(item.unitPrice)}</td>
                                                            <td className="py-3 text-right font-bold text-gray-800">{formatMoney(item.totalAmount)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            <HeatmapDetailModal
                isOpen={isHeatmapModalOpen}
                onClose={() => setIsHeatmapModalOpen(false)}
                data={heatmapDisplayData}
                activeSlot={activeHeatmapSlot}
                setActiveSlot={setActiveHeatmapSlot}
            />
        </div>
    );
};
import { ShoppingBag } from 'lucide-react';