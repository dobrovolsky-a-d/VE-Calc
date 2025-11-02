export async function parseLog(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length < 2) throw new Error('Log file is empty or too short');

  const sep = detectSeparator(lines[0]);
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

  console.log('Log headers:', headers);

  // Simple column detection - adjust based on your actual CSV
  const rpmIndex = headers.findIndex(h => h.includes('rpm'));
  const mapIndex = headers.findIndex(h => h.includes('map') || h.includes('pressure'));
  const afrIndex = headers.findIndex(h => h.includes('afr') || h.includes('wideband'));
  const targetIndex = headers.findIndex(h => h.includes('target'));

  console.log('Column indices - RPM:', rpmIndex, 'MAP:', mapIndex, 'AFR:', afrIndex, 'Target:', targetIndex);

  if (rpmIndex === -1 || mapIndex === -1 || afrIndex === -1) {
    throw new Error('Required columns not found. Available: ' + headers.join(', '));
  }

  const out = [];
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.trim());
    if (parts.length < Math.max(rpmIndex, mapIndex, afrIndex) + 1) continue;

    const rpm = parseFloat(parts[rpmIndex]);
    let mapVal = parseFloat(parts[mapIndex]);
    const afr = parseFloat(parts[afrIndex]);
    
    // Auto-detect MAP units
    if (mapVal < 5) mapVal *= 100; // bar to kPa
    else if (mapVal > 200) mapVal /= 10; // hPa to kPa

    // Basic validation
    if (isNaN(rpm) || isNaN(mapVal) || isNaN(afr)) continue;
    if (rpm < 300 || rpm > 8000 || mapVal < 10 || mapVal > 300 || afr < 8 || afr > 22) continue;

    // AFR target (optional)
    let afrTarget = 14.7;
    if (targetIndex !== -1) {
      const targetVal = parseFloat(parts[targetIndex]);
      if (!isNaN(targetVal) && targetVal >= 8 && targetVal <= 22) {
        afrTarget = targetVal;
      }
    }

    out.push({ 
      rpm: Math.round(rpm), 
      map: Math.round(mapVal * 10) / 10, 
      afr: Math.round(afr * 100) / 100, 
      afrTarget: Math.round(afrTarget * 100) / 100 
    });
  }

  if (out.length === 0) throw new Error('No valid data points found after filtering');

  console.log('Successfully parsed', out.length, 'log entries');
  return out;
}

function detectSeparator(line) {
  if (line.includes(';')) return ';';
  if (line.includes('\t')) return '\t';
  return ',';
}
