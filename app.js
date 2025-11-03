import { parseLog } from "./parseLog.js";
import { parseVE } from "./parseVE.js";
import { calculateVE } from "./veMath.js";
import { exportRomRaider } from "./exportRomRaider.js";

let logData = null;
let veOld = null;
let result = null;

const statusEl = document.getElementById('status');
const debugEl = document.getElementById('debug');
const outEl = document.getElementById('output');

function setStatus(t){ statusEl.textContent = t; }
function setDebug(t){ debugEl.textContent = t; }

document.getElementById('loadLog').addEventListener('change', async (e)=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  setStatus('Чтение лога...');
  try{
    logData = await parseLog(f);
    setStatus(`Log загружен: ${logData.length} строк`);
    setDebug(`Колонки: ${logData.length?Object.keys(logData[0]).join(', '):'—'}`);
  }catch(err){
    setStatus('Ошибка чтения лога');
    setDebug(String(err));
    logData = null;
  }
});

document.getElementById('loadVE').addEventListener('change', async (e)=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  setStatus('Чтение VE таблицы...');
  try{
    veOld = await parseVE(f);
    setStatus(`VE загружена: ${veOld.rows}×${veOld.cols}`);
    setDebug(`RPM axis: ${veOld.rpmAxis?.slice(0,3).join(', ')} ... MAP axis: ${veOld.mapAxis?.slice(0,3).join(', ')}`);
  }catch(err){
    setStatus('Ошибка чтения VE');
    setDebug(String(err));
    veOld = null;
  }
});

document.getElementById('calc').addEventListener('click', ()=>{
  if(!logData || !veOld){ setStatus('Нужно загрузить лог и VE'); return; }
  // read options
  const minC = Number(document.getElementById('minCorr').value)/100;
  const maxC = Number(document.getElementById('maxCorr').value)/100;
  const minRPM = Number(document.getElementById('minRpm').value);
  const maxRPM = Number(document.getElementById('maxRpm').value);

  setStatus('Вычисляем...');
  try{
    result = calculateVE(logData, veOld, { minCorr, maxCorr, minRPM, maxRPM });
    setStatus('Готово — показаны таблицы ниже');
    renderResult(result);
    document.getElementById('export').disabled = false;
    setDebug(`Средний коэффициент (без лимита): ${result.avgFactor?.toFixed(3) || '—'}`);
  }catch(err){
    setStatus('Ошибка расчёта');
    setDebug(String(err));
  }
});

document.getElementById('export').addEventListener('click', ()=>{
  if(!result) return;
  exportRomRaider(result.VE_new);
  setStatus('Экспорт выполнен');
});

function renderResult(data){
  outEl.innerHTML = '';
  const addTable = (title, m) => {
    const h = document.createElement('h3'); h.textContent = title; outEl.appendChild(h);
    const table = document.createElement('table');
    m.forEach(row=>{
      const tr = document.createElement('tr');
      row.forEach(cell=>{
        const td = document.createElement('td');
        td.textContent = (typeof cell === 'number')?cell.toFixed(2):cell;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    outEl.appendChild(table);
  };
  addTable('Original VE', data.VE_old);
  addTable('Correction %', data.Correction);
  addTable('New VE (smoothed)', data.VE_new);
}
