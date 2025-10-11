import { parseLog } from './utils/parseLog.js';
import { parseVE } from './utils/parseVE.js';
import { calculateVE } from './utils/veMath.js';
import { exportRomRaider } from './utils/exportRomRaider.js';

let logData = [];
let veOld = null;
let result = null;

const output = document.getElementById('output');
const exportBtn = document.getElementById('export');

document.getElementById('loadLog').addEventListener('change', async (e) => {
  logData = await parseLog(e.target.files[0]);
  output.innerHTML = `<p>✅ Log loaded (${logData.length} rows)</p>`;
});

document.getElementById('loadVE').addEventListener('change', async (e) => {
  veOld = await parseVE(e.target.files[0]);
  output.innerHTML += `<p>✅ VE Table loaded (${veOld.rows}x${veOld.cols})</p>`;
});

document.getElementById('calculate').addEventListener('click', () => {
  if (!logData.length || !veOld) {
    output.innerHTML = `<p class="placeholder">❗ Загрузите лог и VE таблицу сначала.</p>`;
    return;
  }
  result = calculateVE(logData, veOld);
  renderTables(result);
  exportBtn.disabled = false;
});

exportBtn.addEventListener('click', () => {
  exportRomRaider(result.VE_new);
});

function renderTables(data) {
  const { VE_old, VE_new, Correction } = data;

  const makeTable = (matrix, title) => {
    let html = `<table><caption>${title}</caption>`;
    matrix.forEach(row => {
      html += '<tr>' + row.map(v => `<td>${v.toFixed(1)}</td>`).join('') + '</tr>';
    });
    html += '</table>';
    return html;
  };

  output.innerHTML = `
    <div class="table-block">${makeTable(VE_old, 'VE Old')}</div>
    <div class="table-block">${makeTable(VE_new, 'VE New')}</div>
    <div class="table-block">${makeTable(Correction, 'Correction %')}</div>
  `;
}
