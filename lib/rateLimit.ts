const hits = new Map<string, { n: number; reset: number }>();
/** Limite simples em memória por chave (60/min). Em produção multi-instância, usar Upstash/Redis. */
export function rateLimit(key: string, max = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return true; }
  h.n++;
  return h.n <= max;
}
