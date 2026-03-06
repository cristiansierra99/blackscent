import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBkprNz5CjRJ2dcQIJnu0yS0GSHuo758uA",
    authDomain: "blackaccent-70ea3.firebaseapp.com",
    projectId: "blackaccent-70ea3",
    storageBucket: "blackaccent-70ea3.firebasestorage.app",
    messagingSenderId: "882532659171",
    appId: "1:882532659171:web:81692ec214c14ebb2ffad6",
    measurementId: "G-LBE6H77REB"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
