import { describe, it, expect } from "vitest";
import { splitNameId, attributionFromUtms, utmsFrom } from "@/lib/utm";

describe("splitNameId", () => {
  it("separa nome e id", () => expect(splitNameId("Camp 1|111")).toEqual({ name: "Camp 1", id: "111" }));
  it("nome com pipe usa o último", () => expect(splitNameId("A|B|99")).toEqual({ name: "A|B", id: "99" }));
  it("sem id numérico vira só nome", () => expect(splitNameId("Camp|abc")).toEqual({ name: "Camp|abc", id: null }));
  it("sem pipe", () => expect(splitNameId("Camp")).toEqual({ name: "Camp", id: null }));
  it("vazio/null", () => { expect(splitNameId("")).toEqual({ name: null, id: null }); expect(splitNameId(null)).toEqual({ name: null, id: null }); });
  it("só id", () => expect(splitNameId("|123")).toEqual({ name: null, id: "123" }));
});
describe("utmsFrom / attribution", () => {
  it("ignora 'null' literal", () => expect(utmsFrom({ utm_source: "null" }).source).toBeNull());
  it("mapeia campaign/medium/content", () => {
    const a = attributionFromUtms(utmsFrom({ utm_campaign: "C|1", utm_medium: "S|2", utm_content: "A|3" }));
    expect([a.campaign_id, a.adset_id, a.ad_id]).toEqual(["1", "2", "3"]);
  });
});
