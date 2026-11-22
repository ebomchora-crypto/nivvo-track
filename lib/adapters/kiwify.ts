import { createHmac } from "crypto";
import type { NormalizedEvent, OrderStatus, PlatformAdapter } from "../types";
import { hashBuyer, safeEqual } from "../hash";
import { utmsFrom } from "../utm";

/**
 * PROVISÓRIO: mapeamento baseado na documentação pública da Kiwify; confirmar
 * com payload real (tests/fixtures/kiwify-*.json) antes de produção.
 * Assinatura: query ?signature = HMAC-SHA1(corpo bruto, token do webhook), hex.
 */
const STATUS: Record<string, OrderStatus> = {
  paid: "aprovado",
  approved: "aprovado",
  waiting_payment: "pendente",
  refused: "cancelado",
  refunded: "reembolsado",
  chargedback: "chargeback",
  chargeback: "chargeback",
};

const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};
/** A Kiwify envia valores monetários em centavos (inteiro). Confirmar no payload real. */
const cents = (v: unknown) => num(v) / 100;

export const kiwify: PlatformAdapter = {
  id: "kiwify",

  verify({ rawBody, query }, secret) {
    const sig = query.get("signature");
    if (!sig || !secret) return false;
    const expected = createHmac("sha1", secret).update(rawBody).digest("hex");
    return safeEqual(sig.toLowerCase(), expected);
  },

  normalize(payload, ctx): NormalizedEvent | null {
    const p = payload as any;
    if (!p || typeof p !== "object" || !p.order_id) return null;
    const status = STATUS[String(p.order_status ?? "").toLowerCase()];
    if (!status) return null;
    const com = p.Commissions ?? {};
    const prod = p.Product ?? {};
    return {
      plataforma: "kiwify",
      pedido_id: String(p.order_id),
      produto_id: String(prod.product_id ?? ""),
      produto_nome: String(prod.product_name ?? ""),
      status,
      valor_bruto: cents(com.charge_amount),
      valor_liquido: cents(com.my_commission),
      moeda: String(com.currency ?? "BRL"),
      forma_pagamento: p.payment_method ? String(p.payment_method) : null,
      comprador_hash: hashBuyer(p.Customer?.email, ctx.salt),
      data_pedido: new Date(String(p.approved_date ?? p.created_at).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(p.approved_date ?? p.created_at)) ? "" : "Z")).toISOString(),
      utms: utmsFrom(p.TrackingParameters),
    };
  },
};
