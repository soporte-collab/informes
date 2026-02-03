import React, { useState, useEffect, useMemo } from 'react';
import { eachDayOfInterval, parseISO } from 'date-fns';
import { RefreshCw, Database, CloudLightning, ShieldCheck, AlertCircle, CheckCircle2, Search, Download, User, ShoppingBag, CreditCard, ChevronDown, HeartPulse, Trash2, Calendar, Upload, Truck, Wallet, Eye, FileJson, Layers, X } from 'lucide-react';
import { searchZettiInvoices, searchZettiInvoiceByNumber, ZETTI_NODES, searchZettiProviderReceipts, searchZettiInsuranceReceipts, searchZettiCustomers } from '../utils/zettiService';
import { formatMoney, parseCurrency } from '../utils/dataHelpers';
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
    const [rawSales, setRawSales] = useState<any[]>([]);
    const [rawExpenses, setRawExpenses] = useState<any[]>([]);
    const [rawInsurance, setRawInsurance] = useState<any[]>([]);
    const [viewTab, setViewTab] = useState<'sales' | 'expenses' | 'insurance' | 'tools'>('sales');
    const [showInspector, setShowInspector] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isExploringOS, setIsExploringOS] = useState(false);
    const [syncProgress, setSyncProgress] = useState<Record<string, 'pending' | 'syncing' | 'success' | 'error'>>({});
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'success' | 'warn' | 'error' }[]>([]);

    useEffect(() => {
        if (viewTab === 'sales') setResults(rawSales);
        else if (viewTab === 'expenses') setResults(rawExpenses);
        else if (viewTab === 'insurance') setResults(rawInsurance);
        else if (viewTab === 'tools') setResults([]);
    }, [viewTab, rawSales, rawExpenses, rawInsurance]);

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
    const [selectedProduct, setSelectedProduct] = useState<{ name: string; barcode: string; category: string; manufacturer: string } | null>(null);
    const [isSavingProduct, setIsSavingProduct] = useState(false);
    const [unassignedProducts, setUnassignedProducts] = useState<any[]>([]);

    // --- INSURANCE AUDIT FILTERS ---
    const [auditOSFilter, setAuditOSFilter] = useState('TODAS');
    const [auditBranchFilter, setAuditBranchFilter] = useState('TODAS');
    const [auditDateFilter, setAuditDateFilter] = useState('');

    const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const { db } = await import('../src/firebaseConfig');
        const { collection, writeBatch, doc } = await import('firebase/firestore');
        const Papa = (await import('papaparse')).default;

        setIsSyncing(true);
        addLog(`🚀 Iniciando importación de ${files.length} archivos CSV...`, 'info');

        let totalImported = 0;
        let totalSkipped = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            addLog(`📄 Procesando: ${file.name}...`, 'info');

            await new Promise<void>((resolve) => {
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: async (results) => {
                        const rows = results.data as any[];
                        let batch = writeBatch(db);
                        let batchCount = 0;

                        for (const row of rows) {
                            const productName = (row['Producto'] || '').trim();

                            // 🔍 Filtro: Saltamos si empieza con { (Deshabilitados)
                            if (productName.startsWith('{')) {
                                totalSkipped++;
                                continue;
                            }

                            const barcode = (row['Código de barras'] || '').trim();
                            const productId = row['ID'] || '';

                            // ID único para Firestore (Si tiene EAN real lo usamos, sino el ID de Zetti)
                            // Evitamos 8881/9991 que son genéricos
                            const docId = barcode && barcode.length > 5 && barcode !== '8881' && barcode !== '9991'
                                ? barcode
                                : productId || `Z-${Math.random().toString(36).substring(7)}`;

                            if (!docId) continue;

                            const productMaster = {
                                name: productName,
                                barcode: barcode || null,
                                manufacturer: row['Fabricante'] || 'VARIOS',
                                category: row['Familia'] || 'SIN ASIGNAR',
                                productId: productId || null,
                                dieCode: row['Troquel'] || null,
                                externalCode: row['Código externo'] || null,
                                lastUpdated: new Date()
                            };

                            const docRef = doc(db, 'zetti_products_master', docId);
                            batch.set(docRef, productMaster, { merge: true });
                            batchCount++;
                            totalImported++;

                            if (batchCount >= 400) {
                                await batch.commit();
                                batch = writeBatch(db);
                                batchCount = 0;
                                addLog(`⏳ ...procesando ${totalImported} productos`, 'info');
                                // Pequeña pausa para no saturar
                                await new Promise(r => setTimeout(r, 50));
                            }
                        }

                        if (batchCount > 0) {
                            await batch.commit();
                        }
                        resolve();
                    }
                });
            });
        }

        setIsSyncing(false);
        addLog(`✅ IMPORTACIÓN FINALIZADA: ${totalImported} productos cargados, ${totalSkipped} descartados (con {).`, 'success');

        // Limpiar el input para permitir re-selección
        event.target.value = '';
    };

    const handleSaveManualCategory = async () => {
        if (!selectedProduct) return;
        setIsSavingProduct(true);
        try {
            const { updateProductInMaster } = await import('../utils/db');
            await updateProductInMaster(selectedProduct.barcode, {
                name: selectedProduct.name,
                category: selectedProduct.category,
                manufacturer: selectedProduct.manufacturer
            });
            addLog(`✅ Producto categorizado: ${selectedProduct.name} -> ${selectedProduct.category}`, 'success');
            setSelectedProduct(null);
            // Si estábamos viendo la lista de sin rubro, refrescarla
            if (unassignedProducts.length > 0) {
                findUnassignedProducts();
            }
        } catch (e: any) {
            alert("Error al guardar: " + e.message);
        } finally {
            setIsSavingProduct(false);
        }
    };

    const findUnassignedProducts = async () => {
        setIsSyncing(true);
        addLog("🔍 Buscando productos 'Sin Rubro' o 'Varios' en ventas históricas...", "info");
        try {
            const { getAllSalesFromDB } = await import('../utils/db');
            const sales = await getAllSalesFromDB();
            const unassigned = new Map();

            sales.forEach(s => {
                if (s.category === 'Varios' || s.category === 'SIN ASIGNAR' || !s.category) {
                    const key = s.barcode || s.productName;
                    if (!unassigned.has(key)) {
                        unassigned.set(key, {
                            name: s.productName,
                            barcode: s.barcode,
                            category: s.category,
                            manufacturer: s.manufacturer,
                            count: 1
                        });
                    } else {
                        unassigned.get(key).count += 1;
                    }
                }
            });

            const sorted = Array.from(unassigned.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, 50);

            setUnassignedProducts(sorted);
            addLog(`✅ Se encontraron ${unassigned.size} productos con problemas de rubro. Mostrando top 50.`, 'info');
        } catch (e: any) {
            addLog("Error al buscar: " + e.message, "error");
        } finally {
            setIsSyncing(false);
        }
    };

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

                try {
                    // --- CATEGORIA 1: VENTAS ---
                    console.log('%c[1/3] Sincronizando Ventas...', 'color: #818cf8');
                    setSyncProgress(prev => ({ ...prev, sales: 'syncing' }));
                    const [bioSales, chaSales] = await Promise.all([
                        searchZettiInvoices(dayStr, dayStr, ZETTI_NODES.BIOSALUD, { lightMode: false }),
                        searchZettiInvoices(dayStr, dayStr, ZETTI_NODES.CHACRAS, { lightMode: false })
                    ]);
                    const daySales = [
                        ...(bioSales.content || bioSales || []).map((r: any) => ({ ...r, _branch: 'FCIA BIOSALUD' })),
                        ...(chaSales.content || chaSales || []).map((r: any) => ({ ...r, _branch: 'BIOSALUD CHACRAS PARK' }))
                    ];
                    allSales = [...allSales, ...daySales];
                    setCounts(prev => ({ ...prev, sales: allSales.length }));
                    setResults([...allSales]); // Actualizar UI
                    if (daySales.length > 0) addLog(`Día ${dayStr}: ${daySales.length} ventas`, 'success');

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
                    if (dayExpenses.length > 0) addLog(`Día ${dayStr}: ${dayExpenses.length} gastos`, 'info');

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
                    if (dayInsurance.length > 0) addLog(`Día ${dayStr}: ${dayInsurance.length} recetas OS`, 'success');

                    // Real-time UI updates for all tabs
                    setRawSales([...allSales]);
                    setRawExpenses([...allExpenses]);
                    setRawInsurance([...allInsurance]);
                    setResults([...allSales]); // For the main generic view

                    // Wait a bit to not overwhelm the server (1 second)
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (dayError: any) {
                    console.error(`Error en día ${dayStr}:`, dayError);
                    addLog(`Error en día ${dayStr}: ${dayError.message}`, 'warn');
                    // Continue with next day
                } finally {
                    console.groupEnd();
                }
            }

            setSyncProgress(prev => ({ ...prev, sales: 'success', expenses: 'success', insurance: 'success' }));

            // 2. Sincronizar Clientes/Saldos (Cta Cte) - Una sola vez al final
            setSyncProgress(prev => ({ ...prev, customers: 'syncing' }));
            const [custBio, custChacras] = await Promise.all([
                searchZettiCustomers(ZETTI_NODES.BIOSALUD, { pageSize: 100 }),
                searchZettiCustomers(ZETTI_NODES.CHACRAS, { pageSize: 100 })
            ]);
            const combinedCustomers = [
                ...(custBio.content || custBio || []).map((r: any) => ({ ...r, _branch: 'FCIA BIOSALUD' })),
                ...(custChacras.content || custChacras || []).map((r: any) => ({ ...r, _branch: 'BIOSALUD CHACRAS PARK' }))
            ];
            setCounts(prev => ({ ...prev, customers: combinedCustomers.length }));
            setSyncProgress(prev => ({ ...prev, customers: 'success' }));
            addLog(`Sincronización de ${combinedCustomers.length} clientes finalizada`, 'success');

            // Actualizar estados para el inspector
            setRawSales(allSales);
            setRawExpenses(allExpenses);
            setRawInsurance(allInsurance);
            setViewTab('sales');
            setResults(allSales);
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

    const handleExploreOS = async () => {
        if (!startDate || !endDate) return alert('Selecciona fechas.');
        setIsExploringOS(true);
        setStatus('tunneling');
        setLogs([]);
        addLog(`Iniciando Exploración Profunda de Obras Sociales: ${startDate} al ${endDate}`, 'info');

        try {
            const [bio, cha] = await Promise.all([
                searchZettiInvoices(startDate, endDate, ZETTI_NODES.BIOSALUD, { includeAgreements: true, includeConcepts: true }),
                searchZettiInvoices(startDate, endDate, ZETTI_NODES.CHACRAS, { includeAgreements: true, includeConcepts: true })
            ]);

            const allRaw = [
                ...(bio.content || bio || []).map((r: any) => ({ ...r, _branch: 'FCIA BIOSALUD' })),
                ...(cha.content || cha || []).map((r: any) => ({ ...r, _branch: 'BIOSALUD CHACRAS PARK' }))
            ];

            // Filtrar solo los que tienen OS (agreement de tipo prescription o similar)
            const osOnly = allRaw.filter((r: any) =>
                (r.pagos || r.agreements || []).some((p: any) => p.t === 'prescription' || p.type === 'prescription' || p.n?.toUpperCase().includes('PAMI'))
            );

            setRawInsurance(osOnly);
            setViewTab('insurance');
            setResults(osOnly);
            setStatus('success');
            addLog(`Exploración finalizada. Encontrados ${osOnly.length} registros con Obra Social con detalle de montos.`, 'success');

        } catch (err: any) {
            setError(err.message);
            setStatus('error');
        } finally {
            setIsExploringOS(false);
        }
    };

    const processAndSaveAll = async (raw: { sales: any[], expenses: any[], insurance: any[], customers: any[] }) => {
        // --- VENTAS & INVOICES ---
        const invoices: InvoiceRecord[] = [];
        const allSales: SaleRecord[] = [];

        // Cargamos el maestro de productos para enriquecer categorías manuales
        const { getAllProductMasterFromDB } = await import('../utils/db');
        const productMaster = await getAllProductMasterFromDB();
        const masterMap = new Map();
        productMaster.forEach(p => {
            if (p.barcode) masterMap.set(p.barcode, p);
        });

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

            let insuranceAmount = 0;
            const entity = agreement?.n || 'Particular'; // Restored

            // 1. Intentar sacar el monto de la Obra Social desde "operations" (Nuevo Túnel Deep)
            if (item.operations && item.operations.length > 0) {
                // Buscamos operaciones que sean de tipo cobro por OS o similar
                // (En Zetti, la OS suele ser una operación con ciertos IDs, pero a falta de ID exacto,
                // buscamos por descarte o por match con el agreement)
                const opOS = item.operations.find((op: any) =>
                    op.operationType?.id === '10' || op.operationType?.description?.toUpperCase().includes('RECETA') ||
                    op.operationType?.description?.toUpperCase().includes('PLAN')
                );
                if (opOS) {
                    insuranceAmount = opOS.amount || opOS.mainAmount || 0;
                }
            }

            // 2. Si no, intentar desde agreements (Legacy o si Zetti lo manda directo)
            if (insuranceAmount === 0 && agreement) {
                insuranceAmount = agreement.mainAmount || agreement.amount || 0;
            }

            // Si es obv. social pero amount es 0, a veces Zetti pone el total en "tot"
            // NO ASUMIMOS NADA SI ES 0.

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
                grossAmount: parseCurrency(item.tot),
                netAmount: parseCurrency(item.tot),
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
                // Capturamos el costo si Zetti lo manda (como costPrice o purchaseCost)
                const unitCost = it.costPrice || it.purchaseCost || it.cost || 0;

                const barcode = it.bar || '';
                const masterInfo = masterMap.get(barcode);
                const finalCategory = masterInfo?.category || it.cat || it.lab || 'Varios';
                const finalManufacturer = masterInfo?.manufacturer || it.lab || 'Zetti';

                allSales.push({
                    id: `${invoice.id}-${it.id || Math.random()}`,
                    invoiceNumber: invoice.invoiceNumber,
                    date: new Date(rawDate),
                    monthYear: invoice.monthYear,
                    productName: it.nom || 'Producto',
                    quantity: parseCurrency(it.can) || 1,
                    unitPrice: parseCurrency(it.pre),
                    totalAmount: parseCurrency(it.sub),
                    category: finalCategory,
                    branch: invoice.branch,
                    sellerName: invoice.seller,
                    entity: invoice.entity,
                    paymentMethod: invoice.paymentType,
                    barcode: barcode,
                    manufacturer: finalManufacturer,
                    unitCost: parseCurrency(unitCost),
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
            const amountStr = r.mainAmount || r.totalAmount || r.amount || '0';
            const amount = parseCurrency(amountStr);
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
            // Priority: Operation amount -> mainAmount -> amount
            let amountStr = r.mainAmount || r.totalAmount || r.amount || '0';

            // Check operations from deep enrichment
            if (r.operations && r.operations.length > 0) {
                const opOS = r.operations.find((op: any) =>
                    op.operationType?.id === '10' || op.operationType?.description?.toUpperCase().includes('RECETA') ||
                    op.operationType?.description?.toUpperCase().includes('PLAN')
                );
                if (opOS) amountStr = opOS.amount || opOS.mainAmount || amountStr;
            }

            const amount = parseCurrency(amountStr);
            const entityName = r.healthInsuranceProvider?.name || r.entity?.name || (typeof r.entity === 'string' ? r.entity : 'O.S.');

            // Si por error Zetti nos devuelve un proveedor de droguería aquí, lo ignoramos o movemos
            // (Evitamos duplicidad de $72M)
            if (entityName.toUpperCase().includes('DEL SUD') || entityName.toUpperCase().includes('MONROE') || entityName.toUpperCase().includes('COFARMEN')) {
                console.warn(`[SYNC] Filtrando ${entityName} de Obras Sociales por ser Proveedor.`);
                return;
            }

            const agreement = (r.agreements || []).find((a: any) => a.type === 'prescription' || a.t === 'prescription');
            const patientAmount = agreement ? parseCurrency(agreement.clientAmount) : 0;
            const affiliate = agreement ? (agreement.affiliateNumber || '-') : '-';
            const plan = agreement ? (agreement.healthInsurancePlan?.shortName || agreement.healthInsurancePlan?.name || '-') : '-';

            mappedInsurance.push({
                id: r.id?.toString() || Math.random().toString(),
                entity: entityName,
                amount: amount,
                patientAmount: patientAmount,
                totalVoucher: amount + patientAmount,
                affiliate: affiliate,
                plan: plan,
                issueDate: new Date(r.emissionDate || new Date()),
                dueDate: new Date(r.dueDate || r.emissionDate || new Date()),
                branch: r._branch || 'General',
                monthYear: format(new Date(r.emissionDate || new Date()), 'yyyy-MM'),
                code: r.number || r.codification || '-',
                type: r.valueType?.name || (typeof r.valueType === 'string' ? r.valueType : 'Receta'),
                status: r.status?.name || (typeof r.status === 'string' ? r.status : 'INGRESADO'),
                operationType: 'Liquidación',
                items: [],
                rawAgreements: r.agreements || []
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

        // --- 6. AUTO-ENRICHMENT --- DESHABILITADO
        // addLog('Iniciando Enriquecimiento de Datos en segundo plano...', 'info');
        // handleEnrichProcess()
        //     .then(() => addLog('Enriquecimiento completado', 'success'))
        //     .catch(err => addLog(`Error en enriquecimiento: ${err.message}`, 'error'));
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
                setShowInspector(true);
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

    // --- FILTER LOGIC ---
    const filteredAuditResults = useMemo(() => {
        if (viewTab !== 'insurance') return [];
        return results.filter(r => {
            let osName = r.entity || r.healthInsuranceProvider?.name || 'S/D';
            if (r.agreements) {
                const agr = r.agreements.find((a: any) => a.type === 'prescription');
                if (agr && agr.healthInsurance) osName = agr.healthInsurance.name;
            }
            const dateStr = r.fec || r.emissionDate ? format(new Date(r.fec || r.emissionDate), 'yyyy-MM-dd') : '';

            const matchOS = auditOSFilter === 'TODAS' || osName === auditOSFilter;
            const matchBranch = auditBranchFilter === 'TODAS' || (r._branch === auditBranchFilter);
            const matchDate = !auditDateFilter || dateStr === auditDateFilter;

            return matchOS && matchBranch && matchDate;
        });
    }, [results, viewTab, auditOSFilter, auditBranchFilter, auditDateFilter]);

    const uniqueOSList = useMemo(() => {
        if (viewTab !== 'insurance') return [];
        const set = new Set(results.map(r => {
            if (r.agreements) {
                const agr = r.agreements.find((a: any) => a.type === 'prescription');
                if (agr && agr.healthInsurance) return agr.healthInsurance.name;
            }
            return r.entity || r.healthInsuranceProvider?.name || 'S/D';
        }));
        return Array.from(set).filter(Boolean).sort();
    }, [results, viewTab]);

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
                            onClick={handleExploreOS}
                            disabled={isExploringOS || isSyncing}
                            className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-3 ${isExploringOS ? 'bg-slate-800 text-slate-500' : 'bg-indigo-900 border border-indigo-700 text-indigo-100 hover:bg-indigo-800 shadow-xl'}`}
                        >
                            <HeartPulse className={`w-4 h-4 ${isExploringOS ? 'animate-pulse' : ''}`} />
                            {isExploringOS ? 'EXPLORANDO...' : ' EXPLORAR COBERTURAS OS'}
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
                        <button
                            onClick={() => { setViewTab('tools'); setStatus('success'); }}
                            className={`w-full md:w-auto py-4 px-8 rounded-2xl bg-rose-100 text-rose-700 font-black text-sm tracking-tight hover:bg-rose-200 transition-all flex items-center justify-center gap-3 shadow-xl shadow-rose-600/10 group h-[60px] whitespace-nowrap`}
                            title="Importar productos masivamente desde CSV"
                        >
                            <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            IMPORTAR CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* --- RESULTADOS & INSPECTOR --- */}
            {(status === 'success' || viewTab === 'tools') && (
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-2xl shadow-lg shadow-indigo-100 ${viewTab === 'insurance' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                                {viewTab === 'insurance' ? <HeartPulse className="w-5 h-5 text-white" /> : <FileJson className="w-5 h-5 text-white" />}
                            </div>
                            <div>
                                <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">
                                    {viewTab === 'insurance' ? 'Auditoría de Obras Sociales' : 'Captura de Datos Zetti'}
                                </h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                    {viewTab === 'insurance' ? 'Inteligencia Financiera de Recetas' : 'Inspector de Respuesta Cruda'}
                                </p>
                            </div>
                        </div>
                        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl gap-1">
                            <button onClick={() => setViewTab('sales')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewTab === 'sales' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Ventas</button>
                            <button onClick={() => setViewTab('expenses')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewTab === 'expenses' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Gastos</button>
                            <button onClick={() => setViewTab('insurance')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewTab === 'insurance' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>O.S.</button>
                            <button onClick={() => setViewTab('tools')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewTab === 'tools' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Herramientas</button>
                        </div>
                    </div>

                    {viewTab === 'insurance' ? (
                        // --- VISTA ESPECÍFICA PARA OBRAS SOCIALES ---
                        <div className="p-8">
                            {/* FILTERS TOOLBAR */}
                            <div className="flex flex-wrap items-center gap-4 mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Obra Social</label>
                                    <div className="relative">
                                        <select
                                            value={auditOSFilter}
                                            onChange={e => setAuditOSFilter(e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer"
                                        >
                                            <option value="TODAS">TODAS LAS OBRAS SOCIALES</option>
                                            {uniqueOSList.map(os => <option key={os} value={os}>{os}</option>)}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="w-[200px]">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sucursal</label>
                                    <div className="relative">
                                        <select
                                            value={auditBranchFilter}
                                            onChange={e => setAuditBranchFilter(e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer"
                                        >
                                            <option value="TODAS">TODAS</option>
                                            <option value="FCIA BIOSALUD">FCIA BIOSALUD</option>
                                            <option value="BIOSALUD CHACRAS PARK">CHACRAS PARK</option>
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="w-[150px]">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha</label>
                                    <input
                                        type="date"
                                        value={auditDateFilter}
                                        onChange={e => setAuditDateFilter(e.target.value)}
                                        className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>

                                {(auditOSFilter !== 'TODAS' || auditBranchFilter !== 'TODAS' || auditDateFilter) && (
                                    <button
                                        onClick={() => { setAuditOSFilter('TODAS'); setAuditBranchFilter('TODAS'); setAuditDateFilter(''); }}
                                        className="mt-6 p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                                        title="Limpiar Filtros"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Kpis Rápidos con Filtered Results */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                                    <p className="text-emerald-600 font-bold text-[10px] uppercase tracking-widest mb-2">Total Cobertura OS</p>
                                    <p className="text-3xl font-black text-slate-800">
                                        {formatMoney(filteredAuditResults.reduce((acc, r) => {
                                            let amt = r.amount || r.mainAmount || 0;
                                            if (r.agreements) {
                                                const agr = r.agreements.find((a: any) => a.type === 'prescription');
                                                if (agr) amt = agr.mainAmount || 0;
                                            }
                                            return acc + amt;
                                        }, 0))}
                                    </p>
                                </div>
                                <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                                    <p className="text-blue-600 font-bold text-[10px] uppercase tracking-widest mb-2">Cantidad Recetas</p>
                                    <p className="text-3xl font-black text-slate-800">{filteredAuditResults.length}</p>
                                </div>
                                <div className="bg-violet-50 rounded-2xl p-6 border border-violet-100 col-span-2">
                                    <p className="text-violet-600 font-bold text-[10px] uppercase tracking-widest mb-4">Top 3 Obras Sociales (Visible)</p>
                                    <div className="space-y-3">
                                        {(() => {
                                            const ranking = new Map();
                                            filteredAuditResults.forEach(r => {
                                                let name = r.entity || r.healthInsuranceProvider?.name || 'S/D';
                                                if (r.agreements) {
                                                    const agr = r.agreements.find((a: any) => a.type === 'prescription');
                                                    if (agr && agr.healthInsurance) name = agr.healthInsurance.name;
                                                }
                                                ranking.set(name, (ranking.get(name) || 0) + 1);
                                            });
                                            return Array.from(ranking.entries())
                                                .sort((a, b) => b[1] - a[1])
                                                .slice(0, 3)
                                                .map(([name, count], idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-violet-100 last:border-0 pb-1">
                                                        <span>{idx + 1}. {name}</span>
                                                        <span className="bg-white px-2 py-0.5 rounded-md text-violet-600">{count} rece</span>
                                                    </div>
                                                ));
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Tabla Especial Obras Sociales (Filtered) */}
                            <div className="max-h-[500px] overflow-auto custom-scrollbar rounded-2xl border border-slate-100">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-400 sticky top-0 uppercase font-black text-[9px] tracking-widest border-b border-slate-200 z-10">
                                        <tr>
                                            <th className="p-4">Fecha</th>
                                            <th className="p-4">Obra Social</th>
                                            <th className="p-4">Comprobante</th>
                                            <th className="p-4">Afiliado / Plan</th>
                                            <th className="p-4 text-right">Monto Cobertura</th>
                                            <th className="p-4 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 bg-white">
                                        {filteredAuditResults.length === 0 ? (
                                            <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No hay resultados con los filtros aplicados.</td></tr>
                                        ) : (
                                            filteredAuditResults.map((r, i) => {
                                                let osName = r.entity || r.healthInsuranceProvider?.name || '-';
                                                let osAmount = r.amount || r.mainAmount || 0;
                                                let ticket = r.cod || r.number || r.codification || 'S/N';
                                                let affiliate = '-';
                                                let plan = '-';

                                                if (r.agreements) {
                                                    const agr = r.agreements.find((a: any) => a.type === 'prescription');
                                                    if (agr) {
                                                        osAmount = agr.mainAmount;
                                                        if (agr.healthInsurance) osName = agr.healthInsurance.name;
                                                        if (agr.affiliateNumber) affiliate = agr.affiliateNumber;
                                                        if (agr.healthInsurancePlan) plan = agr.healthInsurancePlan.shortName || agr.healthInsurancePlan.name;
                                                    }
                                                }

                                                return (
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-4 font-bold text-slate-500 w-32">{r.fec || r.emissionDate ? format(new Date(r.fec || r.emissionDate), 'dd/MM HH:mm') : '-'}</td>
                                                        <td className="p-4 font-black text-slate-800">{osName}</td>
                                                        <td className="p-4"><span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded">{ticket}</span></td>
                                                        <td className="p-4 text-slate-500 max-w-[150px] truncate" title={`${affiliate} - ${plan}`}>
                                                            {affiliate !== '-' ? affiliate : ''} <span className="text-slate-300">|</span> {plan}
                                                        </td>
                                                        <td className="p-4 text-right font-black text-emerald-600 text-sm">{formatMoney(osAmount)}</td>
                                                        <td className="p-4 text-center flex items-center justify-center gap-2">
                                                            {r._branch && r._branch.toUpperCase().includes('CHACRAS')
                                                                ? <span className="text-[9px] font-bold text-orange-500 border border-orange-200 px-1 rounded">CHACRAS</span>
                                                                : <span className="text-[9px] font-bold text-blue-500 border border-blue-200 px-1 rounded">BIO</span>
                                                            }
                                                            <button onClick={() => { setAuditResult(r); setShowInspector(true); }} className="p-1.5 hover:bg-indigo-50 text-slate-300 hover:text-indigo-600 rounded-lg transition-all"><Eye className="w-3 h-3" /></button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : viewTab === 'tools' ? (
                        // --- NUEVA VISTA DE HERRAMIENTAS ---
                        <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-rose-50 rounded-[40px] p-12 border border-rose-100 flex flex-col items-center text-center shadow-sm">
                                    <div className="p-5 bg-rose-500 rounded-3xl text-white shadow-2xl shadow-rose-200 mb-8">
                                        <Database className="w-10 h-10" />
                                    </div>
                                    <h3 className="font-black text-slate-900 text-2xl uppercase tracking-tighter mb-3">Importador Maestro CSV</h3>
                                    <p className="text-sm text-slate-500 font-medium mb-10 leading-relaxed max-w-sm">
                                        Actualiza la inteligencia de productos BIOSALUD cargando los reportes de Zetti por familia.<br /><br />
                                        <span className="text-rose-600 font-black uppercase text-[10px] bg-rose-100 px-2 py-1 rounded-lg mr-2">Filtro Activo:</span>
                                        Se omiten productos que inician con <span className="font-black">"{"{"}"</span> (Discontinuados).
                                    </p>

                                    <label className="relative group cursor-pointer">
                                        <input
                                            type="file"
                                            multiple
                                            accept=".csv"
                                            onChange={handleCSVImport}
                                            className="hidden"
                                            disabled={isSyncing}
                                        />
                                        <div className={`px-12 py-6 ${isSyncing ? 'bg-slate-400' : 'bg-slate-900 group-hover:bg-rose-600'} text-white rounded-[24px] font-black text-xs uppercase tracking-widest flex items-center gap-4 transition-all shadow-2xl shadow-slate-900/30 active:scale-95`}>
                                            {isSyncing ? (
                                                <RefreshCw className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <Upload className="w-5 h-5" />
                                            )}
                                            {isSyncing ? 'Procesando...' : 'Seleccionar Archivos CSV'}
                                        </div>
                                    </label>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-6 tracking-widest">
                                        Formatos soportados: CSV Export de Zetti
                                    </p>
                                </div>

                                <div className="bg-slate-50 rounded-[40px] p-12 border border-slate-200 flex flex-col items-center text-center shadow-sm">
                                    <div className="p-5 bg-indigo-500 rounded-3xl text-white shadow-2xl shadow-indigo-200 mb-8">
                                        <Layers className="w-10 h-10" />
                                    </div>
                                    <h3 className="font-black text-slate-900 text-2xl uppercase tracking-tighter mb-3">Auditoría Sin Rubro</h3>
                                    <p className="text-sm text-slate-500 font-medium mb-10 leading-relaxed max-w-sm">
                                        Escanea las ventas históricas en busca de productos marcados como "Varios" o sin categoría asignada.
                                    </p>

                                    <button
                                        onClick={findUnassignedProducts}
                                        disabled={isSyncing}
                                        className="px-12 py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[24px] font-black text-xs uppercase tracking-widest flex items-center gap-4 transition-all shadow-2xl shadow-indigo-600/20 active:scale-95"
                                    >
                                        <Search className="w-5 h-5" />
                                        {isSyncing ? 'Buscando...' : 'Buscar Productos Sin Rubro'}
                                    </button>

                                    {unassignedProducts.length > 0 && (
                                        <div className="mt-8 w-full max-h-[300px] overflow-auto rounded-2xl border border-slate-200 bg-white">
                                            <table className="w-full text-[10px] text-left">
                                                <thead className="bg-slate-50 sticky top-0 font-black uppercase tracking-wider text-slate-400">
                                                    <tr>
                                                        <th className="p-3">Producto</th>
                                                        <th className="p-3 text-center">Ventas</th>
                                                        <th className="p-3 text-right">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {unassignedProducts.map((p, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50">
                                                            <td className="p-3 font-bold text-slate-700 truncate max-w-[150px]">{p.name}</td>
                                                            <td className="p-3 text-center font-black text-indigo-600">{p.count}</td>
                                                            <td className="p-3 text-right">
                                                                <button
                                                                    onClick={() => setSelectedProduct(p)}
                                                                    className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg font-black uppercase hover:bg-indigo-600 hover:text-white transition-all"
                                                                >
                                                                    Fix
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // --- VISTA GENÉRICA (VENTAS / GASTOS) ---
                        <div className="max-h-[400px] overflow-auto custom-scrollbar">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-white text-slate-400 sticky top-0 uppercase font-black text-[9px] tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="p-6">Fecha/Hora</th>
                                        <th className="p-6">Identificador</th>
                                        <th className="p-6">Origen / Tercero</th>
                                        <th className="p-6 text-right">Monto Neto</th>
                                        <th className="p-6 text-center">Detalle</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {results.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-slate-400 font-bold italic uppercase tracking-widest text-[10px]">No hay registros en esta categoría</td>
                                        </tr>
                                    ) : (
                                        results.map((r, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                                <td className="p-6 font-bold text-slate-500">{r.fec || r.emissionDate ? format(new Date(r.fec || r.emissionDate), 'dd/MM HH:mm') : '-'}</td>
                                                <td className="p-6"><span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg text-[10px]">{r.cod || r.number || r.codification || 'S/N'}</span></td>
                                                <td className="p-6 font-bold text-slate-900 truncate max-w-[250px]">
                                                    <button
                                                        onClick={() => setSelectedProduct({
                                                            name: r.productName || r.cli || '',
                                                            barcode: r.barcode || '',
                                                            category: r.category || '',
                                                            manufacturer: r.manufacturer || ''
                                                        })}
                                                        className="hover:text-indigo-600 transition-colors text-left"
                                                    >
                                                        {r.productName || r.cli || r.supplier?.name || (r.healthInsuranceProvider?.name || r.entity?.name) || 'Particular'}
                                                    </button>
                                                </td>
                                                <td className="p-6 text-right font-black text-slate-900">{formatMoney(r.tot || r.totalAmount || r.mainAmount)}</td>
                                                <td className="p-6 text-center">
                                                    <button onClick={() => { setAuditResult(r); setShowInspector(true); }} className="p-2.5 bg-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm group-hover:shadow-md"><Eye className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL INSPECTOR JSON CRUDA */}
            {showInspector && auditResult && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[40px] overflow-hidden flex flex-col shadow-2xl scale-in-center">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-900 rounded-2xl text-emerald-400 shadow-xl">
                                    <FileJson className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Estructura Zetti Cruda</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">Este es el objeto exacto que responde la API por túnel</p>
                                </div>
                            </div>
                            <button onClick={() => setShowInspector(false)} className="p-3 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="flex-1 overflow-auto p-10 bg-[#0d1117] custom-scrollbar">
                            <pre className="text-emerald-400 font-mono text-xs leading-relaxed selection:bg-emerald-500/30">
                                {JSON.stringify(auditResult, null, 2)}
                            </pre>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setShowInspector(false)} className="px-8 py-3 bg-slate-900 text-white font-black text-xs rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20">ENTENDIDO</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CATEGORIZACIÓN MANUAL */}
            {selectedProduct && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl scale-in-center border-4 border-white">
                        <div className="p-10">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-indigo-600 rounded-3xl text-emerald-400 shadow-xl shadow-indigo-200">
                                    <Layers className="w-8 h-8 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-black text-slate-900 text-xl uppercase tracking-tight">Categorizar Producto</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Vincular rubro maestro permanentemente</p>
                                </div>
                                <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X className="w-6 h-6 text-slate-400" /></button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nombre del Producto</label>
                                    <input
                                        type="text"
                                        value={selectedProduct.name}
                                        readOnly
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-500 outline-none cursor-not-allowed"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Código de Barras</label>
                                        <input
                                            type="text"
                                            value={selectedProduct.barcode}
                                            onChange={e => setSelectedProduct({ ...selectedProduct, barcode: e.target.value })}
                                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Fabricante / Lab</label>
                                        <input
                                            type="text"
                                            value={selectedProduct.manufacturer}
                                            onChange={e => setSelectedProduct({ ...selectedProduct, manufacturer: e.target.value.toUpperCase() })}
                                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-2">Rubro / Categoría Final</label>
                                    <input
                                        type="text"
                                        value={selectedProduct.category}
                                        onChange={e => setSelectedProduct({ ...selectedProduct, category: e.target.value.toUpperCase() })}
                                        placeholder="Ej: PERFUMERIA, ANTIBIOTICOS, etc."
                                        className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 text-lg font-black text-indigo-900 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-indigo-200"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="mt-10 flex gap-4">
                                <button
                                    onClick={() => setSelectedProduct(null)}
                                    className="flex-1 py-5 rounded-3xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveManualCategory}
                                    disabled={isSavingProduct || !selectedProduct.category}
                                    className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSavingProduct ? 'Guardando...' : 'Guardar en Maestro'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="bg-red-50 p-8 rounded-[32px] border border-red-100 flex items-start gap-6 animate-in slide-in-from-top-4">
                    <div className="p-3 bg-red-100 rounded-2xl"><AlertCircle className="w-6 h-6 text-red-600" /></div>
                    <div>
                        <h4 className="font-black text-red-900 uppercase text-sm tracking-tight">Falla crítica en la captura</h4>
                        <p className="text-xs text-red-700 mt-1 font-medium leading-relaxed">{error}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
