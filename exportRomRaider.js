export function exportRomRaider(matrix){
  const csv = matrix.map(r => r.map(v=>Number.isFinite(v)?v.toFixed(2):'').join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'VE_new.csv';
  a.click();
}

