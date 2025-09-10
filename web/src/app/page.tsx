"use client";
import { useState } from "react";

type Ping = { ok: boolean; stage: string; path: string };

export default function Home() {
  const [data, setData] = useState<Ping | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const callPing = async () => {
    setLoading(true); setErr(null); setData(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/ping`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) { setErr(e.message ?? "unknown error"); }
    finally { setLoading(false); }
  };

  return (
    <main className="min-h-dvh bg-gray-50 text-gray-900">
      <section className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-3xl font-bold">Workout Journal (web)</h1>
        <p className="mt-2 text-gray-600">下のボタンで <code>/ping</code> を呼びます。</p>

        <div className="mt-6 flex gap-3">
          <button onClick={callPing} disabled={loading}
            className="rounded-2xl px-5 py-2.5 bg-black text-white disabled:opacity-50 hover:opacity-90">
            {loading ? "Loading..." : "Call /ping"}
          </button>
        </div>

        {err && <div className="mt-6 text-red-600">Error: {err}</div>}
        {data && <pre className="mt-4 bg-white p-4 rounded">{JSON.stringify(data, null, 2)}</pre>}
      </section>
    </main>
  );
}

