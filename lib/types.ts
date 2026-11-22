export type OrderStatus = "pendente" | "aprovado" | "reembolsado" | "chargeback" | "cancelado";

export interface Utms {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  fbclid: string | null;
  fbp: string | null;
  fbc: string | null;
}

/** Evento normalizado: único formato que o resto do sistema conhece. */
export interface NormalizedEvent {
  plataforma: string;
  pedido_id: string;
  produto_id: string;
  produto_nome: string;
  status: OrderStatus;
  valor_bruto: number;
  valor_liquido: number;
  moeda: string;
  forma_pagamento: string | null;
  comprador_hash: string | null; // HMAC, nunca dado pessoal em claro
  data_pedido: string; // ISO 8601 UTC
  utms: Utms;
}

export interface AdapterContext {
  /** Segredo de validação configurado para a conexão (token/hottok). */
  secret: string;
  /** Salt para hash do comprador. */
  salt: string;
}

export interface PlatformAdapter {
  id: string;
  /** Valida autenticidade. Lança erro/retorna false se inválido. */
  verify(req: { rawBody: string; headers: Headers; query: URLSearchParams }, secret: string): boolean;
  /** Converte payload bruto em evento normalizado; null = evento ignorável. */
  normalize(payload: unknown, ctx: AdapterContext): NormalizedEvent | null;
}
