
import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, isWeekend, addMinutes, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { TimeAttendanceRecord, EmployeeLicense, SaleRecord, HolidayRecord, SpecialPermit } from '../types';
import { Clock, AlertCircle, CheckCircle, Calendar as CalendarIcon, Briefcase, Sun, Coffee } from 'lucide-react';

interface AttendanceCalendarProps {
    employeeId: string;
    employeeName: string;
    attendance: TimeAttendanceRecord[];
    licenses: EmployeeLicense[];
    sales: SaleRecord[];
    holidays: HolidayRecord[];
    permits: SpecialPermit[];
    onAddLicense: (date: Date) => void;
    onAddPermit: (date: Date) => void;
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
    employeeId,
    employeeName,
    attendance,
    licenses,
    sales,
    holidays,
    permits,
    onAddLicense,
    onAddPermit
}) => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Deduce work from sales
    const workFromSales = useMemo(() => {
        const map = new Map<string, SaleRecord[]>();
        sales.forEach(s => {
            const dateStr = format(s.date, 'dd/MM/yyyy');
            if (!map.has(dateStr)) map.set(dateStr, []);
            map.get(dateStr)!.push(s);
        });
        return map;
    }, [sales]);

    const getDayInfo = (date: Date) => {
        const dateStr = format(date, 'dd/MM/yyyy');
        const att = attendance.find(a => a.date === dateStr);
        const lic = licenses.find(l => {
            const start = new Date(l.startDate);
            const end = new Date(l.endDate);
            return date >= start && date <= end;
        });
        const holiday = holidays.find(h => h.date === format(date, 'yyyy-MM-dd'));
        const daySales = workFromSales.get(dateStr) || [];
        const dayPermit = permits.find(p => p.date === format(date, 'yyyy-MM-dd'));

        // Logic: Worked without clock-in
        const workedWithoutClockIn = daySales.length > 0 && !att?.entrance1;
        // Logic: Clocked in but no sales (possible anomaly if it's a seller)
        const markedButNoSales = att?.entrance1 && daySales.length === 0;

        // Hour Calculation
        let dailyMinutes = 0;
        if (att?.entrance1 && att.exit1) {
            const [h1, m1] = att.entrance1.split(':').map(Number);
            const [h2, m2] = att.exit1.split(':').map(Number);
            dailyMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
        }
        if (att?.entrance2 && att.exit2) {
            const [h1, m1] = att.entrance2.split(':').map(Number);
            const [h2, m2] = att.exit2.split(':').map(Number);
            dailyMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
        }

        return { att, lic, holiday, workedWithoutClockIn, markedButNoSales, daySales, dayPermit, dailyMinutes };
    };

    const periodStats = useMemo(() => {
        let totalMinutes = 0;
        days.forEach(d => {
            const { dailyMinutes } = getDayInfo(d);
            totalMinutes += dailyMinutes;
        });

        const totalHours = totalMinutes / 60;
        const expectedHours = 45 * 4; // Approx for month, better if weekly but this is a HUD
        const overtime = Math.max(0, totalHours - expectedHours);

        return { totalHours, overtime };
    }, [days, attendance]);

    return (
        <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-900 text-white">
                <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">{employeeName}</h3>
                    <p className="text-teal-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <CalendarIcon className="w-3 h-3" /> Control de Asistencia Mensual
                    </p>
                </div>
                <div className="flex gap-8">
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Total Horas</p>
                        <p className="text-xl font-black tracking-tighter">{periodStats.totalHours.toFixed(1)}h</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-rose-400 font-bold uppercase">Horas Extras</p>
                        <p className="text-xl font-black tracking-tighter text-rose-500">+{periodStats.overtime.toFixed(1)}h</p>
                    </div>
                </div>
            </div>

            <div className="p-8">
                <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-3xl overflow-hidden border border-slate-200">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                        <div key={d} className="bg-slate-50 p-4 text-center text-[10px] font-black uppercase text-slate-400">{d}</div>
                    ))}
                    {days.map((day, idx) => {
                        const { att, lic, holiday, workedWithoutClockIn, markedButNoSales, dayPermit } = getDayInfo(day);
                        const isToday = isSameDay(day, today);
                        const isWE = isWeekend(day);

                        return (
                            <div
                                key={idx}
                                className={`min-h-[120px] p-3 transition-all relative group ${isToday ? 'bg-teal-50/50' : 'bg-white'} hover:bg-slate-50`}
                                style={idx === 0 ? { gridColumnStart: getDay(day) + 1 } : {}}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-xs font-black ${isToday ? 'text-teal-600' : isWE ? 'text-rose-300' : 'text-slate-400'}`}>
                                        {format(day, 'd')}
                                    </span>
                                    {holiday && <Sun className="w-3 h-3 text-amber-500" title={holiday.name} />}
                                </div>

                                <div className="space-y-1.5">
                                    {lic && (
                                        <div className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${lic.type === 'vacation' ? 'bg-blue-100 text-blue-700' :
                                            lic.type === 'medical' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {lic.type}
                                        </div>
                                    )}

                                    {att?.entrance1 ? (
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1 text-[9px] font-bold text-teal-600">
                                                <Clock className="w-2.5 h-2.5" /> {att.entrance1} - {att.exit1 || '??'}
                                            </div>
                                            {att.entrance2 && (
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-teal-600">
                                                    <Clock className="w-2.5 h-2.5" /> {att.entrance2} - {att.exit2 || '??'}
                                                </div>
                                            )}
                                        </div>
                                    ) : !lic && !holiday && !isWE && (
                                        <div className="text-[8px] font-bold text-rose-300 uppercase italic">Sin Marcación</div>
                                    )}

                                    {dayPermit && (
                                        <div className="text-[8px] font-black bg-amber-50 text-amber-600 px-2 py-1 rounded-md border border-amber-100">
                                            PERMISO: {dayPermit.fromTime}-{dayPermit.toTime}
                                        </div>
                                    )}

                                    {workedWithoutClockIn && (
                                        <div className="flex items-center gap-1 text-[8px] font-black text-rose-600 bg-rose-50 p-1 rounded animate-pulse">
                                            <AlertCircle className="w-2.5 h-2.5" /> VENDIÓ SIN FICHAR
                                        </div>
                                    )}
                                </div>

                                <div className="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => onAddLicense(day)} className="p-2 bg-white text-slate-900 rounded-full hover:bg-teal-500 hover:text-white transition-all transform hover:scale-110">
                                        <Briefcase className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onAddPermit(day)} className="p-2 bg-white text-slate-900 rounded-full hover:bg-amber-500 hover:text-white transition-all transform hover:scale-110">
                                        <Coffee className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-8">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-teal-500 rounded-full shadow-lg shadow-teal-200"></div>
                    <span className="text-[10px] font-black uppercase text-slate-400">Presente</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-rose-500 rounded-full shadow-lg shadow-rose-200"></div>
                    <span className="text-[10px] font-black uppercase text-slate-400">Anomalía</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full shadow-lg shadow-blue-200"></div>
                    <span className="text-[10px] font-black uppercase text-slate-400">Licencia</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-amber-500 rounded-full shadow-lg shadow-amber-200"></div>
                    <span className="text-[10px] font-black uppercase text-slate-400">Feriado</span>
                </div>
            </div>
        </div>
    );
};
