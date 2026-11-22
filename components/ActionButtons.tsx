"use client";
import { useState } from "react";

export default function ActionButtons({ nivel, id, nome, podeAumentar }: { nivel: string; id: string; nome: string; podeAumentar: boolean }) {
  const [busy, setBusy] = useState(false);
  async function run(acao: "pausar" | "aumentar") {
    const msg = acao === "pausar" ? `Pausar "${nome}" na Meta?` : `Aumentar o orçamento de "${nome}" em até 20% na Meta?`;
    if (!confirm(msg)) return;
    setBusy(true);
    const res = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nivel, id, acao, confirmado: true }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    alert(res.ok ? "Feito. Registrado no log de ações." : `Erro: ${j.error ?? res.status}`);
  }
  return (
    <div className="flex gap-1">
      <button disabled={busy} onClick={() => run("pausar")} className="border border-white/40 px-2 py-0.5 text-xs hover:bg-white hover:text-black">Pausar</button>
      {podeAumentar && <button disabled={busy} onClick={() => run("aumentar")} className="border border-white/40 px-2 py-0.5 text-xs hover:bg-white hover:text-black">+20%</button>}
    </div>
  );
}
