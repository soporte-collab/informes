import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, isWeekend, addMinutes, parse } from 'date-fns';
import { TimeAttendanceRecord, EmployeeLicense, SaleRecord, HolidayRecord, SpecialPermit, TimeBankRecord } from '../types';
import { Clock, AlertCircle, CheckCircle, Calendar as CalendarIcon, Briefcase, Sun, Coffee, Plus, Minus, RotateCcw, X, History, ChevronLeft } from 'lucide-react';

interface AttendanceCalendarProps {
    employeeId: string;
    employeeName: string;
    attendance: TimeAttendanceRecord[];
    licenses: EmployeeLicense[];
    sales: SaleRecord[];
    holidays: HolidayRecord[];
    permits: SpecialPermit[];
    timeBank: TimeBankRecord[];
    startDate?: string;
    endDate?: string;
    onAddLicense: (date: Date) => void;
    onAddPermit: (date: Date) => void;
    onAddManualHours: (date: Date) => void;
    onTimeBankAction: (date: Date) => void;
    onClose: () => void;
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
    employeeId,
    employeeName,
    attendance,
    licenses,
    sales,
    holidays,
    permits,
    timeBank,
    startDate,
    endDate,
    onAddLicense,
    onAddPermit,
    onAddManualHours,
    onTimeBankAction,
    onClose
}) => {
    const today = new Date();

    // Determine the range to display based on global filters
    const rangeStart = useMemo(() => {
        if (startDate) return new Date(startDate + 'T00:00:00');
        return startOfMonth(today);
    }, [startDate]);

    const rangeEnd = useMemo(() => {
        if (endDate) return new Date(endDate + 'T23:59:59');
        return endOfMonth(today);
    }, [endDate]);

    const days = useMemo(() => {
        return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    }, [rangeStart, rangeEnd]);

    // Deduce work from sales
    const workFromSales = useMemo(() => {
        const map = new Map<string, SaleRecord[]>();
        sales.forEach(s => {
            const d = new Date(s.date);
            const dateStr = format(d, 'dd/MM/yyyy');
            if (!map.has(dateStr)) map.set(dateStr, []);
            map.get(dateStr)!.push(s);
        });
        return map;
    }, [sales]);

    const getDayInfo = (date: Date) => {
        const dateStr = format(date, 'dd/MM/yyyy');
        const isoStr = format(date, 'yyyy-MM-dd');

        // Find ALL attendance records for this day (could be multiple branches)
        const dayAtts = attendance.filter(a => a.date === dateStr);

        const lic = licenses.find(l => {
            const startStr = l.startDate;
            const endStr = l.endDate;
            return isoStr >= startStr && isoStr <= endStr;
        });

        const holiday = holidays.find(h => h.date === isoStr);
        const daySales = workFromSales.get(dateStr) || [];
        const dayPermit = permits.find(p => p.date === isoStr);
        const bankRecords = timeBank.filter(b => b.date === isoStr);

        // Logic: Worked without clock-in (checked against ANY attendance record)
        const workedWithoutClockIn = daySales.length > 0 && dayAtts.every(a => !a.entrance1);

        // Hour Calculation
        let dailyMinutes = 0;
        dayAtts.forEach(att => {
            if (att.entrance1 && att.exit1) {
                const [h1, m1] = att.entrance1.split(':').map(Number);
                const [h2, m2] = att.exit1.split(':').map(Number);
                if (!isNaN(h1) && !isNaN(h2)) dailyMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
            }
            if (att.entrance2 && att.exit2) {
                const [h1, m1] = att.entrance2.split(':').map(Number);
                const [h2, m2] = att.exit2.split(':').map(Number);
                if (!isNaN(h1) && !isNaN(h2)) dailyMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
            }
        });

        return { dayAtts, lic, holiday, workedWithoutClockIn, daySales, dayPermit, bankRecords, dailyMinutes };
    };

    const periodStats = useMemo(() => {
        let totalMinutes = 0;
        days.forEach(d => {
            const { dailyMinutes } = getDayInfo(d);
            totalMinutes += dailyMinutes;
        });

        const bankBalance = timeBank.reduce((sum, b) => sum + b.hours, 0);

        return { totalHours: totalMinutes / 60, bankBalance };
    }, [days, attendance, timeBank]);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-7xl h-full max-h-[90vh] rounded-[48px] shadow-2xl overflow-hidden flex flex-col border border-white animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-900 text-white shrink-0">
                    <div className="flex items-center gap-6">
                        <button onClick={onClose} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all">
                            <ChevronLeft className="w-6 h-6 text-white" />
                        </button>
                        <div>
                            <h3 className="text-3xl font-black uppercase tracking-tight">{employeeName}</h3>
                            <p className="text-indigo-400 text-xs font-black uppercase tracking-widest flex items-center gap-2 mt-1">
                                <CalendarIcon className="w-4 h-4" /> Bitácora de Asistencia y Banco de Horas
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-12">
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Horas en Período</p>
                            <p className="text-3xl font-black tracking-tighter text-white">{periodStats.totalHours.toFixed(1)}h</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Estado Banco Horas</p>
                            <div className={`flex items-center justify-end gap-2 text-3xl font-black tracking-tighter ${periodStats.bankBalance < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                                {periodStats.bankBalance > 0 && '+'}
                                {periodStats.bankBalance.toFixed(1)}h
                                <History className="w-5 h-5 ml-2" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Calendar Body */}
                <div className="flex-1 overflow-y-auto p-10 bg-slate-50/30 custom-scrollbar">
                    <div className="grid grid-cols-7 gap-4">
                        {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(d => (
                            <div key={d} className="text-center text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] pb-4">{d}</div>
                        ))}
                        {days.map((day, idx) => {
                            const { dayAtts, lic, holiday, workedWithoutClockIn, dayPermit, bankRecords, dailyMinutes } = getDayInfo(day);
                            const isToday = isSameDay(day, today);
                            const isWE = isWeekend(day);

                            return (
                                <div
                                    key={idx}
                                    className={`min-h-[160px] p-6 rounded-[32px] transition-all relative group border-2 ${isToday ? 'bg-white border-indigo-200 shadow-xl shadow-indigo-100 ring-4 ring-indigo-50/50' :
                                        isWE ? 'bg-slate-50/50 border-slate-100' :
                                            'bg-white border-transparent hover:border-indigo-100 hover:shadow-xl shadow-slate-200/50'
                                        }`}
                                    style={idx === 0 ? { gridColumnStart: getDay(day) + 1 } : {}}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className={`text-sm font-black ${isToday ? 'text-indigo-600' : isWE ? 'text-slate-300' : 'text-slate-900'}`}>
                                            {format(day, 'd')}
                                        </span>
                                        <div className="flex gap-1">
                                            {holiday && <div className="bg-amber-100 text-amber-600 p-1 rounded-lg" title={holiday.name}><Sun className="w-3 h-3" /></div>}
                                            {dailyMinutes > 0 && <div className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded-lg">{(dailyMinutes / 60).toFixed(1)}h</div>}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {lic && (
                                            <div className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-xl border flex items-center gap-2 ${lic.type === 'vacation' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                lic.type === 'medical' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                    'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${lic.type === 'vacation' ? 'bg-blue-500' : 'bg-rose-500'}`} />
                                                {lic.type === 'vacation' ? 'Vacaciones' : 'Licencia'}
                                            </div>
                                        )}

                                        {dayAtts.length > 0 ? dayAtts.map((att, aIdx) => (
                                            <div key={aIdx} className="bg-slate-50 p-2 rounded-xl flex flex-col gap-1 border border-slate-100">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{att.branch || 'S/D'}</span>
                                                    <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-600">
                                                    <Clock className="w-3 h-3 opacity-40" />
                                                    {att.entrance1 || '??'} - {att.exit1 || '??'}
                                                </div>
                                            </div>
                                        )) : !lic && !holiday && !isWE && (
                                            <div className="text-[9px] font-black text-rose-300 uppercase italic tracking-widest py-2">Sin Marcación</div>
                                        )}

                                        {dayPermit && (
                                            <div className="text-[9px] font-black bg-amber-50 text-amber-600 px-3 py-2 rounded-xl border border-amber-100 flex items-center gap-2">
                                                <Coffee className="w-3 h-3" /> PERMISO: {dayPermit.fromTime}
                                            </div>
                                        )}

                                        {bankRecords.map((b, bIdx) => (
                                            <div key={bIdx} className={`text-[9px] font-black px-3 py-2 rounded-xl border flex items-center justify-between ${b.hours < 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                }`}>
                                                <span>{b.hours < 0 ? 'DEBE' : 'PAGÓ'} {Math.abs(b.hours)}h</span>
                                                <History className="w-3 h-3" />
                                            </div>
                                        ))}

                                        {workedWithoutClockIn && (
                                            <div className="flex items-center gap-2 text-[9px] font-black text-rose-500 bg-rose-50 p-2 rounded-xl border border-rose-100">
                                                <AlertCircle className="w-3 h-3 shrink-0" /> VENDIÓ SIN FICHAR
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Hover Menu */}
                                    <div className="absolute inset-0 bg-slate-900/90 opacity-0 group-hover:opacity-100 transition-all rounded-[32px] flex items-center justify-center gap-3 scale-95 group-hover:scale-100 backdrop-blur-sm">
                                        <button onClick={() => onAddManualHours(day)} title="Agregar Horas Manuel" className="p-3 bg-white text-slate-900 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all transform hover:scale-110">
                                            <Clock className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => onAddLicense(day)} title="Licencia/Vacaciones" className="p-3 bg-white text-slate-900 rounded-2xl hover:bg-blue-500 hover:text-white transition-all transform hover:scale-110">
                                            <Briefcase className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => onTimeBankAction(day)} title="Banco de Horas" className="p-3 bg-white text-slate-900 rounded-2xl hover:bg-rose-500 hover:text-white transition-all transform hover:scale-110">
                                            <RotateCcw className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Legend */}
                <div className="p-8 bg-white border-t border-slate-50 flex items-center justify-between shrink-0">
                    <div className="flex gap-8">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fichaje</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Deuda Banco</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Licencia</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Feriado</span>
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                        Biosalud Management System v2.0
                    </div>
                </div>
            </div>
        </div>
    );
};
