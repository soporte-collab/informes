import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, Timestamp, doc } from 'firebase/firestore';
import { db, functions } from '../src/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { Award, Zap, TrendingUp, Clock, User, ShoppingCart, Target, Trophy, Flame, ShieldCheck, RefreshCw, Calendar, ArrowLeft } from 'lucide-react';
import { formatMoney } from '../utils/dataHelpers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { triggerManualSync } from '../utils/zettiService';

interface LiveSale {
    id: string;
    issueDate: string;
    amount: number;
    seller: string;
    branch: string;
    items?: Array<{ name: string; qty: number; price: number }>;
}

interface SyncMetadata {
    lastSyncAt: Timestamp | null;
    type: 'automatic' | 'manual';
    recordsProcessed: number;
}

export const LiveSellersLeaderboard: React.FC = () => {
    const [liveSales, setLiveSales] = useState<LiveSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [filter, setFilter] = useState<'TODO' | 'BIOSALUD' | 'CHACRAS'>('TODO');
    const [viewMode, setViewMode] = useState<'LIVE' | 'HISTORIC'>('LIVE');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [syncMeta, setSyncMeta] = useState<SyncMetadata | null>(null);

    const handleManualSync = async () => {
        try {
            setSyncing(true);
            await triggerManualSync();
            setSyncing(false);
        } catch (err) {
            console.error("Manual Sync Error:", err);
            setSyncing(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        let q;

        if (viewMode === 'LIVE') {
            q = query(
                collection(db, 'zetti_responses'),
                orderBy('syncedAt', 'desc'),
                limit(300)
            );
        } else {
            // Buscamos ventas que empiecen con la fecha seleccionada
            const startStr = `${selectedDate}T00:00:00.000-0300`;
            const endStr = `${selectedDate}T23:59:59.999-0300`;
            q = query(
                collection(db, 'zetti_responses'),
                where('type', '==', 'hourly_sale'),
                where('issueDate', '>=', startStr),
                where('issueDate', '<=', endStr),
                limit(500)
            );
        }

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const sales: LiveSale[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    // Filtramos en memoria para máxima compatibilidad
                    if (data.type === 'hourly_sale') {
                        sales.push(data as LiveSale);
                    }
                });
                setLiveSales(sales);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error("Firestore Snapshot Error:", err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [viewMode, selectedDate]);

    // Listen for sync metadata
    useEffect(() => {
        const metaRef = doc(db, 'zetti_metadata', 'last_sync');
        const unsubscribe = onSnapshot(metaRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() as SyncMetadata;
                console.log("📊 SYNC META DATA RECEIVED:", data);
                setSyncMeta(data);
            } else {
                console.log("📊 SYNC META DOCUMENT DOES NOT EXIST YET");
            }
        });
        return () => unsubscribe();
    }, []);

    const currentPeriodSales = useMemo(() => {
        if (viewMode === 'LIVE') {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            const todayStr = `${y}-${m}-${d}T00:00:00.000-0300`;
            return liveSales.filter(s => s.issueDate >= todayStr);
        }
        return liveSales; // En modo Historico la query ya viene filtrada por fecha
    }, [liveSales, viewMode]);

    const leaderboard = useMemo(() => {
        const stats: Record<string, { name: string; total: number; count: number; lastSale: string; branch: string }> = {};

        const filtered = currentPeriodSales.filter(sale => {
            if (filter === 'TODO') return true;
            return sale.branch === filter;
        });

        filtered.forEach(sale => {
            if (!stats[sale.seller]) {
                stats[sale.seller] = { name: sale.seller, total: 0, count: 0, lastSale: sale.issueDate, branch: sale.branch };
            }
            const amt = Number(sale.amount);
            if (!isNaN(amt)) {
                stats[sale.seller].total += amt;
            }
            stats[sale.seller].count += 1;
            if (new Date(sale.issueDate) > new Date(stats[sale.seller].lastSale)) {
                stats[sale.seller].lastSale = sale.issueDate;
                stats[sale.seller].branch = sale.branch;
            }
        });

        return Object.values(stats)
            .sort((a, b) => b.total - a.total);
    }, [currentPeriodSales, filter]);

    const totalPeriodRevenue = useMemo(() => {
        const filtered = currentPeriodSales.filter(sale => {
            if (filter === 'TODO') return true;
            return sale.branch === filter;
        });
        return filtered.reduce((acc, s) => {
            const val = Number(s.amount);
            return isNaN(val) ? acc : acc + val;
        }, 0);
    }, [currentPeriodSales, filter]);

    if (loading) {
        return (
            <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 animate-pulse">
                <div className="h-8 w-48 bg-slate-800 rounded-lg mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-slate-800 rounded-2xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-slate-900 rounded-3xl p-8 border border-red-500/30 text-center">
                <div className="inline-flex items-center justify-center p-3 bg-red-500/10 rounded-2xl mb-4">
                    <ShieldCheck className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Error de Sincronización Real-Time</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-4">
                    Parece que las reglas de tu base de datos (Firestore) no permiten leer la colección de ventas.
                </p>
                <div className="bg-slate-800 p-4 rounded-xl inline-block text-left mb-4">
                    <p className="text-xs font-mono text-emerald-400">firebase deploy --only firestore:rules</p>
                </div>
                <p className="text-[10px] text-slate-600">Ejecuta el comando anterior en tu terminal o avisame para intentar arreglarlo.</p>
            </div>
        );
    }

    if (liveSales.length === 0) {
        return (
            <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 text-center relative overflow-hidden group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-emerald-600/10 rounded-3xl blur opacity-50"></div>

                <div className="relative">
                    <div className="inline-flex items-center justify-center p-3 bg-slate-800 rounded-2xl mb-4">
                        <Clock className="w-8 h-8 text-slate-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Monitor Zetti en Tiempo Real</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-6">No se han detectado ventas hoy todavía. Sincronización automática activa cada hora.</p>

                    <button
                        onClick={handleManualSync}
                        disabled={syncing}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-500/20"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'SINCRONIZANDO...' : 'FORZAR SINCRONIZACIÓN AHORA'}
                    </button>

                    <p className="text-[10px] text-slate-600 mt-4 font-bold uppercase tracking-widest">Zetti API v5 Cloud Tunneling</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative group">
            {/* Background Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>

            <div className="relative bg-slate-900 rounded-3xl p-6 border border-white/10 overflow-hidden">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute -inset-2 bg-blue-500/20 rounded-full blur-lg animate-pulse"></div>
                            <div className="relative p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                <Award className="w-6 h-6 text-blue-400" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-black text-white tracking-tight uppercase">Ranking de Vendedores</h2>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Live</span>
                                </div>

                                {viewMode === 'LIVE' ? (
                                    <button
                                        onClick={handleManualSync}
                                        disabled={syncing}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all active:scale-95 disabled:opacity-50 group/sync`}
                                        title="Sincronizar ahora con Zetti"
                                    >
                                        <RefreshCw className={`w-3 h-3 text-blue-400 ${syncing ? 'animate-spin' : 'group-hover/sync:rotate-180 transition-transform duration-500'}`} />
                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tight">
                                            {syncing ? 'Sincronizando...' : 'Sincronizar'}
                                        </span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setViewMode('LIVE')}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg transition-all active:scale-95 text-blue-400`}
                                    >
                                        <ArrowLeft className="w-3 h-3" />
                                        <span className="text-[9px] font-bold uppercase tracking-tight">Volver al Vivo</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-3 mt-3">
                                {/* Branch Filter Tabs */}
                                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 w-fit">
                                    {(['TODO', 'BIOSALUD', 'CHACRAS'] as const).map((b) => (
                                        <button
                                            key={b}
                                            onClick={() => setFilter(b)}
                                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all ${filter === b
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                                }`}
                                        >
                                            {b === 'TODO' ? 'Todo' : b === 'BIOSALUD' ? 'Fcia Biosalud' : 'Chacras'}
                                        </button>
                                    ))}
                                </div>

                                {/* Date Selector Tool */}
                                <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                                    <Calendar className="w-3.5 h-3.5 text-slate-500 ml-2" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => {
                                            setSelectedDate(e.target.value);
                                            if (viewMode === 'LIVE') setViewMode('HISTORIC');
                                        }}
                                        className="bg-transparent text-[10px] font-bold text-slate-300 outline-none border-none py-1 pr-2 uppercase"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-700/50 backdrop-blur-xl">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-right">
                            {viewMode === 'LIVE' ? 'Venta Total Hoy' : `Venta ${format(new Date(selectedDate + 'T12:00:00'), 'dd/MM', { locale: es })}`}
                        </p>
                        <p className="text-xl font-black text-emerald-400 font-mono tracking-tighter">
                            {formatMoney(totalPeriodRevenue)}
                        </p>
                    </div>
                </div>

                {/* Leaderboard Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {leaderboard.map((seller, idx) => (
                        <div
                            key={seller.name}
                            className={`relative p-3 rounded-xl border transition-all duration-300 hover:scale-[1.02] ${idx === 0
                                ? 'bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/30 shadow-[0_0_20px_-5px_rgba(245,158,11,0.2)]'
                                : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
                                }`}
                        >
                            {/* Position Badge */}
                            <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shadow-lg transform rotate-12 group-hover:rotate-0 transition-transform ${idx === 0 ? 'bg-amber-500 text-amber-950' :
                                idx === 1 ? 'bg-slate-300 text-slate-900' :
                                    idx === 2 ? 'bg-orange-400 text-orange-950' : 'bg-slate-700 text-white'
                                }`}>
                                {idx === 0 ? <Trophy className="w-3 h-3" /> : idx + 1}
                            </div>

                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2 rounded-xl ${idx === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/50 text-slate-400'}`}>
                                    <User className="w-5 h-5" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-white font-black text-xs truncate uppercase tracking-tight">{seller.name}</p>
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[9px] text-slate-500 font-bold">{seller.count} tks</p>
                                        <span className={`px-1 rounded-[4px] text-[8px] font-black uppercase tracking-tighter ${seller.branch === 'CHACRAS' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {seller.branch}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-0.5">
                                <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Facturado</p>
                                <p className={`text-base font-black font-mono leading-none ${idx === 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                                    {formatMoney(seller.total)}
                                </p>
                            </div>

                            {/* Activity Indicator */}
                            {idx === 0 && (
                                <div className="mt-4 flex items-center gap-1 text-amber-500/80">
                                    <Flame className="w-3 h-3 animate-bounce" />
                                    <span className="text-[8px] font-black uppercase">En racha</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer / Last Activity Feed */}
                <div className="mt-8 pt-6 border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Últimas Ventas</span>
                        </div>
                        <div className="flex -space-x-2 overflow-hidden">
                            {liveSales.slice(0, 5).map((sale, i) => (
                                <div
                                    key={i}
                                    className="relative inline-block h-6 w-6 rounded-full ring-2 ring-slate-900 bg-slate-700 flex items-center justify-center"
                                    title={`${sale.seller}: ${formatMoney(sale.amount)}`}
                                >
                                    <span className="text-[8px] font-black text-slate-300">{sale.seller[0]}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">
                            <span className="font-bold text-slate-200">{liveSales[0].seller}</span> vendió hace {
                                Math.floor((new Date().getTime() - new Date(liveSales[0].issueDate).getTime()) / 60000)
                            } min
                        </p>
                    </div>

                    <div className="flex flex-col items-end gap-0.5">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase">
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                            <span>Zetti API v5</span>
                        </div>
                        {syncMeta?.lastSyncAt && (
                            <div className="text-[9px] text-slate-600 font-mono">
                                <span className={syncMeta.type === 'manual' ? 'text-amber-500' : 'text-emerald-500'}>
                                    {syncMeta.type === 'manual' ? '⚡ FORZADO' : '🔄 AUTO'}
                                </span>
                                {' • '}
                                {format(syncMeta.lastSyncAt.toDate(), "dd/MM HH:mm", { locale: es })}
                                {' • '}
                                <span className="text-slate-500">{syncMeta.recordsProcessed} reg</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
