// Edge Function (Deno): sincroniza gasto da Meta por dia/campanha/conjunto/anúncio.
// Secrets: META_ACCESS_TOKEN (System User token). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const API = `https://graph.facebook.com/${Deno.env.get("META_API_VERSION") ?? "v21.0"}`;
const DAYS_BACK = 7; // reprocessa a janela recente (a Meta ajusta números retroativamente)

const spDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

type Action = { action_type: string; value: string };
const checkouts = (a?: Action[]) =>
  Number((a ?? []).find((x) => x.action_type === "initiate_checkout")?.value ??
    (a ?? []).find((x) => x.action_type === "offsite_conversion.fb_pixel_initiate_checkout")?.value ?? 0);

async function fetchInsights(accountExt: string, since: string, until: string, token: string) {
  const rows: any[] = [];
  const params = new URLSearchParams({
    level: "ad", time_increment: "1", limit: "500",
    fields: "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,inline_link_clicks,actions",
    time_range: JSON.stringify({ since, until }),
  });
  let url: string | null = `${API}/act_${accountExt}/insights?${params}`;
  while (url) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); // token no header, nunca na URL/log
    const json: any = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `Meta HTTP ${res.status}`);
    rows.push(...json.data);
    url = json.paging?.next ?? null;
  }
  return rows;
}

Deno.serve(async () => {
  const token = Deno.env.get("META_ACCESS_TOKEN");
  if (!token) return new Response("META_ACCESS_TOKEN ausente", { status: 500 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // Câmbio diário opcional (contas com cambio_automatico).
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
    const bid = Number((await r.json())?.USDBRL?.bid);
    if (bid > 0) await db.from("accounts").update({ cambio_para_brl: bid }).eq("cambio_automatico", true).eq("moeda", "USD");
  } catch (_) { /* mantém o câmbio atual */ }

  const { data: accounts } = await db.from("accounts").select("*").eq("rede", "meta");
  const until = spDay(new Date());
  const since = spDay(new Date(Date.now() - DAYS_BACK * 864e5));
  const report: Record<string, string> = {};

  for (const acc of accounts ?? []) {
    try {
      const insights = await fetchInsights(acc.external_id.replace(/^act_/, ""), since, until, token);
      const rows = insights.map((i) => ({
        user_id: acc.user_id, account_id: acc.id, data: i.date_start,
        campaign_id: i.campaign_id, campaign_name: i.campaign_name,
        adset_id: i.adset_id, adset_name: i.adset_name, ad_id: i.ad_id, ad_name: i.ad_name,
        gasto: Number(i.spend ?? 0), impressoes: Number(i.impressions ?? 0),
        cliques_link: Number(i.inline_link_clicks ?? 0), checkouts_iniciados: checkouts(i.actions),
      }));
      for (let k = 0; k < rows.length; k += 500) {
        const { error } = await db.from("ad_spend_daily").upsert(rows.slice(k, k + 500), { onConflict: "account_id,data,ad_id" });
        if (error) throw error;
      }
      report[acc.external_id] = `ok ${rows.length}`;
    } catch (e) {
      report[acc.external_id] = `erro: ${(e as Error).message}`;
    }
  }
  return Response.json(report);
});
