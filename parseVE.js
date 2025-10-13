function parseVEFile(content) {
    const lines = content.trim().split(/\r?\n/).filter(line => line.trim() !== "");
    const dataLines = lines.filter(line => !line.toLowerCase().includes("таблица")); // пропускаем заголовок

    const veTable = [];
    let headers = [];

    dataLines.forEach((line, index) => {
        const cols = line.split(";").map(v => v.trim()).filter(v => v !== "");
        if (index === 0) {
            // первая строка — ось MAP
            headers = cols.map(v => parseFloat(v));
        } else {
            const rpm = parseFloat(cols[0]);
            const row = cols.slice(1).map(v => parseFloat(v));
            if (!isNaN(rpm) && row.length > 0) {
                veTable.push([rpm, ...row]);
            }
        }
    });

    if (veTable.length === 0) {
        throw new Error("VE table appears empty or invalid format.");
    }

    console.log("✅ Parsed VE table:", veTable.length, "rows,", veTable[0].length - 1, "columns");
    return { headers, veTable };
}
