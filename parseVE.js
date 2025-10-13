function parseVEFile(content) {
    const lines = content.trim().split(/\r?\n/).filter(line => line.trim() !== "");

    const veTable = [];
    let headers = [];

    lines.forEach((line, index) => {
        const cols = line.split(/[,;\t]/).map(v => v.trim()).filter(v => v !== "");
        if (index === 0) {
            // первая строка — MAP ось
            headers = cols.map(v => parseFloat(v));
        } else {
            const rowRPM = parseFloat(cols[0]);
            const rowData = cols.slice(1).map(v => parseFloat(v));
            veTable.push([rowRPM, ...rowData]);
        }
    });

    if (veTable.length === 0) throw new Error("VE table appears empty or invalid format.");

    return { headers, veTable };
}
