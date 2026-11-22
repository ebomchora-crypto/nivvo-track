import { NextRequest, NextResponse } from "next/server";
import { adapters } from "@/lib/adapters/registry";
import { admin, persistEvent } from "@/lib/ingest";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { platform: string; token: string } }) {
  const adapter = adapters[params.platform];
  if (!adapter) return NextResponse.json({ error: "plataforma desconhecida" }, { status: 404 });
  if (!rateLimit(`${params.platform}:${params.token}`)) return NextResponse.json({ error: "limite" }, { status: 429 });

  const db = admin();
  const { data: conn } = await db.from("platform_connections").select("id,user_id,secret")
    .eq("plataforma", params.platform).eq("token", params.token).eq("ativo", true).maybeSingle();
  if (!conn) return NextResponse.json({ error: "token inválido" }, { status: 404 });

  const rawBody = await req.text();
  const valid = adapter.verify({ rawBody, headers: req.headers, query: req.nextUrl.searchParams }, conn.secret);

  let payload: unknown = null;
  try { payload = JSON.parse(rawBody); } catch { /* registra mesmo assim */ }

  // Auditoria: guarda sempre o bruto (inclusive inválidos, marcados).
  const { data: wh } = await db.from("webhook_events").insert({
    user_id: conn.user_id, connection_id: conn.id, plataforma: params.platform,
    payload, assinatura_valida: valid,
  }).select("id").single();

  if (!valid) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });

  try {
    const ev = adapter.normalize(payload, { secret: conn.secret, salt: process.env.BUYER_HASH_SALT! });
    if (ev) await persistEvent(db, conn, ev);
    await db.from("webhook_events").update({ processado: true, ignorado: !ev }).eq("id", wh!.id);
  } catch (e) {
    await db.from("webhook_events").update({ erro: String((e as Error).message) }).eq("id", wh!.id);
    return NextResponse.json({ error: "falha ao processar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
