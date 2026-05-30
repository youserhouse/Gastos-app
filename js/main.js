// main.js — App startup (window load), tab switching, select/payer population

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  initTheme();
  initColorTheme();
  initFirebase();
  populateSelects();
  applyConfig();
  renderDashboard();
  renderLista();
  renderIngresos();

  // Set today on date inputs
  document.getElementById('gDate').value = todayIso();

  // Scanner drag
  const drop = document.getElementById('scanDrop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('drag');
    addScanFilesRaw([...e.dataTransfer.files]);
  });

  // Load api key into scanner field

  // Restore tab from URL hash
  const initialTab = location.hash.slice(1) || 'dashboard';
  const validTabs = ['dashboard','gastos','ingresos','lista','scanner','presupuesto','config'];
  switchTab(validTabs.includes(initialTab) ? initialTab : 'dashboard');
});

function populateSelects() {
  // Categories
  populateCatSelects();

  // Payers
  populatePayers();

  // Month inputs: free input via <input type="month">, set current month as default
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const now2 = new Date();
  const curDate = now2.toISOString().slice(0,10);
  const dEl = document.getElementById('dashMonthSel'); if(dEl) dEl.value = curDate;
  const iEl = document.getElementById('iMonth');       if(iEl) iEl.value = curDate;
  // filterMonth left blank
  const bEl = document.getElementById('budgetMonth'); if(bEl) bEl.value = curDate;
}

function populatePayers() {
  const { p1, p2 } = state.config;
  ['gPayer','ePayer','filterPayer','iPerson'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const isFilter = id === 'filterPayer';
    sel.innerHTML = isFilter ? '<option value="">Todos</option>' : '';
    [p1, p2, 'Conjunto'].forEach(n => {
      const o = document.createElement('option'); o.value = n; o.textContent = n;
      sel.appendChild(o);
    });
  });
}

function applyConfig() {
  document.getElementById('p1name').value = state.config.p1;
  document.getElementById('p2name').value = state.config.p2;
  renderCatsConfigList();
}

// ═══════════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════════
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b,i) => {
    const panels = ['dashboard','gastos','ingresos','lista','scanner','presupuesto','config'];
    b.classList.toggle('active', panels[i] === name);
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-'+name).classList.add('active');
  history.replaceState(null, '', '#' + name);
  if (name==='dashboard') renderDashboard();
  if (name==='lista') renderLista();
  if (name==='ingresos') renderIngresos();
  if (name==='presupuesto') { onBudgetTypeChange(); renderBudgetRows(); renderSavedBudgets(); }
  if (name==='config') { renderThemeSwatches(); loadAnthropicKeyToInput(); renderInfoPareja(); }
  // Show API key warning banner in scanner tab if key is set
  if (name==='scanner') {
    const warn = document.getElementById('scanner-api-warning');
    if (warn) warn.style.display = getAnthropicKey() ? 'block' : 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════
// GASTOS CRUD
// ═══════════════════════════════════════════════════════════════════
