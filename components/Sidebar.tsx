import React, { useState } from 'react';
import {
    LayoutDashboard,
    FileText,
    ArrowLeftRight,
    ShoppingCart,
    Lightbulb,
    Wallet,
    CloudLightning,
    ShoppingBag,
    Menu,
    X,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Trash2,
    ShieldCheck,
    RefreshCw,
    HelpCircle,
    CheckCircle
} from 'lucide-react';
import { auth } from '../src/firebaseConfig';
import * as firebaseAuth from 'firebase/auth';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: any) => void;
    user: any;
    onClearData: () => void;
    onUniversalSync: () => void;
    isCollapsed: boolean;
    toggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, user, onClearData, onUniversalSync, isCollapsed, toggleSidebar }) => {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    const menuItems = [
        { id: 'sales', label: 'Dashboard Ventas', icon: LayoutDashboard, color: 'text-sky-400', group: 'Analítica' },
        { id: 'invoices', label: 'Auditoría Fiscal', icon: FileText, color: 'text-blue-400', group: 'Analítica' },
        { id: 'insurance', label: 'Obras Sociales', icon: ShieldCheck, color: 'text-rose-400', group: 'Analítica' },
        { id: 'crossed', label: 'Cruce de Datos', icon: ArrowLeftRight, color: 'text-purple-400', group: 'Analítica' },

        { id: 'shopping', label: 'Asistente Compras', icon: ShoppingCart, color: 'text-amber-400', group: 'Operación' },
        { id: 'zetti', label: 'Zetti Live API', icon: CloudLightning, color: 'text-indigo-400', group: 'Operación' },

        { id: 'expenses', label: 'Proveedores', icon: ShoppingBag, color: 'text-orange-400', group: 'Finanzas' },
        { id: 'services', label: 'Gastos Operativos', icon: Lightbulb, color: 'text-yellow-400', group: 'Finanzas' },
        { id: 'debts', label: 'Cuentas Corrientes', icon: Wallet, color: 'text-teal-400', group: 'Finanzas' },
    ];

    const groups = ['Analítica', 'Operación', 'Finanzas'];

    const handleSignOut = () => {
        firebaseAuth.signOut(auth);
    };

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 text-white rounded-lg shadow-lg border border-white/10"
                onClick={() => setIsMobileOpen(true)}
            >
                <Menu size={24} />
            </button>

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={`
                    fixed top-0 left-0 h-full bg-slate-900 border-r border-slate-800 z-50 transition-all duration-300 ease-in-out flex flex-col text-slate-300
                    ${isCollapsed ? 'w-20' : 'w-72'}
                    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {/* Header */}
                <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-slate-800">
                    {!isCollapsed && (
                        <h1 className="text-xl font-bold text-white tracking-tight">
                            BIOSALUD
                        </h1>
                    )}
                    <button
                        onClick={toggleSidebar}
                        className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors hidden lg:block"
                    >
                        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
                    <button
                        onClick={() => setIsMobileOpen(false)}
                        className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 lg:hidden"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-6 custom-scrollbar">
                    {groups.map(group => {
                        const groupItems = menuItems.filter(item => item.group === group);
                        if (groupItems.length === 0) return null;

                        return (
                            <div key={group}>
                                {!isCollapsed && (
                                    <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                        {group}
                                    </p>
                                )}
                                <div className="space-y-1">
                                    {groupItems.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setActiveTab(item.id);
                                                setIsMobileOpen(false);
                                            }}
                                            className={`
                                                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative
                                                ${activeTab === item.id
                                                    ? 'bg-slate-800 text-white border-l-4 border-emerald-500'
                                                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                                }
                                                ${isCollapsed ? 'justify-center px-0' : ''}
                                            `}
                                            title={isCollapsed ? item.label : ''}
                                        >
                                            <item.icon
                                                size={20}
                                                className={`transition-colors ${activeTab === item.id ? item.color : 'text-slate-500 group-hover:text-slate-300'}`}
                                            />
                                            {!isCollapsed && (
                                                <span className="font-medium text-sm">{item.label}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                {/* Footer Actions */}
                <div className="shrink-0 p-4 border-t border-slate-800 space-y-2 bg-slate-900">
                    <button
                        onClick={onUniversalSync}
                        className={`
                            w-full flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm
                            ${isCollapsed ? 'justify-center px-0' : ''}
                        `}
                        title="Sincronizar Datos"
                    >
                        <RefreshCw size={18} className={isCollapsed ? "" : "mr-1"} />
                        {!isCollapsed && <span className="font-bold text-sm">Sincronizar</span>}
                    </button>

                    <button
                        onClick={() => setShowHelp(true)}
                        className={`
                            w-full flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all
                            ${isCollapsed ? 'justify-center' : ''}
                        `}
                    >
                        <HelpCircle size={18} />
                        {!isCollapsed && <span className="font-medium text-sm">Ayuda</span>}
                    </button>

                    <div className={`flex items-center gap-3 px-2 py-3 mt-4 border-t border-slate-800 pt-4 ${isCollapsed ? 'justify-center flex-col' : ''}`}>
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 font-bold border border-slate-700 shrink-0">
                            {user?.email?.[0].toUpperCase()}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-300 truncate">{user?.email?.split('@')[0]}</p>
                                <button
                                    onClick={handleSignOut}
                                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 mt-0.5"
                                >
                                    <LogOut size={12} /> Salir
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Botón de Borrado */}
                    {!isCollapsed ? (
                        <button
                            onClick={onClearData}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all text-xs font-bold mt-1"
                        >
                            <Trash2 size={14} /> Borrar Datos
                        </button>
                    ) : (
                        <button
                            onClick={onClearData}
                            className="w-full flex items-center justify-center p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all"
                            title="Borrar Base de Datos"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </aside>

            {/* Help Modal */}
            {showHelp && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setShowHelp(false)}>
                    <div className="bg-[#111827] border border-white/10 rounded-3xl max-w-2xl w-full p-8 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowHelp(false)} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all"><X /></button>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-500/20">
                                <CloudLightning className="w-8 h-8 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-white tracking-tight">Guía de Sincronización</h3>
                                <p className="text-slate-400 font-medium">Configuración crítica para Zetti</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="p-6 bg-slate-800/50 rounded-2xl border border-white/5">
                                <h4 className="text-emerald-400 font-bold text-sm tracking-wider uppercase mb-4">Menú 4.5.2 (Maestro)</h4>
                                <ul className="space-y-3">
                                    <li className="flex items-center gap-3 text-slate-200">
                                        <CheckCircle className="text-emerald-500 w-5 h-5" />
                                        <span>Tildar <strong>Mostrar Operaciones</strong></span>
                                    </li>
                                    <li className="flex items-center gap-3 text-slate-200">
                                        <CheckCircle className="text-emerald-500 w-5 h-5" />
                                        <span>Tildar <strong>Mostrar por Nodo</strong></span>
                                    </li>
                                    <li className="flex items-center gap-3 text-rose-300 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                                        <X className="text-rose-500 w-5 h-5" />
                                        <span className="font-bold">PROHIBIDO TILDAR "Mostrar Item"</span>
                                    </li>
                                </ul>
                            </div>

                            <p className="text-center text-slate-500 text-sm">
                                Al subir este archivo, el sistema clasificará automáticamente todas las secciones.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
