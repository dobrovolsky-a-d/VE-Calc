export function parseVE(text) {

  const lines = text.trim().split("\n");

  const table = lines.map(l =>
    l.trim().split(/[\s,]+/).map(Number)
  );

  // первая строка — RPM axis (без первого элемента)
  const rpmAxis = table[0].slice(1);

  // первый столбец — load axis (psi)
  const loadAxis = table.slice(1).map(r => r[0]);

  // сама VE таблица
  const values = table.slice(1).map(r => r.slice(1));

  return {
    rows: values.length,
    cols: values[0].length,
    values: values,
    rpmAxis: rpmAxis,
    loadAxis: loadAxis
  };
}
