import React, { useMemo, useState, useEffect } from 'react';
import { ExpenseRecord, ExpenseItem } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { formatMoney } from '../utils/dataHelpers';
import {
    TrendingUp, Calendar, CreditCard, Users, Filter,
    Package, Clock, Search, ChevronDown, ChevronRight,
    X, CheckCircle, Ban, ListFilter, AlertCircle, Lightbulb, Droplets, Zap, FileText
} from 'lucide-react';
import { format, isWithinInterval } from 'date-fns';
import { getMetadata, saveMetadata } from '../utils/db';

interface Props {
    data: ExpenseRecord[];
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
}

const COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#ef4444', '#f59e0b', '#f97316', '#ec4899'];

export const ServicesDashboard: React.FC<Props> = ({
    data,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    // const [startDate, setStartDate] = useState('');
    // const [endDate, setEndDate] = useState('');
    const [includedSuppliers, setIncludedSuppliers] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

    // Nueva funcionalidad de categorización (Nube)
    const [supplierCategories, setSupplierCategories] = useState<Record<string, string>>({});
    const [newCategoryName, setNewCategoryName] = useState('');

    useEffect(() => {
        const loadCategories = async () => {
            const data = await getMetadata('service_categories');
            if (data) setSupplierCategories(data);
        };
        loadCategories();
    }, []);

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
        return data.filter(d => {
            const category = supplierCategories[d.supplier] || '';
            const matchSearch = d.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                category.toLowerCase().includes(searchTerm.toLowerCase());

            const matchBranch = selectedBranch === 'all' || d.branch === selectedBranch;
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
    }, [data, searchTerm, selectedBranch, selectedMonth, selectedStatus, startDate, endDate, includedSuppliers]);

    const stats = useMemo(() => {
        let gross = 0;
        let paid = 0;
        filteredData.forEach(d => {
            gross += d.amount;
            if (d.status === 'PAGADO') paid += d.amount;
        });

        const uniqueSuppliers = new Set(filteredData.map(d => d.supplier)).size;
        const pending = filteredData.filter(d => d.status !== 'PAGADO').length;

        return { gross, paid, suppliers: uniqueSuppliers, pending };
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

    const branches = useMemo(() => {
        return Array.from(new Set(data.map(d => d.branch))).sort();
    }, [data]);

    const toggleSupplier = (supplier: string) => {
        setIncludedSuppliers(prev =>
            prev.includes(supplier) ? prev.filter(s => s !== supplier) : [...prev, supplier]
        );
    };

    const handleAssignCategory = () => {
        if (!newCategoryName.trim() || includedSuppliers.length === 0) return;

        const updated = { ...supplierCategories };
        includedSuppliers.forEach(s => {
            updated[s] = newCategoryName.trim().toUpperCase();
        });

        setSupplierCategories(updated);
        saveMetadata('service_categories', updated);
        setNewCategoryName('');
        // No limpiamos includedSuppliers para que el usuario vea qué cambió, o sí?
        // Decidimos no limpiarlos para que pueda aplicar otra categoría si quiere
    };

    const clearCategory = (supplier: string) => {
        const updated = { ...supplierCategories };
        delete updated[supplier];
        setSupplierCategories(updated);
        saveMetadata('service_categories', updated);
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
                            placeholder="Buscar servicio, proveedor o código..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${showFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            <ListFilter className="w-4 h-4" />
                            Filtros de Servicios
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-50 animate-in slide-in-from-top-2 duration-300">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase mb-2 block tracking-wider">Período</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-gray-700"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                >
                                    <option value="all">Todos los Meses</option>
                                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase mb-2 block tracking-wider">Sucursal</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-gray-700"
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                >
                                    <option value="all">Todas las Sucursales</option>
                                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase mb-2 block tracking-wider">Estado de Pago</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-gray-700"
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                >
                                    <option value="all">Todos los Estados</option>
                                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-xs font-black text-gray-400 uppercase mb-2 block tracking-wider">Rango de Fechas</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    value={startDate}
                                    onChange={(e) => onStartDateChange(e.target.value)}
                                />
                                <input
                                    type="date"
                                    className="bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    value={endDate}
                                    onChange={(e) => onEndDateChange(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => {
                                    onStartDateChange('');
                                    onEndDateChange('');
                                    setSelectedMonth('all');
                                    setSelectedStatus('all');
                                    setIncludedSuppliers([]);
                                    setSelectedBranch('all');
                                }}
                                className="text-xs text-blue-600 hover:underline font-bold block mt-2"
                            >
                                Reestablecer filtros
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black text-gray-400 uppercase block tracking-wider">Entidades ({includedSuppliers.length || 'Todas'})</label>
                                {includedSuppliers.length > 0 && (
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            placeholder="CATEGORÍA (GAS, LUZ...)"
                                            className="text-[10px] px-2 py-1 border rounded bg-white font-bold"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAssignCategory()}
                                        />
                                        <button
                                            onClick={handleAssignCategory}
                                            className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700 transition-colors"
                                            title="Asignar Categoría"
                                        >
                                            <CheckCircle className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg h-[150px] overflow-y-auto p-2 space-y-1">
                                {suppliers.map(s => (
                                    <div key={s} className="flex items-center justify-between p-1.5 hover:bg-white rounded cursor-pointer transition-colors group">
                                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={includedSuppliers.includes(s)}
                                                onChange={() => toggleSupplier(s)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                            />
                                            <span className={`text-xs truncate ${includedSuppliers.includes(s) ? 'font-black text-blue-700' : 'text-gray-600'}`}>{s}</span>
                                        </label>
                                        {supplierCategories[s] && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-black border border-blue-200 uppercase whitespace-nowrap">
                                                    {supplierCategories[s]}
                                                </span>
                                                <button onClick={() => clearCategory(s)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p className="text-[9px] text-gray-400 italic">Marca los que quieras agrupar, escribe el nombre arriba (ej: GAS) y presiona el botón azul.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-blue-100 p-2 rounded-xl">
                            <Zap className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase">Total</span>
                    </div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Gasto Global Servicios</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{formatMoney(stats.gross)}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-green-100 p-2 rounded-xl">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase">Liquidado</span>
                    </div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Pagado</p>
                    <p className="text-2xl font-black text-green-600 mt-1">{formatMoney(stats.paid)}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-orange-100 p-2 rounded-xl">
                            <Clock className="w-6 h-6 text-orange-600" />
                        </div>
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full uppercase">Pendiente</span>
                    </div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Comprobantes a Pagar</p>
                    <p className="text-2xl font-black text-orange-600 mt-1">{stats.pending}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-purple-100 p-2 rounded-xl">
                            <Users className="w-6 h-6 text-purple-600" />
                        </div>
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-full uppercase">Entidades</span>
                    </div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Proveedores Ext.</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{stats.suppliers}</p>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-500" /> Histórico de Gastos
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyEvolution}>
                                <defs>
                                    <linearGradient id="colorSer" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} formatter={(val: number) => formatMoney(val)} />
                                <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSer)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-yellow-500" /> Distribución por Proveedor
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={supplierData} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={150} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} formatter={(val: number) => formatMoney(val)} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Services List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-12">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" /> Comprobantes de Servicios
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-gray-400 font-medium border-b border-gray-100 bg-white">
                                <th className="px-6 py-4">F. Emisión</th>
                                <th className="px-6 py-4">Proveedor / Concepto</th>
                                <th className="px-6 py-4">Referencia</th>
                                <th className="px-6 py-4 text-right">Importe</th>
                                <th className="px-6 py-4">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredData.map((record) => (
                                <tr key={record.id} className="hover:bg-blue-50/20 transition-colors group">
                                    <td className="px-6 py-4 text-gray-600">{format(record.issueDate, 'dd/MM/yyyy')}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900">
                                        <div className="flex flex-col">
                                            <span>{record.supplier}</span>
                                            {supplierCategories[record.supplier] && (
                                                <span className="text-[10px] text-blue-500 font-black uppercase tracking-tighter">
                                                    #{supplierCategories[record.supplier]}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-mono text-gray-400">{record.code}</td>
                                    <td className="px-6 py-4 text-right font-black text-gray-800">{formatMoney(record.amount)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${record.status === 'PAGADO' ? 'bg-green-50 text-green-600 border border-green-100' :
                                            'bg-orange-50 text-orange-600 border border-orange-100'
                                            }`}>
                                            {record.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
