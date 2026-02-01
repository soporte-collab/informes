import React, { useMemo, useState } from 'react';
import { SaleRecord } from '../types';
import { Grid, Calculator, Hash, Zap } from 'lucide-react';

interface SalesHeatmapProps {
    data: SaleRecord[];
    onCellClick?: (dayIndex: number, hour: number, dayName: string) => void;
}

interface HeatmapCell {
    day: number;
    hour: number;
    value: number;
    count: number;
    intervals: number[]; // 6 buckets of 10 mins each
    efficiency: number; // 0-100
}

export const SalesHeatmap: React.FC<SalesHeatmapProps> = ({ data, onCellClick }) => {
    const [mode, setMode] = useState<'count' | 'average' | 'efficiency'>('efficiency');

    // Calculate Heatmap Data
    const { flatData, maxCount, maxAverage, globalEfficiency, totalActiveMinutes, totalDeadMinutes } = useMemo(() => {
        // Initialize 7 days x 24 hours grid
        const grid: HeatmapCell[][] = Array.from({ length: 7 }, (_, day) =>
            Array.from({ length: 24 }, (_, hour) => ({
                day,
                hour,
                value: 0,
                count: 0,
                intervals: new Array(6).fill(0),
                efficiency: 0
            }))
        );

        // Populate grid
        (data || []).forEach(d => {
            const date = new Date(d.date);
            const day = date.getDay(); // 0 (Sun) - 6 (Sat)
            const hour = date.getHours();
            const minutes = date.getMinutes();
            const minuteBucket = Math.floor(minutes / 10); // 0, 1, 2, 3, 4, 5
            const adjustedDay = day === 0 ? 6 : day - 1; // Mon=0, Sun=6

            if (grid[adjustedDay] && grid[adjustedDay][hour]) {
                grid[adjustedDay][hour].value += d.totalAmount;
                grid[adjustedDay][hour].count += 1;
                if (grid[adjustedDay][hour].intervals[minuteBucket] !== undefined) {
                    grid[adjustedDay][hour].intervals[minuteBucket]++;
                }
            }
        });

        // Flatten & Stats
        const flatData = [];
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

        let localMaxCount = 0;
        let localMaxAverage = 0;
        let activeBlocksCount = 0;

        // Business Hours: 08:00 to 20:30
        const START_HOUR = 8;
        const END_HOUR = 20; // Includes 20:00-20:59, we'll cap efficiency at 20:30 logic

        let calculatedDeadMins = 0;

        for (let d = 0; d < 7; d++) {
            for (let h = START_HOUR; h <= END_HOUR; h++) {
                const cell = grid[d][h];
                const count = cell.count;
                const value = cell.value;
                const average = count > 0 ? value / count : 0;

                // Calculate Efficiency (Occupancy)
                const activeBlocks = cell.intervals.filter(x => x > 0).length;
                activeBlocksCount += activeBlocks;

                // Logic for 20:30 Close time
                // For hour 20, only blocks 0,1,2 are valid (00-30). 
                const validBlocks = (h === 20) ? 3 : 6;

                // Efficiency relative to VALID blocks
                let efficiency = (activeBlocks / validBlocks) * 100;
                // Cap at 100% (in case sales happen after 20:30, treated as bonus/overtime but displayed as full)
                if (efficiency > 100) efficiency = 100;

                cell.efficiency = efficiency; // Store for usage in visuals

                // Dead Minutes Calculation
                // Count how many VALID blocks had 0 sales
                for (let i = 0; i < validBlocks; i++) {
                    if (cell.intervals[i] === 0) {
                        calculatedDeadMins += 10;
                    }
                }

                if (count > localMaxCount) localMaxCount = count;
                if (average > localMaxAverage) localMaxAverage = average;

                flatData.push({
                    dayIndex: d,
                    dayName: days[d],
                    hour: h,
                    value: value,
                    count: count,
                    average: average,
                    efficiency: efficiency,
                    intervals: cell.intervals
                });
            }
        }

        const activeMins = activeBlocksCount * 10;

        // Potential Time: 7 days * (12 hours * 60 + 30 mins) = 7 * 750 = 5250
        const potentialMinutes = 5250;
        const efficiencyPerc = (activeMins / potentialMinutes) * 100;

        return {
            flatData,
            maxCount: localMaxCount,
            maxAverage: localMaxAverage,
            globalEfficiency: efficiencyPerc,
            totalActiveMinutes: activeMins,
            totalDeadMinutes: calculatedDeadMins
        };
    }, [data]);

    // Color Scales
    const getColor = (cell: any) => {
        if (mode === 'count') {
            const intensity = cell.count / (maxCount || 1);
            if (cell.count === 0) return 'bg-slate-50';
            if (intensity < 0.25) return 'bg-indigo-100';
            if (intensity < 0.5) return 'bg-indigo-300';
            if (intensity < 0.75) return 'bg-indigo-500';
            return 'bg-indigo-700';
        }
        if (mode === 'efficiency') {
            if (cell.efficiency === 0) return 'bg-red-50';
            if (cell.efficiency <= 25) return 'bg-red-200';
            if (cell.efficiency <= 50) return 'bg-orange-300';
            if (cell.efficiency <= 75) return 'bg-lime-300';
            // if (cell.efficiency <= 90) return 'bg-emerald-400';
            return 'bg-emerald-600';
        }
        else {
            const intensity = cell.average / (maxAverage || 1);
            if (cell.value === 0) return 'bg-slate-50';
            if (intensity < 0.25) return 'bg-emerald-100';
            if (intensity < 0.5) return 'bg-emerald-300';
            if (intensity < 0.75) return 'bg-emerald-500';
            return 'bg-emerald-700';
        }
    };

    return (
        <div className="w-full">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-2">
                    <Grid className="w-5 h-5 text-slate-400" />
                    <h4 className="font-bold text-slate-700">Mapa de Calor</h4>
                </div>

                {/* Mode Toggles */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setMode('count')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${mode === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Hash className="w-3 h-3" />
                        Tráfico
                    </button>
                    <button
                        onClick={() => setMode('efficiency')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${mode === 'efficiency' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Zap className="w-3 h-3" />
                        Eficiencia
                    </button>
                    <button
                        onClick={() => setMode('average')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${mode === 'average' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Calculator className="w-3 h-3" />
                        Ticket Prom.
                    </button>
                </div>
            </div>

            {/* NEW METRICS STRIP */}
            {mode === 'efficiency' && (
                <div className="grid grid-cols-3 gap-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex flex-col items-center">
                        <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-widest">Tiempo Activo</span>
                        <span className="text-xl font-black text-emerald-700">{(totalActiveMinutes / 60).toFixed(1)} hs</span>
                        <span className="text-[9px] text-emerald-600/60 font-medium">Intervalos con venta</span>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex flex-col items-center">
                        <span className="text-[10px] font-bold uppercase text-red-400 tracking-widest">Horas Muertas</span>
                        <span className="text-xl font-black text-red-600">{(totalDeadMinutes / 60).toFixed(1)} hs</span>
                        <span className="text-[9px] text-red-600/60 font-medium font-bold">8:00 - 20:30 hs sin ventas</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col items-center">
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Eficiencia Global</span>
                        <span className="text-xl font-black text-slate-700">{globalEfficiency.toFixed(1)}%</span>
                        <span className="text-[9px] text-slate-500 font-medium">Ocupación comercial</span>
                    </div>
                </div>
            )}

            {/* Heatmap Grid */}
            <div className="overflow-x-auto pb-4 custom-scrollbar">
                <div className="min-w-[700px]">
                    {/* Hours Header */}
                    <div className="grid grid-cols-[80px_repeat(13,1fr)] gap-1 mb-2">
                        <div className="col-start-2 col-span-13 flex justify-between px-2">
                            {Array.from({ length: 13 }, (_, i) => i + 8).map(h => (
                                <span key={h} className="text-[10px] font-bold text-slate-400 text-center w-full">{h}h</span>
                            ))}
                        </div>
                    </div>

                    {/* Days Rows */}
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dayName, dIndex) => (
                        <div key={dayName} className="grid grid-cols-[80px_repeat(13,1fr)] gap-1 mb-1 items-center group/row">
                            <span className="text-[11px] font-semibold text-slate-500 text-right pr-3">{dayName}</span>

                            {flatData.filter(d => d.dayIndex === dIndex).map((cell, idx) => {
                                const isTopRow = dIndex < 2;
                                const maxInterval = Math.max(...cell.intervals, 1);

                                // Tooltip positioning logic
                                const tooltipPos = isTopRow ? 'top-[110%]' : 'bottom-[110%]';
                                const pointerPos = isTopRow ? 'top-[-6px]' : 'bottom-[-6px]';

                                return (
                                    <div
                                        key={idx}
                                        className={`relative h-10 w-full rounded-md transition-all duration-300 hover:scale-110 hover:z-20 cursor-pointer group flex items-end justify-center px-[2px] pb-[1px] gap-[1px] border border-white/50 ${getColor(cell)}`}
                                        onClick={() => onCellClick && onCellClick(cell.dayIndex, cell.hour, cell.dayName)}
                                    >
                                        {/* MINI BARS INSIDE CELL */}
                                        {mode === 'efficiency' && cell.intervals.map((val, k) => (
                                            <div key={k} className={`w-full rounded-[1px] ${val > 0 ? 'bg-white/60 h-[70%]' : 'bg-black/5 h-[20%]'}`} />
                                        ))}

                                        {/* TOOLTIP */}
                                        <div className={`hidden group-hover:block absolute left-1/2 -translate-x-1/2 w-max min-w-[200px] bg-slate-900 text-white text-[10px] rounded-xl p-4 z-50 shadow-2xl pointer-events-none transform transition-all ring-1 ring-white/10 ${tooltipPos}`}>
                                            <div className="font-black border-b border-white/10 pb-2 mb-3 flex justify-between items-center pr-2">
                                                <span className="text-base text-white">{dayName}</span>
                                                <span className="text-emerald-400 text-lg">{cell.hour}:00 hs</span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <p className="text-slate-500 uppercase font-bold text-[9px] mb-0.5">Tickets</p>
                                                    <p className="font-black text-xl text-white">{cell.count}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500 uppercase font-bold text-[9px] mb-0.5">Venta Neta</p>
                                                    <p className="font-black text-xl text-emerald-400">${Math.round(cell.value).toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500 uppercase font-bold text-[9px] mb-0.5">Ocupación</p>
                                                    <p className={`font-black text-xl ${cell.efficiency > 50 ? 'text-green-400' : 'text-red-400'}`}>{Math.round(cell.efficiency)}%</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500 uppercase font-bold text-[9px] mb-0.5">Ticket Prom.</p>
                                                    <p className="font-black text-xl text-yellow-400">${Math.round(cell.average).toLocaleString()}</p>
                                                </div>
                                            </div>

                                            <div className="pt-3 border-t border-white/10">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-3 tracking-widest flex justify-between">
                                                    <span>Minuto a Minuto (10')</span>
                                                </p>
                                                <div className="flex items-end justify-between h-12 gap-1 px-1">
                                                    {cell.intervals.map((cnt, i) => {
                                                        const hPerc = (cnt / (maxInterval || 1)) * 100;
                                                        const isActive = cnt > 0;
                                                        return (
                                                            <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar relative">
                                                                <div className="absolute bottom-full mb-1 opacity-0 group-hover/bar:opacity-100 text-[9px] bg-white text-slate-900 px-1 rounded font-bold transition-opacity whitespace-nowrap z-50">
                                                                    {cnt} tkt
                                                                </div>
                                                                <div
                                                                    className={`w-full rounded-sm transition-all duration-300 ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/5 border border-white/10'}`}
                                                                    style={{ height: isActive ? `${Math.max(15, hPerc)}%` : '4px' }}
                                                                />
                                                                <span className={`text-[8px] font-mono tracking-tighter ${isActive ? 'text-white font-bold' : 'text-slate-600'}`}>{i * 10}'</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45 ring-1 ring-white/10 ${pointerPos}`}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between mt-4 border-t border-slate-100 pt-3">
                <p className="text-[10px] text-slate-400 font-medium italic">
                    * Horario Comercial Configurado: 08:00 a 20:30 hs.
                </p>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Intensidad:</span>
                    {mode === 'efficiency' ? (
                        <>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-50 border border-slate-200"></div><span className="text-[9px] text-slate-500">Muerto</span></div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-300"></div><span className="text-[9px] text-slate-500">Medio</span></div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-600"></div><span className="text-[9px] text-slate-500">Pleno</span></div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-indigo-100"></div><span className="text-[9px] text-slate-500">Baja</span></div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-indigo-400"></div><span className="text-[9px] text-slate-500">Media</span></div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-indigo-700"></div><span className="text-[9px] text-slate-500">Alta</span></div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

