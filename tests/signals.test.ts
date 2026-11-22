import { describe, it, expect } from "vitest";
import { evaluateSignal, type SignalInput } from "@/lib/signals";
import { DEFAULT_RULES } from "@/lib/rules";

const M = 100;
const base: SignalInput = { gasto: 1000, vendas: 10, receita: 2000, maxCpa: M, ageHours: 100, diasBons: 3, horasDesdeUltimoAumento: null };
const ev = (o: Partial<SignalInput>, r = {}) => evaluateSignal({ ...base, ...o }, { ...DEFAULT_RULES, ...r });

describe("semáforo", () => {
  it("sem margem -> AGUARDE", () => expect(ev({ maxCpa: 0 }).signal).toBe("AGUARDE"));
  it("gasto < 2x -> AGUARDE; gasto == 2x sai de AGUARDE", () => {
    expect(ev({ gasto: 199, vendas: 0, receita: 0 }).signal).toBe("AGUARDE");
    expect(ev({ gasto: 200, vendas: 0, receita: 0 }).signal).toBe("ATENCAO");
  });
  it("menos de 72h -> AGUARDE; 72h exatas passam", () => {
    expect(ev({ ageHours: 71.9, gasto: 900, vendas: 0 }).signal).toBe("AGUARDE");
    expect(ev({ ageHours: 72, gasto: 300, vendas: 0, receita: 0 }).signal).toBe("PAUSE");
  });
  it("PAUSE sem venda: 299 atenção, 300 pause", () => {
    expect(ev({ gasto: 299, vendas: 0, receita: 0 }).signal).toBe("ATENCAO");
    expect(ev({ gasto: 300, vendas: 0, receita: 0 }).signal).toBe("PAUSE");
  });
  it("PAUSE por CPA: exatamente 1.5x é ATENÇÃO; acima é PAUSE", () => {
    expect(ev({ gasto: 600, vendas: 4, receita: 700 }).signal).toBe("ATENCAO"); // cpa 150
    expect(ev({ gasto: 604, vendas: 4, receita: 700 }).signal).toBe("PAUSE");   // cpa 151
  });
  it("ESCALE: 5 vendas, cpa == 70%, 2 dias", () => {
    const r = ev({ gasto: 350, vendas: 5, receita: 600, diasBons: 2 });
    expect(r.signal).toBe("ESCALE"); expect(r.suggestIncreasePct).toBe(20);
  });
  it("não escala com 4 vendas, 1 dia, ou cpa > 70%", () => {
    expect(ev({ gasto: 280, vendas: 4, receita: 500 }).signal).toBe("AGUARDE");
    expect(ev({ gasto: 350, vendas: 5, receita: 600, diasBons: 1 }).signal).toBe("AGUARDE");
    expect(ev({ gasto: 355, vendas: 5, receita: 600, diasBons: 3 }).signal).toBe("ATENCAO");
  });
  it("aumento limitado a 20% e respeita intervalo de 48h", () => {
    expect(ev({ gasto: 350, vendas: 5, receita: 600 }, { escale_aumento_pct: 50 }).suggestIncreasePct).toBe(20);
    const r = ev({ gasto: 350, vendas: 5, receita: 600, horasDesdeUltimoAumento: 10 });
    expect(r.signal).toBe("ESCALE"); expect(r.suggestIncreasePct).toBeUndefined();
    expect(ev({ gasto: 350, vendas: 5, receita: 600, horasDesdeUltimoAumento: 48 }).suggestIncreasePct).toBe(20);
  });
  it("TETO vence tudo, inclusive AGUARDE; teto 0 desativa", () => {
    expect(ev({ gasto: 500, receita: 0, ageHours: 1 }, { teto_perda: 500 }).signal).toBe("TETO");
    expect(ev({ gasto: 499, receita: 0, ageHours: 1 }, { teto_perda: 500 }).signal).toBe("AGUARDE");
    expect(ev({ gasto: 5000, receita: 0, vendas: 0 }, { teto_perda: 0 }).signal).toBe("PAUSE");
  });
  it("toda resposta tem motivo", () => expect(ev({}).reason.length).toBeGreaterThan(5));
});
