import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { buildRows, loadReportData } from "@/lib/report";
import { addDays, brl, dayInSP, num, pct } from "@/lib/format";
import { SIGNAL_META } from "@/lib/signals";
import { FUNNEL_TEXT } from "@/lib/funnel";
import type { Level } from "@/lib/metrics";
import ActionButtons from "@/components/ActionButtons";

export const dynamic = "force-dynamic";
const TABS: { key: Level; label: string }[] = [{ key: "campaign", label: "Campanhas" }, { key: "adset", label: "Conjuntos" }, { key: "ad", label: "Anúncios" }];

export default async function Dashboard({ searchParams: sp }: { searchParams: Record<string, string | undefined> }) {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;

  const hoje = dayInSP(new Date());
  const f = { from: sp.de || addDays(hoje, -6), to: sp.ate || hoje, conta: sp.conta || undefined, plataforma: sp.plataforma || undefined, produto: sp.produto || undefined };
  const nivel = (TABS.find((t) => t.key === sp.aba)?.key ?? "campaign") as Level;
  const data = await loadReportData(db, user.id, f);
  const rows = buildRows(data, nivel);
  const tot = rows.reduce((a, r) => ({ g: a.g + r.gasto, v: a.v + r.vendas, rec: a.rec + r.receita }), { g: 0, v: 0, rec: 0 });
  const qs = (extra: Record<string, string>) => new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <main className="p-4 md:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">NivvoTrack</h1>
        <Link href="/configuracoes" className="underline text-sm">Configurações</Link>
      </header>

      <form className="flex flex-wrap gap-2 text-sm items-end">
        <input type="hidden" name="aba" value={nivel} />
        {[["de", f.from], ["ate", f.to]].map(([n, v]) => (
          <label key={n} className="flex flex-col">{n === "de" ? "De" : "Até"}<input type="date" name={n} defaultValue={v} className="bg-black border border-white/30 p-1" /></label>
        ))}
        <label className="flex flex-col">Conta<select name="conta" defaultValue={f.conta ?? ""} className="bg-black border border-white/30 p-1"><option value="">Todas</option>{data.accounts.map((a) => <option key={a.id} value={a.id}>{a.nome ?? a.external_id}</option>)}</select></label>
        <label className="flex flex-col">Plataforma<select name="plataforma" defaultValue={f.plataforma ?? ""} className="bg-black border border-white/30 p-1"><option value="">Consolidado</option>{data.plataformas.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label className="flex flex-col">Produto<select name="produto" defaultValue={f.produto ?? ""} className="bg-black border border-white/30 p-1"><option value="">Todos</option>{data.products.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        <button className="bg-white text-black px-3 py-1.5 font-medium">Filtrar</button>
      </form>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Gasto", brl(tot.g)], ["Vendas", String(tot.v)], ["Receita líquida", brl(tot.rec)], ["Lucro", brl(tot.rec - tot.g)]].map(([k, v]) => (
          <div key={k} className="border border-white/20 p-3"><div className="text-xs opacity-60">{k}</div><div className="text-xl font-semibold">{v}</div></div>
        ))}
      </section>

      <nav className="flex gap-4 border-b border-white/20">
        {TABS.map((t) => (
          <Link key={t.key} href={`/?${qs({ aba: t.key })}`} className={`pb-2 ${t.key === nivel ? "border-b-2 border-white font-semibold" : "opacity-60"}`}>{t.label}</Link>
        ))}
      </nav>

      <div className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="text-left opacity-60"><tr>
            {["Sinal", "Nome", "Gasto", "Vendas", "Receita", "Lucro", "ROAS", "Custo/venda", "CTR", "Checkouts", "Checkout→compra", "Ações"].map((h) => <th key={h} className="p-2 font-normal">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const m = r.signal ? SIGNAL_META[r.signal.signal] : null;
              return (
                <tr key={r.id} className="border-t border-white/10 align-top">
                  <td className="p-2 max-w-xs whitespace-normal">
                    {m ? <><div className="font-semibold">{m.emoji} {m.label}</div><div className="text-xs opacity-70">{r.signal!.reason}</div>
                      {r.funil && <div className="text-xs mt-1 italic">{FUNNEL_TEXT[r.funil]}</div>}</> : "—"}
                  </td>
                  <td className="p-2 max-w-xs truncate" title={r.name}>{r.name}</td>
                  <td className="p-2">{brl(r.gasto)}</td><td className="p-2">{r.vendas}</td><td className="p-2">{brl(r.receita)}</td>
                  <td className="p-2">{brl(r.lucro)}</td><td className="p-2">{num(r.roas)}</td>
                  <td className="p-2">{r.cpa === null ? "—" : brl(r.cpa)}</td><td className="p-2">{pct(r.ctr)}</td>
                  <td className="p-2">{r.checkouts}</td><td className="p-2">{pct(r.taxaCheckout)}</td>
                  <td className="p-2">{r.signal && /^\d+$/.test(r.id) && <ActionButtons nivel={nivel} id={r.id} nome={r.name} podeAumentar={nivel !== "ad" && r.signal.signal === "ESCALE" && !!r.signal.suggestIncreasePct} />}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={12} className="p-6 text-center opacity-60">Sem dados no período.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs opacity-50">Vendas aprovadas apenas; reembolsos e chargebacks são descontados. Receita assumida em BRL; gasto convertido pelo câmbio da conta. Fuso: America/Sao_Paulo.</p>
    </main>
  );
}
