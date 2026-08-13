-- ============================================================
-- DKP · Inventário/Descartes — schema Supabase
-- Execute isto no SQL Editor do seu projeto Supabase.
-- ============================================================

-- ---------- Tabela de perfis (estende auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  papel text not null default 'colaborador' check (papel in ('admin','colaborador')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Tabela de descartes ----------
create table if not exists public.descartes (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  categoria text not null,
  motivo text not null,
  destino text not null,
  foto_url text,
  observacao text default '',
  solicitante_id uuid not null references public.profiles(id),
  solicitante_nome text not null,
  aprovador_id uuid references public.profiles(id),
  aprovador_nome text,
  status text not null default 'pendente' check (status in ('pendente','aprovado','rejeitado')),
  excluido boolean not null default false,
  data_criacao timestamptz not null default now(),
  data_decisao timestamptz
);

create index if not exists idx_descartes_status on public.descartes(status);
create index if not exists idx_descartes_solicitante on public.descartes(solicitante_id);

-- ---------- Função auxiliar: o usuário logado é admin ativo? ----------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and papel = 'admin' and ativo = true
  );
$$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.descartes enable row level security;

-- profiles: qualquer usuário autenticado pode ler todos os perfis
-- (necessário para mostrar nome de solicitante/aprovador nas listas)
create policy "profiles_select_authenticated"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- profiles: só admin pode alterar papel/ativo de outros; o próprio
-- usuário pode alterar só o próprio nome (não o papel)
create policy "profiles_update_admin_or_self"
  on public.profiles for update
  using (public.is_admin() or auth.uid() = id);

-- profiles: inserção feita pela Edge Function (service role) — sem
-- policy de insert para o cliente anônimo/autenticado comum.

-- descartes: admin vê tudo; colaborador vê só os próprios
create policy "descartes_select"
  on public.descartes for select
  using (public.is_admin() or solicitante_id = auth.uid());

-- descartes: qualquer autenticado pode criar, desde que como si mesmo
create policy "descartes_insert_self"
  on public.descartes for insert
  with check (solicitante_id = auth.uid());

-- descartes: admin pode atualizar qualquer registro (aprovar/rejeitar/excluir);
-- colaborador só pode atualizar os próprios enquanto pendentes
create policy "descartes_update"
  on public.descartes for update
  using (
    public.is_admin()
    or (solicitante_id = auth.uid() and status = 'pendente')
  );

-- ============================================================
-- Storage: bucket para fotos dos itens descartados
-- ============================================================
insert into storage.buckets (id, name, public)
values ('fotos-descartes', 'fotos-descartes', true)
on conflict (id) do nothing;

create policy "fotos_leitura_publica"
  on storage.objects for select
  using (bucket_id = 'fotos-descartes');

create policy "fotos_upload_autenticado"
  on storage.objects for insert
  with check (bucket_id = 'fotos-descartes' and auth.role() = 'authenticated');

-- ============================================================
-- Seed opcional: crie o primeiro admin PELO PAINEL do Supabase
-- (Authentication → Add user) e depois rode o insert abaixo
-- trocando o UUID pelo id do usuário criado.
-- ============================================================
-- insert into public.profiles (id, nome, email, papel, ativo)
-- values ('COLE-O-UUID-AQUI', 'Administrador', 'admin@dkp.org.br', 'admin', true);
