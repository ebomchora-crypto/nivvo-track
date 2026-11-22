import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/ingest";
import { addDays, brl, dayInSP } from "@/lib/format";
import { buildRows, loadReportData } from "@/lib/report";
import { SIGNAL_META } from "@/lib/signals";
import { sendTelegram } from "@/lib/telegram";
import { safeEqual } from "@/lib/hash";
import type { Level } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ALERT = new Set(["PAUSE", "TETO", "ESCALE"]);

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const db = admin();
  const { data: users } = await db.from("accounts").select("user_id");
  const ids = [...new Set((users ?? []).map((u) => u.user_id))];
  const to = dayInSP(new Date()), from = addDays(to, -30);
  let sent = 0;

  for (const userId of ids) {
    const data = await loadReportData(db, userId, { from, to });
    const { data: prev } = await db.from("signal_state").select("nivel,entidade_id,sinal").eq("user_id", userId);
    const prevMap = new Map((prev ?? []).map((p) => [`${p.nivel}:${p.entidade_id}`, p.sinal]));
    const states: any[] = [];

    for (const level of ["campaign", "adset", "ad"] as Level[]) {
      for (const r of buildRows(data, level)) {
        if (!r.signal) continue;
        const key = `${level}:${r.id}`, before = prevMap.get(key);
        states.push({ user_id: userId, nivel: level, entidade_id: r.id, sinal: r.signal.signal, atualizado_em: new Date().toISOString() });
        if (before === r.signal.signal || !ALERT.has(r.signal.signal)) continue;
        const m = SIGNAL_META[r.signal.signal];
        const text = `${m.emoji} ${m.label} — ${level === "campaign" ? "Campanha" : level === "adset" ? "Conjunto" : "Anúncio"}: ${r.name}\n${r.signal.reason}\nGasto ${brl(r.gasto)} · Receita ${brl(r.receita)} · Lucro ${brl(r.lucro)}`;
        const ok = data.rules.telegram_chat_id ? await sendTelegram(data.rules.telegram_chat_id, text) : false;
        await db.from("alerts").insert({ user_id: userId, entidade: level, entidade_id: r.id, sinal: r.signal.signal, motivo: r.signal.reason, canal: "telegram", enviado: ok });
        if (ok) sent++;
      }
    }
    for (let i = 0; i < states.length; i += 500) await db.from("signal_state").upsert(states.slice(i, i + 500), { onConflict: "user_id,nivel,entidade_id" });
  }
  return NextResponse.json({ ok: true, enviados: sent });
}
