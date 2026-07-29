"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { fontSize: 11, fill: "#94A3B8" };
const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 12px -2px rgba(15,23,42,0.10)",
  fontSize: 12,
};

export function SourcingAreaChart({ data }: { data: { jour: string; n: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FB6D4C" stopOpacity={0.26} />
            <stop offset="100%" stopColor="#FB6D4C" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#ECE6DB" vertical={false} />
        <XAxis dataKey="jour" tick={AXIS} tickLine={false} axisLine={false} interval={1} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#20223D", fontWeight: 600 }} />
        <Area type="monotone" dataKey="n" name="Candidats" stroke="#FB6D4C" strokeWidth={2.4} fill="url(#gArea)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  linkedin: "#FB6D4C",
  indeed: "#0EA5A0",
  apec: "#7C3AED",
  wttj: "#D97706",
};

export function SourceBarChart({ data }: { data: { source: string; n: number }[] }) {
  const rows = data.map((d) => ({
    ...d,
    label: d.source.charAt(0).toUpperCase() + d.source.slice(1),
    fill: SOURCE_COLORS[d.source] ?? "#94A3B8",
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#F1F5F9" }} />
        <Bar dataKey="n" name="Candidats" radius={[6, 6, 0, 0]} maxBarSize={54}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
