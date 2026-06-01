// ═══════════════════════════════════════════════════════════════════
// BANK IMPORT — CSV / XLSX → Gastos
// ═══════════════════════════════════════════════════════════════════
const BANK_PROFILES_KEY = 'gp_bank_profiles';

let _bankRows = [];       // raw parsed rows (string[][])
let _bankHeaders = [];    // first row
let _bankPreviewData = []; // {date, amt, desc} ready to import

// ── Profiles ─────────────────────────────────────────────────────────
function getBankProfiles() {
  try { return JSON.parse(localStorage.getItem(BANK_PROFILES_KEY) || '[]'); } catch { return []; }
}
function _saveBankProfileData(name, mapping) {
  const list = getBankProfiles().filter(p => p.name !== name);
  list.unshift({ name, mapping });
  localStorage.setItem(BANK_PROFILES_KEY, JSON.stringify(list.slice(0, 20)));
}
function deleteBankProfile(name) {
  localStorage.setItem(BANK_PROFILES_KEY,
    JSON.stringify(getBankProfiles().filter(p => p.name !== name)));
  renderBankProfileList();
}
function applyBankProfile(name) {
  const p = getBankProfiles().find(p => p.name === name);
  if (!p) return;
  if (!_bankHeaders.length) { showToast('Carga un archivo primero', 'err'); return; }
  _applyMappingToSelects(p.mapping);
  updateBankPreview();
  showToast('Perfil "' + name + '" aplicado', 'ok');
}
function saveCurrentBankProfile() {
  const name = document.getElementById('bankProfileName').value.trim();
  if (!name) { showToast('Introduce un nombre para el perfil', 'err'); return; }
  _saveBankProfileData(name, _getCurrentMapping());
  renderBankProfileList();
  showToast('Perfil "' + name + '" guardado', 'ok');
}

function _getCurrentMapping() {
  return {
    dateCol: +document.getElementById('mapDate').value,
    amtCol:  +document.getElementById('mapAmt').value,
    descCol: +document.getElementById('mapDesc').value,
    skipPositive: document.getElementById('mapSkipPositive').checked,
  };
}
function _applyMappingToSelects(m) {
  document.getElementById('mapDate').value = m.dateCol ?? -1;
  document.getElementById('mapAmt').value  = m.amtCol  ?? -1;
  document.getElementById('mapDesc').value = m.descCol ?? -1;
  document.getElementById('mapSkipPositive').checked = !!m.skipPositive;
}

// ── Modal ─────────────────────────────────────────────────────────────
function openBankImport() {
  _bankRows = []; _bankHeaders = []; _bankPreviewData = [];
  const hide = id => document.getElementById(id).style.display = 'none';
  hide('bankMappingWrap'); hide('bankPreviewWrap');
  hide('bankImportOptionsWrap'); hide('bankImportBtn');
  document.getElementById('bankFileName').textContent = 'Ningún archivo seleccionado';
  document.getElementById('bankFileInput').value = '';
  document.getElementById('bankAiHint').textContent = '';
  document.getElementById('bankProfileName').value = '';
  _populateBankCatPayer();
  renderBankProfileList();
  openModal('bankImportModal');
}

function _populateBankCatPayer() {
  const catSel = document.getElementById('bankCat');
  catSel.innerHTML = '<option value="">🔍 Sin categoría asignada</option>';
  getCats().forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    catSel.appendChild(o);
  });
  const paySel = document.getElementById('bankPayer');
  paySel.innerHTML = '';
  const { p1, p2 } = state.config;
  [p1, p2, 'Conjunto'].forEach(n => {
    const o = document.createElement('option');
    o.value = n; o.textContent = n;
    if (n === 'Conjunto') o.selected = true;
    paySel.appendChild(o);
  });
}

function renderBankProfileList() {
  const profiles = getBankProfiles();
  const el = document.getElementById('bankProfileList');
  if (!profiles.length) {
    el.innerHTML = '<p style="font-size:.78rem;color:var(--gray);margin:.25rem 0">Sin perfiles guardados.</p>';
    return;
  }
  el.innerHTML = profiles.map(p => `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;border-bottom:1px solid rgba(125,191,191,0.08)">
      <span style="flex:1;font-size:.8rem">${escapeHTML(p.name)}</span>
      <button class="pill-btn" style="font-size:.7rem;padding:.15rem .45rem"
        onclick="applyBankProfile(${JSON.stringify(p.name)})">Aplicar</button>
      <button class="pill-btn" style="font-size:.7rem;padding:.15rem .45rem;background:rgba(201,64,64,0.25)"
        onclick="deleteBankProfile(${JSON.stringify(p.name)})">✕</button>
    </div>`).join('');
}

// ── File reading ──────────────────────────────────────────────────────
async function _loadSheetJS() {
  if (window.XLSX) return;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar la librería Excel. Guarda el archivo como CSV e inténtalo de nuevo.'));
    document.head.appendChild(s);
  });
}

async function bankImportFileChanged(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('bankFileName').textContent = file.name;
  ['bankMappingWrap','bankPreviewWrap','bankImportOptionsWrap','bankImportBtn']
    .forEach(id => document.getElementById(id).style.display = 'none');

  try {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      document.getElementById('bankAiHint').textContent = '📊 Cargando librería Excel…';
      await _loadSheetJS();
      _bankRows = await _readXlsx(file);
    } else {
      _bankRows = await _readCsvFile(file);
    }

    if (_bankRows.length < 2) { showToast('El archivo no tiene suficientes datos', 'err'); return; }
    _bankHeaders = _bankRows[0];
    _showBankMappingUI();

    if (getAnthropicKey()) {
      document.getElementById('bankAiHint').textContent = '🤖 Detectando columnas con IA…';
      try {
        const suggested = await _detectMappingWithAI(_bankRows.slice(0, 8), file.name);
        _applyMappingToSelects(suggested);
        updateBankPreview();
        document.getElementById('bankAiHint').textContent =
          '✓ Columnas detectadas — revisa y ajusta si es necesario';
      } catch {
        document.getElementById('bankAiHint').textContent =
          '⚠ Detección automática no disponible — configura manualmente';
        updateBankPreview();
      }
    } else {
      document.getElementById('bankAiHint').textContent =
        '(Configura tu API Key en Config para detección automática)';
      updateBankPreview();
    }
  } catch(e) {
    showToast('Error leyendo archivo: ' + e.message, 'err');
    document.getElementById('bankAiHint').textContent = '';
  }
}

async function _readXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return _parseCsvText(XLSX.utils.sheet_to_csv(ws, { blankrows: false, FS: ',' }));
}

async function _readCsvFile(file) {
  return _parseCsvText(await file.text());
}

function _parseCsvText(text) {
  const firstLine = text.split('\n')[0] || '';
  const sep = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        i++;
        let cell = '';
        while (i < line.length) {
          if (line[i] === '"' && line[i+1] === '"') { cell += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else cell += line[i++];
        }
        if (line[i] === sep) i++;
        cells.push(cell.trim());
      } else {
        const end = line.indexOf(sep, i);
        if (end === -1) { cells.push(line.slice(i).trim()); i = line.length; }
        else { cells.push(line.slice(i, end).trim()); i = end + 1; }
      }
    }
    if (cells.some(c => c)) rows.push(cells);
  }
  return rows;
}

// ── Mapping UI ─────────────────────────────────────────────────────────
function _showBankMappingUI() {
  const opts = '<option value="-1">— No usar —</option>' +
    _bankHeaders.map((h, i) =>
      `<option value="${i}">${escapeHTML(h || 'Col ' + (i+1))}</option>`
    ).join('');
  ['mapDate','mapAmt','mapDesc'].forEach(id =>
    document.getElementById(id).innerHTML = opts);
  _applyMappingToSelects(_guessColumns(_bankHeaders));
  document.getElementById('bankMappingWrap').style.display = 'block';
}

function _guessColumns(headers) {
  const lh = headers.map(h => (h || '').toLowerCase());
  const find = (...kw) => lh.findIndex(h => kw.some(k => h.includes(k)));
  const dateCol = find('fecha', 'date', 'día', 'dia', 'fec', 'dat', 'f.valor', 'f.oper');
  const amtCol  = find('importe', 'amount', 'cargo', 'monto', 'total', 'valor',
                        'movimiento', 'cuantía', 'cuantia', 'débito', 'debito', 'abono');
  const descCol = find('concepto', 'descripci', 'description', 'comercio',
                        'establecimiento', 'detalle', 'referencia', 'notas', 'texto');
  return {
    dateCol:  dateCol >= 0 ? dateCol : 0,
    amtCol:   amtCol  >= 0 ? amtCol  : 1,
    descCol:  descCol >= 0 ? descCol : (amtCol > 1 ? amtCol - 1 : 2),
    skipPositive: false,
  };
}

function updateBankPreview() {
  const m = _getCurrentMapping();
  if (m.dateCol < 0 || m.amtCol < 0) {
    ['bankPreviewWrap','bankImportOptionsWrap','bankImportBtn']
      .forEach(id => document.getElementById(id).style.display = 'none');
    return;
  }

  _bankPreviewData = [];
  for (const row of _bankRows.slice(1)) {
    const rawAmt = row[m.amtCol] || '';
    const amtNum = _parseAmount(rawAmt);
    if (isNaN(amtNum) || amtNum === 0) continue;
    if (m.skipPositive && amtNum > 0) continue;
    const amt = Math.abs(amtNum);
    if (amt <= 0) continue;
    _bankPreviewData.push({
      date: fixDate(row[m.dateCol] || ''),
      amt,
      desc: m.descCol >= 0 ? (row[m.descCol] || '') : '',
    });
  }

  document.getElementById('bankPreviewCount').textContent = _bankPreviewData.length;

  const table = document.getElementById('bankPreviewTable');
  if (!_bankPreviewData.length) {
    table.innerHTML = '<tr><td colspan="3" style="color:var(--gray);padding:.5rem;text-align:center">Sin gastos encontrados — ajusta el mapeo</td></tr>';
  } else {
    const preview = _bankPreviewData.slice(0, 10);
    table.innerHTML = `
      <thead><tr style="border-bottom:1px solid rgba(125,191,191,0.2)">
        <th style="padding:.3rem .5rem;text-align:left;color:var(--teal-light);font-weight:500;font-size:.78rem">Fecha</th>
        <th style="padding:.3rem .5rem;text-align:right;color:var(--teal-light);font-weight:500;font-size:.78rem">Importe</th>
        <th style="padding:.3rem .5rem;text-align:left;color:var(--teal-light);font-weight:500;font-size:.78rem">Descripción</th>
      </tr></thead>
      <tbody>${preview.map(r => `<tr style="border-bottom:1px solid rgba(125,191,191,0.06)">
        <td style="padding:.25rem .5rem;font-size:.78rem;white-space:nowrap">${escapeHTML(r.date)}</td>
        <td style="padding:.25rem .5rem;font-size:.78rem;text-align:right;font-family:var(--font-mono,monospace)">${r.amt.toFixed(2)}€</td>
        <td style="padding:.25rem .5rem;font-size:.78rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(r.desc)}</td>
      </tr>`).join('')}
      ${_bankPreviewData.length > 10
        ? `<tr><td colspan="3" style="padding:.25rem .5rem;color:var(--gray);font-size:.74rem">… y ${_bankPreviewData.length - 10} más</td></tr>`
        : ''}
      </tbody>`;
  }

  document.getElementById('bankPreviewWrap').style.display = 'block';
  const hasData = _bankPreviewData.length > 0;
  document.getElementById('bankImportOptionsWrap').style.display = hasData ? 'block' : 'none';
  document.getElementById('bankImportBtn').style.display = hasData ? 'block' : 'none';
}

function _parseAmount(str) {
  if (!str) return NaN;
  let s = str.replace(/[€$£\s]/g, '').trim();
  // Spanish format: 1.234,56 → 1234.56
  if (/^\-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Standard or comma-decimal: replace comma with dot
    s = s.replace(',', '.');
  }
  // Trailing minus sign (some Spanish banks): "1234,56-"
  if (s.endsWith('-')) s = '-' + s.slice(0, -1);
  return parseFloat(s);
}

// ── AI column detection ────────────────────────────────────────────────
async function _detectMappingWithAI(rows, filename) {
  const key = getAnthropicKey();
  if (!key) throw new Error('No API key');

  const headers = rows[0] || [];
  const tableText = rows
    .map(row => row.join(' | '))
    .join('\n');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Analiza este extracto bancario ("${filename}") e identifica qué columna (índice 0-based) contiene cada dato.

Cabeceras (índices 0..${headers.length-1}): ${headers.map((h,i) => `${i}="${h}"`).join(', ')}

Primeras filas:
${tableText}

Devuelve SOLO un JSON:
{"dateCol": N, "amtCol": N, "descCol": N, "skipPositive": bool}

- dateCol: columna con la fecha del movimiento
- amtCol: columna con el importe (número)
- descCol: columna con la descripción o concepto (-1 si no hay)
- skipPositive: true si los gastos/débitos aparecen como números negativos

Responde ÚNICAMENTE con el JSON, sin texto adicional.`
      }]
    })
  });

  if (!resp.ok) throw new Error('API error ' + resp.status);
  const data = await resp.json();
  const text = data.content.map(b => b.text || '').join('').trim()
    .replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim();
  return JSON.parse(text);
}

// ── Import confirmation ────────────────────────────────────────────────
function confirmBankImport() {
  if (!_bankPreviewData.length) { showToast('Sin datos para importar', 'err'); return; }

  const cats  = getCats();
  const cat   = document.getElementById('bankCat').value || cats[0] || 'Otros';
  const payer = document.getElementById('bankPayer').value;

  for (const row of _bankPreviewData) {
    state.gastos.push({
      id:    uid(),
      date:  row.date,
      store: row.desc || 'Extracto bancario',
      cat,
      amt:   row.amt,
      desc:  row.desc,
      payer,
      type:  'variable',
    });
  }

  const added = _bankPreviewData.length;
  save();
  renderDashboard(); renderLista();
  closeModal('bankImportModal');
  showToast(`✓ ${added} gastos importados`, 'ok');
}
