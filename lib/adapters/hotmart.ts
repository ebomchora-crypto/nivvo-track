import type { NormalizedEvent, OrderStatus, PlatformAdapter } from "../types";
import { hashBuyer, safeEqual } from "../hash";
import { emptyUtms } from "../utm";

/**
 * PROVISÓRIO: baseado na documentação do webhook v2.0.0 da Hotmart; confirmar
 * com payload real. Autenticação: header X-Hotmart-Hottok = hottok da conta.
 * A Hotmart só repassa `src` e `sck` (origin). Convenção do NivvoTrack:
 *   src = utm_source; sck = "<campaign_id>-<adset_id>-<ad_id>" (só IDs).
 */
const EVENT: Record<string, OrderStatus> = {
  PURCHASE_APPROVED: "aprovado",
  PURCHASE_COMPLETE: "aprovado",
  PURCHASE_BILLET_PRINTED: "pendente",
  PURCHASE_DELAYED: "pendente",
  PURCHASE_CANCELED: "cancelado",
  PURCHASE_EXPIRED: "cancelado",
  PURCHASE_REFUNDED: "reembolsado",
  PURCHASE_CHARGEBACK: "chargeback",
};

export function parseSck(sck: unknown) {
  const m = typeof sck === "string" ? sck.match(/^(\d+)-(\d+)-(\d+)$/) : null;
  return m ? { campaign: m[1], adset: m[2], ad: m[3] } : null;
}

export const hotmart: PlatformAdapter = {
  id: "hotmart",

  verify({ headers }, secret) {
    const tok = headers.get("x-hotmart-hottok");
    return !!tok && !!secret && safeEqual(tok, secret);
  },

  normalize(payload, ctx): NormalizedEvent | null {
    const p = payload as any;
    const status = EVENT[String(p?.event ?? "")];
    const d = p?.data;
    if (!status || !d?.purchase?.transaction) return null;
    const purchase = d.purchase;
    const ids = parseSck(purchase.origin?.sck);
    const utms = emptyUtms();
    utms.source = purchase.origin?.src ?? null;
    if (ids) {
      utms.campaign = `|${ids.campaign}`;
      utms.medium = `|${ids.adset}`;
      utms.content = `|${ids.ad}`;
    }
    const price = purchase.price ?? {};
    const date = purchase.order_date ?? purchase.approved_date ?? p.creation_date;
    return {
      plataforma: "hotmart",
      pedido_id: String(purchase.transaction),
      produto_id: String(d.product?.id ?? ""),
      produto_nome: String(d.product?.name ?? ""),
      status,
      valor_bruto: Number(price.value ?? 0),
      // Líquido real = comissão do produtor em data.commissions[] (confirmar no payload real).
      valor_liquido: Number(
        (d.commissions ?? []).find((c: any) => c.source === "PRODUCER")?.value ?? price.value ?? 0
      ),
      moeda: String(price.currency_value ?? "BRL"),
      forma_pagamento: purchase.payment?.type ?? null,
      comprador_hash: hashBuyer(d.buyer?.email, ctx.salt),
      data_pedido: new Date(Number(date)).toISOString(),
      utms,
    };
  },
};
