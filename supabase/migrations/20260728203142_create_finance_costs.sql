create table if not exists public.finance_costs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  category text not null default 'AUTRE',
  amount integer not null check (amount >= 0),
  incurred_on date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.finance_costs is 'Coûts opérationnels déclarés (back-office Finance).';;
