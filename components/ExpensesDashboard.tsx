import React, { useMemo, useState, useEffect } from 'react';
import { ExpenseRecord, ExpenseItem } from '../types';
import { getMetadata, saveMetadata } from '../utils/db';
// Recharts purged
const ResponsiveContainer = ({ children }: any) => <div className="h-full w-full bg-gray-50 rounded-2xl flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase border-2 border-dashed border-gray-100 italic">Análisis de Volumen en Revisión</div>;
const AreaChart = ({ children }: any) => <div>{children}</div>;
const Area = () => null;
const BarChart = ({ children }: any) => <div>{children}</div>;
const Bar = () => null;
const PieChart = ({ children }: any) => <div>{children}</div>;
const Pie = () => null;
const Cell = () => null;
const XAxis = () => null;
const YAxis = () => null;
const CartesianGrid = () => null;
const Tooltip = () => null;
const Legend = () => null;
import { formatMoney } from '../utils/dataHelpers';
import {
    TrendingUp, Calendar, CreditCard, Users, Filter,
    Package, Clock, Search, ChevronDown, ChevronRight,
    X, CheckCircle, Ban, ListFilter, AlertCircle, Zap, ArrowRightLeft, Eye, EyeOff, Trash2
} from 'lucide-react';
import { format, isWithinInterval } from 'date-fns';

interface Props {
    data: ExpenseRecord[];
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    selectedBranch: string;
    onSelectBranch: (branch: string) => void;
    onUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClear?: () => void;
    supplierCategories: Record<string, string>;
    setSupplierCategories: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899'];

export const ExpensesDashboard: React.FC<Props> = ({
    data,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    selectedBranch,
    onSelectBranch,
    onUpload,
    onClear,
    supplierCategories,
    setSupplierCategories
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [includedSuppliers, setIncludedSuppliers] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
    const [removeDuplicates, setRemoveDuplicates] = useState(false);

    // Acción para mover a servicios (nube)
    const moveToServices = async (supplier: string) => {
        if (!window.confirm(`¿Categorizar a "${supplier}" como Servicio?\nDejará de aparecer en este listado y se moverá al panel de Servicios.`)) return;

        const normalizedKey = supplier.trim().toUpperCase();
        const updated = { ...supplierCategories, [normalizedKey]: 'VARIOS' };
        setSupplierCategories(updated);
        await saveMetadata('service_categories', updated);
    };

    const suppliers = useMemo(() => {
        return Array.from(new Set(data.map(d => d.supplier))).sort();
    }, [data]);

    const months = useMemo(() => {
        const uniqueMonths = Array.from(new Set(data.map(d => d.monthYear))).sort().reverse();
        return uniqueMonths;
    }, [data]);

    const statuses = useMemo(() => {
        return Array.from(new Set(data.map(d => d.status))).sort();
    }, [data]);

    const filteredData = useMemo(() => {
        let result = data.filter(d => {
            // Exclude services ONLY (those with a category assigned)
            const isService = !!supplierCategories[d.supplier];
            if (isService) return false;

            const matchSearch = d.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (d.items || []).some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchBranch = selectedBranch === 'all' || d.branch.toLowerCase().includes(selectedBranch.toLowerCase());
            const matchMonth = selectedMonth === 'all' || d.monthYear === selectedMonth;
            const matchStatus = selectedStatus === 'all' || d.status === selectedStatus;

            let matchDate = true;
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59);
                matchDate = isWithinInterval(d.issueDate, { start, end });
            }

            const matchSupplier = includedSuppliers.length === 0 || includedSuppliers.includes(d.supplier);

            return matchSearch && matchBranch && matchMonth && matchDate && matchSupplier && matchStatus;
        });

        if (removeDuplicates) {
            const seen = new Map<string, ExpenseRecord>();
            result.forEach(d => {
                const dateKey = format(d.issueDate, 'yyyy-MM-dd');
                const dupKey = `${d.supplier}-${dateKey}-${d.amount.toFixed(2)}`;
                if (!seen.has(dupKey)) {
                    seen.set(dupKey, d);
                } else {
                    const existing = seen.get(dupKey)!;
                    if ((d.items?.length || 0) > (existing.items?.length || 0)) {
                        seen.set(dupKey, d);
                    }
                }
            });
            result = Array.from(seen.values());
        }

        return result;
    }, [data, searchTerm, selectedBranch, selectedMonth, selectedStatus, startDate, endDate, includedSuppliers, removeDuplicates, supplierCategories]);

    const stats = useMemo(() => {
        let gross = 0;
        let credits = 0;
        filteredData.forEach(d => {
            if (d.amount > 0) gross += d.amount;
            else credits += Math.abs(d.amount);
        });

        const total = gross - credits;
        const uniqueSuppliers = new Set(filteredData.map(d => d.supplier)).size;
        const totalItems = filteredData.reduce((acc, curr) => acc + (curr.items?.length || 0), 0);
        const pending = filteredData.filter(d => d.dueDate >= new Date() && d.status !== 'PAGADO').length;

        return { total, gross, credits, suppliers: uniqueSuppliers, totalItems, pending };
    }, [filteredData]);

    const supplierData = useMemo(() => {
        const groups: Record<string, number> = {};
        filteredData.forEach(d => {
            groups[d.supplier] = (groups[d.supplier] || 0) + d.amount;
        });
        return Object.entries(groups)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filteredData]);

    const monthlyEvolution = useMemo(() => {
        const groups: Record<string, number> = {};
        filteredData.forEach(d => {
            const key = d.monthYear;
            groups[key] = (groups[key] || 0) + d.amount;
        });
        return Object.entries(groups)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredData]);

    const toggleSupplier = (supplier: string) => {
        setIncludedSuppliers(prev =>
            prev.includes(supplier) ? prev.filter(s => s !== supplier) : [...prev, supplier]
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Search & Top Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por proveedor, código o producto..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${showFilters ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            <ListFilter className="w-4 h-4" />
                            Filtros Avanzados
                            {(includedSuppliers.length > 0 || selectedMonth !== 'all' || startDate !== '' || removeDuplicates) && (
                                <span className="bg-orange-500 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center animate-bounce ml-2">
                                    !
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-50 animate-in slide-in-from-top-2 duration-300">
                        {/* Month & Branch */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-wider">Período Mensual</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                >
                                    <option value="all">Todos los Meses</option>
                                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-wider">Sucursal</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-bold text-orange-700"
                                    value={selectedBranch}
                                    onChange={(e) => onSelectBranch(e.target.value)}
                                >
                                    <option value="all">Todas las Sucursales</option>
                                    <option value="FCIA BIOSALUD">FCIA BIOSALUD</option>
                                    <option value="CHACRAS">CHACRAS PARK</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-wider">Estado de Gasto</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-medium"
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                >
                                    <option value="all">Todos los Estados</option>
                                    {statuses.map(s => <option key={typeof s === 'object' ? (s as any).id : s} value={typeof s === 'object' ? (s as any).name : s}>
                                        {typeof s === 'object' ? (s as any).name : s}
                                    </option>)}
                                </select>
                            </div>
                        </div>

                        {/* Custom Date Range & Toggles */}
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-wider">Rango Personalizado</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    value={startDate}
                                    onChange={(e) => onStartDateChange(e.target.value)}
                                />
                                <input
                                    type="date"
                                    className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    value={endDate}
                                    onChange={(e) => onEndDateChange(e.target.value)}
                                />
                            </div>

                            {/* Panel de Opciones Avanzadas */}
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                                {/* Toggle Duplicados */}
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 ${removeDuplicates ? 'bg-orange-500' : 'bg-gray-300'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${removeDuplicates ? 'translate-x-4' : ''}`} />
                                        </div>
                                        <span className="text-xs font-bold text-gray-700">Eliminar Duplicados</span>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={removeDuplicates}
                                            onChange={() => setRemoveDuplicates(!removeDuplicates)}
                                        />
                                    </label>
                                </div>

                                <div className="border-t border-dashed border-gray-200"></div>

                                {/* This stray label was causing a syntax error. Removed. */}
                                {/* <label> */}
                                {/* </label> */}
                            </div>

                            <button
                                onClick={() => {
                                    onStartDateChange('');
                                    onEndDateChange('');
                                    setSelectedMonth('all');
                                    setSelectedStatus('all');
                                    setIncludedSuppliers([]);
                                    onSelectBranch('all');
                                    setRemoveDuplicates(false);
                                }}
                                className="text-xs text-orange-600 hover:underline font-medium block mt-2"
                            >
                                Limpiar todos los filtros
                            </button>
                        </div>

                        {/* Suppliers Multi-Select */}
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-wider">Proveedores ({includedSuppliers.length || 'Todos'})</label>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg h-[150px] overflow-y-auto p-2 space-y-1">
                                {suppliers.map(s => {
                                    const isService = !!supplierCategories[s.trim().toUpperCase()];
                                    return (
                                        <label key={s} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition-colors group">
                                            <input
                                                type="checkbox"
                                                checked={includedSuppliers.includes(s)}
                                                onChange={() => toggleSupplier(s)}
                                                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-4 h-4"
                                            />
                                            <span className={`text-xs truncate ${includedSuppliers.includes(s) ? 'font-bold text-orange-700' : 'text-gray-600'}`}>
                                                {s}
                                            </span>
                                            {/* Badge si es servicio */}
                                            {isService && (
                                                <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded ml-auto">
                                                    SERV
                                                </span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-orange-100 p-2 rounded-xl">
                            <TrendingUp className="w-6 h-6 text-orange-600" />
                        </div>
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full uppercase">
                            Bruto
                        </span>
                    </div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Inversión Bruta</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{formatMoney(stats.gross)}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-red-100 p-2 rounded-xl">
                            <Ban className="w-6 h-6 text-red-600" />
                        </div>
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full uppercase">
                            Ahorro
                        </span>
                    </div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Notas de Crédito</p>
                    <p className="text-2xl font-black text-red-600 mt-1">-{formatMoney(stats.credits)}</p>
                </div>

                <div className="bg-blue-600 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <CreditCard className="w-16 h-16 text-white" />
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                            <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-[10px] font-bold text-white bg-white/20 px-2 py-1 rounded-full uppercase">
                            Neto
                        </span>
                    </div>
                    <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider">Total a Pagar</p>
                    <p className="text-2xl font-black text-white mt-1">{formatMoney(stats.total)}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-blue-100 p-2 rounded-xl">
                            <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase">Proveedores</span>
                    </div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Entidades</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{stats.suppliers.toLocaleString()}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-green-100 p-2 rounded-xl">
                            <Calendar className="w-6 h-6 text-green-600" />
                        </div>
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase tracking-tighter text-center">Vencimientos</span>
                    </div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider font-mono">Próximos</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{stats.pending.toLocaleString()}</p>
                </div>
            </div >

            {/* Charts Grid */}
            < div className="grid grid-cols-1 lg:grid-cols-2 gap-6" >
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-orange-500" /> Evolución Mensual
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyEvolution}>
                                <defs>
                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(val: number) => formatMoney(val)} />
                                <Area type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Top Proveedores (Volumen $)</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={supplierData} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={150} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(val: number) => formatMoney(val)} />
                                <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div >

            {/* Invoices List with Details */}
            < div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-12" >
                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="font-bold text-gray-800">Listado de Comprobantes de Compra</h3>
                        <p className="text-xs text-gray-400">Haga clic en una fila para ver el desglose de productos</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {onClear && data.length > 0 && (
                            <button
                                onClick={onClear}
                                className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-full hover:bg-red-100 transition-all border border-red-100"
                            >
                                <Trash2 className="w-3 h-3" />
                                BORRAR TODO
                            </button>
                        )}
                        <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                            {filteredData.length} registros
                        </span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-gray-400 font-medium border-b border-gray-100 bg-white">
                                <th className="px-6 py-4">F. Emisión</th>
                                <th className="px-6 py-4">Proveedor</th>
                                <th className="px-6 py-4">Código</th>
                                <th className="px-6 py-4 text-right">Monto</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredData.map((record) => {
                                const isService = !!supplierCategories[record.supplier.trim().toUpperCase()];
                                return (
                                    <React.Fragment key={record.id}>
                                        <tr
                                            onClick={() => setExpandedInvoiceId(expandedInvoiceId === record.id ? null : record.id)}
                                            className={`hover:bg-orange-50/30 cursor-pointer transition-colors group ${expandedInvoiceId === record.id ? 'bg-orange-50/50' : ''} ${isService ? 'bg-blue-50/30' : ''}`}
                                        >
                                            <td className="px-6 py-4 text-gray-600 font-medium">{format(record.issueDate, 'dd/MM/yyyy')}</td>
                                            <td className="px-6 py-4 font-bold text-gray-900 group-hover:text-orange-600 flex items-center gap-2">
                                                {record.supplier}
                                                {/* Botón Mover VISIBLE POR DEFECTO para diagnósticos */}
                                                {!isService && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); moveToServices(record.supplier); }}
                                                        className="p-1.5 bg-gray-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 rounded transition-all ml-2"
                                                        title="Mover a Servicios (Gastos)"
                                                    >
                                                        <ArrowRightLeft className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {isService && (
                                                    <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded border border-blue-200 uppercase ml-2">
                                                        SERV
                                                    </span>
                                                )}
                                                {(record.items?.length || 0) > 0 && <span className="bg-blue-50 text-blue-600 text-[10px] px-1.5 rounded-full border border-blue-100 ml-1">{record.items?.length} ítems</span>}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono text-gray-400">{record.code}</td>
                                            <td className="px-6 py-4 text-right font-black text-gray-800">{formatMoney(record.amount)}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${record.status === 'INGRESADO' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                    record.status === 'PAGADO' ? 'bg-green-50 text-green-600 border border-green-100' :
                                                        'bg-gray-50 text-gray-600 border border-gray-100'
                                                    }`}>
                                                    {typeof record.status === 'object' ? (record.status as any).name || (record.status as any).description : record.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-300">
                                                {expandedInvoiceId === record.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </td>
                                        </tr>
                                        {expandedInvoiceId === record.id && (
                                            <tr>
                                                <td colSpan={6} className="bg-gray-50/80 p-0 overflow-hidden">
                                                    <div className="p-6 border-b border-gray-100 animate-in slide-in-from-top-1 duration-200">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <Package className="w-5 h-5 text-orange-500" />
                                                            <h4 className="font-bold text-gray-700">Detalle de Productos</h4>
                                                        </div>
                                                        {(!record.items || record.items.length === 0) ? (
                                                            <div className="p-4 bg-white rounded-lg border border-dashed border-gray-200 text-center text-gray-400 text-xs shadow-sm">
                                                                No hay detalle de productos disponible para este comprobante.
                                                            </div>
                                                        ) : (
                                                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                                                <table className="w-full text-xs">
                                                                    <thead className="bg-gray-50 text-gray-500 uppercase font-bold">
                                                                        <tr>
                                                                            <th className="px-4 py-3 text-left">Ítem / Medicamento</th>
                                                                            <th className="px-4 py-3 text-right">Cant.</th>
                                                                            <th className="px-4 py-3 text-right">Precio Unit.</th>
                                                                            <th className="px-4 py-3 text-right">Subtotal</th>
                                                                            <th className="px-4 py-3 text-left">Marca / Lab.</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100">
                                                                        {record.items.map((item, idx) => (
                                                                            <tr key={idx} className="hover:bg-gray-50">
                                                                                <td className="px-4 py-3 font-semibold text-gray-800">{item.name}</td>
                                                                                <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                                                                                <td className="px-4 py-3 text-right text-gray-600">{formatMoney(item.price)}</td>
                                                                                <td className="px-4 py-3 text-right font-bold text-gray-900">{formatMoney(item.quantity * item.price)}</td>
                                                                                <td className="px-4 py-3 text-gray-500 italic whitespace-nowrap">{item.manufacturer}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                    <tfoot className="bg-orange-50/50">
                                                                        <tr className="font-bold text-orange-900">
                                                                            <td className="px-4 py-3 text-right">TOTAL DETALLADO</td>
                                                                            <td className="px-4 py-3 text-right">{record.items?.reduce((a, b) => a + b.quantity, 0) || 0}</td>
                                                                            <td></td>
                                                                            <td className="px-4 py-3 text-right text-orange-700 italic">{formatMoney(record.items?.reduce((a, b) => a + (b.quantity * b.price), 0) || 0)}</td>
                                                                            <td></td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div >
        </div >
    );
};
