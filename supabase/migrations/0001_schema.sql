-- NivvoTrack: schema inicial. Datas em timestamptz (UTC); exibição em America/Sao_Paulo.
create extension if not exists pgcrypto;

create table accounts (            -- contas de anúncio
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  rede text not null default 'meta',            -- meta | tiktok | google
  external_id text not null,
  nome text, moeda text not null default 'USD',
  cambio_para_brl numeric(10,4) not null default 5.0,
  cambio_automatico boolean not null default false,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  unique (user_id, rede, external_id)
);

create table platform_connections (  -- uma por plataforma de vendas e conta
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plataforma text not null,
  nome text,
  token text not null unique default encode(gen_random_bytes(24),'hex'), -- vai na URL do webhook
  secret text not null,                        -- hottok / token de assinatura
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plataforma text not null, produto_externo_id text not null, nome text not null,
  margem_liquida numeric(12,2) not null default 0,   -- = custo máximo por venda
  moeda text not null default 'BRL',
  created_at timestamptz not null default now(),
  unique (user_id, plataforma, produto_externo_id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  connection_id uuid references platform_connections,
  product_id uuid references products,
  plataforma text not null, pedido_id text not null,
  status text not null check (status in ('pendente','aprovado','reembolsado','chargeback','cancelado')),
  valor_bruto numeric(14,2) not null default 0, valor_liquido numeric(14,2) not null default 0,
  moeda text not null default 'BRL', forma_pagamento text,
  comprador_hash text,                            -- HMAC; sem dado pessoal em claro (LGPD)
  data_pedido timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, plataforma, pedido_id)
);
create index orders_user_data on orders (user_id, data_pedido);
create index orders_status on orders (user_id, status);

create table order_utm (
  order_id uuid primary key references orders on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  fbclid text, fbp text, fbc text,
  campaign_name text, campaign_id text, adset_name text, adset_id text, ad_name text, ad_id text
);
create index order_utm_campaign on order_utm (user_id, campaign_id);
create index order_utm_adset on order_utm (user_id, adset_id);
create index order_utm_ad on order_utm (user_id, ad_id);

create table webhook_events (        -- payload bruto: auditoria e reprocessamento
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  connection_id uuid references platform_connections,
  plataforma text not null, payload jsonb, assinatura_valida boolean not null,
  processado boolean not null default false, ignorado boolean not null default false, erro text,
  recebido_em timestamptz not null default now()
);
create index webhook_events_recebido on webhook_events (user_id, recebido_em);

create table ad_spend_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  account_id uuid not null references accounts on delete cascade,
  data date not null,                              -- dia no fuso America/Sao_Paulo
  campaign_id text not null, campaign_name text,
  adset_id text not null, adset_name text,
  ad_id text not null, ad_name text,
  gasto numeric(14,2) not null default 0, impressoes bigint not null default 0,
  cliques_link bigint not null default 0, checkouts_iniciados bigint not null default 0,
  unique (account_id, data, ad_id)
);
create index spend_data on ad_spend_daily (user_id, data);
create index spend_campaign on ad_spend_daily (user_id, campaign_id);
create index spend_adset on ad_spend_daily (user_id, adset_id);
create index spend_ad on ad_spend_daily (user_id, ad_id);

create table rules_config (
  user_id uuid primary key references auth.users on delete cascade,
  aguarde_mult numeric not null default 2, aguarde_horas int not null default 72,
  pause_mult_sem_venda numeric not null default 3, pause_mult_cpa numeric not null default 1.5,
  escale_vendas int not null default 5, escale_cpa_pct numeric not null default 0.7,
  escale_dias int not null default 2, escale_aumento_pct numeric not null default 20,
  escale_intervalo_horas int not null default 48,
  teto_perda numeric(14,2) not null default 0, meta_cpa_pct numeric not null default 0.7
);

create table actions_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  entidade text not null, entidade_id text not null, acao text not null,
  detalhes jsonb, resultado jsonb, sucesso boolean, criado_em timestamptz not null default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  entidade text not null, entidade_id text not null, sinal text not null, motivo text,
  canal text, enviado boolean not null default false, criado_em timestamptz not null default now()
);

-- RLS: cada usuário só vê os próprios dados. Webhooks escrevem com service role (ignora RLS).
do $$
declare t text;
begin
  foreach t in array array['accounts','platform_connections','products','orders','order_utm',
    'webhook_events','ad_spend_daily','rules_config','actions_log','alerts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
