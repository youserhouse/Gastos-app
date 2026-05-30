// gastos.js — Add, edit, delete expenses; success banner; undo last add

function addGasto() {
  const date  = document.getElementById('gDate').value;
  const store = document.getElementById('gStore').value.trim();
  const cat   = document.getElementById('gCat').value;
  const amt   = parseFloat(document.getElementById('gAmt').value);
  const desc  = document.getElementById('gDesc').value.trim();
  const payer = document.getElementById('gPayer').value;
  const type  = document.getElementById('gType').value;

  if (!date || !store || !cat || !amt || amt <= 0 || !payer) {
    return showToast(!cat ? 'Selecciona una categoría' : 'Rellena los campos obligatorios *', 'err');
  }

  // ── Budget check ──
  const mk = monthKey(date);
  const budget = getBudgetForMonth(mk);
  const presupCat = budget?.entries.find(e => e.cat === cat)?.importe || 0;
  const gastadoCat = state.gastos
    .filter(g => g.cat === cat && monthKey(g.date) === mk)
    .reduce((s, g) => s + g.amt, 0);
  const nuevoTotal = gastadoCat + amt;
  const overBudget = presupCat > 0 && nuevoTotal > presupCat;
  const nearBudget = presupCat > 0 && !overBudget && nuevoTotal >= presupCat * 0.85;

  const gasto = { id: uid(), date, store, cat, amt, desc, payer, type };
  state.gastos.push(gasto);
  _lastGasto = gasto;
  save();

  // ── Reset form ──
  document.getElementById('gStore').value = '';
  document.getElementById('gAmt').value = '';
  document.getElementById('gDesc').value = '';
  document.getElementById('gDate').value = todayIso();
  document.getElementById('gCat').value = '';
  const catList2 = state && state.cats ? state.cats : DEFAULT_CATS;
  renderCatChips('gCat', 'gCatChips', catList2);
  renderDashboard();
  renderLista();

  // ── Show banner ──
  let sub = `${fmt(amt)} · ${cat} · ${payer}`;
  if (overBudget) {
    sub += ` · ⚠ Excedido (${fmt(nuevoTotal)} / ${fmt(presupCat)})`;
    showSuccessBanner('Gasto añadido — ⚠ Presupuesto excedido', sub, '#C94040');
  } else if (nearBudget) {
    sub += ` · ⚡ Cerca del límite (${Math.round(nuevoTotal/presupCat*100)}%)`;
    showSuccessBanner('Gasto añadido — Cerca del límite', sub, '#C87820');
  } else {
    showSuccessBanner('Gasto añadido', sub, null);
  }
}



function showSuccessBanner(title, sub, color) {
  const banner = document.getElementById('successBanner');
  document.getElementById('bannerTitle').textContent = title;
  document.getElementById('bannerSub').textContent = sub;
  banner.style.background = color
    ? `linear-gradient(135deg, ${color}, #2D6A6A)`
    : 'linear-gradient(135deg, #2A7A5A, #2D6A6A)';
  banner.classList.add('show');
  clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(() => banner.classList.remove('show'), 4500);
}

function undoLastGasto() {
  if (!_lastGasto) return;
  state.gastos = state.gastos.filter(g => g.id !== _lastGasto.id);
  _lastGasto = null;
  save();
  document.getElementById('successBanner').classList.remove('show');
  renderDashboard(); renderLista();
  showToast('Gasto deshecho');
}

function deleteGasto(id) {
  state.gastos = state.gastos.filter(g => g.id !== id);
  save(); renderLista(); renderDashboard();
  showToast('Gasto eliminado');
}

function openEdit(id) {
  const g = state.gastos.find(g => g.id === id);
  if (!g) return;
  document.getElementById('editId').value = id;
  document.getElementById('eDate').value = g.date;
  document.getElementById('eStore').value = g.store;
  document.getElementById('eDesc').value = g.desc || '';
  document.getElementById('eAmt').value = g.amt;

  // Populate selects
  const eCat = document.getElementById('eCat');
  eCat.innerHTML = '';
  getCats().forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; eCat.appendChild(o); });
  eCat.value = g.cat;

  const ePayer = document.getElementById('ePayer');
  ePayer.innerHTML = '';
  [state.config.p1, state.config.p2, 'Conjunto'].forEach(n => {
    const o=document.createElement('option'); o.value=n; o.textContent=n; ePayer.appendChild(o);
  });
  ePayer.value = g.payer;

  openModal('editModal');
}

function saveEdit() {
  const id = document.getElementById('editId').value;
  const g = state.gastos.find(g => g.id === id);
  if (!g) return;
  g.date  = document.getElementById('eDate').value;
  g.store = document.getElementById('eStore').value.trim();
  g.cat   = document.getElementById('eCat').value;
  g.amt   = parseFloat(document.getElementById('eAmt').value);
  g.desc  = document.getElementById('eDesc').value.trim();
  g.payer = document.getElementById('ePayer').value;
  save();
  closeModal('editModal');
  renderLista(); renderDashboard();
  showToast('✓ Cambios guardados');
}

// ═══════════════════════════════════════════════════════════════════
// INGRESOS CRUD
// ═══════════════════════════════════════════════════════════════════
