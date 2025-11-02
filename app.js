// В функции renderResult замените эту часть:
function renderResult(data) {
  const out = document.getElementById('output');
  out.innerHTML = '';
  
  // Добавляем статистику по точкам данных (только если есть DataPoints)
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
        td.textContent = (typeof cell === 'number') ? cell.toFixed(2) : cell;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    card.appendChild(table);
    out.appendChild(card);
  });
}
