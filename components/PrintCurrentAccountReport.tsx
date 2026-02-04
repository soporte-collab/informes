import React, { useMemo, useState } from 'react';
import { CurrentAccountRecord } from '../types';
import { formatMoney } from '../utils/dataHelpers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, X, Wallet, TrendingUp, Filter, AlertCircle, Building2 } from 'lucide-react';

interface PrintCurrentAccountReportProps {
    data: CurrentAccountRecord[];
    onClose: () => void;
    user: string;
    viewTab: 'global' | 'paseo' | 'chacras';
}

export const PrintCurrentAccountReport: React.FC<PrintCurrentAccountReportProps> = ({
    data,
    onClose,
    user,
    viewTab
}) => {
    const [filterWithDebtOnly, setFilterWithDebtOnly] = useState(true);

    const filteredData = useMemo(() => {
        // First filter by balance if needed
        let result = data;
        if (filterWithDebtOnly) {
            // Group by entity to check total balance
            const entityBalances = new Map<string, number>();
            data.forEach(d => {
                const current = entityBalances.get(d.entity) || 0;
                entityBalances.set(d.entity, current + (d.debit || 0) - (d.credit || 0));
            });

            result = data.filter(d => (entityBalances.get(d.entity) || 0) > 0.01);
        }
        return result.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [data, filterWithDebtOnly]);

    const stats = useMemo(() => {
        const totalDebits = filteredData.reduce((acc, curr) => acc + (curr.debit || 0), 0);
        const totalCredits = filteredData.reduce((acc, curr) => acc + (curr.credit || 0), 0);
        const finalBalance = totalDebits - totalCredits;

        // Group by branch for overview
        const branchMap = new Map<string, { debt: number, payments: number }>();
        filteredData.forEach(d => {
            const b = d.branch || 'General';
            const current = branchMap.get(b) || { debt: 0, payments: 0 };
            branchMap.set(b, {
                debt: current.debt + (d.debit || 0),
                payments: current.payments + (d.credit || 0)
            });
        });

        return { totalDebits, totalCredits, finalBalance, branches: Array.from(branchMap.entries()) };
    }, [filteredData]);

    const currentDate = format(new Date(), "dd 'de' MMMM, yyyy - HH:mm", { locale: es });

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-md overflow-y-auto p-4 md:p-8 no-scrollbar">
            <div className="bg-white text-slate-900 p-8 max-w-[210mm] mx-auto shadow-2xl rounded-sm print:shadow-none print:p-0 print:max-w-none font-sans min-h-[297mm]">

                {/* Controls - No Print */}
                <div className="no-print flex justify-between items-center mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-10 h-6 rounded-full transition-all relative ${filterWithDebtOnly ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={filterWithDebtOnly}
                                    onChange={() => setFilterWithDebtOnly(!filterWithDebtOnly)}
                                />
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${filterWithDebtOnly ? 'left-5' : 'left-1'}`}></div>
                            </div>
                            <span className="text-xs font-black uppercase text-slate-600 group-hover:text-indigo-600">Solo con Deuda Pendiente</span>
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-200">
                            <Printer className="w-4 h-4" /> Imprimir reporte A4
                        </button>
                        <button onClick={onClose} className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Header - Compact */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-900 text-white p-2.5 rounded-xl print-color-adjust">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 leading-none uppercase tracking-tighter">Estado de Cuentas Corrientes</h1>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Sucursal: {viewTab.toUpperCase()}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Generado por</p>
                        <p className="text-xs font-black uppercase">{user}</p>
                        <p className="text-[9px] text-slate-400 mt-2 uppercase font-black tracking-widest">Fecha Emisión</p>
                        <p className="text-xs font-bold">{currentDate}</p>
                    </div>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        .fixed { position: relative !important; background: white !important; }
                        .backdrop-blur-md { backdrop-filter: none !important; }
                        .bg-slate-900\\/60 { background: white !important; }
                        .p-4, .p-8 { padding: 0 !important; }
                        .shadow-2xl { shadow: none !important; }
                        .animate-in { animation: none !important; opacity: 1 !important; }
                        body { background: white !important; }
                        @page { margin: 15mm; }
                    }
                `}} />

                {/* Performance Summary */}
                <div className="grid grid-cols-3 gap-6 mb-8 break-inside-avoid">
                    <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-2xl">
                        <p className="text-slate-400 text-[9px] uppercase font-black mb-1">Total Comprobantes</p>
                        <p className="text-xl font-black text-slate-900">{formatMoney(stats.totalDebits)}</p>
                    </div>
                    <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-2xl">
                        <p className="text-slate-400 text-[9px] uppercase font-black mb-1">Total Cobrado (Haber)</p>
                        <p className="text-xl font-black text-slate-900">{formatMoney(stats.totalCredits)}</p>
                    </div>
                    <div className="p-4 bg-slate-900 rounded-2xl">
                        <p className="text-slate-300/60 text-[9px] uppercase font-black mb-1">Saldo Neto a Cobrar</p>
                        <p className="text-xl font-black text-white">{formatMoney(stats.finalBalance)}</p>
                    </div>
                </div>

                {/* Main Table */}
                <div className="mb-8">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100/80 border-y border-slate-200">
                                <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Fecha</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Cliente / Entidad</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Ref / Tipo</th>
                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-slate-500">Debe (+)</th>
                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-slate-500">Haber (-)</th>
                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-slate-500">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.map((record, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-[10px] font-bold text-slate-500">
                                        {record.date instanceof Date ? format(record.date, 'dd/MM/yyyy') : record.date}
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-[11px] font-black uppercase text-slate-900">{record.entity}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{record.branch?.split(' ')[1] || 'GENERAL'}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-[10px] font-mono font-bold text-slate-600">{record.reference}</p>
                                        <p className="text-[9px] font-black text-slate-300 uppercase">{record.type}</p>
                                    </td>
                                    <td className="px-4 py-3 text-right text-[11px] font-black text-rose-600">
                                        {record.debit > 0 ? formatMoney(record.debit) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-[11px] font-black text-emerald-600">
                                        {record.credit > 0 ? formatMoney(record.credit) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-[11px] font-black text-slate-900">
                                        {formatMoney(record.balance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredData.length === 0 && (
                        <div className="py-20 text-center border-b border-slate-100">
                            <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-black uppercase text-xs tracking-widest">No se detectaron deudas pendientes</p>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="mt-auto pt-8 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-8 mb-6">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5" /> Distribución por Nodo
                            </h4>
                            <div className="space-y-2">
                                {stats.branches.map(([name, vals]) => (
                                    <div key={name} className="flex justify-between items-center text-[10px] font-bold">
                                        <span className="text-slate-500 uppercase">{name}</span>
                                        <div className="text-right">
                                            <span className="text-slate-900">Neto: {formatMoney(vals.debt - vals.payments)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col justify-end text-right">
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-400 font-bold">
                                    <span>SUBTOTAL DEUDA</span>
                                    <span className="text-slate-600">{formatMoney(stats.totalDebits)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-400 font-bold">
                                    <span>SUBTOTAL PAGOS</span>
                                    <span className="text-slate-600">{formatMoney(stats.totalCredits)}</span>
                                </div>
                                <div className="flex justify-between text-base font-black border-t border-slate-900 pt-2 mt-2">
                                    <span>TOTAL NETO PENDIENTE</span>
                                    <span className="text-slate-900">{formatMoney(stats.finalBalance)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-center pt-4">
                        <p className="text-[9px] text-slate-300 font-bold uppercase tracking-[0.3em]">Documento de Auditoría BioSalud • Confidencial</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
