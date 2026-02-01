import React, { useMemo, useState } from 'react';
import { SaleRecord } from '../types';
import { formatMoney } from '../utils/dataHelpers';
import {
    Users, TrendingUp, ShoppingBag, DollarSign, Award,
    ArrowRightLeft, User, BarChart3, Target, Zap
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, Cell, ComposedChart, Line,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartRadar
} from 'recharts';
import { LiveSellersLeaderboard } from './LiveSellersLeaderboard';
import { SellerDetail } from './SellerDetail';

interface SellersDashboardProps {
    data: SaleRecord[];
    sellersList: string[];
    startDate: string;
    endDate: string;
    excludedProducts: string[];
    includedProducts: string[];
    excludedEntities: string[];
    includedEntities: string[];
    onSelectBranch: (branch: string) => void;
    selectedBranch: string;
}

export const SellersDashboard: React.FC<SellersDashboardProps> = ({
    data,
    sellersList,
    startDate,
    endDate,
    excludedProducts,
    includedProducts,
    excludedEntities,
    includedEntities,
    onSelectBranch,
    selectedBranch
}) => {
    const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
    const [compareSellerA, setCompareSellerA] = useState<string>('');
    const [compareSellerB, setCompareSellerB] = useState<string>('');

    // Filtered data for general analytics (respecting global filters)
    const filteredData = useMemo(() => {
        return (data || []).filter(d => {
            // Safe guards
            const pName = d.productName || '';
            const branchName = d.branch || ''; // Ensure string
            const currentEntity = d.entity || "Particular";

            let productMatch = true;
            if (includedProducts.length > 0) productMatch = includedProducts.includes(pName);
            else productMatch = !excludedProducts.includes(pName);

            let entityMatch = true;
            if (includedEntities.length > 0) entityMatch = includedEntities.includes(currentEntity);
            else entityMatch = !excludedEntities.includes(currentEntity);

            const selBranchLower = (selectedBranch || 'all').toLowerCase();
            const matchBranch = selBranchLower === 'all' || branchName.toLowerCase().includes(selBranchLower);

            return productMatch && entityMatch && matchBranch;
        });
    }, [data, includedProducts, excludedProducts, includedEntities, excludedEntities, selectedBranch]);

    // Comparison Logic
    const comparisonData = useMemo(() => {
        if (!compareSellerA || !compareSellerB) return null;

        const getSellerStats = (name: string) => {
            const sData = filteredData.filter(d => d.sellerName === name);
            const revenue = sData.reduce((acc, curr) => acc + curr.totalAmount, 0);
            const tickets = new Set(sData.map(d => d.invoiceNumber)).size;
            const units = sData.reduce((acc, curr) => acc + curr.quantity, 0);

            return {
                name,
                revenue,
                tickets,
                avgTicket: tickets > 0 ? revenue / tickets : 0,
                upt: tickets > 0 ? units / tickets : 0
            };
        };

        return {
            a: getSellerStats(compareSellerA),
            b: getSellerStats(compareSellerB)
        };
    }, [filteredData, compareSellerA, compareSellerB]);

    const chartData = useMemo(() => {
        if (!comparisonData) return [];
        return [
            {
                metric: 'Facturación ($)',
                [comparisonData.a.name]: comparisonData.a.revenue,
                [comparisonData.b.name]: comparisonData.b.revenue,
                fullMetric: 'Revenue'
            },
            {
                metric: 'Tickets (Cant.)',
                [comparisonData.a.name]: comparisonData.a.tickets * 1000, // Scale for demo
                fullMetric: 'Tickets'
            }
        ];
    }, [comparisonData]);

    if (selectedSeller) {
        return (
            <SellerDetail
                sellerName={selectedSeller}
                data={data}
                onBack={() => setSelectedSeller(null)}
                startDate={startDate}
                endDate={endDate}
                excludedProducts={excludedProducts}
                includedProducts={includedProducts}
                excludedEntities={excludedEntities}
                includedEntities={includedEntities}
            />
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                        <Users className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tighter uppercase">Panel de Vendedores</h2>
                        <p className="text-gray-400 font-medium text-sm">Análisis de rendimiento, comparativas y objetivos.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl shadow-sm border border-slate-100">
                        <Award className="w-4 h-4 text-indigo-500" />
                        <select
                            value={selectedBranch}
                            onChange={(e) => onSelectBranch(e.target.value)}
                            className="bg-transparent text-xs font-black text-slate-700 outline-none appearance-none cursor-pointer pr-4 uppercase"
                        >
                            <option value="all">TODAS SUCURSALES</option>
                            <option value="FCIA BIOSALUD">FCIA BIOSALUD</option>
                            <option value="CHACRAS">CHACRAS PARK</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* WIDE Sellers Leaderboard (CSV Mode) */}
            <LiveSellersLeaderboard offlineData={filteredData} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Comparison Module */}
                <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl overflow-hidden relative">
                    <div className="flex flex-wrap gap-3 w-full xl:w-auto items-end">
                        <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
                            Comparador
                        </h3>
                        <div className="flex items-center gap-3">
                            <select
                                value={compareSellerA}
                                onChange={e => setCompareSellerA(e.target.value)}
                                className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 shadow-sm"
                            >
                                <option value="">Vendedor A</option>
                                {sellersList.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <span className="font-black text-slate-300">VS</span>
                            <select
                                value={compareSellerB}
                                onChange={e => setCompareSellerB(e.target.value)}
                                className="bg-slate-50 border-0 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 shadow-sm"
                            >
                                <option value="">Vendedor B</option>
                                {sellersList.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {comparisonData ? (
                        <div className="space-y-8 mt-6">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 text-center">
                                    <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">Facturación A</p>
                                    <p className="text-sm font-black text-indigo-700">{formatMoney(comparisonData.a.revenue)}</p>
                                </div>
                                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 text-center">
                                    <p className="text-[9px] font-black text-emerald-400 uppercase mb-1">Facturación B</p>
                                    <p className="text-sm font-black text-emerald-700">{formatMoney(comparisonData.b.revenue)}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Ticket Medio A</p>
                                    <p className="text-sm font-black text-slate-700">{formatMoney(comparisonData.a.avgTicket)}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Ticket Medio B</p>
                                    <p className="text-sm font-black text-slate-700">{formatMoney(comparisonData.b.avgTicket)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Bar Chart Comparison */}
                                <div className="h-64 bg-slate-50/30 p-4 rounded-3xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Volumen de Tickets</p>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={[
                                            { name: 'Tickets', [comparisonData.a.name]: comparisonData.a.tickets, [comparisonData.b.name]: comparisonData.b.tickets }
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="name" hide />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey={comparisonData.a.name} fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                                            <Bar dataKey={comparisonData.b.name} fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Radar Chart Comparison */}
                                <div className="h-64 bg-slate-50/30 p-4 rounded-3xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Balance de Métricas</p>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                                            { subject: 'Facturación', A: 100, B: (comparisonData.b.revenue / comparisonData.a.revenue) * 100, fullMark: 150 },
                                            { subject: 'Tickets', A: 100, B: (comparisonData.b.tickets / comparisonData.a.tickets) * 100, fullMark: 150 },
                                            { subject: 'Avg Ticket', A: 100, B: (comparisonData.b.avgTicket / comparisonData.a.avgTicket) * 100, fullMark: 150 },
                                            { subject: 'UPT', A: 100, B: (comparisonData.b.upt / comparisonData.a.upt) * 100, fullMark: 150 }
                                        ]}>
                                            <PolarGrid stroke="#e2e8f0" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                            <RechartRadar name={comparisonData.a.name} dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                                            <RechartRadar name={comparisonData.b.name} dataKey="B" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                                            <Tooltip />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-20 text-center flex flex-col items-center justify-center bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-200 mt-6 group">
                            <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform duration-500">
                                <Zap className="w-10 h-10 text-indigo-400 animate-pulse" />
                            </div>
                            <p className="text-slate-400 font-bold text-sm px-12 leading-relaxed max-w-sm">
                                Seleccione dos vendedores de las listas desplegables para iniciar una comparación de rendimiento 360°.
                            </p>
                        </div>
                    )}
                </div>

                {/* List of Sellers with quick stats */}
                <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
                    <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                        <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-indigo-500" />
                            Referencia Completa
                        </h3>
                    </div>
                    <div className="overflow-y-auto max-h-[400px]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 bg-slate-50/20">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Nombre</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Facturado</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {sellersList.map(name => {
                                    const sData = filteredData.filter(d => d.sellerName === name);
                                    const revenue = sData.reduce((acc, curr) => acc + curr.totalAmount, 0);

                                    return (
                                        <tr key={name} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-slate-700 text-sm truncate block max-w-[120px]">{name}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-indigo-600 text-sm">{formatMoney(revenue)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => setSelectedSeller(name)} className="text-[10px] font-black uppercase text-indigo-500 underline">Detalle</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
