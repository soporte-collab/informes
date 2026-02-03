import { collection, addDoc, serverTimestamp, onSnapshot, doc } from 'firebase/firestore';
import { db, functions } from '../src/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

export const ZETTI_NODES = {
    BIOSALUD: '2378041',
    CHACRAS: '2406943',
    CONCENTRADOR: '2378039'
};

const formatZettiDate = (dateStr: string, isEnd: boolean = false) => {
    if (!dateStr) return '';
    return isEnd ? `${dateStr}T23:59:59.999Z` : `${dateStr}T00:00:00.000Z`;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const callZettiAPI = async (type: string, payload: any, nodeId: string = '2378041', retries: number = 2): Promise<any> => {
    let lastError: any = null;

    for (let i = 0; i <= retries; i++) {
        try {
            if (i > 0) {
                console.warn(`[ZETTI RETRY] Intento ${i} para ${type}...`);
                await sleep(1000 * i); // Exponential-ish backoff
            }

            return await new Promise(async (resolve, reject) => {
                try {
                    const queryRef = await addDoc(collection(db, 'zetti_queries'), {
                        type,
                        payload,
                        nodeId,
                        timestamp: serverTimestamp()
                    });

                    const queryId = queryRef.id;
                    const responseRef = doc(db, 'zetti_responses', queryId);

                    const unsubscribe = onSnapshot(responseRef, (snap) => {
                        if (snap.exists()) {
                            const responseData = snap.data();
                            if (responseData.status === 'SUCCESS') {
                                unsubscribe();
                                resolve(responseData.data);
                            } else if (responseData.status === 'ERROR') {
                                unsubscribe();
                                reject(new Error(responseData.message || `Error en respuesta Zetti (${responseData.code || 500})`));
                            }
                        }
                    });

                    setTimeout(() => {
                        unsubscribe();
                        reject(new Error(`Timeout Zetti API (${queryId})`));
                    }, 60000); // Reduce timeout to 60s per attempt to trigger retry faster
                } catch (error) {
                    reject(error);
                }
            });
        } catch (error: any) {
            lastError = error;
            // Only retry on certain errors (status 500, timeouts, etc)
            // If it's a 400 or something else, maybe don't retry? 
            // For now, let's retry any error to be safe as per user request.
            console.error(`[ZETTI ERROR] Intento ${i} falló:`, error.message);
        }
    }

    throw lastError || new Error(`Error fatal tras ${retries} reintentos en ${type}`);
};

export const searchZettiInvoices = async (startDate: string, endDate: string, nodeId: string, options: {
    lightMode?: boolean;
    includeAgreements?: boolean;
    includeConcepts?: boolean;
} = {}) => {
    return callZettiAPI('SEARCH_INVOICES', {
        startDate,
        endDate,
        includeItems: !options.lightMode,
        includeAgreements: options.includeAgreements ?? true, // Default to true as it's useful
        includeConcepts: options.includeConcepts ?? false
    }, nodeId);
};

export const searchZettiInvoiceByNumber = async (codification: string, branch: 'BIOSALUD' | 'CHACRAS') => {
    const nodeId = branch === 'BIOSALUD' ? ZETTI_NODES.BIOSALUD : ZETTI_NODES.CHACRAS;
    return callZettiAPI('SEARCH_INVOICE', { codification }, nodeId);
};

// Función antigua para mantener compatibilidad si algo la llama
export const enriquecerInvoicesConProductos = async (startDate: string, endDate: string, nodeId: string) => {
    return searchZettiInvoices(startDate, endDate, nodeId, { lightMode: false });
};

export const triggerManualSync = async () => {
    try {
        const syncCallable = httpsCallable(functions, 'zetti_sync_live_callable');
        const result = await syncCallable();
        return result.data;
    } catch (error) {
        console.error("Error in triggerManualSync:", error);
        throw error;
    }
};

export const getProductFromMaster = async (id: string) => {
    const docRef = doc(db, 'zetti_products_master', id);
    return new Promise((resolve) => {
        onSnapshot(docRef, (snap) => {
            if (snap.exists()) resolve(snap.data());
            else resolve(null);
        });
    });
};

export const searchZettiProductByBarcode = async (barcode: string, nodeId: string = ZETTI_NODES.BIOSALUD) => {
    return callZettiAPI('SEARCH_PRODUCT_BY_BARCODE', { barcode }, nodeId);
};

export const searchZettiProductByDescription = async (description: string, nodeId: string = ZETTI_NODES.BIOSALUD) => {
    return callZettiAPI('SEARCH_PRODUCT_BY_DESCRIPTION', { description }, nodeId);
};

export const searchZettiMultiStock = async (productIds: string[]) => {
    return callZettiAPI('MASSIVE_STOCK_CHECK', { productIds }, ZETTI_NODES.CONCENTRADOR);
};

export const searchZettiProviderReceipts = async (startDate: string, endDate: string, nodeId: string) => {
    return callZettiAPI('SEARCH_PROVIDER_RECEIPTS', { startDate, endDate }, nodeId);
};

export const searchZettiInsuranceReceipts = async (startDate: string, endDate: string, nodeId: string) => {
    return callZettiAPI('SEARCH_INSURANCE_RECEIPTS', { startDate, endDate }, nodeId);
};

export const searchZettiCustomers = async (nodeId: string, filters: any = {}) => {
    return callZettiAPI('SEARCH_CUSTOMERS', filters, nodeId);
};
