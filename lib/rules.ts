export interface Rules {
  aguarde_mult: number; aguarde_horas: number;
  pause_mult_sem_venda: number; pause_mult_cpa: number;
  escale_vendas: number; escale_cpa_pct: number; escale_dias: number;
  escale_aumento_pct: number; escale_intervalo_horas: number;
  teto_perda: number; meta_cpa_pct: number; margem_padrao: number;
  ctr_min: number; connect_min: number; checkout_conv_min: number;
  min_cliques: number; min_checkouts: number;
  telegram_chat_id: string | null;
}

export const DEFAULT_RULES: Rules = {
  aguarde_mult: 2, aguarde_horas: 72,
  pause_mult_sem_venda: 3, pause_mult_cpa: 1.5,
  escale_vendas: 5, escale_cpa_pct: 0.7, escale_dias: 2,
  escale_aumento_pct: 20, escale_intervalo_horas: 48,
  teto_perda: 0, meta_cpa_pct: 0.7, margem_padrao: 0,
  ctr_min: 0.01, connect_min: 0.1, checkout_conv_min: 0.15,
  min_cliques: 100, min_checkouts: 10,
  telegram_chat_id: null,
};

export function rulesFromRow(row: Record<string, unknown> | null | undefined): Rules {
  const r: Rules = { ...DEFAULT_RULES };
  if (!row) return r;
  for (const k of Object.keys(DEFAULT_RULES) as (keyof Rules)[]) {
    const v = row[k];
    if (v === null || v === undefined) continue;
    (r as any)[k] = k === "telegram_chat_id" ? String(v) : Number(v);
  }
  return r;
}
