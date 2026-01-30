
import { db } from '../firebaseConfig';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { Medication, ProductMaster, LocalUser, Branch, IntegrationConfig, ExternalStock } from '../types';
import { getProductByBarcode, getProductById } from './zettiApi';

// --- COLLECTIONS ---
const MEDS_COLLECTION = 'medications';
const USERS_COLLECTION = 'users';
const CATALOG_COLLECTION = 'catalog';
const CONFIG_COLLECTION = 'config'; // New collection for settings

// --- INVENTORY (REAL-TIME) ---
export const subscribeToInventory = (branch: Branch, callback: (meds: Medication[]) => void) => {
  const q = query(collection(db, MEDS_COLLECTION));

  return onSnapshot(q, (snapshot) => {
    const meds: Medication[] = [];
    snapshot.forEach((doc) => {
      meds.push({ ...doc.data(), id: doc.id } as Medication);
    });
    callback(meds);
  });
};

export const addMedicationToDb = async (med: Omit<Medication, 'id'>) => {
  try {
    await addDoc(collection(db, MEDS_COLLECTION), med);
  } catch (error) {
    console.error("Error adding medication:", error);
    throw error;
  }
};

export const deleteMedicationFromDb = async (id: string) => {
  try {
    await deleteDoc(doc(db, MEDS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting medication:", error);
    throw error;
  }
};

export const transferMedicationsToDb = async (medIds: string[], targetBranch: Branch, userName: string) => {
  try {
    const batch = writeBatch(db);
    medIds.forEach(id => {
      const docRef = doc(db, MEDS_COLLECTION, id);
      batch.update(docRef, {
        branch: targetBranch,
        transferredBy: userName,
        transferredAt: Date.now()
      });
    });
    await batch.commit();
  } catch (error) {
    console.error("Error transferring medications:", error);
    throw error;
  }
};

// --- CATALOG (REAL-TIME) ---
export const subscribeToCatalog = (callback: (items: ProductMaster[]) => void) => {
  const q = query(collection(db, CATALOG_COLLECTION));
  return onSnapshot(q, (snapshot) => {
    const items: ProductMaster[] = [];
    snapshot.forEach((doc) => {
      items.push(doc.data() as ProductMaster);
    });
    callback(items);
  });
};

export const saveCatalogItemToDb = async (item: ProductMaster) => {
  try {
    await setDoc(doc(db, CATALOG_COLLECTION, item.barcode), item);
  } catch (error) {
    console.error("Error saving catalog item:", error);
    throw error;
  }
};

export const deleteCatalogItemFromDb = async (barcode: string) => {
  try {
    await deleteDoc(doc(db, CATALOG_COLLECTION, barcode));
  } catch (error) {
    console.error("Error deleting catalog item:", error);
    throw error;
  }
};

export const bulkImportCatalogToDb = async (items: ProductMaster[]) => {
  const batch = writeBatch(db);
  items.forEach(item => {
    const ref = doc(db, CATALOG_COLLECTION, item.barcode);
    batch.set(ref, item);
  });
  await batch.commit();
};

// --- USERS ---
export const subscribeToUsers = (callback: (users: LocalUser[]) => void) => {
  const q = query(collection(db, USERS_COLLECTION));
  return onSnapshot(q, (snapshot) => {
    const users: LocalUser[] = [];
    snapshot.forEach((doc) => {
      users.push({ ...doc.data(), uid: doc.id } as LocalUser);
    });
    callback(users);
  });
};

export const saveUserToDb = async (user: LocalUser) => {
  try {
    await setDoc(doc(db, USERS_COLLECTION, user.uid), user);
  } catch (error) {
    console.error("Error saving user:", error);
    throw error;
  }
};

export const deleteUserFromDb = async (uid: string) => {
  try {
    await deleteDoc(doc(db, USERS_COLLECTION, uid));
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
};

export const loginWithDb = async (username: string, password: string): Promise<LocalUser | null> => {
  try {
    const q = query(collection(db, USERS_COLLECTION), where("username", "==", username));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    let foundUser: LocalUser | null = null;
    snapshot.forEach(doc => {
      const userData = doc.data() as LocalUser;
      if (userData.password === password) {
        foundUser = { ...userData, uid: doc.id };
      }
    });

    return foundUser;
  } catch (error) {
    console.error("Login error:", error);
    return null;
  }
};

// --- INTEGRATION CONFIG ---
export const saveIntegrationConfig = async (config: IntegrationConfig) => {
  try {
    await setDoc(doc(db, CONFIG_COLLECTION, 'zetti_tys'), config);
  } catch (error) {
    console.error("Error saving integration config:", error);
    throw error;
  }
};

export const getIntegrationConfig = async (): Promise<IntegrationConfig | null> => {
  try {
    const docRef = doc(db, CONFIG_COLLECTION, 'zetti_tys');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as IntegrationConfig;
    }
    return null;
  } catch (error) {
    console.error("Error getting integration config:", error);
    return null;
  }
};

// ==================================================================
// === INTERACCIÓN CON BACKEND PROPIO (PROXY ONLINE) ================
// ==================================================================

/**
 * BUSCAR PRODUCTO EN ZETTI (Vía Firestore Tunnel)
 * Ahora utiliza el túnel para obtener metadatos enriquecidos (familia, monodroga, etc)
 */
export const searchProductInExternalSystem = async (barcode: string): Promise<ProductMaster | null> => {
  try {
    console.log(`📡 [Tunnel] Buscando metadatos para barcode: ${barcode}`);

    // Usamos el túnel de Firestore
    const product = await getProductByBarcode(barcode);

    if (product) {
      return {
        barcode: barcode,
        name: product.nombre,
        family: product.family,
        monodrug: product.monodrug,
        brand: product.brand,
        laboratory: product.laboratory
      };
    }

    return null;
  } catch (error) {
    console.error("Error en searchProductInExternalSystem:", error);
    return null;
  }
};

/**
 * OBTENER STOCK Y PRECIO REAL (Vía Proxy Online)
 * Utiliza zettiApi que maneja el proxy HTTPS y el token.
 */
export const getExternalStock = async (barcode: string, branch: Branch): Promise<ExternalStock | null> => {
  try {
    // Mapear Branch a ID de Nodo Zetti
    const nodeId = branch === 'Paseo Stare' ? 2378041 : 2406943;

    // 1. Buscar producto por barcode
    const product = await getProductByBarcode(barcode, nodeId);
    if (!product) return { stock: 0, price: 0 };

    // 2. Obtener detalles de stock por ID
    const details = await getProductById(Number(product.id), nodeId);
    if (!details) return { stock: 0, price: 0 };

    return {
      stock: details.stock,
      price: details.precio || product.precio, // Fallback al precio del search si el de detalles es 0
      nodeStocks: details.nodeStocks
    };

  } catch (error) {
    console.error("Error en getExternalStock:", error);
    return null;
  }
};

/**
 * Salud del Backend (Simplemente verificar que el proxy responda)
 */
export const checkBackendHealth = async (backendUrl?: string): Promise<boolean> => {
  try {
    const url = backendUrl || '/api/permissions/2378041';
    const res = await fetch(url);
    return res.ok;
  } catch (e) {
    return false;
  }
};
