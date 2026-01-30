import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD4Ozf7sLc3XqxLAfB5xX-uUoCKEJOkU8M",
  authDomain: "informes-a551f.firebaseapp.com",
  projectId: "informes-a551f",
  storageBucket: "informes-a551f.firebasestorage.app",
  messagingSenderId: "159557155028",
  appId: "1:159557155028:web:20b54047edfede3d87e341",
  measurementId: "G-CEEMXDB6RK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

import { getStorage } from "firebase/storage";

// Initialize Firestore
// Removed experimentalForceLongPolling to allow standard auto-negotiation (WebSockets/HTTP)
// This can help if the forced polling endpoint was triggering CORS blocks.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Initialize Auth
export const auth = getAuth(app);

// Initialize Storage
export const storage = getStorage(app);

import { getFunctions } from "firebase/functions";
export const functions = getFunctions(app);
