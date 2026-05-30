// scanner.js — AI receipt scanner: file queue, Anthropic API call, scan log

document.getElementById('scanInput').addEventListener('change', function() {
  addScanFilesRaw([...this.files]);
  this.value = '';
});

function addScanFilesRaw(newFiles) {
  newFiles.forEach(f => {
    if (!f.type.startsWith('image/')) { showToast(f.name+': solo imágenes','err'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      scanFiles.push({ id: uid(), file: f, dataUrl: ev.target.result, name: f.name, status: 'pending' });
      renderQueue();
      document.getElementById('scanBtn').disabled = false;
    };
    reader.readAsDataURL(f);
  });
}

function addScanFiles() {} // triggered by input onchange above

function removeScanFile(id) {
  scanFiles = scanFiles.filter(f=>f.id!==id);
  renderQueue();
  document.getElementById('scanBtn').disabled = scanFiles.length === 0;
}

function renderQueue() {
  const q = document.getElementById('scanQueue');
  q.innerHTML = scanFiles.map(f=>`
    <div class="queue-item">
      <div class="queue-thumb"><img src="${f.dataUrl}" alt=""></div>
      <span class="queue-name">${f.name}</span>
      <span class="queue-status">${f.status==='done'?'<span style="color:#5ABEA0">✓</span>':f.status==='error'?'<span style="color:#E07070">✗</span>':'⏳'}</span>
      <button class="queue-rm" onclick="removeScanFile('${f.id}')">✕</button>
    </div>`).join('');
}

async function runScan() {
  const key = getAnthropicKey();
  if (!key) {
    showToast('Escáner no disponible — configura tu clave API en Config', 'err');
    return;
  }
  if (scanFiles.length === 0) return;



  const btn = document.getElementById('scanBtn');
  const log = document.getElementById('scanLog');
  btn.disabled = true;
  document.getElementById('scanSpinner').style.display = 'block';
  document.getElementById('scanBtnTxt').textContent = 'Analizando…';
  log.innerHTML = ''; log.classList.add('show');

  let added = 0;
  for (const sf of scanFiles) {
    addScanLog(`📄 ${sf.name}…`);
    try {
      const results = await callClaudeReceipt(sf.dataUrl, key);
      results.forEach(r => {
        state.gastos.push({
          id: uid(),
          date: r.fecha || todayIso(),
          store: r.establecimiento || 'Desconocido',
          cat: r.categoria || 'Otros',
          amt: parseFloat(r.importe) || 0,
          desc: r.descripcion || '',
          payer: 'Conjunto',   // default — user can edit in lista
          type: 'variable',
        });
        added++;
      });
      sf.status = 'done';
      addScanLog(`✓ ${results.length} gasto(s) extraídos (pagador: Conjunto — edítalo en la lista)`, 'ok');
    } catch(err) {
      sf.status = 'error';
      addScanLog(`✗ ${err.message}`, 'err');
    }
    renderQueue();
  }

  save();
  addScanLog(`\n✦ Listo. ${added} gastos añadidos a la lista.`, 'ok');
  btn.disabled = false;
  document.getElementById('scanSpinner').style.display = 'none';
  document.getElementById('scanBtnTxt').textContent = '✦ Analizar recibos';
  renderDashboard(); renderLista();
  if (added > 0) showToast(`✓ ${added} gastos importados`, 'ok');
}

async function callClaudeReceipt(dataUrl, key) {
  const [meta, b64] = dataUrl.split(',');
  const mtype = meta.match(/:(.*?);/)[1];
  const catNames = getCats().map(cat => cat.name);

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mtype, data: b64 } },
          { type: 'text', text: `Analiza este recibo y devuelve SOLO un JSON array sin markdown, sin texto extra.
Cada objeto debe tener exactamente estas claves:
- "fecha": formato YYYY-MM-DD (ejemplo: 2026-05-12). Si no se ve la fecha usa la de hoy: ${todayIso()}.
- "establecimiento": nombre del comercio
- "descripcion": resumen breve máx 60 chars
- "categoria": DEBE ser exactamente una de estas opciones (copia exacta): ${catNames.join(' | ')}
- "importe": número decimal sin símbolo de moneda (ejemplo: 45.50)
Si la imagen no es un recibo devuelve [].
Responde ÚNICAMENTE con el JSON array, sin explicaciones ni markdown.` }
        ]
      }]
    })
  });
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error?.message || `HTTP ${r.status}`);
  }
  const data = await r.json();
  const text = data.content.map(b => b.text || '').join('').trim()
    .replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) return [];

  // Validate and fix each result
  return parsed.map(item => ({
    ...item,
    // Ensure date is YYYY-MM-DD format
    fecha: fixDate(item.fecha),
    // Ensure category exactly matches one of ours
    categoria: (item.categoria && catNames.includes(item.categoria))
      ? item.categoria
      : findClosestCat(item.categoria || '', catNames),
    importe: parseFloat(item.importe) || 0,
  })).filter(item => item.importe > 0);
}

// Convert any date format to YYYY-MM-DD
function fixDate(dateStr) {
  if (!dateStr) return todayIso();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // DD/MM/YYYY
  const m1 = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
  // DD-MM-YYYY
  const m2 = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
  return todayIso();
}

// Find closest matching category name (case-insensitive)
function findClosestCat(catFromClaude, catNames) {
  if (!catFromClaude || typeof catFromClaude !== 'string') return catNames[0] || 'Otros';
  const lower = catFromClaude.toLowerCase();
  const exact = catNames.find(n => n && n.toLowerCase() === lower);
  if (exact) return exact;
  const partial = catNames.find(n => n && (lower.includes(n.toLowerCase()) || n.toLowerCase().includes(lower)));
  if (partial) return partial;
  return catNames[0] || 'Otros';
}

function addScanLog(msg, type='') {
  const log = document.getElementById('scanLog');
  const d = document.createElement('div');
  d.style.color = type==='ok'?'#5ABEA0':type==='err'?'#E07070':'var(--teal-light)';
  d.textContent = '> '+msg;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════
