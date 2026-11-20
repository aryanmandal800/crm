if (typeof process !== "undefined" && process.env) {
  process.env.TZ = "Asia/Kolkata";
}

export const INDIAN_TIMEZONE = "Asia/Kolkata";

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

// Indian Standard Time (IST) Date string (e.g. "20 Nov 2026")
export const dt = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: INDIAN_TIMEZONE,
      })
    : "—";

// Indian Standard Time (IST) Date + Time string (e.g. "20 Nov 2026, 05:30 pm")
export const dtt = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: INDIAN_TIMEZONE,
      })
    : "—";

// Indian Standard Time (IST) Time-only string (e.g. "05:30 pm")
export const tm = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: INDIAN_TIMEZONE,
      })
    : "—";

// Returns current date string strictly in Indian Standard Time (Asia/Kolkata) as "YYYY-MM-DD"
export const getIndianTodayStr = (d: Date | string = new Date()): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
};

export const label = (s: string | null | undefined) =>
  s ? s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "—";

// Returns start of day (00:00:00.000) in Indian Standard Time (Asia/Kolkata)
export const startOfDay = (d: Date | string = new Date()): Date => {
  const str = getIndianTodayStr(d);
  return new Date(`${str}T00:00:00+05:30`);
};

// Returns end of day (23:59:59.999) in Indian Standard Time (Asia/Kolkata)
export const endOfDay = (d: Date | string = new Date()): Date => {
  const str = getIndianTodayStr(d);
  return new Date(`${str}T23:59:59.999+05:30`);
};

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Parse a date or datetime string with IST (+05:30) offset if no timezone specified
export const parseIndianDate = (v: string | null | undefined): Date | null => {
  if (!v || v.trim() === "") return null;
  const trimmed = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00+05:30`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const withSec = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    return new Date(`${withSec}+05:30`);
  }
  return new Date(trimmed);
};
