import React, { useMemo, useState } from 'react';
import { InsuranceRecord, ExpenseItem } from '../types';
// Recharts purged
import { formatMoney } from '../utils/dataHelpers';
import {
    ShieldCheck, Calendar, Filter, Search, ChevronDown, ChevronRight,
    Package, TrendingUp, CheckCircle, Clock, ListFilter, Download, Plus, FileSpreadsheet
} from 'lucide-react';
import { format, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

interface InsuranceDashboardProps {
    data: InsuranceRecord[];
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    onUploadInsurance: () => void;
}

export const InsuranceDashboard: React.FC<InsuranceDashboardProps> = ({
    data,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    onUploadInsurance
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

    const filteredData = useMemo(() => {
        return (data || []).filter(d => {
            const matchSearch = d.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (d.items || []).some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

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

            return matchSearch && matchBranch && matchMonth && matchStatus && matchDate;
        });
    }, [data, searchTerm, selectedBranch, selectedMonth, selectedStatus, startDate, endDate]);

    const stats = useMemo(() => {
        const total = filteredData.reduce((acc, curr) => acc + curr.amount, 0);
        const uniqueEntities = new Set(filteredData.map(d => d.entity)).size;
        const totalItems = filteredData.reduce((acc, curr) => acc + (curr.items?.length || 0), 0);
        const pendingValue = filteredData.filter(d => d.status !== 'LIQUIDADO').reduce((acc, curr) => acc + curr.amount, 0);

        return { total, entities: uniqueEntities, totalItems, pendingValue };
    }, [filteredData]);

    const entityChartData = useMemo(() => {
        const groups: Record<string, number> = {};
        filteredData.forEach(d => {
            groups[d.entity] = (groups[d.entity] || 0) + d.amount;
        });
        return Object.entries(groups)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filteredData]);

    const exportToCSV = () => {
        if (filteredData.length === 0) return;

        let csvContent = "Entidad,Fecha,Codigo,Monto,Sucursal,Estado,Item,Cantidad,Precio\n";
        filteredData.forEach(d => {
            if (d.items && d.items.length > 0) {
                d.items.forEach(item => {
                    csvContent += `"${d.entity}","${format(d.issueDate, 'dd/MM/yyyy')}","${d.code}","${d.amount}","${d.branch}","${d.status}","${item.name}","${item.quantity}","${item.price}"\n`;
                });
            } else {
                csvContent += `"${d.entity}","${format(d.issueDate, 'dd/MM/yyyy')}","${d.code}","${d.amount}","${d.branch}","${d.status}","","",""\n`;
            }
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `BioSalud_ObrasSociales_${format(new Date(), 'yyyyMMdd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header section with Reference and Action Botton */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-3xl font-black tracking-tighter text-rose-900">Módulo de Obras Sociales</h2>
                    <p className="text-slate-500 text-sm font-medium">Gestión de liquidaciones y validaciones de recetas</p>
                    <div className="flex items-center gap-2 mt-2 bg-rose-50 border border-rose-100 px-3 py-1 rounded-full w-fit">
                        <span className="text-[10px] font-black text-rose-600 uppercase">Referencia: Extracción MENU 4.5.2</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onUploadInsurance}
                        className="bg-rose-600 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-rose-700 transition-all flex items-center gap-2 shadow-lg shadow-rose-200"
                    >
                        <Plus className="w-4 h-4" /> Agregar Recetas (4.5.2)
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-sm font-black hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" /> Exportar CVS Parseado
                    </button>
                </div>
            </div>

            {/* Instruction Steps */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { step: 1, text: "Elegir todos los tipos de valores asociados" },
                    { step: 2, text: "Elegir fecha de emisión" },
                    { step: 3, text: "Tildar: Mostrar Operaciones / Items / Por Nodo" },
                    { step: 4, text: "Cargar CSV en BioSalud Live" }
                ].map((s) => (
                    <div key={s.step} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">{s.step}</div>
                        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{s.text}</p>
                    </div>
                ))}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-rose-100 p-2 rounded-xl"><ShieldCheck className="w-6 h-6 text-rose-600" /></div>
                        <span className="text-[10px] font-black text-rose-600">TOTAL</span>
                    </div>
                    <p className="text-gray-500 text-xs font-bold uppercase">Monto Bruto Recetas</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{formatMoney(stats.total)}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-blue-100 p-2 rounded-xl"><Package className="w-6 h-6 text-blue-600" /></div>
                        <span className="text-[10px] font-black text-blue-600">ITEMS</span>
                    </div>
                    <p className="text-gray-500 text-xs font-bold uppercase">Medicamentos Validados</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalItems.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-amber-100 p-2 rounded-xl"><Clock className="w-6 h-6 text-amber-600" /></div>
                        <span className="text-[10px] font-black text-amber-600">PENDIENTE</span>
                    </div>
                    <p className="text-gray-500 text-xs font-bold uppercase">Monto por Liquidar</p>
                    <p className="text-2xl font-black text-amber-600 mt-1">{formatMoney(stats.pendingValue)}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="bg-emerald-100 p-2 rounded-xl"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
                        <span className="text-[10px] font-black text-emerald-600">ENTIDADES</span>
                    </div>
                    <p className="text-gray-500 text-xs font-bold uppercase">Obras Sociales Activas</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{stats.entities}</p>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar receta, entidad o medicamento..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${showFilters ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        <ListFilter className="w-4 h-4" /> Filtros
                    </button>
                </div>
                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-50 animate-in slide-in-from-top-2">
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase mb-2 block tracking-wider">Fecha Emisión</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs" />
                                <input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase mb-2 block tracking-wider">Sucursal</label>
                            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs">
                                <option value="all">Todas las Sucursales</option>
                                {Array.from(new Set((data || []).map(d => d.branch))).map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase mb-2 block tracking-wider">Estado Trámite</label>
                            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs">
                                <option value="all">Todos los Estados</option>
                                {Array.from(new Set((data || []).map(d => d.status))).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* List Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden pb-12">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-black text-slate-800 uppercase tracking-tighter">Detalle de Operaciones</h3>
                    <span className="text-[10px] bg-rose-50 text-rose-600 px-2 py-1 rounded-lg font-black">{filteredData.length} TRÁMITES</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-slate-400 font-bold border-b border-slate-100 bg-white">
                                <th className="px-6 py-4">F. EMISIÓN</th>
                                <th className="px-6 py-4">ENTIDAD (O.S)</th>
                                <th className="px-6 py-4">COMPROBANTE</th>
                                <th className="px-6 py-4 text-right">MONTO</th>
                                <th className="px-6 py-4">ESTADO</th>
                                <th className="px-6 py-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredData.map((record) => (
                                <React.Fragment key={record.id}>
                                    <tr
                                        onClick={() => setExpandedRecordId(expandedRecordId === record.id ? null : record.id)}
                                        className={`hover:bg-rose-50/30 cursor-pointer transition-colors group ${expandedRecordId === record.id ? 'bg-rose-50/50' : ''}`}
                                    >
                                        <td className="px-6 py-4 text-slate-600 font-bold">{format(record.issueDate, 'dd/MM/yyyy')}</td>
                                        <td className="px-6 py-4 font-black text-slate-900 group-hover:text-rose-600 transition-colors uppercase italic">{record.entity}</td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-400 tracking-tighter">{record.code}</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-800">{formatMoney(record.amount)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${record.status === 'INGRESADO' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                record.status === 'LIQUIDADO' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                    'bg-slate-50 text-slate-500'}`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {expandedRecordId === record.id ? <ChevronDown className="w-4 h-4 text-rose-300" /> : <ChevronRight className="w-4 h-4 text-slate-200" />}
                                        </td>
                                    </tr>
                                    {expandedRecordId === record.id && (
                                        <tr>
                                            <td colSpan={6} className="bg-slate-50/50 p-6 animate-in slide-in-from-top-1">
                                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                                    <div className="p-4 bg-slate-900 flex justify-between items-center">
                                                        <span className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-2"><Package className="w-4 h-4 text-rose-500" /> Detalle Medicamentos</span>
                                                        <div className="flex gap-4">
                                                            <span className="text-[10px] text-rose-200 font-bold uppercase">A Cargo OS: {formatMoney(record.discountEntity || 0)}</span>
                                                            <span className="text-[10px] text-emerald-200 font-bold uppercase">A Cargo Paciente: {formatMoney(record.discountClient || 0)}</span>
                                                            <span className="text-[10px] text-white font-black uppercase border-l border-slate-700 pl-4">Total Receta: {formatMoney(record.totalVoucher || 0)}</span>
                                                        </div>
                                                    </div>
                                                    <table className="w-full text-[11px]">
                                                        <thead className="bg-slate-50 text-slate-400 font-black uppercase">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left">Producto</th>
                                                                <th className="px-4 py-3 text-right">Cant.</th>
                                                                <th className="px-4 py-3 text-right">P. Lista</th>
                                                                <th className="px-4 py-3 text-right">Bonif. OS</th>
                                                                <th className="px-4 py-3 text-right">A Cargo Pac.</th>
                                                                <th className="px-4 py-3 text-left">Laboratorio</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {(record.items || []).map((item, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-50 font-bold text-slate-700">
                                                                    <td className="px-4 py-3 italic">{item.name}</td>
                                                                    <td className="px-4 py-3 text-right">{item.quantity}</td>
                                                                    <td className="px-4 py-3 text-right">{formatMoney(item.price)}</td>
                                                                    <td className="px-4 py-3 text-right text-rose-600">{formatMoney(item.discountEntity || 0)}</td>
                                                                    <td className="px-4 py-3 text-right text-emerald-600">{formatMoney(item.discountClient || 0)}</td>
                                                                    <td className="px-4 py-3 text-slate-400">{item.manufacturer}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
