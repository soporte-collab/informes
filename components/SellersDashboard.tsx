import React, { useMemo, useState } from 'react';
import { SaleRecord } from '../types';
import { formatMoney } from '../utils/dataHelpers';
import {
    Users, TrendingUp, ShoppingBag, DollarSign, Award,
    ArrowRightLeft, User, BarChart3, Target, Zap, X, Trash2
} from 'lucide-react';

const ResponsiveContainer = ({ children }: any) => <div className="h-full w-full bg-gray-50 rounded-2xl flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase border-2 border-dashed border-gray-100">Gráfico Desactivado</div>;
const BarChart = ({ children }: any) => <div>{children}</div>;
const Bar = () => null;
const XAxis = () => null;
const YAxis = () => null;
const CartesianGrid = () => null;
const Tooltip = () => null;
const RadarChart = ({ children }: any) => <div>{children}</div>;
const PolarGrid = () => null;
const PolarAngleAxis = () => null;
const RechartRadar = () => null;
const ComposedChart = ({ children }: any) => <div>{children}</div>;

import { LiveSellersLeaderboard } from './LiveSellersLeaderboard';
import { SellerDetail } from './SellerDetail';

interface SellersDashboardProps {
    data: SaleRecord[];
    sellersList: string[];
    startDate: string;
    endDate: string;
    onSelectBranch: (branch: string) => void;
    selectedBranch: string;
    sellerMappings?: Record<string, string>;
    onUpdateMappings?: (mappings: Record<string, string>) => void;
}

export const SellersDashboard: React.FC<SellersDashboardProps> = ({
    data,
    sellersList,
    startDate,
    endDate,
    onSelectBranch,
    selectedBranch,
    sellerMappings = {},
    onUpdateMappings
}) => {
    const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
    const [compareSellerA, setCompareSellerA] = useState<string>('');
    const [compareSellerB, setCompareSellerB] = useState<string>('');
    const [showMappingModal, setShowMappingModal] = useState(false);

    // Filtered data for general analytics (respecting global filters)
    const filteredData = useMemo(() => {
        return (data || []);
    }, [data]);

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

    if (selectedSeller) {
        return (
            <SellerDetail
                sellerName={selectedSeller}
                data={data}
                onBack={() => setSelectedSeller(null)}
                startDate={startDate}
                endDate={endDate}
                excludedProducts={[]}
                includedProducts={[]}
                excludedEntities={[]}
                includedEntities={[]}
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

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setShowMappingModal(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"
                    >
                        <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                        Vincular Alias Zetti
                    </button>
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

            {/* Mapping Modal */}
            {showMappingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tighter">Vinculación de Alias</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase">Maestro de Vendedores Zetti → RRHH</p>
                            </div>
                            <button onClick={() => setShowMappingModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 col-span-2">
                                    <p className="text-[10px] font-black text-amber-700 uppercase leading-relaxed">
                                        Asigne un nombre de visualización (o nombre real de empleado) a los alias que devuelve Zetti.
                                        Esto unificará los datos en todos los módulos de RRHH y Rendimiento.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-2xl space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase">Nuevo Vínculo</h4>
                                    <input
                                        type="text"
                                        placeholder="Alias en Zetti (ej: ALE_V)"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none uppercase"
                                        id="zetti-alias"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Nombre Visible (ej: Alexis)"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none uppercase"
                                        id="mapped-name"
                                    />
                                    <button
                                        onClick={() => {
                                            const aliasInput = document.getElementById('zetti-alias') as HTMLInputElement;
                                            const nameInput = document.getElementById('mapped-name') as HTMLInputElement;
                                            const alias = aliasInput.value.toUpperCase();
                                            const name = nameInput.value;
                                            if (alias && name && onUpdateMappings) {
                                                onUpdateMappings({ ...sellerMappings, [alias]: name });
                                                aliasInput.value = '';
                                                nameInput.value = '';
                                            }
                                        }}
                                        className="w-full bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                    >
                                        Vincular Vendedor
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase">Vínculos Activos</h4>
                                    <div className="max-h-[250px] overflow-y-auto space-y-2 pr-2">
                                        {Object.entries(sellerMappings).map(([alias, name]) => (
                                            <div key={alias} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl group">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase">{alias}</p>
                                                    <p className="text-xs font-bold text-slate-800 uppercase">{name}</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const newMappings = { ...sellerMappings };
                                                        delete newMappings[alias];
                                                        if (onUpdateMappings) onUpdateMappings(newMappings);
                                                    }}
                                                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {Object.keys(sellerMappings).length === 0 && (
                                            <p className="text-center py-8 text-slate-300 text-[10px] font-bold uppercase italic">No hay vinculaciones creadas</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
