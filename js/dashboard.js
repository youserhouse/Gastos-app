// dashboard.js — Monthly KPIs, budget-vs-spend chart, recent transactions; expense list

function renderDashboard() {
  const mk = (document.getElementById('dashMonthSel')?.value || '').slice(0,7);
  if (!mk) return;

  const [y,m] = mk.split('-');
  document.getElementById('dashMonth').textContent = `${MONTHS_ES[parseInt(m)-1]} ${y}`;

  const gastosMes = state.gastos.filter(g => monthKey(g.date) === mk);
  const ingresosMes = state.ingresos.filter(i => i.month === mk);

  const totalGastos   = gastosMes.reduce((s,g)=>s+g.amt, 0);
  const totalIngresos = ingresosMes.reduce((s,i)=>s+i.amt, 0);
  const disponible    = totalIngresos - totalGastos;
  const { p1, p2 }   = state.config;
  const gastoP1 = gastosMes.filter(g=>g.payer===p1).reduce((s,g)=>s+g.amt,0);
  const gastoP2 = gastosMes.filter(g=>g.payer===p2).reduce((s,g)=>s+g.amt,0);

  // KPIs
  document.getElementById('kpiRow').innerHTML = `
    <div class="kpi highlight">
      <div class="kpi-label">Total gastos</div>
      <div class="kpi-value">${fmt(totalGastos)}</div>
      <div class="kpi-sub">${gastosMes.length} transacciones</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Ingresos</div>
      <div class="kpi-value">${fmt(totalIngresos)}</div>
      <div class="kpi-sub">${ingresosMes.length} registros</div>
    </div>
    <div class="kpi ${disponible>=0?'pos':'neg'}">
      <div class="kpi-label">Disponible</div>
      <div class="kpi-value">${fmt(disponible)}</div>
      <div class="kpi-sub">${disponible>=0?'Superávit':'Déficit'}</div>
    </div>
  `;

  // ── Gráfica presupuesto vs gasto real por categoría ──
  const budget = getBudgetForMonth(mk);
  const byCat = {};
  gastosMes.forEach(g => byCat[g.cat] = (byCat[g.cat]||0) + g.amt);

  const pieWrap = document.getElementById('catPieWrap');

  // Reúne todas las categorías con presupuesto o con gasto
  const allCatNames = new Set([
    ...Object.keys(byCat),
    ...(budget ? budget.entries.map(e => e.cat) : [])
  ]);

  if (!allCatNames.size) {
    pieWrap.innerHTML = '<p style="color:var(--gray);font-size:.85rem;padding:1rem 0">Sin gastos ni presupuesto este mes</p>';
  } else {
    const catItems = [...allCatNames].map(cat => ({
      cat,
      color:   getCatColor(cat) || '#607070',
      gastado: byCat[cat] || 0,
      presup:  budget?.entries.find(e => e.cat === cat)?.importe || 0,
    })).sort((a,b) => (b.presup || b.gastado) - (a.presup || a.gastado));

    const maxVal = Math.max(...catItems.map(i => Math.max(i.gastado, i.presup)), 1);
    const hasBudget = catItems.some(i => i.presup > 0);

    const rows = catItems.map(item => {
      const over    = item.presup > 0 && item.gastado > item.presup;
      const barColor = over ? '#C94040' : item.color;
      const gastPct  = (item.gastado / maxVal * 100).toFixed(1);
      const presPct  = item.presup > 0 ? (item.presup / maxVal * 100).toFixed(1) : 0;
      const usoPct   = item.presup > 0 ? (item.gastado / item.presup * 100).toFixed(0) : null;

      return `
      <div style="margin-bottom:.85rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
          <div style="display:flex;align-items:center;gap:.45rem">
            <span style="width:9px;height:9px;border-radius:50%;background:${over?'#C94040':item.color};flex-shrink:0"></span>
            <span style="font-size:.82rem;font-weight:500;color:var(--white)">${item.cat}</span>
            ${over ? '<span style="font-size:.68rem;color:#E07070">▲ excedido</span>' : ''}
          </div>
          <div style="display:flex;align-items:center;gap:.6rem">
            <span class="mono" style="font-size:.75rem;color:${over?'#E07070':'var(--teal-light)'}">${fmt(item.gastado,0)}</span>
            ${item.presup > 0 ? `<span style="font-size:.7rem;color:var(--gray)">/ ${fmt(item.presup,0)}</span>` : ''}
            ${usoPct !== null ? `<span style="font-size:.68rem;color:${over?'#E07070':'var(--gray)'};min-width:32px;text-align:right">${usoPct}%</span>` : ''}
          </div>
        </div>
        <div style="position:relative;height:10px;background:rgba(255,255,255,0.07);border-radius:999px;overflow:hidden">
          ${item.presup > 0 ? `<div style="position:absolute;top:0;left:0;height:100%;width:${presPct}%;background:rgba(255,255,255,0.1);border-right:2px dashed rgba(255,255,255,0.3);border-radius:999px 0 0 999px"></div>` : ''}
          <div style="position:absolute;top:0;left:0;height:100%;width:${gastPct}%;background:${barColor};border-radius:999px;transition:width .8s cubic-bezier(.4,0,.2,1)"></div>
        </div>
      </div>`;
    }).join('');

    const legend = hasBudget ? `
      <div style="display:flex;align-items:center;gap:1.5rem;margin-top:.25rem;padding-top:.75rem;border-top:1px solid rgba(125,191,191,0.1)">
        <div style="display:flex;align-items:center;gap:.4rem;font-size:.72rem;color:var(--gray)">
          <span style="width:20px;height:3px;background:rgba(255,255,255,0.25);border-right:2px dashed rgba(255,255,255,0.4);display:inline-block"></span> Presupuesto
        </div>
        <div style="display:flex;align-items:center;gap:.4rem;font-size:.72rem;color:var(--gray)">
          <span style="width:20px;height:6px;background:var(--teal-light);border-radius:3px;display:inline-block"></span> Gasto real
        </div>
        <div style="display:flex;align-items:center;gap:.4rem;font-size:.72rem;color:var(--gray)">
          <span style="width:20px;height:6px;background:#C94040;border-radius:3px;display:inline-block"></span> Excedido
        </div>
      </div>` : '';

    pieWrap.innerHTML = `<div style="width:100%">${rows}${legend}</div>`;
  }

  // Recent 5
  const recent = [...gastosMes].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  document.getElementById('recentBody').innerHTML = recent.length
    ? recent.map(g=>{
        const color = getCatColor(g.cat)||'#607070';
        return `<tr>
          <td class="mono" style="color:var(--gray)">${fmtDate(g.date)}</td>
          <td style="font-weight:500">${escapeHTML(g.store)}</td>
          <td><span class="chip" style="background:${color}22;color:${color}">${escapeHTML(g.cat)}</span></td>
          <td style="font-size:.82rem;color:var(--gray)">${g.payer}</td>
          <td class="mono" style="color:var(--teal-light)">${fmt(g.amt)}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--gray);padding:2rem">Sin gastos este mes</td></tr>';
}

// ═══════════════════════════════════════════════════════════════════
// LISTA
// ═══════════════════════════════════════════════════════════════════
function renderLista() {
  const q   = document.getElementById('searchInput').value.toLowerCase();
  const cat = document.getElementById('filterCat').value;
  const pay = document.getElementById('filterPayer').value;
  const mon = (document.getElementById('filterMonth')?.value || '').slice(0,7);

  let rows = [...state.gastos].sort((a,b)=>b.date.localeCompare(a.date));
  if (q)   rows = rows.filter(g => (g.store+g.desc+g.cat).toLowerCase().includes(q));
  if (cat) rows = rows.filter(g => g.cat === cat);
  if (pay) rows = rows.filter(g => g.payer === pay);
  if (mon) rows = rows.filter(g => monthKey(g.date) === mon);

  document.getElementById('listaBody').innerHTML = rows.length
    ? rows.map(g=>{
        const color = getCatColor(g.cat)||'#607070';
        return `<tr>
          <td class="mono" style="color:var(--gray)">${fmtDate(g.date)}</td>
          <td style="font-weight:500">${escapeHTML(g.store)}</td>
          <td style="font-size:.82rem;color:var(--gray);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(g.desc)||'—'}</td>
          <td><span class="chip" style="background:${color}22;color:${color}">${escapeHTML(g.cat)}</span></td>
          <td style="font-size:.82rem;color:var(--gray)">${g.payer}</td>
          <td class="mono" style="color:var(--teal-light)">${fmt(g.amt)}</td>
          <td style="display:flex;gap:.35rem">
            <button class="edit-btn" onclick="openEdit('${g.id}')">✏</button>
            <button class="del-btn" onclick="deleteGasto('${g.id}')">✕</button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:2.5rem">Sin resultados</td></tr>';
}

// ═══════════════════════════════════════════════════════════════════
// SCANNER
// ═══════════════════════════════════════════════════════════════════
