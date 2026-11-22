import { brl } from "./format";
import type { Rules } from "./rules";

export type Signal = "AGUARDE" | "ATENCAO" | "PAUSE" | "ESCALE" | "TETO";

export interface SignalInput {
  gasto: number;            // BRL
  vendas: number;           // aprovadas, já sem reembolso/chargeback
  receita: number;          // líquida, BRL
  maxCpa: number;           // = margem líquida do produto
  ageHours: number;         // desde o primeiro gasto
  diasBons: number;         // dias com custo por venda <= escale_cpa_pct * maxCpa
  horasDesdeUltimoAumento: number | null;
}
export interface SignalResult { signal: Signal; reason: string; suggestIncreasePct?: number }

export const SIGNAL_META: Record<Signal, { emoji: string; label: string }> = {
  AGUARDE: { emoji: "⚪", label: "AGUARDE" },
  ATENCAO: { emoji: "🟡", label: "ATENÇÃO" },
  PAUSE: { emoji: "🔴", label: "PAUSE" },
  ESCALE: { emoji: "🟢", label: "ESCALE" },
  TETO: { emoji: "🛑", label: "TETO" },
};

/**
 * Precedência: TETO > AGUARDE > PAUSE > ESCALE > ATENÇÃO > AGUARDE (bom custo, critérios de escala pendentes).
 * Limites são inclusivos/exclusivos exatamente como no briefing (ver tests/signals.test.ts).
 */
export function evaluateSignal(i: SignalInput, r: Rules): SignalResult {
  const M = i.maxCpa;
  if (!(M > 0)) return { signal: "AGUARDE", reason: "Defina a margem líquida do produto para avaliar este item." };

  const perda = i.gasto - i.receita;
  if (r.teto_perda > 0 && perda >= r.teto_perda)
    return { signal: "TETO", reason: `Perda acumulada de ${brl(perda)} atingiu o teto de ${brl(r.teto_perda)}. Pare tudo.` };

  if (i.gasto < r.aguarde_mult * M || i.ageHours < r.aguarde_horas)
    return { signal: "AGUARDE", reason: "Dado insuficiente, não mexa." };

  if (i.vendas === 0) {
    if (i.gasto >= r.pause_mult_sem_venda * M)
      return { signal: "PAUSE", reason: `Gastou ${brl(i.gasto)} (≥ ${r.pause_mult_sem_venda}× o custo máximo de ${brl(M)}) sem nenhuma venda.` };
    return { signal: "ATENCAO", reason: `Gastou ${brl(i.gasto)} sem vendas; pausa em ${brl(r.pause_mult_sem_venda * M)}.` };
  }

  const cpa = i.gasto / i.vendas;
  if (cpa > r.pause_mult_cpa * M)
    return { signal: "PAUSE", reason: `Custo por venda ${brl(cpa)} está acima de ${r.pause_mult_cpa}× o máximo (${brl(r.pause_mult_cpa * M)}).` };

  if (i.vendas >= r.escale_vendas && cpa <= r.escale_cpa_pct * M && i.diasBons >= r.escale_dias) {
    if (i.horasDesdeUltimoAumento !== null && i.horasDesdeUltimoAumento < r.escale_intervalo_horas)
      return { signal: "ESCALE", reason: `Bom desempenho (${i.vendas} vendas, ${brl(cpa)} por venda), mas aguarde ${Math.ceil(r.escale_intervalo_horas - i.horasDesdeUltimoAumento)}h desde o último aumento.` };
    const inc = Math.min(20, r.escale_aumento_pct);
    return { signal: "ESCALE", suggestIncreasePct: inc, reason: `${i.vendas} vendas a ${brl(cpa)} (≤ ${Math.round(r.escale_cpa_pct * 100)}% do máximo) em ${i.diasBons} dias. Aumente no máx. ${inc}% e espere ${r.escale_intervalo_horas}–72h.` };
  }

  if (cpa > r.meta_cpa_pct * M)
    return { signal: "ATENCAO", reason: `Custo por venda ${brl(cpa)} entre a meta (${brl(r.meta_cpa_pct * M)}) e o máximo (${brl(M)}).` };

  return { signal: "AGUARDE", reason: `Bom custo por venda (${brl(cpa)}), mas ainda faltam vendas ou dias para escalar.` };
}
