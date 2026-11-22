import type { Rules } from "./rules";

export type FunnelDiagnosis = "PAGINA" | "CHECKOUT" | "CRIATIVO" | null;
export interface FunnelInput { impressoes: number; cliques: number; checkouts: number; vendas: number }

export const FUNNEL_TEXT: Record<Exclude<FunnelDiagnosis, null>, string> = {
  PAGINA: "Muito clique e pouco checkout: revise a página de vendas.",
  CHECKOUT: "Checkout sem compra: revise checkout e meios de pagamento.",
  CRIATIVO: "Pouco clique: revise o criativo/segmentação.",
};

/** Ordem: página → checkout → criativo; só diagnostica com volume mínimo. */
export function diagnoseFunnel(f: FunnelInput, r: Rules): FunnelDiagnosis {
  if (f.cliques >= r.min_cliques && f.checkouts / f.cliques < r.connect_min) return "PAGINA";
  if (f.checkouts >= r.min_checkouts && f.vendas / f.checkouts < r.checkout_conv_min) return "CHECKOUT";
  if (f.impressoes >= 1000 && f.cliques / f.impressoes < r.ctr_min) return "CRIATIVO";
  return null;
}
