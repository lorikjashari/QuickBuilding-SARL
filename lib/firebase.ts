import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { FIRESTORE_DATABASE_ID, firebaseConfig } from "@/lib/firebase-config";

export function firebaseReady(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

export function firebaseApp(): FirebaseApp {
  if (!firebaseReady()) throw new Error("Firebase n’est pas encore configuré.");
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function database(): Firestore {
  return getFirestore(firebaseApp(), FIRESTORE_DATABASE_ID);
}

export function mediaStorage(): FirebaseStorage {
  return getStorage(firebaseApp());
}
