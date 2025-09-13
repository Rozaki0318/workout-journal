"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import SessionChart, { SetItem as ChartSetItem } from "@/components/session-chart";
import { apiDelete } from "@/lib/api";
import { Trash2 } from "lucide-react";

type Session = {
  sessionId: string;
  createdAt: number;
  lastUpdatedAt?: number;
  setCount?: number;
  note?: string;
};
type SetItem = { seq: number; weight: number; reps: number; note?: string; createdAt: number };

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sid, setSid] = useState<string>("");
  const [sets, setSets] = useState<SetItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [note, setNote] = useState("");
  const [weight, setWeight] = useState<string>("");
  const [reps, setReps] = useState<string>("");

  const currentSession = useMemo(
    () => sessions.find((s) => s.sessionId === sid),
    [sessions, sid]
  );

  // 初回：最新セッション一覧
  useEffect(() => {
    (async () => {
      try {
        const j = await apiGet<{ items: Session[] }>("/sessions?limit=10");
        setSessions(j.items ?? []);
        if ((j.items ?? []).length && !sid) setSid(j.items[0].sessionId);
      } catch {
        toast.error("セッション取得に失敗しました");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // セッション選択 → セット一覧
  useEffect(() => {
    if (!sid) return;
    (async () => {
      try {
        const j = await apiGet<{ items: SetItem[] }>(`/sessions/${sid}/sets?limit=50`);
        setSets(j.items ?? []);
      } catch {
        toast.error("セット取得に失敗しました");
      }
    })();
  }, [sid]);

  const createSession = async () => {
    setLoading(true);
    try {
      const j = await apiPost<{ sessionId: string; createdAt: number }>("/sessions", { note });
      const newSess: Session = { sessionId: j.sessionId, createdAt: j.createdAt, note, setCount: 0 };
      setSessions((prev) => [newSess, ...prev]);
      setSid(j.sessionId);
      setNote("");
      toast.success("セッションを作成しました");
    } catch {
      toast.error("セッション作成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const addSet = async () => {
    if (!sid) return;
    const w = Number(weight), r = Number(reps);
    if (!Number.isFinite(w) || !Number.isInteger(r)) {
      toast.warning("weight は数値、reps は整数で入力してください");
      return;
    }
    setLoading(true);
    try {
      await apiPost(`/sessions/${sid}/sets`, { weight: w, reps: r, note: note || "" });
      const j = await apiGet<{ items: SetItem[] }>(`/sessions/${sid}/sets?limit=50`);
      setSets(j.items ?? []);
      setWeight(""); setReps("");
      toast.success("セットを追加しました");
    } catch {
      toast.error("セット追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const deleteSet = async (seq: number) => {
    if (!sid) return;
    if (!confirm(`セット #${seq} を削除しますか？`)) return;
    try {
      await apiDelete(`/sessions/${sid}/sets/${seq}`);
      const j = await apiGet<{ items: SetItem[] }>(`/sessions/${sid}/sets?limit=50`);
      setSets(j.items ?? []);
      // 親の setCount も再取得したい場合は sessions も更新する or 再フェッチ
      toast.success(`セット #${seq} を削除しました`);
    } catch {
      toast.error("セット削除に失敗しました");
    }
  };  

  const deleteSession = async () => {
    if (!sid) return;
    if (!confirm(`セッション ${sid} を削除しますか？（中のセットも削除されます）`)) return;
    try {
      await apiDelete(`/sessions/${sid}`);
      // sessions から取り除き、次のセッションを選択
      setSessions(prev => prev.filter(s => s.sessionId !== sid));
      setSets([]);
      const next = sessions.find(s => s.sessionId !== sid);
      setSid(next?.sessionId ?? "");
      toast.success(`セッション ${sid} を削除しました`);
    } catch {
      toast.error("セッション削除に失敗しました");
    }
  };

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Workout Journal</h1>
          <a
            className="text-sm underline opacity-80 hover:opacity-100"
            href={API_BASE}
            target="_blank"
          >
            Open API
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* セッション作成 */}
          <Card>
            <CardHeader>
              <CardTitle>新しいセッション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="note">メモ（任意）</Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="胸トレ など"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createSession} disabled={loading}>
                  {loading ? "Creating..." : "Create session"}
                </Button>
                <Button variant="destructive" onClick={deleteSession} disabled={!sid}>
                  Delete session
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* セッション選択 */}
          <Card>
            <CardHeader>
              <CardTitle>セッション選択</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={sid} onValueChange={setSid}>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.sessionId} value={s.sessionId}>
                      {s.note ? `${s.note}` : ""}
                      <span className="opacity-70">({s.sessionId})</span>
                      {new Date((s.lastUpdatedAt ?? s.createdAt) * 1000).toLocaleString()} /{" "}
                      {s.setCount ?? 0} sets）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!sessions.length && (
                <p className="text-sm text-muted-foreground">
                  セッションがありません。左で作成してください。
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* セット追加 */}
        <Card>
          <CardHeader>
            <CardTitle>セット追加 {sid ? `(#${sid})` : ""}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="weight">weight</Label>
                <Input
                  id="weight"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="例: 42.5"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reps">reps</Label>
                <Input
                  id="reps"
                  inputMode="numeric"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="例: 10"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addSet} disabled={loading || !sid} className="w-full">
                  {loading ? "Adding..." : "Add set"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              メモ（任意）はセッション作成時のものを利用中。必要なら拡張しましょう。
            </p>
          </CardContent>
        </Card>

        {/* セット一覧 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Sets{currentSession?.note ? ` - ${currentSession.note}` : ""}</span>
              {currentSession && (
                <span className="text-xs text-muted-foreground">
                  updated: {new Date((currentSession.lastUpdatedAt ?? currentSession.createdAt) * 1000).toLocaleString()}
                </span>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* 1) グラフ（seq順で weight/reps を可視化） */}
            <SessionChart sets={sets as ChartSetItem[]} />

            {/* 2) セット一覧（新しい→古いの順で表示されている前提） */}
            {sets.length ? (
              <ul>
                {sets.map((s, i) => (
                  <li key={`${s.seq}-${i}`} className="py-3">
                    <div className="flex items-baseline justify-between">
                      <div className="text-sm">
                        <span className="font-mono text-xs mr-2">#{s.seq}</span>
                        <span className="font-semibold">{s.weight}</span> kg ×{" "}
                        <span className="font-semibold">{s.reps}</span> reps
                        {s.note ? <span className="ml-2 text-muted-foreground">({s.note})</span> : null}
                      </div>

                      {/* 削除ボタン（deleteSet 関数を実装していれば有効化） */}
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.createdAt * 1000).toLocaleString()}
                        </div>
                        {/* ↓削除を使わないなら、このButtonごと消してOK */}
                        <Button variant="ghost" size="icon" onClick={() => deleteSet(s.seq)} aria-label={`delete set #${s.seq}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {i < sets.length - 1 && <Separator className="mt-3" />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">まだセットがありません。</p>
            )}
          </CardContent>
        </Card>

      </section>
    </main>
  );
}

