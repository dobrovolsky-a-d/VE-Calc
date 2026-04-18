export async function parseLog(file) {

  const text = await file.text();
  const lines = text.split("\n");

  const header = lines[0].split(",");

  const rpmIndex = header.indexOf("Engine Speed (rpm)");
  const mapIndex = header.indexOf("Manifold Relative Pressure (bar)");
  const afrIndex = header.indexOf("A/F Sensor #1");
  const targetIndex = header.indexOf("AF Correction Target");

  if (rpmIndex === -1 || mapIndex === -1 || afrIndex === -1 || targetIndex === -1) {
    throw new Error("Missing required columns");
  }

  const result = [];

  for (let i = 1; i < lines.length; i++) {

    const row = lines[i].split(",");

    const rpm = parseFloat(row[rpmIndex]);
    const map = parseFloat(row[mapIndex]);
    const afr = parseFloat(row[afrIndex]);
    const afrTarget = parseFloat(row[targetIndex]);

    if (isNaN(rpm) || isNaN(map) || isNaN(afr) || isNaN(afrTarget)) continue;

    result.push({ rpm, map, afr, afrTarget });
  }

  return result;
}
