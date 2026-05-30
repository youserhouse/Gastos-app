// ingresos.js — Add, delete income entries; render income summary and table

function addIngreso() {
  const month = (document.getElementById('iMonth')?.value || '').slice(0,7);
  const person = document.getElementById('iPerson').value;
  const type   = document.getElementById('iType').value;
  const amt    = parseFloat(document.getElementById('iAmt').value);
  if (!month || !person || !amt || amt <= 0) return showToast('Rellena todos los campos', 'err');
  state.ingresos.push({ id: uid(), month, person, type, amt });
  save();
  showToast('✓ Ingreso añadido');
  document.getElementById('iAmt').value = '';
  renderIngresos();
  renderDashboard();
}

function deleteIngreso(id) {
  state.ingresos = state.ingresos.filter(i => i.id !== id);
  save(); renderIngresos(); renderDashboard();
}

function renderIngresos() {
  // Resumen
  const { p1, p2 } = state.config;
  const totP1 = state.ingresos.filter(i=>i.person===p1).reduce((s,i)=>s+i.amt,0);
  const totP2 = state.ingresos.filter(i=>i.person===p2).reduce((s,i)=>s+i.amt,0);
  const tot   = totP1 + totP2;
  document.getElementById('ingresosResumen').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:.75rem">
      ${[{n:p1,v:totP1},{n:p2,v:totP2},{n:'Total',v:tot}].map(x=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem .8rem;background:rgba(255,255,255,0.04);border-radius:.6rem">
          <span style="font-size:.85rem;color:var(--white)">${x.n}</span>
          <span class="mono" style="color:var(--teal-light)">${fmt(x.v)}</span>
        </div>`).join('')}
      ${tot>0 ? `
        <div style="font-size:.75rem;color:var(--gray);text-align:center;margin-top:.25rem">
          ${p1}: ${(totP1/tot*100).toFixed(1)}% · ${p2}: ${(totP2/tot*100).toFixed(1)}%
        </div>` : ''}
    </div>`;

  // Table
  const tbody = document.getElementById('ingresosBody');
  const rows = [...state.ingresos].sort((a,b)=>b.month.localeCompare(a.month));
  tbody.innerHTML = rows.length ? rows.map(i=>`
    <tr>
      <td>${MONTHS_ES[parseInt(i.month.slice(5))-1]} ${i.month.slice(0,4)}</td>
      <td style="font-weight:500">${i.person}</td>
      <td><span class="chip" style="background:rgba(45,106,106,0.2);color:var(--teal-light)">${i.type}</span></td>
      <td class="mono" style="color:#5ABEA0">${fmt(i.amt)}</td>
      <td><button class="del-btn" onclick="deleteIngreso('${i.id}')">✕</button></td>
    </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--gray);padding:2rem">Sin ingresos registrados</td></tr>';
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
