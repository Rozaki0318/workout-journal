"use client";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

export type SetItem = { seq: number; weight: number; reps: number; note?: string; createdAt: number };

export default function SessionChart({ sets }: { sets: SetItem[] }) {
  const data = [...sets]
    .sort((a, b) => a.seq - b.seq)
    .map(s => ({
      seq: s.seq,
      volume: (s.weight ?? 0) * (s.reps ?? 0),   // 総重量
    }));

  if (!data.length) return <p className="text-sm text-muted-foreground">まだデータがありません。</p>;

  return (
    <div className="w-full h-60">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="seq" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="volume" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
