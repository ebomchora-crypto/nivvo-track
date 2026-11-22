import type { Utms } from "./types";

export interface NameId { name: string | null; id: string | null }

/** "Nome da campanha|1202345" -> {name, id}. O ID é o último segmento após "|" (só dígitos). */
export function splitNameId(raw: string | null | undefined): NameId {
  if (!raw) return { name: null, id: null };
  const v = raw.trim();
  if (!v) return { name: null, id: null };
  const i = v.lastIndexOf("|");
  if (i === -1) return { name: v, id: null };
  const name = v.slice(0, i).trim();
  const id = v.slice(i + 1).trim();
  if (!/^\d+$/.test(id)) return { name: v, id: null };
  return { name: name || null, id };
}

export function emptyUtms(): Utms {
  return { source: null, medium: null, campaign: null, content: null, term: null, fbclid: null, fbp: null, fbc: null };
}

const clean = (v: unknown): string | null =>
  typeof v === "string" && v.trim() && v.trim() !== "null" && v.trim() !== "undefined" ? v.trim() : null;

export function utmsFrom(o: Record<string, unknown> | null | undefined): Utms {
  const r = o ?? {};
  return {
    source: clean(r.utm_source), medium: clean(r.utm_medium), campaign: clean(r.utm_campaign),
    content: clean(r.utm_content), term: clean(r.utm_term),
    fbclid: clean(r.fbclid), fbp: clean(r.fbp), fbc: clean(r.fbc),
  };
}

export interface AttributionIds {
  campaign_name: string | null; campaign_id: string | null;
  adset_name: string | null; adset_id: string | null;
  ad_name: string | null; ad_id: string | null;
}

/** campaign -> campanha, medium -> conjunto, content -> anúncio (convenção do NivvoTrack). */
export function attributionFromUtms(u: Utms): AttributionIds {
  const c = splitNameId(u.campaign), s = splitNameId(u.medium), a = splitNameId(u.content);
  return {
    campaign_name: c.name, campaign_id: c.id,
    adset_name: s.name, adset_id: s.id,
    ad_name: a.name, ad_id: a.id,
  };
}
