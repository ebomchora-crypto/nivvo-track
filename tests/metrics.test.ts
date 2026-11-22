import { describe, it, expect } from "vitest";
import { aggregate, diasBons, NAO_ATRIBUIDA, type SpendRow, type OrderRow } from "@/lib/metrics";
import { dayInSP, addDays } from "@/lib/format";

const sp = (d: string, ad: string, g: number): SpendRow => ({ data: d, campaign_id: "c1", campaign_name: "Camp", adset_id: "s1", adset_name: "Set", ad_id: ad, ad_name: "Ad " + ad, gasto: g, impressoes: 1000, cliques_link: 20, checkouts_iniciados: 5 });
const od = (status: string, ad: string | null, dia = "2026-11-20"): OrderRow => ({ dia, status, valor_liquido: 100, campaign_id: ad ? "c1" : null, adset_id: ad ? "s1" : null, ad_id: ad, margem: 100 });

describe("aggregate", () => {
  const spend = [sp("2026-11-20", "a1", 50), sp("2026-11-21", "a1", 50), sp("2026-11-21", "a2", 30)];
  const orders = [od("aprovado", "a1"), od("aprovado", "a1", "2026-11-21"), od("reembolsado", "a1"), od("chargeback", "a2"), od("pendente", "a2"), od("aprovado", null)];
  it("campanha soma anúncios e só conta aprovadas", () => {
    const [c1, none] = aggregate("campaign", spend, orders).sort((a, b) => (a.id === NAO_ATRIBUIDA ? 1 : -1));
    expect(c1.gasto).toBe(130); expect(c1.vendas).toBe(2); expect(c1.receita).toBe(200); expect(c1.lucro).toBe(70);
    expect(c1.roas).toBeCloseTo(200 / 130); expect(c1.cpa).toBe(65); expect(c1.ctr).toBeCloseTo(0.02);
    expect(c1.taxaCheckout).toBeCloseTo(2 / 15);
    expect(none.id).toBe(NAO_ATRIBUIDA); expect(none.vendas).toBe(1);
  });
  it("anúncio: reembolso/chargeback não contam", () => {
    const a2 = aggregate("ad", spend, orders).find((m) => m.id === "a2")!;
    expect(a2.vendas).toBe(0); expect(a2.cpa).toBeNull();
  });
  it("diasBons", () => {
    const a1 = aggregate("ad", spend, orders).find((m) => m.id === "a1")!;
    expect(diasBons(a1, 50)).toBe(2); expect(diasBons(a1, 49)).toBe(0);
  });
});
describe("datas SP", () => {
  it("23:30 SP ainda é o mesmo dia; 03:00Z = 00:00 SP", () => {
    expect(dayInSP("2026-11-21T02:30:00Z")).toBe("2026-11-20");
    expect(dayInSP("2026-11-21T03:00:00Z")).toBe("2026-11-21");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
});
