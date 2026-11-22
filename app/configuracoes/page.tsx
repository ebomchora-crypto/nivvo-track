import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rulesFromRow } from "@/lib/rules";

export const dynamic = "force-dynamic";
const input = "bg-black border border-white/30 p-1 w-full";

async function user() {
  const db = supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("não autenticado");
  return { db, id: user.id };
}
const n = (fd: FormData, k: string) => Number(String(fd.get(k) ?? "0").replace(",", "."));

async function salvarRegras(fd: FormData) {
  "use server";
  const { db, id } = await user();
  await db.from("rules_config").upsert({
    user_id: id, margem_padrao: n(fd, "margem_padrao"), teto_perda: n(fd, "teto_perda"),
    aguarde_mult: n(fd, "aguarde_mult"), aguarde_horas: n(fd, "aguarde_horas"),
    pause_mult_sem_venda: n(fd, "pause_mult_sem_venda"), pause_mult_cpa: n(fd, "pause_mult_cpa"),
    escale_vendas: n(fd, "escale_vendas"), escale_cpa_pct: n(fd, "escale_cpa_pct"), escale_dias: n(fd, "escale_dias"),
    escale_aumento_pct: Math.min(20, n(fd, "escale_aumento_pct")), escale_intervalo_horas: Math.max(48, n(fd, "escale_intervalo_horas")),
    meta_cpa_pct: n(fd, "meta_cpa_pct"), telegram_chat_id: String(fd.get("telegram_chat_id") ?? "") || null,
  });
  revalidatePath("/configuracoes");
}
async function salvarMargem(fd: FormData) {
  "use server";
  const { db } = await user();
  await db.from("products").update({ margem_liquida: n(fd, "margem") }).eq("id", String(fd.get("id")));
  revalidatePath("/configuracoes");
}
async function addConta(fd: FormData) {
  "use server";
  const { db, id } = await user();
  await db.from("accounts").insert({ user_id: id, rede: "meta", external_id: String(fd.get("external_id")).replace(/^act_/, "").trim(), nome: String(fd.get("nome")) || null, moeda: String(fd.get("moeda")), cambio_para_brl: n(fd, "cambio") || 5, cambio_automatico: fd.get("auto") === "on" });
  revalidatePath("/configuracoes");
}
async function salvarCambio(fd: FormData) {
  "use server";
  const { db } = await user();
  await db.from("accounts").update({ cambio_para_brl: n(fd, "cambio"), cambio_automatico: fd.get("auto") === "on" }).eq("id", String(fd.get("id")));
  revalidatePath("/configuracoes");
}
async function addConexao(fd: FormData) {
  "use server";
  const { db, id } = await user();
  await db.from("platform_connections").insert({ user_id: id, plataforma: String(fd.get("plataforma")), nome: String(fd.get("nome")) || null, secret: String(fd.get("secret")) });
  revalidatePath("/configuracoes");
}

export default async function Config() {
  const { db, id } = await user();
  const [{ data: row }, { data: products }, { data: accounts }, { data: conns }, { data: log }] = await Promise.all([
    db.from("rules_config").select("*").eq("user_id", id).maybeSingle(),
    db.from("products").select("id,nome,plataforma,margem_liquida").order("nome"),
    db.from("accounts").select("*"), db.from("platform_connections").select("*"),
    db.from("actions_log").select("*").order("criado_em", { ascending: false }).limit(15),
  ]);
  const r = rulesFromRow(row);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://SEU-DOMINIO";
  const fields: [string, string, number | string][] = [
    ["margem_padrao", "Margem padrão (R$, p/ itens sem venda)", r.margem_padrao], ["teto_perda", "Teto de perda (R$, 0 = desligado)", r.teto_perda],
    ["aguarde_mult", "AGUARDE: gasto < N× custo máx.", r.aguarde_mult], ["aguarde_horas", "AGUARDE: idade mínima (h)", r.aguarde_horas],
    ["pause_mult_sem_venda", "PAUSE: gasto ≥ N× sem venda", r.pause_mult_sem_venda], ["pause_mult_cpa", "PAUSE: custo/venda > N× máx.", r.pause_mult_cpa],
    ["meta_cpa_pct", "Meta de custo/venda (fração do máx.)", r.meta_cpa_pct], ["escale_vendas", "ESCALE: vendas mínimas", r.escale_vendas],
    ["escale_cpa_pct", "ESCALE: custo/venda ≤ fração do máx.", r.escale_cpa_pct], ["escale_dias", "ESCALE: dias mínimos", r.escale_dias],
    ["escale_aumento_pct", "Aumento sugerido % (máx. 20)", r.escale_aumento_pct], ["escale_intervalo_horas", "Intervalo entre aumentos (h, mín. 48)", r.escale_intervalo_horas],
    ["telegram_chat_id", "Telegram chat ID (alertas)", r.telegram_chat_id ?? ""],
  ];
  return (
    <main className="p-4 md:p-8 space-y-10 max-w-4xl">
      <header className="flex justify-between"><h1 className="text-2xl font-semibold">Configurações</h1><Link href="/" className="underline text-sm">Voltar</Link></header>

      <section className="space-y-3"><h2 className="text-lg font-semibold">Regras do semáforo</h2>
        <form action={salvarRegras} className="grid md:grid-cols-2 gap-3">
          {fields.map(([k, l, v]) => <label key={k} className="text-sm">{l}<input name={k} defaultValue={String(v)} className={input} /></label>)}
          <button className="bg-white text-black p-2 font-medium md:col-span-2">Salvar regras</button>
        </form></section>

      <section className="space-y-3"><h2 className="text-lg font-semibold">Produtos (margem líquida = custo máximo por venda)</h2>
        {(products ?? []).map((p) => (
          <form key={p.id} action={salvarMargem} className="flex gap-2 items-center text-sm">
            <input type="hidden" name="id" value={p.id} /><span className="flex-1">{p.nome} <span className="opacity-50">({p.plataforma})</span></span>
            <input name="margem" defaultValue={String(p.margem_liquida)} className={input + " max-w-[8rem]"} /><button className="border border-white/40 px-3 py-1">Salvar</button>
          </form>))}
        {!products?.length && <p className="text-sm opacity-60">Os produtos aparecem aqui depois da primeira venda recebida.</p>}</section>

      <section className="space-y-3"><h2 className="text-lg font-semibold">Contas de anúncio (Meta)</h2>
        {(accounts ?? []).map((a) => (
          <form key={a.id} action={salvarCambio} className="flex gap-2 items-center text-sm">
            <input type="hidden" name="id" value={a.id} /><span className="flex-1">{a.nome ?? a.external_id} · {a.moeda}</span>
            {a.moeda !== "BRL" && <><input name="cambio" defaultValue={String(a.cambio_para_brl)} className={input + " max-w-[6rem]"} />
              <label className="flex gap-1"><input type="checkbox" name="auto" defaultChecked={a.cambio_automatico} />diário</label></>}
            <button className="border border-white/40 px-3 py-1">Salvar</button>
          </form>))}
        <form action={addConta} className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
          <input name="external_id" required placeholder="ID da conta" className={input} /><input name="nome" placeholder="Nome" className={input} />
          <select name="moeda" className={input}><option>USD</option><option>BRL</option></select><input name="cambio" placeholder="Câmbio" className={input} />
          <label className="flex gap-1 items-center"><input type="checkbox" name="auto" />câmbio diário</label><button className="bg-white text-black p-1">Adicionar</button>
        </form></section>

      <section className="space-y-3"><h2 className="text-lg font-semibold">Plataformas de venda</h2>
        {(conns ?? []).map((c) => <div key={c.id} className="text-sm border border-white/20 p-2 break-all"><b>{c.plataforma}</b> {c.nome}<br /><code>{base}/api/webhooks/{c.plataforma}/{c.token}</code></div>)}
        <form action={addConexao} className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <select name="plataforma" className={input}><option>kiwify</option><option>hotmart</option></select><input name="nome" placeholder="Apelido" className={input} />
          <input name="secret" required placeholder="Token de assinatura / hottok" className={input} /><button className="bg-white text-black p-1">Conectar</button>
        </form></section>

      <section className="space-y-2"><h2 className="text-lg font-semibold">Últimas ações (auditoria)</h2>
        {(log ?? []).map((l) => <div key={l.id} className="text-xs opacity-80">{new Date(l.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {l.acao} · {l.entidade} {l.entidade_id} · {l.sucesso ? "ok" : "falhou"}</div>)}</section>
    </main>
  );
}
