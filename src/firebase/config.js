import { initializeApp } from "firebase/app";
import { browserLocalPersistence, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const missing = Object.entries(firebaseConfig).filter(([, value]) => !value).map(([key]) => key);
if (missing.length) throw new Error(`資料庫尚未設定：${missing.join("、")}`);

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
const database = getDatabase(app);

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectDatabaseEmulator(database, "127.0.0.1", 9000);
}

export { app, auth, database, firebaseConfig };
