// auth.js — Login/logout helpers, onboarding flow, couple creation/join, legacy migration

function showEmailLogin() {
  document.getElementById('emailLoginWrap').style.display = 'block';
}

function loginAs(role) {
  // Sign in anonymously then store which person they are
  auth.signInAnonymously()
    .then(result => {
      localStorage.setItem('gp_current_role', role);
    })
    .catch(e => {
      // If anonymous not enabled, fall back to showing email login
      showEmailLogin();
      setLoginErr('Usa email para acceder');
    });
}

function updateLoginNames() {
  const p1 = state.config.p1 || 'Persona 1';
  const p2 = state.config.p2 || 'Persona 2';
  const lbl1 = document.getElementById('lblP1');
  const lbl2 = document.getElementById('lblP2');
  if (lbl1) lbl1.textContent = p1;
  if (lbl2) lbl2.textContent = p2;
}

function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  setLoginErr('');
  auth.signInWithEmailAndPassword(email, pass)
    .catch(e => setLoginErr(friendlyAuthError(e.code)));
}

function doRegister() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  if (pass.length < 6) return setLoginErr('La contraseña debe tener al menos 6 caracteres');
  setLoginErr('');
  auth.createUserWithEmailAndPassword(email, pass)
    .catch(e => setLoginErr(friendlyAuthError(e.code)));
}

function doGoogleLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(e => setLoginErr(friendlyAuthError(e.code)));
}

function doLogout() {
  if (confirm('¿Cerrar sesión?')) auth.signOut();
}

function setLoginErr(msg) {
  document.getElementById('loginErr').textContent = msg;
}

function friendlyAuthError(code) {
  const msgs = {
    'auth/user-not-found':    'No existe cuenta con ese email',
    'auth/wrong-password':    'Contraseña incorrecta',
    'auth/invalid-email':     'Email no válido',
    'auth/email-already-in-use': 'Ese email ya tiene cuenta — inicia sesión',
    'auth/weak-password':     'Contraseña demasiado corta',
    'auth/invalid-credential':'Email o contraseña incorrectos',
  };
  return msgs[code] || 'Error: ' + code;
}

// Auth listener is inside initFirebase()

// ═══════════════════════════════════════════════════════════════════
// FIRESTORE SYNC
// ═══════════════════════════════════════════════════════════════════

function generarCodigo() {
  // Characters chosen to avoid visual ambiguity (no 0/O, 1/I/L)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function mostrarOnboarding() {
  document.getElementById('onboardingScreen').style.display = 'flex';
}

function ocultarOnboarding() {
  const el = document.getElementById('onboardingScreen');
  if (el) el.style.display = 'none';
}

function toggleCodigoInput() {
  const wrap = document.getElementById('onboardingCodigo');
  const opts = document.getElementById('onboardingOpciones');
  const mostrar = wrap.style.display === 'none' || !wrap.style.display;
  wrap.style.display = mostrar ? 'block' : 'none';
  opts.style.display = mostrar ? 'none' : 'block';
  if (mostrar) document.getElementById('codigoInput').focus();
  setOnboardingErr('');
}

function setOnboardingErr(msg) {
  const el = document.getElementById('onboardingErr');
  if (el) el.textContent = msg;
}

function mostrarSplashYArrancar() {
  const splash = document.getElementById('splashScreen');
  splash.style.display = 'flex';
  requestAnimationFrame(() => setTimeout(() => {
    const bar = document.getElementById('splashProgressBar');
    if (bar) bar.style.width = '100%';
  }, 50));
  setTimeout(() => {
    splash.style.opacity = '0';
    splash.style.transition = 'opacity .6s ease';
    setTimeout(() => { splash.style.display = 'none'; }, 600);
  }, 3000);
  initFirestoreSync();
  renderInfoPareja();
}

function iniciarAppTrasOnboarding() {
  migrarDatosLegacy();
  initFirestoreSync();
  renderInfoPareja();
}

async function crearPareja() {
  const user = auth.currentUser;
  if (!user) return;
  setOnboardingErr('');
  const btns = document.querySelectorAll('#onboardingOpciones button');
  btns.forEach(b => b.disabled = true);

  try {
    let codigo;
    let intentos = 0;
    do {
      codigo = generarCodigo();
      const snap = await db.collection('parejas').doc(codigo).get();
      if (!snap.exists) break;
    } while (++intentos < 5);

    const meta = {
      miembros:  [user.uid],
      creadoEn:  firebase.firestore.FieldValue.serverTimestamp(),
      codigo,
    };
    await db.collection('parejas').doc(codigo).set(meta);
    await USUARIO_DOC(user.uid).set({ parejaId: codigo }, { merge: true });

    parejaId   = codigo;
    coupleData = { ...meta, creadoEn: new Date() };
    ocultarOnboarding();
    iniciarAppTrasOnboarding();
    showToast(`✓ Pareja creada — código: ${codigo}`);
  } catch(e) {
    console.error(e);
    setOnboardingErr('Error al crear la pareja. Inténtalo de nuevo.');
    btns.forEach(b => b.disabled = false);
  }
}

async function unirsePareja() {
  const user = auth.currentUser;
  if (!user) return;

  const codigo = (document.getElementById('codigoInput').value || '').trim().toUpperCase();
  if (codigo.length !== 6) return setOnboardingErr('El código debe tener exactamente 6 caracteres');
  setOnboardingErr('');

  const btns = document.querySelectorAll('#onboardingCodigo button');
  btns.forEach(b => b.disabled = true);

  try {
    const snap = await db.collection('parejas').doc(codigo).get();
    if (!snap.exists) {
      setOnboardingErr('Código no encontrado. Comprueba que está bien escrito.');
      btns.forEach(b => b.disabled = false);
      return;
    }
    const data = snap.data();
    if (data.miembros && data.miembros.length >= 2) {
      setOnboardingErr('Esta pareja ya tiene 2 miembros.');
      btns.forEach(b => b.disabled = false);
      return;
    }
    const nuevos = [...(data.miembros || []), user.uid];
    await db.collection('parejas').doc(codigo).update({ miembros: nuevos });
    await USUARIO_DOC(user.uid).set({ parejaId: codigo }, { merge: true });

    parejaId   = codigo;
    coupleData = { ...data, miembros: nuevos };
    ocultarOnboarding();
    iniciarAppTrasOnboarding();
    showToast('✓ Te has unido a la pareja');
  } catch(e) {
    console.error(e);
    setOnboardingErr('Error al unirse. Inténtalo de nuevo.');
    btns.forEach(b => b.disabled = false);
  }
}

async function migrarDatosLegacy() {
  if (localStorage.getItem('gp_legacy_migrated') || !parejaId) return;
  try {
    const legacySnap = await db.collection('parejas').doc('shared').get();
    if (!legacySnap.exists) { localStorage.setItem('gp_legacy_migrated', '1'); return; }

    const targetSnap = await PAREJA_DOC().get();
    const targetData = targetSnap.exists ? (targetSnap.data().gastos || []) : [];
    if (targetData.length > 0) { localStorage.setItem('gp_legacy_migrated', '1'); return; }

    const legacy = legacySnap.data();
    await PAREJA_DOC().set({
      gastos:       legacy.gastos       || [],
      ingresos:     legacy.ingresos     || [],
      presupuestos: legacy.presupuestos || [],
      cats:         legacy.cats         || DEFAULT_CATS,
      config:       legacy.config       || { p1: '', p2: '' },
      updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    localStorage.setItem('gp_legacy_migrated', '1');
    showToast('✓ Hemos migrado tus datos al nuevo formato');
  } catch(e) {
    console.error('Migración legacy fallida:', e);
  }
}

