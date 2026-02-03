import React, { useState, useEffect, useMemo } from 'react';
import {
    Activity, Clock, Truck, AlertTriangle,
    TrendingUp, Package, RefreshCw, Zap,
    Building2, ChevronRight, BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../src/firebaseConfig';
import { formatMoney } from '../utils/dataHelpers';
import {
    subscribeToPendingOrders,
    subscribeToUpcomingExpirations
} from '../utils/crossProjectService';

/**
 * LIVE DASHBOARD RESTRUCTURADO (v2.0)
 * Sin dependencias externas de gráficos. 
 * Diseño ultra-estable y defensivo.
 */

export const LiveDashboard: React.FC = () => {
    const [pendingOrders, setPendingOrders] = useState<any[]>([]);
    const [upcomingMeds, setUpcomingMeds] = useState<any[]>([]);
    const [liveSales, setLiveSales] = useState<any[]>([]);
    const [lastSync, setLastSync] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // 1. Suscripciones Externas (Delivery y Vencidos)
    useEffect(() => {
        const unsubOrders = subscribeToPendingOrders((data) => setPendingOrders(data || []));
        const unsubMeds = subscribeToUpcomingExpirations((data) => setUpcomingMeds(data || []));

        return () => {
            if (unsubOrders) unsubOrders();
            if (unsubMeds) unsubMeds();
        };
    }, []);

    // 2. Suscripción a Ventas Zetti (Proyecto Local)
    useEffect(() => {
        const q = query(
            collection(db, 'zetti_responses'),
            where('type', '==', 'hourly_sale'),
            orderBy('syncedAt', 'desc'),
            limit(20)
        );

        const unsub = onSnapshot(q, (snap) => {
            const sales = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLiveSales(sales);
            setLoading(false);
        }, (err) => {
            console.error("Local Sales Subscription Error:", err);
            setLoading(false);
        });

        const metaUnsub = onSnapshot(query(collection(db, 'zetti_metadata'), limit(1)), (snap) => {
            if (!snap.empty) setLastSync(snap.docs[0].data());
        });

        return () => {
            unsub();
            metaUnsub();
        };
    }, []);

    // --- LÓGICA DE NEGOCIO ---

    const stats = useMemo(() => {
        const orders = Array.isArray(pendingOrders) ? pendingOrders : [];
        const enCamino = orders.filter(o => o.estado === 'EN_CAMINO').length;
        const disponible = orders.filter(o => o.estado === 'DISPONIBLE').length;

        const topProducts: Record<string, number> = {};
        orders.forEach(o => {
            (o.productos || []).forEach((p: any) => {
                const n = p.name || p.nom;
                if (n) topProducts[n] = (topProducts[n] || 0) + 1;
            });
        });

        return {
            delivery: {
                total: orders.length,
                enCamino,
                disponible,
                ranking: Object.entries(topProducts)
                    .map(([name, qty]) => ({ name, qty }))
                    .sort((a, b) => b.qty - a.qty)
                    .slice(0, 5)
            },
            sales: {
                bio: liveSales.filter(s => s.branch === 'BIOSALUD'),
                chacras: liveSales.filter(s => s.branch === 'CHACRAS')
            }
        };
    }, [pendingOrders, liveSales]);

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto p-2">

            {/* Cabecera Interactiva */}
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-100 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 tracking-tighter uppercase leading-none">Monitor Central</h1>
                        <p className="text-[10px] font-black text-blue-600/60 uppercase tracking-[0.2em] mt-1">Conexión Directa Multicanal</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 pointer-events-none">Sincro Zetti</p>
                        <p className="text-sm font-black text-gray-700 font-mono">
                            {lastSync?.lastSyncAt ? format(new Date((lastSync.lastSyncAt.seconds || 0) * 1000), 'HH:mm:ss') : '--:--:--'}
                        </p>
                    </div>
                    <div className="h-10 w-px bg-gray-100"></div>
                    <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase">Live</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* SECCIÓN DELIVERY (6/12) */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Card En Camino */}
                        <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-700 p-8 rounded-[40px] text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
                            <Truck className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10 group-hover:rotate-12 transition-transform duration-500" />
                            <div className="flex items-center gap-3 mb-4">
                                <span className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><Zap className="w-4 h-4" /></span>
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">En Reparto</span>
                            </div>
                            <h2 className="text-6xl font-black tracking-tighter">{stats.delivery.enCamino}</h2>
                            <p className="text-[11px] font-black uppercase tracking-widest mt-2 opacity-60 italic">Pedidos con Cadete</p>
                        </div>

                        {/* Card Disponible */}
                        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-colors">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="bg-blue-50 p-2 rounded-xl"><Clock className="w-4 h-4 text-blue-600" /></span>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pendientes</span>
                            </div>
                            <h2 className="text-6xl font-black text-gray-800 tracking-tighter">{stats.delivery.disponible}</h2>
                            <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mt-2">Listos en sucursal</p>
                        </div>
                    </div>

                    {/* Gráfico de Ranking Reemplazado por Barras CSS */}
                    <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Productos Hot Delivery</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Demanda por ítem en tiempo real</p>
                            </div>
                            <BarChart3 className="w-6 h-6 text-gray-300" />
                        </div>
                        <div className="space-y-5">
                            {stats.delivery.ranking.length === 0 ? (
                                <div className="py-12 text-center text-gray-300 italic text-sm">Cargando inteligencia de datos...</div>
                            ) : (
                                stats.delivery.ranking.map((p, i) => {
                                    const max = stats.delivery.ranking[0].qty;
                                    const percent = (p.qty / max) * 100;
                                    return (
                                        <div key={i} className="space-y-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[11px] font-black text-gray-700 uppercase">{p.name}</span>
                                                <span className="text-xs font-bold text-blue-600">{p.qty}u</span>
                                            </div>
                                            <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out"
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* SECCIÓN VENCIMIENTOS (5/12) */}
                <div className="lg:col-span-5">
                    <div className="bg-slate-900 p-8 rounded-[48px] h-full shadow-2xl relative overflow-hidden group border-t-8 border-rose-500">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="bg-rose-500/20 p-3 rounded-2xl border border-rose-500/30">
                                    <AlertTriangle className="w-6 h-6 text-rose-500" />
                                </div>
                                <div>
                                    <h3 className="text-white font-black uppercase tracking-tighter text-xl">Vencimientos</h3>
                                    <p className="text-rose-500/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Próximos 90 Días</p>
                                </div>
                            </div>
                            <TrendingUp className="w-6 h-6 text-rose-500 opacity-30" />
                        </div>

                        <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                            {upcomingMeds.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                                    <RefreshCw className="w-12 h-12 text-white animate-spin-slow mb-4" />
                                    <p className="text-white text-[10px] font-black uppercase tracking-widest text-center">Escaneando Inventario...</p>
                                </div>
                            ) : (
                                upcomingMeds.map((m, idx) => (
                                    <div key={idx} className="bg-white/5 hover:bg-white/10 p-5 rounded-3xl border border-white/5 transition-all group/item">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-xs font-black text-gray-100 uppercase leading-tight group-hover/item:text-rose-400 transition-colors">{m.name}</h4>
                                            <span className="bg-rose-600/20 text-rose-500 text-[10px] font-black px-2 py-1 rounded-lg border border-rose-500/20">
                                                90d
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-3.5 h-3.5 text-gray-500" />
                                                <span className="text-[10px] font-black text-gray-400 uppercase">{m.branch || 'Suc. Central'}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-rose-400/80 italic">EXP: {m.expirationDate}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* BARRA DE VENTAS LIVE (ZETTI) */}
            <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div>
                        <h2 className="text-3xl font-black text-gray-800 tracking-tighter uppercase leading-none">Ventas en Tiempo Real</h2>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2 italic shadow-sm bg-gray-50/50 w-fit px-3 py-1 rounded-full">Feed Directo ZETTI API</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl border border-emerald-100">
                            <p className="text-[9px] font-black uppercase opacity-60">Total Hoy (Zetti)</p>
                            <p className="text-xl font-black">{formatMoney(liveSales.reduce((a, b) => a + (b.amount || 0), 0))}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-x-0 md:divide-x divide-gray-100">
                    {/* BIOSALUD */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-emerald-500/10 p-5 rounded-[32px] border border-emerald-500/20">
                            <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-100"><Package className="w-5 h-5 text-white" /></div>
                            <div>
                                <h4 className="text-sm font-black text-gray-800 uppercase italic tracking-wider">Biosalud Paseo</h4>
                                <p className="text-[10px] font-black text-emerald-600 uppercase">{stats.sales.bio.length} Ventas recientes</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {stats.sales.bio.map((s, i) => (
                                <div key={i} className="flex justify-between items-center p-4 bg-white hover:bg-gray-50 rounded-[28px] border border-transparent hover:border-gray-100 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="text-[10px] font-black text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded-lg italic">{s.issueDate ? format(new Date(s.issueDate), 'HH:mm') : '--:--'}</div>
                                        <div>
                                            <p className="text-xs font-black text-gray-800 uppercase flex items-center gap-2">
                                                <ChevronRight className="w-3 h-3 text-emerald-500" />
                                                {(s.items?.[0]?.productName || 'Venta Varia').slice(0, 30)}...
                                            </p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 ml-5">{s.seller || 'Sistema'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-gray-800 tracking-tighter">{formatMoney(s.amount)}</p>
                                        <p className="text-[9px] font-black text-emerald-600 group-hover:underline opacity-60 uppercase">{s.paymentMethod || 'Contado'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CHACRAS */}
                    <div className="space-y-6 pl-0 md:pl-8">
                        <div className="flex items-center gap-4 bg-blue-600/10 p-5 rounded-[32px] border border-blue-600/20">
                            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-100"><Package className="w-5 h-5 text-white" /></div>
                            <div>
                                <h4 className="text-sm font-black text-gray-800 uppercase italic tracking-wider">Chacras Park</h4>
                                <p className="text-[10px] font-black text-blue-600 uppercase">{stats.sales.chacras.length} Ventas recientes</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {stats.sales.chacras.map((s, i) => (
                                <div key={i} className="flex justify-between items-center p-4 bg-white hover:bg-gray-50 rounded-[28px] border border-transparent hover:border-gray-100 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="text-[10px] font-black text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded-lg italic">{s.issueDate ? format(new Date(s.issueDate), 'HH:mm') : '--:--'}</div>
                                        <div>
                                            <p className="text-xs font-black text-gray-800 uppercase flex items-center gap-2">
                                                <ChevronRight className="w-3 h-3 text-blue-500" />
                                                {(s.items?.[0]?.productName || 'Venta Varia').slice(0, 30)}...
                                            </p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 ml-5">{s.seller || 'Sistema'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-gray-800 tracking-tighter">{formatMoney(s.amount)}</p>
                                        <p className="text-[9px] font-black text-blue-600 group-hover:underline opacity-60 uppercase">{s.paymentMethod || 'Contado'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 10s linear infinite;
                }
            `}</style>
        </div>
    );
};
