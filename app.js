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
    
    // Статистика по логу
    const rpmStats = getStats(parsed.map(p => p.rpm));
    const mapStats = getStats(parsed.map(p => p.map));
    const afrStats = getStats(parsed.map(p => p.afr));
    
    setStatus('statusLog', `✅ Log: ${logData.length} строк`, '#7BE495');
    setDebug(`RPM: ${rpmStats.min}-${rpmStats.max} | MAP: ${mapStats.min}-${mapStats.max} | AFR: ${afrStats.min}-${afrStats.max}\nОбразец: ${JSON.stringify(parsed[0])}`);
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
    setStatus('statusVE', `✅ VE: ${veOld.rows}x${veOld.cols}`, '#7BE495');
    setDebug((document.getElementById('debugLog').textContent || '') + `\nVE: ${veOld.rpmAxis?.join(', ')} RPM | ${veOld.mapAxis?.join(', ')} MAP`);
  } catch (err) {
    setStatus('statusVE', `❌ Ошибка: ${err.message}`, '#ff6b6b');
    setDebug(err.stack || String(err));
  }
}

// Вспомогательная функция для статистики
function getStats(arr) {
  return {
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg: arr.reduce((a, b) => a + b, 0) / arr.length
  };
}

// Остальной код без изменений...
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
  
  // Добавляем статистику по точкам данных
  const statsCard = document.createElement('div');
  statsCard.className = 'card';
  statsCard.innerHTML = `<h3>📊 Статистика данных</h3><p>Точек данных на ячейку: min ${Math.min(...data.DataPoints.flat())}, max ${Math.max(...data.DataPoints.flat())}</p>`;
  out.appendChild(statsCard);
  
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
