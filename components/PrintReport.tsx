import React, { useMemo } from 'react';
import { SaleRecord } from '../types';
import { formatMoney } from '../utils/dataHelpers';
import { format, getDay, getHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { Building2, X, TrendingUp, Filter, Printer, Clock, Tag, LayoutGrid, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';

interface PrintReportProps {
    data: SaleRecord[];
    startDate: string;
    endDate: string;
    branchFilter: string;
    sellerFilter?: string;
    excludedCount: number;
    includedCount: number;
    excludedEntitiesCount: number;
    onClose: () => void;
    user: string;
}

export const PrintReport: React.FC<PrintReportProps> = ({
    data,
    startDate,
    endDate,
    branchFilter,
    sellerFilter = 'all',
    excludedCount,
    includedCount,
    excludedEntitiesCount,
    onClose,
    user
}) => {

    // Calculate Stats specifically for the report
    const stats = useMemo(() => {
        const totalSales = data.reduce((acc, curr) => acc + curr.totalAmount, 0);
        const totalQty = data.reduce((acc, curr) => acc + curr.quantity, 0);
        const totalTx = data.length;
        const upt = totalTx > 0 ? totalQty / totalTx : 0;

        // Branch Share
        const branchMap = new Map<string, number>();
        data.forEach(d => branchMap.set(d.branch, (branchMap.get(d.branch) || 0) + d.totalAmount));
        const branches = Array.from(branchMap.entries()).map(([name, val]) => ({ name, val }));

        // Hourly Rhythm (Quantity)
        const hourMap = new Array(24).fill(0);
        data.forEach(d => {
            const h = getHours(d.date);
            hourMap[h] += d.quantity;
        });
        // Filter 8am - 10pm for relevance
        const hourlyData = hourMap.map((val, h) => ({ hour: `${h}h`, value: val })).filter((_, i) => i >= 8 && i <= 22);

        // Sales by Category (Rubro)
        const catMap = new Map<string, number>();
        data.forEach(d => {
            const cat = d.category || 'Sin Categoría';
            catMap.set(cat, (catMap.get(cat) || 0) + d.totalAmount);
        });
        const categories = Array.from(catMap.entries())
            .map(([name, val]) => ({ name, val }))
            .sort((a, b) => b.val - a.val)
            .slice(0, 10);

        // Heatmap Data (Transaction Count Intesity)
        // 7 days x 15 hours (8-22)
        const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        const heatmapGrid = Array.from({ length: 7 }, () => Array(15).fill(0));
        let maxHeat = 0;

        data.forEach(d => {
            const h = getHours(d.date);
            if (h >= 8 && h <= 22) {
                const dayIdx = (getDay(d.date) + 6) % 7; // Mon=0
                const hourIdx = h - 8;
                heatmapGrid[dayIdx][hourIdx] += 1; // Intensity by tx count
                if (heatmapGrid[dayIdx][hourIdx] > maxHeat) maxHeat = heatmapGrid[dayIdx][hourIdx];
            }
        });

        return { totalSales, totalQty, totalTx, upt, branches, hourlyData, categories, heatmapGrid, maxHeat, days };
    }, [data]);

    const currentDate = format(new Date(), "dd 'de' MMMM, yyyy - HH:mm", { locale: es });

    const getHeatColor = (val: number, max: number) => {
        if (val === 0) return '#f3f4f6';
        const intensity = val / (max || 1);
        if (intensity < 0.25) return '#e9d5ff';
        if (intensity < 0.5) return '#c084fc';
        if (intensity < 0.75) return '#a855f7';
        return '#7e22ce';
    };

    return (
        <div className="min-h-screen bg-white text-gray-900 p-8 max-w-[210mm] mx-auto print:p-0 print:max-w-none font-sans">
            {/* Header - Compact */}
            <div className="flex justify-between items-start border-b-2 border-biosalud-600 pb-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-biosalud-600 text-white p-2 rounded-lg print-color-adjust">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 leading-none">Reporte de Ventas</h1>
                        <p className="text-xs text-gray-500 mt-1">BioSalud Analytics</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Generado por</p>
                    <p className="text-xs font-medium">{user}</p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">Fecha Emisión</p>
                    <p className="text-xs font-medium">{currentDate}</p>
                </div>
                <button onClick={onClose} className="no-print p-2 bg-gray-100 hover:bg-gray-200 rounded-full">
                    <X className="w-5 h-5 text-gray-600" />
                </button>
            </div>

            {/* Filters Summary - Compact */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100 break-inside-avoid">
                <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-bold mb-0.5">Período Analizado</span>
                    <span className="font-semibold text-gray-900">
                        {startDate ? format(new Date(startDate), 'dd/MM/yyyy') : 'Inicio'} — {endDate ? format(new Date(endDate), 'dd/MM/yyyy') : 'Hoy'}
                    </span>
                </div>
                <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-bold mb-0.5">Sucursal / Vendedor</span>
                    <span className="font-semibold text-gray-900">
                        {branchFilter === 'all' ? 'Todas' : branchFilter} / {sellerFilter === 'all' ? 'Todos' : sellerFilter}
                    </span>
                </div>
                {(excludedCount > 0 || includedCount > 0 || excludedEntitiesCount > 0) && (
                    <div className="col-span-2 flex items-center gap-4 border-t border-gray-200 pt-2 mt-1">
                        <Filter className="w-3 h-3 text-gray-400" />
                        {includedCount > 0 && <span className="text-blue-600 font-medium">{includedCount} prod. incl.</span>}
                        {excludedCount > 0 && <span className="text-red-600 font-medium">{excludedCount} prod. excl.</span>}
                    </div>
                )}
            </div>

            {/* 4 Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-6 break-inside-avoid">
                <div className="p-3 border-l-4 border-green-500 bg-white shadow-sm rounded-r-lg">
                    <p className="text-gray-500 text-[10px] uppercase font-bold mb-1 truncate">Ventas Totales</p>
                    <p className="text-xl font-bold text-gray-900">{formatMoney(stats.totalSales)}</p>
                </div>
                <div className="p-3 border-l-4 border-blue-500 bg-white shadow-sm rounded-r-lg">
                    <p className="text-gray-500 text-[10px] uppercase font-bold mb-1 truncate">Unidades</p>
                    <p className="text-xl font-bold text-gray-900">{stats.totalQty.toLocaleString()}</p>
                </div>
                <div className="p-3 border-l-4 border-purple-500 bg-white shadow-sm rounded-r-lg">
                    <p className="text-gray-500 text-[10px] uppercase font-bold mb-1 truncate">Ticket Promedio</p>
                    <p className="text-xl font-bold text-gray-900">{stats.totalTx > 0 ? formatMoney(stats.totalSales / stats.totalTx) : '$0'}</p>
                </div>
                <div className={`p-3 border-l-4 shadow-sm rounded-r-lg ${stats.upt < 1.2 ? 'border-red-500 bg-red-50' : 'border-indigo-500 bg-white'}`}>
                    <p className={`text-[10px] uppercase font-bold mb-1 truncate ${stats.upt < 1.2 ? 'text-red-600' : 'text-gray-500'}`}>UPT (Unid./Ticket)</p>
                    <div className="flex items-center gap-2">
                        <p className={`text-xl font-bold ${stats.upt < 1.2 ? 'text-red-700' : 'text-gray-900'}`}>{stats.upt.toFixed(2)}</p>
                        {stats.upt < 1.2 && <AlertCircle className="w-4 h-4 text-red-500" />}
                    </div>
                </div>
            </div>

            {/* Heatmap Section */}
            <div className="mb-6 break-inside-avoid bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-purple-600" />
                    Mapa de Calor (Tráfico Semanal)
                </h3>
                <div className="w-full">
                    <div className="flex mb-1">
                        <div className="w-8"></div>
                        <div className="flex-1 flex justify-between px-1">
                            {Array.from({ length: 15 }, (_, i) => i + 8).map(h => (
                                <div key={h} className="text-[9px] text-gray-400 w-full text-center">{h}h</div>
                            ))}
                        </div>
                    </div>
                    {stats.days.map((day, dIdx) => (
                        <div key={day} className="flex items-center mb-1">
                            <div className="w-8 text-[10px] font-bold text-gray-500">{day}</div>
                            <div className="flex-1 flex gap-0.5 h-6">
                                {stats.heatmapGrid[dIdx].map((val, hIdx) => (
                                    <div
                                        key={hIdx}
                                        className="flex-1 rounded-[1px] print-color-adjust"
                                        style={{ backgroundColor: getHeatColor(val, stats.maxHeat) }}
                                    ></div>
                                ))}
                            </div>
                        </div>
                    ))}
                    <div className="flex justify-end gap-3 mt-2">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#e9d5ff]"></div><span className="text-[10px] text-gray-500">Bajo</span></div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#a855f7]"></div><span className="text-[10px] text-gray-500">Medio</span></div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-[#7e22ce]"></div><span className="text-[10px] text-gray-500">Alto</span></div>
                    </div>
                </div>
            </div>

            {/* Two Column Section: Hourly & Categories */}
            <div className="grid grid-cols-2 gap-6 mb-8 break-inside-avoid">
                {/* Hourly Rhythm */}
                <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        Ritmo Horario (Unidades)
                    </h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.hourlyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="hour" fontSize={9} tickLine={false} />
                                <YAxis fontSize={9} tickLine={false} />
                                <Bar dataKey="value" fill="#3b82f6" isAnimationActive={false} radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Categories */}
                <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-green-600" />
                        Top 10 Rubros (% Ventas)
                    </h3>
                    <div className="h-48 overflow-hidden">
                        <table className="w-full text-[10px]">
                            <thead>
                                <tr className="text-gray-500 border-b border-gray-100">
                                    <th className="text-left pb-1">Rubro</th>
                                    <th className="text-right pb-1">Total</th>
                                    <th className="text-right pb-1">%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stats.categories.map((cat, i) => (
                                    <tr key={i}>
                                        <td className="py-1 truncate max-w-[120px] font-medium text-gray-700">{cat.name}</td>
                                        <td className="py-1 text-right text-gray-600">{formatMoney(cat.val)}</td>
                                        <td className="py-1 text-right font-bold text-gray-900">{((cat.val / stats.totalSales) * 100).toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Branch Summary & Footer */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 break-inside-avoid mb-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-bold text-gray-700 flex items-center gap-2">
                        <Building2 className="w-4 h-4" /> Distribución por Sucursal
                    </h3>
                </div>
                <div className="space-y-2">
                    {stats.branches.map(b => (
                        <div key={b.name} className="flex items-center gap-3 text-xs">
                            <div className={`w-2 h-2 rounded-full ${b.name.includes('CHACRAS') ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                            <div className="flex-1 flex justify-between items-end border-b border-gray-200 border-dashed pb-0.5">
                                <span className="font-medium text-gray-700">{b.name}</span>
                                <div className="text-right">
                                    <span className="font-bold text-gray-900 mr-2">{formatMoney(b.val)}</span>
                                    <span className="text-gray-500 text-[10px]">({((b.val / stats.totalSales) * 100).toFixed(1)}%)</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-center pt-2 border-t border-gray-200">
                <p className="text-[9px] text-gray-400">Documento generado automáticamente por el sistema de auditoría interna. Uso exclusivo administrativo.</p>
            </div>

            {/* Print Button */}
            <div className="fixed bottom-8 right-8 no-print">
                <button
                    onClick={() => window.print()}
                    className="bg-gray-900 hover:bg-black text-white p-4 rounded-full shadow-2xl flex items-center gap-2 transition-transform hover:scale-105"
                >
                    <Printer className="w-6 h-6" />
                    <span className="font-bold pr-2">Imprimir PDF</span>
                </button>
            </div>
        </div>
    );
};