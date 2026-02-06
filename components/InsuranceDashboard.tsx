import React, { useMemo, useState, useEffect } from 'react';
import { DebtImporter } from './DebtImporter';
import { ManualDebtEntry } from './ManualDebtEntry';
import { InsuranceRecord } from '../types';
import { formatMoney } from '../utils/dataHelpers';
import {
    ShieldCheck, Calendar, Filter, Search, ChevronDown, ChevronRight,
    Package, TrendingUp, CheckCircle, Clock, ListFilter, Download, Plus, FileSpreadsheet, Trash2, Upload, AlertCircle, XCircle,
    UserPlus
} from 'lucide-react';
import { format, isWithinInterval, differenceInDays } from 'date-fns';

interface InsuranceDashboardProps {
    data: InsuranceRecord[];
    startDate: string;
    endDate: string;
    selectedBranch: string; // From App.tsx global state
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    onImportData: (records: InsuranceRecord[]) => void;
    onClearManualData?: () => void;
}

export const InsuranceDashboard: React.FC<InsuranceDashboardProps> = ({
    data,
    startDate,
    endDate,
    selectedBranch: globalBranch,
    onStartDateChange,
    onEndDateChange,
    onImportData,
    onClearManualData
}) => {
    const [selectedOS, setSelectedOS] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [internalBranch, setInternalBranch] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [showFilters, setShowFilters] = useState(true);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
    const [showImporter, setShowImporter] = useState(false);
    const [showManualEntry, setShowManualEntry] = useState(false);

    const [displayLimit, setDisplayLimit] = useState(10); // Pagination limit

    // Sync internal branch with global branch
    useEffect(() => {
        if (globalBranch && globalBranch !== 'TODAS SUCURSALES') {
            // Map global branch names to simpler internal names if needed
            const normGlobal = globalBranch.toUpperCase();
            if (normGlobal.includes('CHACRAS')) setInternalBranch('CHACRAS');
            else if (normGlobal.includes('BIOSALUD')) setInternalBranch('FCIA BIOSALUD');
            else setInternalBranch(globalBranch);
        } else {
            setInternalBranch('all');
        }
    }, [globalBranch]);

    // Filter Logic
    const filteredData = useMemo(() => {
        return (data || []).filter(d => {
            const matchSearch = d.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (d.plan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (d.items || []).some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

            // Normalize branch matching
            let matchBranch = internalBranch === 'all';
            if (!matchBranch) {
                const normInternal = internalBranch.toUpperCase();
                const normRecord = (d.branch || '').toUpperCase();
                // Check if one contains the other
                matchBranch = normRecord.includes(normInternal) || normInternal.includes(normRecord);
            }

            const matchOS = selectedOS === 'all' || d.entity === selectedOS;
            const matchStatus = selectedStatus === 'all' || d.status === selectedStatus;

            let matchDate = true;
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59);
                matchDate = isWithinInterval(d.issueDate, { start, end });
            }

            return matchSearch && matchBranch && matchOS && matchStatus && matchDate;
        });
    }, [data, searchTerm, internalBranch, selectedOS, selectedStatus, startDate, endDate]);

    // Calculate Debt Stats by Entity (For Cards)
    const entityDebtStats = useMemo(() => {
        const stats: Record<string, { name: string, totalDebt: number, overdueDebt: number, count: number, maxDaysOverdue: number }> = {};

        filteredData.forEach(d => {
            if (d.status === 'LIQUIDADO') return;

            if (!stats[d.entity]) {
                stats[d.entity] = { name: d.entity, totalDebt: 0, overdueDebt: 0, count: 0, maxDaysOverdue: 0 };
            }
            stats[d.entity].totalDebt += d.amount;
            stats[d.entity].count += 1;

            const days = differenceInDays(new Date(), d.issueDate);
            if (days > 30) {
                stats[d.entity].overdueDebt += d.amount;
            }

            if (days > stats[d.entity].maxDaysOverdue) {
                stats[d.entity].maxDaysOverdue = days;
            }
        });

        return Object.values(stats).sort((a, b) => b.totalDebt - a.totalDebt);
    }, [filteredData]);

    const stats = useMemo(() => {
        const totalOS = filteredData.reduce((acc, curr) => acc + curr.amount, 0);
        const totalPatient = filteredData.reduce((acc, curr) => acc + (curr.patientAmount || 0), 0);
        const uniqueEntities = new Set(filteredData.map(d => d.entity)).size;
        const totalItems = filteredData.reduce((acc, curr) => acc + (curr.items?.length || 0), 0);
        const pendingValue = filteredData.filter(d => d.status !== 'LIQUIDADO').reduce((acc, curr) => acc + curr.amount, 0);

        return { totalOS, totalPatient, entities: uniqueEntities, totalItems, pendingValue };
    }, [filteredData]);

    const exportToCSV = () => {
        if (filteredData.length === 0) return;

        let csvContent = "Entidad,Fecha,Codigo,Monto,Sucursal,Estado,Item\n";
        filteredData.forEach(d => {
            csvContent += `"${d.entity}","${format(d.issueDate, 'dd/MM/yyyy')}","${d.code}","${d.amount}","${d.branch}","${d.status}","${d.plan || ''}"\n`;
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

    const paginatedData = useMemo(() => {
        return [...filteredData].sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime()).slice(0, displayLimit);
    }, [filteredData, displayLimit]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {showImporter && (
                <DebtImporter
                    onClose={() => setShowImporter(false)}
                    onImport={(recs) => { onImportData(recs); setShowImporter(false); }}
                />
            )}
            {showManualEntry && (
                <ManualDebtEntry
                    onClose={() => setShowManualEntry(false)}
                    onSave={(recs) => { onImportData(recs); setShowManualEntry(false); }}
                />
            )}

            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-3xl font-black tracking-tighter text-rose-900">Módulo de Obras Sociales</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${globalBranch === 'TODAS SUCURSALES' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                            {globalBranch || 'TODAS SUCURSALES'}
                        </span>
                        <p className="text-slate-500 text-xs font-medium">Gestión de Cobranzas y Auditoría Real</p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setShowManualEntry(true)}
                        className="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-xs font-black hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                    >
                        <UserPlus className="w-4 h-4" /> Agregar manual
                    </button>
                    <button
                        onClick={() => setShowImporter(true)}
                        className="bg-slate-900 text-white px-5 py-3 rounded-2xl text-xs font-black hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
                    >
                        <Upload className="w-4 h-4" /> Importar CSV
                    </button>
                    {onClearManualData && (
                        <button
                            onClick={onClearManualData}
                            className="bg-red-50 text-red-600 px-4 py-3 rounded-2xl text-xs font-black hover:bg-red-100 transition-all flex items-center gap-2 border border-red-100"
                        >
                            <Trash2 className="w-4 h-4" /> Borrar Manual
                        </button>
                    )}
                    <button
                        onClick={exportToCSV}
                        className="bg-rose-50 text-rose-600 px-4 py-3 rounded-2xl text-xs font-black hover:bg-rose-100 transition-all flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" /> CSV
                    </button>
                </div>
            </div>

            {/* Global Stats - Compact */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-rose-600 p-5 rounded-3xl shadow-xl shadow-rose-200 border border-rose-500 flex flex-col items-center text-center group hover:scale-105 transition-all">
                    <span className="text-[10px] uppercase font-black text-rose-100 tracking-widest mb-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Total Vencido (+30d)
                    </span>
                    <span className="text-3xl font-black text-white leading-none">
                        {formatMoney(entityDebtStats.reduce((acc, curr) => acc + curr.overdueDebt, 0))}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Deuda Total</span>
                    <span className="text-2xl font-black text-slate-900 leading-none">{formatMoney(stats.pendingValue)}</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Monto Procesado</span>
                    <span className="text-2xl font-black text-slate-700 leading-none">{formatMoney(stats.totalOS)}</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Entidades Activas</span>
                    <span className="text-2xl font-black text-indigo-600 leading-none">{stats.entities}</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Items Validados</span>
                    <span className="text-2xl font-black text-emerald-600 leading-none">{stats.totalItems}</span>
                </div>
            </div>

            {/* Entity Debt Cards (Horizontal Scroll) */}
            <div className="overflow-x-auto pb-6 custom-scrollbar">
                <div className="flex gap-4 min-w-max">
                    {entityDebtStats.map(stat => {
                        let statusColor = 'bg-emerald-50 border-emerald-100 text-emerald-700';
                        let icon = <CheckCircle className="w-5 h-5 text-emerald-500" />;

                        if (stat.maxDaysOverdue > 60) {
                            statusColor = 'bg-red-50 border-red-100 text-red-700';
                            icon = <AlertCircle className="w-5 h-5 text-red-500" />;
                        } else if (stat.maxDaysOverdue > 30) {
                            statusColor = 'bg-amber-50 border-amber-100 text-amber-700';
                            icon = <Clock className="w-5 h-5 text-amber-500" />;
                        }

                        const isSelected = selectedOS === stat.name;

                        return (
                            <button
                                key={stat.name}
                                onClick={() => setSelectedOS(isSelected ? 'all' : stat.name)}
                                className={`p-4 rounded-3xl border transition-all text-left min-w-[240px] flex flex-col gap-3 relative
                                       ${isSelected ? 'ring-4 ring-rose-500/20 border-rose-500 scale-105' : 'hover:scale-105 shadow-sm'}
                                       ${statusColor} border
                                   `}
                            >
                                <div className="flex justify-between items-start w-full gap-2">
                                    <span className="font-black text-[11px] uppercase truncate flex-1 block" title={stat.name}>{stat.name}</span>
                                    {icon}
                                </div>

                                <div className="space-y-1">
                                    <div className="flex flex-col">
                                        <p className="text-[10px] opacity-70 font-black uppercase tracking-tighter">Deuda Vencida</p>
                                        <p className="text-2xl font-black tracking-tight leading-none">{formatMoney(stat.overdueDebt)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1 border-t border-white/30">
                                        <p className="text-[10px] opacity-60 font-bold">Total por Cobrar:</p>
                                        <p className="text-[12px] font-black">{formatMoney(stat.totalDebt)}</p>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <span className="text-[9px] bg-white/40 px-2 py-1 rounded-lg font-black uppercase">
                                        {stat.count} comp.
                                    </span>
                                    <span className="text-[9px] bg-white/40 px-2 py-1 rounded-lg font-black uppercase">
                                        {stat.maxDaysOverdue} días de atraso
                                    </span>
                                </div>

                                {isSelected && <div className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-sm" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-5">
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-6 py-2 rounded-2xl text-xs font-black transition-all ${showFilters ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        <ListFilter className="w-4 h-4" /> {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros Avanzados'}
                    </button>
                    {(selectedOS !== 'all' || internalBranch !== 'all' || selectedStatus !== 'all' || searchTerm) && (
                        <button
                            onClick={() => { setSelectedOS('all'); setInternalBranch('all'); setSelectedStatus('all'); setSearchTerm(''); }}
                            className="text-[10px] font-black text-rose-600 uppercase flex items-center gap-1 hover:text-rose-800 transition-colors bg-rose-50 px-4 py-2 rounded-xl"
                        >
                            <XCircle className="w-4 h-4" /> Limpiar Todo
                        </button>
                    )}
                </div>

                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-2 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Buscador</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Receta, O.S..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Fechas emisión</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] font-black" />
                                <input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] font-black" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Sucursal</label>
                            <select value={internalBranch} onChange={(e) => setInternalBranch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-black uppercase">
                                <option value="all">Todas</option>
                                <option value="FCIA BIOSALUD">Fcia Biosalud (Paseo)</option>
                                <option value="CHACRAS">Chacras Park</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Estado</label>
                            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-black uppercase">
                                <option value="all">Todos los estados</option>
                                <option value="PENDIENTE DE COBRO">PENDIENTE</option>
                                <option value="PAGO PARCIAL">PAGO PARCIAL</option>
                                <option value="LIQUIDADO">LIQUIDADO</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* List Table */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden pb-6">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-black text-slate-800 uppercase tracking-tighter text-sm">Detalle de Operaciones</h3>
                    <span className="text-[10px] bg-rose-50 text-rose-600 px-3 py-1.5 rounded-xl font-black">
                        MOSTRANDO {Math.min(displayLimit, filteredData.length)} DE {filteredData.length} TRÁMITES
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="text-slate-400 font-black border-b border-slate-100 bg-white text-[10px] uppercase tracking-widest">
                                <th className="px-6 py-5">F. Emisión</th>
                                <th className="px-6 py-5">Entidad</th>
                                <th className="px-6 py-5">Detalle / Plan</th>
                                <th className="px-6 py-5 text-right">Total Pres.</th>
                                <th className="px-6 py-5 text-right">Saldo Deuda</th>
                                <th className="px-6 py-5 text-center">Antigüedad</th>
                                <th className="px-6 py-5 text-center">Estado</th>
                                <th className="px-6 py-5 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {paginatedData.map((record) => {
                                const daysOld = differenceInDays(new Date(), record.issueDate);
                                let antiquityColor = 'text-emerald-700';
                                if (daysOld > 60) antiquityColor = 'text-red-600 font-black';
                                else if (daysOld > 30) antiquityColor = 'text-amber-600 font-bold';

                                return (
                                    <React.Fragment key={record.id}>
                                        <tr
                                            onClick={() => setExpandedRecordId(expandedRecordId === record.id ? null : record.id)}
                                            className={`hover:bg-rose-50/30 cursor-pointer transition-all group ${expandedRecordId === record.id ? 'bg-rose-50/50' : ''}`}
                                        >
                                            <td className="px-6 py-5 text-slate-500 font-bold text-xs">{format(record.issueDate, 'dd/MM/yyyy')}</td>
                                            <td className="px-6 py-5 font-black text-slate-900 group-hover:text-rose-600 transition-colors uppercase italic text-xs tracking-tight">{record.entity}</td>
                                            <td className="px-6 py-5 text-xs font-bold text-slate-500 max-w-[200px] truncate" title={record.plan || (record.items.length > 0 ? record.items.map(i => i.name).join(', ') : '')}>
                                                {record.type === 'DEUDA_HISTORICA' ? (
                                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black mr-2 uppercase">Manual</span>
                                                ) : (
                                                    <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded text-[10px] font-black mr-2 uppercase">Sistema</span>
                                                )}
                                                {record.type === 'DEUDA_HISTORICA' ? (record.plan || '-') : (record.items.length > 0 ? `${record.items.length} medicamentos` : '-')}
                                            </td>
                                            <td className="px-6 py-5 text-right font-bold text-slate-400 text-xs">{formatMoney(record.totalVoucher || record.amount)}</td>
                                            <td className="px-6 py-5 text-right font-black text-rose-600 text-base">{formatMoney(record.amount)}</td>
                                            <td className={`px-6 py-5 text-center text-xs ${antiquityColor}`}>
                                                {daysOld} días
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter border ${record.status === 'INGRESADO' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                    record.status === 'LIQUIDADO' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                        'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                {expandedRecordId === record.id ? <ChevronDown className="w-5 h-5 text-rose-300" /> : <ChevronRight className="w-5 h-5 text-slate-200" />}
                                            </td>
                                        </tr>
                                        {expandedRecordId === record.id && (
                                            <tr>
                                                <td colSpan={8} className="bg-slate-50/50 p-8 animate-in slide-in-from-top-1">
                                                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                                                        {record.type === 'DEUDA_HISTORICA' ? (
                                                            <div className="p-10 text-center flex flex-col items-center gap-3">
                                                                <FileSpreadsheet className="w-10 h-10 text-slate-100" />
                                                                <p className="text-slate-500 text-sm font-medium italic">Registro importado manualmente de CSV o carga directa.</p>
                                                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Referencia: {record.plan || 'Sin descripción'}</p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="p-5 bg-slate-900 flex justify-between items-center">
                                                                    <span className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-2"><Package className="w-5 h-5 text-rose-500" /> Detalle de Receta</span>
                                                                    <div className="flex gap-6">
                                                                        <div className="text-center">
                                                                            <p className="text-[8px] text-slate-500 uppercase font-black">A Cargo OS</p>
                                                                            <p className="text-xs text-rose-400 font-black tracking-tight">{formatMoney(record.discountEntity || 0)}</p>
                                                                        </div>
                                                                        <div className="text-center border-l border-slate-800 pl-6">
                                                                            <p className="text-[8px] text-slate-500 uppercase font-black">A cargo Paciente</p>
                                                                            <p className="text-xs text-emerald-400 font-black tracking-tight">{formatMoney(record.patientAmount || 0)}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <table className="w-full text-[11px]">
                                                                    <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest">
                                                                        <tr>
                                                                            <th className="px-6 py-4 text-left">Producto</th>
                                                                            <th className="px-6 py-4 text-right">Cant.</th>
                                                                            <th className="px-6 py-4 text-right">P. Lista</th>
                                                                            <th className="px-6 py-4 text-right">Cobertura OS</th>
                                                                            <th className="px-6 py-4 text-right">Pago Paciente</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100">
                                                                        {(record.items || []).map((item, idx) => (
                                                                            <tr key={idx} className="hover:bg-slate-50 font-bold text-slate-700">
                                                                                <td className="px-6 py-4 italic">{item.name}</td>
                                                                                <td className="px-6 py-4 text-right">{item.quantity}</td>
                                                                                <td className="px-6 py-4 text-right">{formatMoney(item.price)}</td>
                                                                                <td className="px-6 py-4 text-right text-rose-600">{formatMoney(item.discountEntity || 0)}</td>
                                                                                <td className="px-6 py-4 text-right text-emerald-600">{formatMoney(item.discountClient || 0)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                {/* Show More Button */}
                {filteredData.length > displayLimit && (
                    <div className="p-6 flex justify-center border-t border-slate-100">
                        <button
                            onClick={() => setDisplayLimit(curr => curr + 20)}
                            className="bg-slate-50 hover:bg-slate-100 px-8 py-3 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 transition-all"
                        >
                            <ChevronDown className="w-4 h-4" /> Mostrar {Math.min(20, filteredData.length - displayLimit)} más
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
