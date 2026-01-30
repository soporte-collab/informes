import React, { useMemo } from 'react';
import { SaleRecord } from '../types';
import { SalesHeatmap } from './SalesHeatmap';
import { format } from 'date-fns';
import { formatMoney } from '../utils/dataHelpers';
import { Clock, X, Search, User } from 'lucide-react';

interface HeatmapDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeSlot: { dayIndex: number, hour: number, dayName: string } | null;
    setActiveSlot: (slot: { dayIndex: number, hour: number, dayName: string } | null) => void;
    data: SaleRecord[];
}

export const HeatmapDetailModal: React.FC<HeatmapDetailModalProps> = ({
    isOpen,
    onClose,
    activeSlot,
    setActiveSlot,
    data
}) => {

    // Get slots data filtering by active slot
    const slotVouchers = useMemo(() => {
        if (!activeSlot || !isOpen) return [];

        // Filter sales for this slot
        const slotSales = data.filter(d => {
            // Adjust Day logic: dateFns getDay 0=Sun..6=Sat. Heatmap logic: 0=Mon..6=Sun
            const day = d.date.getDay();
            const adjDay = day === 0 ? 6 : day - 1;
            const hour = d.date.getHours();
            return adjDay === activeSlot.dayIndex && hour === activeSlot.hour;
        });

        // Group by Invoice
        const vouchersMap = new Map<string, {
            id: string,
            time: Date,
            total: number,
            count: number,
            seller: string,
            products: string[]
        }>();

        slotSales.forEach(s => {
            const key = s.invoiceNumber;
            if (!vouchersMap.has(key)) {
                vouchersMap.set(key, {
                    id: key,
                    time: s.date,
                    total: 0,
                    count: 0,
                    seller: s.sellerName,
                    products: []
                });
            }
            const v = vouchersMap.get(key)!;
            v.total += s.totalAmount;
            v.count += 1;
            if (v.products.length < 3) v.products.push(s.productName); // Keep first 3 for preview
        });

        return Array.from(vouchersMap.values()).sort((a, b) => b.total - a.total);
    }, [data, activeSlot, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Clock className="w-6 h-6 text-purple-600" />
                            Análisis de Tráfico Detallado
                        </h3>
                        <p className="text-sm text-gray-500">Seleccione un bloque horario para ver los comprobantes.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-white p-2 rounded-full border border-gray-200 shadow-sm transition-all hover:scale-105">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    <div className="space-y-6">
                        {/* Top: The Heatmap */}
                        <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                            <SalesHeatmap
                                data={data}
                                onCellClick={(dayIndex, hour, dayName) => setActiveSlot({ dayIndex, hour, dayName })}
                            />
                        </div>

                        {/* Bottom: The List */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[300px]">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                    <Search className="w-4 h-4 text-gray-400" />
                                    {activeSlot
                                        ? `Comprobantes del ${activeSlot.dayName} a las ${activeSlot.hour}:00 hs`
                                        : 'Seleccione un bloque arriba para ver detalles'}
                                </h4>
                                {activeSlot && (
                                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full font-bold">
                                        {slotVouchers.length} operaciones
                                    </span>
                                )}
                            </div>

                            {activeSlot ? (
                                slotVouchers.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                                                <tr>
                                                    <th className="p-3 pl-6">Hora</th>
                                                    <th className="p-3">Comprobante</th>
                                                    <th className="p-3">Vendedor</th>
                                                    <th className="p-3">Productos (Muestra)</th>
                                                    <th className="p-3 text-right pr-6">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {slotVouchers.map((v) => (
                                                    <tr key={v.id} className="hover:bg-purple-50 transition-colors group">
                                                        <td className="p-3 pl-6 font-mono text-gray-600">{format(v.time, 'HH:mm')}</td>
                                                        <td className="p-3 font-bold text-gray-800">{v.id}</td>
                                                        <td className="p-3 text-gray-600 flex items-center gap-2">
                                                            <User className="w-3 h-3 text-gray-400" />
                                                            {v.seller}
                                                        </td>
                                                        <td className="p-3 text-gray-500 text-xs truncate max-w-[200px]">
                                                            {v.products.join(', ')} {v.count > 3 && `(+${v.count - 3} más)`}
                                                        </td>
                                                        <td className="p-3 pr-6 text-right font-bold text-green-600">{formatMoney(v.total)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-12 text-center text-gray-400">
                                        No se registraron ventas en este horario.
                                    </div>
                                )
                            ) : (
                                <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
                                    <Clock className="w-12 h-12 opacity-20" />
                                    <p>Haga clic en un recuadro del mapa de calor para ver los tickets.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
