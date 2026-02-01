import React, { useState } from 'react';
import { eachDayOfInterval, parseISO } from 'date-fns';
import { RefreshCw, Database, CloudLightning, ShieldCheck, AlertCircle, CheckCircle2, Search, Download, User, ShoppingBag, CreditCard, ChevronDown, HeartPulse, Trash2, Calendar, Upload, Truck, Wallet } from 'lucide-react';
import { searchZettiInvoices, searchZettiInvoiceByNumber, ZETTI_NODES, searchZettiProviderReceipts, searchZettiInsuranceReceipts, searchZettiCustomers } from '../utils/zettiService';
import { formatMoney } from '../utils/dataHelpers';
import { format } from 'date-fns';
import { InvoiceRecord, SaleRecord, ExpenseRecord, InsuranceRecord, CurrentAccountRecord } from '../types';
import { functions } from '../src/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { purgeDataByDateRange, saveProductMasterToDB, saveSalesToDB, saveInvoicesToDB, saveExpensesToDB, saveInsuranceToDB, saveCurrentAccountsToDB, saveServicesToDB, getMetadata } from '../utils/db';

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
    const [syncProgress, setSyncProgress] = useState<Record<string, 'pending' | 'syncing' | 'success' | 'error'>>({});
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'success' | 'warn' | 'error' }[]>([]);

    const addLog = (msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
        setLogs(prev => [...prev.slice(-49), { msg, type }]);
        console.log(`[SYNC LOG] ${msg}`);
    };

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
        setSyncProgress({});
        setCounts({ sales: 0, expenses: 0, insurance: 0, customers: 0 });
        setLogs([]);
        addLog(`Iniciando sincronización desde ${startDate} hasta ${endDate}`, 'info');

        try {
            const days = eachDayOfInterval({
                start: parseISO(startDate),
                end: parseISO(endDate)
            });

            console.log(`[ZETTI SYNC] Total de días a procesar: ${days.length}`);

            let allSales: any[] = [];
            let allExpenses: any[] = [];
            let allInsurance: any[] = [];

            // 1. Iteramos por cada día
            for (const day of days) {
                const dayStr = format(day, 'yyyy-MM-dd');
                console.group(`📅 DIA: ${dayStr}`);

                // --- CATEGORIA 1: VENTAS ---
                console.log('%c[1/3] Sincronizando Ventas...', 'color: #818cf8');
                setSyncProgress(prev => ({ ...prev, sales: 'syncing' }));
                const [bioSales, chaSales] = await Promise.all([
                    searchZettiInvoices(dayStr, dayStr, ZETTI_NODES.BIOSALUD, false),
                    searchZettiInvoices(dayStr, dayStr, ZETTI_NODES.CHACRAS, false)
                ]);
                const daySales = [
                    ...(bioSales.content || bioSales || []).map((r: any) => ({ ...r, _branch: 'FCIA BIOSALUD' })),
                    ...(chaSales.content || chaSales || []).map((r: any) => ({ ...r, _branch: 'BIOSALUD CHACRAS PARK' }))
                ];
                allSales = [...allSales, ...daySales];
                setCounts(prev => ({ ...prev, sales: allSales.length }));
                setResults([...allSales]); // Actualizar UI
                addLog(`Día ${dayStr}: ${daySales.length} ventas encontradas`, 'success');

                // --- CATEGORIA 2: GASTOS ---
                console.log('%c[2/3] Sincronizando Gastos...', 'color: #fb923c');
                setSyncProgress(prev => ({ ...prev, expenses: 'syncing' }));
                const [bioExp, chaExp] = await Promise.all([
                    searchZettiProviderReceipts(dayStr, dayStr, ZETTI_NODES.BIOSALUD),
                    searchZettiProviderReceipts(dayStr, dayStr, ZETTI_NODES.CHACRAS)
                ]);
                const dayExpenses = [
                    ...(bioExp.content || bioExp || []).map((r: any) => ({ ...r, _branch: 'FCIA BIOSALUD' })),
                    ...(chaExp.content || chaExp || []).map((r: any) => ({ ...r, _branch: 'BIOSALUD CHACRAS PARK' }))
                ];
                allExpenses = [...allExpenses, ...dayExpenses];
                setCounts(prev => ({ ...prev, expenses: allExpenses.length }));
                addLog(`Día ${dayStr}: ${dayExpenses.length} gastos encontrados`, 'info');

                // --- CATEGORIA 3: OBRAS SOCIALES ---
                console.log('%c[3/3] Sincronizando Obras Sociales...', 'color: #10b981');
                setSyncProgress(prev => ({ ...prev, insurance: 'syncing' }));
                const [bioIns, chaIns] = await Promise.all([
                    searchZettiInsuranceReceipts(dayStr, dayStr, ZETTI_NODES.BIOSALUD),
                    searchZettiInsuranceReceipts(dayStr, dayStr, ZETTI_NODES.CHACRAS)
                ]);
                const dayInsurance = [
                    ...(bioIns.content || bioIns || []).map((r: any) => ({ ...r, _branch: 'FCIA BIOSALUD' })),
                    ...(chaIns.content || chaIns || []).map((r: any) => ({ ...r, _branch: 'BIOSALUD CHACRAS PARK' }))
                ];
                allInsurance = [...allInsurance, ...dayInsurance];
                setCounts(prev => ({ ...prev, insurance: allInsurance.length }));
                if (dayInsurance.length > 0) addLog(`Día ${dayStr}: ${dayInsurance.length} liquidaciones OS`, 'success');

                console.groupEnd();
            }

            setSyncProgress(prev => ({ ...prev, sales: 'success', expenses: 'success', insurance: 'success' }));

            // 2. Sincronizar Clientes/Saldos (Cta Cte) - Una sola vez al final
            console.log('%c[FINAL] Sincronizando Saldos de Clientes...', 'color: #ec4899; font-weight: bold;');
            setSyncProgress(prev => ({ ...prev, customers: 'syncing' }));
            const [custBio, custChacras] = await Promise.all([
                searchZettiCustomers(ZETTI_NODES.BIOSALUD, { pageSize: 1000 }),
                searchZettiCustomers(ZETTI_NODES.CHACRAS, { pageSize: 1000 })
            ]);
            const combinedCustomers = [
                ...(custBio.content || custBio || []).map((r: any) => ({ ...r, _branch: 'FCIA BIOSALUD' })),
                ...(custChacras.content || custChacras || []).map((r: any) => ({ ...r, _branch: 'BIOSALUD CHACRAS PARK' }))
            ];
            setCounts(prev => ({ ...prev, customers: combinedCustomers.length }));
            setSyncProgress(prev => ({ ...prev, customers: 'success' }));
            addLog(`Sincronización de ${combinedCustomers.length} clientes finalizada`, 'success');
            addLog('Guardando datos en Firebase Storage...', 'info');

            console.log('%c[COMPLETO] Sincronización finalizada exitosamente 🎉', 'color: #10b981; font-weight: bold; font-size: 14px;');
            setStatus('success');

            // Persistir todo
            processAndSaveAll({
                sales: allSales,
                expenses: allExpenses,
                insurance: allInsurance,
                customers: combinedCustomers
            });

            alert(`✅ Sincronización Exitosa:\n- ${allSales.length} Ventas\n- ${allExpenses.length} Gastos\n- ${allInsurance.length} Obras Sociales\n- ${combinedCustomers.length} Clientes`);

        } catch (err: any) {
            console.error('%c[ERROR SYNC]', 'color: #ef4444; font-weight: bold;', err);
            addLog(`ERROR: ${err.message}`, 'error');
            setStatus('error');
            setError(err.message || 'Error al conectar con Zetti');
        } finally {
            setIsSyncing(false);
        }
    };

    const processAndSaveAll = async (raw: { sales: any[], expenses: any[], insurance: any[], customers: any[] }) => {
        // --- VENTAS & INVOICES ---
        const invoices: InvoiceRecord[] = [];
        const allSales: SaleRecord[] = [];

        raw.sales.forEach(item => {
            const rawDate = item.fec || new Date().toISOString();
            const payments = item.pagos || [];
            const agreement = payments.find((p: any) => p.t === 'agreement' || p.t === 'prescription');
            const card = payments.find((p: any) => p.t === 'card' || p.t === 'cardInstallment');
            const checking = payments.find((p: any) => p.t === 'checkingAccount');

            let mainPay = 'Efectivo';
            if (agreement) mainPay = 'Obra Social';
            else if (card) mainPay = card.n || 'Tarjeta';
            else if (checking) mainPay = 'Cuenta Corriente';

            const entity = agreement?.n || 'Particular';

            let normalizedType = 'FV';
            const tco = (item.tco || '').toUpperCase();
            if (tco.includes('NC') || tco.includes('CREDITO')) normalizedType = 'NC';
            else if (tco.includes('TRANSFER') || tco.includes('TX')) normalizedType = 'TX';
            else normalizedType = item.tco || 'FV';

            const invoice: InvoiceRecord = {
                id: item.id || `Z-${Math.random()}`,
                invoiceNumber: item.cod || 'S/N',
                type: normalizedType as any,
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
                    category: it.cat || it.lab || 'Varios',
                    branch: invoice.branch,
                    sellerName: invoice.seller,
                    entity: invoice.entity,
                    paymentMethod: invoice.paymentType,
                    barcode: it.bar || '',
                    manufacturer: it.lab || 'Zetti',
                    hour: new Date(rawDate).getHours()
                });
            });
        });

        // --- GASTOS (PROVIDER RECEIPTS) ---
        // --- GASTOS Y SERVICIOS (PROVIDER RECEIPTS) ---
        const mappedExpenses: ExpenseRecord[] = [];
        const mappedServices: ExpenseRecord[] = [];

        // Recuperar categorías de servicios para separación automática
        const serviceCategories = await getMetadata('service_categories') || {};
        console.log(`[SYNC] Categorías de servicios detectadas: ${Object.keys(serviceCategories).length}`);

        raw.expenses.forEach(r => {
            const amount = r.mainAmount || r.totalAmount || r.amount || 0;
            const supplierName = r.supplier?.name || r.provider?.name || (typeof r.supplier === 'string' ? r.supplier : 'Proveedor');
            const isService = !!serviceCategories[supplierName];

            const record: ExpenseRecord = {
                id: r.id?.toString() || Math.random().toString(),
                supplier: supplierName,
                amount: amount,
                issueDate: new Date(r.emissionDate || new Date()),
                dueDate: new Date(r.dueDate || r.emissionDate || new Date()),
                branch: r._branch || 'General',
                monthYear: format(new Date(r.emissionDate || new Date()), 'yyyy-MM'),
                code: r.number || r.codification || '-',
                type: r.valueType?.name || (typeof r.valueType === 'string' ? r.valueType : 'Factura'),
                status: r.status?.name || (typeof r.status === 'string' ? r.status : 'Pagado'),
                operationType: isService ? 'Servicio Zetti' : 'Gasto Zetti',
                items: []
            };

            if (isService) {
                mappedServices.push(record);
            } else {
                mappedExpenses.push(record);
            }
        });

        // --- SEGUROS (INSURANCE RECEIPTS) ---
        const mappedInsurance: InsuranceRecord[] = [];
        raw.insurance.forEach(r => {
            const amount = r.mainAmount || r.totalAmount || r.amount || 0;
            const entityName = r.healthInsuranceProvider?.name || r.entity?.name || (typeof r.entity === 'string' ? r.entity : 'O.S.');

            // Si por error Zetti nos devuelve un proveedor de droguería aquí, lo ignoramos o movemos
            // (Evitamos duplicidad de $72M)
            if (entityName.toUpperCase().includes('DEL SUD') || entityName.toUpperCase().includes('MONROE') || entityName.toUpperCase().includes('COFARMEN')) {
                console.warn(`[SYNC] Filtrando ${entityName} de Obras Sociales por ser Proveedor.`);
                return;
            }

            mappedInsurance.push({
                id: r.id?.toString() || Math.random().toString(),
                entity: entityName,
                amount: amount,
                issueDate: new Date(r.emissionDate || new Date()),
                dueDate: new Date(r.dueDate || r.emissionDate || new Date()),
                branch: r._branch || 'General',
                monthYear: format(new Date(r.emissionDate || new Date()), 'yyyy-MM'),
                code: r.number || r.codification || '-',
                type: r.valueType?.name || (typeof r.valueType === 'string' ? r.valueType : 'Liquidación'),
                status: r.status?.name || (typeof r.status === 'string' ? r.status : 'Pagado'),
                operationType: 'Obra Social Zetti',
                items: []
            });
        });

        // --- CLIENTES (SALDOS / CTA CTE) ---
        const mappedCurrentAccount: CurrentAccountRecord[] = raw.customers.filter((c: any) => (c.balance || 0) !== 0).map((c: any) => ({
            id: c.id?.toString() || Math.random().toString(),
            entity: c.fullName || c.razonSocial || 'Cliente Desconocido',
            date: new Date(),
            type: (c.balance || 0) > 0 ? 'Debe' : 'Haber',
            debit: (c.balance || 0) > 0 ? c.balance : 0,
            credit: (c.balance || 0) < 0 ? Math.abs(c.balance) : 0,
            balance: c.balance || 0,
            description: 'Saldo Actualizado via API',
            reference: c.code || '-',
            branch: c._branch || 'General'
        }));

        // PERSIST ALL - With cross-file cleanup for Expenses/Services
        addLog('Iniciando persistencia y limpieza de duplicados...', 'info');

        await Promise.all([
            saveSalesToDB(allSales),
            saveInvoicesToDB(invoices),
            saveExpensesToDB(mappedExpenses),
            saveServicesToDB(mappedServices),
            saveInsuranceToDB(mappedInsurance),
            saveCurrentAccountsToDB(mappedCurrentAccount)
        ]);

        // Trigger background product enrichment if needed
        handleEnrichProcess().catch(err => console.error("Auto-enrichment failed:", err));

        onDataImported({
            invoices,
            sales: allSales,
            expenses: mappedExpenses,
            insurance: mappedInsurance,
            services: mappedServices,
            currentAccounts: mappedCurrentAccount
        });

        // --- 6. AUTO-ENRICHMENT ---
        addLog('Iniciando Enriquecimiento de Datos en segundo plano...', 'info');
        handleEnrichProcess()
            .then(() => addLog('Enriquecimiento completado', 'success'))
            .catch(err => addLog(`Error en enriquecimiento: ${err.message}`, 'error'));
    };

    const handleEnrichProcess = async () => {
        try {
            const { db } = await import('../src/firebaseConfig');
            const { collection, doc, setDoc, onSnapshot } = await import('firebase/firestore');

            const requestId = `enrich_${Date.now()}`;
            const requestRef = doc(db, 'zetti_enrich_requests', requestId);
            const responseRef = doc(db, 'zetti_enrich_responses', requestId);

            // Crear la solicitud (esto dispara la Cloud Function)
            await setDoc(requestRef, {
                timestamp: new Date(),
                status: 'pending'
            });

            addLog('⚡ Solicitud de enriquecimiento enviada...', 'info');

            // Escuchar la respuesta
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    unsubscribe();
                    reject(new Error('Timeout esperando respuesta'));
                }, 120000); // 2 minutos

                const unsubscribe = onSnapshot(responseRef, async (snapshot) => {
                    if (snapshot.exists()) {
                        clearTimeout(timeout);
                        unsubscribe();

                        const data = snapshot.data();

                        // Limpiar documentos
                        try {
                            const { deleteDoc } = await import('firebase/firestore');
                            await deleteDoc(requestRef);
                            await deleteDoc(responseRef);
                        } catch (cleanupError) {
                            console.warn('Error limpiando documentos:', cleanupError);
                        }

                        if (data.error) {
                            reject(new Error(data.error));
                        } else {
                            const msg = data.message || 'Proceso finalizado';
                            const count = data.count || 0;

                            if (count > 0) {
                                addLog(`⚡ ${msg}`, 'success');
                            } else {
                                addLog(`⚡ ${msg}`, 'info');
                            }
                            resolve(data);
                        }
                    }
                });
            });
        } catch (e: any) {
            console.error("Enrichment failed:", e);
            throw e;
        }
    };

    const handleRepair = async () => {
        try {
            addLog("Iniciando reparación de rubros/fabricantes via Túnel Firestore...", "info");
            const { collection, addDoc, doc, onSnapshot } = await import('firebase/firestore');
            const { db } = await import('../src/firebaseConfig');

            // 1. Crear solicitud en coleccion requests
            const reqRef = await addDoc(collection(db, 'zetti_repair_requests'), {
                timestamp: new Date(),
                requestedBy: 'dashboard'
            });

            // 2. Escuchar respuesta en coleccion responses
            addLog(`Solicitud ID: ${reqRef.id}`, "info");
            const unsub = onSnapshot(doc(db, 'zetti_repair_responses', reqRef.id), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.error) {
                        addLog(`Error en reparación: ${data.error}`, "error");
                        alert(`Error: ${data.error}`);
                    } else {
                        addLog(`✅ Reparación completada: ${data.updatedTotal} registros actualizados.`, "success");
                        alert("✅ Reparación completada. Recargue el Dashboard para ver los cambios.");
                    }
                    unsub();
                }
            });

            // Timeout de seguridad para la UI
            setTimeout(() => { unsub(); }, 30000);

        } catch (e: any) {
            addLog(`Error al iniciar reparación: ${e.message}`, "error");
            alert(`Error: ${e.message}`);
        }
    };

    const handleManualAudit = async () => {
        if (!manualInvoice) return;
        setAuditLoading(true);
        setAuditError(null);
        setAuditResult(null);

        try {
            const data = await searchZettiInvoiceByNumber(manualInvoice, manualNodeId === ZETTI_NODES.CHACRAS ? 'CHACRAS' : 'BIOSALUD');
            let results = data?.content || (Array.isArray(data) ? data : (data?.id ? [data] : []));

            if (results.length > 0) {
                // Sort by date descending to get the most recent one (e.g. 2026 over 2025)
                results.sort((a: any, b: any) => {
                    const dateA = new Date(a.emissionDate || a.creationDate || 0).getTime();
                    const dateB = new Date(b.emissionDate || b.creationDate || 0).getTime();
                    return dateB - dateA;
                });
                setAuditResult(results[0]);
            } else {
                setAuditError('No se encontró el comprobante.');
            }
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
            const removed = await purgeDataByDateRange(purgeStartDate, purgeEndDate);
            setPurgeResult(`✅ Eliminados: ${removed.invoicesRemoved} fac, ${removed.salesRemoved} items, ${removed.expensesRemoved} gst, ${removed.servicesRemoved} serv, ${removed.insuranceRemoved} os, ${removed.stockRemoved} stock.`);
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

    const handleSeedFirestore = async () => {
        setIsUploadingMaster(true);
        try {
            addLog("Iniciando Sincronización con Firestore via Túnel...", "info");
            const { collection, addDoc, doc, onSnapshot } = await import('firebase/firestore');
            const { db } = await import('../src/firebaseConfig');

            const reqRef = await addDoc(collection(db, 'zetti_seed_requests'), {
                timestamp: new Date()
            });

            const unsub = onSnapshot(doc(db, 'zetti_seed_responses', reqRef.id), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setIsUploadingMaster(false);
                    if (data.error) {
                        addLog(`Error: ${data.error}`, "error");
                    } else {
                        addLog(`✅ Firestore poblado: ${data.total} productos registrados.`, "success");
                        alert(`✅ ${data.total} productos agregados.`);
                    }
                    unsub();
                }
            });

            setTimeout(() => { unsub(); setIsUploadingMaster(false); }, 30000);
        } catch (e: any) {
            addLog(`Error en seeding: ${e.message}`, "error");
            alert(`Error: ${e.message}`);
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
                    category: it.cat || it.lab || 'Varios',
                    branch: invoice.branch,
                    sellerName: invoice.seller,
                    entity: invoice.entity,
                    paymentMethod: invoice.paymentType,
                    barcode: it.bar || '',
                    hour: new Date(rawDate).getHours(),
                    manufacturer: it.lab || 'Zetti'
                });
            });
        });

        onDataImported({ invoices, sales: allSales });
        addLog(`Importación manual: ${invoices.length} facturas vinculadas`, 'success');
        alert(`✅ ${invoices.length} Comprobantes y ${allSales.length} ítems de venta cargados al panel.`);
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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {[
                            { id: 'sales', label: 'Ventas e Invoices', icon: ShoppingBag, color: 'indigo' },
                            { id: 'expenses', label: 'Facturas Proveedor', icon: Truck, color: 'orange' },
                            { id: 'insurance', label: 'Obras Sociales', icon: HeartPulse, color: 'emerald' },
                            { id: 'customers', label: 'Saldos / Cta Cte', icon: Wallet, color: 'pink' }
                        ].map(cat => (
                            <div key={cat.id} className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                                <div className={`p-2 rounded-xl bg-${cat.color}-500/20`}>
                                    <cat.icon className={`w-5 h-5 text-${cat.color}-400`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold text-xs truncate">{cat.label}</p>
                                    <div className="flex items-center gap-2">
                                        {syncProgress[cat.id] === 'syncing' ? (
                                            <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
                                        ) : syncProgress[cat.id] === 'success' ? (
                                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        ) : syncProgress[cat.id] === 'error' ? (
                                            <AlertCircle className="w-3 h-3 text-red-400" />
                                        ) : (
                                            <div className="w-3 h-3 rounded-full bg-slate-700" />
                                        )}
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                                            {syncProgress[cat.id] === 'syncing' ? 'Sincronizando...' :
                                                syncProgress[cat.id] === 'success' ? `${counts[cat.id] || 0} Registros` :
                                                    syncProgress[cat.id] === 'error' ? 'Error' : 'Pendiente'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className={`flex-1 py-4 px-8 rounded-2xl bg-indigo-600 text-white font-black text-sm tracking-tight hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed group h-[60px]`}
                        >
                            {isSyncing ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <CloudLightning className="w-5 h-5 group-hover:scale-125 transition-transform" />
                            )}
                            {isSyncing ? 'SINCRONIZANDO REPORTE UNIVERSAL...' : 'INICIAR SINCRONIZACIÓN COMPLETA'}
                        </button>

                        <button
                            onClick={() => handleEnrichProcess().then(() => alert("Enriquecimiento lanzado.")).catch(e => alert(e.message))}
                            disabled={isSyncing}
                            className={`w-full md:w-auto py-4 px-8 rounded-2xl bg-emerald-100 text-emerald-700 font-black text-sm tracking-tight hover:bg-emerald-200 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/10 disabled:opacity-50 disabled:cursor-not-allowed group h-[60px] whitespace-nowrap`}
                            title="Forzar búsqueda de datos faltantes en productos"
                        >
                            <ShieldCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            ENRIQUECER
                        </button>

                        <button
                            onClick={handleRepair}
                            disabled={isSyncing}
                            className={`w-full md:w-auto py-4 px-8 rounded-2xl bg-orange-100 text-orange-700 font-black text-sm tracking-tight hover:bg-orange-200 transition-all flex items-center justify-center gap-3 shadow-xl shadow-orange-600/10 disabled:opacity-50 disabled:cursor-not-allowed group h-[60px] whitespace-nowrap`}
                            title="Actualizar las categorías de ventas pasadas usando el maestro de productos"
                        >
                            <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform" />
                            REPARAR RUBROS
                        </button>
                    </div>


                    {/* MINI CONSOLA DE LOGS */}
                    {(isSyncing || logs.length > 0) && (
                        <div className="mt-8 bg-black/40 rounded-2xl border border-white/5 p-4 font-mono text-[10px] overflow-hidden">
                            <div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-2 text-slate-500 uppercase font-black">
                                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                Console.log_output
                            </div>
                            <div className="max-h-[120px] overflow-y-auto space-y-1 scrollbar-hide flex flex-col-reverse">
                                {[...logs].reverse().map((log, i) => (
                                    <div key={i} className={`flex gap-2 ${log.type === 'error' ? 'text-red-400' :
                                        log.type === 'success' ? 'text-emerald-400' :
                                            log.type === 'warn' ? 'text-yellow-400' : 'text-slate-300'}`}>
                                        <span className="opacity-30">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                                        <span className="font-bold">{log.msg}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
                                {isUploadingMaster ? 'SUBIENDO...' : 'SUBIR JSON'}
                                <input type="file" accept=".json" onChange={handleMasterListUpload} className="hidden" disabled={isUploadingMaster} />
                            </label>

                            <button
                                onClick={handleSeedFirestore}
                                disabled={isUploadingMaster}
                                className={`px-8 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-3 ${isUploadingMaster ? 'bg-slate-100 text-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xl shadow-emerald-200'}`}
                            >
                                <Database className="w-4 h-4" />
                                {isUploadingMaster ? 'PROCESANDO...' : 'SINCRONIZAR CON FIRESTORE'}
                            </button>

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
