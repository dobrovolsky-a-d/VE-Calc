import { parseLog } from "./parseLog.js";
import { parseVE } from "./parseVE.js";
import { calculateVE } from "./veMath.js";
import { exportRomRaider } from "./exportRomRaider.js";

let logData = null;
let veOld = null;
let result = null;

function setStatus(id, html, color) {
  const el = document.getElementById(id);
  if (el) { el.innerHTML = html; if (color) el.style.color = color; }
}

function setDebug(txt) {
  const d = document.getElementById('debugLog');
  if (d) d.textContent = txt;
}

// Load log
document.getElementById('loadLog').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  setStatus('statusLog','⏳ Чтение лога...','var(--muted)');
  try {
    logData = await parseLog(f);
    setStatus('statusLog', `✅ Log loaded (${logData.length} valid lines)`, '#7BE495');
    const cols = logData.length ? Object.keys(logData[0]).join(', ') : 'нет данных';
    setDebug(`Detected columns: ${cols}\nSample lines: ${Math.min(5, logData.length)}`);
  } catch (err) {
    setStatus('statusLog', `❌ Ошибка: ${err.message}`, '#ff6b6b');
    setDebug(err.stack || String(err));
  }
});

// Load VE table
document.getElementById('loadVE').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  setStatus('statusVE','⏳ Чтение VE...','var(--muted)');
  try {
    veOld = await parseVE(f);
    setStatus('statusVE', `✅ VE table loaded (${veOld.rows}x${veOld.cols})`, '#7BE495');
  } catch (err) {
    setStatus('statusVE', `❌ Ошибка: ${err.message}`, '#ff6b6b');
  }
});

// Calculate
document.getElementById('calculate').addEventListener('click', () => {
  if (!logData || !veOld) {
    setStatus('statusCalc','⚠️ Загрузите лог и VE таблицу','orange');
    return;
  }
  setStatus('statusCalc','⚙️ Рассчитываем...','var(--muted)');
  try {
    result = calculateVE(logData, veOld);
    setStatus('statusCalc','✅ Расчёт завершён','#7BE495');
    renderResult(result);
    const ex = document.getElementById('export');
    if (ex) { ex.disabled = false; ex.classList.remove('disabled'); }
  } catch (err) {
    setStatus('statusCalc',`❌ Ошибка: ${err.message}`,'#ff6b6b');
    setDebug(err.stack || String(err));
  }
});

// Export
document.getElementById('export').addEventListener('click', () => {
  if (!result || !result.VE_new) {
    setStatus('statusCalc','⚠️ Нет данных для экспорта','orange');
    return;
  }
  exportRomRaider(result.VE_new);
  setStatus('statusCalc','✅ Экспортирован VE_new.csv','#7BE495');
});

function renderResult(data) {
  const out = document.getElementById('output');
  out.innerHTML = '';
  const sections = [
    {title:'Original VE', matrix: data.VE_old},
    {title:'Correction (%)', matrix: data.Correction},
    {title:'Smoothed VE', matrix: data.VE_new}
  ];
  sections.forEach(s => {
    const card = document.createElement('div');
    card.className = 'card';
    const h = document.createElement('h3');
    h.textContent = s.title;
    card.appendChild(h);
    const table = document.createElement('table');
    table.className = 've-table';
    s.matrix.forEach(row => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = (typeof cell === 'number') ? cell.toFixed(2) : cell;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    card.appendChild(table);
    out.appendChild(card);
  });
}
