import React, { useMemo, useState, useEffect } from 'react';
import { SaleRecord } from '../types';
import {
    ShoppingCart, Package, TrendingUp, Download, Search, AlertTriangle,
    CheckCircle2, RefreshCw, Calculator, ArrowRightLeft, Filter, Edit3,
    PlusCircle, Calendar, List, Factory, ChevronDown, ChevronUp, X, Trash2,
    ChevronRight, Zap
} from 'lucide-react';
import {
    searchZettiProductByBarcode, searchZettiProductByDescription,
    searchZettiMultiStock, ZETTI_NODES, callZettiAPI, getProductFromMaster
} from '../utils/zettiService';
import { getAllProductMasterFromDB } from '../utils/db';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../src/firebaseConfig';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatMoney } from '../utils/dataHelpers';

interface ShoppingAssistantProps {
    salesData: SaleRecord[];
}

interface SuggestionItem {
    barcode: string;
    productId?: number;
    productName: string;
    category: string;
    manufacturer: string;
    totalSold: number;
    dailyAvg: number;
    stockBio?: number;
    stockChacras?: number;
    daysToCover: number;
    needed: number;
    manualOrder: number;
    status: 'idle' | 'loading' | 'success' | 'error';
    isManualEntry?: boolean;
}

export const ShoppingAssistant: React.FC<ShoppingAssistantProps> = ({ salesData }) => {
    // Basic Settings
    const [daysToCover, setDaysToCover] = useState(30);
    const [minSales, setMinSales] = useState(3);
    const [loadingStock, setLoadingStock] = useState(false);
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

    // Analysis Date Range (Default: last 90 days)
    const [startDate, setStartDate] = useState(format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('TODO');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>([]);

    // UI State
    const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
    const [isCatFilterOpen, setIsCatFilterOpen] = useState(false);
    const [isManFilterOpen, setIsManFilterOpen] = useState(false);
    const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
    const [productMaster, setProductMaster] = useState<any[]>([]);
    const [isMasterLoading, setIsMasterLoading] = useState(true);

    // Multi-selection & Removal
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
    const [editingBarcode, setEditingBarcode] = useState<{ id: string, value: string } | null>(null);
    const [isSmartMode, setIsSmartMode] = useState(false);

    // Filter Options
    const categories = useMemo(() => {
        const cats = new Set<string>();
        salesData.forEach(s => { if (s.category) cats.add(s.category); });
        return Array.from(cats).sort();
    }, [salesData]);

    const manufacturers = useMemo(() => {
        const mans = new Set<string>();
        salesData.forEach(s => { if (s.manufacturer) mans.add(s.manufacturer); });
        return Array.from(mans).sort();
    }, [salesData]);

    const branches = useMemo(() => {
        const b = new Set<string>();
        salesData.forEach(s => {
            if (s.branch) {
                if (s.branch.includes('CHACRAS')) b.add('CHACRAS');
                else b.add('BIOSALUD');
            }
        });
        return ['TODO', ...Array.from(b).sort()];
    }, [salesData]);

    // Calculate Working Days (5.5 days/week)
    const analysisDays = useMemo(() => {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        // Apply 5.5 / 7 factor for actual retail working days
        return totalDays * (5.5 / 7);
    }, [startDate, endDate]);

    // Compute Primary Suggestions
    const initialSuggestions = useMemo(() => {
        if (!salesData || salesData.length === 0) return [];

        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');

        const filteredSales = salesData.filter(s => {
            const sDate = new Date(s.date);
            if (sDate < start || sDate > end) return false;

            if (selectedBranch !== 'TODO') {
                const isChacras = s.branch.includes('CHACRAS');
                if (selectedBranch === 'CHACRAS' && !isChacras) return false;
                if (selectedBranch === 'BIOSALUD' && isChacras) return false;
            }

            if (selectedCategories.length > 0 && !selectedCategories.includes(s.category)) return false;
            if (selectedManufacturers.length > 0 && !selectedManufacturers.includes(s.manufacturer)) return false;

            return true;
        });

        // 1. Identificamos el "Día de Referencia" como el último día de ventas en el dataset
        const lastSaleDate = salesData.reduce((max, s) => {
            const d = s.date instanceof Date ? s.date.toISOString() : String(s.date || '');
            const dStr = d.split('T')[0];
            return dStr > max ? dStr : max;
        }, '');
        const referenceDayStr = lastSaleDate;

        // 2. Procesamos todas las ventas del periodo para el Promedio Diario
        const salesMap: Record<string, { barcode: string, name: string, totalQty: number, soldOnRef: boolean, category: string, manufacturer: string }> = {};

        // Para el modo inteligente, buscamos lo vendido ayer en TODO el dataset (no solo lo filtrado)
        // para asegurar que lo detectamos aunque el filtro de promedio sea otro.
        if (isSmartMode) {
            salesData.forEach(sale => {
                const saleDateStr = sale.date instanceof Date ? sale.date.toISOString() : String(sale.date || '');
                if (saleDateStr.startsWith(referenceDayStr)) {
                    const barcode = sale.barcode && sale.barcode !== 'N/A' ? sale.barcode : 'NO_CODE_' + sale.productName;
                    if (!salesMap[barcode]) {
                        salesMap[barcode] = {
                            barcode: sale.barcode || 'N/A',
                            name: sale.productName,
                            totalQty: 0,
                            soldOnRef: true,
                            category: sale.category || 'VARIOS',
                            manufacturer: sale.manufacturer || 'DESCONOCIDO'
                        };
                    } else {
                        salesMap[barcode].soldOnRef = true;
                    }
                }
            });
        }

        // 3. Alimentamos los totales y promedios con las ventas FILTRADAS (el periodo de 30-60 días)
        filteredSales.forEach(sale => {
            const barcode = sale.barcode && sale.barcode !== 'N/A' ? sale.barcode : 'NO_CODE_' + sale.productName;
            if (!salesMap[barcode]) {
                salesMap[barcode] = {
                    barcode: sale.barcode || 'N/A',
                    name: sale.productName,
                    totalQty: 0,
                    soldOnRef: false,
                    category: sale.category || 'VARIOS',
                    manufacturer: sale.manufacturer || 'DESCONOCIDO'
                };
            }
            salesMap[barcode].totalQty += Number(sale.quantity) || 0;

            // Si no estamos en smart mode o ya lo marcamos, no hace falta checkear fecha aquí
            if (!isSmartMode) {
                const saleDateStr = sale.date instanceof Date ? sale.date.toISOString() : String(sale.date || '');
                if (saleDateStr.startsWith(referenceDayStr)) salesMap[barcode].soldOnRef = true;
            }
        });

        // 4. Mapeamos y Filtramos según el modo
        return Object.values(salesMap)
            .filter(item => {
                if (isSmartMode) return item.soldOnRef; // Solo lo movido ayer
                return true;
            })
            .map(item => {
                const dailyAvg = item.totalQty / analysisDays;
                const needed = Math.ceil(dailyAvg * daysToCover);
                return {
                    barcode: item.barcode,
                    productName: item.name,
                    category: item.category,
                    manufacturer: item.manufacturer,
                    totalSold: item.totalQty,
                    dailyAvg: dailyAvg,
                    daysToCover,
                    needed: Math.max(0, needed),
                    manualOrder: Math.max(0, needed),
                    status: 'idle' as const,
                    isRefMovement: item.soldOnRef
                };
            })
            .sort((a, b) => b.totalSold - a.totalSold);
    }, [salesData, startDate, endDate, selectedBranch, selectedCategories, selectedManufacturers, analysisDays, daysToCover, isSmartMode]);

    useEffect(() => {
        const loadMaster = async () => {
            try {
                const master = await getAllProductMasterFromDB();
                setProductMaster(master || []);
            } catch (e) {
                console.error("Error loading product master:", e);
            } finally {
                setIsMasterLoading(false);
            }
        };
        loadMaster();
    }, []);

    useEffect(() => {
        // Enriquecer sugerencias iniciales con el maestro (incluyendo STOCK CACHEADO)
        const enriched = initialSuggestions.map(s => {
            // Intentamos buscar por barcode, si no por nombre
            const match = productMaster.find(p =>
                (s.barcode !== 'N/A' && p.barcode === s.barcode) ||
                (p.name === s.productName)
            );

            if (match) {
                const stockBio = Number(match.stockBio || 0);
                const stockChacras = Number(match.stockChacras || 0);

                // Determinamos qué stock restar basado en la sucursal seleccionada
                let stockToSubtract = 0;
                if (selectedBranch === 'BIOSALUD') stockToSubtract = stockBio;
                else if (selectedBranch === 'CHACRAS') stockToSubtract = stockChacras;
                else stockToSubtract = stockBio + stockChacras;

                // Si tenemos stock cacheado, lo usamos para el cálculo inicial
                const initialOrder = Math.max(0, s.needed - stockToSubtract);

                return {
                    ...s,
                    barcode: match.barcode || s.barcode,
                    productId: match.productId || s.productId,
                    manufacturer: match.manufacturer || s.manufacturer,
                    stockBio,
                    stockChacras,
                    manualOrder: initialOrder,
                    stockUpdatedAt: match.stockUpdatedAt
                };
            }
            return s;
        });
        setSuggestions(enriched);
    }, [initialSuggestions, productMaster, selectedBranch]);

    const filteredSuggestions = suggestions.filter(s => {
        if (hiddenIds.has(s.barcode)) return false;
        const matchesSearch = s.productName.toLowerCase().includes(searchTerm.toLowerCase()) || (s.barcode && s.barcode.includes(searchTerm));
        if (searchTerm) return matchesSearch;

        // En modo inteligente, si se movió en el día de referencia, pasa aunque no llegue al minSales
        if (isSmartMode && s.isRefMovement) return true;

        return s.totalSold >= minSales;
    });

    const handleRemoveItem = (id: string) => {
        setHiddenIds(prev => new Set([...Array.from(prev), id]));
        setSelectedIds(prev => prev.filter(i => i !== id));
    };

    const handleBulkRemove = () => {
        if (selectedIds.length === 0) return;
        setHiddenIds(prev => new Set([...Array.from(prev), ...selectedIds]));
        setSelectedIds([]);
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredSuggestions.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredSuggestions.map(s => s.barcode));
        }
    };

    const handleSaveManualBarcode = (id: string, newBarcode: string) => {
        setSuggestions(prev => prev.map(s => s.barcode === id ? { ...s, barcode: newBarcode } : s));
        setEditingBarcode(null);
    };

    const handleManualEdit = (barcode: string, val: number) => {
        setSuggestions(prev => prev.map(s =>
            s.barcode === barcode ? { ...s, manualOrder: val } : s
        ));
    };

    const toggleCategory = (cat: string) => {
        setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };

    const toggleManufacturer = (man: string) => {
        setSelectedManufacturers(prev => prev.includes(man) ? prev.filter(m => m !== man) : [...prev, man]);
    };

    const checkStockDualNode = async () => {
        setLoadingStock(true);
        const updated = [...suggestions];
        const toCheck = filteredSuggestions.filter(s => s.status === 'idle');

        for (let item of toCheck) {
            const idx = updated.findIndex(s => s.barcode === item.barcode);
            if (idx === -1) continue;

            updated[idx].status = 'loading';
            setSuggestions([...updated]);

            try {
                let pid = item.productId;
                let barcode = item.barcode;
                const isRealBarcode = barcode && !barcode.startsWith('NO_CODE_') && barcode !== 'N/A' && barcode.toUpperCase() !== 'NULL';

                if (!pid) {
                    // 1. Intentar por Barcode si tenemos uno real
                    if (isRealBarcode) {
                        const searchRes = await searchZettiProductByBarcode(barcode);
                        const products = searchRes.content || (Array.isArray(searchRes) ? searchRes : []);
                        if (products.length > 0) {
                            pid = products[0].id;
                            updated[idx].productId = pid;
                        }
                    }

                    // 2. Si aún no hay PID, buscar en Maestro Local (Firestore)
                    if (!pid) {
                        const masterProd: any = await getProductFromMaster(item.productName);
                        if (masterProd && masterProd.barcode !== 'N/A') {
                            pid = masterProd.productId;
                            barcode = masterProd.barcode;
                            updated[idx].productId = pid;
                            updated[idx].barcode = barcode;
                        }
                    }

                    // 3. Como último recurso, buscar por Descripción
                    if (!pid) {
                        const cleanName = item.productName.split(/ [xX]\d+/)[0].split(' (')[0].trim();
                        const searchRes = await searchZettiProductByDescription(cleanName, ZETTI_NODES.BIOSALUD);
                        const products = searchRes.content || (Array.isArray(searchRes) ? searchRes : []);
                        const prod = products.find((p: any) =>
                            p.description.toLowerCase().includes(cleanName.toLowerCase()) ||
                            cleanName.toLowerCase().includes(p.description.toLowerCase())
                        ) || products[0];

                        if (prod) {
                            pid = prod.id;
                            barcode = prod.barCode || prod.barcode || 'N/A';
                            updated[idx].productId = pid;
                            updated[idx].barcode = barcode;
                        }
                    }
                }

                if (pid) {
                    const multiRaw = await searchZettiMultiStock([String(pid)]);
                    const multiArr = Array.isArray(multiRaw) ? multiRaw : [];
                    const detBio = multiArr.find((d: any) => String(d.idNodo) === '2378041');
                    const detChacras = multiArr.find((d: any) => String(d.idNodo) === '2406943');

                    // Guardamos el stock como número, o null si no se encontró en ese nodo
                    updated[idx].stockBio = detBio?.detalles?.stock ?? 0;
                    updated[idx].stockChacras = detChacras?.detalles?.stock ?? 0;

                    // RECALCULO DE "PEDIR": Necesidad - Stock Total
                    const totalInventario = (updated[idx].stockBio || 0) + (updated[idx].stockChacras || 0);
                    updated[idx].manualOrder = Math.max(0, updated[idx].needed - totalInventario);

                    updated[idx].status = 'success';
                } else {
                    updated[idx].status = 'error'; // No se halló el producto en Zetti
                }
            } catch (err) {
                updated[idx].status = 'error';
            }
        }
        setSuggestions([...updated]);
        setLoadingStock(false);
    };

    const handleGlobalSearch = async () => {
        if (!searchTerm) return;
        setGlobalSearchLoading(true);
        try {
            const isBarcode = /^\d+$/.test(searchTerm) && searchTerm.length >= 8;
            const res = isBarcode
                ? await searchZettiProductByBarcode(searchTerm)
                : await searchZettiProductByDescription(searchTerm);

            const zettiProds = res.content || (Array.isArray(res) ? res : []);
            if (zettiProds.length === 0) {
                alert("No se encontró nada en Zetti.");
                return;
            }

            const newEntries: SuggestionItem[] = zettiProds.map((z: any) => ({
                barcode: z.barCode || z.barcode || 'N/A',
                productId: z.id,
                productName: z.description || z.name || 'Sin nombre',
                category: z.category?.description || 'ZETTI',
                manufacturer: z.manufacturer?.name || 'ZETTI',
                totalSold: 0,
                dailyAvg: 0,
                daysToCover,
                needed: 0,
                manualOrder: 1,
                status: 'success',
                isManualEntry: true
            }));

            setSuggestions(prev => {
                const existing = new Set(prev.map(s => s.barcode));
                return [...newEntries.filter(n => !existing.has(n.barcode)), ...prev];
            });
        } catch (err) {
            alert("Error buscando en Zetti.");
        } finally {
            setGlobalSearchLoading(false);
        }
    };

    const handleManualStockSync = async () => {
        if (!confirm("Esto iniciará una actualización de stock de todos los productos conocidos desde Zetti. Puede tardar unos minutos. ¿Continuar?")) return;
        setLoadingStock(true);
        try {
            const syncFn = httpsCallable(functions, 'zetti_sync_stock_manual');
            await syncFn();
            alert("Sincronización de stock iniciada en segundo plano. Los datos se actualizarán en unos momentos.");
            // Recargar maestro
            const master = await getAllProductMasterFromDB();
            setProductMaster(master || []);
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setLoadingStock(false);
        }
    };

    const exportToDrugstore = () => {
        const lines = suggestions
            .filter(s => s.manualOrder > 0 && s.barcode !== 'N/A' && !s.barcode.startsWith('NO_CODE_') && !hiddenIds.has(s.barcode))
            .map(s => `${s.barcode};${s.manualOrder}`);
        const blob = new Blob([lines.join('\r\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pedido_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
    };

    // Movement History for Detail View
    const productHistory = useMemo(() => {
        if (!expandedProduct) return [];
        return salesData
            .filter(s => s.productName === expandedProduct || s.barcode === expandedProduct)
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, 15);
    }, [salesData, expandedProduct]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Control Panel */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl space-y-6">
                <div className="flex flex-col xl:flex-row justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <ShoppingCart className="w-8 h-8 text-indigo-600" />
                            <h2 className="text-3xl font-black tracking-tighter uppercase">Compras Inteligentes</h2>
                        </div>
                        <p className="text-gray-400 font-medium">Análisis de reposición basado en días laborales (5.5 / 7).</p>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Periodo de Análisis</label>
                            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-0 text-xs font-bold focus:ring-0" />
                                <span className="text-slate-300">/</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-0 text-xs font-bold focus:ring-0" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-indigo-400 ml-1">Días Stock</label>
                            <div className="bg-indigo-50 p-1.5 rounded-2xl border border-indigo-100">
                                <input
                                    type="number"
                                    value={daysToCover}
                                    onChange={e => setDaysToCover(Number(e.target.value))}
                                    className="w-16 bg-transparent border-0 text-sm font-black text-indigo-600 focus:ring-0 text-center"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Mín. Venta</label>
                            <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                                <input
                                    type="number"
                                    value={minSales}
                                    onChange={e => setMinSales(Number(e.target.value))}
                                    className="w-14 bg-transparent border-0 text-sm font-black text-slate-600 focus:ring-0 text-center"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters Advanced */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t border-slate-50">
                    <div className="lg:col-span-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Producto / Barra..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleGlobalSearch()}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-0 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="relative">
                        <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-0 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 appearance-none"
                        >
                            {branches.map(b => (
                                <option key={b} value={b}>
                                    {b === 'TODO' ? 'Todas las Sucursales' : b === 'CHACRAS' ? 'Suc. Chacras Park' : 'Suc. BioSalud (Paseo)'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Multi-category filter */}
                    <div className="relative">
                        <button
                            onClick={() => setIsCatFilterOpen(!isCatFilterOpen)}
                            className={`w-full flex items-center justify-between pl-4 pr-4 py-3 bg-slate-50 border-0 rounded-2xl text-sm font-bold transition-all ${selectedCategories.length > 0 ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}
                        >
                            <div className="flex items-center gap-2">
                                <List className="w-4 h-4" />
                                <span className="truncate">{selectedCategories.length === 0 ? 'Todos los Rubros' : `${selectedCategories.length} Rubros`}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isCatFilterOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isCatFilterOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 max-h-64 overflow-y-auto p-2 animate-in slide-in-from-top-2">
                                <button onClick={() => setSelectedCategories([])} className="w-full text-left p-2 text-xs font-black text-indigo-500 hover:bg-indigo-50 rounded-lg mb-1">LIMPIAR TODO</button>
                                {categories.map(cat => (
                                    <label key={cat} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedCategories.includes(cat)}
                                            onChange={() => toggleCategory(cat)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs font-bold text-slate-700 truncate">{cat}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Multi-manufacturer filter */}
                    <div className="relative">
                        <button
                            onClick={() => setIsManFilterOpen(!isManFilterOpen)}
                            className={`w-full flex items-center justify-between pl-4 pr-4 py-3 bg-slate-50 border-0 rounded-2xl text-sm font-bold transition-all ${selectedManufacturers.length > 0 ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Factory className="w-4 h-4" />
                                <span className="truncate">{selectedManufacturers.length === 0 ? 'Todos los Fabr.' : `${selectedManufacturers.length} Fabr.`}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isManFilterOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isManFilterOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 max-h-64 overflow-y-auto p-2 animate-in slide-in-from-top-2">
                                <button onClick={() => setSelectedManufacturers([])} className="w-full text-left p-2 text-xs font-black text-indigo-500 hover:bg-indigo-50 rounded-lg mb-1">LIMPIAR TODO</button>
                                {manufacturers.map(man => (
                                    <label key={man} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedManufacturers.includes(man)}
                                            onChange={() => toggleManufacturer(man)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-xs font-bold text-slate-700 truncate">{man}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={searchTerm ? handleGlobalSearch : checkStockDualNode}
                        disabled={loadingStock || globalSearchLoading}
                        className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-black shadow-lg transition-all ${searchTerm ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'}`}
                    >
                        {loadingStock || globalSearchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : searchTerm ? <Search className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                        {searchTerm ? 'ZETTI CLOUD' : 'STOCK REAL'}
                    </button>

                    <button
                        onClick={() => setIsSmartMode(!isSmartMode)}
                        className={`flex items-center justify-center gap-2 py-3 px-6 rounded-2xl font-black shadow-lg transition-all border ${isSmartMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Zap className={`w-4 h-4 ${isSmartMode ? 'fill-amber-500 text-amber-500' : ''}`} />
                        {isSmartMode ? 'VER TODO' : 'REPUES. INTELIGENTE'}
                    </button>

                    <button
                        onClick={handleManualStockSync}
                        disabled={loadingStock}
                        className="flex items-center justify-center gap-2 py-3 px-6 bg-slate-100 text-slate-600 rounded-2xl font-black shadow-lg hover:bg-slate-200 transition-all border border-slate-200"
                        title="Actualiza el stock cacheado de todos los productos (Cron de las 3 AM)"
                    >
                        <RefreshCw className={`w-4 h-4 ${loadingStock ? 'animate-spin' : ''}`} />
                        REFRESCAR MAESTRO
                    </button>

                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkRemove}
                            className="flex items-center justify-center gap-2 py-3 bg-red-100 text-red-600 rounded-2xl font-black shadow-lg hover:bg-red-200 transition-all border border-red-200"
                        >
                            <Trash2 className="w-4 h-4" />
                            QUITAR ({selectedIds.length})
                        </button>
                    )}

                    {hiddenIds.size > 0 && (
                        <button
                            onClick={() => { setHiddenIds(new Set()); setSelectedIds([]); }}
                            className="flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black shadow-lg hover:bg-slate-200 transition-all border border-slate-200"
                        >
                            <RefreshCw className="w-4 h-4" />
                            RESTAURAR ({hiddenIds.size})
                        </button>
                    )}
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden min-h-[500px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-gray-100">
                                <th className="px-6 py-4 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={filteredSuggestions.length > 0 && selectedIds.length === filteredSuggestions.length}
                                        onChange={toggleSelectAll}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Producto / Datos</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Venta Período</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center bg-blue-50/50">Stock BIO</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center bg-emerald-50/50">Stock CHAC</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Necesidad</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center bg-indigo-50">Pedir</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredSuggestions.map((item, idx) => (
                                <React.Fragment key={idx}>
                                    <tr
                                        className={`group hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedProduct === item.productName ? 'bg-indigo-50/30' : ''} ${selectedIds.includes(item.barcode) ? 'bg-indigo-50/20' : ''}`}
                                        onClick={() => setExpandedProduct(expandedProduct === item.productName ? null : item.productName)}
                                    >
                                        <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.barcode)}
                                                onChange={() => toggleSelection(item.barcode)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="font-black text-slate-800 leading-tight">
                                                    {item.productName}
                                                </div>
                                                {expandedProduct === item.productName ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-indigo-400" />}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                {editingBarcode?.id === item.barcode ? (
                                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            value={editingBarcode.value}
                                                            onChange={e => setEditingBarcode({ ...editingBarcode, value: e.target.value })}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') handleSaveManualBarcode(item.barcode, editingBarcode.value);
                                                                if (e.key === 'Escape') setEditingBarcode(null);
                                                            }}
                                                            className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-indigo-300 w-24 focus:ring-0"
                                                        />
                                                        <button onClick={() => handleSaveManualBarcode(item.barcode, editingBarcode.value)} className="bg-emerald-500 text-white p-0.5 rounded"><CheckCircle2 className="w-3 h-3" /></button>
                                                        <button onClick={() => setEditingBarcode(null)} className="bg-red-500 text-white p-0.5 rounded"><X className="w-3 h-3" /></button>
                                                    </div>
                                                ) : (
                                                    <span
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingBarcode({ id: item.barcode, value: item.barcode.startsWith('NO_CODE_') ? '' : item.barcode });
                                                        }}
                                                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold cursor-edit flex items-center gap-1 hover:ring-1 hover:ring-indigo-300 transition-all ${item.barcode.startsWith('NO_CODE_') || item.barcode === 'N/A' || item.barcode.toUpperCase() === 'NULL' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}
                                                    >
                                                        {item.barcode.startsWith('NO_CODE_') || item.barcode === 'N/A' || item.barcode.toUpperCase() === 'NULL' ? 'SIN CÓDIGO' : item.barcode}
                                                        <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />
                                                    </span>
                                                )}
                                                <span className="text-[9px] font-black text-indigo-400 uppercase bg-indigo-50 px-1.5 py-0.5 rounded leading-none">
                                                    {item.category}
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase border border-slate-100 px-1.5 py-0.5 rounded leading-none">
                                                    {item.manufacturer}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="font-black text-slate-700">{item.totalSold}</div>
                                            <div className="text-[9px] text-indigo-500 font-black uppercase tracking-tighter">
                                                VDP: {item.dailyAvg.toFixed(2)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {item.status === 'loading' ? <RefreshCw className="w-3 h-3 animate-spin text-blue-500 mx-auto" /> :
                                                <span className={`font-black ${item.stockBio && item.stockBio > 0 ? 'text-blue-600' : 'text-slate-200'}`}>{item.stockBio ?? '---'}</span>}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {item.status === 'loading' ? <RefreshCw className="w-3 h-3 animate-spin text-emerald-500 mx-auto" /> :
                                                <span className={`font-black ${item.stockChacras && item.stockChacras > 0 ? 'text-emerald-600' : 'text-slate-200'}`}>{item.stockChacras ?? '---'}</span>}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-sm font-black text-slate-900 border-b-2 border-indigo-200 inline-block px-1">
                                                {item.needed}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center bg-indigo-50/20" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-2">
                                                <input
                                                    type="number"
                                                    value={item.manualOrder}
                                                    onChange={(e) => handleManualEdit(item.barcode, Math.max(0, Number(e.target.value)))}
                                                    className="w-16 bg-white border-2 border-indigo-100 rounded-xl text-center text-sm font-black text-indigo-700 py-1 focus:ring-2 focus:ring-indigo-500 transition-all"
                                                />
                                                <button
                                                    onClick={() => handleRemoveItem(item.barcode)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Quitar de la lista"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expansion: Movement History */}
                                    {expandedProduct === item.productName && (
                                        <tr className="bg-slate-50/50">
                                            <td colSpan={7} className="px-8 py-6">
                                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-top-2">
                                                    <div className="bg-slate-800 px-6 py-3 flex justify-between items-center text-white">
                                                        <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                                            Últimos Movimientos Registrados
                                                        </h4>
                                                        <span className="text-[10px] font-bold opacity-50">Mostrando últimos 15 registros</span>
                                                    </div>
                                                    <div className="p-0">
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                                                                    <th className="px-4 py-3">Fecha</th>
                                                                    <th className="px-4 py-3">Comprobante</th>
                                                                    <th className="px-4 py-3 text-center">Cant.</th>
                                                                    <th className="px-4 py-3">Cliente / Entidad</th>
                                                                    <th className="px-4 py-3">Vendedor</th>
                                                                    <th className="px-4 py-3 text-right">Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {productHistory.map((h, iidx) => (
                                                                    <tr key={iidx} className="hover:bg-slate-50 transition-colors">
                                                                        <td className="px-4 py-3 font-medium text-slate-500">{format(h.date, 'dd/MM/yy HH:mm')}</td>
                                                                        <td className="px-4 py-3 font-bold text-slate-700">{h.invoiceNumber}</td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <span className={`font-black px-2 py-0.5 rounded-full ${h.quantity < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                                                {h.quantity}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 font-medium text-slate-600 truncate max-w-[150px]">{h.entity || 'Particular'}</td>
                                                                        <td className="px-4 py-3 text-slate-400 font-bold">{h.sellerName}</td>
                                                                        <td className="px-4 py-3 text-right font-black text-slate-800">{formatMoney(h.totalAmount)}</td>
                                                                    </tr>
                                                                ))}
                                                                {productHistory.length === 0 && (
                                                                    <tr>
                                                                        <td colSpan={6} className="py-10 text-center italic text-slate-400">No se encontraron movimientos registrados.</td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredSuggestions.length === 0 && (
                    <div className="p-20 text-center flex flex-col items-center justify-center">
                        <Package className="w-16 h-16 text-slate-200 mb-4" />
                        <div className="text-slate-400 font-bold mb-2">No se encontraron productos con los filtros actuales.</div>
                        <p className="text-slate-300 text-sm mb-6">Pruebe ajustando el periodo de análisis o el mínimo de venta.</p>
                        <button onClick={() => { setMinSales(0); setSelectedCategories([]); setSelectedManufacturers([]); }} className="text-indigo-600 font-black text-xs uppercase hover:underline">RESETEAR FILTROS</button>
                    </div>
                )}
            </div>

            {/* Sticky Export Footer */}
            <div className="bg-slate-900 m-2 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl sticky bottom-4 z-40 ring-4 ring-slate-950/10">
                <div className="text-white">
                    <div className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-3">
                        <Package className="w-6 h-6 text-emerald-400" />
                        Resumen del Pedido
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                        Total {suggestions.filter(s => s.manualOrder > 0 && !hiddenIds.has(s.barcode)).length} productos para reponer.
                    </p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <button
                        onClick={exportToDrugstore}
                        disabled={suggestions.filter(s => s.manualOrder > 0).length === 0}
                        className="flex-1 md:flex-none flex items-center justify-center gap-4 bg-emerald-500 text-slate-950 px-10 py-5 rounded-2xl font-black hover:bg-emerald-400 transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-emerald-500/20"
                    >
                        <Download className="w-6 h-6" />
                        GENERAR ARCHIVO DROGUERÍA (.TXT)
                    </button>
                </div>
            </div>
        </div >
    );
};
