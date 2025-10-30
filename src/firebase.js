import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDW2Zt3QRV9oDRavOgj-8QAwj3UbGaQlFg',
  authDomain: 'memo-app-91ea0.firebaseapp.com',
  projectId: 'memo-app-91ea0',
  storageBucket: 'memo-app-91ea0.firebasestorage.app',
  messagingSenderId: '871506190811',
  appId: '1:871506190811:web:764c5cc422fbf484fbc7fe',
  measurementId: 'G-5MW0FXK6F4',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
