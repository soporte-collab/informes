import React, { useMemo } from 'react';
import { InvoiceRecord } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { CreditCard } from 'lucide-react';
import { formatMoney } from '../utils/dataHelpers';

interface InvoicePaymentChartProps {
    data: InvoiceRecord[];
}

export const InvoicePaymentChart: React.FC<InvoicePaymentChartProps> = ({ data }) => {
    const chartData = useMemo(() => {
        const map = new Map<string, number>();
        data.forEach(d => {
            // Only count positive amounts (Sales), exclude Credit Notes for this distribution usually?
            // Or strictly sum netAmount.
            if (d.netAmount > 0) {
                const type = d.paymentType || 'Desconocido';
                map.set(type, (map.get(type) || 0) + d.netAmount);
            }
        });

        return Array.from(map.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [data]);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#ec4899', '#6366f1'];

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-400" />
                Medios de Pago (Facturación)
            </h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatMoney(value)} />
                        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
