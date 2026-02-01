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

interface LiveSellersLeaderboardProps {
    offlineData?: any[];
}

export const LiveSellersLeaderboard: React.FC<LiveSellersLeaderboardProps> = ({ offlineData }) => {
    const [liveSales, setLiveSales] = useState<LiveSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [filter, setFilter] = useState<'TODO' | 'BIOSALUD' | 'CHACRAS'>('TODO');
    const [viewMode, setViewMode] = useState<'LIVE' | 'HISTORIC' | 'OFFLINE'>('LIVE');
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
        if (viewMode === 'OFFLINE') {
            setLoading(false);
            return;
        }

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
                setSyncMeta(data);
            }
        });
        return () => unsubscribe();
    }, []);

    const leaderboard = useMemo(() => {
        const stats: Record<string, { name: string; total: number; count: number; lastSale: string; branch: string }> = {};

        let sourceSales: any[] = [];
        if (viewMode === 'OFFLINE' && offlineData) {
            sourceSales = offlineData.map(d => ({
                seller: d.sellerName,
                amount: d.totalAmount,
                issueDate: d.date instanceof Date ? d.date.toISOString() : d.date,
                branch: d.branch?.toUpperCase().includes('CHACRAS') ? 'CHACRAS' : 'BIOSALUD'
            }));
        } else if (viewMode === 'LIVE') {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            const todayStr = `${y}-${m}-${d}T00:00:00.000-0300`;
            sourceSales = liveSales.filter(s => s.issueDate >= todayStr);
        } else {
            sourceSales = liveSales;
        }

        const filtered = sourceSales.filter(sale => {
            if (filter === 'TODO') return true;
            return sale.branch === filter;
        });

        filtered.forEach(sale => {
            const sellerKey = sale.seller || 'Desconocido';
            if (!stats[sellerKey]) {
                stats[sellerKey] = { name: sellerKey, total: 0, count: 0, lastSale: sale.issueDate, branch: sale.branch };
            }
            const amt = Number(sale.amount);
            if (!isNaN(amt)) {
                stats[sellerKey].total += amt;
            }
            stats[sellerKey].count += 1;
            if (new Date(sale.issueDate) > new Date(stats[sellerKey].lastSale)) {
                stats[sellerKey].lastSale = sale.issueDate;
                stats[sellerKey].branch = sale.branch;
            }
        });

        return Object.values(stats).sort((a, b) => b.total - a.total);
    }, [liveSales, viewMode, offlineData, filter]);

    const totalPeriodRevenue = useMemo(() => {
        return leaderboard.reduce((acc, s) => acc + s.total, 0);
    }, [leaderboard]);

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

    // Si hay error pero tenemos offlineData, podemos seguir operando en modo OFFLINE
    if (error && viewMode !== 'OFFLINE') {
        return (
            <div className="bg-slate-900 rounded-3xl p-8 border border-red-500/30 text-center">
                <div className="inline-flex items-center justify-center p-3 bg-red-500/10 rounded-2xl mb-4">
                    <ShieldCheck className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Error de Sincronización Real-Time</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-4">
                    Las reglas de Firestore bloquean el acceso vivo.
                </p>
                {offlineData && offlineData.length > 0 && (
                    <button onClick={() => setViewMode('OFFLINE')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">
                        USAR DATOS CARGADOS (MODO CSV)
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="relative group">
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
                                    <div className={`w-1.5 h-1.5 rounded-full ${viewMode === 'OFFLINE' ? 'bg-blue-500' : 'bg-emerald-500 animate-pulse'}`}></div>
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                                        {viewMode === 'OFFLINE' ? 'CSV DATA' : 'Live'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1">
                                    {offlineData && offlineData.length > 0 && (
                                        <button
                                            onClick={() => setViewMode('OFFLINE')}
                                            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all ${viewMode === 'OFFLINE' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400'}`}
                                        >
                                            CSV
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setViewMode('LIVE')}
                                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all ${viewMode === 'LIVE' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-400'}`}
                                    >
                                        Live
                                    </button>
                                </div>

                                {viewMode !== 'OFFLINE' && (
                                    <button
                                        onClick={handleManualSync}
                                        disabled={syncing}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                                    >
                                        <RefreshCw className={`w-3 h-3 text-blue-400 ${syncing ? 'animate-spin' : ''}`} />
                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tight">Sync</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-3 mt-3">
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
                                <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                                    <Calendar className="w-3.5 h-3.5 text-slate-500 ml-2" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => {
                                            setSelectedDate(e.target.value);
                                            if (viewMode !== 'OFFLINE') setViewMode('HISTORIC');
                                        }}
                                        className="bg-transparent text-[10px] font-bold text-slate-300 outline-none border-none py-1 pr-2 uppercase"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-700/50 backdrop-blur-xl">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-right">
                            Venta Total {viewMode === 'OFFLINE' ? 'Cargada' : 'Hoy'}
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
                            <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shadow-lg transform rotate-12 ${idx === 0 ? 'bg-amber-500 text-amber-950' :
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
                                        <span className={`px-1 rounded-[4px] text-[8px] font-black uppercase tracking-tighter ${seller.branch === 'CHACRAS' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                            {seller.branch}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Facturado</p>
                                <p className={`text-sm font-black font-mono leading-none ${idx === 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                                    {formatMoney(seller.total)}
                                </p>
                            </div>
                        </div>
                    ))}
                    {leaderboard.length === 0 && (
                        <div className="col-span-full py-10 text-center text-slate-600 font-bold text-xs uppercase tracking-widest">
                            No hay datos para mostrar en este modo.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
