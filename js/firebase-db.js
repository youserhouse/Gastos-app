// firebase-db.js — Firebase SDK init, auth state listener, Firestore real-time sync

function initFirebase() {
  if (typeof firebase === 'undefined') {
    setTimeout(initFirebase, 100); // retry until SDK is ready
    return;
  }
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  db   = firebase.firestore();
  auth = firebase.auth();

  // Auth state listener — set up after SDK ready
  auth.onAuthStateChanged(async user => {
    const loginScreen = document.getElementById('loginScreen');
    const logoutBtn   = document.getElementById('logoutBtn');
    if (user) {
      loginScreen.style.display = 'none';
      logoutBtn.style.display = 'block';
      updateLoginNames();
      // Check if user already belongs to a couple
      try {
        const perfilSnap = await USUARIO_DOC(user.uid).get();
        if (perfilSnap.exists && perfilSnap.data().parejaId) {
          parejaId = perfilSnap.data().parejaId;
          const parejaSnap = await db.collection('parejas').doc(parejaId).get();
          if (parejaSnap.exists) {
            coupleData = parejaSnap.data();
            mostrarSplashYArrancar();
          } else {
            // Pareja borrada pero perfil de usuario no — limpiamos y mostramos onboarding
            await USUARIO_DOC(user.uid).delete();
            parejaId = null;
            mostrarOnboarding();
          }
        } else {
          mostrarOnboarding();
        }
      } catch(e) {
        console.error('Error cargando perfil de usuario:', e);
        mostrarOnboarding();
      }
    } else {
      ocultarOnboarding();
      loginScreen.style.display = 'flex';
      logoutBtn.style.display = 'none';
      if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
      parejaId   = null;
      coupleData = null;
      setSyncStatus('offline');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════


function initFirestoreSync() {
  setSyncStatus('syncing');
  _unsubscribe = PAREJA_DOC().onSnapshot(doc => {
    if (_isSaving) return;
    if (doc.exists) {
      const data = doc.data();
      // Sync couple metadata if the document has it
      if (data.miembros || data.codigo) {
        coupleData = { codigo: data.codigo, miembros: data.miembros, creadoEn: data.creadoEn };
        renderInfoPareja();
      }
      state.gastos       = (data.gastos || []).map(g => ({ ...g, date: fixDate(g.date) }));
      state.ingresos     = data.ingresos     || [];
      state.presupuestos = data.presupuestos || [];
      state.cats         = data.cats         || DEFAULT_CATS;
      state.config       = data.config       || { p1: '', p2: '' };
      updateLoginNames();
      populateSelects();
      populatePayers();
      applyConfig();
      renderDashboard();
      renderLista();
      renderIngresos();
      setSyncStatus('online');
    } else {
      cloudSave();
    }
  }, err => {
    console.error('Firestore error:', err);
    setSyncStatus('offline');
  });
}

async function cloudSave() {
  if (!parejaId) return;
  _isSaving = true;
  setSyncStatus('syncing');
  try {
    // merge:true preserves couple metadata fields (miembros, codigo, creadoEn)
    await PAREJA_DOC().set({
      gastos:       state.gastos,
      ingresos:     state.ingresos,
      presupuestos: state.presupuestos || [],
      cats:         state.cats || DEFAULT_CATS,
      config:       state.config,
      updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    setSyncStatus('online');
  } catch(e) {
    console.error('Save error:', e);
    setSyncStatus('offline');
    showToast('Error al sincronizar', 'err');
  } finally {
    setTimeout(() => { _isSaving = false; }, 500);
  }
}

function setSyncStatus(status) {
  const dot   = document.getElementById('syncDot');
  const label = document.getElementById('syncLabel');
  if (!dot) return;
  dot.className = 'sync-dot' + (status === 'offline' ? ' offline' : status === 'syncing' ? ' syncing' : '');
  label.textContent = status === 'online' ? 'sync ✓' : status === 'syncing' ? 'guardando…' : 'sin conexión';
}

// ═══════════════════════════════════════════════════════════════════
// MULTIPAREJA — onboarding, couple management, legacy migration
// ═══════════════════════════════════════════════════════════════════

