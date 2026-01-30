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

export const callZettiAPI = async (type: string, payload: any, nodeId: string = '2378041'): Promise<any> => {
    return new Promise(async (resolve, reject) => {
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
                        reject(new Error(responseData.message || 'Error en respuesta Zetti'));
                    }
                }
            });

            setTimeout(() => {
                unsubscribe();
                reject(new Error(`Timeout Zetti API (${queryId})`));
            }, 180000);
        } catch (error) {
            reject(error);
        }
    });
};

export const searchZettiInvoices = async (startDate: string, endDate: string, nodeId: string, lightMode: boolean = false) => {
    return callZettiAPI('SEARCH_INVOICES', {
        startDate,
        endDate,
        includeItems: !lightMode
    }, nodeId);
};

export const searchZettiInvoiceByNumber = async (codification: string, branch: 'BIOSALUD' | 'CHACRAS') => {
    const nodeId = branch === 'BIOSALUD' ? ZETTI_NODES.BIOSALUD : ZETTI_NODES.CHACRAS;
    return callZettiAPI('SEARCH_INVOICE', { codification }, nodeId);
};

// Función antigua para mantener compatibilidad si algo la llama
export const enriquecerInvoicesConProductos = async (startDate: string, endDate: string, nodeId: string) => {
    return searchZettiInvoices(startDate, endDate, nodeId, false);
};

export const triggerManualSync = async () => {
    // Usamos el nuevo nombre de la función para evitar el error de cambio de trigger de Firebase
    const response = await fetch('https://us-central1-informes-a551f.cloudfunctions.net/zetti_sync_live_v2');
    if (!response.ok) {
        throw new Error(`Error en sincronización: ${response.statusText}`);
    }
    return response.json();
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
