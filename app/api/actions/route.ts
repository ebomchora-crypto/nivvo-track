import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { increaseDailyBudget, pauseEntity } from "@/lib/meta";
import { rulesFromRow } from "@/lib/rules";

export const runtime = "nodejs";
const COL = { campaign: "campaign_id", adset: "adset_id", ad: "ad_id" } as const;

export async function POST(req: NextRequest) {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const b = await req.json().catch(() => null);
  const level = b?.nivel as keyof typeof COL, id = String(b?.id ?? ""), acao = b?.acao;
  if (!(level in COL) || !/^\d+$/.test(id) || !["pausar", "aumentar"].includes(acao))
    return NextResponse.json({ error: "parâmetros inválidos" }, { status: 400 });
  if (b?.confirmado !== true) return NextResponse.json({ error: "confirmação obrigatória" }, { status: 400 });
  if (acao === "aumentar" && level === "ad") return NextResponse.json({ error: "orçamento fica na campanha ou no conjunto" }, { status: 400 });

  // A entidade precisa pertencer ao usuário (RLS garante que só vê as próprias).
  const { data: own } = await db.from("ad_spend_daily").select("id").eq(COL[level], id).limit(1);
  if (!own?.length) return NextResponse.json({ error: "entidade não encontrada" }, { status: 404 });

  const { data: rulesRow } = await db.from("rules_config").select("*").eq("user_id", user.id).maybeSingle();
  const rules = rulesFromRow(rulesRow);

  if (acao === "aumentar") {
    const { data: last } = await db.from("actions_log").select("criado_em").eq("user_id", user.id)
      .eq("entidade_id", id).eq("acao", "aumentar").eq("sucesso", true).order("criado_em", { ascending: false }).limit(1);
    if (last?.[0]) {
      const h = (Date.now() - new Date(last[0].criado_em).getTime()) / 36e5;
      if (h < rules.escale_intervalo_horas)
        return NextResponse.json({ error: `Aguarde ${Math.ceil(rules.escale_intervalo_horas - h)}h desde o último aumento.` }, { status: 409 });
    }
  }

  let resultado: unknown = null, sucesso = false, erro: string | null = null;
  try {
    resultado = acao === "pausar" ? await pauseEntity(id) : await increaseDailyBudget(id, rules.escale_aumento_pct);
    sucesso = true;
  } catch (e) { erro = (e as Error).message; }

  await db.from("actions_log").insert({
    user_id: user.id, entidade: level, entidade_id: id, acao,
    detalhes: { nivel: level, pedido_por: user.id }, resultado: sucesso ? resultado : { erro }, sucesso,
  });
  return sucesso ? NextResponse.json({ ok: true, resultado }) : NextResponse.json({ error: erro }, { status: 502 });
}
