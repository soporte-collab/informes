import React, { useMemo, useState } from 'react';
import { SaleRecord } from '../types';
import { getDay, getHours } from 'date-fns';
import { Clock, CheckCircle2, TrendingDown, Coffee, Info, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { formatMoney } from '../utils/dataHelpers';

interface ScheduleOptimizationProps {
    data: SaleRecord[];
}

export const ScheduleOptimization: React.FC<ScheduleOptimizationProps> = ({ data }) => {
    const [threshold, setThreshold] = useState(40); // Default 40% of average

    // Detect if data quality is low (dummy times from commission files)
    const timeQuality = useMemo(() => {
        if (!data || data.length === 0) return { isDummy: false, atNoon: 0 };
        const samples = data.slice(0, 200);
        const atNoon = samples.filter(d => d.hour === 12).length;
        const isDummy = atNoon > samples.length * 0.7; // More than 70% at noon
        return { isDummy, atNoon };
    }, [data]);

    const suggestions = useMemo(() => {
        if (!data || data.length === 0 || timeQuality.isDummy) return [];

        const grid = Array.from({ length: 7 }, () =>
            Array.from({ length: 24 }, () => ({ count: 0, total: 0 }))
        );

        data.forEach(d => {
            const day = getDay(d.date);
            const hour = getHours(d.date);
            const adjDay = day === 0 ? 6 : day - 1;

            if (grid[adjDay] && grid[adjDay][hour]) {
                grid[adjDay][hour].count++;
                grid[adjDay][hour].total += d.totalAmount;
            }
        });

        const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const results: any[] = [];

        for (let d = 0; d < 7; d++) {
            const dayData = grid[d];

            const functionalHours = [];
            for (let h = 8; h <= 22; h++) {
                if (dayData[h].count > 0) functionalHours.push({ h, ...dayData[h] });
            }

            if (functionalHours.length === 0) continue;

            const totalTicketsDay = functionalHours.reduce((acc, h) => acc + h.count, 0);
            const totalRevenueDay = functionalHours.reduce((acc, h) => acc + h.total, 0);
            const avgTicketsPerHour = totalTicketsDay / functionalHours.length;

            const lowHours = functionalHours
                .filter(h => h.count < avgTicketsPerHour * (threshold / 100))
                .map(h => ({
                    hour: h.h,
                    count: h.count,
                    total: h.total,
                    impact: (h.total / (totalRevenueDay || 1)) * 100
                }));

            if (lowHours.length > 0) {
                results.push({
                    dayIndex: d,
                    dayName: dayNames[d],
                    lowHours: lowHours,
                    totalDayTickets: totalTicketsDay
                });
            }
        }

        return results;
    }, [data, timeQuality.isDummy, threshold]);

    if (timeQuality.isDummy) {
        return (
            <div className="bg-white p-12 rounded-2xl border border-red-100 shadow-sm text-center">
                <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-6" />
                <h3 className="text-2xl font-black text-gray-800 mb-4">Información de Horarios Incompleta</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-8">
                    Los archivos de ventas procesados actualmente no tienen el horario real de la caja (marcan todo a las 12:00 hs).
                </p>
                <div className="p-4 bg-purple-50 rounded-xl text-purple-700 text-sm font-medium">
                    Para habilitar el optimizador, use el botón <strong>"Actualizar Horarios (Caja)"</strong> de arriba y suba su reporte de comprobantes.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <SlidersHorizontal className="w-4 h-4 text-purple-600" />
                            <h4 className="font-bold text-gray-800 text-sm">Sensibilidad del Análisis</h4>
                        </div>
                        <p className="text-xs text-gray-500">Ajustá el umbral para ver qué horarios caen por debajo del <strong>{threshold}%</strong> del tráfico promedio.</p>
                    </div>

                    <div className="w-full md:w-64 flex flex-col gap-2">
                        <div className="flex justify-between text-xs font-bold text-purple-700">
                            <span>Más estricto</span>
                            <span>{threshold}%</span>
                            <span>Más permisivo</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="80"
                            value={threshold}
                            onChange={(e) => setThreshold(parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                    </div>
                </div>
            </div>

            {suggestions.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-800">Operación Eficiente</h3>
                    <p className="text-gray-500">Con un umbral del {threshold}%, no se detectaron baches de tráfico significativos.</p>
                </div>
            ) : (
                <>
                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                                <Info className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-blue-900">Sugerencias con Umbral al {threshold}%</h3>
                                <p className="text-blue-800 text-sm opacity-80">
                                    Se muestran las horas que están por debajo del {threshold}% de tu tráfico promedio diario. {threshold < 25 ? 'Este es un ajuste muy conservador.' : 'Este es un ajuste equilibrado.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {suggestions.map((s) => (
                            <div key={s.dayIndex} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-gray-800">{s.dayName}</h4>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Tráfico Bajo</span>
                                </div>

                                <div className="space-y-2">
                                    {s.lowHours.map((h: any) => (
                                        <div key={h.hour} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                                    <Clock className="w-4 h-4 text-gray-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">{h.hour}:00 - {h.hour + 1}:00</p>
                                                    <p className="text-[10px] text-gray-500">{h.count} tickets</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-red-600">{formatMoney(h.total)}</p>
                                                <p className="text-[10px] text-red-400">{h.impact.toFixed(2)}% del día</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
