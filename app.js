import { parseLog } from "./parseLog.js";
import { parseVE } from "./parseVE.js";
import { calculateVE } from "./veMath.js";
import { exportRomRaider } from "./exportRomRaider.js";

let logData = null;
let veOld = null;
let result = null;

function setStatus(id, html, color) {
  const el = document.getElementById(id);
  if (el) { 
    el.innerHTML = html; 
    if (color) el.style.color = color; 
  }
}

function setDebug(txt) {
  const d = document.getElementById('debugLog');
  if (d) d.textContent = txt;
  console.log('DEBUG:', txt);
}

async function handleLogFile(file) {
  console.log('🟢 Starting log file processing...', file.name);
  setStatus('statusLog','⏳ Чтение лога...','var(--muted)');
  
  try {
    const parsed = await parseLog(file);
    logData = parsed;
    console.log('✅ Log parsed successfully:', logData.length, 'points');
    setStatus('statusLog', `✅ Log: ${logData.length} строк`, '#7BE495');
    
    // Показываем пример данных
    const sample = logData.slice(0, 3).map(p => `${p.rpm}RPM/${p.map}PSI/${p.afr}AFR`).join(', ');
    setDebug(`Загружено: ${logData.length} точек\nПример: ${sample}\nRPM: ${Math.min(...logData.map(p => p.rpm))}-${Math.max(...logData.map(p => p.rpm))}\nMAP: ${Math.min(...logData.map(p => p.map))}-${Math.max(...logData.map(p => p.map))} PSI`);
    
  } catch (err) {
    console.error('❌ Log parsing error:', err);
    setStatus('statusLog', `❌ Ошибка: ${err.message}`, '#ff6b6b');
    setDebug('Ошибка лога: ' + err.message + '\n' + (err.stack || ''));
  }
}

async function handleVEFile(file) {
  console.log('🟢 Starting VE file processing...', file.name);
  setStatus('statusVE','⏳ Чтение VE...','var(--muted)');
  
  try {
    const parsed = await parseVE(file);
    veOld = parsed;
    console.log('✅ VE parsed successfully:', veOld.rows + 'x' + veOld.cols);
    setStatus('statusVE', `✅ VE: ${veOld.rows}x${veOld.cols}`, '#7BE495');
    
    setDebug((document.getElementById('debugLog').textContent || '') + 
             `\nVE: ${veOld.rows}x${veOld.cols}\nRPM: ${veOld.rpmAxis?.join(', ')}\nMAP: ${veOld.mapAxis?.join(', ')} PSI`);
    
  } catch (err) {
    console.error('❌ VE parsing error:', err);
    setStatus('statusVE', `❌ Ошибка: ${err.message}`, '#ff6b6b');
    setDebug('Ошибка VE: ' + err.message + '\n' + (err.stack || ''));
  }
}

// Проверяем что элементы существуют
console.log('🟢 Initializing app...');
console.log('Log input:', document.getElementById('loadLog'));
console.log('VE input:', document.getElementById('loadVE'));

const logInput = document.getElementById('loadLog');
const veInput = document.getElementById('loadVE');

if (!logInput || !veInput) {
  console.error('❌ Critical: Input elements not found!');
  setDebug('ERROR: Input elements not found! Check HTML structure.');
} else {
  logInput.addEventListener('change', (e) => { 
    console.log('📁 Log file selected:', e.target.files[0]);
    if(e.target.files[0]) handleLogFile(e.target.files[0]); 
  });
  
  veInput.addEventListener('change', (e) => { 
    console.log('📁 VE file selected:', e.target.files[0]);
    if(e.target.files[0]) handleVEFile(e.target.files[0]); 
  });

  console.log('✅ Event listeners attached');
}

document.getElementById('calculate').addEventListener('click', () => {
  console.log('🧮 Calculate button clicked');
  console.log('Current state - logData:', logData, 'veOld:', veOld);
  
  if (!logData || !veOld) {
    const msg = '⚠️ Загрузите лог и VE таблицу';
    console.warn(msg);
    setStatus('statusCalc', msg, 'orange');
    return;
  }
  
  setStatus('statusCalc','⚙️ Рассчитываем...','var(--muted)');
  console.log('Starting calculation...');
  
  setTimeout(() => {
    try {
      result = calculateVE(logData, veOld);
      console.log('✅ Calculation completed successfully');
      setStatus('statusCalc','✅ Расчёт завершён','#7BE495');
      renderResult(result);
      
      const ex = document.getElementById('export');
      if (ex) { 
        ex.disabled = false; 
        ex.classList.remove('disabled'); 
        console.log('✅ Export button enabled');
      }
    } catch (err) {
      console.error('❌ Calculation error:', err);
      setStatus('statusCalc',`❌ Ошибка: ${err.message}`,'#ff6b6b');
      setDebug('Ошибка расчета: ' + err.message + '\nStack: ' + (err.stack || 'нет'));
    }
  }, 100);
});

document.getElementById('export').addEventListener('click', () => {
  console.log('💾 Export button clicked');
  if (!result || !result.VE_new) {
    setStatus('statusCalc','⚠️ Нет данных для экспорта','orange');
    return;
  }
  exportRomRaider(result.VE_new);
  setStatus('statusCalc','✅ Экспортирован VE_new.csv','#7BE495');
});

function renderResult(data) {
  console.log('📊 Rendering results...');
  const out = document.getElementById('output');
  if (!out) {
    console.error('❌ Output element not found!');
    return;
  }
  
  out.innerHTML = '';
  
  // Добавляем статистику
  if (data.DataPoints) {
    const flatData = data.DataPoints.flat().filter(val => val > 0);
    if (flatData.length > 0) {
      const statsCard = document.createElement('div');
      statsCard.className = 'card';
      statsCard.innerHTML = `<h3>📊 Статистика данных</h3><p>Точек данных на ячейку: min ${Math.min(...flatData)}, max ${Math.max(...flatData)}</p>`;
      out.appendChild(statsCard);
    }
  }
  
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
        td.textContent = (typeof cell === 'number') ? cell.toFixed(1) : cell;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    card.appendChild(table);
    out.appendChild(card);
  });
  
  console.log('✅ Results rendered');
}

console.log('🚀 App initialized successfully');
setDebug('Приложение загружено. Выберите файлы для начала работы.');
