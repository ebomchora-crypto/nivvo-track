import { describe, it, expect } from "vitest";
import { diagnoseFunnel } from "@/lib/funnel";
import { DEFAULT_RULES as R } from "@/lib/rules";
describe("funil", () => {
  it("muito clique, pouco checkout -> página", () => expect(diagnoseFunnel({ impressoes: 10000, cliques: 300, checkouts: 10, vendas: 1 }, R)).toBe("PAGINA"));
  it("checkout sem compra -> checkout", () => expect(diagnoseFunnel({ impressoes: 10000, cliques: 300, checkouts: 60, vendas: 2 }, R)).toBe("CHECKOUT"));
  it("pouco clique -> criativo", () => expect(diagnoseFunnel({ impressoes: 10000, cliques: 50, checkouts: 10, vendas: 5 }, R)).toBe("CRIATIVO"));
  it("sem volume não diagnostica", () => expect(diagnoseFunnel({ impressoes: 100, cliques: 5, checkouts: 0, vendas: 0 }, R)).toBeNull());
  it("funil saudável", () => expect(diagnoseFunnel({ impressoes: 10000, cliques: 300, checkouts: 60, vendas: 20 }, R)).toBeNull());
});
