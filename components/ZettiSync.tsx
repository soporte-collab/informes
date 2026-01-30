import React, { useState } from 'react';
import { RefreshCw, Database, CloudLightning, ShieldCheck, AlertCircle, CheckCircle2, Search, Download, User, ShoppingBag, CreditCard, ChevronDown, HeartPulse, Trash2, Calendar, Upload } from 'lucide-react';
import { searchZettiInvoices, searchZettiInvoiceByNumber, ZETTI_NODES } from '../utils/zettiService';
import { formatMoney } from '../utils/dataHelpers';
import { format } from 'date-fns';
import { InvoiceRecord, SaleRecord } from '../types';
import { functions } from '../src/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { purgeDataByDateRange, saveProductMasterToDB } from '../utils/db';

interface ZettiSyncProps {
    startDate: string;
    endDate: string;
    onDataImported: (data: any) => void;
}

export const ZettiSync: React.FC<ZettiSyncProps> = ({ startDate, endDate, onDataImported }) => {
    const [status, setStatus] = useState<'idle' | 'tunneling' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<any[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // --- PURGE STATE ---
    const [purgeStartDate, setPurgeStartDate] = useState<string>('');
    const [purgeEndDate, setPurgeEndDate] = useState<string>('');
    const [isPurging, setIsPurging] = useState(false);
    const [purgeResult, setPurgeResult] = useState<string | null>(null);

    // --- MASTER LIST STATE ---
    const [isUploadingMaster, setIsUploadingMaster] = useState(false);
    const [masterUploadResult, setMasterUploadResult] = useState<string | null>(null);

    // --- MANUAL AUDIT STATE ---
    const [manualNodeId, setManualNodeId] = useState(ZETTI_NODES.BIOSALUD);
    const [manualInvoice, setManualInvoice] = useState('');
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditResult, setAuditResult] = useState<any>(null);
    const [auditError, setAuditError] = useState<string | null>(null);

    const handleSync = async () => {
        if (!startDate || !endDate) {
            alert('Selecciona un rango de fechas en el panel superior.');
            return;
        }

        setIsSyncing(true);
        setStatus('tunneling');
        setError(null);
        setResults([]);

        try {
            // Sincro unificada (Como antes, trae todo el bloque header + items basico)
            const [biosaludData, chacrasData] = await Promise.all([
                searchZettiInvoices(startDate, endDate, ZETTI_NODES.BIOSALUD, false),
                searchZettiInvoices(startDate, endDate, ZETTI_NODES.CHACRAS, false)
            ]);

            const rawBiosalud = (biosaludData.content || biosaludData || []).map((r: any) => ({ ...r, _branch: 'FCIA BIOSALUD' }));
            const rawChacras = (chacrasData.content || chacrasData || []).map((r: any) => ({ ...r, _branch: 'BIOSALUD CHACRAS PARK' }));

            const combined = [...rawBiosalud, ...rawChacras].sort((a, b) => {
                const dA = a.fec ? new Date(a.fec).getTime() : 0;
                const dB = b.fec ? new Date(b.fec).getTime() : 0;
                return dB - dA;
            });

            setResults(combined);
            setStatus('success');
        } catch (err: any) {
            console.error(err);
            setStatus('error');
            setError(err.message || 'Error al conectar con Zetti');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleManualAudit = async () => {
        if (!manualInvoice) return;
        setAuditLoading(true);
        setAuditError(null);
        setAuditResult(null);

        try {
            const data = await searchZettiInvoiceByNumber(manualInvoice, manualNodeId === ZETTI_NODES.CHACRAS ? 'CHACRAS' : 'BIOSALUD');
            if (data?.content?.length > 0) setAuditResult(data.content[0]);
            else if (data?.id) setAuditResult(data);
            else setAuditError('No se encontró el comprobante.');
        } catch (err: any) {
            setAuditError(err.message || 'Error en auditoría');
        } finally {
            setAuditLoading(false);
        }
    };

    const handlePurge = async () => {
        if (!purgeStartDate || !purgeEndDate) return;
        if (!confirm(`⚠️ ¿ELIMINAR PERMANENTEMENTE los datos de ${purgeStartDate} a ${purgeEndDate}?`)) return;

        setIsPurging(true);
        try {
            await purgeDataByDateRange(purgeStartDate, purgeEndDate);
            setPurgeResult(`✅ Registros eliminados correctamente.`);
        } catch (err: any) {
            setPurgeResult(`❌ Error: ${err.message}`);
        } finally {
            setIsPurging(false);
        }
    };

    const handleMasterListUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploadingMaster(true);
        setMasterUploadResult(null);

        try {
            // As we are in a browser environment, we can't easily read local files from outside the user selection
            // But since the user has the XLSX, we can process it here or ask them to upload the JSON I generated.
            // However, to keep it simple and robust, I'll allow uploading a JSON file directly.
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const content = e.target?.result as string;
                    const json = JSON.parse(content);
                    if (!Array.isArray(json)) throw new Error("Formato inválido: se esperaba un array.");

                    await saveProductMasterToDB(json);
                    setMasterUploadResult(`✅ Maestro actualizado: ${json.length} productos.`);
                } catch (err: any) {
                    setMasterUploadResult(`❌ Error: ${err.message}`);
                } finally {
                    setIsUploadingMaster(false);
                }
            };
            reader.readAsText(file);
        } catch (err: any) {
            setMasterUploadResult(`❌ Error: ${err.message}`);
            setIsUploadingMaster(false);
        }
    };

    const handleImport = () => {
        if (results.length === 0) return;

        const invoices: InvoiceRecord[] = [];
        const allSales: SaleRecord[] = [];

        results.forEach(item => {
            const rawDate = item.fec || new Date().toISOString();
            const payments = item.pagos || [];

            const agreement = payments.find((p: any) => p.t === 'agreement' || p.t === 'prescription');
            const card = payments.find((p: any) => p.t === 'card' || p.t === 'cardInstallment');
            const checking = payments.find((p: any) => p.t === 'checkingAccount');

            let mainPay = 'Efectivo';
            if (agreement) mainPay = 'Obra Social';
            else if (card) mainPay = card.n || 'Tarjeta';
            else if (checking) mainPay = 'Cuenta Corriente';
            else if (payments[0]) mainPay = payments[0].n;

            const entity = agreement?.n || 'Particular';

            const invoice: InvoiceRecord = {
                id: item.id || `Z-${Math.random()}`,
                invoiceNumber: item.cod || 'S/N',
                type: (item.tco || 'FV').includes('NC') ? 'NC' : 'FV',
                date: new Date(rawDate),
                monthYear: format(new Date(rawDate), 'yyyy-MM'),
                grossAmount: item.tot || 0,
                netAmount: item.tot || 0,
                discount: 0,
                seller: item.ven || 'BIO',
                entity: entity,
                insurance: entity !== 'Particular' ? entity : '-',
                paymentType: mainPay,
                branch: item._branch || 'FCIA BIOSALUD',
                client: item.cli || 'Particular'
            };
            invoices.push(invoice);

            (item.items || []).forEach((it: any) => {
                allSales.push({
                    id: `${invoice.id}-${it.id || Math.random()}`,
                    invoiceNumber: invoice.invoiceNumber,
                    date: new Date(rawDate),
                    monthYear: invoice.monthYear,
                    productName: it.nom || 'Producto',
                    quantity: it.can || 1,
                    unitPrice: it.pre || 0,
                    totalAmount: it.sub || 0,
                    category: 'Zetti Import',
                    branch: invoice.branch,
                    sellerName: invoice.seller,
                    entity: invoice.entity,
                    paymentMethod: invoice.paymentType,
                    barcode: it.bar || '',
                    hour: new Date(rawDate).getHours(),
                    manufacturer: 'Zetti'
                });
            });
        });

        onDataImported({ invoices, sales: allSales });
        alert(`✅ ${invoices.length} Comprobantes cargados al panel.`);
    };

    return (
        <div className="space-y-6">
            {/* --- PANEL DE SINCRONIZACION --- */}
            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5">
                    <Database className="w-40 h-40 text-blue-400" />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20">
                            <Database className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Zetti Live Sync</h2>
                            <p className="text-slate-400 text-xs">Conexión directa vía Túnel Firestore v4</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Rango Seleccionado</p>
                                <p className="text-lg font-black text-white">{startDate || '--'} / {endDate || '--'}</p>
                            </div>
                            <Calendar className="w-8 h-8 text-slate-600" />
                        </div>

                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className={`px-8 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all ${isSyncing
                                ? 'bg-slate-700 text-slate-500'
                                : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 active:scale-95 shadow-xl shadow-blue-600/20'
                                }`}
                        >
                            {isSyncing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <CloudLightning className="w-6 h-6" />}
                            {isSyncing ? 'SINCRONIZANDO...' : 'INICIAR CAPTURA ZETTI'}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- AUDITORIA Y PURGA --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Auditoria */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                        <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Auditoría de Comprobante</h3>
                    </div>
                    <div className="flex gap-4 mb-4">
                        <select
                            value={manualNodeId}
                            onChange={e => setManualNodeId(e.target.value)}
                            className="bg-slate-100 border-none rounded-xl px-4 py-3 text-xs font-bold"
                        >
                            <option value={ZETTI_NODES.BIOSALUD}>BIOSALUD</option>
                            <option value={ZETTI_NODES.CHACRAS}>CHACRAS</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Ej: 0001-00070692"
                            value={manualInvoice}
                            onChange={e => setManualInvoice(e.target.value)}
                            className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-xs font-mono font-bold"
                        />
                        <button
                            onClick={handleManualAudit}
                            className="bg-slate-900 text-white px-6 rounded-xl font-black text-[10px]"
                        >
                            {auditLoading ? '...' : 'AUDITAR'}
                        </button>
                    </div>
                    {auditResult && (
                        <div className="bg-slate-900 p-4 rounded-xl text-[10px] text-emerald-400 font-mono overflow-auto max-h-40">
                            <pre>{JSON.stringify(auditResult, null, 2)}</pre>
                        </div>
                    )}
                </div>

                {/* Purga */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <Trash2 className="w-5 h-5 text-red-600" />
                        <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest text-red-600">Purgar Base Histórica</h3>
                    </div>
                    <div className="flex gap-4 items-center">
                        <input type="date" value={purgeStartDate} onChange={e => setPurgeStartDate(e.target.value)} className="bg-slate-100 p-3 rounded-xl text-xs font-bold" />
                        <span className="text-slate-400">→</span>
                        <input type="date" value={purgeEndDate} onChange={e => setPurgeEndDate(e.target.value)} className="bg-slate-100 p-3 rounded-xl text-xs font-bold" />
                        <button
                            onClick={handlePurge}
                            disabled={isPurging}
                            className="bg-red-600 text-white px-6 py-3 rounded-xl font-black text-[10px] hover:bg-red-700"
                        >
                            {isPurging ? '...' : 'BORRAR'}
                        </button>
                    </div>
                    {purgeResult && <p className="mt-4 text-[10px] font-bold text-slate-600">{purgeResult}</p>}
                </div>

                {/* Gestión de Maestro de Productos */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm col-span-1 lg:col-span-2">
                    <div className="flex items-center gap-2 mb-6">
                        <ShoppingBag className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest text-indigo-600">Maestro de Productos (Códigos de Barra)</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                        <div className="max-w-md">
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Base de Conocimiento</p>
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                Suba el archivo <code className="bg-slate-100 px-1 rounded text-indigo-600">product_master.json</code> generado para actualizar la base de datos de códigos de barra.
                                Esto permite que el Asistente de Compras identifique productos que no tienen barra en Zetti.
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <label className={`cursor-pointer px-8 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-3 ${isUploadingMaster ? 'bg-slate-100 text-slate-300' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-200'}`}>
                                <Upload className="w-4 h-4" />
                                {isUploadingMaster ? 'SUBIENDO...' : 'ACTUALIZAR MAESTRO'}
                                <input type="file" accept=".json" onChange={handleMasterListUpload} className="hidden" disabled={isUploadingMaster} />
                            </label>
                            {masterUploadResult && <p className="text-[10px] font-bold text-indigo-500">{masterUploadResult}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- RESULTADOS --- */}
            {status === 'success' && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-emerald-500 p-2 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h4 className="font-black text-slate-800 text-sm">Captura Finalizada: {results.length} registros</h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">Datos listos para ser procesados</p>
                            </div>
                        </div>
                        <button
                            onClick={handleImport}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-black text-xs transition-all shadow-lg shadow-emerald-600/20"
                        >
                            PASAR AL PANEL GENERAL
                        </button>
                    </div>
                    <div className="max-h-[400px] overflow-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-500 sticky top-0 uppercase font-black text-[10px] tracking-tighter">
                                <tr>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4">Comprobante</th>
                                    <th className="p-4">Cliente</th>
                                    <th className="p-4 text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {results.map((r, i) => (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="p-4 font-bold text-slate-600">{r.fec ? format(new Date(r.fec), 'dd/MM HH:mm') : '-'}</td>
                                        <td className="p-4 font-mono font-black text-blue-600">{r.cod}</td>
                                        <td className="p-4 font-bold text-slate-700 truncate max-w-[200px]">{r.cli || 'Particular'}</td>
                                        <td className="p-4 text-right font-black text-emerald-600">{formatMoney(r.tot)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                    <div>
                        <h4 className="font-bold text-red-900">Error de conexión</h4>
                        <p className="text-xs text-red-700 mt-1">{error}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
