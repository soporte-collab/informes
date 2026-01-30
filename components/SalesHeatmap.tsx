import React, { useMemo, useState } from 'react';
import { SaleRecord } from '../types';
import { format, getDay, getHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { Grid, Calculator, Hash } from 'lucide-react';

interface SalesHeatmapProps {
    data: SaleRecord[];
    onCellClick?: (dayIndex: number, hour: number, dayName: string) => void;
}

export const SalesHeatmap: React.FC<SalesHeatmapProps> = ({ data, onCellClick }) => {
    const [mode, setMode] = useState<'count' | 'average'>('count');

    const heatmapData = useMemo(() => {
        // Initialize 7 days x 24 hours grid
        const grid = Array.from({ length: 7 }, (_, day) =>
            Array.from({ length: 24 }, (_, hour) => ({ day, hour, value: 0, count: 0 }))
        );

        // Populate grid
        data.forEach(d => {
            const date = d.date;
            const day = getDay(date); // 0 (Sun) - 6 (Sat)
            const hour = getHours(date);

            // Adjust Day to make Monday = 0
            // date-fns getDay: 0=Sun, 1=Mon, ..., 6=Sat
            // We want: 0=Mon, 1=Tue, ..., 5=Sat, 6=Sun
            const adjustedDay = day === 0 ? 6 : day - 1;

            if (grid[adjustedDay] && grid[adjustedDay][hour]) {
                grid[adjustedDay][hour].value += d.totalAmount;
                grid[adjustedDay][hour].count += 1;
            }
        });

        // Flatten for Recharts Scatter/Heatmap simulation
        const flatData = [];
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

        for (let d = 0; d < 7; d++) {
            for (let h = 8; h <= 22; h++) { // Filter functional hours (8am to 10pm)
                const count = grid[d][h].count;
                const value = grid[d][h].value;
                const average = count > 0 ? value / count : 0;

                flatData.push({
                    dayIndex: d,
                    dayName: days[d],
                    hour: h,
                    value: value,
                    count: count,
                    average: average,
                    intensity: mode === 'count' ? count : average
                });
            }
        }
        return flatData;
    }, [data, mode]);

    // Find max for scaling color
    const maxVal = Math.max(...heatmapData.map(d => d.intensity));

    const getColor = (val: number) => {
        const intensity = val / (maxVal || 1);
        // Purple scale for count, Green scale for average
        if (intensity === 0) return '#f3f4f6';

        if (mode === 'count') {
            if (intensity < 0.2) return '#e9d5ff'; // purple-200
            if (intensity < 0.4) return '#c084fc'; // purple-400
            if (intensity < 0.6) return '#a855f7'; // purple-500
            if (intensity < 0.8) return '#9333ea'; // purple-600
            return '#7e22ce'; // purple-700
        } else {
            // green scale for Average Ticket
            if (intensity < 0.2) return '#dcfce7'; // green-100
            if (intensity < 0.4) return '#86efac'; // green-300
            if (intensity < 0.6) return '#4ade80'; // green-400
            if (intensity < 0.8) return '#22c55e'; // green-500
            return '#16a34a'; // green-600
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Grid className="w-5 h-5 text-gray-400" />
                    Mapa de Calor {mode === 'count' ? '(Tráfico/Tickets)' : '(Ticket Promedio)'}
                </h3>

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setMode('count')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'count' ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Hash className="w-3.5 h-3.5" />
                        Tickets
                    </button>
                    <button
                        onClick={() => setMode('average')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'average' ? 'bg-white shadow text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Calculator className="w-3.5 h-3.5" />
                        Ticket Prom.
                    </button>
                </div>
            </div>

            <div className="h-80 w-full overflow-x-auto p-4 custom-scrollbar">
                <div className="min-w-[600px] h-full flex flex-col gap-1">
                    <div className="flex">
                        <div className="w-20"></div> {/* Y-Axis Label Space */}
                        <div className="flex-1 flex justify-between text-xs text-gray-400 px-2 pb-2">
                            {Array.from({ length: 15 }, (_, i) => i + 8).map(h => (
                                <div key={h} className="w-full text-center">{h}h</div>
                            ))}
                        </div>
                    </div>
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dayName, dayIdx) => (
                        <div key={dayName} className="flex flex-1 items-center">
                            <div className="w-20 text-xs font-medium text-gray-500 text-right pr-4">{dayName}</div>
                            <div className="flex-1 flex gap-1 h-full">
                                {heatmapData
                                    .filter(d => d.dayIndex === dayIdx)
                                    .sort((a, b) => a.hour - b.hour)
                                    .map((cell) => {
                                        const isTopRow = dayIdx < 2; // Show tooltip below for first 2 rows
                                        return (
                                            <div
                                                key={`${cell.dayIndex}-${cell.hour}`}
                                                className="flex-1 rounded-sm relative group cursor-pointer transition-colors"
                                                style={{ backgroundColor: getColor(cell.intensity) }}
                                                onClick={() => onCellClick?.(cell.dayIndex, cell.hour, dayName)}
                                            >
                                                <div className={`hidden group-hover:block absolute left-1/2 -translate-x-1/2 w-max min-w-[120px] bg-gray-900 text-white text-xs rounded-lg p-3 z-50 shadow-xl pointer-events-none transform transition-all ${isTopRow ? 'top-[110%]' : 'bottom-[110%]'}`}>
                                                    <div className="font-bold border-b border-gray-700 pb-1 mb-1">{dayName} {cell.hour}:00</div>
                                                    <div className="flex justify-between gap-4">
                                                        <span>Tickets:</span>
                                                        <span className="font-mono font-bold text-blue-200">{cell.count}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <span>Ticket Promedio:</span>
                                                        <span className="font-mono font-bold text-yellow-300">
                                                            ${Math.round(cell.average).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <span>Total Ventas:</span>
                                                        <span className="font-mono font-bold text-green-300">${Math.round(cell.value).toLocaleString()}</span>
                                                    </div>
                                                    <div className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45 ${isTopRow ? 'top-[-6px]' : 'bottom-[-6px]'}`}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex justify-end items-center gap-4 mt-4 text-xs text-gray-500">
                <span className="font-medium mr-2">Intensidad ({mode === 'count' ? 'Tickets' : 'Ticket Prom.'}):</span>
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm ${mode === 'count' ? 'bg-[#e9d5ff]' : 'bg-[#dcfce7]'}`}></div>
                    <span>Baja</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm ${mode === 'count' ? 'bg-[#a855f7]' : 'bg-[#4ade80]'}`}></div>
                    <span>Media</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm ${mode === 'count' ? 'bg-[#7e22ce]' : 'bg-[#16a34a]'}`}></div>
                    <span>Alta</span>
                </div>
            </div>
        </div>
    );
};

