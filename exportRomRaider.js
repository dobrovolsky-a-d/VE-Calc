export function exportRomRaider(matrix) {

  const rows = matrix.map(row =>
    row
      .map(v => Number(v).toFixed(2))
      .join("\t")
  );

  const content = rows.join("\n");

  const blob = new Blob([content], { type: "text/plain" });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "VE_new.txt";

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
