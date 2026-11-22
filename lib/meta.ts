const API = () => `https://graph.facebook.com/${process.env.META_API_VERSION ?? "v21.0"}`;

async function graph(path: string, init: RequestInit & { form?: Record<string, string> } = {}) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado");
  const { form, ...rest } = init;
  const res = await fetch(`${API()}/${path}`, {
    ...rest,
    headers: { Authorization: `Bearer ${token}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Meta HTTP ${res.status}`);
  return json;
}

export const pauseEntity = (id: string) => graph(id, { method: "POST", form: { status: "PAUSED" } });

/** Orçamento diário (em centavos da moeda da conta) de campanha ou conjunto. */
export async function increaseDailyBudget(id: string, pct: number) {
  const p = Math.min(20, pct); // trava dura: nunca mais que +20%
  const cur = await graph(`${id}?fields=daily_budget,lifetime_budget,name`);
  const budget = Number(cur.daily_budget);
  if (!budget) throw new Error("Esta entidade não tem orçamento diário próprio (CBO na campanha ou orçamento vitalício). Ajuste onde o orçamento está definido.");
  const next = Math.round(budget * (1 + p / 100));
  await graph(id, { method: "POST", form: { daily_budget: String(next) } });
  return { de: budget, para: next, pct: p };
}
