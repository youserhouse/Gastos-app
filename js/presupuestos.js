// presupuestos.js — Budget rows, inline category editing, save/delete/load budgets

function onBudgetTypeChange() {
  const tipo = document.getElementById('budgetType')?.value;
  const wrap = document.getElementById('budgetMonthWrap');
  if (wrap) wrap.style.display = tipo === 'fijo' ? 'none' : '';
  renderBudgetRows();
}

function renderBudgetRows() {
  const wrap = document.getElementById('budgetRows');
  if (!wrap) return;
  const catList = state.cats || DEFAULT_CATS;
  const tipo = document.getElementById('budgetType')?.value || 'mensual';
  const mk   = (document.getElementById('budgetMonth')?.value || '').slice(0,7);
  const existing = getBudgetForContext(tipo, mk);

  wrap.innerHTML = catList.map((cat, idx) => {
    const amt = existing?.entries?.find(e => e.cat === cat.name)?.importe || '';
    return `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem .6rem;background:rgba(255,255,255,0.03);border-radius:.65rem;border:1px solid rgba(125,191,191,0.08)">
      <label style="flex-shrink:0;cursor:pointer;position:relative" title="Cambiar color">
        <span style="display:block;width:26px;height:26px;border-radius:6px;background:${cat.color};border:2px solid rgba(255,255,255,0.15)"></span>
        <input type="color" value="${cat.color}" data-idx="${idx}"
          oninput="updateCatColor(${idx}, this.value)"
          style="position:absolute;opacity:0;width:0;height:0;top:0;left:0">
      </label>
      <input type="text" value="${cat.name}" data-idx="${idx}"
        oninput="updateCatName(${idx}, this.value)"
        style="flex:1;min-width:80px;font-family:Sora,sans-serif;font-size:.82rem;background:transparent;border:none;border-bottom:1px solid rgba(125,191,191,0.2);color:var(--text);outline:none;padding:.2rem .1rem">
      <div style="position:relative;width:100px;flex-shrink:0">
        <span style="position:absolute;left:.6rem;top:50%;transform:translateY(-50%);color:var(--teal-light);font-family:JetBrains Mono,monospace;font-size:.8rem;pointer-events:none">€</span>
        <input type="number" min="0" step="0.01" placeholder="0,00" value="${amt}"
          data-cat="${cat.name}" class="budget-input" oninput="updateBudgetTotal()"
          style="width:100%;padding:.45rem .4rem .45rem 1.5rem;font-family:JetBrains Mono,monospace;font-size:.8rem;background:var(--input-bg);border:1px solid var(--input-border);border-radius:.55rem;color:var(--text);outline:none">
      </div>
      <button onclick="deleteCatRow(${idx})" title="Eliminar categoría"
        style="flex-shrink:0;width:26px;height:26px;border-radius:6px;border:none;background:rgba(201,64,64,0.2);color:#E07070;cursor:pointer;font-size:.75rem;display:flex;align-items:center;justify-content:center;transition:background .15s"
        onmouseenter="this.style.background='rgba(201,64,64,0.4)'"
        onmouseleave="this.style.background='rgba(201,64,64,0.2)'">✕</button>
    </div>`;
  }).join('');
  updateBudgetTotal();
}


function updateCatColor(idx, color) {
  if (!state.cats) state.cats = [...DEFAULT_CATS];
  if (state.cats[idx]) {
    state.cats[idx].color = color;
    // Update the color swatch live
    const swatches = document.querySelectorAll('#budgetRows label span');
    if (swatches[idx]) swatches[idx].style.background = color;
  }
}

function updateCatName(idx, name) {
  if (!state.cats) state.cats = [...DEFAULT_CATS];
  if (state.cats[idx]) {
    // Update budget-input data-cat for existing rows
    const inputs = document.querySelectorAll('#budgetRows .budget-input');
    if (inputs[idx]) inputs[idx].dataset.cat = name;
    state.cats[idx].name = name;
  }
}

function deleteCatRow(idx) {
  if (!state.cats) state.cats = [...DEFAULT_CATS];
  const cat = state.cats[idx];
  if (!cat) return;
  const gastosAfectados = state.gastos.filter(g => g.cat === cat.name).length;
  state.cats.splice(idx, 1);
  renderBudgetRows();
  if (gastosAfectados > 0) {
    showToast(`Categoría eliminada · ${gastosAfectados} gasto(s) conservan el nombre antiguo`);
  } else {
    showToast('Categoría eliminada');
  }
}

function addCatAndRefresh() {
  if (!state.cats) state.cats = [...DEFAULT_CATS];
  state.cats.push({ name: 'Nueva categoría', color: '#607070' });
  renderBudgetRows();
  // Focus last name input
  const inputs = document.querySelectorAll('#budgetRows input[type=text]');
  if (inputs.length) inputs[inputs.length-1].focus();
}

function saveBudgetAndCats() {
  // 1. Save cats
  if (!state.cats) state.cats = [...DEFAULT_CATS];
  // Names already updated live via updateCatName
  // 2. Save budget
  const tipo = document.getElementById('budgetType').value;
  const mk   = (document.getElementById('budgetMonth')?.value || '').slice(0,7);
  if (tipo === 'mensual' && !mk) return showToast('Selecciona un mes', 'err');
  const entries = [...document.querySelectorAll('.budget-input')]
    .map(i => ({ cat: i.dataset.cat, importe: parseFloat(i.value)||0 }))
    .filter(e => e.importe > 0);
  if (!state.presupuestos) state.presupuestos = [];
  state.presupuestos = state.presupuestos.filter(p => !(p.tipo === tipo && (tipo === 'fijo' || p.mes === mk)));
  if (entries.length) state.presupuestos.push({ id: uid(), tipo, mes: tipo === 'fijo' ? null : mk, entries });
  save();
  populateCatSelects();
  populatePayers();
  renderSavedBudgets();
  renderDashboard();
  showToast('✓ Categorías y presupuesto guardados');
}

function updateBudgetTotal() {
  const total = [...document.querySelectorAll('.budget-input')].reduce((s,i) => s+(parseFloat(i.value)||0), 0);
  const el = document.getElementById('budgetTotal');
  if (el) el.textContent = fmt(total);
}

function getBudgetForContext(tipo, mk) {
  return (state.presupuestos||[]).find(p => p.tipo === tipo && (tipo === 'fijo' || p.mes === mk)) || null;
}

function getBudgetForMonth(mk) {
  if (!(state.presupuestos||[]).length) return null;
  return (state.presupuestos.find(p => p.tipo === 'mensual' && p.mes === mk))
      || (state.presupuestos.find(p => p.tipo === 'fijo'))
      || null;
}

function saveBudget() {
  const tipo = document.getElementById('budgetType').value;
  const mk   = (document.getElementById('budgetMonth')?.value || '').slice(0,7);
  if (tipo === 'mensual' && !mk) return showToast('Selecciona un mes', 'err');
  const entries = [...document.querySelectorAll('.budget-input')]
    .map(i => ({ cat: i.dataset.cat, importe: parseFloat(i.value)||0 }))
    .filter(e => e.importe > 0);
  if (!entries.length) return showToast('Introduce al menos un importe', 'err');
  if (!state.presupuestos) state.presupuestos = [];
  state.presupuestos = state.presupuestos.filter(p => !(p.tipo === tipo && (tipo === 'fijo' || p.mes === mk)));
  state.presupuestos.push({ id: uid(), tipo, mes: tipo === 'fijo' ? null : mk, entries });
  save(); renderSavedBudgets(); renderDashboard();
  showToast('✓ Presupuesto guardado');
}

function deleteBudget(id) {
  state.presupuestos = (state.presupuestos||[]).filter(p => p.id !== id);
  save(); renderSavedBudgets(); renderDashboard();
  showToast('Presupuesto eliminado');
}

function loadBudgetIntoForm(id) {
  const b = (state.presupuestos||[]).find(p => p.id === id);
  if (!b) return;
  document.getElementById('budgetType').value = b.tipo;
  onBudgetTypeChange();
  if (b.tipo === 'mensual' && b.mes) document.getElementById('budgetMonth').value = b.mes + '-01';
  renderBudgetRows();
  b.entries.forEach(e => {
    const inp = document.querySelector(`.budget-input[data-cat="${e.cat}"]`);
    if (inp) inp.value = e.importe;
  });
  updateBudgetTotal();
  showToast('Presupuesto cargado para editar');
}

function renderSavedBudgets() {
  const el = document.getElementById('savedBudgetsList');
  if (!el) return;
  const list = state.presupuestos || [];
  if (!list.length) {
    el.innerHTML = '<p style="color:var(--gray);font-size:.85rem;padding:.5rem 0">Sin presupuestos guardados aún.</p>';
    return;
  }
  el.innerHTML = [...list].reverse().map(b => {
    const total = b.entries.reduce((s,e)=>s+e.importe, 0);
    const label = b.tipo === 'fijo'
      ? '🔒 Fijo (todos los meses)'
      : `📅 ${MONTHS_ES[parseInt(b.mes.slice(5))-1]} ${b.mes.slice(0,4)}`;
    return `
    <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem;background:rgba(255,255,255,0.03);border-radius:.75rem;border:1px solid rgba(125,191,191,0.1);margin-bottom:.5rem">
      <div style="flex:1">
        <div style="font-size:.85rem;font-weight:600;color:var(--white);margin-bottom:.2rem">${label}</div>
        <div style="font-size:.75rem;color:var(--gray)">${b.entries.length} categorías · Total: <span style="color:var(--teal-light)">${fmt(total)}</span></div>
      </div>
      <button class="edit-btn" onclick="loadBudgetIntoForm('${b.id}')">✏</button>
      <button class="del-btn" onclick="deleteBudget('${b.id}')">✕</button>
    </div>`;
  }).join('');
}

