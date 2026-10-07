-- =====================================================================
-- Instrumento de Controle da Documentação Escolar — CDE/SEMEC
-- Esquema do banco (Supabase / PostgreSQL). Execute uma única vez no
-- SQL Editor do projeto Supabase. Pode ser executado de novo sem perder dados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Membros autorizados: somente e-mails cadastrados aqui acessam os dados,
-- mesmo que outra pessoa consiga criar uma conta no projeto.
-- ---------------------------------------------------------------------
create table if not exists public.membros (
  email      text primary key,
  nome       text,
  criado_em  timestamptz not null default now()
);

create or replace function public.is_membro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.membros m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Registro automático de quem alterou e quando.
create or replace function public.marcar_atualizacao()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce(auth.jwt() ->> 'email', new.atualizado_por);
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Cadastro Unidades
-- ---------------------------------------------------------------------
create table if not exists public.unidades (
  id                text primary key,
  distrito          text,
  bairro            text,
  rede              text,
  inep              text,
  nome              text not null,
  situacao          text,
  tipo_unidade      text,
  distrito_anexo    text,
  tipo_predio       text,
  tipo_contrato     text,
  zona              text,
  endereco          text,
  numero            text,
  complemento       text,
  cep               text,
  telefone          text,
  email             text,
  ato_criacao       text,
  ato_autorizacao   text,
  vigencia_ato      text,   -- data AAAA-MM-DD ou texto (ex.: DEFINITIVO)
  diretor           text,
  contato           text,
  matricula         text,
  secretario        text,
  matricula2        text,
  data_atualizacao  date,
  observacoes       text,
  atualizado_em     timestamptz default now(),
  atualizado_por    text
);

-- ---------------------------------------------------------------------
-- Plano de Auditoria
-- ---------------------------------------------------------------------
create table if not exists public.auditorias (
  id              text primary key,
  unidade_id      text references public.unidades(id) on delete restrict,
  tipo            text,
  prioridade      text,
  data_planejada  date,
  data_realizada  date,
  equipe          text,
  situacao        text,
  observacoes     text,
  iniciada        boolean not null default false,
  atualizado_em   timestamptz default now(),
  atualizado_por  text
);
create index if not exists auditorias_unidade_idx on public.auditorias(unidade_id);

-- ---------------------------------------------------------------------
-- Auditoria Documental (um registro por item avaliado de cada auditoria)
-- ---------------------------------------------------------------------
create table if not exists public.avaliacoes (
  auditoria_id   text not null references public.auditorias(id) on delete cascade,
  item           text not null,
  situacao       text not null default 'Não avaliado',
  evidencia      text,
  achado         text,
  requer_acao    text default 'Não',
  prazo          date,
  responsavel    text,
  situacao_acao  text,
  atualizado_em  timestamptz default now(),
  atualizado_por text,
  primary key (auditoria_id, item)
);

-- ---------------------------------------------------------------------
-- Plano de Ação
-- ---------------------------------------------------------------------
create table if not exists public.acoes (
  id              text primary key,
  auditoria_id    text references public.auditorias(id) on delete set null,
  unidade_id      text references public.unidades(id) on delete set null,
  item            text,
  achado          text,
  acao            text,
  prioridade      text,
  responsavel     text,
  data_abertura   date,
  prazo           date,
  situacao        text,
  evidencia       text,
  data_conclusao  date,
  validacao       text,
  atualizado_em   timestamptz default now(),
  atualizado_por  text
);
create index if not exists acoes_auditoria_idx on public.acoes(auditoria_id);
create index if not exists acoes_unidade_idx on public.acoes(unidade_id);

-- ---------------------------------------------------------------------
-- Gatilhos de atualização e regras de acesso (RLS)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['unidades', 'auditorias', 'avaliacoes', 'acoes'] loop
    execute format('drop trigger if exists marcar_atualizacao on public.%I', t);
    execute format(
      'create trigger marcar_atualizacao before insert or update on public.%I
         for each row execute function public.marcar_atualizacao()', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "membros autorizados" on public.%I', t);
    execute format(
      'create policy "membros autorizados" on public.%I for all to authenticated
         using (public.is_membro()) with check (public.is_membro())', t);
  end loop;
end $$;

alter table public.membros enable row level security;
drop policy if exists "consultar o proprio cadastro" on public.membros;
create policy "consultar o proprio cadastro" on public.membros
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ---------------------------------------------------------------------
-- Anexos em PDF (ex.: o ato de autorização que comprova a vigência)
-- Os dados do anexo ficam na tabela; o arquivo, no Storage (bucket "anexos").
-- ---------------------------------------------------------------------
create table if not exists public.anexos (
  id          text primary key,
  entidade    text not null check (entidade in ('unidade', 'auditoria', 'avaliacao', 'acao')),
  -- unidade, auditoria e ação: o id do registro; avaliação: 'ID_DA_AUDITORIA:CÓDIGO_DO_ITEM'
  entidade_id text not null,
  categoria   text,
  nome        text not null,
  tamanho     integer not null check (tamanho > 0 and tamanho <= 10485760),
  criado_em   timestamptz not null default now(),
  criado_por  text
);
create index if not exists anexos_entidade_idx on public.anexos(entidade, entidade_id);

create or replace function public.marcar_autoria()
returns trigger
language plpgsql
as $$
begin
  new.criado_em := coalesce(new.criado_em, now());
  new.criado_por := coalesce(auth.jwt() ->> 'email', new.criado_por);
  return new;
end;
$$;
drop trigger if exists marcar_autoria on public.anexos;
create trigger marcar_autoria before insert on public.anexos
  for each row execute function public.marcar_autoria();

alter table public.anexos enable row level security;
drop policy if exists "membros autorizados" on public.anexos;
create policy "membros autorizados" on public.anexos for all to authenticated
  using (public.is_membro()) with check (public.is_membro());

-- Bucket privado (só PDF, até 10 MB) e regras de acesso aos arquivos.
-- Protegido para não falhar fora do Supabase (onde o Storage não existe).
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('anexos', 'anexos', false, 10485760, array['application/pdf'])
    on conflict (id) do update
      set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

    drop policy if exists "anexos: consultar" on storage.objects;
    create policy "anexos: consultar" on storage.objects for select to authenticated
      using (bucket_id = 'anexos' and public.is_membro());
    drop policy if exists "anexos: enviar" on storage.objects;
    create policy "anexos: enviar" on storage.objects for insert to authenticated
      with check (bucket_id = 'anexos' and public.is_membro());
    drop policy if exists "anexos: excluir" on storage.objects;
    create policy "anexos: excluir" on storage.objects for delete to authenticated
      using (bucket_id = 'anexos' and public.is_membro());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Depois de executar este arquivo, autorize cada pessoa da equipe:
--   insert into public.membros (email, nome) values ('pessoa@semec.belem.pa.gov.br', 'Nome');
-- e crie o usuário em Authentication > Users > Add user (com o mesmo e-mail).
-- ---------------------------------------------------------------------
