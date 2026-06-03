import { initializeApp, getApps } from "firebase/app";
import { initializeFirestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:      import.meta.env.VITE_FIREBASE_API_KEY      as string,
  authDomain:  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN  as string,
  projectId:   import.meta.env.VITE_FIREBASE_PROJECT_ID   as string,
  appId:       import.meta.env.VITE_FIREBASE_APP_ID       as string,
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

// Use initializeFirestore's return value directly so ignoreUndefinedProperties
// is guaranteed on the exported instance. Fall back to getFirestore on HMR
// re-evaluation (initializeFirestore throws if already initialized).
export const db = (() => {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app);
  }
})();
