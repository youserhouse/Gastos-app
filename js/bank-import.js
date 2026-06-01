// bank-import.js — Parse bank Excel/CSV exports and bulk-import as gastos/ingresos

function openBankImport() {
  document.getElementById('bankFileInput').value = '';
  document.getElementById('bankPreviewWrap').innerHTML = '';
  window._bankImportItems = null;
  openModal('bankImportModal');
}

function handleBankFile(input) {
  const file = input.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  if (ext === 'xlsx' || ext === 'xls') {
    if (typeof XLSX === 'undefined') {
      return showToast('Librería Excel no disponible. Comprueba tu conexión.', 'err');
    }
    reader.onload = e => _parseBankExcel(e.target.result);
    reader.readAsArrayBuffer(file);
  } else if (ext === 'csv') {
    reader.onload = e => _parseBankCSV(e.target.result);
    reader.readAsText(file, 'latin1');
  } else {
    showToast('Formato no soportado. Usa .xlsx, .xls o .csv', 'err');
  }
}

function _parseBankExcel(buffer) {
  try {
    const wb   = XLSX.read(buffer, { type: 'array', cellDates: true });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    _processBankRows(rows);
  } catch(e) {
    console.error(e);
    showToast('Error al leer el archivo Excel', 'err');
  }
}

function _parseBankCSV(text) {
  const delim = text.indexOf(';') !== -1 ? ';' : ',';
  const rows  = text.split('\n')
    .map(line => line.split(delim).map(c => c.trim().replace(/^"|"$/g, '')))
    .filter(r => r.some(c => c));
  _processBankRows(rows);
}

function _processBankRows(rows) {
  if (!rows.length) return showToast('El archivo está vacío', 'err');

  // Locate header row: first row containing a date-like AND amount-like header
  let headerIdx = 0;
  let headers   = [];
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const low = rows[i].map(c => String(c).toLowerCase().trim());
    if (low.some(h => /fecha|date|data/.test(h)) &&
        low.some(h => /importe|amount|import|cargo|abono|mov/.test(h))) {
      headerIdx = i;
      headers   = rows[i].map(c => String(c).trim());
      break;
    }
  }
  if (!headers.length) {
    headers   = rows[0].map(c => String(c).trim());
    headerIdx = 0;
  }

  const colMap = _detectColumns(headers);
  const items  = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const item = _parseRow(rows[i], colMap);
    if (item) items.push(item);
  }

  if (!items.length) return showToast('No se encontraron transacciones válidas', 'err');

  window._bankImportItems = items;
  _renderBankPreview(items);
}

function _detectColumns(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const l = h.toLowerCase();
    if (map.date   === undefined && /fecha|date|data|f\.valor|f\. valor|f\.operac/.test(l)) map.date   = i;
    if (map.amount === undefined && /^importe|^amount|^import(?!ar)|^movimiento/.test(l))   map.amount = i;
    if (map.debit  === undefined && /cargo|débito|debit/.test(l))                            map.debit  = i;
    if (map.credit === undefined && /abono|crédito|credit|haber/.test(l))                    map.credit = i;
    if (map.desc   === undefined && /concepto|descripci|concept|comercio|benefici/.test(l))  map.desc   = i;
  });
  return map;
}

function _parseRow(row, colMap) {
  const date = _parseDate(colMap.date !== undefined ? row[colMap.date] : '');
  if (!date) return null;

  let amt = 0;
  if (colMap.amount !== undefined) {
    amt = _parseAmt(row[colMap.amount]);
  } else if (colMap.debit !== undefined || colMap.credit !== undefined) {
    const deb = colMap.debit  !== undefined ? _parseAmt(row[colMap.debit])  : 0;
    const cre = colMap.credit !== undefined ? _parseAmt(row[colMap.credit]) : 0;
    amt = cre - deb;
  }
  if (amt === 0) return null;

  const desc = colMap.desc !== undefined ? String(row[colMap.desc] || '').trim() : '';
  return { date, amt, desc, type: amt < 0 ? 'gasto' : 'ingreso' };
}

function _parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim();
  if (!s) return null;
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
    return `${y}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Excel serial number
  if (/^\d{5}$/.test(s)) {
    return new Date((parseInt(s) - 25569) * 86400000).toISOString().slice(0, 10);
  }
  return null;
}

function _parseAmt(raw) {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim().replace(/\s/g,'').replace(/€/g,'').replace(/\./g,'').replace(',','.');
  return parseFloat(s) || 0;
}

function _renderBankPreview(items) {
  const gastos   = items.filter(i => i.type === 'gasto');
  const ingresos = items.filter(i => i.type === 'ingreso');
  const payers   = [state.config.p1, state.config.p2].filter(Boolean);

  document.getElementById('bankPreviewWrap').innerHTML = `
    <p style="font-size:.82rem;color:var(--gray);margin-bottom:.6rem">
      Encontradas: <strong style="color:var(--white)">${gastos.length} gastos</strong>
      ${ingresos.length ? ` y <strong style="color:var(--teal-light)">${ingresos.length} ingresos</strong>` : ''}
    </p>
    <div style="max-height:200px;overflow-y:auto;border:1px solid rgba(255,255,255,0.08);border-radius:.5rem;margin-bottom:.75rem">
      <table style="width:100%;border-collapse:collapse;font-size:.77rem">
        <thead><tr style="background:rgba(255,255,255,0.06)">
          <th style="padding:.35rem .5rem;text-align:left;color:var(--gray)">Fecha</th>
          <th style="padding:.35rem .5rem;text-align:left;color:var(--gray)">Concepto</th>
          <th style="padding:.35rem .5rem;text-align:right;color:var(--gray)">Importe</th>
        </tr></thead>
        <tbody>
          ${items.slice(0,60).map(it=>`
            <tr style="border-top:1px solid rgba(255,255,255,0.04)">
              <td style="padding:.3rem .5rem;color:var(--gray);white-space:nowrap">${it.date}</td>
              <td style="padding:.3rem .5rem;color:var(--white);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${it.desc}">${it.desc||'—'}</td>
              <td style="padding:.3rem .5rem;text-align:right;font-family:var(--font-mono,monospace);color:${it.amt<0?'#E05555':'#5ABEA0'}">${fmt(Math.abs(it.amt))}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${items.length>60?`<p style="font-size:.74rem;color:var(--gray);margin-bottom:.6rem">Mostrando 60 de ${items.length} transacciones</p>`:''}
    <label class="form-label">Titular de la cuenta</label>
    <select id="bankImportPayer" style="width:100%;background:var(--surface);color:var(--white);border:1px solid rgba(255,255,255,0.12);border-radius:.6rem;padding:.5rem .75rem;margin-bottom:.75rem">
      ${payers.map(p=>`<option value="${p}">${p}</option>`).join('')}
    </select>
    <button class="submit-btn" onclick="confirmBankImport()" style="width:100%">
      ✅ Importar ${items.length} transacciones
    </button>
  `;
}

function confirmBankImport() {
  const items  = window._bankImportItems || [];
  if (!items.length) return;
  const payer  = document.getElementById('bankImportPayer')?.value || state.config.p1 || '';
  const cats   = getCats();
  const defCat = cats[cats.length - 1]?.name || 'Otros';
  let added = 0;

  items.forEach(item => {
    if (item.type === 'gasto') {
      state.gastos.push({
        id:    uid(),
        date:  item.date,
        store: item.desc || 'Importado',
        cat:   defCat,
        amt:   Math.abs(item.amt),
        payer,
        type:  'variable',
        desc:  '',
      });
    } else {
      state.ingresos.push({
        id:     uid(),
        month:  item.date.slice(0, 7),
        person: payer,
        type:   'Nómina',
        amt:    item.amt,
      });
    }
    added++;
  });

  save();
  closeModal('bankImportModal');
  renderDashboard(); renderLista(); renderIngresos();
  window._bankImportItems = null;
  showToast(`✓ ${added} transacciones importadas`);
}
