import ExcelJS from "exceljs";

export type Sheet = { name: string; rows: Record<string, unknown>[] };

const cell = (v: unknown) => (v instanceof Date ? v : Array.isArray(v) ? v.join(", ") : v != null && typeof v === "object" ? JSON.stringify(v) : v);

export async function toXlsx(sheets: Sheet[], meta: string) {
  const wb = new ExcelJS.Workbook(); wb.creator = "Fivopay CRM"; wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    const cols = s.rows.length ? Object.keys(s.rows[0]) : ["(no data)"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(45, Math.max(12, c.length + 2)) }));
    s.rows.forEach((r) => ws.addRow(Object.fromEntries(cols.map((c) => [c, cell(r[c])]))));
    ws.getRow(1).font = { bold: true }; ws.views = [{ state: "frozen", ySplit: 1 }];
    if (s.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }
  const info = wb.addWorksheet("About"); info.addRow([meta]); info.addRow(["Generated", new Date().toISOString()]);
  info.addRow(["Note", "Blank fields = Not publicly verified. Scores, categories and prices are recommendations, not facts."]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => { const c = cell(v); const s = c instanceof Date ? c.toISOString() : c == null ? "" : String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : /^[=+\-@]/.test(s) ? `'${s}` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
