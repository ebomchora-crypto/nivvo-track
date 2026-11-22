export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (n: number | null) => (n === null ? "—" : (n * 100).toFixed(1).replace(".", ",") + "%");
export const num = (n: number | null, d = 2) => (n === null ? "—" : n.toFixed(d).replace(".", ","));

/** Dia (YYYY-MM-DD) em America/Sao_Paulo para um instante ISO. */
export function dayInSP(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(typeof iso === "string" ? new Date(iso) : iso);
}
/** Início do dia em São Paulo (UTC-3, sem horário de verão desde 2019). */
export const startOfDaySP = (day: string) => new Date(`${day}T00:00:00-03:00`);
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
