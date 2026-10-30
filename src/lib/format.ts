export const inr = (n: number | null | undefined, opts: { compact?: boolean } = {}) => {
  if (n == null || Number.isNaN(n)) return "—";
  if (opts.compact) {
    if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
    if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  }
  return "₹" + Math.round(n).toLocaleString("en-IN");
};
export const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-IN"));
export const NV = "Not publicly verified";
export const dt = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const dtt = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export const label = (s: string | null | undefined) => (s ? s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "—");
export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
