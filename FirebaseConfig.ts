import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDD94deRJB2NNVb5ff55mX_sukltQY3EgA",
  authDomain: "safezoneapp-b388e.firebaseapp.com",
  projectId: "safezoneapp-b388e",
  storageBucket: "safezoneapp-b388e.firebasestorage.app",
  messagingSenderId: "585588759661",
  appId: "1:585588759661:web:27998cfe3f72c1ed793364",
  measurementId: "G-69M6M7NXXJ"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const getBackendUrl = (path: string) => {
  const baseUrl = Platform.OS === 'android' ? 'http://192.168.0.196:5000' : 'http://192.168.0.196:5000';
  return `${baseUrl}${path}`;
};

export default app;
