function renderResult(res) {

  output.innerHTML = "";

  renderTable("Original VE", res.VE_old);

  renderTable("Correction %", res.Correction);

  renderTable("New VE", res.VE_new, res.VE_old);

  renderCoverage("Log Coverage", res.coverage);

}

function renderTable(title, matrix, ref = null) {

  const h = document.createElement("h3");
  h.textContent = title;
  output.appendChild(h);

  const table = document.createElement("table");

  matrix.forEach((row, r) => {

    const tr = document.createElement("tr");

    row.forEach((v, c) => {

      const td = document.createElement("td");

      td.textContent = Number(v).toFixed(2);

      if (ref) {

        const diff = ((v - ref[r][c]) / ref[r][c]) * 100;

        if (diff > 3) td.style.background = "#ff6b6b";
        else if (diff > 1) td.style.background = "#ffd0d0";
        else if (diff < -3) td.style.background = "#6b8cff";
        else if (diff < -1) td.style.background = "#d0dcff";

      }

      tr.appendChild(td);

    });

    table.appendChild(tr);

  });

  output.appendChild(table);
}

function renderCoverage(title, matrix) {

  const h = document.createElement("h3");
  h.textContent = title;
  output.appendChild(h);

  const table = document.createElement("table");

  matrix.forEach(row => {

    const tr = document.createElement("tr");

    row.forEach(v => {

      const td = document.createElement("td");
      td.textContent = v;

      if (v === 0) td.style.background = "#333";
      else if (v < 3) td.style.background = "#3a6ea5";
      else if (v < 10) td.style.background = "#e6c229";
      else td.style.background = "#d62828";

      tr.appendChild(td);

    });

    table.appendChild(tr);

  });

  output.appendChild(table);
}
