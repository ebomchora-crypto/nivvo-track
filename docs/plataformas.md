# Plataformas e UTMs

Webhook: `https://SEU-DOMINIO/api/webhooks/{plataforma}/{token}` (token gerado em `platform_connections`).

## Kiwify
- Apps → Webhooks → URL acima + `?signature` é adicionado pela Kiwify (HMAC-SHA1 do corpo com o token do webhook; guarde esse token em `platform_connections.secret`).
- UTMs: o checkout precisa receber `utm_*` na URL; chegam em `TrackingParameters`. **Confirmar com payload real.**

## Hotmart
- Ferramentas → Webhook (v2.0.0); o `hottok` vai em `platform_connections.secret`.
- A Hotmart só repassa `src` e `sck`. O tracker.js preenche `src=utm_source` e `sck=<campanha>-<conjunto>-<anúncio>` (IDs). **Confirmar com payload real.**

## Nova plataforma
Crie `lib/adapters/<nome>.ts` implementando `PlatformAdapter` (verify + normalize), registre em `registry.ts`, adicione fixture e teste.

## tracker.js
```html
<script>window.NIVVO_CHECKOUT_HOSTS=["pay.kiwify.com.br","pay.hotmart.com"];</script>
<script src="https://SEU-DOMINIO/tracker.js" defer></script>
```
UTMs da Meta: `utm_campaign={{campaign.name}}|{{campaign.id}}`, `utm_medium={{adset.name}}|{{adset.id}}`, `utm_content={{ad.name}}|{{ad.id}}`.
