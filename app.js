import { parseLog } from './utils/parseLog.js';
import { parseVE } from './utils/parseVE.js';
import { calculateVE } from './utils/veMath.js';
import { exportRomRaider } from './utils/exportRomRaider.js';

let logData = [];
let veOld = {};
let result = null;

const statusLog = document.getElementById('statusLog');
const statusVE = document.getElementById('statusVE');
const statusCalc = document.getElementById('statusCalc');
const btnLog = document.getElementById('loadLog');
const btnVE = document.getElementById('loadVE');
const btnCalc = document.getElementById('calculate');
const btnExport = document.getElementById('export');
const outputDiv = document.getElementById('output');

btnLog.addEventListener('change', async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    statusLog.textContent = `⏳ Reading log...`;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const header = lines[0].split(/[,	;]/).map(h => h.trim());
    logData = await parseLog(file);

    if (!logData.length) {
      statusLog.innerHTML = `⚠️ Log loaded but no valid data found.<br>Detected headers: <code>${header.join(', ')}</code>`;
      statusLog.style.color = 'orange';
    } else {
      statusLog.innerHTML = `✅ Log loaded: ${logData.length} lines<br>Detected headers: <code>${header.join(', ')}</code>`;
      statusLog.style.color = 'limegreen';
    }
  } catch (err) {
    statusLog.textContent = `❌ Error reading log: ${err.message}`;
    statusLog.style.color = 'red';
  }
});

btnVE.addEventListener('change', async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    statusVE.textContent = `⏳ Reading VE table...`;

    veOld = await parseVE(file);

    if (!veOld.values || !veOld.values.length) {
      statusVE.textContent = `⚠️ VE table loaded but no numeric data found`;
      statusVE.style.color = 'orange';
    } else {
      statusVE.textContent = `✅ VE table loaded: ${veOld.rows}x${veOld.cols}`;
      statusVE.style.color = 'limegreen';
    }
  } catch (err) {
    statusVE.textContent = `❌ Error reading VE table: ${err.message}`;
    statusVE.style.color = 'red';
  }
});

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

btnExport.addEventListener('click', () => {
  if (!result) {
    alert('No data to export. Please calculate VE first.');
    return;
  }
  exportRomRaider(result.VE_new);
});

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

function renderTable(matrix, isCorr = false) {
  let html = '<table class="ve-table">';
  matrix.forEach(row => {
    html += '<tr>';
    row.forEach(val => {
      let color = '';
      if (isCorr) {
        if (val > 2) color = 'style="background:#3366ff33"';
        else if (val < -2) color = 'style="background:#ff333333"';
      }
      html += `<td ${color}>${isNaN(val) ? '' : val.toFixed(2)}</td>`;
    });
    html += '</tr>';
  });
  html += '</table>';
  return html;
}
