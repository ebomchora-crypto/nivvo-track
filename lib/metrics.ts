export type Level = "campaign" | "adset" | "ad";

export interface SpendRow {
  data: string; campaign_id: string; campaign_name: string | null; adset_id: string; adset_name: string | null;
  ad_id: string; ad_name: string | null; gasto: number; // já em BRL
  impressoes: number; cliques_link: number; checkouts_iniciados: number;
}
export interface OrderRow {
  dia: string; status: string; valor_liquido: number;
  campaign_id: string | null; adset_id: string | null; ad_id: string | null; margem: number | null;
}
export interface Metric {
  id: string; name: string; gasto: number; impressoes: number; cliques: number; checkouts: number;
  vendas: number; receita: number; lucro: number;
  roas: number | null; cpa: number | null; ctr: number | null; taxaCheckout: number | null;
  primeiroDia: string | null; margemMedia: number | null;
  diario: Record<string, { gasto: number; vendas: number }>;
}

export const NAO_ATRIBUIDA = "__none__";

/** Só vendas aprovadas contam; reembolso/chargeback mudam o status do pedido e saem da conta. */
export function aggregate(level: Level, spend: SpendRow[], orders: OrderRow[]): Metric[] {
  const idKey = `${level}_id` as const, nameKey = `${level}_name` as const;
  const map = new Map<string, Metric & { _margSum: number }>();
  const get = (id: string, name: string) => {
    let m = map.get(id);
    if (!m) {
      m = { id, name, gasto: 0, impressoes: 0, cliques: 0, checkouts: 0, vendas: 0, receita: 0, lucro: 0,
        roas: null, cpa: null, ctr: null, taxaCheckout: null, primeiroDia: null, margemMedia: null, diario: {}, _margSum: 0 };
      map.set(id, m);
    }
    return m;
  };
  const day = (m: Metric, d: string) => (m.diario[d] ??= { gasto: 0, vendas: 0 });

  for (const s of spend) {
    const m = get(s[idKey], (s[nameKey] as string | null) ?? s[idKey]);
    m.gasto += s.gasto; m.impressoes += s.impressoes; m.cliques += s.cliques_link; m.checkouts += s.checkouts_iniciados;
    day(m, s.data).gasto += s.gasto;
    if (!m.primeiroDia || s.data < m.primeiroDia) m.primeiroDia = s.data;
  }
  for (const o of orders) {
    if (o.status !== "aprovado") continue;
    const id = o[idKey] ?? NAO_ATRIBUIDA;
    const m = get(id, id === NAO_ATRIBUIDA ? "Não atribuída" : id);
    m.vendas += 1; m.receita += o.valor_liquido; m._margSum += o.margem ?? 0;
    day(m, o.dia).vendas += 1;
  }
  return [...map.values()].map(({ _margSum, ...m }) => ({
    ...m,
    lucro: m.receita - m.gasto,
    roas: m.gasto > 0 ? m.receita / m.gasto : null,
    cpa: m.vendas > 0 ? m.gasto / m.vendas : null,
    ctr: m.impressoes > 0 ? m.cliques / m.impressoes : null,
    taxaCheckout: m.checkouts > 0 ? m.vendas / m.checkouts : null,
    margemMedia: m.vendas > 0 && _margSum > 0 ? _margSum / m.vendas : null,
  })).sort((a, b) => b.gasto - a.gasto);
}

/** Dias em que houve venda e o custo por venda do dia ficou <= limite. */
export function diasBons(m: Metric, limiteCpa: number): number {
  return Object.values(m.diario).filter((d) => d.vendas > 0 && d.gasto / d.vendas <= limiteCpa).length;
}
