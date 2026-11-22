import { createClient } from "@supabase/supabase-js";
import type { NormalizedEvent } from "./types";
import { attributionFromUtms } from "./utm";

export const admin = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/** Persiste o evento de forma idempotente por (user, plataforma, pedido). */
export async function persistEvent(db: ReturnType<typeof admin>, conn: { id: string; user_id: string }, ev: NormalizedEvent) {
  const { data: product } = await db.from("products").upsert(
    { user_id: conn.user_id, plataforma: ev.plataforma, produto_externo_id: ev.produto_id, nome: ev.produto_nome },
    { onConflict: "user_id,plataforma,produto_externo_id", ignoreDuplicates: false }
  ).select("id").single();

  const { data: order, error } = await db.from("orders").upsert({
    user_id: conn.user_id, connection_id: conn.id, product_id: product?.id ?? null,
    plataforma: ev.plataforma, pedido_id: ev.pedido_id, status: ev.status,
    valor_bruto: ev.valor_bruto, valor_liquido: ev.valor_liquido, moeda: ev.moeda,
    forma_pagamento: ev.forma_pagamento, comprador_hash: ev.comprador_hash, data_pedido: ev.data_pedido,
  }, { onConflict: "user_id,plataforma,pedido_id" }).select("id").single();
  if (error) throw error;

  const a = attributionFromUtms(ev.utms);
  await db.from("order_utm").upsert({
    order_id: order!.id, user_id: conn.user_id,
    utm_source: ev.utms.source, utm_medium: ev.utms.medium, utm_campaign: ev.utms.campaign,
    utm_content: ev.utms.content, utm_term: ev.utms.term,
    fbclid: ev.utms.fbclid, fbp: ev.utms.fbp, fbc: ev.utms.fbc, ...a,
  }, { onConflict: "order_id" });
}
