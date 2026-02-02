import React, { useMemo } from 'react';
import { SaleRecord } from '../types';
const ResponsiveContainer = ({ children }: any) => <div className="h-full w-full flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase border-2 border-dashed border-gray-100 rounded-xl">Medios de Pago</div>;
const PieChart = ({ children }: any) => <div>{children}</div>;
const Pie = () => null;
const Cell = () => null;
const Tooltip = () => null;
const Legend = () => null;
import { CreditCard } from 'lucide-react';
import { formatMoney } from '../utils/dataHelpers';

interface PaymentMethodChartProps {
    data: SaleRecord[];
}

export const PaymentMethodChart: React.FC<PaymentMethodChartProps> = ({ data }) => {
    const chartData = useMemo(() => {
        const map = new Map<string, number>();
        let hasData = false;

        data.forEach(d => {
            // Clean up payment method string
            let pm = d.paymentMethod?.trim() || 'Desconocido';

            // Simplify common terms (optional, depending on raw data quality)
            if (pm === '' || pm === '-') pm = 'Otros / Efectivo';
            if (pm.toLowerCase().includes('tarjeta')) pm = 'Tarjeta'; // Example simplification if needed, or keep detailed

            if (pm !== 'Desconocido' && pm !== '-') hasData = true;

            map.set(pm, (map.get(pm) || 0) + d.totalAmount);
        });

        if (!hasData) return [];

        return Array.from(map.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [data]);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

    if (chartData.length === 0) return null;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-400" />
                Ventas por Medio de Pago
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
                        <Tooltip formatter={(val: number) => formatMoney(val)} />
                        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
