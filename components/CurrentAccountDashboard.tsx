import React, { useMemo, useState } from 'react';
import { CurrentAccountRecord } from '../types';
import { formatMoney } from '../utils/dataHelpers';
import {
    Wallet, Search, ArrowUpRight, ArrowDownLeft,
    Calendar, User, Filter, Info,
    AlertCircle, CheckCircle, Clock, LayoutGrid, Store, Trash2, Printer
} from 'lucide-react';
import { format, isWithinInterval } from 'date-fns';
import { PrintCurrentAccountReport } from './PrintCurrentAccountReport';

interface Props {
    data: CurrentAccountRecord[];
    onUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClear?: () => void;
}

export const CurrentAccountDashboard: React.FC<Props> = ({ data, onUpload, onClear }) => {
    const [viewTab, setViewTab] = useState<'global' | 'paseo' | 'chacras'>('global');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEntity, setSelectedEntity] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showPrintModal, setShowPrintModal] = useState(false);

    // Filter by branch based on tab
    const branchFilteredData = useMemo(() => {
        if (viewTab === 'global') return data;
        const branchKey = viewTab === 'paseo' ? 'FCIA BIOSALUD' : 'BIOSALUD CHACRAS PARK';
        return data.filter(d => d.branch === branchKey);
    }, [data, viewTab]);

    const entities = useMemo(() => {
        return Array.from(new Set((branchFilteredData || []).map(d => d.entity))).filter(Boolean).sort();
    }, [branchFilteredData]);

    const filteredData = useMemo(() => {
        return (branchFilteredData || []).filter(d => {
            const searchStr = `${d.entity || ''} ${d.reference || ''} ${d.description || ''}`.toLowerCase();
            const matchSearch = searchTerm === '' || searchStr.includes(searchTerm.toLowerCase());
            const matchEntity = selectedEntity === 'all' || d.entity === selectedEntity;

            let matchDate = true;
            if (startDate && endDate) {
                try {
                    const recordDate = d.date instanceof Date ? d.date : new Date(d.date);
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59);
                    matchDate = isWithinInterval(recordDate, { start, end });
                } catch (e) { matchDate = true; }
            }

            return matchSearch && matchEntity && matchDate;
        });
    }, [branchFilteredData, searchTerm, selectedEntity, startDate, endDate]);

    const stats = useMemo(() => {
        const totalDebits = filteredData.reduce((acc, curr) => acc + (curr.debit || 0), 0);
        const totalCredits = filteredData.reduce((acc, curr) => acc + (curr.credit || 0), 0);
        const finalBalance = totalDebits - totalCredits;
        return { totalDebits, totalCredits, finalBalance };
    }, [filteredData]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* View Selector Tabs */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
                <button
                    onClick={() => setViewTab('global')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewTab === 'global' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutGrid className="w-4 h-4" /> Global
                </button>
                <button
                    onClick={() => setViewTab('paseo')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewTab === 'paseo' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Store className="w-4 h-4" /> Paseo
                </button>
                <button
                    onClick={() => setViewTab('chacras')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewTab === 'chacras' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Store className="w-4 h-4" /> Chacras
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-500">
                        <ArrowUpRight className="w-24 h-24 text-rose-600" />
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 font-mono">Deuda Acumulada</p>
                    <h3 className="text-3xl font-black text-slate-900">{formatMoney(stats.totalDebits)}</h3>
                    <div className="w-full h-1 bg-rose-100 mt-4 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 w-full animate-pulse"></div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:-rotate-12 transition-transform duration-500">
                        <ArrowDownLeft className="w-24 h-24 text-emerald-600" />
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 font-mono">Pagos Detectados</p>
                    <h3 className="text-3xl font-black text-slate-900">{formatMoney(stats.totalCredits)}</h3>
                    <div className="w-full h-1 bg-emerald-100 mt-4 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 w-full"></div>
                    </div>
                </div>

                <div className={`p-6 rounded-[32px] border shadow-2xl relative overflow-hidden group transition-all duration-500 ${stats.finalBalance > 0 ? 'bg-slate-900 border-slate-800' : 'bg-indigo-600 border-indigo-500'}`}>
                    <div className="absolute bottom-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-700">
                        <Wallet className="w-32 h-32 text-white" />
                    </div>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1 font-mono">Saldo Neto Pendiente</p>
                    <h3 className="text-3xl font-black text-white">{formatMoney(stats.finalBalance)}</h3>
                    <p className="text-white/60 text-[10px] mt-4 font-bold flex items-center gap-2">
                        {stats.finalBalance > 0 ? <AlertCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                        {stats.finalBalance > 0 ? 'EXISTEN SALDOS PENDIENTES' : 'CUENTA NIVELADA'}
                    </p>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-[28px] border border-slate-100 shadow-lg flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="BUSCAR CLIENTE O REFERENCIA..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[200px]"
                    value={selectedEntity}
                    onChange={(e) => setSelectedEntity(e.target.value)}
                >
                    <option value="all">TODOS LOS CLIENTES</option>
                    {entities.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-[10px] font-black outline-none" />
                    <span className="text-slate-300">/</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-[10px] font-black outline-none" />
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Historial de Cuentas</h3>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Sucursal: {viewTab === 'global' ? 'TODAS' : viewTab.toUpperCase()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full border border-indigo-100 uppercase tracking-widest">
                            {filteredData.length} OPERACIONES
                        </span>
                        {onClear && data.length > 0 && (
                            <button
                                onClick={onClear}
                                className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all border border-rose-100"
                                title="Borrar Cuentas Corrientes"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={() => setShowPrintModal(true)}
                            className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                            title="Imprimir Reporte A4"
                        >
                            <Printer className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-8 py-5">Fecha</th>
                                <th className="px-8 py-5">Sucursal</th>
                                <th className="px-8 py-5">Entidad / Cliente</th>
                                <th className="px-8 py-5 text-right text-rose-500">Debe (+)</th>
                                <th className="px-8 py-5 text-right text-emerald-500">Haber (-)</th>
                                <th className="px-8 py-5 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredData.map((record: any, idx) => (
                                <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td className="px-8 py-5">
                                        <p className="text-xs font-black text-slate-700">{record.date instanceof Date ? format(record.date, 'dd/MM/yyyy') : record.date}</p>
                                        <p className="text-[10px] font-mono text-slate-400">{record.reference}</p>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${record.branch?.includes('CHACRAS') ? 'border-orange-200 text-orange-600 bg-orange-50' : 'border-blue-200 text-blue-600 bg-blue-50'}`}>
                                            {record.branch?.includes('CHACRAS') ? 'CHACRAS' : 'BIO PASEO'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <p className="text-xs font-black text-slate-900 uppercase">{record.entity}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{record.type}</p>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <span className="text-sm font-black text-rose-600">{record.debit > 0 ? formatMoney(record.debit) : '-'}</span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <span className="text-sm font-black text-emerald-600">{record.credit > 0 ? formatMoney(record.credit) : '-'}</span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <span className="text-sm font-black text-slate-900 bg-slate-100/50 px-3 py-1 rounded-xl">{formatMoney(record.balance)}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredData.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center gap-4 bg-slate-50/10">
                            <Clock className="w-12 h-12 text-slate-200" />
                            <p className="text-slate-400 font-black uppercase text-xs tracking-widest italic">No se detectaron movimientos</p>
                        </div>
                    )}
                </div>
            </div>

            {showPrintModal && (
                <PrintCurrentAccountReport
                    data={branchFilteredData}
                    viewTab={viewTab}
                    user="Administrador"
                    onClose={() => setShowPrintModal(false)}
                />
            )}
        </div>
    );
};
