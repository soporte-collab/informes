import React, { useMemo, useState, useEffect } from 'react';
import { CurrentAccountRecord } from '../types';
import { formatMoney } from '../utils/dataHelpers';
import {
    Wallet, Search, ArrowUpRight, ArrowDownLeft,
    Calendar, User, Filter, Download, Info,
    AlertCircle, CheckCircle, Clock, Trash2
} from 'lucide-react';
import { format, isWithinInterval } from 'date-fns';

interface Props {
    data: CurrentAccountRecord[];
    onUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClear?: () => void;
}

export const CurrentAccountDashboard: React.FC<Props> = ({ data, onUpload, onClear }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEntity, setSelectedEntity] = useState('all');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [selectedType, setSelectedType] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Debugging logs to help identify why records might be missing
    useEffect(() => {
        console.log("📈 [Dashboard] Data received:", data.length, "records");
        if (data.length > 0) {
            console.log("📈 [Dashboard] Sample record:", data[0]);
        }
    }, [data]);

    const entities = useMemo(() => {
        return Array.from(new Set((data || []).map(d => d.entity))).filter(Boolean).sort();
    }, [data]);

    const branches = useMemo(() => {
        return Array.from(new Set((data || []).filter(d => d.branch).map(d => d.branch!))).filter(Boolean).sort();
    }, [data]);

    const types = useMemo(() => {
        return Array.from(new Set((data || []).map(d => d.type))).filter(Boolean).sort();
    }, [data]);

    const filteredData = useMemo(() => {
        const filtered = (data || []).filter(d => {
            // 1. Search Filter
            const searchStr = `${d.entity || ''} ${d.reference || ''} ${d.type || ''} ${d.description || ''}`.toLowerCase();
            const matchSearch = searchTerm === '' || searchStr.includes(searchTerm.toLowerCase());

            // 2. Entity Filter
            const matchEntity = selectedEntity === 'all' || d.entity === selectedEntity;

            // 3. Branch Filter
            const matchBranch = selectedBranch === 'all' || d.branch === selectedBranch;

            // 4. Type Filter
            const matchType = selectedType === 'all' || d.type === selectedType;

            // 5. Date Filter
            let matchDate = true;
            if (startDate && endDate) {
                try {
                    const recordDate = d.date instanceof Date ? d.date : new Date(d.date);
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59);
                    matchDate = isWithinInterval(recordDate, { start, end });
                } catch (e) {
                    matchDate = true; // Fallback on error
                }
            }

            return matchSearch && matchEntity && matchBranch && matchType && matchDate;
        });

        console.log("📈 [Dashboard] Filtered data:", filtered.length, "results");
        return filtered;
    }, [data, searchTerm, selectedEntity, selectedBranch, selectedType, startDate, endDate]);

    const stats = useMemo(() => {
        const totalDebits = filteredData.reduce((acc, curr) => acc + (curr.debit || 0), 0);
        const totalCredits = filteredData.reduce((acc, curr) => acc + (curr.credit || 0), 0);
        const finalBalance = totalDebits - totalCredits;
        return { totalDebits, totalCredits, finalBalance };
    }, [filteredData]);

    const displayData = useMemo(() => {
        if (selectedEntity === 'all') return filteredData;

        // Calculate running balance for a single entity
        let running = 0;
        return filteredData.map(d => {
            running += (d.debit || 0) - (d.credit || 0);
            return { ...d, runningBalance: running };
        });
    }, [filteredData, selectedEntity]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative group transition-all hover:shadow-md hover:border-blue-100">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <ArrowUpRight className="w-16 h-16 text-red-500" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-red-50 p-2 rounded-lg">
                            <ArrowUpRight className="w-5 h-5 text-red-600" />
                        </div>
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Deuda Acumulada</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900">{formatMoney(stats.totalDebits)}</div>
                    <div className="mt-2 text-xs text-gray-400 font-medium flex items-center gap-1">
                        <Info className="w-3 h-3" /> Suma de comprobantes emitidos
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative group transition-all hover:shadow-md hover:border-green-100">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <ArrowDownLeft className="w-16 h-16 text-green-500" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-green-50 p-2 rounded-lg">
                            <ArrowDownLeft className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Pagos Realizados</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900">{formatMoney(stats.totalCredits)}</div>
                    <div className="mt-2 text-xs text-gray-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Registros de pagos y recibos
                    </div>
                </div>

                <div className={`p-6 rounded-2xl border shadow-sm overflow-hidden relative group transition-all hover:shadow-md ${stats.finalBalance > 0 ? 'bg-orange-50/30 border-orange-100' : 'bg-blue-50/30 border-blue-100'}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Wallet className={`w-16 h-16 ${stats.finalBalance > 0 ? 'text-orange-500' : 'text-blue-500'}`} />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`${stats.finalBalance > 0 ? 'bg-orange-100' : 'bg-blue-100'} p-2 rounded-lg`}>
                            <Wallet className={`w-5 h-5 ${stats.finalBalance > 0 ? 'text-orange-600' : 'text-blue-600'}`} />
                        </div>
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Saldo Pendiente</span>
                    </div>
                    <div className={`text-3xl font-black ${stats.finalBalance > 0 ? 'text-orange-700' : 'text-blue-700'}`}>{formatMoney(stats.finalBalance)}</div>
                    <div className="mt-2 text-xs text-gray-400 font-medium flex items-center gap-1">
                        {stats.finalBalance > 0 ? <AlertCircle className="w-3 h-3 text-orange-400" /> : <CheckCircle className="w-3 h-3 text-blue-400" />}
                        {stats.finalBalance > 0 ? 'Existen saldos deudores pendientes' : 'Cuenta corriente equilibrada'}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-wider">Buscador General (Cliente, Referencia, Tipo)</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                placeholder="Ej: Abbona, Fernando..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-wider">Filtrar por Entidad / Cliente</label>
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm font-medium"
                            value={selectedEntity}
                            onChange={(e) => setSelectedEntity(e.target.value)}
                        >
                            <option value="all">Todas las Entidades</option>
                            {entities.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-wider">Sucursal</label>
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                        >
                            <option value="all">Todas las Sucursales</option>
                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-50">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-wider">Tipo de Movimiento</label>
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                        >
                            <option value="all">Todos los Tipos</option>
                            {types.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-wider">Desde</label>
                        <input
                            type="date"
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block tracking-wider">Hasta</label>
                        <input
                            type="date"
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-sm"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
                {(searchTerm || selectedEntity !== 'all' || selectedBranch !== 'all' || selectedType !== 'all' || startDate || endDate) && (
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedEntity('all');
                                setSelectedBranch('all');
                                setSelectedType('all');
                                setStartDate('');
                                setEndDate('');
                            }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                            <Filter className="w-3 h-3" /> Limpiar Filtros
                        </button>
                    </div>
                )}
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                    <div className="flex items-center gap-3">
                        <Wallet className="w-5 h-5 text-blue-500" />
                        <h3 className="font-bold text-gray-800 text-lg">Movimientos de Cuenta Corriente</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {onUpload && (
                            <>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={onUpload}
                                    accept=".csv,.txt"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-full hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    IMPORTAR CUENTAS (CSV)
                                </button>
                            </>
                        )}
                        {onClear && data.length > 0 && (
                            <button
                                onClick={onClear}
                                className="flex items-center gap-2 px-4 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-full hover:bg-red-100 transition-all"
                                title="Borrar toda esta sección"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                LIMPIAR
                            </button>
                        )}
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200 uppercase tracking-tighter">
                            {filteredData.length} movimientos
                        </span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-gray-400 font-medium border-b border-gray-100 bg-white">
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Entidad</th>
                                <th className="px-6 py-4">Tipo / Referencia</th>
                                <th className="px-6 py-4">Descripción</th>
                                <th className="px-6 py-4 text-right text-red-400">Debe (+)</th>
                                <th className="px-6 py-4 text-right text-green-400">Haber (-)</th>
                                <th className="px-6 py-4 text-right font-bold">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-[13px]">
                            {displayData.map((record: any) => (
                                <tr key={record.id} className="hover:bg-blue-50/20 transition-colors group">
                                    <td className="px-6 py-4 text-gray-500 font-medium whitespace-nowrap">
                                        {record.date instanceof Date ? format(record.date, 'dd/MM/yyyy') : 'Fecha Inválida'}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-900 max-w-[200px] truncate">{record.entity}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className={`text-[10px] font-black uppercase tracking-tighter ${record.type === 'NC' ? 'text-green-600' : 'text-gray-400'}`}>
                                                {record.type}
                                            </span>
                                            <span className="text-[11px] font-mono text-gray-600 truncate max-w-[150px]">{record.reference}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 italic max-w-xs truncate">{record.description}</td>
                                    <td className="px-6 py-4 text-right font-bold text-red-600 whitespace-nowrap">
                                        {record.debit > 0 ? `+ ${formatMoney(record.debit)}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-green-600 whitespace-nowrap">
                                        {record.credit > 0 ? `- ${formatMoney(record.credit)}` : '-'}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-black whitespace-nowrap ${(record.runningBalance ?? record.balance) > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                        {formatMoney(record.runningBalance ?? record.balance)}
                                    </td>
                                </tr>
                            ))}
                            {displayData.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic bg-gray-50/10">
                                        No se encontraron movimientos con los filtros aplicados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {filteredData.length > 0 && (
                            <tfoot className="bg-gray-50/50 font-black border-t border-gray-100">
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-right uppercase text-xs tracking-widest text-gray-400">Totales Periodo Seleccionado</td>
                                    <td className="px-6 py-4 text-right text-red-600">{formatMoney(stats.totalDebits)}</td>
                                    <td className="px-6 py-4 text-right text-green-600">{formatMoney(stats.totalCredits)}</td>
                                    <td className={`px-6 py-4 text-right ${stats.finalBalance > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                        {formatMoney(stats.finalBalance)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};
