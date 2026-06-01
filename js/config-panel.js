// config-panel.js — API key, theme swatches, couple info, names config, categories, CSV

function guardarAnthropicKey() {
  const key = document.getElementById('anthropicKeyInput').value.trim();
  if (!key.startsWith('sk-ant-')) {
    alert('La clave debe empezar por sk-ant-');
    return;
  }
  saveAnthropicKey(key);
  document.getElementById('anthropicKeyInput').value = '';
  loadAnthropicKeyToInput();
  alert('✅ Clave guardada correctamente');
}

function loadAnthropicKeyToInput() {
  const input = document.getElementById('anthropicKeyInput');
  if (!input) return;
  const saved = getAnthropicKey();
  input.placeholder = saved ? saved.slice(0, 8) + '••••••••' : 'sk-ant-...';
}

function renderThemeSwatches() {
  const wrap = document.getElementById('themeSwatches');
  if (!wrap) return;
  const current = localStorage.getItem('gp_color_theme') || 'amber';
  wrap.innerHTML = Object.entries(COLOR_THEMES).map(([key, t]) => `
    <button onclick="applyColorTheme('${key}')" title="${t.label}"
      style="display:flex;flex-direction:column;align-items:center;gap:.35rem;
        background:${current===key ? 'rgba(255,255,255,0.1)' : 'transparent'};
        border:2px solid ${current===key ? t.accent : 'rgba(255,255,255,0.08)'};
        border-radius:.75rem;padding:.5rem .25rem;cursor:pointer;transition:all .2s">
      <span style="width:28px;height:28px;border-radius:50%;background:${t.accent};
        display:block;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></span>
      <span style="font-size:.6rem;color:${current===key ? t.accent : 'rgba(255,255,255,0.4)'};
        font-family:Sora,sans-serif;font-weight:${current===key?'600':'400'}">${t.label}</span>
    </button>`).join('');
}


function renderInfoPareja() {
  const el = document.getElementById('infoPareja');
  if (!el || !parejaId) return;
  const miembros = (coupleData?.miembros || []).length;
  const llena    = miembros >= 2;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;padding:.85rem 1rem;background:rgba(45,106,106,0.15);border:1px solid rgba(125,191,191,0.2);border-radius:.75rem">
      <div style="flex:1;min-width:0">
        <div style="font-size:.72rem;color:var(--gray);margin-bottom:.25rem;text-transform:uppercase;letter-spacing:.05em">Código de invitación</div>
        <div style="font-family:var(--font-mono,monospace);font-size:1.5rem;font-weight:700;letter-spacing:.25em;color:var(--teal-light)">${parejaId}</div>
      </div>
      <button class="pill-btn" onclick="copiarCodigo()" style="flex-shrink:0;padding:.45rem .8rem;font-size:.78rem">📋 Copiar</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;font-size:.83rem;color:var(--gray);border-bottom:1px solid rgba(125,191,191,0.1)">
      <span>Miembros</span>
      <span style="font-weight:600;color:${llena ? '#5ABEA0' : '#E0A030'}">${miembros}/2 ${llena ? '✓' : ''}</span>
    </div>
    ${!llena ? `<p style="font-size:.8rem;color:#E0A030;margin-top:.75rem;padding:.65rem .8rem;background:rgba(224,160,48,0.08);border:1px solid rgba(224,160,48,0.2);border-radius:.55rem;line-height:1.5">
      Comparte este código con tu pareja para que se una a la cuenta.
    </p>` : ''}
  `;
}

function copiarCodigo() {
  if (!parejaId) return;
  const texto = parejaId;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(texto).then(() => showToast('✓ Código copiado al portapapeles'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✓ Código copiado');
  }
}

// ═══════════════════════════════════════════════════════════════════
// STATE — now backed by Firestore
// ═══════════════════════════════════════════════════════════════════


function saveConfig() {
  state.config.p1 = document.getElementById('p1name').value.trim();
  state.config.p2 = document.getElementById('p2name').value.trim();
  save(); populatePayers(); renderDashboard(); renderIngresos();
  showToast('✓ Configuración guardada');
}

function renderMesSelect() {
  const sel = document.getElementById('mesBorrarSelect');
  if (!sel) return;
  const meses = new Set();
  (state.gastos   || []).forEach(g => { if (g.date)  meses.add(g.date.slice(0, 7)); });
  (state.ingresos || []).forEach(i => { if (i.month) meses.add(i.month.slice(0, 7)); });
  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const sorted = [...meses].sort().reverse();
  sel.innerHTML = '<option value="">— Selecciona un mes —</option>' +
    sorted.map(m => {
      const [y, mo] = m.split('-');
      return `<option value="${m}">${nombres[parseInt(mo, 10) - 1]} ${y}</option>`;
    }).join('');
}

function borrarMes() {
  const sel = document.getElementById('mesBorrarSelect');
  const mes = sel?.value;
  if (!mes) return showToast('Selecciona un mes primero', 'err');
  const [y, mo] = mes.split('-');
  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const nombreMes = `${nombres[parseInt(mo, 10) - 1]} ${y}`;
  if (!confirm(`¿Borrar todos los gastos e ingresos de ${nombreMes}? Esta acción no se puede deshacer.`)) return;
  state.gastos   = (state.gastos   || []).filter(g => !g.date?.startsWith(mes));
  state.ingresos = (state.ingresos || []).filter(i => !(i.month || '').startsWith(mes));
  save();
  renderMesSelect();
  renderDashboard();
  renderLista();
  renderIngresos();
  showToast(`✓ Datos de ${nombreMes} eliminados`);
}

function clearData() {
  if (!confirm('⚠️ ¿Estás seguro de que quieres borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
  const typed = prompt('Escribe BORRAR para confirmar:');
  if (typed !== 'BORRAR') { alert('Cancelado. No se borró nada.'); return; }
  state = { gastos:[], ingresos:[], presupuestos:[], config:{ p1:'', p2:'' } };
  save();
  if (auth.currentUser) {
    const user = auth.currentUser;
    const borrarPareja  = parejaId ? PAREJA_DOC().delete() : Promise.resolve();
    const borrarPerfil  = USUARIO_DOC(user.uid).delete();
    Promise.all([borrarPareja, borrarPerfil]).finally(() => location.reload());
  } else {
    location.reload();
  }
}

// ═══════════════════════════════════════════════════════════════════
// API KEY MODAL
// ═══════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════
// EXPORT CSV
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// CATEGORY EDITOR
// ═══════════════════════════════════════════════════════════════════
function renderCatsConfigList() {
  const list = document.getElementById('catsConfigList');
  if (!list) return;
  if (!state.cats) state.cats = DEFAULT_CATS.map(c=>({...c}));
  const usedCats = new Set(state.gastos.map(g => g.cat));

  list.innerHTML = state.cats.map((c, i) => `
    <div class="cat-edit-row">
      <input type="color" value="${c.color}" id="catColor_${i}" oninput="state.cats[${i}].color=this.value">
      <input type="text"  value="${c.name}"  id="catName_${i}"  placeholder="Nombre">
      <button class="cat-rm-btn" onclick="removeCat(${i})"
        ${usedCats.has(c.name) ? 'disabled title="Tiene gastos"' : ''}>✕</button>
    </div>`).join('');
}

function removeCat(i) {
  const usedCats = new Set(state.gastos.map(g => g.cat));
  if (usedCats.has(state.cats[i].name)) return showToast('Categoría con gastos: no se puede borrar','err');
  state.cats.splice(i, 1);
  renderCatsConfigList();
}

function addCatRow() {
  if (!state.cats) state.cats = DEFAULT_CATS.map(c=>({...c}));
  const palette = ['#5A8A6A','#3A7080','#A06040','#7040A0','#40809A','#8A5A30'];
  state.cats.push({ name: '', color: palette[state.cats.length % palette.length] });
  renderCatsConfigList();
  setTimeout(() => {
    const rows = document.querySelectorAll('#catsConfigList .cat-edit-row input[type=text]');
    rows[rows.length - 1]?.focus();
  }, 40);
}

function saveCats() {
  if (!state.cats) state.cats = DEFAULT_CATS.map(c=>({...c}));
  // Read current names from inputs
  state.cats.forEach((c, i) => {
    const inp = document.getElementById(`catName_${i}`);
    if (inp) c.name = inp.value.trim();
  });
  state.cats = state.cats.filter(c => c.name);
  if (!state.cats.length) return showToast('Necesitas al menos una categoría','err');
  save();
  renderCatsConfigList();
  populateCatSelects();
  showToast('✓ Categorías guardadas');
}

function populateCatSelects() {
  const cats = getCats();
  ['gCat','eCat','filterCat'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    const isFilter = id === 'filterCat';
    sel.innerHTML = (isFilter ? '<option value="">Todas las categorías</option>' : '') +
      cats.map(c => `<option value="${c}">${c}</option>`).join('');
    if (cats.includes(cur)) sel.value = cur;
  });
}



// ═══════════════════════════════════════════════════════════════════
// TREND CHART — últimos 6 meses
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// PRESUPUESTOS
// ═══════════════════════════════════════════════════════════════════

function exportCSV() {
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const row = (...cols) => cols.map(esc).join(',');
  const rows = [];

  // Header + meta
  rows.push(row('_tipo','_v','c1','c2','c3','c4','c5','c6','c7','c8'));
  rows.push(row('META','2','gastos_pareja_export', new Date().toISOString()));

  // Config
  rows.push(row('CONFIG','2','p1', state.config.p1, 'p2', state.config.p2));

  // Categorías
  (state.cats || DEFAULT_CATS).forEach(cat => {
    rows.push(row('CATEGORIA','2', cat.name, cat.color));
  });

  // Gastos
  state.gastos.forEach(g => {
    rows.push(row('GASTO','2', g.id, g.date, g.store, g.cat, g.amt, g.payer, g.type, g.desc||''));
  });

  // Ingresos
  state.ingresos.forEach(i => {
    rows.push(row('INGRESO','2', i.id, i.month, i.person, i.type, i.amt));
  });

  // Presupuestos (one row per entry)
  (state.presupuestos || []).forEach(b => {
    b.entries.forEach(e => {
      rows.push(row('PRESUPUESTO','2', b.id, b.tipo, b.mes || 'fijo', e.cat, e.importe));
    });
  });

  const csv = rows.join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = `gastos_pareja_${todayIso()}.csv`;
  a.click();
  showToast('✓ CSV exportado completo');
}

function importCSV(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  inputEl.value = '';

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const text = ev.target.result.replace(/^\uFEFF/, '');
      const rows = parseCSVRows(text);
      if (!rows.length) return showToast('CSV vacío', 'err');

      const hasMeta = rows.find(r => r[0] === 'META');
      if (!hasMeta) return showToast('Formato no reconocido. Exporta primero desde esta app.', 'err');

      const added = { gastos:0, ingresos:0, presupuestos:0, cats:0 };
      const budgetMap = {};

      rows.forEach(r => {
        const tipo = r[0];

        if (tipo === 'CONFIG') {
          if (r[2] === 'p1' && r[3]) state.config.p1 = r[3];
          if (r[4] === 'p2' && r[5]) state.config.p2 = r[5];
        }

        else if (tipo === 'CATEGORIA') {
          if (!state.cats) state.cats = [];
          const name = r[2], color = r[3] || '#607070';
          if (name && !state.cats.find(cat => cat.name === name)) {
            state.cats.push({ name, color });
            added.cats++;
          }
        }

        else if (tipo === 'GASTO') {
          const id = r[2];
          if (id && !state.gastos.find(g => g.id === id)) {
            state.gastos.push({
              id,
              date:  fixDate(r[3]),
              store: r[4], cat: r[5],
              amt:   parseFloat(r[6]) || 0,
              payer: r[7], type: r[8] || 'variable', desc: r[9] || ''
            });
            added.gastos++;
          }
        }

        else if (tipo === 'INGRESO') {
          const id = r[2];
          if (id && !state.ingresos.find(i => i.id === id)) {
            state.ingresos.push({
              id, month: r[3], person: r[4],
              type: r[5] || 'salario', amt: parseFloat(r[6]) || 0
            });
            added.ingresos++;
          }
        }

        else if (tipo === 'PRESUPUESTO') {
          const bid = r[2], btipo = r[3], bmes = r[4] === 'fijo' ? null : r[4];
          const cat = r[5], importe = parseFloat(r[6]) || 0;
          if (!budgetMap[bid]) budgetMap[bid] = { id: bid, tipo: btipo, mes: bmes, entries: [] };
          if (cat && importe > 0) budgetMap[bid].entries.push({ cat, importe });
        }
      });

      // Merge presupuestos
      if (!state.presupuestos) state.presupuestos = [];
      Object.values(budgetMap).forEach(b => {
        if (b.entries.length && !state.presupuestos.find(p => p.id === b.id)) {
          state.presupuestos.push(b);
          added.presupuestos++;
        }
      });

      save();
      populateSelects();
      populatePayers();
      applyConfig();
      renderDashboard();
      renderLista();
      renderIngresos();

      const msg = `✓ ${added.gastos} gastos · ${added.ingresos} ingresos · ${added.presupuestos} presupuestos · ${added.cats} categorías importados`;
      showToast(msg);

    } catch(e) {
      console.error(e);
      showToast('Error al leer el CSV: ' + e.message, 'err');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// Robust CSV parser — handles quoted fields with commas inside
