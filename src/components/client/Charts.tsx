"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRouter } from "next/navigation";
const COLORS = ["#2563eb", "#06b6d4", "#7c3aed", "#f59e0b", "#ef4444", "#10b981", "#64748b", "#ec4899"];

export function BarChartC({ data, height = 260, horizontal, money, links }: { data: { name: string; value: number; value2?: number }[]; height?: number; horizontal?: boolean; money?: boolean; links?: string[] }) {
  const router = useRouter();
  const fmt = (v: number) => (money ? "₹" + Math.round(v).toLocaleString("en-IN") : v.toLocaleString("en-IN"));
  if (!data.length || data.every((d) => !d.value)) return <p className="py-8 text-center text-sm text-ink-500">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 10 : 0, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        {horizontal ? <><XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={fmt} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} /></>
          : <><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={70} /><YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} /></>}
        <Tooltip formatter={(v: any) => fmt(Number(v))} />
        <Bar dataKey="value" fill="#2563eb" radius={4} cursor={links ? "pointer" : undefined} onClick={(_: any, i: number) => links?.[i] && router.push(links[i])} />
        {data.some((d) => d.value2 != null) && <Bar dataKey="value2" fill="#06b6d4" radius={4} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieC({ data, height = 240, links }: { data: { name: string; value: number }[]; height?: number; links?: string[] }) {
  const router = useRouter();
  if (!data.length || data.every((d) => !d.value)) return <p className="py-8 text-center text-sm text-ink-500">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2} onClick={(_: any, i: number) => links?.[i] && router.push(links[i])} cursor={links ? "pointer" : undefined}>
        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
    </ResponsiveContainer>
  );
}

export function LineC({ data, height = 240 }: { data: { name: string; value: number; value2?: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
        <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="value2" stroke="#7c3aed" strokeWidth={2} dot={false} /></LineChart>
    </ResponsiveContainer>
  );
}
