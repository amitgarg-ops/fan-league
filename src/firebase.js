import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDhGFrYAgCdAAWAlaDFTSlW8oa6yGlEliw",
  authDomain: "fan-league-7fae4.firebaseapp.com",
  projectId: "fan-league-7fae4",
  storageBucket: "fan-league-7fae4.firebasestorage.app",
  messagingSenderId: "959994999111",
  appId: "1:959994999111:web:12085cdea8d6ae16a4dc62"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);