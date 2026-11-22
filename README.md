# NivvoTrack
Rastreador de vendas e painel de decisão (PAUSAR / ESCALAR) para tráfego pago. Next.js 14 + Tailwind (Vercel) e Supabase.

## Subir
1. **Supabase**: crie o projeto, aplique `supabase/migrations/0001_schema.sql` e `0002_rules_alerts.sql`. Crie seu usuário em Authentication → Users (e-mail/senha).
2. **Variáveis** (Vercel e `.env.local`, ver `.env.example`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BUYER_HASH_SALT` (string aleatória longa), `META_ACCESS_TOKEN`, `TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`.
3. **Edge Function**: `supabase functions deploy sync-meta-spend` e `supabase secrets set META_ACCESS_TOKEN=...`.
4. **Cron**: preencha e rode `supabase/cron.sql` (sync a cada hora no minuto 0, alertas no minuto 10).
5. **Deploy** do app na Vercel e entre em `/login`.

## Conectar
- **Plataformas de venda** (Kiwify, Hotmart): em *Configurações → Plataformas*, informe o token de assinatura/hottok. A URL do webhook aparece na tela. Detalhes e UTMs: `docs/plataformas.md`.
- **Meta**: use um token de System User (Business Manager) com `ads_read` e `ads_management` (necessário para pausar/aumentar). Cadastre as contas em *Configurações → Contas de anúncio*, informando moeda e câmbio.
- **Tracker**: ver `docs/plataformas.md`.
- **Telegram**: crie um bot no @BotFather, coloque o token em `TELEGRAM_BOT_TOKEN` e seu chat ID nas regras. WhatsApp não está implementado (exige API oficial/provedor).

## Semáforo (precedência)
🛑 TETO > ⚪ AGUARDE > 🔴 PAUSE > 🟢 ESCALE > 🟡 ATENÇÃO. Custo máximo por venda = margem do produto (ou margem padrão, se o item ainda não vendeu). Bom custo mas sem 5 vendas/2 dias aparece como AGUARDE com o motivo. Custo entre 1× e 1,5× o máximo é ATENÇÃO. Regras editáveis no painel; o aumento é travado em +20% e ≥48h entre aumentos.

## Testes
`npm test` (semáforo, funil, métricas/datas, UTM, adaptadores) · `npm run typecheck` · `npm run build`.

## Limites conhecidos
- Adaptadores Kiwify/Hotmart seguem a documentação pública; **confirme com payload real** (fixtures marcados como provisórios).
- Receita assumida em BRL (só o gasto é convertido). Rate limit em memória (use Redis em produção multi-instância).
- Filtros de plataforma/produto restringem só as vendas; o gasto continua total.
