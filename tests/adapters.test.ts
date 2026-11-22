import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { kiwify } from "@/lib/adapters/kiwify";
import { hotmart } from "@/lib/adapters/hotmart";

const fx = (n: string) => readFileSync(`tests/fixtures/${n}`, "utf8");
const ctx = { secret: "s3cret", salt: "salt" };

describe("kiwify", () => {
  const raw = fx("kiwify-approved.json");
  const sig = createHmac("sha1", "s3cret").update(raw).digest("hex");
  it("valida assinatura", () => {
    expect(kiwify.verify({ rawBody: raw, headers: new Headers(), query: new URLSearchParams({ signature: sig }) }, "s3cret")).toBe(true);
    expect(kiwify.verify({ rawBody: raw, headers: new Headers(), query: new URLSearchParams({ signature: "x" }) }, "s3cret")).toBe(false);
    expect(kiwify.verify({ rawBody: raw, headers: new Headers(), query: new URLSearchParams() }, "s3cret")).toBe(false);
  });
  it("normaliza", () => {
    const ev = kiwify.normalize(JSON.parse(raw), ctx)!;
    expect(ev).toMatchObject({ plataforma: "kiwify", pedido_id: "ord-123", status: "aprovado", valor_bruto: 197, valor_liquido: 170, moeda: "BRL" });
    expect(ev.utms.campaign).toBe("Camp 1|111");
    expect(ev.comprador_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ev)).not.toContain("example.com");
  });
  it("reembolso e status desconhecido", () => {
    const p = JSON.parse(raw);
    expect(kiwify.normalize({ ...p, order_status: "refunded" }, ctx)!.status).toBe("reembolsado");
    expect(kiwify.normalize({ ...p, order_status: "???" }, ctx)).toBeNull();
    expect(kiwify.normalize({}, ctx)).toBeNull();
  });
});

describe("hotmart", () => {
  const p = JSON.parse(fx("hotmart-approved.json"));
  it("valida hottok", () => {
    expect(hotmart.verify({ rawBody: "", headers: new Headers({ "x-hotmart-hottok": "s3cret" }), query: new URLSearchParams() }, "s3cret")).toBe(true);
    expect(hotmart.verify({ rawBody: "", headers: new Headers({ "x-hotmart-hottok": "bad" }), query: new URLSearchParams() }, "s3cret")).toBe(false);
    expect(hotmart.verify({ rawBody: "", headers: new Headers(), query: new URLSearchParams() }, "s3cret")).toBe(false);
  });
  it("normaliza com sck", () => {
    const ev = hotmart.normalize(p, ctx)!;
    expect(ev).toMatchObject({ plataforma: "hotmart", pedido_id: "HP123", status: "aprovado", valor_bruto: 97, valor_liquido: 80.5 });
    expect(ev.utms.campaign).toBe("|111");
    expect(ev.utms.source).toBe("fb");
  });
  it("sem sck válido não atribui", () => {
    const q = structuredClone(p); q.data.purchase.origin.sck = "abc";
    expect(hotmart.normalize(q, ctx)!.utms.campaign).toBeNull();
  });
  it("chargeback e evento ignorado", () => {
    expect(hotmart.normalize({ ...p, event: "PURCHASE_CHARGEBACK" }, ctx)!.status).toBe("chargeback");
    expect(hotmart.normalize({ ...p, event: "SUBSCRIPTION_CANCELLATION" }, ctx)).toBeNull();
  });
});
