alter table rules_config
  add column if not exists margem_padrao numeric(12,2) not null default 0,
  add column if not exists ctr_min numeric not null default 0.01,
  add column if not exists connect_min numeric not null default 0.1,
  add column if not exists checkout_conv_min numeric not null default 0.15,
  add column if not exists min_cliques int not null default 100,
  add column if not exists min_checkouts int not null default 10,
  add column if not exists telegram_chat_id text;

-- Último sinal conhecido por entidade, para alertar só em mudança de estado.
create table if not exists signal_state (
  user_id uuid not null references auth.users on delete cascade,
  nivel text not null, entidade_id text not null, sinal text not null,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, nivel, entidade_id)
);
alter table signal_state enable row level security;
create policy "own rows" on signal_state for all using (user_id = auth.uid()) with check (user_id = auth.uid());
