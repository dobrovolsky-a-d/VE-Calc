export async function parseVE(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const rows = lines.length;
  const values = [];

  lines.forEach(line => {
    const nums = line.split(/[,	;]/)
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v));
    if (nums.length) values.push(nums);
  });

  return {
    values,
    rows: values.length,
    cols: values[0].length
  };
}
