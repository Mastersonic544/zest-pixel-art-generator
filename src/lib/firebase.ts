import { initializeApp, getApps } from "firebase/app";
import { initializeFirestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:      import.meta.env.VITE_FIREBASE_API_KEY      as string,
  authDomain:  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN  as string,
  projectId:   import.meta.env.VITE_FIREBASE_PROJECT_ID   as string,
  appId:       import.meta.env.VITE_FIREBASE_APP_ID       as string,
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

// ignoreUndefinedProperties: Firestore silently drops undefined fields
// instead of throwing. Belt-and-suspenders alongside the JSON round-trip
// in shareStorage.ts.
try {
  initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  // Already initialized (HMR / module re-evaluation) — existing instance is fine.
}

export const db = getFirestore(app);
