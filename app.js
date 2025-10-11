import { parseLog } from './utils/parseLog.js';
import { parseVE } from './utils/parseVE.js';
import { calculateVE } from './utils/veMath.js';
import { exportRomRaider } from './utils/exportRomRaider.js';

let logData = [];
let veOld = {};
let result = null;

// ====== UI элементы ======
const statusLog = document.getElementById('statusLog');
const statusVE = document.getElementById('statusVE');
const statusCalc = document.getElementById('statusCalc');
const btnLog = document.getElementById('loadLog');
const btnVE = document.getElementById('loadVE');
const btnCalc = document.getElementById('calculate');
const btnExport = document.getElementById('export');
const outputDiv = document.getElementById('output');

// ====== Загрузка лога ======
btnLog.addEventListener('change', async (e) => {
  try {
    logData = await parseLog(e.target.files[0]);
    statusLog.textContent = `✅ Log loaded: ${logData.length} lines`;
    statusLog.style.color = 'limegreen';
  } catch (err) {
    statusLog.textContent = `❌ Error reading log: ${err.message}`;
    statusLog.style.color = 'red';
  }
});

// ====== Загрузка VE таблицы ======
btnVE.addEventListener('change', async (e) => {
  try {
    veOld = await parseVE(e.target.files[0]);
    statusVE.textContent = `✅ VE table loaded: ${veOld.rows}x${veOld.cols}`;
    statusVE.style.color = 'limegreen';
  } catch (err) {
    statusVE.textContent = `❌ Error reading VE table: ${err.message}`;
    statusVE.style.color = 'red';
  }
});

// ====== Калькуляция ======
btnCalc.addEventListener('click', () => {
  try {
    if (!logData.length || !veOld.values) {
      throw new Error('Missing log or VE table');
    }

    statusCalc.textContent = '⚙️ Calculating...';
    statusCalc.style.color = 'orange';
    outputDiv.innerHTML = '';

    result = calculateVE(logData, veOld);
    if (!result || !result.VE_new) throw new Error('Calculation failed');

    const filledCells = result.VE_new.flat().filter(v => v !== 0).length;
    statusCalc.textContent = `✅ Calculation complete (${filledCells} cells updated)`;
    statusCalc.style.color = 'limegreen';

    showTables(result);
  } catch (err) {
    statusCalc.textContent = `❌ Error: ${err.message}`;
    statusCalc.style.color = 'red';
  }
});

// ====== Экспорт ======
btnExport.addEventListener('click', () => {
  if (!result) {
    alert('No data to export. Please calculate VE first.');
    return;
  }
  exportRomRaider(result.VE_new);
});

// ====== Отображение таблиц ======
function showTables(result) {
  outputDiv.innerHTML = `
    <h3>Old VE</h3>
    ${renderTable(result.VE_old)}
    <h3>New VE (smoothed)</h3>
    ${renderTable(result.VE_new)}
    <h3>Correction %</h3>
    ${renderTable(result.Correction, true)}
  `;
}

// ====== Рендер таблицы ======
function renderTable(matrix, isCorr = false) {
  let html = '<table class="ve-table">';
  matrix.forEach(row => {
    html += '<tr>';
    row.forEach(val => {
      let color = '';
      if (isCorr) {
        if (val > 2) color = 'style="background:#3366ff33"'; // обеднение
        else if (val < -2) color = 'style="background:#ff333333"'; // обогащение
      }
      html += `<td ${color}>${val.toFixed(2)}</td>`;
    });
    html += '</tr>';
  });
  html += '</table>';
  return html;
}
