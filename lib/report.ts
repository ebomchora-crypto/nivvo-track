import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregate, diasBons, NAO_ATRIBUIDA, type Level, type Metric, type OrderRow, type SpendRow } from "./metrics";
import { evaluateSignal, type SignalResult } from "./signals";
import { diagnoseFunnel, type FunnelDiagnosis } from "./funnel";
import { rulesFromRow, type Rules } from "./rules";
import { addDays, dayInSP, startOfDaySP } from "./format";

export interface Filters { from: string; to: string; conta?: string; plataforma?: string; produto?: string }
export interface ReportData {
  rules: Rules; spend: SpendRow[]; orders: OrderRow[];
  accounts: { id: string; nome: string | null; external_id: string }[];
  products: { id: string; nome: string; plataforma: string; margem_liquida: number }[];
  plataformas: string[]; lastIncrease: Record<string, number>;
}
export interface ReportRow extends Metric { signal: SignalResult | null; funil: FunnelDiagnosis; maxCpa: number }

async function fetchAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i, i + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Carrega dados já filtrados. `userId` é filtrado explicitamente (necessário com service role; redundante com RLS). */
export async function loadReportData(db: SupabaseClient, userId: string, f: Filters): Promise<ReportData> {
  const [{ data: rulesRow }, { data: accounts }, { data: products }] = await Promise.all([
    db.from("rules_config").select("*").eq("user_id", userId).maybeSingle(),
    db.from("accounts").select("id,nome,external_id,moeda,cambio_para_brl").eq("user_id", userId),
    db.from("products").select("id,nome,plataforma,margem_liquida").eq("user_id", userId),
  ]);
  const rules = rulesFromRow(rulesRow);
  const accMap = new Map((accounts ?? []).map((a: any) => [a.id, a]));

  const rawSpend = await fetchAll<any>((a, b) => {
    let q = db.from("ad_spend_daily").select("*").eq("user_id", userId).gte("data", f.from).lte("data", f.to);
    if (f.conta) q = q.eq("account_id", f.conta);
    return q.order("data").range(a, b);
  });
  const spend: SpendRow[] = rawSpend.map((s) => {
    const acc: any = accMap.get(s.account_id);
    const fx = acc && acc.moeda !== "BRL" ? Number(acc.cambio_para_brl) : 1;
    return { ...s, gasto: Number(s.gasto) * fx, impressoes: Number(s.impressoes), cliques_link: Number(s.cliques_link), checkouts_iniciados: Number(s.checkouts_iniciados) };
  });

  const start = startOfDaySP(f.from).toISOString(), end = startOfDaySP(addDays(f.to, 1)).toISOString();
  const rawOrders = await fetchAll<any>((a, b) => {
    let q = db.from("orders")
      .select("data_pedido,status,valor_liquido,plataforma,product_id,products(margem_liquida),order_utm(campaign_id,adset_id,ad_id)")
      .eq("user_id", userId).gte("data_pedido", start).lt("data_pedido", end);
    if (f.plataforma) q = q.eq("plataforma", f.plataforma);
    if (f.produto) q = q.eq("product_id", f.produto);
    return q.order("data_pedido").range(a, b);
  });
  const accountCampaigns = f.conta ? new Set(spend.map((s) => s.campaign_id)) : null;
  const orders: OrderRow[] = rawOrders.map((o) => {
    const u = Array.isArray(o.order_utm) ? o.order_utm[0] : o.order_utm;
    const p = Array.isArray(o.products) ? o.products[0] : o.products;
    return {
      dia: dayInSP(o.data_pedido), status: o.status, valor_liquido: Number(o.valor_liquido),
      campaign_id: u?.campaign_id ?? null, adset_id: u?.adset_id ?? null, ad_id: u?.ad_id ?? null,
      margem: p?.margem_liquida != null ? Number(p.margem_liquida) : null,
    };
  }).filter((o) => !accountCampaigns || (o.campaign_id && accountCampaigns.has(o.campaign_id)));

  const { data: acts } = await db.from("actions_log").select("entidade_id,criado_em")
    .eq("user_id", userId).eq("acao", "aumentar").eq("sucesso", true).order("criado_em", { ascending: false }).limit(500);
  const lastIncrease: Record<string, number> = {};
  for (const a of acts ?? []) if (!(a.entidade_id in lastIncrease)) lastIncrease[a.entidade_id] = new Date(a.criado_em).getTime();

  const { data: plats } = await db.from("platform_connections").select("plataforma").eq("user_id", userId);
  return {
    rules, spend, orders, accounts: (accounts ?? []) as any, products: (products ?? []) as any,
    plataformas: [...new Set((plats ?? []).map((p: any) => p.plataforma))], lastIncrease,
  };
}

export function buildRows(data: ReportData, level: Level, now = new Date()): ReportRow[] {
  const { rules } = data;
  return aggregate(level, data.spend, data.orders).map((m) => {
    const maxCpa = m.margemMedia ?? rules.margem_padrao;
    const funil = diagnoseFunnel({ impressoes: m.impressoes, cliques: m.cliques, checkouts: m.checkouts, vendas: m.vendas }, rules);
    if (m.id === NAO_ATRIBUIDA || !m.primeiroDia) return { ...m, signal: null, funil: null, maxCpa };
    const last = data.lastIncrease[m.id];
    const signal = evaluateSignal({
      gasto: m.gasto, vendas: m.vendas, receita: m.receita, maxCpa,
      ageHours: (now.getTime() - startOfDaySP(m.primeiroDia).getTime()) / 36e5,
      diasBons: diasBons(m, rules.escale_cpa_pct * maxCpa),
      horasDesdeUltimoAumento: last ? (now.getTime() - last) / 36e5 : null,
    }, rules);
    return { ...m, signal, funil, maxCpa };
  });
}
