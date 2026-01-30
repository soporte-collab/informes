import React, { useMemo } from 'react';
import { InvoiceRecord } from '../types';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format, differenceInDays, startOfMonth, eachDayOfInterval, eachMonthOfInterval, isSameDay, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';
import { formatMoney } from '../utils/dataHelpers';

interface InvoiceTrendChartProps {
    data: InvoiceRecord[];
    dateRange: { start: string, end: string };
}

export const InvoiceTrendChart: React.FC<InvoiceTrendChartProps> = ({ data, dateRange }) => {
    const chartData = useMemo(() => {
        if (data.length === 0) return [];

        // Determine granularity
        let useDaily = false;
        if (dateRange.start && dateRange.end) {
            const diff = differenceInDays(new Date(dateRange.end), new Date(dateRange.start));
            useDaily = diff <= 60; // Show daily if range is 2 months or less
        } else {
            // If no explicit range, check data spread. If simple, default to monthly for full history
            useDaily = false;
        }

        // Sort data
        const sorted = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
        if (sorted.length === 0) return [];

        const firstDate = sorted[0].date;
        const lastDate = sorted[sorted.length - 1].date;

        let groupedData: any[] = [];

        if (useDaily) {
            // Generate all days in interval to avoid gaps
            const interval = { start: new Date(dateRange.start || firstDate), end: new Date(dateRange.end || lastDate) };
            const days = eachDayOfInterval(interval);

            groupedData = days.map(day => {
                const dayRecords = sorted.filter(d => isSameDay(d.date, day));
                const net = dayRecords.reduce((acc, curr) => acc + curr.netAmount, 0);
                return {
                    label: format(day, 'dd MMM', { locale: es }),
                    date: day,
                    net: net
                };
            });

        } else {
            // Monthly grouping
            const monthMap = new Map<string, number>();

            sorted.forEach(d => {
                const key = format(d.date, 'yyyy-MM');
                monthMap.set(key, (monthMap.get(key) || 0) + d.netAmount);
            });

            // Fill gaps if needed, but for monthly usually ok to show what we have or sort keys
            groupedData = Array.from(monthMap.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([key, val]) => {
                    const [y, m] = key.split('-').map(Number);
                    const date = new Date(y, m - 1);
                    return {
                        label: format(date, 'MMM yy', { locale: es }),
                        net: val
                    };
                });
        }

        return groupedData;
    }, [data, dateRange]);

    if (chartData.length === 0) return null;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-gray-400" />
                Evolución de Facturación ({chartData.length > 31 ? 'Mensual' : 'Diaria'})
            </h3>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" fontSize={12} tickMargin={10} />
                        <YAxis tickFormatter={(val) => `$${val / 1000}k`} fontSize={12} />
                        <Tooltip formatter={(value: number) => formatMoney(value)} />
                        <Legend />
                        <Bar dataKey="net" name="Facturación Neta" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={chartData.length > 20 ? 10 : 30} />
                        <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Tendencia" />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
