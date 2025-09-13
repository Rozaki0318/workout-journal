export const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

// 今は仮ユーザー。認証導入後に置き換え予定。
export const USER_ID = "demo";

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { "x-user-id": USER_ID, accept: "application/json" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json();
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "x-user-id": USER_ID,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`POST ${path} -> ${r.status}`);
  return r.json();
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { "x-user-id": USER_ID, accept: "application/json" },
  });
  if (!r.ok) throw new Error(`DELETE ${path} -> ${r.status}`);
  // 204対策：bodyが無いこともある
  try { return (await r.json()) as T; } catch { return {} as T; }
}

