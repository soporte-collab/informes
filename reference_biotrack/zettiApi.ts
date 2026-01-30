import { ACTIVE_CONFIG } from './zettiConfig';
import { db } from '../firebaseConfig'; // CORREGIDO: Importación desde la raíz
import { collection, doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';

export interface ZettiNodeStock {
    nodeId: number;
    nodeName: string;
    stock: number;
}

export interface ZettiProduct {
    id: number | string;
    nombre: string;
    stock?: number; // Stock del nodo solicitado
    precio: number;
    family?: string;
    monodrug?: string;
    brand?: string;
    laboratory?: string;
    nodeStocks?: ZettiNodeStock[]; // Desglose por sucursales
}

export async function getProductByBarcode(barcode: string, nodeId: number = ACTIVE_CONFIG.nodeId): Promise<ZettiProduct | null> {
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queryStartTime = Date.now();

    return new Promise((resolve) => {
        // 1. Limpiar cualquier respuesta anterior con el mismo patrón (prevenir caché)
        const responseRef = doc(db, 'zetti_responses', queryId);
        deleteDoc(responseRef).catch(() => { }); // Silenciar error si no existe

        // 2. Crear la consulta en Firestore
        const queryRef = doc(db, 'zetti_queries', queryId);
        setDoc(queryRef, {
            barcode,
            nodeId,
            timestamp: queryStartTime
        }).catch(err => {
            console.error("Error creating query:", err);
            resolve(null);
        });

        // 3. Escuchar la respuesta (SOLO respuestas creadas DESPUÉS de la consulta)
        const unsubscribe = onSnapshot(responseRef, (docSnap) => {
            if (docSnap.exists()) {
                const val = docSnap.data();

                // IMPORTANTE: Verificar que la respuesta es para ESTA consulta
                // Ignorar respuestas antiguas o de otras consultas
                const responseTime = val.timestamp?.toMillis?.() || 0;
                if (responseTime < queryStartTime) {
                    console.warn(`⚠️ Ignorando respuesta antigua (${queryId})`);
                    return; // Ignorar respuesta antigua
                }

                unsubscribe();

                // Limpieza
                deleteDoc(queryRef).catch(() => { });
                deleteDoc(responseRef).catch(() => { });

                if (val.status === 'error') {
                    console.error("Zetti Error:", val.message);
                    return resolve(null);
                }

                const p = val.data;

                if (p && p.found !== false) {
                    resolve({
                        id: p.id,
                        nombre: p.name || p.nombre || "Producto",
                        stock: Number(p.stock || 0),
                        precio: Number(p.precio || p.pvp || 0),
                        family: p.family,
                        monodrug: p.monodrug,
                        brand: p.brand,
                        laboratory: p.laboratory
                    });
                } else {
                    resolve(null);
                }
            }
        }, (err) => {
            console.error("Snapshot error:", err);
            unsubscribe();
            resolve(null);
        });

        // Timeout 15 seg
        setTimeout(() => {
            unsubscribe();
            deleteDoc(queryRef).catch(() => { });
            deleteDoc(responseRef).catch(() => { });
            console.warn(`⏱️ Timeout para consulta ${queryId}`);
            resolve(null);
        }, 15000);
    });
}

export async function getProductById(productId: number, nodeId: number = ACTIVE_CONFIG.nodeId): Promise<ZettiProduct | null> {
    const queryId = `query_id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queryStartTime = Date.now();

    return new Promise((resolve) => {
        // 1. Limpiar respuesta anterior
        const responseRef = doc(db, 'zetti_responses', queryId);
        deleteDoc(responseRef).catch(() => { });

        // 2. Crear consulta
        const queryRef = doc(db, 'zetti_queries', queryId);
        setDoc(queryRef, {
            productId,
            nodeId,
            timestamp: queryStartTime
        }).catch(() => resolve(null));

        // 3. Escuchar respuesta con validación de tiempo
        const unsubscribe = onSnapshot(responseRef, (docSnap) => {
            if (docSnap.exists()) {
                const val = docSnap.data();

                const responseTime = val.timestamp?.toMillis?.() || 0;
                if (responseTime < queryStartTime) {
                    return; // Ignorar respuesta antigua
                }

                unsubscribe();
                deleteDoc(queryRef).catch(() => { });
                deleteDoc(responseRef).catch(() => { });

                if (val.status === 'error') return resolve(null);

                const data = val.data;
                const nodeStocks: ZettiNodeStock[] = [];

                if (Array.isArray(data)) {
                    data.forEach(item => {
                        const nId = parseInt(item.idNodo);
                        nodeStocks.push({
                            nodeId: nId,
                            nodeName: nId === 2378041 ? 'Paseo Stare' : (nId === 2406943 ? 'Chacras Park' : `Sucursal ${nId}`),
                            stock: Number(item.detalles?.stock || 0)
                        });
                    });
                }

                // Encontrar el producto específico para el nodo solicitado inicialmente para los datos principales
                let p = Array.isArray(data) ? data.find(item => String(item.idNodo) === String(nodeId)) : data;
                if (!p && Array.isArray(data)) p = data[0];

                if (p && p.detalles) {
                    const d = p.detalles;
                    resolve({
                        id: productId,
                        nombre: d.descripcion || "Producto",
                        stock: Number(d.stock || 0),
                        precio: Number(d.pvp || 0),
                        nodeStocks: nodeStocks.length > 0 ? nodeStocks : undefined
                    });
                } else {
                    resolve(null);
                }
            }
        }, () => {
            unsubscribe();
            resolve(null);
        });

        setTimeout(() => {
            unsubscribe();
            deleteDoc(queryRef).catch(() => { });
            deleteDoc(responseRef).catch(() => { });
            resolve(null);
        }, 15000);
    });
}

export async function verifyPermissions() { return ["ftweb_listar_productos"]; }
export default { getProductById, getProductByBarcode, verifyPermissions };
