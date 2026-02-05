import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, X, Clock, Briefcase, TrendingUp, UserCheck, AlertTriangle } from 'lucide-react';
import { formatMinutesToHM } from '../utils/hrUtils';

interface AttendancePrintReportProps {
    data: any[];
    startDate: string;
    endDate: string;
    onClose: () => void;
    user: string;
}

export const AttendancePrintReport: React.FC<AttendancePrintReportProps> = ({
    data,
    startDate,
    endDate,
    onClose,
    user
}) => {
    const currentDate = format(new Date(), "dd 'de' MMMM, yyyy - HH:mm", { locale: es });

    const stats = useMemo(() => {
        const totalHoursMinutes = data.reduce((sum, e) => sum + (e.totalHours * 60), 0);
        const totalOvertimeMinutes = data.reduce((sum, e) => sum + (e.overtime * 60), 0);
        const totalSellers = data.length;
        return { totalHoursMinutes, totalOvertimeMinutes, totalSellers };
    }, [data]);

    return (
        <div id="printable-report" className="min-h-screen bg-white text-slate-900 p-8 font-sans">
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    /* MATAR TODAS LAS ANIMACIONES EN IMPRESIÓN */
                    *, *::before, *::after {
                        animation: none !important;
                        transition: none !important;
                        transition-duration: 0s !important;
                        animation-duration: 0s !important;
                        opacity: 1 !important;
                        visibility: visible !important;
                        transform: none !important;
                    }
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                    /* Ocultar resto del sitio */
                    body > *:not(#print-report-modal-wrapper) {
                        display: none !important;
                    }
                    #root {
                        display: none !important;
                    }
                    #print-report-modal-wrapper {
                        display: block !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        background: white !important;
                    }
                    #printable-report {
                        display: block !important;
                        padding: 0 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            ` }} />

            {/* Header */}
            <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg">
                        <Clock className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Reporte de Asistencia y Extras</h1>
                        <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest leading-none">Biosalud Management System v2.0</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl inline-block">
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Período de Liquidación</p>
                        <p className="text-lg font-black text-slate-900">
                            {format(new Date(startDate + 'T00:00:00'), 'dd/MM/yyyy')} — {format(new Date(endDate + 'T00:00:00'), 'dd/MM/yyyy')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-6 mb-10">
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 border-l-8 border-l-indigo-500">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Total Horas Trabajadas</p>
                    <p className="text-3xl font-black text-slate-900">{formatMinutesToHM(stats.totalHoursMinutes)}</p>
                </div>
                <div className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100 border-l-8 border-l-emerald-500">
                    <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-2">Total Horas Extras</p>
                    <p className="text-3xl font-black text-emerald-700">{formatMinutesToHM(stats.totalOvertimeMinutes)}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 border-l-8 border-l-slate-400">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Personal Consolidado</p>
                    <p className="text-3xl font-black text-slate-900">{stats.totalSellers} personas</p>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="mb-10">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                            <th className="p-5 rounded-l-2xl">Colaborador</th>
                            <th className="p-5">Sucursal(es)</th>
                            <th className="p-5 text-center">Horas Totales</th>
                            <th className="p-5 text-center">Base Min.</th>
                            <th className="p-5 text-right rounded-r-2xl">Horas Extras</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map((emp, i) => (
                            <tr key={emp.id} className="hover:bg-slate-50/50">
                                <td className="p-5">
                                    <p className="text-sm font-black uppercase text-slate-900">{emp.name}</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{emp.position || 'OPERATIVO'}</p>
                                </td>
                                <td className="p-5">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{emp.branch}</span>
                                </td>
                                <td className="p-5 text-center font-black text-slate-700">
                                    {formatMinutesToHM(emp.totalHours * 60)}
                                </td>
                                <td className="p-5 text-center font-bold text-slate-400">
                                    {emp.expectedHours.toFixed(1)}h
                                </td>
                                <td className="p-5 text-right">
                                    {emp.overtime > 0 ? (
                                        <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black">
                                            +{formatMinutesToHM(emp.overtime * 60)}
                                        </span>
                                    ) : (
                                        <span className="text-slate-300 font-bold text-xs">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-end border-t border-slate-100 pt-8 mt-auto">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                        <UserCheck className="w-4 h-4" /> Validado por RRHH
                    </div>
                    <div className="h-20 w-48 border-b-2 border-slate-200"></div>
                </div>
                <div className="text-right space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Generado el {currentDate}</p>
                    <p className="text-[9px] text-slate-300 italic">Este documento tiene carácter de declaración jurada interna.</p>
                </div>
            </div>

            {/* Print Controls (Floating) */}
            <div className="fixed bottom-10 right-10 flex gap-4 no-print">
                <button
                    onClick={onClose}
                    className="p-4 bg-slate-100 text-slate-600 rounded-full shadow-xl hover:bg-slate-200 transition-all font-black uppercase text-xs px-8"
                >
                    Volver
                </button>
                <button
                    onClick={() => {
                        // Small timeout to ensure all components are settled
                        setTimeout(() => window.print(), 300);
                    }}
                    className="p-4 bg-slate-900 text-white rounded-full shadow-2xl hover:scale-110 transition-all flex items-center gap-3 px-10"
                >
                    <Printer className="w-6 h-6" />
                    <span className="font-black uppercase text-xs tracking-widest">Imprimir Reporte</span>
                </button>
            </div>
        </div>
    );
};
