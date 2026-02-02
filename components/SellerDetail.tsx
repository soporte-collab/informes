
import React, { useMemo } from 'react';
import { SaleRecord } from '../types';
const ResponsiveContainer = ({ children }: any) => <div className="h-full w-full flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase border-2 border-dashed border-gray-100 rounded-xl">Análisis Detallado</div>;
const BarChart = ({ children }: any) => <div>{children}</div>;
const Bar = () => null;
const XAxis = () => null;
const YAxis = () => null;
const CartesianGrid = () => null;
const Tooltip = () => null;
const Cell = () => null;
const PieChart = ({ children }: any) => <div>{children}</div>;
const Pie = () => null;
const Legend = () => null;
const ReferenceLine = () => null;
const ComposedChart = ({ children }: any) => <div>{children}</div>;
const Line = () => null;
import { formatMoney } from '../utils/dataHelpers';
import { User, Award, TrendingUp, Filter, Clock, Package, AlertCircle, Calendar, Building } from 'lucide-react';
import { format, startOfWeek, endOfWeek, isSameWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { SalesHeatmap } from './SalesHeatmap';
import { HeatmapDetailModal } from './HeatmapDetailModal';

interface SellerDetailProps {
    sellerName: string;
    data: SaleRecord[];
    onBack: () => void;
    startDate: string;
    endDate: string;
    excludedProducts: string[];
    includedProducts: string[];
    excludedEntities: string[];
    includedEntities: string[];
}

export const SellerDetail: React.FC<SellerDetailProps> = ({
    sellerName,
    data,
    onBack,
    startDate,
    endDate,
    excludedProducts,
    includedProducts,
    excludedEntities,
    includedEntities
}) => {

    // 1. Base filter for the seller
    const sellerData = useMemo(() => {
        return data.filter(d => {
            const matchName = d.sellerName === sellerName;

            // Product Filter
            let productMatch = true;
            if (includedProducts.length > 0) {
                productMatch = includedProducts.includes(d.productName);
            } else {
                productMatch = !excludedProducts.includes(d.productName);
            }

            // Entity Filter (Replaces Client)
            let entityMatch = true;
            const currentEntity = d.entity || "Particular";
            if (includedEntities.length > 0) {
                entityMatch = includedEntities.includes(currentEntity);
            } else {
                entityMatch = !excludedEntities.includes(currentEntity);
            }

            return matchName && productMatch && entityMatch;
        });
    }, [data, sellerName, excludedProducts, includedProducts, excludedEntities, includedEntities]);

    // Local Filter States (Initialized with global filters but locally mutable)
    const [localStartDate, setLocalStartDate] = React.useState(startDate);
    const [localEndDate, setLocalEndDate] = React.useState(endDate);
    const [selectedBranch, setSelectedBranch] = React.useState('all');
    // Initialize month based on props if they match a full month, otherwise 'custom' or 'all'
    const [selectedMonth, setSelectedMonth] = React.useState(() => {
        if (!startDate || !endDate) return 'history';
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        // Check if it matches a full month
        // Simple check: start is 1st of month, end is last day (approx check or exact)
        // Here we default to 'custom' if dates are set, or 'history' if not. 
        // We can refine this logic if needed to match "Enero 2024" etc.
        return 'custom';
    });

    // Update local state when props change (re-sync if global filters change externally)
    React.useEffect(() => {
        setLocalStartDate(startDate);
        setLocalEndDate(endDate);
        if (!startDate && !endDate) setSelectedMonth('history');
        else setSelectedMonth('custom');
    }, [startDate, endDate]);

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedMonth(val);
        if (val === 'history') {
            setLocalStartDate('');
            setLocalEndDate('');
        } else if (val === 'custom') {
            // Do nothing, wait for user input
        } else {
            const parts = (val || "").split('-');
            if (parts.length === 2) {
                const year = Number(parts[0]);
                const month = Number(parts[1]);
                const firstDay = new Date(year, month - 1, 1);
                const lastDay = new Date(year, month, 0);
                setLocalStartDate(format(firstDay, 'yyyy-MM-dd'));
                setLocalEndDate(format(lastDay, 'yyyy-MM-dd'));
            }
        }
    };

    // Calculate available months for the dropdown based on THIS seller's data
    const monthOptions = useMemo(() => {
        const uniqueMonths = new Set(sellerData.map(d => d.monthYear).filter(Boolean)); // "YYYY-MM"
        return Array.from(uniqueMonths).sort().reverse().map((m: string) => {
            const parts = m.split('-');
            const y = Number(parts[0]);
            const mo = Number(parts[1]);
            const date = new Date(y, mo - 1);
            return { value: m, label: format(date, 'MMMM yyyy', { locale: es }) };
        });
    }, [sellerData]);


    // 2. Data strictly respecting the LOCAL Date Range & Branch filter
    const filteredSellerData = useMemo(() => {
        return sellerData.filter(d => {
            // Branch Filter
            const matchBranch = selectedBranch === 'all' || d.branch.includes(selectedBranch);

            // Date Filter
            let matchDate = true;
            if (localStartDate) {
                const start = new Date(localStartDate + 'T00:00:00');
                if (d.date < start) matchDate = false;
            }
            if (matchDate && localEndDate) {
                const end = new Date(localEndDate + 'T23:59:59');
                if (d.date > end) matchDate = false;
            }
            return matchBranch && matchDate;
        });
    }, [sellerData, localStartDate, localEndDate, selectedBranch]);

    const [isHeatmapModalOpen, setIsHeatmapModalOpen] = React.useState(false);
    const [activeHeatmapSlot, setActiveHeatmapSlot] = React.useState<{ dayIndex: number, hour: number, dayName: string } | null>(null);
    const [selectedWeek, setSelectedWeek] = React.useState('all');

    // Extract available weeks from filtered data
    const weekOptions = useMemo(() => {
        const weeksMap = new Map<string, { label: string, start: Date }>();

        filteredSellerData.forEach(d => {
            const startStr = startOfWeek(d.date, { weekStartsOn: 1 }).toISOString();
            if (!weeksMap.has(startStr)) {
                const start = startOfWeek(d.date, { weekStartsOn: 1 });
                const end = endOfWeek(d.date, { weekStartsOn: 1 });
                const label = `Semana del ${format(start, 'dd/MM', { locale: es })} al ${format(end, 'dd/MM', { locale: es })}`;
                weeksMap.set(startStr, { label, start });
            }
        });

        return Array.from(weeksMap.entries())
            .sort((a, b) => a[1].start.getTime() - b[1].start.getTime())
            .map(([value, { label }]) => ({ value, label }));
    }, [filteredSellerData]);

    // Filter heatmap data based on selected week
    const heatmapDisplayData = useMemo(() => {
        if (selectedWeek === 'all') return filteredSellerData;
        const selectedDate = new Date(selectedWeek);
        return filteredSellerData.filter(d => isSameWeek(d.date, selectedDate, { weekStartsOn: 1 }));
    }, [filteredSellerData, selectedWeek]);

    const stats = useMemo(() => {
        const totalSales = filteredSellerData.reduce((acc, curr) => acc + curr.totalAmount, 0);
        const totalQty = filteredSellerData.reduce((acc, curr) => acc + curr.quantity, 0);
        const totalTransactions = filteredSellerData.length;

        // UPT
        const upt = totalTransactions > 0 ? totalQty / totalTransactions : 0;

        // Days worked calculation for Average
        const uniqueDates = new Set(filteredSellerData.map(d => format(d.date, 'yyyy-MM-dd')));
        const daysWorked = uniqueDates.size || 1;
        const avgDailyQty = totalQty / daysWorked;

        // Top Products
        const productMap = new Map<string, number>();
        filteredSellerData.forEach(s => {
            productMap.set(s.productName, (productMap.get(s.productName) || 0) + 1);
        });
        const topProducts = Array.from(productMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        // Branch Split
        const branchMap = new Map<string, number>();
        filteredSellerData.forEach(s => {
            if (s.totalAmount > 0) { // Only count positive sales for branch distribution pie
                branchMap.set(s.branch, (branchMap.get(s.branch) || 0) + s.totalAmount);
            }
        });
        const branchData = Array.from(branchMap.entries()).map(([name, value]) => ({ name, value }));

        // Hourly Distribution for Chart
        const hours = new Array(24).fill(0);
        filteredSellerData.forEach(d => {
            if (d.hour >= 0 && d.hour < 24) hours[d.hour] += d.quantity;
        });
        const hourlyData = hours.map((qty, h) => ({ hour: `${h}h`, qty })).slice(8, 22); // 8am - 10pm

        return { totalSales, totalTransactions, totalQty, upt, avgDailyQty, topProducts, branchData, hourlyData };
    }, [filteredSellerData]);


    // 3. Evolution Data (Monthly Performance) - Always uses all months
    const evolutionData = useMemo(() => {
        const map = new Map<string, {
            month: string,
            positive: number,
            negative: number,
            net: number,
            label: string
        }>();

        sellerData.forEach(d => {
            const key = d.monthYear;
            if (!key) return; // Skip records without date info

            if (!map.has(key)) {
                // Manual parsing of YYYY-MM
                const parts = key.split('-');
                const y = Number(parts[0]);
                const m = Number(parts[1]);
                const dateObj = new Date(y, m - 1);
                const label = format(dateObj, 'MMM yy', { locale: es });
                map.set(key, { month: key, positive: 0, negative: 0, net: 0, label });
            }
            const entry = map.get(key)!;

            if (d.totalAmount >= 0) {
                entry.positive += d.totalAmount;
            } else {
                entry.negative += d.totalAmount; // This will be a negative number
            }
            entry.net += d.totalAmount;
        });

        const sorted = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));

        // Calculate Percent Change
        return sorted.map((item, index) => {
            let percentChange = 0;
            if (index > 0) {
                const prev = sorted[index - 1].net;
                if (prev !== 0) {
                    percentChange = ((item.net - prev) / Math.abs(prev)) * 100;
                }
            }
            return { ...item, percentChange };
        });

    }, [sellerData]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    const dateLabel = useMemo(() => {
        if (!startDate && !endDate) return 'Histórico completo';
        const startStr = startDate ? format(new Date(startDate + 'T00:00:00'), 'dd/MM/yy') : 'Inicio';
        const endStr = endDate ? format(new Date(endDate + 'T00:00:00'), 'dd/MM/yy') : 'Hoy';
        return `${startStr} - ${endStr}`;
    }, [startDate, endDate]);

    const hasDateFilter = !!(startDate || endDate);
    const activeFilters = hasDateFilter || excludedProducts.length > 0 || includedProducts.length > 0 || excludedEntities.length > 0 || includedEntities.length > 0;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <button
                        onClick={onBack}
                        className="text-sm text-biosalud-600 hover:text-biosalud-800 font-medium flex items-center mb-1"
                    >
                        ← Volver al Dashboard
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <User className="w-6 h-6" />
                        {sellerName}
                    </h2>
                </div>

                {/* Local Filters Bar */}
                <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-gray-100 shadow-sm w-full lg:w-auto">
                    {/* Branch Filter */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Building className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <select
                            className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all cursor-pointer hover:bg-white min-w-[140px]"
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                        >
                            <option value="all">Todas las Sucursales</option>
                            <option value="CHACRAS">Chacras Park</option>
                            <option value="FCIA">Farmacia Biosalud</option>
                        </select>
                    </div>

                    <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block"></div>

                    {/* Month Pre-sets */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Calendar className="h-4 w-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
                        </div>
                        <select
                            className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all cursor-pointer hover:bg-white min-w-[140px]"
                            value={selectedMonth}
                            onChange={handleMonthChange}
                        >
                            <option value="history">Histórico Completo</option>
                            {monthOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label.charAt(0).toUpperCase() + option.label.slice(1)}
                                </option>
                            ))}
                            <option value="custom">Per. Personalizado</option>
                        </select>
                    </div>

                    {/* Date Inputs */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <input
                                type="date"
                                className="pl-3 pr-2 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-colors w-36"
                                value={localStartDate}
                                onChange={(e) => {
                                    setLocalStartDate(e.target.value);
                                    setSelectedMonth('custom');
                                }}
                            />
                        </div>
                        <span className="text-gray-400">-</span>
                        <div className="relative">
                            <input
                                type="date"
                                className="pl-3 pr-2 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-colors w-36"
                                value={localEndDate}
                                onChange={(e) => {
                                    setLocalEndDate(e.target.value);
                                    setSelectedMonth('custom');
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Promedio Diario (Unid.)</p>
                    <h3 className="text-2xl font-bold text-blue-600">{Math.round(stats.avgDailyQty)}</h3>
                    <p className="text-xs text-blue-400 mt-1">Basado en días activos</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Total Unidades</p>
                    <h3 className="text-2xl font-bold text-gray-800">{stats.totalQty.toLocaleString()}</h3>
                </div>
                <div className={`p-6 rounded-xl shadow-sm border ${stats.upt < 1.2 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                    <p className={`text-sm ${stats.upt < 1.2 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>UPT (Unid. por Ticket)</p>
                    <h3 className={`text-2xl font-bold ${stats.upt < 1.2 ? 'text-red-700' : 'text-purple-600'}`}>{stats.upt.toFixed(2)}</h3>
                    {stats.upt < 1.2 && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Posible división de tickets</p>}
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Ventas Netas ($)</p>
                    <h3 className="text-2xl font-bold text-green-600">{formatMoney(stats.totalSales)}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Evolution Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-gray-400" />
                        Evolución Mensual (Ventas vs Devoluciones)
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={evolutionData} stackOffset="sign">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="label" fontSize={12} />
                                <YAxis fontSize={12} tickFormatter={(val) => `$${val / 1000}k`} />
                                <Tooltip
                                    formatter={(value: number, name: string) => [formatMoney(value), name === 'positive' ? 'Ventas' : name === 'negative' ? 'Devoluciones' : 'Neto']}
                                />
                                <ReferenceLine y={0} stroke="#9ca3af" />
                                <Bar dataKey="positive" fill="#22c55e" name="Ventas" stackId="stack" barSize={30} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                <Bar dataKey="negative" fill="#ef4444" name="Devoluciones" stackId="stack" barSize={30} radius={[0, 0, 4, 4]} isAnimationActive={false} />
                                <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="Neto" isAnimationActive={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Hourly Rhythm Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-400" />
                        Ritmo Horario (Por Cantidad de Productos)
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.hourlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="hour" fontSize={12} />
                                <YAxis fontSize={12} />
                                <Tooltip
                                    formatter={(val: number) => [val, 'Unidades Vendidas']}
                                    cursor={{ fill: '#f3f4f6' }}
                                />
                                <Bar dataKey="qty" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Unidades" barSize={30} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* NEW: Seller Heatmap */}
            <div className="w-full bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-gray-400" />
                        Mapa de Calor {selectedWeek !== 'all' ? '(Semana Específica)' : '(Promedio del Periodo)'}
                    </h3>

                    {weekOptions.length > 0 && (
                        <div className="relative">
                            <select
                                className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                value={selectedWeek}
                                onChange={(e) => setSelectedWeek(e.target.value)}
                            >
                                <option value="all">Todas las Semanas (Promedio)</option>
                                {weekOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    )}
                </div>

                <SalesHeatmap
                    data={heatmapDisplayData}
                    onCellClick={(dayIndex, hour, dayName) => {
                        setActiveHeatmapSlot({ dayIndex, hour, dayName });
                        setIsHeatmapModalOpen(true);
                    }}
                />
            </div>

            <HeatmapDetailModal
                isOpen={isHeatmapModalOpen}
                onClose={() => setIsHeatmapModalOpen(false)}
                data={heatmapDisplayData}
                activeSlot={activeHeatmapSlot}
                setActiveSlot={setActiveHeatmapSlot}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Products */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Award className="w-5 h-5 text-gray-400" />
                        Top 5 Productos Vendidos
                    </h3>
                    <div className="space-y-4">
                        {stats.topProducts.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0">
                                <span className="text-sm font-medium text-gray-700 truncate w-2/3" title={p.name}>{p.name}</span>
                                <span className="text-sm font-bold text-biosalud-600">{p.count} unid.</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Branch Distribution */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold mb-4">Ventas por Sucursal</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.branchData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    isAnimationActive={false}
                                >
                                    {stats.branchData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatMoney(value)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
