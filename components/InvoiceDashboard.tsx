import React, { useMemo, useState, useEffect } from 'react';
import { InvoiceRecord, SaleRecord, ExpenseRecord } from '../types';
import { StatsCard } from './StatsCard';
import { formatMoney } from '../utils/dataHelpers';
import { ClientFilter } from './ClientFilter';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend
} from 'recharts';
import { DollarSign, FileText, Building2, TrendingUp, ShieldCheck, CalendarRange, ChevronLeft, ChevronRight, Users, Filter, Package, Search, CheckCircle, AlertTriangle, Cloud, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { InvoiceTrendChart } from './InvoiceTrendChart';
import { InvoicePaymentChart } from './InvoicePaymentChart';
import { CrossedAnalytics } from './CrossedAnalytics';

interface InvoiceDashboardProps {
    data: InvoiceRecord[];
    salesData: SaleRecord[];
    expenseData?: ExpenseRecord[];
    serviceData?: ExpenseRecord[];
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
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
    onEndDateChange
}) => {
    // Filters
    // const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [selectedBranch, setSelectedBranch] = useState('all');
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
        const months = new Set(data.map(d => d.monthYear));
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
        return data.filter(d => {
            // Branch (Loose match)
            if (selectedBranch !== 'all' && !d.branch.includes(selectedBranch)) return false;

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
        let ncAmount = 0; // Credit Notes
        let txAmount = 0; // Transfers
        let fvAmount = 0; // Sales (FV)

        filteredData.forEach(d => {
            const typeValue = (d.type || '').toUpperCase();
            const isNC = typeValue.includes('NC') || typeValue.includes('CREDITO');
            const isTX = typeValue.includes('TX') || typeValue.includes('TRANSFER') || typeValue.includes('REMITO');
            const isFV = typeValue.includes('FV') || typeValue.includes('FACTURA') || typeValue.includes('TICKET');

            count++;
            const amount = Number(d.netAmount) || 0;

            // Si es NC, restamos del total neto general si es positivo
            if (isNC) {
                const absoluteAmount = Math.abs(amount);
                ncAmount += absoluteAmount;
                totalNet -= absoluteAmount;
            } else if (isTX) {
                txAmount += amount;
                // Las transferencias no suelen sumar a la facturación de venta neta
            } else {
                totalNet += amount;
                if (isFV) fvAmount += amount;
            }
        });

        return { totalNet, count, ncAmount, txAmount, fvAmount };
    }, [filteredData]);

    // --- BRANCH COMPARISON (Only when 'All' branches selected) ---
    const branchComparison = useMemo(() => {
        if (selectedBranch !== 'all') return null;

        const compMap = new Map<string, { value: number, count: number }>();
        filteredData.forEach(d => {
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

    // 1. Entities
    const entityData = useMemo(() => {
        const map = new Map<string, number>();
        filteredData.forEach(d => {
            if (d.netAmount > 0) map.set(d.entity, (map.get(d.entity) || 0) + d.netAmount);
        });
        return Array.from(map.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [filteredData]);

    // 2. Insurance (Obra Social)
    const insuranceData = useMemo(() => {
        const map = new Map<string, number>();
        filteredData.forEach(d => {
            if (d.insurance && d.insurance !== '-' && d.netAmount > 0) {
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
        if (tableFilterMode === 'ALL') return filteredData;
        return filteredData.filter(d => d.type.includes(tableFilterMode));
    }, [filteredData, tableFilterMode]);

    const totalPages = Math.ceil(tableDataRaw.length / ITEMS_PER_PAGE);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        // .slice works fine on large arrays, renders only 50 rows
        return tableDataRaw.slice().reverse().slice(start, start + ITEMS_PER_PAGE);
    }, [tableDataRaw, currentPage]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">

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
                            <CrossedAnalytics
                                invoiceNumber={auditInvoice.invoiceNumber}
                                // Auto-select node if possible from branch
                                initialNode={auditInvoice.branch}
                                salesData={salesData}
                                invoiceData={data}
                                expenseData={expenseData}
                                serviceData={serviceData}
                                startDate={startDate}
                                endDate={endDate}
                                onStartDateChange={onStartDateChange}
                                onEndDateChange={onEndDateChange}
                                compact={true}
                            />
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
                                            <p className="font-semibold text-gray-800 truncate">{selectedInvoice.paymentType}</p>
                                        </div>
                                        <div className={`p-4 rounded-xl border ${selectedInvoice.netAmount < 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                            <p className={`text-xs font-bold uppercase ${selectedInvoice.netAmount < 0 ? 'text-red-400' : 'text-green-500'}`}>Total Neto</p>
                                            <p className={`font-bold text-lg ${selectedInvoice.netAmount < 0 ? 'text-red-600' : 'text-green-700'}`}>
                                                {formatMoney(selectedInvoice.netAmount)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Product Table */}
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                            <Package className="w-4 h-4 text-purple-600" />
                                            Productos Asociados
                                        </h4>
                                        {hasProducts ? (
                                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                                                        <tr>
                                                            <th className="p-3">Producto</th>
                                                            <th className="p-3">Laboratorio</th>
                                                            <th className="p-3">Rubro</th>
                                                            <th className="p-3 text-right">Cant.</th>
                                                            <th className="p-3 text-right">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {relatedSales.map((sale, idx) => (
                                                            <tr key={idx} className="hover:bg-gray-50">
                                                                <td className="p-3 font-medium text-gray-800">{sale.productName}</td>
                                                                <td className="p-3 text-gray-500 text-xs">{sale.manufacturer}</td>
                                                                <td className="p-3 text-gray-500 text-xs">{sale.category}</td>
                                                                <td className="p-3 text-right text-gray-600">{sale.quantity}</td>
                                                                <td className="p-3 text-right font-medium text-gray-900">{formatMoney(sale.totalAmount)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tbody className="bg-gray-50 border-t border-gray-200">
                                                        <tr>
                                                            <td colSpan={4} className="p-3 text-right font-bold text-gray-600">Total Productos:</td>
                                                            <td className="p-3 text-right font-bold text-blue-600">{formatMoney(salesTotal)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                                <div className="bg-white mx-auto w-12 h-12 rounded-full flex items-center justify-center shadow-sm mb-3">
                                                    <Search className="w-6 h-6 text-gray-300" />
                                                </div>
                                                <p className="text-gray-500 font-medium">No se encontraron productos asociados.</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    Esto puede ocurrir si no ha cargado el reporte de "Ventas por Producto" o si el periodo de fechas no coincide.
                                                </p>
                                            </div>
                                        )}

                                        {hasProducts && (
                                            <div className={`mt-3 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border ${isMatch ? 'bg-green-50 text-green-700 border-green-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                                                {isMatch ? (
                                                    <CheckCircle className="w-4 h-4" />
                                                ) : (
                                                    <AlertTriangle className="w-4 h-4" />
                                                )}
                                                {isMatch
                                                    ? 'Conciliación Exitosa: El total de los productos coincide con el comprobante.'
                                                    : `Diferencia de auditoría: El comprobante difiere en ${formatMoney(selectedInvoice.netAmount - salesTotal)} respecto a los productos listados.`}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className="px-6 py-2 bg-white border border-gray-200 shadow-sm rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cerrar Detalle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Advanced Filter Modal */}
            <ClientFilter
                isOpen={isClientFilterOpen}
                onClose={() => setIsClientFilterOpen(false)}
                allClients={clients}
                excludedClients={excludedClients}
                includedClients={includedClients}
                onToggleExclusion={(c) => setExcludedClients(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                onToggleInclusion={(c) => setIncludedClients(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
            />

            {/* --- FILTERS BAR --- */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">

                {/* Quick Month Selector */}
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Mes</span>
                    <div className="relative">
                        <CalendarRange className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <select
                            className="w-36 pl-8 pr-2 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                <div className="w-px h-10 bg-gray-200 mx-1"></div>

                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Desde</label>
                    <input
                        type="date"
                        className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={startDate}
                        onChange={e => onStartDateChange(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Hasta</label>
                    <input
                        type="date"
                        className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={endDate}
                        onChange={e => onEndDateChange(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sucursal</label>
                    <select
                        className="px-3 py-2 border rounded-lg text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedBranch}
                        onChange={e => setSelectedBranch(e.target.value)}
                    >
                        <option value="all">Todas</option>
                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Entidad</label>
                    <select
                        className="px-3 py-2 border rounded-lg text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedEntity}
                        onChange={e => setSelectedEntity(e.target.value)}
                    >
                        <option value="all">Todas</option>
                        {entities.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tarjeta / Pago</label>
                    <select
                        className="px-3 py-2 border rounded-lg text-sm min-w-[140px] focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedPayment}
                        onChange={e => setSelectedPayment(e.target.value)}
                    >
                        <option value="all">Todos</option>
                        {payments.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cliente</label>
                    <button
                        onClick={() => setIsClientFilterOpen(true)}
                        className={`px-3 py-2 border rounded-lg text-sm min-w-[140px] max-w-[200px] text-left truncate flex items-center justify-between hover:bg-gray-50 ${includedClients.length > 0 ? 'text-blue-600 border-blue-200 bg-blue-50' : excludedClients.length > 0 ? 'text-red-600 border-red-200 bg-red-50' : 'text-gray-700'}`}
                    >
                        <span>
                            {includedClients.length > 0 ? `${includedClients.length} selec.` : excludedClients.length > 0 ? `${excludedClients.length} excl.` : 'Todos'}
                        </span>
                        <Users className="w-4 h-4 ml-2 opacity-50" />
                    </button>
                </div>
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
                                if (realBranch) setSelectedBranch(realBranch);
                                else setSelectedBranch(b.name);
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

            {/* --- INTERACTIVE KPI CARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatsCard
                    title="Facturación Neta (FV)"
                    value={formatMoney(stats.fvAmount)}
                    icon={<DollarSign className="w-5 h-5" />}
                    color="green"
                    isActive={tableFilterMode === 'FV'}
                    onClick={() => setTableFilterMode(tableFilterMode === 'FV' ? 'ALL' : 'FV')}
                />
                <StatsCard
                    title="Total Comprobantes"
                    value={stats.count.toLocaleString()}
                    icon={<FileText className="w-5 h-5" />}
                    color="blue"
                    isActive={tableFilterMode === 'ALL'}
                    onClick={() => setTableFilterMode('ALL')}
                />
                <StatsCard
                    title="Devoluciones (NC)"
                    value={formatMoney(Math.abs(stats.ncAmount))}
                    icon={<TrendingUp className="w-5 h-5 rotate-180" />}
                    color="red"
                    isActive={tableFilterMode === 'NC'}
                    onClick={() => setTableFilterMode(tableFilterMode === 'NC' ? 'ALL' : 'NC')}
                />
                <StatsCard
                    title="Transf. Sucursales (TX)"
                    value={formatMoney(stats.txAmount)}
                    icon={<Building2 className="w-5 h-5" />}
                    color="orange"
                    isActive={tableFilterMode === 'TX'}
                    onClick={() => setTableFilterMode(tableFilterMode === 'TX' ? 'ALL' : 'TX')}
                />
            </div>

            <div className="mb-6">
                <InvoiceTrendChart data={filteredData} dateRange={{ start: startDate, end: endDate }} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">

                {/* Sales by Entity Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-gray-400" />
                        Facturación por Entidad (Top 8)
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={entityData} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" tickFormatter={(val) => `$${val / 1000}k`} />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(val: number) => formatMoney(val)} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Facturación" />
                            </BarChart>
                        </ResponsiveContainer>
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
                                    <td className="p-3 truncate max-w-[150px] text-gray-700" title={inv.client}>{inv.client}</td>
                                    <td className="p-3 text-gray-600 text-xs">{inv.entity}</td>
                                    <td className="p-3 text-gray-600 text-xs truncate max-w-[120px]" title={inv.insurance}>{inv.insurance}</td>
                                    <td className="p-3 text-gray-600 text-xs font-medium">{inv.paymentType}</td>
                                    <td className={`p-3 text-right font-medium ${inv.netAmount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                        {formatMoney(inv.netAmount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Anterior
                        </button>
                        <span className="text-sm text-gray-600">
                            Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                        >
                            Siguiente <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {tableDataRaw.length === 0 && (
                    <div className="p-8 text-center text-gray-400 bg-gray-50 mt-2 rounded-lg border border-dashed border-gray-200">
                        No hay comprobantes que coincidan con los filtros seleccionados.
                    </div>
                )}
            </div>

        </div>
    );
};