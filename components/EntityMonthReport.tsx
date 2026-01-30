import React, { useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SaleRecord } from '../types';
import { formatMoney } from '../utils/dataHelpers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Printer, Package, Building2, Calendar, FileText, Download } from 'lucide-react';

interface EntityMonthReportProps {
    data: SaleRecord[];
    entityName: string;
    month: string;
    onClose: () => void;
}

export const EntityMonthReport: React.FC<EntityMonthReportProps> = ({
    data,
    entityName,
    month,
    onClose
}) => {
    useEffect(() => {
        document.body.classList.add('entity-report-active');
        return () => document.body.classList.remove('entity-report-active');
    }, []);

    // Filter data for the specific entity and month
    const filteredProducts = useMemo(() => {
        const stats = new Map<string, { category: string, qty: number, total: number, lastPrice: number }>();

        data.forEach(s => {
            const key = `${s.productName}|${s.category || 'Otros'}`;
            const current = stats.get(key) || { category: s.category || 'Otros', qty: 0, total: 0, lastPrice: 0 };
            stats.set(key, {
                category: current.category,
                qty: current.qty + s.quantity,
                total: current.total + s.totalAmount,
                lastPrice: s.unitPrice
            });
        });

        return Array.from(stats.entries())
            .map(([key, stat]) => ({ name: key.split('|')[0], ...stat }))
            .sort((a, b) => b.total - a.total);
    }, [data]);

    const totals = useMemo(() => {
        return filteredProducts.reduce((acc, curr) => ({
            qty: acc.qty + curr.qty,
            total: acc.total + curr.total
        }), { qty: 0, total: 0 });
    }, [filteredProducts]);

    const formattedMonth = useMemo(() => {
        if (!month) return '';
        const [year, m] = month.split('-').map(Number);
        const date = new Date(year, m - 1);
        return format(date, 'MMMM yyyy', { locale: es }).toUpperCase();
    }, [month]);

    const downloadExcel = () => {
        const headers = ['Producto', 'Rubro', 'Cantidad', 'Precio Unitario', 'Subtotal'];
        const csvContent = [
            headers.join(';'),
            ...filteredProducts.map(p =>
                `"${p.name}";"${p.category}";${p.qty};${p.lastPrice.toString().replace('.', ',')};${p.total.toString().replace('.', ',')}`
            ),
            `"TOTAL GENERAL";"";${totals.qty};;${totals.total.toString().replace('.', ',')}`
        ].join('\n');

        // Added BOM for Excel UTF-8 compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Auditoria_${entityName.replace(/\s+/g, '_')}_${month}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return createPortal(
        <div
            id="entity-report-portal"
            className="fixed inset-0 z-[10000] bg-white overflow-y-auto font-sans text-gray-900 print:absolute print:inset-0 print:overflow-visible print-report-container"
        >
            {/* Control Bar - No Print */}
            <div className="sticky top-0 bg-gray-900 text-white p-4 flex justify-between items-center shadow-xl no-print z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="font-bold">Reporte de Auditoría por Entidad</h2>
                        <p className="text-xs text-gray-400">Vista Previa: {entityName} ({month})</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={downloadExcel}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg"
                    >
                        <Download className="w-4 h-4" />
                        Exportar Excel
                    </button>
                    <button
                        onClick={() => {
                            window.scrollTo(0, 0);
                            setTimeout(() => window.print(), 200);
                        }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg"
                    >
                        <Printer className="w-4 h-4" />
                        Imprimir Reporte
                    </button>
                </div>
            </div>

            {/* Printable Content */}
            <div className="max-w-[210mm] mx-auto p-12 bg-white print:p-0 print:max-w-none">
                {/* Header */}
                <div className="border-b-4 border-blue-600 pb-8 mb-8 flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-blue-600 p-2 rounded-lg text-white">
                                <FileText className="w-8 h-8" />
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-gray-900">AUDITORÍA DE CONSUMOS</h1>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-sm flex items-center gap-2 text-gray-600">
                                <Building2 className="w-4 h-4 text-blue-500" />
                                <span className="font-bold">ENTIDAD:</span> {entityName}
                            </p>
                            <p className="text-sm flex items-center gap-2 text-gray-600">
                                <Calendar className="w-4 h-4 text-blue-500" />
                                <span className="font-bold">PERÍODO:</span> {formattedMonth}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Informes BI</p>
                        <p className="text-xs text-gray-500 mt-1">{format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-6 mb-10">
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Monto Total</p>
                        <p className="text-3xl font-black text-gray-900">{formatMoney(totals.total)}</p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Unidades</p>
                        <p className="text-3xl font-black text-gray-900">{totals.qty.toLocaleString()}</p>
                    </div>
                </div>

                {/* Table */}
                <div className="mb-12">
                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-widest flex items-center gap-2">
                        <Package className="w-4 h-4" /> DETALLE DE PRODUCTOS
                    </h3>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-900">
                                <th className="py-4 text-xs font-black uppercase tracking-wider">Producto</th>
                                <th className="py-4 text-xs font-black uppercase tracking-wider">Rubro</th>
                                <th className="py-4 text-center text-xs font-black uppercase tracking-wider px-4">Cant.</th>
                                <th className="py-4 text-right text-xs font-black uppercase tracking-wider">P. Unitario</th>
                                <th className="py-4 text-right text-xs font-black uppercase tracking-wider">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredProducts.length > 0 ? (
                                filteredProducts.map((p, i) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-4 text-sm font-medium text-gray-800">{p.name}</td>
                                        <td className="py-4 text-xs text-gray-500">{p.category}</td>
                                        <td className="py-4 text-center text-sm font-bold text-gray-600 px-4">{p.qty}</td>
                                        <td className="py-4 text-right text-sm text-gray-500">{formatMoney(p.lastPrice)}</td>
                                        <td className="py-4 text-right text-sm font-black text-gray-900">{formatMoney(p.total)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-gray-400 italic">No se hallaron registros para los criterios seleccionados.</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-gray-900 bg-gray-50">
                                <td colSpan={4} className="py-6 text-right font-black uppercase text-xs">Total General</td>
                                <td className="py-6 text-right font-black text-xl text-blue-600">{formatMoney(totals.total)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Footer */}
                <div className="mt-20 pt-8 border-t border-gray-100 text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-[0.2em]">Documento Interno de Auditoría</p>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media screen {
                    body.entity-report-active {
                        overflow: hidden !important;
                    }
                }

                @media print {
                    #root {
                        display: none !important;
                    }

                    #entity-report-portal {
                        display: block !important;
                        position: static !important;
                        visibility: visible !important;
                        width: 100% !important;
                        background: white !important;
                    }

                    .no-print, 
                    .sticky,
                    button {
                        display: none !important;
                    }

                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        transition: none !important;
                        animation: none !important;
                    }

                    @page {
                        margin: 1.5cm;
                        size: A4 portrait;
                    }
                }
            `}} />
        </div>,
        document.body
    );
};
