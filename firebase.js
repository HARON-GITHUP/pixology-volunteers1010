// firebase.js
import {
  initializeApp,
  getApp,
  getApps,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCQh4bplFCy-TmUzDEGVJjXEeFx6VcGW2s",
  authDomain: "pixology-af2ba.firebaseapp.com",
  projectId: "pixology-af2ba",
  storageBucket: "pixology-af2ba.firebasestorage.app",
  messagingSenderId: "896973165839",
  appId: "1:896973165839:web:d52b100bc17122bcb91a7a",
};

// ✅ امنع تهيئة متكررة
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
