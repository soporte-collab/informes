import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';

// --- CONFIGURACIONES DE OTROS PROYECTOS ---

const deliveryConfig = {
    apiKey: "AIzaSyBBiKfPS3eQgHdhBjmdJQBggfBRSy9VYnI",
    authDomain: "delivery-eb6da.firebaseapp.com",
    projectId: "delivery-eb6da",
    storageBucket: "delivery-eb6da.firebasestorage.app",
    messagingSenderId: "825106503554",
    appId: "1:825106503554:web:c549ddb15f9d36848da19b",
};

const vencidosConfig = {
    apiKey: "AIzaSyAZgs8RVJ_kB-tJuultXiYzW054XVKe2Lw",
    authDomain: "vencidos-ca12b.firebaseapp.com",
    projectId: "vencidos-ca12b",
    storageBucket: "vencidos-ca12b.firebasestorage.app",
    messagingSenderId: "927003660426",
    appId: "1:927003660426:web:7c78832a286336d8d0dd73",
};

// --- INITIALIZATION ---

const getSafeProjectApp = (name: string, config: any) => {
    try {
        const apps = getApps();
        const existing = apps.find(a => a.name === name);
        if (existing) return existing;
        return initializeApp(config, name);
    } catch (e) {
        console.error(`Error initializing project app ${name}:`, e);
        // If it fails but app exists, try to get it
        try { return getApp(name); } catch (e2) { return null; }
    }
};

// Lazy Getters for Firestore
let _deliveryDB: any = null;
let _vencidosDB: any = null;

export const getDeliveryDB = () => {
    if (!_deliveryDB) {
        const app = getSafeProjectApp('delivery', deliveryConfig);
        if (!app) return null;
        // Using common name for the database "deliverytrack"
        _deliveryDB = getFirestore(app, "deliverytrack");
    }
    return _deliveryDB;
};

export const getVencidosDB = () => {
    if (!_vencidosDB) {
        const app = getSafeProjectApp('vencidos', vencidosConfig);
        if (!app) return null;
        _vencidosDB = getFirestore(app);
    }
    return _vencidosDB;
};

// --- HELPERS PARA DATA LIVE ---

export const subscribeToPendingOrders = (onData: (orders: any[]) => void) => {
    try {
        const dbInstance = getDeliveryDB();
        if (!dbInstance) {
            console.warn("Delivery DB not initialized");
            return () => { };
        }

        const q = query(
            collection(dbInstance, 'orders'),
            where('estado', 'in', ['DISPONIBLE', 'EN_CAMINO']),
            orderBy('fecha_creacion', 'desc')
        );

        return onSnapshot(q, (snap) => {
            const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            onData(orders);
        }, (err) => {
            console.error("Error in delivery subscription:", err);
            // Si el error es de permisos, avisamos al usuario
            if (err.code === 'permission-denied') {
                console.error("DEBUG: Acceso denegado a Delivery. Verifica si el usuario soporte@... tiene permisos en ese proyecto.");
            }
        });
    } catch (e) {
        console.error("Failed to initialize delivery subscription:", e);
        return () => { };
    }
};

export const subscribeToUpcomingExpirations = (onData: (meds: any[]) => void) => {
    try {
        const dbInstance = getVencidosDB();
        if (!dbInstance) {
            console.warn("Vencidos DB not initialized");
            return () => { };
        }

        const today = new Date();
        const limitDate = new Date();
        limitDate.setDate(today.getDate() + 90);
        const limitStr = limitDate.toISOString().split('T')[0];

        const q = query(
            collection(dbInstance, 'medications'),
            where('expirationDate', '<=', limitStr),
            orderBy('expirationDate', 'asc'),
            limit(50)
        );

        return onSnapshot(q, (snap) => {
            const meds = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            onData(meds);
        }, (err) => {
            console.error("Error in vencidos subscription:", err);
            if (err.code === 'permission-denied') {
                console.error("DEBUG: Acceso denegado a Vencimientos.");
            }
        });
    } catch (e) {
        console.error("Failed to initialize vencidos subscription:", e);
        return () => { };
    }
};
