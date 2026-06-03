import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:      import.meta.env.VITE_FIREBASE_API_KEY      as string,
  authDomain:  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN  as string,
  projectId:   import.meta.env.VITE_FIREBASE_PROJECT_ID   as string,
  appId:       import.meta.env.VITE_FIREBASE_APP_ID       as string,
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
export const db = getFirestore(app);
