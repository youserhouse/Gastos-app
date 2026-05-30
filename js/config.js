// config.js — Firebase project credentials and Firestore document path helpers


// ═══════════════════════════════════════════════════════════════════
// FIREBASE CONFIG & INIT
// ═══════════════════════════════════════════════════════════════════
// TODO: Move to environment variables / config.local.js (see .env.example)
// SECURITY: Do not commit real keys to version control
const firebaseConfig = {
  apiKey: "AIzaSyCd5hm1WMp-8gwqpuAFnM8ThFfgSpyRQfw",
  authDomain: "gastos-pareja-app.firebaseapp.com",
  projectId: "gastos-pareja-app",
  storageBucket: "gastos-pareja-app.firebasestorage.app",
  messagingSenderId: "715060740358",
  appId: "1:715060740358:web:c52fa3d4555584d1615e87"
};


const PAREJA_DOC  = () => db.collection('parejas').doc(parejaId);
const USUARIO_DOC = (uid) => db.collection('usuarios').doc(uid);

