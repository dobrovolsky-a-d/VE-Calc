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

async function handleLogFile(file) {
  setStatus('statusLog','⏳ Чтение лога...','var(--muted)');
  try {
    const parsed = await parseLog(file);
    logData = parsed;
    setStatus('statusLog', `✅ Log loaded (${logData.length} valid lines)`, '#7BE495');
    setDebug(`Detected columns: ${Object.keys(logData[0] || {}).join(', ')}\nSample lines: ${Math.min(5, logData.length)}`);
  } catch (err) {
    setStatus('statusLog', `❌ Ошибка: ${err.message}`, '#ff6b6b');
    setDebug(err.stack || String(err));
  }
}

async function handleVEFile(file) {
  setStatus('statusVE','⏳ Чтение VE...','var(--muted)');
  try {
    const parsed = await parseVE(file);
    veOld = parsed;
    setStatus('statusVE', `✅ VE table loaded (${veOld.rows}x${veOld.cols})`, '#7BE495');
    setDebug((document.getElementById('debugLog').textContent || '') + `\nVE size: ${veOld.rows}x${veOld.cols}`);
  } catch (err) {
    setStatus('statusVE', `❌ Ошибка: ${err.message}`, '#ff6b6b');
    setDebug(err.stack || String(err));
  }
}

// support mobile where input change sometimes not fired - listen both change and input
const logInput = document.getElementById('loadLog');
const veInput = document.getElementById('loadVE');

logInput.addEventListener('change', (e) => { if(e.target.files[0]) handleLogFile(e.target.files[0]); });
logInput.addEventListener('input', (e) => { if(e.target.files[0]) handleLogFile(e.target.files[0]); });

veInput.addEventListener('change', (e) => { if(e.target.files[0]) handleVEFile(e.target.files[0]); });
veInput.addEventListener('input', (e) => { if(e.target.files[0]) handleVEFile(e.target.files[0]); });

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
