// Bundled into docs/vendor/firebase.js (npm run build:firebase) so the app has no CDN dependency.
export { initializeApp } from 'firebase/app';
export {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, setPersistence, browserLocalPersistence, indexedDBLocalPersistence,
  initializeAuth, deleteUser
} from 'firebase/auth';
export {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager, persistentMultipleTabManager, memoryLocalCache,
  doc, collection, setDoc, getDoc, getDocs, onSnapshot, deleteField, FieldPath, writeBatch, serverTimestamp, waitForPendingWrites
} from 'firebase/firestore';
