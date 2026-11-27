-- Archive comptable des paiements de ligue des comptes supprimés.
-- Aucune clé étrangère : la ligne survit à la suppression du profil,
-- de l'équipe et de l'inscription (vérification des remboursements).
create table if not exists public.deleted_account_payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique,
  amount integer not null,
  currency text not null default 'XOF',
  status text not null,
  payment_method text,
  league_name text,
  team_name text,
  payer_name text,
  payer_phone text,
  original_created_at timestamptz not null,
  archived_at timestamptz not null default now(),
  refund_status text not null default 'none',
  refund_note text,
  refunded_at timestamptz
);

create index if not exists deleted_account_payments_payer_phone_idx
  on public.deleted_account_payments (payer_phone);

-- Données comptables : accès service_role uniquement (aucune policy publique).
alter table public.deleted_account_payments enable row level security;
